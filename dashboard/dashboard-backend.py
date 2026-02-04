from flask import Flask, jsonify, render_template, send_from_directory, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, get_jwt
import json
import os
import sys
import hmac
import hashlib
from datetime import datetime, timedelta
import bcrypt

# Add pipeline module to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.pipeline_executor import PipelineExecutor, run_pipeline_async

app = Flask(__name__)
CORS(app, supports_credentials=True)

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'sentinelops-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'
jwt = JWTManager(app)

# Handle JWT errors
@jwt.invalid_token_loader
def invalid_token_callback(error_string):
    return jsonify({"error": "Invalid token", "message": error_string}), 401

@jwt.unauthorized_loader
def unauthorized_callback(error_string):
    return jsonify({"error": "Missing token", "message": error_string}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({"error": "Token expired"}), 401

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORT_DIR = os.path.join(os.path.dirname(BASE_DIR), "reports")
DATA_DIR = os.path.join(BASE_DIR, "data")
PIPELINE_DIR = os.path.join(DATA_DIR, "pipelines")

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(PIPELINE_DIR, exist_ok=True)

# File paths for persistent storage
USERS_FILE = os.path.join(DATA_DIR, "users.json")
POLICY_FILE = os.path.join(DATA_DIR, "policy.json")
PIPELINES_FILE = os.path.join(PIPELINE_DIR, "history.json")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")

# Initialize pipeline executor
pipeline_executor = PipelineExecutor(REPORT_DIR, PIPELINES_FILE)

# GitHub webhook secret (set via environment variable)
GITHUB_WEBHOOK_SECRET = os.environ.get('GITHUB_WEBHOOK_SECRET', 'your-webhook-secret')

# Default config
DEFAULT_CONFIG = {
    "github_repo_url": "",
    "github_branch": "main",
    "auto_scan_enabled": True,
    "scan_on_push": True,
    "target_image": "sentinelops-app",
    "target_directory": ""
}

# Default policy settings
DEFAULT_POLICY = {
    "minScore": 70,
    "blockCritical": True,
    "blockHigh": False,
    "maxCriticalVulns": 0,
    "maxHighVulns": 5,
    "autoBlock": True,
    "updatedAt": None,
    "updatedBy": None
}

# Default admin user (password: admin123)
DEFAULT_USERS = [
    {
        "id": 1,
        "username": "admin",
        "email": "admin@sentinelops.io",
        "password": bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
        "role": "admin",
        "createdAt": datetime.now().isoformat()
    }
]

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

def load_data_file(filepath, default):
    """Load data from JSON file or return default"""
    try:
        with open(filepath) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        save_data_file(filepath, default)
        return default

def save_data_file(filepath, data):
    """Save data to JSON file"""
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

def get_users():
    """Get all users"""
    return load_data_file(USERS_FILE, DEFAULT_USERS)

def save_users(users):
    """Save users to file"""
    save_data_file(USERS_FILE, users)

def get_config():
    """Get current config"""
    return load_data_file(CONFIG_FILE, DEFAULT_CONFIG)

def save_config(config):
    """Save config to file"""
    save_data_file(CONFIG_FILE, config)

def verify_github_signature(payload_body, signature_header):
    """Verify GitHub webhook signature"""
    if not signature_header:
        return False
    
    hash_object = hmac.new(
        GITHUB_WEBHOOK_SECRET.encode('utf-8'),
        msg=payload_body,
        digestmod=hashlib.sha256
    )
    expected_signature = "sha256=" + hash_object.hexdigest()
    return hmac.compare_digest(expected_signature, signature_header)

def get_policy():
    """Get current policy"""
    return load_data_file(POLICY_FILE, DEFAULT_POLICY)

def save_policy(policy):
    """Save policy to file"""
    save_data_file(POLICY_FILE, policy)

# Initialize data files if they don't exist
get_users()
get_policy()

# ==================== AUTH ROUTES ====================

@app.route("/api/auth/login", methods=["POST"])
def login():
    """Authenticate user and return JWT token"""
    data = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
    
    users = get_users()
    user = next((u for u in users if u["username"] == username), None)
    
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401
    
    if not bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Create access token with user id as identity
    access_token = create_access_token(identity=str(user["id"]), additional_claims={
        "username": user["username"],
        "email": user["email"],
        "role": user["role"]
    })
    
    return jsonify({
        "token": access_token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"]
        }
    })

def get_current_user_info():
    """Helper to get current user info from JWT"""
    user_id = get_jwt_identity()
    claims = get_jwt()
    return {
        "id": int(user_id),
        "username": claims.get("username"),
        "email": claims.get("email"),
        "role": claims.get("role")
    }

@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """Get current authenticated user"""
    return jsonify(get_current_user_info())

@app.route("/api/auth/register", methods=["POST"])
@jwt_required()
def register():
    """Register new user (admin only)"""
    current_user = get_current_user_info()
    if current_user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403
    
    data = request.get_json()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    role = data.get("role", "user")
    
    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    
    users = get_users()
    
    if any(u["username"] == username for u in users):
        return jsonify({"error": "Username already exists"}), 400
    
    if any(u["email"] == email for u in users):
        return jsonify({"error": "Email already exists"}), 400
    
    new_user = {
        "id": max(u["id"] for u in users) + 1 if users else 1,
        "username": username,
        "email": email,
        "password": bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
        "role": role,
        "createdAt": datetime.now().isoformat()
    }
    
    users.append(new_user)
    save_users(users)
    
    return jsonify({
        "message": "User created successfully",
        "user": {
            "id": new_user["id"],
            "username": new_user["username"],
            "email": new_user["email"],
            "role": new_user["role"]
        }
    }), 201

@app.route("/api/auth/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """Change current user's password"""
    current_user = get_current_user_info()
    data = request.get_json()
    
    current_password = data.get("currentPassword", "")
    new_password = data.get("newPassword", "")
    
    if not current_password or not new_password:
        return jsonify({"error": "Both current and new password are required"}), 400
    
    users = get_users()
    user = next((u for u in users if u["id"] == current_user["id"]), None)
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    if not bcrypt.checkpw(current_password.encode('utf-8'), user["password"].encode('utf-8')):
        return jsonify({"error": "Current password is incorrect"}), 401
    
    user["password"] = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    save_users(users)
    
    return jsonify({"message": "Password changed successfully"})

# ==================== POLICY ROUTES ====================

@app.route("/api/policy", methods=["GET"])
@jwt_required()
def get_policy_settings():
    """Get current policy settings"""
    policy = get_policy()
    return jsonify(policy)

@app.route("/api/policy", methods=["PUT"])
@jwt_required()
def update_policy():
    """Update policy settings"""
    current_user = get_current_user_info()
    if current_user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403
    
    data = request.get_json()
    policy = get_policy()
    
    # Update policy fields
    if "minScore" in data:
        policy["minScore"] = max(0, min(100, int(data["minScore"])))
    if "blockCritical" in data:
        policy["blockCritical"] = bool(data["blockCritical"])
    if "blockHigh" in data:
        policy["blockHigh"] = bool(data["blockHigh"])
    if "maxCriticalVulns" in data:
        policy["maxCriticalVulns"] = max(0, int(data["maxCriticalVulns"]))
    if "maxHighVulns" in data:
        policy["maxHighVulns"] = max(0, int(data["maxHighVulns"]))
    if "autoBlock" in data:
        policy["autoBlock"] = bool(data["autoBlock"])
    
    policy["updatedAt"] = datetime.now().isoformat()
    policy["updatedBy"] = current_user["username"]
    
    save_policy(policy)
    
    return jsonify({
        "message": "Policy updated successfully",
        "policy": policy
    })

@app.route("/api/policy/evaluate", methods=["GET"])
@jwt_required()
def evaluate_policy():
    """Evaluate current security status against policy"""
    bandit_data = load_json_file("bandit-report.json")
    trivy_data = load_json_file("trivy-report.json")
    policy = get_policy()
    
    # Calculate security score
    score = 100
    critical_count = 0
    high_count = 0
    violations = []
    
    # Count Bandit issues
    if bandit_data and "results" in bandit_data:
        for result in bandit_data["results"]:
            severity = result.get("issue_severity", "").upper()
            if severity == "HIGH":
                high_count += 1
                score -= 5
    
    # Count Trivy vulnerabilities
    if trivy_data and "Results" in trivy_data:
        for result in trivy_data["Results"]:
            for vuln in result.get("Vulnerabilities", []):
                severity = vuln.get("Severity", "").upper()
                if severity == "CRITICAL":
                    critical_count += 1
                    score -= 10
                elif severity == "HIGH":
                    high_count += 1
                    score -= 5
    
    score = max(0, score)
    
    # Check policy violations
    deployment_allowed = True
    
    if policy["blockCritical"] and critical_count > policy["maxCriticalVulns"]:
        deployment_allowed = False
        violations.append(f"Critical vulnerabilities ({critical_count}) exceed threshold ({policy['maxCriticalVulns']})")
    
    if policy["blockHigh"] and high_count > policy["maxHighVulns"]:
        deployment_allowed = False
        violations.append(f"High severity issues ({high_count}) exceed threshold ({policy['maxHighVulns']})")
    
    if score < policy["minScore"]:
        deployment_allowed = False
        violations.append(f"Security score ({score}) below minimum ({policy['minScore']})")
    
    return jsonify({
        "score": score,
        "criticalCount": critical_count,
        "highCount": high_count,
        "deploymentAllowed": deployment_allowed,
        "violations": violations,
        "policy": policy
    })

@app.route("/")
def home():
    return render_template("dashboard.html")

@app.route("/api/bandit")
@jwt_required()
def bandit():
    """Get Bandit security scan results"""
    data = load_json_file("bandit-report.json")
    if data is None:
        return jsonify({"error": "Bandit report not found"}), 404
    return jsonify(data)

@app.route("/api/trivy")
@jwt_required()
def trivy():
    """Get Trivy container scan results"""
    data = load_json_file("trivy-report.json")
    if data is None:
        return jsonify({"error": "Trivy report not found"}), 404
    return jsonify(data)

@app.route("/api/summary")
@jwt_required()
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

# ==================== PIPELINE ROUTES ====================

@app.route("/api/pipelines", methods=["GET"])
@jwt_required()
def get_pipelines():
    """Get list of pipeline runs"""
    limit = request.args.get('limit', 20, type=int)
    pipelines = pipeline_executor.get_pipelines(limit)
    return jsonify({
        "pipelines": pipelines,
        "total": len(pipelines)
    })

@app.route("/api/pipelines/<pipeline_id>", methods=["GET"])
@jwt_required()
def get_pipeline(pipeline_id):
    """Get specific pipeline details"""
    pipeline = pipeline_executor.get_pipeline(pipeline_id)
    if not pipeline:
        return jsonify({"error": "Pipeline not found"}), 404
    return jsonify(pipeline)

@app.route("/api/pipelines/latest", methods=["GET"])
@jwt_required()
def get_latest_pipeline():
    """Get the most recent pipeline run"""
    pipeline = pipeline_executor.get_latest_pipeline()
    if not pipeline:
        return jsonify({"error": "No pipelines found"}), 404
    return jsonify(pipeline)

@app.route("/api/pipelines/trigger", methods=["POST"])
@jwt_required()
def trigger_pipeline():
    """Manually trigger a new pipeline run"""
    current_user = get_current_user_info()
    config = get_config()
    data = request.get_json() or {}
    
    repo_url = data.get('repo_url') or config.get('github_repo_url')
    branch = data.get('branch') or config.get('github_branch', 'main')
    target_dir = data.get('target_dir') or config.get('target_directory')
    image_name = data.get('image_name') or config.get('target_image')
    
    # Create pipeline
    pipeline = pipeline_executor.create_pipeline(
        repo_url=repo_url,
        branch=branch,
        commit_sha=data.get('commit_sha', 'manual'),
        commit_message=data.get('commit_message', f'Manual trigger by {current_user["username"]}'),
        author=current_user["username"]
    )
    
    # Run pipeline asynchronously
    run_pipeline_async(
        pipeline_executor, 
        pipeline, 
        repo_url=repo_url if repo_url else None,
        target_dir=target_dir if target_dir else None,
        image_name=image_name
    )
    
    return jsonify({
        "message": "Pipeline triggered successfully",
        "pipeline_id": pipeline.id,
        "status": pipeline.status.value
    }), 202

@app.route("/api/config", methods=["GET"])
@jwt_required()
def get_pipeline_config():
    """Get pipeline configuration"""
    return jsonify(get_config())

@app.route("/api/config", methods=["PUT"])
@jwt_required()
def update_pipeline_config():
    """Update pipeline configuration"""
    current_user = get_current_user_info()
    if current_user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403
    
    data = request.get_json()
    config = get_config()
    
    # Update allowed fields
    allowed_fields = ['github_repo_url', 'github_branch', 'auto_scan_enabled', 
                      'scan_on_push', 'target_image', 'target_directory']
    
    for field in allowed_fields:
        if field in data:
            config[field] = data[field]
    
    config['updated_at'] = datetime.now().isoformat()
    config['updated_by'] = current_user["username"]
    
    save_config(config)
    
    return jsonify({
        "message": "Configuration updated successfully",
        "config": config
    })

# ==================== GITHUB WEBHOOK ====================

@app.route("/webhook/github", methods=["POST"])
def github_webhook():
    """Handle GitHub webhook events"""
    # Verify signature
    signature = request.headers.get('X-Hub-Signature-256')
    if GITHUB_WEBHOOK_SECRET != 'your-webhook-secret':  # Only verify if secret is configured
        if not verify_github_signature(request.data, signature):
            return jsonify({"error": "Invalid signature"}), 401
    
    event = request.headers.get('X-GitHub-Event', 'ping')
    
    if event == 'ping':
        return jsonify({"message": "Pong! Webhook configured successfully"})
    
    if event != 'push':
        return jsonify({"message": f"Event '{event}' ignored"}), 200
    
    config = get_config()
    if not config.get('scan_on_push', True):
        return jsonify({"message": "Auto-scan disabled"}), 200
    
    payload = request.get_json()
    
    # Extract push info
    repo_url = payload.get('repository', {}).get('clone_url', '')
    branch = payload.get('ref', 'refs/heads/main').replace('refs/heads/', '')
    commit = payload.get('head_commit', {})
    commit_sha = commit.get('id', '')
    commit_message = commit.get('message', '')
    author = commit.get('author', {}).get('name', 'GitHub')
    
    # Check if this is the configured branch
    configured_branch = config.get('github_branch', 'main')
    if branch != configured_branch:
        return jsonify({"message": f"Branch '{branch}' ignored, watching '{configured_branch}'"}), 200
    
    # Create and run pipeline
    pipeline = pipeline_executor.create_pipeline(
        repo_url=repo_url,
        branch=branch,
        commit_sha=commit_sha,
        commit_message=commit_message,
        author=author
    )
    
    # Determine scan target
    target_dir = config.get('target_directory')
    image_name = config.get('target_image')
    
    run_pipeline_async(
        pipeline_executor,
        pipeline,
        repo_url=repo_url,
        target_dir=target_dir if target_dir else None,
        image_name=image_name
    )
    
    return jsonify({
        "message": "Pipeline triggered",
        "pipeline_id": pipeline.id
    }), 202

# ==================== LOCAL SCAN ====================

@app.route("/api/scan/local", methods=["POST"])
@jwt_required()
def scan_local():
    """Trigger a scan on a local directory"""
    current_user = get_current_user_info()
    data = request.get_json() or {}
    
    target_dir = data.get('directory')
    image_name = data.get('image_name')
    
    if not target_dir and not image_name:
        return jsonify({"error": "Either directory or image_name is required"}), 400
    
    pipeline = pipeline_executor.create_pipeline(
        repo_url="",
        branch="local",
        commit_sha="local",
        commit_message=f"Local scan by {current_user['username']}",
        author=current_user["username"]
    )
    
    run_pipeline_async(
        pipeline_executor,
        pipeline,
        repo_url=None,
        target_dir=target_dir,
        image_name=image_name
    )
    
    return jsonify({
        "message": "Local scan triggered",
        "pipeline_id": pipeline.id
    }), 202

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
