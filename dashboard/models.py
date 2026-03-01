"""
SentinelOps ORM Models
Normalized PostgreSQL schema – replaces all JSON-file persistence.
"""

import json
from datetime import datetime

from database import db


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=True)
    role = db.Column(db.String(20), nullable=False, default="user")
    full_name = db.Column(db.String(150), default="")
    organization = db.Column(db.String(150), default="")
    role_title = db.Column(db.String(100), default="")
    phone = db.Column(db.String(30), default="")
    auth_provider = db.Column(db.String(20), nullable=False, default="local")
    google_id = db.Column(db.String(100), nullable=True, unique=True)
    last_login_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=True, onupdate=datetime.utcnow)

    # Relationships
    settings = db.relationship(
        "UserSettings", backref="user", uselist=False, lazy=True, cascade="all, delete-orphan"
    )
    api_tokens = db.relationship(
        "ApiToken", backref="user", lazy=True, cascade="all, delete-orphan"
    )
    notifications = db.relationship(
        "Notification", backref="user", lazy=True, cascade="all, delete-orphan"
    )

    # ---- helpers ----

    def to_dict(self, safe=True):
        """Return a JSON-serialisable dict.  ``safe=True`` omits the password hash."""
        data = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "fullName": self.full_name or "",
            "organization": self.organization or "",
            "roleTitle": self.role_title or "",
            "phone": self.phone or "",
            "authProvider": self.auth_provider,
            "googleId": self.google_id,
            "lastLoginAt": self.last_login_at.isoformat() if self.last_login_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
        if not safe:
            data["password"] = self.password_hash
        return data

    def __repr__(self):
        return f"<User {self.username}>"


# ---------------------------------------------------------------------------
# System configuration (singleton row, id=1)
# ---------------------------------------------------------------------------

class Config(db.Model):
    __tablename__ = "config"

    id = db.Column(db.Integer, primary_key=True, default=1)
    github_repo_url = db.Column(db.String(500), default="")
    github_branch = db.Column(db.String(100), default="main")
    auto_scan_enabled = db.Column(db.Boolean, default=True)
    scan_on_push = db.Column(db.Boolean, default=True)
    target_image = db.Column(db.String(500), default="")
    target_directory = db.Column(db.String(500), default="")
    setup_completed = db.Column(db.Boolean, default=False)
    repo_configured = db.Column(db.Boolean, default=False)
    policy_configured = db.Column(db.Boolean, default=False)
    initial_scan_completed = db.Column(db.Boolean, default=False)
    git_provider = db.Column(db.String(50), default="github")
    last_webhook_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, nullable=True)
    updated_by = db.Column(db.String(80), nullable=True)

    def to_dict(self):
        return {
            "github_repo_url": self.github_repo_url or "",
            "github_branch": self.github_branch or "main",
            "auto_scan_enabled": self.auto_scan_enabled,
            "scan_on_push": self.scan_on_push,
            "target_image": self.target_image or "",
            "target_directory": self.target_directory or "",
            "setup_completed": self.setup_completed,
            "repo_configured": self.repo_configured,
            "policy_configured": self.policy_configured,
            "initial_scan_completed": self.initial_scan_completed,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "updated_by": self.updated_by,
        }

    @staticmethod
    def get_instance():
        """Return the singleton Config row, creating it if necessary."""
        cfg = db.session.get(Config, 1)
        if cfg is None:
            cfg = Config(id=1)
            db.session.add(cfg)
            db.session.commit()
        return cfg


# ---------------------------------------------------------------------------
# Security policy (singleton row, id=1)
# ---------------------------------------------------------------------------

class Policy(db.Model):
    __tablename__ = "policies"

    id = db.Column(db.Integer, primary_key=True, default=1)
    min_score = db.Column(db.Integer, default=70)
    block_critical = db.Column(db.Boolean, default=True)
    block_high = db.Column(db.Boolean, default=False)
    max_critical_vulns = db.Column(db.Integer, default=0)
    max_high_vulns = db.Column(db.Integer, default=5)
    auto_block = db.Column(db.Boolean, default=True)
    configured = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, nullable=True)
    updated_by = db.Column(db.String(80), nullable=True)

    def to_dict(self):
        return {
            "minScore": self.min_score,
            "blockCritical": self.block_critical,
            "blockHigh": self.block_high,
            "maxCriticalVulns": self.max_critical_vulns,
            "maxHighVulns": self.max_high_vulns,
            "autoBlock": self.auto_block,
            "configured": self.configured,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "updatedBy": self.updated_by,
        }

    @staticmethod
    def get_instance():
        """Return the singleton Policy row, creating it if necessary."""
        pol = db.session.get(Policy, 1)
        if pol is None:
            pol = Policy(id=1)
            db.session.add(pol)
            db.session.commit()
        return pol


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------

class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.String(8), primary_key=True)
    type = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    _extra_data = db.Column("extra_data", db.Text, default="{}")
    read = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.Foreig
    status = db.Column(db.String(20), default="pending", index=True)
    security_score = db.Column(db.Integer, nullable=True)
    is_deployable = db.Column(db.Boolean, nullable=True)
    _vulnerability_summary = db.Column("vulnerability_summary", db.Text, default="{}")
    _stages = db.Column("stages", db.Text, default="{}")
    duration_seconds = db.Column(db.Float, nullable=True)
    _triggered_by = db.Column("triggered_by", db.Text, default="{}")
    _policy_snapshot = db.Column("policy_snapshot", db.Text, default="{}")
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Relationships
    scan_results = db.relationship(
        "ScanResult", backref="pipeline", lazy=True, cascade="all, delete-orphan"
    )

    # ---- JSON helpers for composite columns ----

    @property
    def vulnerability_summary(self):
        try:
            return json.loads(self._vulnerability_summary or "{}")
        except (json.JSONDecodeError, TypeError):
            return {}

    @vulnerability_summary.setter
    def vulnerability_summary(self, value):
        self._vulnerability_summary = json.dumps(value) if value else "{}"

    @property
    def stages(self):
        try:
            return json.loads(self._stages or "{}")
        except (json.JSONDecodeError, TypeError):
            return {}

    @stages.setter
    def stages(self, value):
        self._stages = json.dumps(value) if value else "{}"

    @property
    def triggered_by(self):
        try:
            return json.loads(self._triggered_by or "{}")
        except (json.JSONDecodeError, TypeError):
            return {}

    @triggered_by.setter
    def triggered_by(self, value):
        self._triggered_by = json.dumps(value) if value else "{}"

    @property
    def policy_snapshot(self):
        try:
            return json.loads(self._policy_snapshot or "{}")
        except (json.JSONDecodeError, TypeError):
            return {}

    @policy_snapshot.setter
    def policy_snapshot(self, value):
        self._policy_snapshot = json.dumps(value) if value else "{}"

    def to_dict(self):
        return {
            "id": self.id,
            "repo_url": self.repo_url,
            "repo_name": self.repo_name,
            "branch": self.branch,
            "commit_sha": self.commit_sha,
            "commit_message": self.commit_message,
            "author": self.author,
            "status": self.status,
            "security_score": self.security_score,
            "is_deployable": self.is_deployable,
            "vulnerability_summary": self.vulnerability_summary,
            "stages": self.stages,
            "duration_seconds": self.duration_seconds,
            "triggered_by": self.triggered_by,
            "policy_snapshot": self.policy_snapshot,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Scan result (per scanner per pipeline)
# ---------------------------------------------------------------------------

class ScanResult(db.Model):
    __tablename__ = "scan_results"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    pipeline_id = db.Column(
        db.String(50), db.ForeignKey("pipelines.id"), nullable=False, index=True
    )
    scanner_type = db.Column(db.String(30), nullable=False)  # sast, trivy, gitleaks, dast, bandit
    total_findings = db.Column(db.Integer, default=0)
    critical_count = db.Column(db.Integer, default=0)
    high_count = db.Column(db.Integer, default=0)
    medium_count = db.Column(db.Integer, default=0)
    low_count = db.Column(db.Integer, default=0)
    info_count = db.Column(db.Integer, default=0)
    raw_report_path = db.Column(db.String(500), nullable=True)
    _metadata = db.Column("metadata", db.Text, default="{}")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    @property
    def extra_metadata(self):
        try:
            return json.loads(self._metadata) if self._metadata else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    @extra_metadata.setter
    def extra_metadata(self, value):
        self._metadata = json.dumps(value) if value else "{}"

    def to_dict(self):
        return {
            "id": self.id,
            "pipeline_id": self.pipeline_id,
            "scanner_type": self.scanner_type,
            "total_findings": self.total_findings,
            "critical_count": self.critical_count,
            "high_count": self.high_count,
            "medium_count": self.medium_count,
            "low_count": self.low_count,
            "info_count": self.info_count,
            "raw_report_path": self.raw_report_path,
            "metadata": self.extra_metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Vulnerability finding
# ---------------------------------------------------------------------------

class Vulnerability(db.Model):
    __tablename__ = "vulnerabilities"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    scan_result_id = db.Column(
        db.Integer, db.ForeignKey("scan_results.id"), nullable=True, index=True
    )
    source = db.Column(db.String(30), nullable=False)  # SAST, Trivy, Gitleaks, DAST
    tool = db.Column(db.String(50), default="")
    severity = db.Column(db.String(20), nullable=False, index=True)
    title = db.Column(db.String(300), default="")
    message = db.Column(db.Text, default="")
    file_path = db.Column(db.String(500), default="")
    line_number = db.Column(db.Integer, default=0)
    rule_id = db.Column(db.String(100), default="")
    language = db.Column(db.String(50), default="")
    vulnerability_id = db.Column(db.String(100), default="")  # CVE etc.
    fixed_version = db.Column(db.String(100), default="")
    url = db.Column(db.String(500), default="")
    cwe_id = db.Column(db.String(50), default="")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "source": self.source,
            "tool": self.tool,
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
            "file": self.file_path,
            "line": self.line_number,
            "rule_id": self.rule_id,
            "language": self.language,
            "vulnerability_id": self.vulnerability_id,
            "fixed_version": self.fixed_version,
            "url": self.url,
            "cwe_id": self.cwe_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Secret finding
# ---------------------------------------------------------------------------

class Secret(db.Model):
    __tablename__ = "secrets"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    scan_result_id = db.Column(
        db.Integer, db.ForeignKey("scan_results.id"), nullable=True, index=True
    )
    rule_id = db.Column(db.String(100), nullable=False)
    severity = db.Column(db.String(20), default="HIGH")
    file_path = db.Column(db.String(500), default="")
    line_number = db.Column(db.Integer, default=0)
    match = db.Column(db.String(200), default="")  # redacted
    commit = db.Column(db.String(50), default="")
    author = db.Column(db.String(100), default="")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "rule_id": self.rule_id,
            "severity": self.severity,
            "file": self.file_path,
            "line": self.line_number,
            "match": self.match,
            "commit": self.commit,
            "author": self.author,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Per-user settings (one row per user)
# ---------------------------------------------------------------------------

class UserSettings(db.Model):
    __tablename__ = "user_settings"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    _profile = db.Column("profile", db.Text, default="{}")
    _notifications = db.Column("notifications_prefs", db.Text, default="{}")
    _scan_preferences = db.Column("scan_preferences", db.Text, default="{}")
    _appearance = db.Column("appearance", db.Text, default="{}")
    _debug = db.Column("debug", db.Text, default="{}")
    updated_at = db.Column(db.DateTime, nullable=True, onupdate=datetime.utcnow)

    # Section name → attribute name mapping
    _SECTION_MAP = {
        "profile": "_profile",
        "notifications": "_notifications",
        "scanPreferences": "_scan_preferences",
        "appearance": "_appearance",
        "debug": "_debug",
    }

    def get_section(self, section: str) -> dict:
        attr = self._SECTION_MAP.get(section)
        if attr is None:
            return {}
        raw = getattr(self, attr, None)
        try:
            return json.loads(raw) if raw else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    def set_section(self, section: str, data: dict):
        attr = self._SECTION_MAP.get(section)
        if attr is None:
            return
        setattr(self, attr, json.dumps(data) if data else "{}")
        self.updated_at = datetime.utcnow()

    def to_dict(self):
        return {
            s: self.get_section(s) for s in self._SECTION_MAP
        }


# ---------------------------------------------------------------------------
# API token
# ---------------------------------------------------------------------------

class ApiToken(db.Model):
    __tablename__ = "api_tokens"

    id = db.Column(db.String(8), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False, default="Unnamed Token")
    token_hash = db.Column(db.String(64), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    last_used_at = db.Column(db.DateTime, nullable=True)
    usage_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self, include_hash=False):
        data = {
            "id": self.id,
            "name": self.name,
            "created": self.created_at.isoformat() if self.created_at else None,
            "expires": self.expires_at.isoformat() if self.expires_at else None,
            "lastUsed": self.last_used_at.isoformat() if self.last_used_at else None,
            "usageCount": self.usage_count,
        }
        if include_hash:
            data["tokenHash"] = self.token_hash
        return data


# ---------------------------------------------------------------------------
# Webhook log
# ---------------------------------------------------------------------------

class WebhookLog(db.Model):
    __tablename__ = "webhook_logs"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    event_type = db.Column(db.String(50), nullable=False)
    _payload = db.Column("payload", db.Text, default="{}")
    signature_valid = db.Column(db.Boolean, default=False)
    processed = db.Column(db.Boolean, default=False)
    result = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "event_type": self.event_type,
            "signature_valid": self.signature_valid,
            "processed": self.processed,
            "result": self.result,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# System log
# ---------------------------------------------------------------------------

class SystemLog(db.Model):
    __tablename__ = "system_logs"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    level = db.Column(db.String(20), nullable=False, default="info", index=True)
    message = db.Column(db.Text, nullable=False)
    source = db.Column(db.String(100), default="")
    _metadata = db.Column("metadata", db.Text, default="{}")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    @property
    def extra_metadata(self):
        try:
            return json.loads(self._metadata) if self._metadata else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    @extra_metadata.setter
    def extra_metadata(self, value):
        self._metadata = json.dumps(value) if value else "{}"

    def to_dict(self):
        return {
            "id": self.id,
            "level": self.level,
            "message": self.message,
            "source": self.source,
            "metadata": self.extra_metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
