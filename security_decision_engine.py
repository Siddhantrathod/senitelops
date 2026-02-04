import json
from pathlib import Path
import sys
import os

# Get the base directory (where this script is located)
BASE_DIR = Path(__file__).parent.absolute()
REPORTS_DIR = BASE_DIR / "reports"
DASHBOARD_DATA_DIR = BASE_DIR / "dashboard" / "data"
POLICY_FILE = DASHBOARD_DATA_DIR / "policy.json"

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
    score = 100
    reasons = []

    # Bandit: count HIGH severity issues
    if bandit_report:
        high_issues = sum(
            1 for r in bandit_report.get("results", [])
            if r.get("issue_severity") == "HIGH"
        )
        if high_issues > 0:
            score -= 20 + (high_issues * 2)
            reasons.append(f"{high_issues} HIGH issues in SAST")

    # Trivy: count HIGH and CRITICAL vulns
    critical_count = 0
    high_count = 0
    if trivy_report:
        for res in trivy_report.get("Results", []):
            for v in (res.get("Vulnerabilities") or []):
                sev = v.get("Severity")
                if sev == "CRITICAL":
                    critical_count += 1
                elif sev == "HIGH":
                    high_count += 1

    if critical_count > 0:
        score -= 40
        reasons.append(f"{critical_count} CRITICAL vulnerabilities in image")
    if high_count > 0:
        score -= min(20, high_count * 2)
        reasons.append(f"{high_count} HIGH vulnerabilities in image")

    score = max(score, 0)
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
