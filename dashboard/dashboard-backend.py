from flask import Flask, jsonify, render_template, send_from_directory, request, redirect, url_for, session
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, get_jwt
import json
import os
import sys
import hmac
import hashlib
import re
from datetime import datetime, timedelta
from typing import Dict
import bcrypt
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

# Add pipeline module to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pipeline.pipeline_executor import (
    PipelineExecutor, 
    run_pipeline_async,
    run_pipeline,
    run_pipeline_background,
    validate_repo_url,
    PipelineResult
)

# Google OAuth imports
try:
    from authlib.integrations.requests_client import OAuth2Session
    OAUTH_AVAILABLE = True
except ImportError:
    OAUTH_AVAILABLE = False

app = Flask(__name__)
app.secret_key = os.environ.get('JWT_SECRET_KEY', 'sentinelops-secret-key-change-in-production')
CORS(app, supports_credentials=True)

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'sentinelops-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'
jwt = JWTManager(app)

# Google OAuth 2.0 Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_DISCOVERY_URL = 'https://accounts.google.com/.well-known/openid-configuration'
GOOGLE_AUTH_URI = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token'
GOOGLE_USERINFO_URI = 'https://openidconnect.googleapis.com/v1/userinfo'
GOOGLE_SCOPES = ['openid', 'email', 'profile']

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
REPORT_DIR = os.path.join(os.path.dirname(BASE_DIR), "runtime", "reports")
DATA_DIR = os.path.join(BASE_DIR, "data")
PIPELINE_DIR = os.path.join(DATA_DIR, "pipelines")

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(PIPELINE_DIR, exist_ok=True)
os.makedirs(REPORT_DIR, exist_ok=True)

# File paths for persistent storage
USERS_FILE = os.path.join(DATA_DIR, "users.json")
POLICY_FILE = os.path.join(DATA_DIR, "policy.json")
PIPELINES_FILE = os.path.join(PIPELINE_DIR, "history.json")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")
NOTIFICATIONS_FILE = os.path.join(DATA_DIR, "notifications.json")

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
    "target_image": "",
    "target_directory": "",
    "setup_completed": False,
    "repo_configured": False,
    "policy_configured": False,
    "initial_scan_completed": False
}

# Default policy settings
DEFAULT_POLICY = {
    "minScore": 70,
    "blockCritical": True,
    "blockHigh": False,
    "maxCriticalVulns": 0,
    "maxHighVulns": 5,
    "autoBlock": True,
    "configured": False,
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
        "fullName": "System Administrator",
        "organization": "SentinelOps",
        "roleTitle": "Platform Admin",
        "phone": "",
        "authProvider": "local",
        "lastLoginAt": None,
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

def get_notifications():
    """Get all notifications"""
    return load_data_file(NOTIFICATIONS_FILE, [])

def save_notifications(notifications):
    """Save notifications to file"""
    save_data_file(NOTIFICATIONS_FILE, notifications)

def add_notification(notification_type: str, title: str, message: str, metadata: dict = None):
    """
    Add a new notification to the system.
    
    Types: 'critical', 'warning', 'success', 'info'
    """
    import uuid
    notifications = get_notifications()
    
    new_notification = {
        "id": str(uuid.uuid4())[:8],
        "type": notification_type,
        "title": title,
        "message": message,
        "metadata": metadata or {},
        "time": datetime.now().isoformat(),
        "read": False
    }
    
    # Add to beginning (newest first)
    notifications.insert(0, new_notification)
    
    # Keep only last 100 notifications
    notifications = notifications[:100]
    
    save_notifications(notifications)
    return new_notification

# Initialize data files if they don't exist
get_users()
get_policy()
get_notifications()

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
    
    # Google-only accounts can't login with password
    if user.get("authProvider") == "google" and not user.get("password"):
        return jsonify({"error": "This account uses Google Sign-In. Please login with Google."}), 401
    
    if not bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
        return jsonify({"error": "Invalid credentials"}), 401
    
    # Update last login
    user["lastLoginAt"] = datetime.now().isoformat()
    save_users(users)
    
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
            "role": user["role"],
            "fullName": user.get("fullName", ""),
            "organization": user.get("organization", ""),
            "roleTitle": user.get("roleTitle", ""),
            "authProvider": user.get("authProvider", "local")
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

def get_full_user_info(user_id):
    """Get full user info from storage (not just JWT claims)"""
    users = get_users()
    user = next((u for u in users if u["id"] == user_id), None)
    if user:
        return {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "fullName": user.get("fullName", ""),
            "organization": user.get("organization", ""),
            "roleTitle": user.get("roleTitle", ""),
        }
    return None

@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """Get current authenticated user with full details"""
    current = get_current_user_info()
    full_info = get_full_user_info(current["id"])
    if full_info:
        return jsonify(full_info)
    return jsonify(current)

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    """Public signup endpoint - creates a new viewer account"""
    data = request.get_json()
    
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    full_name = data.get("fullName", "").strip()
    organization = data.get("organization", "").strip()
    role_title = data.get("roleTitle", "").strip()
    phone = data.get("phone", "").strip()
    
    # Validate required fields
    errors = []
    if not username:
        errors.append("Username is required")
    elif len(username) < 3:
        errors.append("Username must be at least 3 characters")
    elif not re.match(r'^[a-zA-Z0-9_.-]+$', username):
        errors.append("Username can only contain letters, numbers, dots, hyphens, and underscores")
    
    if not email:
        errors.append("Email is required")
    elif not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        errors.append("Invalid email format")
    
    if not password:
        errors.append("Password is required")
    elif len(password) < 6:
        errors.append("Password must be at least 6 characters")
    
    if not full_name:
        errors.append("Full name is required")
    
    if errors:
        return jsonify({"error": errors[0], "errors": errors}), 400
    
    users = get_users()
    
    if any(u["username"].lower() == username.lower() for u in users):
        return jsonify({"error": "Username already exists"}), 409
    
    if any(u["email"].lower() == email.lower() for u in users):
        return jsonify({"error": "Email already exists"}), 409
    
    new_user = {
        "id": max(u["id"] for u in users) + 1 if users else 1,
        "username": username,
        "email": email,
        "password": bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
        "role": "viewer",
        "fullName": full_name,
        "organization": organization,
        "roleTitle": role_title,
        "phone": phone,
        "authProvider": "local",
        "lastLoginAt": None,
        "createdAt": datetime.now().isoformat()
    }
    
    users.append(new_user)
    save_users(users)
    
    return jsonify({
        "message": "Account created successfully! Please sign in.",
        "user": {
            "id": new_user["id"],
            "username": new_user["username"],
            "email": new_user["email"],
            "role": new_user["role"],
            "fullName": new_user["fullName"]
        }
    }), 201

@app.route("/api/auth/register", methods=["POST"])
@jwt_required()
def register():
    """Register new user (admin only) - can set any role"""
    current_user = get_current_user_info()
    if current_user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403
    
    data = request.get_json()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    role = data.get("role", "viewer")
    full_name = data.get("fullName", "").strip()
    organization = data.get("organization", "").strip()
    role_title = data.get("roleTitle", "").strip()
    phone = data.get("phone", "").strip()
    
    if not username or not email or not password:
        return jsonify({"error": "Username, email and password are required"}), 400
    
    # Validate role
    valid_roles = ["admin", "user", "viewer"]
    if role not in valid_roles:
        return jsonify({"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}"}), 400
    
    users = get_users()
    
    if any(u["username"].lower() == username.lower() for u in users):
        return jsonify({"error": "Username already exists"}), 409
    
    if any(u["email"].lower() == email.lower() for u in users):
        return jsonify({"error": "Email already exists"}), 409
    
    new_user = {
        "id": max(u["id"] for u in users) + 1 if users else 1,
        "username": username,
        "email": email,
        "password": bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
        "role": role,
        "fullName": full_name,
        "organization": organization,
        "roleTitle": role_title,
        "phone": phone,
        "authProvider": "local",
        "lastLoginAt": None,
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
            "role": new_user["role"],
            "fullName": new_user["fullName"]
        }
    }), 201

# ==================== GOOGLE OAUTH ROUTES ====================

@app.route("/api/auth/google", methods=["GET"])
def google_login():
    """Redirect to Google OAuth consent screen"""
    if not OAUTH_AVAILABLE:
        return jsonify({"error": "OAuth library not installed"}), 500
    
    if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID == 'your-google-client-id':
        return jsonify({"error": "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"}), 503
    
    oauth_client = OAuth2Session(
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        redirect_uri=request.url_root.rstrip('/') + '/api/auth/google/callback',
        scope=' '.join(GOOGLE_SCOPES)
    )
    
    authorization_url, state = oauth_client.create_authorization_url(GOOGLE_AUTH_URI)
    session['oauth_state'] = state
    
    return redirect(authorization_url)

@app.route("/api/auth/google/callback", methods=["GET"])
def google_callback():
    """Handle Google OAuth callback"""
    if not OAUTH_AVAILABLE:
        return jsonify({"error": "OAuth library not installed"}), 500
    
    code = request.args.get('code')
    if not code:
        # Redirect to frontend login with error
        return redirect('http://localhost:3000/login?error=google_auth_failed')
    
    try:
        oauth_client = OAuth2Session(
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            redirect_uri=request.url_root.rstrip('/') + '/api/auth/google/callback',
            state=session.get('oauth_state')
        )
        
        token = oauth_client.fetch_token(
            GOOGLE_TOKEN_URI,
            code=code,
        )
        
        # Get user info from Google
        resp = oauth_client.get(GOOGLE_USERINFO_URI)
        google_user = resp.json()
        
        google_email = google_user.get('email', '')
        google_name = google_user.get('name', '')
        google_sub = google_user.get('sub', '')  # Google user ID
        
        if not google_email:
            return redirect('http://localhost:3000/login?error=no_email')
        
        users = get_users()
        
        # Check if user exists by email
        existing_user = next((u for u in users if u["email"].lower() == google_email.lower()), None)
        
        if existing_user:
            # Update last login
            existing_user["lastLoginAt"] = datetime.now().isoformat()
            if not existing_user.get("authProvider"):
                existing_user["authProvider"] = "google"
            save_users(users)
            user = existing_user
        else:
            # Create new user from Google profile
            username = google_email.split('@')[0]
            # Ensure unique username
            base_username = username
            counter = 1
            while any(u["username"].lower() == username.lower() for u in users):
                username = f"{base_username}{counter}"
                counter += 1
            
            user = {
                "id": max(u["id"] for u in users) + 1 if users else 1,
                "username": username,
                "email": google_email,
                "password": "",
                "role": "viewer",
                "fullName": google_name,
                "organization": "",
                "roleTitle": "",
                "phone": "",
                "authProvider": "google",
                "googleId": google_sub,
                "lastLoginAt": datetime.now().isoformat(),
                "createdAt": datetime.now().isoformat()
            }
            users.append(user)
            save_users(users)
        
        # Create JWT token
        access_token = create_access_token(identity=str(user["id"]), additional_claims={
            "username": user["username"],
            "email": user["email"],
            "role": user["role"]
        })
        
        # Redirect to frontend with token
        return redirect(f'http://localhost:3000/login?token={access_token}&provider=google')
        
    except Exception as e:
        app.logger.error(f"Google OAuth error: {e}")
        return redirect(f'http://localhost:3000/login?error=oauth_error&message={str(e)}')

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
    
    policy["configured"] = True  # Mark policy as configured when updated
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
    
    # Count vulnerabilities by severity
    critical_count = 0
    high_count = 0
    medium_count = 0
    low_count = 0
    violations = []
    
    # Count Bandit issues
    if bandit_data and "results" in bandit_data:
        for result in bandit_data["results"]:
            severity = result.get("issue_severity", "").upper()
            if severity == "HIGH":
                high_count += 1
            elif severity == "MEDIUM":
                medium_count += 1
            elif severity == "LOW":
                low_count += 1
    
    # Count Trivy vulnerabilities
    if trivy_data and "Results" in trivy_data:
        for result in trivy_data["Results"]:
            for vuln in result.get("Vulnerabilities", []) or []:
                severity = vuln.get("Severity", "").upper()
                if severity == "CRITICAL":
                    critical_count += 1
                elif severity == "HIGH":
                    high_count += 1
                elif severity == "MEDIUM":
                    medium_count += 1
                elif severity == "LOW":
                    low_count += 1
    
    # Calculate security score with SEPARATED weights for code vs image vulns
    # Code vulnerabilities (Bandit SAST) — full weight
    bandit_high = high_count - sum(
        1 for r in (trivy_data or {}).get("Results", [])
        for v in (r.get("Vulnerabilities", []) or [])
        if v.get("Severity", "").upper() == "HIGH"
    ) if trivy_data else high_count
    bandit_medium = medium_count - sum(
        1 for r in (trivy_data or {}).get("Results", [])
        for v in (r.get("Vulnerabilities", []) or [])
        if v.get("Severity", "").upper() == "MEDIUM"
    ) if trivy_data else medium_count
    bandit_low = low_count - sum(
        1 for r in (trivy_data or {}).get("Results", [])
        for v in (r.get("Vulnerabilities", []) or [])
        if v.get("Severity", "").upper() == "LOW"
    ) if trivy_data else low_count
    bandit_high = max(0, bandit_high)
    bandit_medium = max(0, bandit_medium)
    bandit_low = max(0, bandit_low)
    
    trivy_critical = critical_count  # All criticals come from Trivy
    trivy_high = high_count - bandit_high
    trivy_medium = medium_count - bandit_medium
    trivy_low = low_count - bandit_low
    
    code_high_impact = min(25, bandit_high * 8)
    code_medium_impact = min(10, bandit_medium * 3)
    code_low_impact = min(5, bandit_low * 1)
    
    # Image/dependency vulnerabilities (Trivy) — reduced weight (~50%)
    image_critical_impact = min(25, trivy_critical * 10)
    image_high_impact = min(15, trivy_high * 3)
    image_medium_impact = min(8, trivy_medium * 1)
    image_low_impact = min(2, int(trivy_low * 0.5))
    
    total_penalty = (code_high_impact + code_medium_impact + code_low_impact +
                     image_critical_impact + image_high_impact + image_medium_impact + image_low_impact)
    score = 100 - total_penalty
    score = max(0, min(100, score))
    
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
        "mediumCount": medium_count,
        "lowCount": low_count,
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

# ==================== NOTIFICATIONS ROUTES ====================

@app.route("/api/notifications", methods=["GET"])
@jwt_required()
def get_all_notifications():
    """Get all notifications for the current user"""
    notifications = get_notifications()
    unread_count = sum(1 for n in notifications if not n.get("read", False))
    return jsonify({
        "notifications": notifications,
        "unreadCount": unread_count,
        "total": len(notifications)
    })

@app.route("/api/notifications/<notification_id>/read", methods=["POST"])
@jwt_required()
def mark_notification_read(notification_id):
    """Mark a notification as read"""
    notifications = get_notifications()
    for n in notifications:
        if n["id"] == notification_id:
            n["read"] = True
            break
    save_notifications(notifications)
    return jsonify({"success": True})

@app.route("/api/notifications/read-all", methods=["POST"])
@jwt_required()
def mark_all_notifications_read():
    """Mark all notifications as read"""
    notifications = get_notifications()
    for n in notifications:
        n["read"] = True
    save_notifications(notifications)
    return jsonify({"success": True})

@app.route("/api/notifications/<notification_id>", methods=["DELETE"])
@jwt_required()
def delete_notification(notification_id):
    """Delete a notification"""
    notifications = get_notifications()
    notifications = [n for n in notifications if n["id"] != notification_id]
    save_notifications(notifications)
    return jsonify({"success": True})

@app.route("/api/notifications/clear", methods=["DELETE"])
@jwt_required()
def clear_all_notifications():
    """Clear all notifications"""
    save_notifications([])
    return jsonify({"success": True})

# ==================== SETUP STATUS ====================

@app.route("/api/setup/status", methods=["GET"])
@jwt_required()
def get_setup_status():
    """Get platform setup status - checks if repo and policy are configured"""
    config = get_config()
    policy = get_policy()
    
    repo_configured = bool(config.get("github_repo_url", "").strip())
    policy_configured = policy.get("configured", False)
    initial_scan_completed = config.get("initial_scan_completed", False)
    
    # Check if reports exist
    has_bandit_report = os.path.exists(os.path.join(REPORT_DIR, "bandit-report.json"))
    has_trivy_report = os.path.exists(os.path.join(REPORT_DIR, "trivy-report.json"))
    has_decision_report = os.path.exists(os.path.join(REPORT_DIR, "security_decision.json"))
    
    setup_completed = repo_configured and policy_configured and initial_scan_completed
    
    # Get latest decision if available
    latest_decision = None
    if has_decision_report:
        latest_decision = load_json_file("security_decision.json")
    
    return jsonify({
        "setup_completed": setup_completed,
        "repo_configured": repo_configured,
        "policy_configured": policy_configured,
        "initial_scan_completed": initial_scan_completed,
        "has_reports": {
            "bandit": has_bandit_report,
            "trivy": has_trivy_report,
            "decision": has_decision_report
        },
        "latest_decision": latest_decision,
        "config": {
            "repo_url": config.get("github_repo_url", ""),
            "branch": config.get("github_branch", "main")
        }
    })

@app.route("/api/setup/complete", methods=["POST"])
@jwt_required()
def complete_setup():
    """
    Complete the initial setup - configure repo, policy, and trigger first scan.
    This endpoint handles the entire setup flow in one call.
    """
    current_user = get_current_user_info()
    data = request.get_json()
    
    # Validate required fields
    repo_url = data.get("repo_url", "").strip()
    branch = data.get("branch", "main").strip()
    policy_data = data.get("policy", {})
    
    if not repo_url:
        return jsonify({"error": "Repository URL is required"}), 400
    
    # Validate repo URL format
    is_valid, error_msg = validate_repo_url(repo_url)
    if not is_valid:
        return jsonify({"error": error_msg}), 400
    
    # Update config with repo info
    config = get_config()
    config["github_repo_url"] = repo_url
    config["github_branch"] = branch
    config["repo_configured"] = True
    config["updated_at"] = datetime.now().isoformat()
    config["updated_by"] = current_user["username"]
    save_config(config)
    
    # Update policy
    policy = get_policy()
    if policy_data:
        if "minScore" in policy_data:
            policy["minScore"] = max(0, min(100, int(policy_data["minScore"])))
        if "blockCritical" in policy_data:
            policy["blockCritical"] = bool(policy_data["blockCritical"])
        if "blockHigh" in policy_data:
            policy["blockHigh"] = bool(policy_data["blockHigh"])
        if "maxCriticalVulns" in policy_data:
            policy["maxCriticalVulns"] = max(0, int(policy_data["maxCriticalVulns"]))
        if "maxHighVulns" in policy_data:
            policy["maxHighVulns"] = max(0, int(policy_data["maxHighVulns"]))
        if "autoBlock" in policy_data:
            policy["autoBlock"] = bool(policy_data["autoBlock"])
    
    policy["configured"] = True
    policy["updatedAt"] = datetime.now().isoformat()
    policy["updatedBy"] = current_user["username"]
    save_policy(policy)
    
    # Trigger the initial scan with both Bandit and Trivy
    app.logger.info(f"Setup complete - triggering initial scan for {repo_url}")
    
    try:
        result = run_pipeline(
            repo_url=repo_url,
            branch=branch,
            run_trivy=True  # Always run Trivy for initial scan
        )
        
        # Mark initial scan as completed
        config["initial_scan_completed"] = True
        config["setup_completed"] = True
        save_config(config)
        
        return jsonify({
            "success": True,
            "message": "Setup completed successfully",
            "scan_result": result.to_dict()
        })
        
    except Exception as e:
        app.logger.error(f"Initial scan failed: {e}")
        return jsonify({
            "success": False,
            "error": f"Setup completed but initial scan failed: {str(e)}",
            "config_saved": True,
            "policy_saved": True
        }), 500

@app.route("/api/setup/reset", methods=["POST"])
@jwt_required()
def reset_setup():
    """Reset the platform to initial state (for testing/demo purposes)"""
    current_user = get_current_user_info()
    if current_user["role"] != "admin":
        return jsonify({"error": "Admin access required"}), 403
    
    # Reset config
    save_config(DEFAULT_CONFIG)
    
    # Reset policy
    save_policy(DEFAULT_POLICY)
    
    # Clear reports
    report_files = ["bandit-report.json", "trivy-report.json", "security_decision.json"]
    for report in report_files:
        report_path = os.path.join(REPORT_DIR, report)
        if os.path.exists(report_path):
            os.remove(report_path)
    
    # Clear pipeline history
    if os.path.exists(PIPELINES_FILE):
        os.remove(PIPELINES_FILE)
    
    return jsonify({
        "success": True,
        "message": "Platform reset to initial state"
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
    
    # Check if this pipeline just completed and create notifications
    check_and_notify_pipeline_completion(pipeline)
    
    return jsonify(pipeline)

# Track pipelines we've already sent notifications for
_notified_pipelines = set()

def check_and_notify_pipeline_completion(pipeline):
    """Create notification if pipeline just completed"""
    global _notified_pipelines
    
    if not pipeline:
        return
    
    pipeline_id = pipeline.get('id')
    status = pipeline.get('status', '').lower()
    
    # Skip if already notified or not completed
    if pipeline_id in _notified_pipelines:
        return
    if status not in ['success', 'failed']:
        return
    
    # Mark as notified
    _notified_pipelines.add(pipeline_id)
    # Keep set from growing too large
    if len(_notified_pipelines) > 100:
        _notified_pipelines = set(list(_notified_pipelines)[-50:])
    
    security_score = pipeline.get('security_score', 0)
    is_deployable = pipeline.get('is_deployable', False)
    vuln_summary = pipeline.get('vulnerability_summary', {})
    
    if status == 'success':
        if is_deployable:
            add_notification(
                "success",
                "Deployment Approved",
                f"Pipeline passed security checks. Score: {security_score}/100",
                {"pipeline_id": pipeline_id, "security_score": security_score}
            )
        else:
            # Build reason message
            reasons = []
            if security_score < 70:
                reasons.append(f"Score {security_score} below threshold")
            if vuln_summary.get('critical', 0) > 0:
                reasons.append(f"{vuln_summary['critical']} critical vulnerabilities")
            if vuln_summary.get('high', 0) > 5:
                reasons.append(f"{vuln_summary['high']} high severity issues")
            
            reason_text = "; ".join(reasons) if reasons else "Security requirements not met"
            
            add_notification(
                "critical",
                "Deployment Blocked",
                f"Pipeline blocked. {reason_text}. Score: {security_score}/100",
                {"pipeline_id": pipeline_id, "security_score": security_score, "reasons": reasons}
            )
    else:  # failed
        add_notification(
            "warning",
            "Pipeline Failed",
            f"Security scan failed to complete",
            {"pipeline_id": pipeline_id}
        )

@app.route("/api/pipelines/trigger", methods=["POST"])
@jwt_required()
def trigger_pipeline():
    """Manually trigger a new pipeline run"""
    current_user = get_current_user_info()
    full_user = get_full_user_info(current_user["id"])
    config = get_config()
    policy = get_policy()
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
    
    # Enrich pipeline record with user info and policy snapshot
    for i, p in enumerate(pipeline_executor.pipeline_history):
        if p['id'] == pipeline.id:
            pipeline_executor.pipeline_history[i]['triggered_by'] = full_user or current_user
            pipeline_executor.pipeline_history[i]['policy_snapshot'] = {
                "minScore": policy.get("minScore"),
                "blockCritical": policy.get("blockCritical"),
                "blockHigh": policy.get("blockHigh"),
                "maxCriticalVulns": policy.get("maxCriticalVulns"),
                "maxHighVulns": policy.get("maxHighVulns"),
                "autoBlock": policy.get("autoBlock"),
                "capturedAt": datetime.now().isoformat()
            }
            break
    pipeline_executor._save_pipelines()
    
    # Add notification for pipeline trigger
    add_notification(
        "info",
        "Pipeline Triggered",
        f"Security scan started for branch '{branch}' by {current_user['username']}",
        {"pipeline_id": pipeline.id, "branch": branch}
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

# ==================== EXTERNAL REPO SCAN API ====================

# Store for tracking background scan results
_scan_results: Dict[str, dict] = {}

@app.route("/api/scan/trigger", methods=["POST"])
@jwt_required()
def trigger_external_scan():
    """
    Trigger a security scan on an external GitHub repository.
    
    This endpoint accepts a repository URL and branch, clones the repo,
    runs security scans, and returns the results.
    
    Request Body:
        {
            "repo_url": "https://github.com/user/repo",
            "branch": "main",  // optional, defaults to "main"
            "run_trivy": false,  // optional, defaults to false
            "async": false  // optional, if true returns immediately with pipeline_id
        }
    
    Response (sync):
        {
            "success": true,
            "pipeline_id": "abc12345",
            "security_score": 85,
            "is_deployable": true,
            "vulnerability_summary": {...},
            "reports": {...},
            "duration_seconds": 12.5
        }
    
    Response (async):
        {
            "message": "Scan triggered successfully",
            "pipeline_id": "abc12345",
            "status": "running"
        }
    """
    current_user = get_current_user_info()
    data = request.get_json()
    
    if not data:
        return jsonify({
            "success": False,
            "error": "Request body is required"
        }), 400
    
    # Extract and validate parameters
    repo_url = data.get('repo_url', '').strip()
    branch = data.get('branch', 'main').strip()
    run_trivy = data.get('run_trivy', False)
    async_mode = data.get('async', False)
    
    # Validate repo_url
    if not repo_url:
        return jsonify({
            "success": False,
            "error": "repo_url is required"
        }), 400
    
    is_valid, error_msg = validate_repo_url(repo_url)
    if not is_valid:
        return jsonify({
            "success": False,
            "error": error_msg
        }), 400
    
    # Validate branch
    if not branch:
        branch = "main"
    
    # Log the scan request
    app.logger.info(f"Scan triggered by {current_user['username']} for {repo_url} (branch: {branch})")
    
    if async_mode:
        # Run in background and return immediately
        def save_result(result: PipelineResult):
            _scan_results[result.pipeline_id] = result.to_dict()
        
        pipeline_id = run_pipeline_background(
            repo_url=repo_url,
            branch=branch,
            run_trivy=run_trivy,
            callback=save_result
        )
        
        return jsonify({
            "success": True,
            "message": "Scan triggered successfully",
            "pipeline_id": pipeline_id,
            "status": "running",
            "repo_url": repo_url,
            "branch": branch
        }), 202
    
    else:
        # Run synchronously and wait for result
        try:
            result = run_pipeline(
                repo_url=repo_url,
                branch=branch,
                run_trivy=run_trivy
            )
            
            # Store result for later retrieval
            _scan_results[result.pipeline_id] = result.to_dict()
            
            response_data = result.to_dict()
            response_data['triggered_by'] = current_user['username']
            
            status_code = 200 if result.success else 500
            return jsonify(response_data), status_code
            
        except Exception as e:
            app.logger.error(f"Scan failed: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"Scan failed: {str(e)}"
            }), 500


@app.route("/api/scan/trigger/<pipeline_id>", methods=["GET"])
@jwt_required()
def get_scan_result(pipeline_id):
    """
    Get the result of an async scan by pipeline ID.
    
    Response:
        {
            "found": true,
            "result": {...}
        }
    """
    if pipeline_id in _scan_results:
        return jsonify({
            "found": True,
            "result": _scan_results[pipeline_id]
        })
    
    return jsonify({
        "found": False,
        "message": f"No result found for pipeline {pipeline_id}. Scan may still be in progress."
    }), 404


@app.route("/api/scan/validate", methods=["POST"])
@jwt_required()
def validate_scan_input():
    """
    Validate scan input parameters without triggering a scan.
    
    Request Body:
        {
            "repo_url": "https://github.com/user/repo",
            "branch": "main"
        }
    
    Response:
        {
            "valid": true,
            "repo_url": "https://github.com/user/repo",
            "branch": "main"
        }
    """
    data = request.get_json() or {}
    
    repo_url = data.get('repo_url', '').strip()
    branch = data.get('branch', 'main').strip()
    
    errors = []
    
    if not repo_url:
        errors.append("repo_url is required")
    else:
        is_valid, error_msg = validate_repo_url(repo_url)
        if not is_valid:
            errors.append(error_msg)
    
    if not branch:
        errors.append("branch cannot be empty")
    
    if errors:
        return jsonify({
            "valid": False,
            "errors": errors
        }), 400
    
    return jsonify({
        "valid": True,
        "repo_url": repo_url,
        "branch": branch
    })


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
