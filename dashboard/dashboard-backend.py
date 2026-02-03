from flask import Flask, jsonify, render_template, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORT_DIR = os.path.join(os.path.dirname(BASE_DIR), "reports")

def load_json_file(filename):
    """Helper to load JSON report files"""
    path = os.path.join(REPORT_DIR, filename)
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError:
        return None

@app.route("/")
def home():
    return render_template("dashboard.html")

@app.route("/api/bandit")
def bandit():
    """Get Bandit security scan results"""
    data = load_json_file("bandit-report.json")
    if data is None:
        return jsonify({"error": "Bandit report not found"}), 404
    return jsonify(data)

@app.route("/api/trivy")
def trivy():
    """Get Trivy container scan results"""
    data = load_json_file("trivy-report.json")
    if data is None:
        return jsonify({"error": "Trivy report not found"}), 404
    return jsonify(data)

@app.route("/api/summary")
def summary():
    """Get a summary of all security findings"""
    bandit_data = load_json_file("bandit-report.json")
    trivy_data = load_json_file("trivy-report.json")
    
    # Calculate Bandit metrics
    bandit_metrics = {
        "total": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
    }
    if bandit_data and "metrics" in bandit_data:
        totals = bandit_data["metrics"].get("_totals", {})
        bandit_metrics = {
            "total": len(bandit_data.get("results", [])),
            "high": totals.get("SEVERITY.HIGH", 0),
            "medium": totals.get("SEVERITY.MEDIUM", 0),
            "low": totals.get("SEVERITY.LOW", 0),
        }
    
    # Calculate Trivy metrics
    trivy_metrics = {
        "total": 0,
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
    }
    if trivy_data and "Results" in trivy_data:
        for result in trivy_data["Results"]:
            for vuln in result.get("Vulnerabilities", []):
                trivy_metrics["total"] += 1
                severity = vuln.get("Severity", "").upper()
                if severity in trivy_metrics:
                    trivy_metrics[severity.lower()] += 1
    
    return jsonify({
        "generated_at": datetime.now().isoformat(),
        "bandit": bandit_metrics,
        "trivy": trivy_metrics,
        "total_vulnerabilities": bandit_metrics["total"] + trivy_metrics["total"],
        "critical_count": trivy_metrics["critical"] + bandit_metrics["high"] + trivy_metrics["high"],
    })

@app.route("/api/health")
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "reports": {
            "bandit": os.path.exists(os.path.join(REPORT_DIR, "bandit-report.json")),
            "trivy": os.path.exists(os.path.join(REPORT_DIR, "trivy-report.json")),
        }
    })

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
