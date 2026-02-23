import json
from pathlib import Path
import sys
import os

# Get the base directory (where this script is located)
BASE_DIR = Path(__file__).parent.absolute()
REPORTS_DIR = BASE_DIR / "runtime" / "reports"
DASHBOARD_DATA_DIR = BASE_DIR / "dashboard" / "data"
POLICY_FILE = DASHBOARD_DATA_DIR / "policy.json"

# Ensure reports directory exists
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Default policy settings (used if no policy file exists)
DEFAULT_POLICY = {
    "minScore": 70,
    "blockCritical": True,
    "blockHigh": False,
    "maxCriticalVulns": 0,
    "maxHighVulns": 5,
    "autoBlock": True,
    "blockOnSecrets": True,
    "blockOnDastHigh": False
}

def load_json(path):
    if not Path(path).exists():
        return None
    with open(path) as f:
        return json.load(f)

def load_policy():
    """Load policy from dashboard's policy file or use defaults"""
    if POLICY_FILE.exists():
        try:
            with open(POLICY_FILE) as f:
                policy = json.load(f)
                print(f"✓ Loaded policy from dashboard: {POLICY_FILE}")
                return policy
        except (json.JSONDecodeError, IOError) as e:
            print(f"⚠ Warning: Could not load policy file: {e}")
    
    print(f"ℹ Using default policy (no dashboard policy found at {POLICY_FILE})")
    return DEFAULT_POLICY

def calculate_score(bandit_report, trivy_report, sast_report=None,
                    gitleaks_report=None, dast_report=None):
    """Calculate security score with separated weights for code vs image vulns.
    
    Supports both the unified SAST report (multi-language) and legacy
    Bandit-only reports. Code vulnerabilities get full-weight penalties.
    Image/dependency vulnerabilities (Trivy) get reduced weight (~50%).
    Secrets (Gitleaks) and DAST (ZAP) findings also contribute penalties.
    """
    reasons = []

    # SAST: count code issues by severity (unified or bandit-only)
    sast_high = 0
    sast_medium = 0
    sast_low = 0
    languages_scanned = []
    tools_used = []

    if sast_report and sast_report.get("metrics"):
        # Use unified SAST report
        metrics = sast_report.get("metrics", {}).get("totals", {})
        sast_high = metrics.get("high", 0)
        sast_medium = metrics.get("medium", 0)
        sast_low = metrics.get("low", 0)
        languages_scanned = list(sast_report.get("languages_detected", {}).keys())
        tools_used = [t for t, info in sast_report.get("tools_used", {}).items() if info.get("success")]
        if sast_high > 0:
            reasons.append(f"{sast_high} HIGH issues in code (SAST: {', '.join(tools_used)})")
        if sast_medium > 0:
            reasons.append(f"{sast_medium} MEDIUM issues in code (SAST)")
    elif bandit_report:
        # Fallback: Bandit-only
        for r in bandit_report.get("results", []):
            sev = r.get("issue_severity", "").upper()
            if sev == "HIGH":
                sast_high += 1
            elif sev == "MEDIUM":
                sast_medium += 1
            elif sev == "LOW":
                sast_low += 1
        if sast_high > 0:
            reasons.append(f"{sast_high} HIGH issues in code (SAST)")
        if sast_medium > 0:
            reasons.append(f"{sast_medium} MEDIUM issues in code (SAST)")

    # Trivy: count image/dependency vulns by severity
    trivy_critical = 0
    trivy_high = 0
    trivy_medium = 0
    trivy_low = 0
    if trivy_report:
        for res in trivy_report.get("Results", []):
            for v in (res.get("Vulnerabilities") or []):
                sev = v.get("Severity")
                if sev == "CRITICAL":
                    trivy_critical += 1
                elif sev == "HIGH":
                    trivy_high += 1
                elif sev == "MEDIUM":
                    trivy_medium += 1
                elif sev == "LOW":
                    trivy_low += 1

    if trivy_critical > 0:
        reasons.append(f"{trivy_critical} CRITICAL vulnerabilities in image")
    if trivy_high > 0:
        reasons.append(f"{trivy_high} HIGH vulnerabilities in image")

    # Gitleaks: count secrets by severity
    secrets_critical = 0
    secrets_high = 0
    secrets_medium = 0
    secrets_total = 0
    if gitleaks_report and gitleaks_report.get("results"):
        for secret in gitleaks_report.get("results", []):
            sev = secret.get("severity", "MEDIUM").upper()
            if sev == "CRITICAL":
                secrets_critical += 1
            elif sev == "HIGH":
                secrets_high += 1
            else:
                secrets_medium += 1
        secrets_total = secrets_critical + secrets_high + secrets_medium
        if secrets_total > 0:
            reasons.append(f"{secrets_total} hardcoded secret(s) detected (Gitleaks)")

    # DAST: count alerts by risk
    dast_high = 0
    dast_medium = 0
    dast_low = 0
    dast_total = 0
    if dast_report and dast_report.get("results"):
        for alert in dast_report.get("results", []):
            risk = alert.get("risk", "LOW").upper()
            if risk == "HIGH":
                dast_high += 1
            elif risk == "MEDIUM":
                dast_medium += 1
            elif risk == "LOW":
                dast_low += 1
        dast_total = dast_high + dast_medium + dast_low
        if dast_high > 0:
            reasons.append(f"{dast_high} HIGH-risk DAST alerts (ZAP)")
        if dast_medium > 0:
            reasons.append(f"{dast_medium} MEDIUM-risk DAST alerts (ZAP)")

    # Code vulns: full weight (max code penalty: 25 + 10 + 5 = 40)
    code_high_impact = min(25, sast_high * 8)
    code_medium_impact = min(10, sast_medium * 3)
    code_low_impact = min(5, sast_low * 1)

    # Image vulns: reduced weight ~50% (max image penalty: 25 + 15 + 8 + 2 = 50)
    image_critical_impact = min(25, trivy_critical * 10)
    image_high_impact = min(15, trivy_high * 3)
    image_medium_impact = min(8, trivy_medium * 1)
    image_low_impact = min(2, int(trivy_low * 0.5))

    # Secrets: critical weight (max secrets penalty: 30 + 20 + 10 = 60)
    secrets_critical_impact = min(30, secrets_critical * 12)
    secrets_high_impact = min(20, secrets_high * 8)
    secrets_medium_impact = min(10, secrets_medium * 4)

    # DAST: moderate weight (max DAST penalty: 20 + 10 + 3 = 33)
    dast_high_impact = min(20, dast_high * 6)
    dast_medium_impact = min(10, dast_medium * 2)
    dast_low_impact = min(3, dast_low * 1)

    total_penalty = (code_high_impact + code_medium_impact + code_low_impact +
                     image_critical_impact + image_high_impact + image_medium_impact + image_low_impact +
                     secrets_critical_impact + secrets_high_impact + secrets_medium_impact +
                     dast_high_impact + dast_medium_impact + dast_low_impact)
    score = max(0, 100 - total_penalty)

    critical_count = trivy_critical + secrets_critical
    high_count = sast_high + trivy_high + secrets_high + dast_high
    return score, reasons, critical_count, high_count, secrets_total, dast_high

def main():
    print("=" * 60)
    print("SentinelOps Security Decision Engine")
    print("=" * 60)
    
    # Load reports from the reports directory
    sast_report_path = REPORTS_DIR / "sast-report.json"
    bandit_report_path = REPORTS_DIR / "bandit-report.json"
    trivy_report_path = REPORTS_DIR / "trivy-report.json"
    gitleaks_report_path = REPORTS_DIR / "gitleaks-report.json"
    dast_report_path = REPORTS_DIR / "dast-report.json"
    
    sast_report = load_json(sast_report_path)
    bandit_report = load_json(bandit_report_path)
    trivy_report = load_json(trivy_report_path)
    gitleaks_report = load_json(gitleaks_report_path)
    dast_report = load_json(dast_report_path)
    
    if not sast_report and not bandit_report and not trivy_report:
        print("\u26a0 Warning: No security reports found!")
        print(f"  Looking for reports in: {REPORTS_DIR}")
    
    # Show detected languages if SAST report available
    if sast_report:
        langs = list(sast_report.get("languages_detected", {}).keys())
        tools = [t for t, info in sast_report.get("tools_used", {}).items() if info.get("success")]
        print(f"\n\U0001f50d Languages detected: {', '.join(langs) if langs else 'none'}")
        print(f"\U0001f6e0  SAST tools used: {', '.join(tools) if tools else 'none'}")
    
    # Show Gitleaks and DAST status
    if gitleaks_report:
        secrets = gitleaks_report.get("total_secrets", 0)
        print(f"\U0001f511 Gitleaks: {secrets} secret(s) detected")
    if dast_report:
        dast_alerts = dast_report.get("total_alerts", 0)
        print(f"\U0001f310 DAST (ZAP): {dast_alerts} alert(s) found")

    # Calculate security score
    score, reasons, critical_count, high_count, secrets_total, dast_high_count = calculate_score(
        bandit_report, trivy_report, sast_report=sast_report,
        gitleaks_report=gitleaks_report, dast_report=dast_report
    )

    # Load policy from dashboard
    policy = load_policy()
    
    # Extract policy settings
    policy_min_score = policy.get("minScore", 70)
    block_critical = policy.get("blockCritical", True)
    block_high = policy.get("blockHigh", False)
    max_critical_vulns = policy.get("maxCriticalVulns", 0)
    max_high_vulns = policy.get("maxHighVulns", 5)
    auto_block = policy.get("autoBlock", True)
    block_on_secrets = policy.get("blockOnSecrets", True)
    block_on_dast_high = policy.get("blockOnDastHigh", False)

    print(f"\n\U0001f4cb Policy Settings:")
    print(f"   - Minimum Score: {policy_min_score}")
    print(f"   - Block on Critical: {block_critical} (max allowed: {max_critical_vulns})")
    print(f"   - Block on High: {block_high} (max allowed: {max_high_vulns})")
    print(f"   - Block on Secrets: {block_on_secrets}")
    print(f"   - Block on DAST High: {block_on_dast_high}")
    print(f"   - Auto Block: {auto_block}")
    
    print(f"\n\U0001f4ca Scan Results:")
    print(f"   - Security Score: {score}")
    print(f"   - Critical Vulnerabilities: {critical_count}")
    print(f"   - High Vulnerabilities: {high_count}")
    print(f"   - Secrets Detected: {secrets_total}")
    print(f"   - DAST High Alerts: {dast_high_count}")

    deployment_allowed = True
    policy_violations = []

    # Check policy violations only if auto_block is enabled
    if auto_block:
        # Check critical vulnerability policy
        if block_critical and critical_count > max_critical_vulns:
            deployment_allowed = False
            policy_violations.append(
                f"Policy: Critical vulnerabilities ({critical_count}) exceed threshold ({max_critical_vulns})"
            )
        
        # Check high vulnerability policy
        if block_high and high_count > max_high_vulns:
            deployment_allowed = False
            policy_violations.append(
                f"Policy: High vulnerabilities ({high_count}) exceed threshold ({max_high_vulns})"
            )
        
        # Check minimum score policy
        if score < policy_min_score:
            deployment_allowed = False
            policy_violations.append(
                f"Policy: Security score ({score}) below minimum threshold ({policy_min_score})"
            )
        
        # Check secrets policy
        if block_on_secrets and secrets_total > 0:
            deployment_allowed = False
            policy_violations.append(
                f"Policy: {secrets_total} hardcoded secret(s) detected \u2014 deployment blocked"
            )
        
        # Check DAST policy
        if block_on_dast_high and dast_high_count > 0:
            deployment_allowed = False
            policy_violations.append(
                f"Policy: {dast_high_count} high-risk DAST alert(s) detected \u2014 deployment blocked"
            )
    else:
        print("\n\u26a0 Auto-blocking is DISABLED - deployment will proceed regardless of violations")

    # Combine all reasons
    all_reasons = reasons + policy_violations

    decision = {
        "security_score": score,
        "deployment_allowed": deployment_allowed,
        "critical_count": critical_count,
        "high_count": high_count,
        "secrets_count": secrets_total,
        "dast_high_count": dast_high_count,
        "scan_findings": reasons,
        "policy_violations": policy_violations,
        "failure_reasons": all_reasons,
        "policy": {
            "min_score": policy_min_score,
            "block_critical": block_critical,
            "block_high": block_high,
            "max_critical_vulns": max_critical_vulns,
            "max_high_vulns": max_high_vulns,
            "auto_block": auto_block,
            "block_on_secrets": block_on_secrets,
            "block_on_dast_high": block_on_dast_high
        }
    }

    # Save decision to reports directory
    decision_file = REPORTS_DIR / "security_decision.json"
    with open(decision_file, "w") as f:
        json.dump(decision, f, indent=2)
    
    print(f"\n\U0001f4c4 Decision saved to: {decision_file}")
    
    # Print decision
    print("\n" + "=" * 60)
    if deployment_allowed:
        print("\u2705 DECISION: DEPLOYMENT ALLOWED")
    else:
        print("\u274c DECISION: DEPLOYMENT BLOCKED")
        print("\nReasons:")
        for reason in all_reasons:
            print(f"   \u2022 {reason}")
    print("=" * 60)
    
    # Output full decision as JSON
    print("\nFull Decision (JSON):")
    print(json.dumps(decision, indent=2))

    # Fail pipeline if deployment is not allowed
    if not deployment_allowed:
        sys.exit(1)

if __name__ == "__main__":
    main()
