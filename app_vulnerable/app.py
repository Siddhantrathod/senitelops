from flask import Flask, jsonify, request
import subprocess
import os

app = Flask(__name__)

SECRET_KEY = "mysecret123"

users = [
    {"id": 1, "name": "Alice", "email": "alice@example.com"},
    {"id": 2, "name": "Bob", "email": "bob@example.com"},
]

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "VULNERABLE Flask API",
        "secret": SECRET_KEY  # ❌ leaking secret
    })

@app.route("/api/users", methods=["GET"])
def get_users():
    return jsonify(users)

@app.route("/api/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    user = next((u for u in users if u["id"] == user_id), None)
    return jsonify(user)

@app.route("/api/users", methods=["POST"])
def create_user():
    data = request.get_json()

    # No validation
    users.append(data)
    return jsonify({"status": "created", "data": data})

# Command injection endpoint (for demo)
@app.route("/run")
def run_cmd():
    cmd = request.args.get("cmd")
    return subprocess.getoutput(cmd)

# Dangerous eval usage
@app.route("/calc")
def calc():
    expr = request.args.get("expr")
    return str(eval(expr))

if __name__ == "__main__":
    # ❌ Insecure configuration
    app.run(debug=True, host="0.0.0.0", port=5000)
