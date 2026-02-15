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
    "autoBlock": True
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

def calculate_score(bandit_report, trivy_report):
    """Calculate security score with separated weights for code vs image vulns.
    
    Code vulnerabilities (Bandit SAST) get full-weight penalties.
    Image/dependency vulnerabilities (Trivy) get reduced weight (~50%).
    """
    reasons = []

    # Bandit: count code issues by severity
    bandit_high = 0
    bandit_medium = 0
    bandit_low = 0
    if bandit_report:
        for r in bandit_report.get("results", []):
            sev = r.get("issue_severity", "").upper()
            if sev == "HIGH":
                bandit_high += 1
            elif sev == "MEDIUM":
                bandit_medium += 1
            elif sev == "LOW":
                bandit_low += 1
        if bandit_high > 0:
            reasons.append(f"{bandit_high} HIGH issues in code (SAST)")
        if bandit_medium > 0:
            reasons.append(f"{bandit_medium} MEDIUM issues in code (SAST)")

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

    # Code vulns: full weight (max code penalty: 25 + 10 + 5 = 40)
    code_high_impact = min(25, bandit_high * 8)
    code_medium_impact = min(10, bandit_medium * 3)
    code_low_impact = min(5, bandit_low * 1)

    # Image vulns: reduced weight ~50% (max image penalty: 25 + 15 + 8 + 2 = 50)
    image_critical_impact = min(25, trivy_critical * 10)
    image_high_impact = min(15, trivy_high * 3)
    image_medium_impact = min(8, trivy_medium * 1)
    image_low_impact = min(2, int(trivy_low * 0.5))

    total_penalty = (code_high_impact + code_medium_impact + code_low_impact +
                     image_critical_impact + image_high_impact + image_medium_impact + image_low_impact)
    score = max(0, 100 - total_penalty)

    critical_count = trivy_critical
    high_count = bandit_high + trivy_high
    return score, reasons, critical_count, high_count

def main():
    print("=" * 60)
    print("SentinelOps Security Decision Engine")
    print("=" * 60)
    
    # Load reports from the reports directory
    bandit_report_path = REPORTS_DIR / "bandit-report.json"
    trivy_report_path = REPORTS_DIR / "trivy-report.json"
    
    bandit_report = load_json(bandit_report_path)
    trivy_report = load_json(trivy_report_path)
    
    if not bandit_report and not trivy_report:
        print("⚠ Warning: No security reports found!")
        print(f"  Looking for reports in: {REPORTS_DIR}")

    # Calculate security score
    score, reasons, critical_count, high_count = calculate_score(
        bandit_report, trivy_report
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

    print(f"\n📋 Policy Settings:")
    print(f"   - Minimum Score: {policy_min_score}")
    print(f"   - Block on Critical: {block_critical} (max allowed: {max_critical_vulns})")
    print(f"   - Block on High: {block_high} (max allowed: {max_high_vulns})")
    print(f"   - Auto Block: {auto_block}")
    
    print(f"\n📊 Scan Results:")
    print(f"   - Security Score: {score}")
    print(f"   - Critical Vulnerabilities: {critical_count}")
    print(f"   - High Vulnerabilities: {high_count}")

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
    else:
        print("\n⚠ Auto-blocking is DISABLED - deployment will proceed regardless of violations")

    # Combine all reasons
    all_reasons = reasons + policy_violations

    decision = {
        "security_score": score,
        "deployment_allowed": deployment_allowed,
        "critical_count": critical_count,
        "high_count": high_count,
        "scan_findings": reasons,
        "policy_violations": policy_violations,
        "failure_reasons": all_reasons,
        "policy": {
            "min_score": policy_min_score,
            "block_critical": block_critical,
            "block_high": block_high,
            "max_critical_vulns": max_critical_vulns,
            "max_high_vulns": max_high_vulns,
            "auto_block": auto_block
        }
    }

    # Save decision to reports directory
    decision_file = REPORTS_DIR / "security_decision.json"
    with open(decision_file, "w") as f:
        json.dump(decision, f, indent=2)
    
    print(f"\n📄 Decision saved to: {decision_file}")
    
    # Print decision
    print("\n" + "=" * 60)
    if deployment_allowed:
        print("✅ DECISION: DEPLOYMENT ALLOWED")
    else:
        print("❌ DECISION: DEPLOYMENT BLOCKED")
        print("\nReasons:")
        for reason in all_reasons:
            print(f"   • {reason}")
    print("=" * 60)
    
    # Output full decision as JSON
    print("\nFull Decision (JSON):")
    print(json.dumps(decision, indent=2))

    # Fail pipeline if deployment is not allowed
    if not deployment_allowed:
        sys.exit(1)

if __name__ == "__main__":
    main()
