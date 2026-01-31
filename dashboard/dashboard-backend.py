from flask import Flask, jsonify, render_template
import json
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORT_DIR = os.path.dirname(BASE_DIR)

@app.route("/")
def home():
    return render_template("dashboard.html")

@app.route("/api/bandit")
def bandit():
    with open(os.path.join(REPORT_DIR, "bandit-report.json")) as f:
        return jsonify(json.load(f))

@app.route("/api/trivy")
def trivy():
    with open(os.path.join(REPORT_DIR, "trivy-report.json")) as f:
        return jsonify(json.load(f))

if __name__ == "__main__":
    app.run(debug=True)
