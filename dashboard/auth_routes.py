"""
auth_routes.py – Blueprint mounted at /api/auth

Routes matching what the frontend expects:
  POST /api/auth/signup/request-otp  → send OTP email
  POST /api/auth/signup              → create account (verifies OTP inline)
"""
from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from flask import Blueprint, current_app, jsonify, request

auth_bp = Blueprint("auth_bp", __name__)

# ---------------------------------------------------------------------------
# Resend email helper
# ---------------------------------------------------------------------------

def _send_resend_email(to: str, subject: str, html: str) -> bool:
    api_key = os.getenv("RESEND_API_KEY", "")
    email_from = os.getenv("EMAIL_FROM", "onboarding@resend.dev")

    if not api_key:
        current_app.logger.error("RESEND_API_KEY is not set – cannot send email")
        return False

    try:
        import resend  # type: ignore
        resend.api_key = api_key
        result = resend.Emails.send({
            "from": email_from,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        current_app.logger.info("Resend OK to %s: %s", to, result)
        return True
    except Exception as exc:
        current_app.logger.error("Resend FAILED to %s: %s", to, exc)
        return False


# ---------------------------------------------------------------------------
# OTP helpers – use the EmailOTP DB model (imported lazily to avoid circular
# imports since models are loaded after the app is created)
# ---------------------------------------------------------------------------

OTP_EXPIRY_MINUTES = int(os.getenv("EMAIL_OTP_EXPIRY_MINUTES", "10"))
OTP_COOLDOWN_SECONDS = int(os.getenv("EMAIL_OTP_COOLDOWN_SECONDS", "60"))
OTP_MAX_ATTEMPTS = 5


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _otp_hash(email: str, code: str) -> str:
    seed = f"{email.lower()}:{code}:{os.getenv('JWT_SECRET_KEY', 'sentinelops-secret')}"
    return hashlib.sha256(seed.encode()).hexdigest()


def _issue_otp(email: str) -> tuple[bool, str]:
    from models import EmailOTP  # noqa: PLC0415
    from database import db      # noqa: PLC0415

    normalized = email.strip().lower()

    # Cooldown check
    recent = (
        EmailOTP.query
        .filter_by(email=normalized, purpose="signup")
        .order_by(EmailOTP.created_at.desc())
        .first()
    )
    if recent:
        elapsed = (_utcnow() - recent.created_at).total_seconds()
        if elapsed < OTP_COOLDOWN_SECONDS:
            wait = max(1, OTP_COOLDOWN_SECONDS - int(elapsed))
            return False, f"Please wait {wait}s before requesting another OTP"

    code = f"{secrets.randbelow(1_000_000):06d}"
    otp_row = EmailOTP(
        email=normalized,
        purpose="signup",
        otp_hash=_otp_hash(normalized, code),
        expires_at=_utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        used=False,
        attempts=0,
    )
    db.session.add(otp_row)
    db.session.commit()

    sent = _send_resend_email(
        normalized,
        "Your SentinelOps Verification Code",
        f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#10b981">SentinelOps Email Verification</h2>
          <p>Your one-time verification code is:</p>
          <h1 style="letter-spacing:8px;color:#111;background:#f3f4f6;
                     padding:16px 24px;border-radius:8px;display:inline-block">{code}</h1>
          <p>This code expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>.</p>
          <p style="color:#888;font-size:12px">If you didn't request this, ignore this email.</p>
        </div>
        """,
    )

    if not sent:
        # Roll back the DB row so the user can retry immediately
        db.session.delete(otp_row)
        db.session.commit()
        return False, "OTP could not be delivered. Check that RESEND_API_KEY and EMAIL_FROM are set correctly in Railway."

    return True, "OTP sent successfully"


def _verify_otp(email: str, code: str) -> tuple[bool, str]:
    from models import EmailOTP  # noqa: PLC0415
    from database import db      # noqa: PLC0415

    normalized = email.strip().lower()
    code = code.strip()

    otp_row = (
        EmailOTP.query
        .filter_by(email=normalized, purpose="signup", used=False)
        .order_by(EmailOTP.created_at.desc())
        .first()
    )
    if not otp_row:
        return False, "No OTP found. Please request a new one."
    if otp_row.expires_at < _utcnow():
        return False, "OTP expired. Please request a new one."

    otp_row.attempts = int(otp_row.attempts or 0) + 1
    if otp_row.attempts > OTP_MAX_ATTEMPTS:
        db.session.commit()
        return False, "Too many attempts. Please request a new OTP."

    if otp_row.otp_hash != _otp_hash(normalized, code):
        db.session.commit()
        return False, "Invalid OTP."

    otp_row.used = True
    db.session.commit()
    return True, "OTP verified"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@auth_bp.route("/signup/request-otp", methods=["POST"])
def request_signup_otp():
    """Send a 6-digit OTP to the given email for signup verification."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    ok, msg = _issue_otp(email)
    if not ok:
        return jsonify({"error": msg}), 429 if "wait" in msg else 500

    return jsonify({"message": msg}), 200


@auth_bp.route("/signup", methods=["POST"])
def signup():
    """
    Create a new user account.

    Expects JSON:
      email, password, username, otp (6-digit code)
      + optional: fullName, organization, roleTitle, phone,
                  defaultRepoUrl, defaultBranch, preferredLanguage, timezone
    """
    from models import User, UserSettings  # noqa: PLC0415
    from database import db               # noqa: PLC0415

    data = request.get_json(silent=True) or {}

    email    = (data.get("email") or "").strip().lower()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    otp_code = (data.get("otp") or "").strip()

    # --- Basic validation ---
    errors: list[str] = []
    if not email:
        errors.append("Email is required")
    if not username or len(username) < 3:
        errors.append("Username must be at least 3 characters")
    if not password or len(password) < 6:
        errors.append("Password must be at least 6 characters")
    if not otp_code or len(otp_code) != 6:
        errors.append("A 6-digit OTP is required")
    if errors:
        return jsonify({"error": errors[0], "errors": errors}), 400

    # --- Verify OTP ---
    otp_ok, otp_msg = _verify_otp(email, otp_code)
    if not otp_ok:
        return jsonify({"error": otp_msg}), 400

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
        role="user",
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
        settings_data: dict = {}
        if prefs:
            settings_data["profile"] = prefs
        if repo_prefs:
            settings_data["repository"] = repo_prefs

        settings = UserSettings(user_id=new_user.id, settings=settings_data)
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