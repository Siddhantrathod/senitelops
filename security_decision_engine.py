import json
from pathlib import Path
import sys

def load_json(path):
    if not Path(path).exists():
        return None
    with open(path) as f:
        return json.load(f)

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
    bandit_report = load_json("bandit-report.json")
    trivy_report = load_json("trivy-report.json")

    score, reasons, critical_count, high_count = calculate_score(
        bandit_report, trivy_report
    )

    policy_min_score = 70
    block_if_any_critical = True

    deployment_allowed = True

    if block_if_any_critical and critical_count > 0:
        deployment_allowed = False
        reasons.append("Policy: Block if any CRITICAL vulnerabilities present")
    elif score < policy_min_score:
        deployment_allowed = False
        reasons.append(f"Policy: Security score below threshold {policy_min_score}")

    decision = {
        "security_score": score,
        "deployment_allowed": deployment_allowed,
        "failure_reasons": reasons,
        "policy_min_score": policy_min_score,
    }

    with open("security_decision.json", "w") as f:
        json.dump(decision, f, indent=2)

    print(json.dumps(decision, indent=2))

    # Fail pipeline if deployment is not allowed
    if not deployment_allowed:
        sys.exit(1)

if __name__ == "__main__":
    main()
