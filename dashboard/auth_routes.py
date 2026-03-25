"""
auth_routes.py – Blueprint mounted at /api/auth

Routes matching what the frontend expects:
  POST /api/auth/signup              → create account
"""
from __future__ import annotations

import bcrypt
from flask import Blueprint, jsonify, request

auth_bp = Blueprint("auth_bp", __name__)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@auth_bp.route("/signup", methods=["POST"])
def signup():
    """
    Create a new user account.

        Expects JSON:
            email, password, username
            + optional: fullName, organization, roleTitle, phone,
                  defaultRepoUrl, defaultBranch, preferredLanguage, timezone
    """
    from models import User, UserSettings  # noqa: PLC0415
    from database import db               # noqa: PLC0415

    data = request.get_json(force=True, silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    # --- Basic validation ---
    errors: list[str] = []
    if not email:
        errors.append("Email is required")
    if not username or len(username) < 3:
        errors.append("Username must be at least 3 characters")
    if not password or len(password) < 6:
        errors.append("Password must be at least 6 characters")
    if errors:
        return jsonify({"error": errors[0], "errors": errors}), 400

    # --- Uniqueness checks ---
    if User.query.filter(db.func.lower(User.username) == username.lower()).first():
        return jsonify({"error": "Username already exists"}), 409
    if User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify({"error": "Email already registered"}), 409

    # --- Create user ---
    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    new_user = User(
        username=username,
        email=email,
        password_hash=pw_hash,
        role="viewer",
        full_name=(data.get("fullName") or "").strip(),
        organization=(data.get("organization") or "").strip(),
        role_title=(data.get("roleTitle") or "").strip(),
        phone=(data.get("phone") or "").strip(),
        auth_provider="local",
        is_active=True,
    )
    db.session.add(new_user)
    db.session.flush()  # get new_user.id before commit

    # --- Persist settings (language, timezone, default repo) ---
    prefs = {}
    if data.get("preferredLanguage"):
        prefs["preferredLanguage"] = data["preferredLanguage"]
    if data.get("timezone"):
        prefs["timezone"] = data["timezone"]

    repo_prefs = {}
    if data.get("defaultRepoUrl"):
        repo_prefs["defaultRepoUrl"] = data["defaultRepoUrl"]
    if data.get("defaultBranch"):
        repo_prefs["defaultBranch"] = data["defaultBranch"]

    if prefs or repo_prefs:
        settings = UserSettings(user_id=new_user.id)
        profile_data: dict = {}
        profile_data.update(prefs)
        profile_data.update(repo_prefs)
        settings.set_section("profile", profile_data)
        db.session.add(settings)

    db.session.commit()

    return jsonify({
        "message": "Account created successfully! Please sign in.",
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "role": new_user.role,
        },
    }), 201