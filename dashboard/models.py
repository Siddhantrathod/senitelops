"""
SentinelOps ORM Models
Normalized PostgreSQL schema – replaces all JSON-file persistence.
"""

import json
def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

from datetime import datetime, timezone

from database import db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_json_col(raw, default=None):
    """Safely deserialise a JSON-text column value."""
    if default is None:
        default = {}
    try:
        return json.loads(raw) if raw else default
    except (json.JSONDecodeError, TypeError):
        return default


def _dump_json_col(value, default=None):
    """Serialise a value to a JSON string for storage."""
    if default is None:
        default = "{}"
    return json.dumps(value) if value is not None else default


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
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_login_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=True, onupdate=utcnow)

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
    repositories = db.relationship(
        "UserRepository", backref="user", lazy=True, cascade="all, delete-orphan"
    )
    pipelines = db.relationship(
        "Pipeline", backref="owner", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self, safe=True):
        """Return a JSON-serialisable dict. ``safe=True`` omits the password hash."""
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
            "isActive": self.is_active,
            "lastLoginAt": self.last_login_at.isoformat() if self.last_login_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
        if not safe:
            data["password"] = self.password_hash
        return data

    def __repr__(self):
        return f"<User {self.username!r} role={self.role!r}>"


# ---------------------------------------------------------------------------
# User repository (one per repo per user — user's personal repo list)
# ---------------------------------------------------------------------------

class UserRepository(db.Model):
    __tablename__ = "user_repositories"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=False, default="")
    url = db.Column(db.String(500), nullable=False)
    branch = db.Column(db.String(100), nullable=False, default="main")
    description = db.Column(db.String(300), default="")
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=True, onupdate=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "url": self.url,
            "branch": self.branch,
            "description": self.description or "",
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<UserRepository {self.name!r} user={self.user_id}>"

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

    def __repr__(self):
        return f"<Config repo={self.github_repo_url!r}>"


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
    block_on_secrets = db.Column(db.Boolean, default=True)
    block_on_dast_high = db.Column(db.Boolean, default=False)
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
            "blockOnSecrets": self.block_on_secrets,
            "blockOnDastHigh": self.block_on_dast_high,
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

    def __repr__(self):
        return f"<Policy min_score={self.min_score} block_critical={self.block_critical}>"


# ---------------------------------------------------------------------------
# Notification  (user-facing system notifications only)
# ---------------------------------------------------------------------------

class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.String(8), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    type = db.Column(db.String(20), nullable=False)          # info / success / warning / critical
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    _extra_data = db.Column("extra_data", db.Text, default="{}")
    read = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    # ---- JSON helper for extra_data ----

    @property
    def extra_data(self):
        return _load_json_col(self._extra_data)

    @extra_data.setter
    def extra_data(self, value):
        self._extra_data = _dump_json_col(value)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "extra_data": self.extra_data,
            "read": self.read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Notification {self.id!r} type={self.type!r} read={self.read}>"


# ---------------------------------------------------------------------------
# Email OTP (signup verification)
# ---------------------------------------------------------------------------

class EmailOTP(db.Model):
    __tablename__ = "email_otps"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    email = db.Column(db.String(120), nullable=False, index=True)
    purpose = db.Column(db.String(50), nullable=False, default="signup", index=True)
    otp_hash = db.Column(db.String(128), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, nullable=False, default=False, index=True)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    def __repr__(self):
        return f"<EmailOTP {self.email!r} purpose={self.purpose!r} used={self.used}>"


# ---------------------------------------------------------------------------
# Pipeline  (one row per pipeline run)
# ---------------------------------------------------------------------------

class Pipeline(db.Model):
    __tablename__ = "pipelines"

    id = db.Column(db.String(8), primary_key=True)
    # Owner — every pipeline belongs to the user who triggered it
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    # Optionally linked to a specific UserRepository
    user_repo_id = db.Column(db.Integer, db.ForeignKey("user_repositories.id"), nullable=True)
    # Report output directory for this specific run (scoped per user + pipeline)
    report_dir = db.Column(db.String(500), nullable=True)
    repo_url = db.Column(db.String(500), default="")
    repo_name = db.Column(db.String(200), default="")
    branch = db.Column(db.String(100), default="main")
    commit_sha = db.Column(db.String(40), default="")
    commit_message = db.Column(db.String(200), default="")
    author = db.Column(db.String(100), default="")
    status = db.Column(db.String(20), default="queued", index=True)
    security_score = db.Column(db.Integer, nullable=True)
    is_deployable = db.Column(db.Boolean, nullable=True)
    _vulnerability_summary = db.Column("vulnerability_summary", db.Text, default="{}")
    _stages = db.Column("stages", db.Text, default="{}")
    _triggered_by = db.Column("triggered_by", db.Text, default="{}")
    _policy_snapshot = db.Column("policy_snapshot", db.Text, default="{}")
    duration_seconds = db.Column(db.Float, nullable=True)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    # Relationships
    scan_results = db.relationship(
        "ScanResult", backref="pipeline", lazy=True, cascade="all, delete-orphan"
    )

    # ---- JSON helpers ----

    @property
    def vulnerability_summary(self):
        return _load_json_col(self._vulnerability_summary)

    @vulnerability_summary.setter
    def vulnerability_summary(self, value):
        self._vulnerability_summary = _dump_json_col(value)

    @property
    def stages(self):
        return _load_json_col(self._stages)

    @stages.setter
    def stages(self, value):
        self._stages = _dump_json_col(value)

    @property
    def triggered_by(self):
        return _load_json_col(self._triggered_by)

    @triggered_by.setter
    def triggered_by(self, value):
        self._triggered_by = _dump_json_col(value)

    @property
    def policy_snapshot(self):
        return _load_json_col(self._policy_snapshot)

    @policy_snapshot.setter
    def policy_snapshot(self, value):
        self._policy_snapshot = _dump_json_col(value)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_repo_id": self.user_repo_id,
            "report_dir": self.report_dir,
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

    def __repr__(self):
        return f"<Pipeline {self.id!r} status={self.status!r}>"


# ---------------------------------------------------------------------------
# Scan result (per scanner per pipeline)
# ---------------------------------------------------------------------------

class ScanResult(db.Model):
    __tablename__ = "scan_results"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    pipeline_id = db.Column(
        db.String(8), db.ForeignKey("pipelines.id"), nullable=False, index=True
    )
    scanner_type = db.Column(db.String(30), nullable=False)  # sast, trivy, gitleaks, dast
    total_findings = db.Column(db.Integer, default=0)
    critical_count = db.Column(db.Integer, default=0)
    high_count = db.Column(db.Integer, default=0)
    medium_count = db.Column(db.Integer, default=0)
    low_count = db.Column(db.Integer, default=0)
    info_count = db.Column(db.Integer, default=0)
    raw_report_path = db.Column(db.String(500), nullable=True)
    _metadata = db.Column("metadata", db.Text, default="{}")
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    @property
    def extra_metadata(self):
        return _load_json_col(self._metadata)

    @extra_metadata.setter
    def extra_metadata(self, value):
        self._metadata = _dump_json_col(value)

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

    def __repr__(self):
        return f"<ScanResult pipeline={self.pipeline_id!r} type={self.scanner_type!r}>"


# ---------------------------------------------------------------------------
# Vulnerability finding
# ---------------------------------------------------------------------------

class Vulnerability(db.Model):
    __tablename__ = "vulnerabilities"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    scan_result_id = db.Column(
        db.Integer, db.ForeignKey("scan_results.id"), nullable=True, index=True
    )
    source = db.Column(db.String(30), nullable=False)       # SAST, Trivy, Gitleaks, DAST
    tool = db.Column(db.String(50), default="")
    severity = db.Column(db.String(20), nullable=False, index=True)
    title = db.Column(db.String(300), default="")
    message = db.Column(db.Text, default="")
    file_path = db.Column(db.String(500), default="")
    line_number = db.Column(db.Integer, default=0)
    rule_id = db.Column(db.String(100), default="")
    language = db.Column(db.String(50), default="")
    vulnerability_id = db.Column(db.String(100), default="")   # CVE etc.
    fixed_version = db.Column(db.String(100), default="")
    url = db.Column(db.String(500), default="")
    cwe_id = db.Column(db.String(50), default="")
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

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

    def __repr__(self):
        return f"<Vulnerability {self.severity!r} {self.source!r}>"


# ---------------------------------------------------------------------------
# Secret finding (Gitleaks)
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
    match = db.Column(db.String(200), default="")    # redacted
    commit = db.Column(db.String(50), default="")
    author = db.Column(db.String(100), default="")
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

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

    def __repr__(self):
        return f"<Secret {self.rule_id!r}>"


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
    updated_at = db.Column(db.DateTime, nullable=True, onupdate=utcnow)

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
        return _load_json_col(getattr(self, attr, None))

    def set_section(self, section: str, data: dict):
        attr = self._SECTION_MAP.get(section)
        if attr is None:
            return
        setattr(self, attr, _dump_json_col(data))
        self.updated_at = utcnow()

    def to_dict(self):
        return {s: self.get_section(s) for s in self._SECTION_MAP}

    def __repr__(self):
        return f"<UserSettings user_id={self.user_id}>"


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
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

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

    def __repr__(self):
        return f"<ApiToken {self.id!r} name={self.name!r}>"


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
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    @property
    def payload(self):
        return _load_json_col(self._payload)

    @payload.setter
    def payload(self, value):
        self._payload = _dump_json_col(value)

    def to_dict(self):
        return {
            "id": self.id,
            "event_type": self.event_type,
            "signature_valid": self.signature_valid,
            "processed": self.processed,
            "result": self.result,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<WebhookLog {self.event_type!r}>"


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
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    @property
    def extra_metadata(self):
        return _load_json_col(self._metadata)

    @extra_metadata.setter
    def extra_metadata(self, value):
        self._metadata = _dump_json_col(value)

    def to_dict(self):
        return {
            "id": self.id,
            "level": self.level,
            "message": self.message,
            "source": self.source,
            "metadata": self.extra_metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<SystemLog {self.level!r}: {self.message[:50]!r}>"

# ---------------------------------------------------------------------------
# Feedback (User submitted feedback to admins)
# ---------------------------------------------------------------------------

class Feedback(db.Model):
    __tablename__ = "feedbacks"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")  # pending, reviewed
    admin_reply = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    replied_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "message": self.message,
            "status": self.status,
            "admin_reply": self.admin_reply,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "replied_at": self.replied_at.isoformat() if self.replied_at else None,
        }

    def __repr__(self):
        return f"<Feedback id={self.id} user_id={self.user_id} status={self.status}>"
