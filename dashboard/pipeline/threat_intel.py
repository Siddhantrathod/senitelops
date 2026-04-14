"""
Threat Intelligence module for SentinelOps.
Cross-references CVEs with the NVD API v2 and the CISA KEV catalog
to provide real-world exploitability context.
"""
import os
import json
import logging
import time
import threading
from typing import Optional, Dict, Any

logger = logging.getLogger("SentinelOps.ThreatIntel")

# In-memory cache: { cve_id -> { data, timestamp } }
_cve_cache: Dict[str, Dict[str, Any]] = {}
_cve_cache_lock = threading.Lock()
CACHE_TTL_SECONDS = 3600 * 24  # 24 hours

# CISA KEV: in-memory set of actively exploited CVE IDs
_cisa_kev_ids: set = set()
_cisa_kev_loaded = False
_cisa_kev_lock = threading.Lock()
CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"


def _load_cisa_kev():
    """Download and cache the CISA KEV catalog. Runs once per process."""
    global _cisa_kev_ids, _cisa_kev_loaded
    with _cisa_kev_lock:
        if _cisa_kev_loaded:
            return
        try:
            import urllib.request
            with urllib.request.urlopen(CISA_KEV_URL, timeout=15) as resp:
                data = json.loads(resp.read().decode())
            vulns = data.get("vulnerabilities", [])
            _cisa_kev_ids = {v.get("cveID", "") for v in vulns}
            _cisa_kev_loaded = True
            logger.info(f"CISA KEV catalog loaded: {len(_cisa_kev_ids)} CVEs")
        except Exception as e:
            logger.warning(f"Failed to load CISA KEV catalog: {e}")
            _cisa_kev_ids = set()
            _cisa_kev_loaded = True  # Mark as loaded to avoid retrying every call


def is_in_cisa_kev(cve_id: str) -> bool:
    """Check if a CVE is in the CISA Known Exploited Vulnerabilities catalog."""
    if not _cisa_kev_loaded:
        _load_cisa_kev()
    return cve_id.upper() in _cisa_kev_ids


def enrich_cve(cve_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch enrichment data for a CVE from the NVD API v2.
    Returns a dict with cvss_score, severity, description, cwe, references, and is_actively_exploited.
    Results are cached for 24 hours.
    """
    if not cve_id or not cve_id.startswith("CVE-"):
        return None

    # Check cache
    with _cve_cache_lock:
        cached = _cve_cache.get(cve_id)
        if cached and (time.time() - cached["ts"]) < CACHE_TTL_SECONDS:
            return cached["data"]

    # Ensure CISA KEV is loaded (non-blocking for first call)
    if not _cisa_kev_loaded:
        threading.Thread(target=_load_cisa_kev, daemon=True).start()

    try:
        import urllib.request
        api_key = os.getenv("NVD_API_KEY", "")
        headers = {}
        if api_key:
            headers["apiKey"] = api_key

        url = f"https://services.nvd.nist.gov/rest/json/cves/2.0?cveId={cve_id}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        vulnerabilities = data.get("vulnerabilities", [])
        if not vulnerabilities:
            return None

        cve_data = vulnerabilities[0].get("cve", {})
        descriptions = cve_data.get("descriptions", [])
        description_en = next(
            (d["value"] for d in descriptions if d.get("lang") == "en"), ""
        )

        # Extract CVSS score (prefer v3.1, fallback to v3.0, then v2.0)
        metrics = cve_data.get("metrics", {})
        cvss_score = None
        severity = None
        for metric_key in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
            metrics_list = metrics.get(metric_key, [])
            if metrics_list:
                cvss_data = metrics_list[0].get("cvssData", {})
                cvss_score = cvss_data.get("baseScore")
                severity = cvss_data.get("baseSeverity") or metrics_list[0].get("baseSeverity")
                break

        # Extract CWE
        weaknesses = cve_data.get("weaknesses", [])
        cwes = []
        for w in weaknesses:
            for desc in w.get("description", []):
                if desc.get("lang") == "en":
                    cwes.append(desc.get("value", ""))

        # References
        references = [r.get("url") for r in cve_data.get("references", [])[:3] if r.get("url")]

        result = {
            "cve_id": cve_id,
            "description": description_en[:400] if description_en else "",
            "cvss_score": cvss_score,
            "severity": severity,
            "cwes": cwes,
            "references": references,
            "is_actively_exploited": is_in_cisa_kev(cve_id),
            "nvd_url": f"https://nvd.nist.gov/vuln/detail/{cve_id}",
        }

        with _cve_cache_lock:
            _cve_cache[cve_id] = {"data": result, "ts": time.time()}

        return result

    except Exception as e:
        logger.warning(f"NVD API lookup failed for {cve_id}: {e}")
        # Return minimal enrichment with CISA KEV check only
        kev_result = {
            "cve_id": cve_id,
            "description": "",
            "cvss_score": None,
            "severity": None,
            "cwes": [],
            "references": [],
            "is_actively_exploited": is_in_cisa_kev(cve_id),
            "nvd_url": f"https://nvd.nist.gov/vuln/detail/{cve_id}",
        }
        with _cve_cache_lock:
            _cve_cache[cve_id] = {"data": kev_result, "ts": time.time()}
        return kev_result


def enrich_trivy_report(trivy_report: dict) -> dict:
    """
    Enrich a Trivy report by adding threat intelligence data to each CVE.
    Returns a new dict with an added `threat_intel` key per vulnerability.
    """
    enriched_results = []
    for result in trivy_report.get("Results", []):
        enriched_vulns = []
        for vuln in result.get("Vulnerabilities", []):
            cve_id = vuln.get("VulnerabilityID", "")
            enrichment = None
            if cve_id.startswith("CVE-"):
                enrichment = enrich_cve(cve_id)
            enriched_vulns.append({**vuln, "threat_intel": enrichment})
        enriched_results.append({**result, "Vulnerabilities": enriched_vulns})

    return {**trivy_report, "Results": enriched_results}
