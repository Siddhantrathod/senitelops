#!/usr/bin/env python3
"""
DAST (Dynamic Application Security Testing) Scanner for SentinelOps
Uses OWASP ZAP to scan running web applications for runtime vulnerabilities.

Requires Docker to run the ZAP container.
Falls back to a lightweight HTTP header/response check if ZAP is unavailable.
"""

import json
import os
import re
import socket
import subprocess
import logging
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger("SentinelOps.DAST")

# ═══════════════════════════════════════════════════════════════════
# ZAP CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

ZAP_DOCKER_IMAGE = "ghcr.io/zaproxy/zaproxy:stable"
ZAP_SCAN_TIMEOUT = 600      # 10 minutes max
CONTAINER_STARTUP_TIMEOUT = 30  # seconds to wait for app container
DEFAULT_APP_PORT = 8080

# Risk level mapping from ZAP's numeric values
ZAP_RISK_MAP = {
    0: "INFORMATIONAL",
    1: "LOW",
    2: "MEDIUM",
    3: "HIGH",
}


def _normalise_risk(risk) -> str:
    """Map ZAP risk to our severity levels."""
    if isinstance(risk, int):
        return ZAP_RISK_MAP.get(risk, "LOW")
    risk_str = str(risk).upper()
    if risk_str in ("HIGH", "CRITICAL"):
        return "HIGH"
    if risk_str == "MEDIUM":
        return "MEDIUM"
    if risk_str == "LOW":
        return "LOW"
    return "INFORMATIONAL"


# ═══════════════════════════════════════════════════════════════════
# DOCKER HELPERS
# ═══════════════════════════════════════════════════════════════════

def is_docker_available() -> bool:
    """Check if Docker is available."""
    return shutil.which("docker") is not None


def is_zap_image_available() -> bool:
    """Check if the ZAP Docker image is already pulled."""
    if not is_docker_available():
        return False
    try:
        result = subprocess.run(
            ["docker", "image", "inspect", ZAP_DOCKER_IMAGE],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0
    except Exception:
        return False


def _detect_exposed_port(dockerfile_path: str) -> Optional[int]:
    """Parse Dockerfile to find EXPOSE directives."""
    try:
        with open(dockerfile_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line.upper().startswith("EXPOSE"):
                    # EXPOSE 8080, EXPOSE 3000/tcp, EXPOSE 80 443
                    parts = line.split()
                    if len(parts) >= 2:
                        port_str = parts[1].split("/")[0]  # strip /tcp /udp
                        return int(port_str)
    except (IOError, ValueError):
        pass
    return None


def _is_port_open(host: str, port: int, timeout: float = 2.0) -> bool:
    """Check if a TCP port is open."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False


def _wait_for_container(host: str, port: int, timeout: int = CONTAINER_STARTUP_TIMEOUT) -> bool:
    """Wait for a container to become ready by checking its port."""
    logger.info(f"Waiting for {host}:{port} to become ready...")
    start = time.time()
    while time.time() - start < timeout:
        if _is_port_open(host, port):
            logger.info(f"Port {port} is open after {time.time() - start:.1f}s")
            return True
        time.sleep(1)
    logger.warning(f"Port {port} did not become ready within {timeout}s")
    return False


def _start_app_container(
    image_name: str,
    port: int,
    container_name: str = "sentinelops-dast-target",
) -> Tuple[bool, str]:
    """Start the application container for DAST scanning."""
    logger.info(f"Starting container {image_name} on port {port}")

    # Stop if already running
    subprocess.run(
        ["docker", "rm", "-f", container_name],
        capture_output=True, timeout=10,
    )

    try:
        result = subprocess.run(
            [
                "docker", "run", "-d",
                "--name", container_name,
                "-p", f"{port}:{port}",
                image_name,
            ],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return False, f"Failed to start container: {result.stderr.strip()}"

        container_id = result.stdout.strip()
        logger.info(f"Container started: {container_id[:12]}")
        return True, container_id

    except Exception as e:
        return False, f"Error starting container: {e}"


def _stop_app_container(container_name: str = "sentinelops-dast-target"):
    """Stop and remove the app container."""
    try:
        subprocess.run(
            ["docker", "rm", "-f", container_name],
            capture_output=True, timeout=10,
        )
        logger.info(f"Stopped container: {container_name}")
    except Exception as e:
        logger.warning(f"Error stopping container: {e}")


# ═══════════════════════════════════════════════════════════════════
# ZAP SCANNER
# ═══════════════════════════════════════════════════════════════════

def run_zap_baseline(
    target_url: str,
    output_path: str,
) -> Tuple[bool, str, List[dict]]:
    """
    Run ZAP baseline scan (passive/spider only — fast, ~2 min).

    Args:
        target_url:  URL of the application to scan
        output_path: Path to save the JSON report

    Returns:
        Tuple of (success, message, normalised_alerts)
    """
    logger.info(f"Running ZAP baseline scan on: {target_url}")

    # Ensure output dir exists
    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)
    report_filename = os.path.basename(output_path)

    try:
        cmd = [
            "docker", "run", "--rm",
            "--network", "host",
            "-v", f"{output_dir}:/zap/wrk:rw",
            "-t", ZAP_DOCKER_IMAGE,
            "zap-baseline.py",
            "-t", target_url,
            "-J", report_filename,
            "-I",  # don't fail on warnings
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=ZAP_SCAN_TIMEOUT,
        )

        # ZAP returns:
        #  0 = clean
        #  1 = warnings (findings but not failures)
        #  2 = errors (failures)
        #  3 = both
        # We treat all as success since we parse the report
        if result.returncode not in (0, 1, 2, 3):
            stderr = result.stderr.strip()
            return False, f"ZAP error (exit {result.returncode}): {stderr[:500]}", []

        findings = _parse_zap_report(output_path)
        msg = f"ZAP baseline scan found {len(findings)} alert(s)"
        logger.info(msg)
        return True, msg, findings

    except FileNotFoundError:
        return False, "Docker is not installed", []
    except subprocess.TimeoutExpired:
        return False, f"ZAP scan timed out (>{ZAP_SCAN_TIMEOUT}s)", []
    except Exception as e:
        return False, f"ZAP error: {e}", []


def run_zap_full(
    target_url: str,
    output_path: str,
) -> Tuple[bool, str, List[dict]]:
    """
    Run ZAP full active scan (slower, ~10+ min but more thorough).
    """
    logger.info(f"Running ZAP full scan on: {target_url}")

    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)
    report_filename = os.path.basename(output_path)

    try:
        cmd = [
            "docker", "run", "--rm",
            "--network", "host",
            "-v", f"{output_dir}:/zap/wrk:rw",
            "-t", ZAP_DOCKER_IMAGE,
            "zap-full-scan.py",
            "-t", target_url,
            "-J", report_filename,
            "-I",
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=ZAP_SCAN_TIMEOUT * 3,  # longer timeout for full scan
        )

        if result.returncode not in (0, 1, 2, 3):
            return False, f"ZAP full scan error: {result.stderr.strip()[:500]}", []

        findings = _parse_zap_report(output_path)
        msg = f"ZAP full scan found {len(findings)} alert(s)"
        return True, msg, findings

    except FileNotFoundError:
        return False, "Docker is not installed", []
    except subprocess.TimeoutExpired:
        return False, "ZAP full scan timed out", []
    except Exception as e:
        return False, f"ZAP full scan error: {e}", []


def _parse_zap_report(report_path: str) -> List[dict]:
    """Parse ZAP JSON report into normalised alert list."""
    if not os.path.exists(report_path):
        return []

    try:
        with open(report_path) as f:
            raw = json.load(f)
    except (json.JSONDecodeError, IOError):
        return []

    alerts = []

    # ZAP JSON report structure varies by version.  Try common shapes.
    raw_alerts = []
    if isinstance(raw, dict):
        # Traditional report: { "site": [...] }
        for site in raw.get("site", []):
            for alert in site.get("alerts", []):
                raw_alerts.append(alert)
        # Newer report: { "alerts": [...] }
        if not raw_alerts:
            raw_alerts = raw.get("alerts", [])
    elif isinstance(raw, list):
        raw_alerts = raw

    for alert in raw_alerts:
        risk_code = alert.get("riskcode", alert.get("risk", 0))
        try:
            risk_code = int(risk_code)
        except (ValueError, TypeError):
            risk_code = 0

        # Collect affected URLs
        instances = alert.get("instances", [])
        urls = list(set(inst.get("uri", "") for inst in instances if inst.get("uri")))

        alerts.append({
            "alert": alert.get("alert", alert.get("name", "Unknown")),
            "risk": _normalise_risk(risk_code),
            "risk_code": risk_code,
            "confidence": alert.get("confidence", ""),
            "cweid": str(alert.get("cweid", "")),
            "wascid": str(alert.get("wascid", "")),
            "description": alert.get("desc", alert.get("description", "")),
            "solution": alert.get("solution", ""),
            "reference": alert.get("reference", ""),
            "urls": urls[:5],  # Keep max 5 URLs per alert
            "count": alert.get("count", len(instances)),
            "plugin_id": str(alert.get("pluginid", alert.get("pluginId", ""))),
        })

    return alerts


# ═══════════════════════════════════════════════════════════════════
# FALLBACK: LIGHTWEIGHT HTTP HEADER CHECK
# ═══════════════════════════════════════════════════════════════════

def _run_header_check(target_url: str) -> List[dict]:
    """
    Simple HTTP security header check — fallback when ZAP is unavailable.
    Checks for missing security headers.
    """
    import urllib.request
    import ssl

    logger.info(f"Running lightweight HTTP header check on: {target_url}")
    findings = []

    EXPECTED_HEADERS = {
        "X-Content-Type-Options": {
            "description": "Missing X-Content-Type-Options Header",
            "risk": "LOW",
            "solution": "Set X-Content-Type-Options: nosniff",
            "cweid": "693",
        },
        "X-Frame-Options": {
            "description": "Missing X-Frame-Options Header (Clickjacking)",
            "risk": "MEDIUM",
            "solution": "Set X-Frame-Options: DENY or SAMEORIGIN",
            "cweid": "1021",
        },
        "Strict-Transport-Security": {
            "description": "Missing Strict-Transport-Security Header",
            "risk": "LOW",
            "solution": "Set Strict-Transport-Security: max-age=31536000; includeSubDomains",
            "cweid": "319",
        },
        "Content-Security-Policy": {
            "description": "Missing Content-Security-Policy Header",
            "risk": "MEDIUM",
            "solution": "Define a Content-Security-Policy header",
            "cweid": "693",
        },
        "X-XSS-Protection": {
            "description": "Missing X-XSS-Protection Header",
            "risk": "LOW",
            "solution": "Set X-XSS-Protection: 1; mode=block",
            "cweid": "79",
        },
    }

    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(target_url, method="GET")
        req.add_header("User-Agent", "SentinelOps-DAST/1.0")

        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            response_headers = {k.lower(): v for k, v in resp.headers.items()}

            for header, info in EXPECTED_HEADERS.items():
                if header.lower() not in response_headers:
                    findings.append({
                        "alert": info["description"],
                        "risk": info["risk"],
                        "risk_code": {"HIGH": 3, "MEDIUM": 2, "LOW": 1}.get(info["risk"], 0),
                        "confidence": "HIGH",
                        "cweid": info["cweid"],
                        "wascid": "",
                        "description": f"The HTTP header '{header}' is not set in the response.",
                        "solution": info["solution"],
                        "reference": "",
                        "urls": [target_url],
                        "count": 1,
                        "plugin_id": "header-check",
                    })

            # Check for server version disclosure
            server = response_headers.get("server", "")
            if server and any(v in server.lower() for v in ["apache/", "nginx/", "iis/"]):
                findings.append({
                    "alert": "Server Version Disclosure",
                    "risk": "LOW",
                    "risk_code": 1,
                    "confidence": "HIGH",
                    "cweid": "200",
                    "wascid": "13",
                    "description": f"The server is disclosing its version: {server}",
                    "solution": "Remove or obfuscate the Server header",
                    "reference": "",
                    "urls": [target_url],
                    "count": 1,
                    "plugin_id": "header-check",
                })

    except Exception as e:
        logger.warning(f"HTTP header check failed: {e}")

    return findings


# ═══════════════════════════════════════════════════════════════════
# REPORT BUILDER
# ═══════════════════════════════════════════════════════════════════

def _compute_metrics(alerts: List[dict]) -> Dict[str, int]:
    """Compute risk level counts from alerts."""
    metrics = {"high": 0, "medium": 0, "low": 0, "informational": 0, "total": len(alerts)}
    for a in alerts:
        risk = a.get("risk", "LOW").lower()
        if risk in metrics:
            metrics[risk] += 1
    return metrics


def _build_dast_report(
    target_url: str,
    alerts: List[dict],
    tool_used: str,
    tool_available: bool,
    scan_type: str,
    scan_message: str,
) -> Dict[str, Any]:
    """Build the unified DAST report."""
    return {
        "schema_version": 1,
        "scan_type": "dast",
        "timestamp": datetime.now().isoformat(),
        "target_url": target_url,
        "tool": tool_used,
        "tool_available": tool_available,
        "scan_mode": scan_type,
        "message": scan_message,
        "total_alerts": len(alerts),
        "results": alerts,
        "metrics": _compute_metrics(alerts),
    }


# ═══════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════

def run_dast_scan(
    target_url: str,
    reports_dir: str,
    scan_type: str = "baseline",
    image_name: str = None,
    dockerfile_path: str = None,
    app_port: int = None,
) -> Dict[str, Any]:
    """
    Run DAST scan on a target URL or Docker container.

    If image_name is provided and a target_url is not, the scanner will:
    1. Detect the exposed port from the Dockerfile
    2. Start the container
    3. Scan it with ZAP
    4. Stop the container

    Args:
        target_url:     URL to scan (e.g. http://localhost:8080)
        reports_dir:    Directory to save report files
        scan_type:      "baseline" (fast) or "full" (thorough)
        image_name:     Docker image to start if no URL given
        dockerfile_path: Path to Dockerfile for port detection
        app_port:       Override port (auto-detected from Dockerfile if not provided)

    Returns:
        Unified DAST report dictionary
    """
    os.makedirs(reports_dir, exist_ok=True)
    output_path = os.path.join(reports_dir, "dast-report.json")
    container_started = False
    container_name = "sentinelops-dast-target"

    try:
        # If no target URL but we have an image, start the container
        if not target_url and image_name:
            # Detect port
            if not app_port and dockerfile_path:
                app_port = _detect_exposed_port(dockerfile_path)
            if not app_port:
                app_port = DEFAULT_APP_PORT

            success, msg = _start_app_container(image_name, app_port, container_name)
            if not success:
                report = _build_dast_report(
                    f"http://localhost:{app_port}", [], "zap", False,
                    scan_type, f"Could not start container: {msg}",
                )
                with open(output_path, "w") as f:
                    json.dump(report, f, indent=2)
                return report

            container_started = True
            target_url = f"http://localhost:{app_port}"

            # Wait for container to be ready
            if not _wait_for_container("localhost", app_port):
                _stop_app_container(container_name)
                report = _build_dast_report(
                    target_url, [], "zap", True,
                    scan_type, f"Container did not become ready on port {app_port}",
                )
                with open(output_path, "w") as f:
                    json.dump(report, f, indent=2)
                return report

        if not target_url:
            report = _build_dast_report(
                "", [], "none", False, scan_type,
                "No target URL or container image provided",
            )
            with open(output_path, "w") as f:
                json.dump(report, f, indent=2)
            return report

        # Run ZAP if Docker is available
        if is_docker_available():
            if scan_type == "full":
                success, message, alerts = run_zap_full(target_url, output_path)
            else:
                success, message, alerts = run_zap_baseline(target_url, output_path)

            tool_used = "zap"
            tool_available = True

            if not success:
                logger.warning(f"ZAP failed: {message}, falling back to header check")
                alerts = _run_header_check(target_url)
                tool_used = "header-check-fallback"
                message = f"ZAP failed ({message}), used header check: {len(alerts)} finding(s)"
        else:
            logger.info("Docker not available — using HTTP header check fallback")
            alerts = _run_header_check(target_url)
            tool_used = "header-check-fallback"
            tool_available = False
            message = f"Header check found {len(alerts)} finding(s)"

        report = _build_dast_report(
            target_url, alerts, tool_used, tool_available,
            scan_type, message,
        )

        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)
        logger.info(f"DAST report saved to {output_path}")

        return report

    finally:
        if container_started:
            _stop_app_container(container_name)
