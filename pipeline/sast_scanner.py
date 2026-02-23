#!/usr/bin/env python3
"""
Multi-Language SAST Scanner for SentinelOps
Supports multiple programming languages through various SAST tools:
  - Python    → Bandit
  - JavaScript/TypeScript → Semgrep, njsscan (npm audit)
  - Java/Kotlin → Semgrep
  - Go        → Semgrep, Gosec
  - Ruby      → Semgrep
  - PHP       → Semgrep
  - C/C++     → Semgrep, Flawfinder
  - C#        → Semgrep
  - Rust      → Semgrep
  - Swift     → Semgrep
  - Shell/Bash→ Semgrep, ShellCheck

Semgrep is the universal multi-language engine; language-specific tools
are used in addition when available for deeper analysis.
"""

import json
import os
import subprocess
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from collections import defaultdict

logger = logging.getLogger("SentinelOps.SAST")

# ═══════════════════════════════════════════════════════════════════
# LANGUAGE DETECTION
# ═══════════════════════════════════════════════════════════════════

LANGUAGE_EXTENSIONS: Dict[str, List[str]] = {
    "python":     [".py", ".pyw"],
    "javascript": [".js", ".jsx", ".mjs", ".cjs"],
    "typescript": [".ts", ".tsx"],
    "java":       [".java"],
    "kotlin":     [".kt", ".kts"],
    "go":         [".go"],
    "ruby":       [".rb", ".erb"],
    "php":        [".php", ".phtml"],
    "c":          [".c", ".h"],
    "cpp":        [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx"],
    "csharp":     [".cs"],
    "rust":       [".rs"],
    "scala":      [".scala"],
    "swift":      [".swift"],
    "shell":      [".sh", ".bash", ".zsh"],
}

# Directories to skip during language detection and scanning
EXCLUDE_DIRS = {
    ".git", "node_modules", "venv", ".venv", "__pycache__", ".tox",
    "dist", "build", ".eggs", "vendor", ".cache", ".mypy_cache",
    "target", "bin", "obj", ".gradle", ".idea", ".vscode",
}

# Pretty display names and icons for each language
LANGUAGE_INFO = {
    "python":     {"display": "Python",       "icon": "🐍", "color": "#3572A5"},
    "javascript": {"display": "JavaScript",   "icon": "📜", "color": "#f1e05a"},
    "typescript": {"display": "TypeScript",   "icon": "📘", "color": "#3178c6"},
    "java":       {"display": "Java",         "icon": "☕", "color": "#b07219"},
    "kotlin":     {"display": "Kotlin",       "icon": "🟣", "color": "#A97BFF"},
    "go":         {"display": "Go",           "icon": "🔵", "color": "#00ADD8"},
    "ruby":       {"display": "Ruby",         "icon": "💎", "color": "#701516"},
    "php":        {"display": "PHP",          "icon": "🐘", "color": "#4F5D95"},
    "c":          {"display": "C",            "icon": "⚙️",  "color": "#555555"},
    "cpp":        {"display": "C++",          "icon": "⚙️",  "color": "#f34b7d"},
    "csharp":     {"display": "C#",           "icon": "🟢", "color": "#178600"},
    "rust":       {"display": "Rust",         "icon": "🦀", "color": "#dea584"},
    "scala":      {"display": "Scala",        "icon": "🔴", "color": "#c22d40"},
    "swift":      {"display": "Swift",        "icon": "🍎", "color": "#F05138"},
    "shell":      {"display": "Shell/Bash",   "icon": "🐚", "color": "#89e051"},
}


def detect_languages(repo_path: str) -> Dict[str, Dict[str, Any]]:
    """
    Detect programming languages in a repository by scanning file extensions.

    Returns:
        Dict mapping language name → { files: [paths], count: int, info: {...} }
    """
    languages: Dict[str, List[str]] = defaultdict(list)
    repo = Path(repo_path)

    for root, dirs, files in os.walk(repo):
        # Skip excluded directories (in-place modification)
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for fname in files:
            ext = Path(fname).suffix.lower()
            for lang, exts in LANGUAGE_EXTENSIONS.items():
                if ext in exts:
                    rel_path = os.path.relpath(os.path.join(root, fname), repo_path)
                    languages[lang].append(rel_path)
                    break  # a file belongs to one language

    result = {}
    for lang, file_list in languages.items():
        result[lang] = {
            "files": file_list,
            "count": len(file_list),
            "info": LANGUAGE_INFO.get(lang, {
                "display": lang.capitalize(),
                "icon": "📄",
                "color": "#888888",
            }),
        }

    return result


# ═══════════════════════════════════════════════════════════════════
# TOOL REGISTRY
# ═══════════════════════════════════════════════════════════════════

def _is_tool_available(cmd: str) -> bool:
    """Check if a command-line tool is available on $PATH."""
    return shutil.which(cmd) is not None


# Map of tool name → { languages, check_cmd, runner_func }
# Language-specific tools run IN ADDITION to Semgrep when available.
TOOL_REGISTRY: Dict[str, Dict[str, Any]] = {}  # populated at module load below


# ═══════════════════════════════════════════════════════════════════
# INDIVIDUAL TOOL RUNNERS
# Each returns (success: bool, message: str, issues: List[dict])
# where every issue is normalised to the unified schema.
# ═══════════════════════════════════════════════════════════════════

def _normalise_severity(raw: str) -> str:
    """Map various severity strings to CRITICAL / HIGH / MEDIUM / LOW."""
    raw = (raw or "").upper().strip()
    mapping = {
        "ERROR": "HIGH",
        "WARNING": "MEDIUM",
        "INFO": "LOW",
        "NOTE": "LOW",
        "UNDEFINED": "LOW",
    }
    if raw in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        return raw
    return mapping.get(raw, "LOW")


# ── Bandit (Python) ──────────────────────────────────────────────

def run_bandit(repo_path: str, output_path: str) -> Tuple[bool, str, List[dict]]:
    """Run Bandit on Python files and return normalised issues."""
    logger.info("Running Bandit (Python SAST)…")
    try:
        result = subprocess.run(
            [
                "bandit", "-r", repo_path,
                "-f", "json", "-o", output_path,
                "--exclude", ",".join(EXCLUDE_DIRS),
            ],
            capture_output=True, text=True, timeout=300,
        )
        # 0 = clean, 1 = issues found (both OK)
        if result.returncode not in (0, 1):
            return False, f"Bandit error: {result.stderr.strip()}", []

        raw = {}
        if os.path.exists(output_path):
            with open(output_path) as f:
                raw = json.load(f)

        issues = []
        for r in raw.get("results", []):
            issues.append({
                "tool": "bandit",
                "language": "python",
                "rule_id": r.get("test_id", ""),
                "rule_name": r.get("test_name", ""),
                "severity": _normalise_severity(r.get("issue_severity", "")),
                "confidence": _normalise_severity(r.get("issue_confidence", "")),
                "message": r.get("issue_text", ""),
                "file": r.get("filename", ""),
                "line": r.get("line_number", 0),
                "col": r.get("col_offset", 0),
                "code": r.get("code", ""),
                "cwe": r.get("issue_cwe", {}),
                "more_info": r.get("more_info", ""),
            })

        return True, f"Bandit found {len(issues)} issues", issues

    except FileNotFoundError:
        return False, "Bandit is not installed (pip install bandit)", []
    except subprocess.TimeoutExpired:
        return False, "Bandit scan timed out (>300 s)", []
    except Exception as e:
        return False, f"Bandit error: {e}", []


# ── Semgrep (multi-language) ────────────────────────────────────

# Map internal language keys to Semgrep language identifiers
_SEMGREP_LANG_MAP = {
    "python": "python",
    "javascript": "javascript",
    "typescript": "typescript",
    "java": "java",
    "kotlin": "kotlin",
    "go": "go",
    "ruby": "ruby",
    "php": "php",
    "c": "c",
    "cpp": "cpp",
    "csharp": "csharp",
    "rust": "rust",
    "scala": "scala",
    "swift": "swift",
    "shell": "bash",
}


def run_semgrep(
    repo_path: str,
    output_path: str,
    languages: List[str] | None = None,
) -> Tuple[bool, str, List[dict]]:
    """
    Run Semgrep with the p/default + p/security-audit rulesets.
    If *languages* is given, only scan those; otherwise auto-detect.
    """
    logger.info("Running Semgrep (multi-language SAST)…")
    try:
        cmd = [
            "semgrep", "scan",
            "--config", "auto",
            "--json",
            "--output", output_path,
            "--no-git",
            "--metrics", "off",
        ]

        # Exclude common non-code directories
        for d in EXCLUDE_DIRS:
            cmd.extend(["--exclude", d])

        cmd.append(repo_path)

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

        # Semgrep returns 1 when findings exist but scan succeeded
        if result.returncode not in (0, 1):
            stderr = result.stderr.strip()
            # If semgrep is installed but errors out, return the error
            if stderr:
                return False, f"Semgrep error: {stderr[:500]}", []
            return False, "Semgrep scan failed with unknown error", []

        raw = {}
        if os.path.exists(output_path):
            with open(output_path) as f:
                raw = json.load(f)

        issues = []
        for r in raw.get("results", []):
            extra = r.get("extra", {})
            metadata = extra.get("metadata", {})

            # Determine language from semgrep result
            lang = (extra.get("metadata", {}).get("technology", [""])[0]
                    if "technology" in extra.get("metadata", {})
                    else "").lower()
            # Fallback: try to figure out from file extension
            if not lang:
                fpath = r.get("path", "")
                ext = Path(fpath).suffix.lower()
                for lname, exts in LANGUAGE_EXTENSIONS.items():
                    if ext in exts:
                        lang = lname
                        break
            if not lang:
                lang = "unknown"

            issues.append({
                "tool": "semgrep",
                "language": lang,
                "rule_id": r.get("check_id", ""),
                "rule_name": r.get("check_id", "").split(".")[-1],
                "severity": _normalise_severity(extra.get("severity", "WARNING")),
                "confidence": _normalise_severity(metadata.get("confidence", "MEDIUM")),
                "message": extra.get("message", ""),
                "file": r.get("path", ""),
                "line": r.get("start", {}).get("line", 0),
                "col": r.get("start", {}).get("col", 0),
                "end_line": r.get("end", {}).get("line", 0),
                "end_col": r.get("end", {}).get("col", 0),
                "code": extra.get("lines", ""),
                "cwe": _extract_semgrep_cwe(metadata),
                "more_info": metadata.get("references", [""])[0] if metadata.get("references") else "",
                "owasp": metadata.get("owasp", []),
            })

        return True, f"Semgrep found {len(issues)} issues", issues

    except FileNotFoundError:
        return False, "Semgrep is not installed (pip install semgrep)", []
    except subprocess.TimeoutExpired:
        return False, "Semgrep scan timed out (>600 s)", []
    except Exception as e:
        return False, f"Semgrep error: {e}", []


def _extract_semgrep_cwe(metadata: dict) -> dict:
    """Extract CWE info from Semgrep metadata into { id, link } format."""
    cwe_list = metadata.get("cwe", [])
    if cwe_list and isinstance(cwe_list, list):
        raw = cwe_list[0] if cwe_list else ""
        # E.g. "CWE-89: SQL Injection"
        if isinstance(raw, str) and "CWE-" in raw:
            cwe_id = raw.split(":")[0].replace("CWE-", "").strip()
            return {
                "id": cwe_id,
                "link": f"https://cwe.mitre.org/data/definitions/{cwe_id}.html",
            }
    return {}


# ── Gosec (Go) ──────────────────────────────────────────────────

def run_gosec(repo_path: str, output_path: str) -> Tuple[bool, str, List[dict]]:
    """Run Gosec security scanner for Go code."""
    logger.info("Running Gosec (Go security scanner)…")
    try:
        result = subprocess.run(
            ["gosec", "-fmt=json", f"-out={output_path}", "./..."],
            capture_output=True, text=True, timeout=300,
            cwd=repo_path,
        )
        if result.returncode not in (0, 1):
            return False, f"Gosec error: {result.stderr.strip()}", []

        raw = {}
        if os.path.exists(output_path):
            with open(output_path) as f:
                raw = json.load(f)

        issues = []
        for r in raw.get("Issues", []):
            issues.append({
                "tool": "gosec",
                "language": "go",
                "rule_id": r.get("rule_id", ""),
                "rule_name": r.get("details", "").split(".")[0] if r.get("details") else "",
                "severity": _normalise_severity(r.get("severity", "")),
                "confidence": _normalise_severity(r.get("confidence", "")),
                "message": r.get("details", ""),
                "file": r.get("file", ""),
                "line": int(r.get("line", 0)),
                "col": int(r.get("column", 0)),
                "code": r.get("code", ""),
                "cwe": {"id": r.get("cwe", {}).get("id", ""), "link": r.get("cwe", {}).get("url", "")} if r.get("cwe") else {},
                "more_info": "",
            })

        return True, f"Gosec found {len(issues)} issues", issues

    except FileNotFoundError:
        return False, "Gosec is not installed", []
    except subprocess.TimeoutExpired:
        return False, "Gosec scan timed out (>300 s)", []
    except Exception as e:
        return False, f"Gosec error: {e}", []


# ── Flawfinder (C/C++) ──────────────────────────────────────────

def run_flawfinder(repo_path: str, output_path: str) -> Tuple[bool, str, List[dict]]:
    """Run Flawfinder on C/C++ source files."""
    logger.info("Running Flawfinder (C/C++ SAST)…")
    try:
        result = subprocess.run(
            ["flawfinder", "--json", repo_path],
            capture_output=True, text=True, timeout=300,
        )

        raw_output = result.stdout
        if not raw_output.strip():
            return True, "Flawfinder: no issues found", []

        raw = json.loads(raw_output)
        # Save report
        with open(output_path, "w") as f:
            json.dump(raw, f, indent=2)

        issues = []
        for r in raw if isinstance(raw, list) else raw.get("results", []):
            issues.append({
                "tool": "flawfinder",
                "language": "c" if r.get("filename", "").endswith((".c", ".h")) else "cpp",
                "rule_id": r.get("name", ""),
                "rule_name": r.get("name", ""),
                "severity": _map_flawfinder_level(r.get("level", 0)),
                "confidence": "MEDIUM",
                "message": r.get("warning", r.get("description", "")),
                "file": r.get("filename", r.get("file", "")),
                "line": int(r.get("line", r.get("lineno", 0))),
                "col": int(r.get("column", r.get("col", 0))),
                "code": r.get("context", ""),
                "cwe": {},
                "more_info": "",
            })

        return True, f"Flawfinder found {len(issues)} issues", issues

    except FileNotFoundError:
        return False, "Flawfinder is not installed (pip install flawfinder)", []
    except subprocess.TimeoutExpired:
        return False, "Flawfinder scan timed out (>300 s)", []
    except Exception as e:
        return False, f"Flawfinder error: {e}", []


def _map_flawfinder_level(level: int) -> str:
    """Map Flawfinder's 0-5 risk level to severity string."""
    if level >= 4:
        return "HIGH"
    if level >= 2:
        return "MEDIUM"
    return "LOW"


# ── ShellCheck (Shell/Bash) ─────────────────────────────────────

def run_shellcheck(repo_path: str, output_path: str) -> Tuple[bool, str, List[dict]]:
    """Run ShellCheck on shell scripts."""
    logger.info("Running ShellCheck (shell script linter)…")
    try:
        # Collect shell files
        shell_files = []
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            for f in files:
                if f.endswith((".sh", ".bash", ".zsh")):
                    shell_files.append(os.path.join(root, f))

        if not shell_files:
            return True, "No shell files found", []

        result = subprocess.run(
            ["shellcheck", "--format=json", "--severity=info"] + shell_files,
            capture_output=True, text=True, timeout=120,
        )

        raw_output = result.stdout
        if not raw_output.strip():
            return True, "ShellCheck: no issues found", []

        findings = json.loads(raw_output)
        with open(output_path, "w") as f:
            json.dump(findings, f, indent=2)

        issues = []
        for r in findings:
            issues.append({
                "tool": "shellcheck",
                "language": "shell",
                "rule_id": f"SC{r.get('code', '')}",
                "rule_name": f"SC{r.get('code', '')}",
                "severity": _normalise_severity(r.get("level", "warning")),
                "confidence": "HIGH",
                "message": r.get("message", ""),
                "file": r.get("file", ""),
                "line": r.get("line", 0),
                "col": r.get("column", 0),
                "end_line": r.get("endLine", 0),
                "end_col": r.get("endColumn", 0),
                "code": "",
                "cwe": {},
                "more_info": f"https://www.shellcheck.net/wiki/SC{r.get('code', '')}",
            })

        return True, f"ShellCheck found {len(issues)} issues", issues

    except FileNotFoundError:
        return False, "ShellCheck is not installed", []
    except subprocess.TimeoutExpired:
        return False, "ShellCheck scan timed out", []
    except Exception as e:
        return False, f"ShellCheck error: {e}", []


# ═══════════════════════════════════════════════════════════════════
# TOOL SELECTION LOGIC
# ═══════════════════════════════════════════════════════════════════

# Priority order within each language: language-specific tool first, then Semgrep
TOOL_LANGUAGE_MAP: Dict[str, List[str]] = {
    "python":     ["bandit", "semgrep"],
    "javascript": ["semgrep"],
    "typescript": ["semgrep"],
    "java":       ["semgrep"],
    "kotlin":     ["semgrep"],
    "go":         ["gosec", "semgrep"],
    "ruby":       ["semgrep"],
    "php":        ["semgrep"],
    "c":          ["flawfinder", "semgrep"],
    "cpp":        ["flawfinder", "semgrep"],
    "csharp":     ["semgrep"],
    "rust":       ["semgrep"],
    "scala":      ["semgrep"],
    "swift":      ["semgrep"],
    "shell":      ["shellcheck", "semgrep"],
}

# Runner functions indexed by tool name
TOOL_RUNNERS = {
    "bandit":      run_bandit,
    "semgrep":     run_semgrep,
    "gosec":       run_gosec,
    "flawfinder":  run_flawfinder,
    "shellcheck":  run_shellcheck,
}

# Display names for tools
TOOL_DISPLAY = {
    "bandit":      {"name": "Bandit",      "description": "Python SAST (PyCQA)"},
    "semgrep":     {"name": "Semgrep",     "description": "Multi-language SAST engine"},
    "gosec":       {"name": "Gosec",       "description": "Go security checker"},
    "flawfinder":  {"name": "Flawfinder",  "description": "C/C++ security scanner"},
    "shellcheck":  {"name": "ShellCheck",  "description": "Shell script analysis"},
}


def select_tools(detected_languages: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Given detected languages, determine which tools to run.

    Returns:
        Dict mapping tool_name → list of languages it should scan
    """
    tool_plan: Dict[str, List[str]] = defaultdict(list)
    semgrep_languages: List[str] = []

    for lang in detected_languages:
        preferred_tools = TOOL_LANGUAGE_MAP.get(lang, ["semgrep"])

        # Use the first available language-specific tool
        specific_found = False
        for tool_name in preferred_tools:
            if tool_name == "semgrep":
                continue
            if _is_tool_available(tool_name):
                tool_plan[tool_name].append(lang)
                specific_found = True
                break

        # Always collect for Semgrep as secondary / fallback
        if not specific_found or lang != "python":
            # For Python we prefer Bandit; for others we always add Semgrep
            semgrep_languages.append(lang)

    # If Semgrep is available and there are languages to scan, add it
    if semgrep_languages and _is_tool_available("semgrep"):
        tool_plan["semgrep"] = list(set(semgrep_languages))
    elif semgrep_languages and not _is_tool_available("semgrep"):
        # If neither language-specific tool nor Semgrep is available
        logger.warning("Semgrep not available – some languages have no SAST coverage")

    return dict(tool_plan)


# ═══════════════════════════════════════════════════════════════════
# MAIN SCAN ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════

def run_sast_scan(
    repo_path: str,
    reports_dir: str,
    languages: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Run all applicable SAST tools on a repository.

    Args:
        repo_path:   Path to the cloned repository
        reports_dir: Directory to save report files
        languages:   Pre-detected languages (or None to auto-detect)

    Returns:
        Unified SAST report dictionary
    """
    os.makedirs(reports_dir, exist_ok=True)

    # Step 1: Detect languages
    if languages is None:
        languages = detect_languages(repo_path)

    if not languages:
        logger.warning("No supported programming languages detected")
        return _build_empty_report(repo_path)

    logger.info(f"Detected languages: {', '.join(languages.keys())}")

    # Step 2: Select tools
    tool_plan = select_tools(languages)
    logger.info(f"Tools selected: {list(tool_plan.keys())}")

    # Step 3: Check available tools
    available_tools = {name: _is_tool_available(name) for name in TOOL_RUNNERS}
    logger.info(f"Tool availability: {available_tools}")

    # Step 4: Run each tool and collect issues
    all_issues: List[dict] = []
    tool_results: Dict[str, Dict[str, Any]] = {}
    bandit_raw_path = os.path.join(reports_dir, "bandit-report.json")

    for tool_name, tool_languages in tool_plan.items():
        runner = TOOL_RUNNERS.get(tool_name)
        if not runner:
            continue

        output_path = os.path.join(reports_dir, f"{tool_name}-report.json")
        # For bandit, keep backward-compatible filename
        if tool_name == "bandit":
            output_path = bandit_raw_path

        try:
            success, message, issues = runner(repo_path, output_path)
            tool_results[tool_name] = {
                "success": success,
                "message": message,
                "issues_count": len(issues),
                "languages": tool_languages,
                "available": True,
                "report_path": output_path,
                "display": TOOL_DISPLAY.get(tool_name, {"name": tool_name, "description": ""}),
            }
            if success:
                all_issues.extend(issues)
                logger.info(f"  ✓ {tool_name}: {message}")
            else:
                logger.warning(f"  ✗ {tool_name}: {message}")
        except Exception as e:
            logger.error(f"  ✗ {tool_name} failed unexpectedly: {e}")
            tool_results[tool_name] = {
                "success": False,
                "message": str(e),
                "issues_count": 0,
                "languages": tool_languages,
                "available": True,
                "display": TOOL_DISPLAY.get(tool_name, {"name": tool_name, "description": ""}),
            }

    # Mark tools that weren't run due to no applicable language
    for tool_name in TOOL_RUNNERS:
        if tool_name not in tool_results:
            tool_results[tool_name] = {
                "success": None,
                "message": "Not applicable for detected languages" if _is_tool_available(tool_name) else "Not installed",
                "issues_count": 0,
                "languages": [],
                "available": _is_tool_available(tool_name),
                "display": TOOL_DISPLAY.get(tool_name, {"name": tool_name, "description": ""}),
            }

    # Step 5: De-duplicate (same file + same line + same severity → keep first)
    all_issues = _deduplicate_issues(all_issues)

    # Step 6: Build unified report
    report = _build_report(repo_path, languages, tool_results, all_issues)

    # Step 7: Save unified report
    unified_path = os.path.join(reports_dir, "sast-report.json")
    with open(unified_path, "w") as f:
        json.dump(report, f, indent=2)
    logger.info(f"Unified SAST report saved to {unified_path}")

    # Step 8: Generate backward-compatible bandit-report.json if not already
    _ensure_bandit_compat(reports_dir, all_issues)

    return report


def _deduplicate_issues(issues: List[dict]) -> List[dict]:
    """Remove duplicate findings across tools (same file + line + rule)."""
    seen = set()
    unique = []
    for issue in issues:
        key = (
            issue.get("file", ""),
            issue.get("line", 0),
            issue.get("severity", ""),
            issue.get("message", "")[:80],
        )
        if key not in seen:
            seen.add(key)
            unique.append(issue)
    return unique


def _build_empty_report(repo_path: str) -> Dict[str, Any]:
    """Return an empty unified report structure."""
    return {
        "schema_version": 1,
        "scan_type": "sast",
        "timestamp": datetime.now().isoformat(),
        "repository": repo_path,
        "languages_detected": {},
        "tools_used": {},
        "results": [],
        "metrics": _compute_metrics([], {}),
    }


def _build_report(
    repo_path: str,
    languages: Dict[str, Any],
    tool_results: Dict[str, Any],
    issues: List[dict],
) -> Dict[str, Any]:
    """Build the full unified SAST report."""
    # Strip file lists from language info to keep report smaller
    lang_summary = {}
    for lang, info in languages.items():
        lang_summary[lang] = {
            "count": info["count"],
            "info": info["info"],
        }

    return {
        "schema_version": 1,
        "scan_type": "sast",
        "timestamp": datetime.now().isoformat(),
        "repository": repo_path,
        "languages_detected": lang_summary,
        "tools_used": tool_results,
        "results": issues,
        "metrics": _compute_metrics(issues, lang_summary),
    }


def _compute_metrics(
    issues: List[dict], languages: Dict[str, Any]
) -> Dict[str, Any]:
    """Compute severity metrics grouped by language and by tool."""
    by_language: Dict[str, Dict[str, int]] = {}
    by_tool: Dict[str, Dict[str, int]] = {}
    totals = {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}

    for issue in issues:
        lang = issue.get("language", "unknown")
        tool = issue.get("tool", "unknown")
        sev = issue.get("severity", "LOW").lower()

        # By language
        if lang not in by_language:
            by_language[lang] = {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
        by_language[lang]["total"] += 1
        by_language[lang][sev] = by_language[lang].get(sev, 0) + 1

        # By tool
        if tool not in by_tool:
            by_tool[tool] = {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}
        by_tool[tool]["total"] += 1
        by_tool[tool][sev] = by_tool[tool].get(sev, 0) + 1

        # Totals
        totals["total"] += 1
        totals[sev] = totals.get(sev, 0) + 1

    return {
        "by_language": by_language,
        "by_tool": by_tool,
        "totals": totals,
        "languages_scanned": list(languages.keys()),
        "languages_with_issues": [l for l, m in by_language.items() if m["total"] > 0],
    }


def _ensure_bandit_compat(reports_dir: str, issues: List[dict]) -> None:
    """
    Generate a backward-compatible bandit-report.json from the unified issues.
    Only if bandit wasn't actually run (so the file doesn't already exist from bandit).
    """
    bandit_path = os.path.join(reports_dir, "bandit-report.json")
    if os.path.exists(bandit_path):
        return  # Already generated by actual bandit run

    # Build a minimal bandit-format report from all SAST issues
    all_results = []
    for issue in issues:
        all_results.append({
            "test_id": issue.get("rule_id", ""),
            "test_name": issue.get("rule_name", ""),
            "issue_severity": issue.get("severity", "LOW"),
            "issue_confidence": issue.get("confidence", "MEDIUM"),
            "issue_text": issue.get("message", ""),
            "filename": issue.get("file", ""),
            "line_number": issue.get("line", 0),
            "col_offset": issue.get("col", 0),
            "code": issue.get("code", ""),
            "issue_cwe": issue.get("cwe", {}),
            "more_info": issue.get("more_info", ""),
            # Extra fields for the new multi-lang support
            "_tool": issue.get("tool", ""),
            "_language": issue.get("language", ""),
        })

    compat_report = {
        "results": all_results,
        "generated_at": datetime.now().isoformat(),
        "metrics": {
            "_totals": {
                "SEVERITY.HIGH": sum(1 for i in issues if i.get("severity") == "HIGH"),
                "SEVERITY.MEDIUM": sum(1 for i in issues if i.get("severity") == "MEDIUM"),
                "SEVERITY.LOW": sum(1 for i in issues if i.get("severity") == "LOW"),
                "CONFIDENCE.HIGH": sum(1 for i in issues if i.get("confidence") == "HIGH"),
                "CONFIDENCE.MEDIUM": sum(1 for i in issues if i.get("confidence") == "MEDIUM"),
                "CONFIDENCE.LOW": sum(1 for i in issues if i.get("confidence") == "LOW"),
                "loc": 0,
                "nosec": 0,
            }
        },
    }

    with open(bandit_path, "w") as f:
        json.dump(compat_report, f, indent=2)


# ═══════════════════════════════════════════════════════════════════
# SCORE CALCULATION HELPERS
# ═══════════════════════════════════════════════════════════════════

def calculate_sast_score(sast_report: Dict[str, Any]) -> int:
    """
    Calculate the SAST component of the security score from the unified report.
    Uses the same weighting formula as the original Bandit-only scorer.

    Max penalty = 40 (same as before: 25 high + 10 medium + 5 low)
    """
    metrics = sast_report.get("metrics", {}).get("totals", {})
    high = metrics.get("high", 0)
    medium = metrics.get("medium", 0)
    low = metrics.get("low", 0)

    high_impact = min(25, high * 8)
    medium_impact = min(10, medium * 3)
    low_impact = min(5, low * 1)

    penalty = high_impact + medium_impact + low_impact
    return max(0, 100 - penalty)
