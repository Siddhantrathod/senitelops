#!/usr/bin/env python3
"""
Gitleaks Secret Detection Scanner for SentinelOps
Detects hardcoded secrets, API keys, tokens, and passwords in source code.

Uses Gitleaks (https://github.com/gitleaks/gitleaks) as the underlying engine.
Falls back to regex-based scanning if Gitleaks is not installed.
"""

import json
import os
import re
import subprocess
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple

logger = logging.getLogger("SentinelOps.Gitleaks")

# Directories to skip during scanning
EXCLUDE_DIRS = {
    ".git", "node_modules", "venv", ".venv", "__pycache__", ".tox",
    "dist", "build", ".eggs", "vendor", ".cache", ".mypy_cache",
    "target", "bin", "obj", ".gradle", ".idea", ".vscode",
}

# ═══════════════════════════════════════════════════════════════════
# SEVERITY MAPPING
# ═══════════════════════════════════════════════════════════════════

# Gitleaks doesn't have built-in severity.  We map rule IDs to severity
# based on the sensitivity of credentials discovered.
CRITICAL_RULES = {
    "aws-access-key-id", "aws-secret-access-key",
    "gcp-service-account", "gcp-api-key",
    "azure-storage-key", "azure-client-secret",
    "private-key", "rsa-private-key",
    "github-pat", "github-oauth",
    "gitlab-pat",
    "stripe-access-token", "stripe-api-key",
    "twilio-api-key",
    "sendgrid-api-token",
    "heroku-api-key",
    "slack-bot-token", "slack-webhook-url",
    "shopify-access-token",
    "paypal-braintree-access-token",
    "square-access-token", "square-oauth-secret",
    "databricks-api-token",
    "jwt", "json-web-token",
}

HIGH_RULES = {
    "generic-api-key",
    "npm-access-token",
    "pypi-upload-token",
    "nuget-api-key",
    "mailgun-private-api-token",
    "mailchimp-api-key",
    "telegram-bot-api-token",
    "discord-api-token", "discord-client-secret",
    "linkedin-client-secret",
    "twitter-api-key", "twitter-api-secret",
    "facebook-token",
    "hashicorp-tf-api-token",
    "vault-batch-token", "vault-service-token",
    "doppler-api-token",
    "algolia-api-key",
    "firebase-cloud-messaging",
}

# Everything else defaults to MEDIUM


def _classify_severity(rule_id: str) -> str:
    """Map a Gitleaks rule ID to CRITICAL / HIGH / MEDIUM severity."""
    rule_lower = (rule_id or "").lower().replace(" ", "-")
    if any(r in rule_lower for r in CRITICAL_RULES):
        return "CRITICAL"
    if any(r in rule_lower for r in HIGH_RULES):
        return "HIGH"
    # Private keys and tokens always critical
    if "private" in rule_lower and "key" in rule_lower:
        return "CRITICAL"
    if "secret" in rule_lower:
        return "HIGH"
    return "MEDIUM"


def _redact_secret(secret: str, show_chars: int = 4) -> str:
    """Redact a secret, showing only the first few characters."""
    if not secret or len(secret) <= show_chars:
        return "***REDACTED***"
    return secret[:show_chars] + "***REDACTED***"


# ═══════════════════════════════════════════════════════════════════
# GITLEAKS RUNNER
# ═══════════════════════════════════════════════════════════════════

def is_gitleaks_available() -> bool:
    """Check if gitleaks is installed on the system."""
    return shutil.which("gitleaks") is not None


def run_gitleaks(
    repo_path: str,
    output_path: str,
) -> Tuple[bool, str, List[dict]]:
    """
    Run Gitleaks secret detection on a repository.

    Args:
        repo_path:   Path to the repository to scan
        output_path: Path to save the JSON report

    Returns:
        Tuple of (success, message, normalised_findings)
    """
    logger.info(f"Running Gitleaks secret detection on: {repo_path}")

    try:
        cmd = [
            "gitleaks", "detect",
            "--source", repo_path,
            "--report-format", "json",
            "--report-path", output_path,
            "--no-git",       # scan files, not git history
            "--verbose",
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
        )

        # Exit codes: 0 = clean, 1 = leaks found, other = error
        if result.returncode not in (0, 1):
            stderr = result.stderr.strip()
            return False, f"Gitleaks error: {stderr[:500]}", []

        # Parse findings
        findings = []
        if os.path.exists(output_path):
            with open(output_path) as f:
                raw = json.load(f)
                if isinstance(raw, list):
                    findings = raw
                elif isinstance(raw, dict):
                    findings = raw.get("results", raw.get("findings", []))

        # Normalise
        normalised = []
        for f_item in findings:
            rule_id = f_item.get("RuleID", f_item.get("ruleID", "unknown"))
            secret_val = f_item.get("Secret", f_item.get("secret", ""))

            normalised.append({
                "rule_id": rule_id,
                "description": f_item.get("Description", f_item.get("description", rule_id)),
                "file": f_item.get("File", f_item.get("file", "")),
                "line": f_item.get("StartLine", f_item.get("startLine", 0)),
                "end_line": f_item.get("EndLine", f_item.get("endLine", 0)),
                "secret": _redact_secret(secret_val),
                "match": f_item.get("Match", f_item.get("match", "")),
                "severity": _classify_severity(rule_id),
                "entropy": f_item.get("Entropy", f_item.get("entropy", 0)),
                "commit": f_item.get("Commit", f_item.get("commit", "")),
                "author": f_item.get("Author", f_item.get("author", "")),
                "tags": f_item.get("Tags", f_item.get("tags", [])),
            })

        msg = f"Gitleaks found {len(normalised)} secret(s)" if normalised else "No secrets detected"
        logger.info(msg)
        return True, msg, normalised

    except FileNotFoundError:
        return False, "Gitleaks is not installed (install from https://github.com/gitleaks/gitleaks)", []
    except subprocess.TimeoutExpired:
        return False, "Gitleaks scan timed out (>300s)", []
    except json.JSONDecodeError:
        # Gitleaks might produce empty file when no leaks found
        return True, "No secrets detected", []
    except Exception as e:
        return False, f"Gitleaks error: {e}", []


# ═══════════════════════════════════════════════════════════════════
# FALLBACK REGEX SCANNER
# ═══════════════════════════════════════════════════════════════════

# Simple regex patterns for common secrets (used when Gitleaks is not installed)
_FALLBACK_PATTERNS = [
    ("aws-access-key-id",      r'(?:AKIA)[A-Z0-9]{16}'),
    ("aws-secret-access-key",  r'(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*["\']?([A-Za-z0-9/+=]{40})["\']?'),
    ("generic-api-key",        r'(?:api[_-]?key|apikey|API_KEY)\s*[=:]\s*["\']?([A-Za-z0-9_\-]{20,64})["\']?'),
    ("generic-secret",         r'(?:secret|SECRET|password|PASSWORD|passwd|PASSWD)\s*[=:]\s*["\']([^"\']{8,128})["\']'),
    ("github-pat",             r'ghp_[A-Za-z0-9_]{36}'),
    ("github-oauth",           r'gho_[A-Za-z0-9_]{36}'),
    ("jwt",                    r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'),
    ("private-key",            r'-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----'),
    ("slack-bot-token",        r'xoxb-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]{24}'),
    ("slack-webhook-url",      r'https://hooks\.slack\.com/services/T[A-Z0-9]{8}/B[A-Z0-9]{8}/[A-Za-z0-9]{24}'),
    ("stripe-api-key",         r'(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}'),
    ("heroku-api-key",         r'[hH][eE][rR][oO][kK][uU].*[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}'),
]

# File extensions to scan with fallback
_SCAN_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rb", ".php",
    ".env", ".cfg", ".ini", ".conf", ".yaml", ".yml", ".toml", ".json",
    ".xml", ".properties", ".sh", ".bash", ".zsh", ".tf", ".tfvars",
    ".c", ".cpp", ".h", ".cs", ".rs", ".swift", ".kt",
}

# Files to always skip
_SKIP_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "Cargo.lock", "go.sum", "Gemfile.lock", "poetry.lock",
}


def _run_fallback_scan(repo_path: str) -> List[dict]:
    """Simple regex-based secret scanner — fallback when Gitleaks is not installed."""
    logger.info("Running fallback regex-based secret scanner")
    findings = []
    repo = Path(repo_path)

    for root, dirs, files in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fname in files:
            if fname in _SKIP_FILES:
                continue
            ext = Path(fname).suffix.lower()
            # Also scan dotfiles like .env
            if ext not in _SCAN_EXTENSIONS and not fname.startswith(".env"):
                continue

            fpath = os.path.join(root, fname)
            rel_path = os.path.relpath(fpath, repo_path)

            try:
                with open(fpath, 'r', errors='ignore') as f:
                    for line_num, line in enumerate(f, 1):
                        for rule_id, pattern in _FALLBACK_PATTERNS:
                            match = re.search(pattern, line)
                            if match:
                                secret_val = match.group(0)
                                findings.append({
                                    "rule_id": rule_id,
                                    "description": rule_id.replace("-", " ").title(),
                                    "file": rel_path,
                                    "line": line_num,
                                    "end_line": line_num,
                                    "secret": _redact_secret(secret_val),
                                    "match": _redact_secret(secret_val, 8),
                                    "severity": _classify_severity(rule_id),
                                    "entropy": 0,
                                    "commit": "",
                                    "author": "",
                                    "tags": ["fallback-scanner"],
                                })
                                break  # one match per line
            except (IOError, UnicodeDecodeError):
                continue

    return findings


# ═══════════════════════════════════════════════════════════════════
# REPORT BUILDER
# ═══════════════════════════════════════════════════════════════════

def _compute_metrics(findings: List[dict]) -> Dict[str, int]:
    """Compute severity counts from normalised findings."""
    metrics = {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": len(findings)}
    for f in findings:
        sev = f.get("severity", "MEDIUM").lower()
        if sev in metrics:
            metrics[sev] += 1
    return metrics


def _build_report(
    repo_path: str,
    findings: List[dict],
    tool_used: str,
    tool_available: bool,
    scan_message: str,
) -> Dict[str, Any]:
    """Build the unified secrets report."""
    metrics = _compute_metrics(findings)

    return {
        "schema_version": 1,
        "scan_type": "secrets",
        "timestamp": datetime.now().isoformat(),
        "repository": repo_path,
        "tool": tool_used,
        "tool_available": tool_available,
        "message": scan_message,
        "total_secrets": len(findings),
        "results": findings,
        "metrics": metrics,
    }


# ═══════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════

def run_secrets_scan(
    repo_path: str,
    reports_dir: str,
) -> Dict[str, Any]:
    """
    Run secret detection on a repository.

    Uses Gitleaks if available, falls back to regex-based scanning.

    Args:
        repo_path:   Path to the cloned repository
        reports_dir: Directory to save report files

    Returns:
        Unified secrets report dictionary
    """
    os.makedirs(reports_dir, exist_ok=True)
    output_path = os.path.join(reports_dir, "gitleaks-report.json")

    if is_gitleaks_available():
        success, message, findings = run_gitleaks(repo_path, output_path)
        tool_used = "gitleaks"
        tool_available = True

        if not success:
            logger.warning(f"Gitleaks failed: {message}, falling back to regex scanner")
            findings = _run_fallback_scan(repo_path)
            tool_used = "regex-fallback"
            message = f"Gitleaks failed ({message}), used regex fallback: {len(findings)} finding(s)"
    else:
        logger.info("Gitleaks not installed — using regex fallback scanner")
        findings = _run_fallback_scan(repo_path)
        tool_used = "regex-fallback"
        tool_available = False
        message = f"Regex fallback scan found {len(findings)} potential secret(s)"

    report = _build_report(repo_path, findings, tool_used, tool_available, message)

    # Save report
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)
    logger.info(f"Secrets report saved to {output_path}")

    return report
