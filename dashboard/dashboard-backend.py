from flask import Flask, jsonify, render_template
import json
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORT_DIR = os.path.join(os.path.dirname(BASE_DIR), "reports")

@app.route("/")
def home():
    return render_template("dashboard.html")

@app.route("/api/bandit")
def bandit():
    path = os.path.join(REPORT_DIR, "bandit-report.json")
    with open(path) as f:
        return jsonify(json.load(f))

@app.route("/api/trivy")
def trivy():
    path = os.path.join(REPORT_DIR, "trivy-report.json")
    with open(path) as f:
        return jsonify(json.load(f))

if __name__ == "__main__":
    app.run(debug=False)
