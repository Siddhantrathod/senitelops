import os
import json
import logging
import random

logger = logging.getLogger('SentinelOps.AIPredictor')

GEMINI_MODEL = "gemini-2.5-flash"


def _get_client():
    """Return a configured google.genai client, or None if API key is missing."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key in ("your-gemini-api-key", "CHANGE_ME"):
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        logger.warning(f"Failed to create Gemini client: {e}")
        return None


def predict_vulnerabilities(input_data):
    """
    AI-based vulnerability prediction using the Google Gemini API (google-genai SDK).
    Args:
        input_data (dict): Paths to scan reports.
    Returns:
        dict: Prediction results with risk_score, likely_vulnerable_areas, suggestions.
    """
    client = _get_client()
    if not client:
        logger.warning("GEMINI_API_KEY is missing or invalid. Falling back to dummy predictor.")
        return {
            "risk_score": round(random.uniform(0, 1), 2),
            "likely_vulnerable_areas": ["src/components/App.jsx", "pipeline/dast_scanner.py"],
            "suggestions": [
                "Review input validation in App.jsx.",
                "Check for outdated dependencies in dast_scanner.py."
            ]
        }

    try:
        from google import genai
        from google.genai import types

        prompt_parts = [
            "You are a Senior Application Security Engineer. Analyze the provided vulnerability reports.",
            "Respond strictly in JSON format matching the following schema:",
            '{"risk_score": <float between 0.1 and 1.0>, "likely_vulnerable_areas": ["<file or component>"], "suggestions": ["<remediation strategies>"]}',
            f"Repository: {input_data.get('repo_name', 'Unknown')}",
            "Scan summaries:",
        ]

        for rkey, rname in [
            ("sast_report_path", "SAST"),
            ("trivy_report_path", "Trivy"),
            ("gitleaks_report_path", "Gitleaks"),
            ("dast_report_path", "DAST"),
        ]:
            rpath = input_data.get(rkey)
            if rpath and os.path.exists(rpath):
                try:
                    with open(rpath, "r") as f:
                        content = f.read()
                    if len(content) > 20000:
                        content = content[:20000] + "\n...[TRUNCATED]"
                    prompt_parts.append(f"[{rname}]\n{content}")
                except Exception:
                    pass

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents="\n".join(prompt_parts),
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            ),
        )

        result = json.loads(response.text)
        return {
            "risk_score": float(result.get("risk_score", 0.5)),
            "likely_vulnerable_areas": result.get("likely_vulnerable_areas", []),
            "suggestions": result.get("suggestions", []),
        }
    except Exception as e:
        logger.error(f"Gemini AI Prediction error: {e}")
        return {
            "risk_score": 0.5,
            "likely_vulnerable_areas": [],
            "suggestions": [f"AI error: {str(e)}"],
        }


def generate_fix(vulnerability: dict, source_code: str = "") -> dict:
    """
    Generate an AI-powered code fix for a specific SAST vulnerability using Gemini.
    Returns a dict with fix_description, original_code, fixed_code, and explanation.
    """
    client = _get_client()
    if not client:
        return {
            "fix_description": "No GEMINI_API_KEY configured.",
            "original_code": source_code,
            "fixed_code": "",
            "explanation": "Please add a valid GEMINI_API_KEY to your .env file to use AI fix generation."
        }

    try:
        from google import genai
        from google.genai import types

        rule_id = vulnerability.get('rule_id') or vulnerability.get('test_id') or 'Unknown'
        rule_name = vulnerability.get('rule_name') or vulnerability.get('test_name') or ''
        severity = vulnerability.get('severity') or vulnerability.get('issue_severity') or 'UNKNOWN'
        message = vulnerability.get('message') or vulnerability.get('issue_text') or ''
        file_path = vulnerability.get('file') or vulnerability.get('filename') or ''
        line = vulnerability.get('line') or vulnerability.get('line_number') or 0
        code_snippet = vulnerability.get('code') or source_code or ''

        prompt = f"""You are a Senior Application Security Engineer. Generate a precise, minimal code fix for the following vulnerability found during a SAST scan.

Vulnerability Details:
- Rule: {rule_id} ({rule_name})
- Severity: {severity}
- File: {file_path}, Line: {line}
- Issue: {message}

Vulnerable Code:
```
{code_snippet[:3000]}
```

Respond ONLY as JSON with the following exact schema:
{{"fix_description": "<1-2 sentence summary>", "original_code": "<vulnerable snippet>", "fixed_code": "<corrected snippet>", "explanation": "<what changed and why>"}}"""

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            ),
        )

        result = json.loads(response.text)
        return {
            "fix_description": result.get("fix_description", ""),
            "original_code": result.get("original_code", code_snippet),
            "fixed_code": result.get("fixed_code", ""),
            "explanation": result.get("explanation", ""),
            "rule_id": rule_id,
            "severity": severity,
        }
    except Exception as e:
        logger.error(f"Gemini Fix Generation error: {e}")
        return {
            "fix_description": f"AI fix generation failed: {str(e)}",
            "original_code": source_code,
            "fixed_code": "",
            "explanation": str(e),
        }
