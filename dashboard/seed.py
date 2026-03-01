#!/usr/bin/env python3
"""
SentinelOps Database Seed Script
Creates default admin user, initial config, and policy rows.

Usage:
    cd dashboard
    python seed.py            # seed only if tables are empty
    python seed.py --force    # drop existing data and re-seed
"""

import os
import sys
import argparse
from datetime import datetime

import bcrypt
from dotenv import load_dotenv

# Load env from project root
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# Minimal Flask app for database context
from flask import Flask

app = Flask(__name__)
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://sentinelops:sentinelops@localhost:5432/sentinelops"
)
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

from database import db, init_db

init_db(app)

from models import (
    User,
    Config,
    Policy,
    Notification,
    UserSettings,
    ApiToken,
    Pipeline,
    ScanResult,
    Vulnerability,
    Secret,
    WebhookLog,
    SystemLog,
)


def seed_users():
    """Create the default admin and a sample viewer account."""
    if User.query.first():
        print("  [skip] Users table already has data")
        return

    admin = User(
        username="admin",
        email="admin@sentinelops.io",
        password_hash=bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        role="admin",
        full_name="System Administrator",
        organization="SentinelOps",
        role_title="Platform Admin",
        phone="",
        auth_provider="local",
    )
    viewer = User(
        username="viewer",
        email="viewer@sentinelops.io",
        password_hash=bcrypt.hashpw("viewer123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        role="viewer",
        full_name="Demo Viewer",
        organization="SentinelOps",
        role_title="Security Analyst",
        phone="",
        auth_provider="local",
    )
    db.session.add_all([admin, viewer])
    db.session.commit()
    print("  [ok]   Seeded 2 users (admin / viewer)")


def seed_config():
    """Create the singleton Config row with defaults."""
    if db.session.get(Config, 1):
        print("  [skip] Config row already exists")
        return

    cfg = Config(
        id=1,
        github_repo_url="",
        github_branch="main",
        auto_scan_enabled=True,
        scan_on_push=True,
        target_image="",
        target_directory="",
        setup_completed=False,
        repo_configured=False,
        policy_configured=False,
        initial_scan_completed=False,
    )
    db.session.add(cfg)
    db.session.commit()
    print("  [ok]   Seeded default Config")


def seed_policy():
    """Create the singleton Policy row with defaults."""
    if db.session.get(Policy, 1):
        print("  [skip] Policy row already exists")
        return

    pol = Policy(
        id=1,
        min_score=70,
        block_critical=True,
        block_high=False,
        max_critical_vulns=0,
        max_high_vulns=5,
        auto_block=True,
        configured=False,
    )
    db.session.add(pol)
    db.session.commit()
    print("  [ok]   Seeded default Policy")


def seed_sample_notifications():
    """Create a few sample notifications so the dashboard isn't empty."""
    if Notification.query.first():
        print("  [skip] Notifications already exist")
        return

    import uuid
    import json

    samples = [
        ("info", "Welcome to SentinelOps", "Your security platform is ready. Configure your repository to get started."),
        ("success", "Database Migrated", "Successfully migrated from JSON storage to PostgreSQL."),
    ]
    for ntype, title, message in samples:
        n = Notification(
            id=str(uuid.uuid4())[:8],
            type=ntype,
            title=title,
            message=message,
            read=False,
        )
        n.metadata = {}
        db.session.add(n)

    db.session.commit()
    print(f"  [ok]   Seeded {len(samples)} sample notifications")


def force_reset():
    """Drop all data (not schema) and re-seed."""
    print("  [!]    Truncating all tables…")
    for model in [
        SystemLog, WebhookLog, ApiToken, UserSettings, Secret,
        Vulnerability, ScanResult, Pipeline, Notification, Policy, Config, User,
    ]:
        model.query.delete()
    db.session.commit()
    print("  [ok]   All tables truncated")


def main():
    parser = argparse.ArgumentParser(description="Seed the SentinelOps database")
    parser.add_argument("--force", action="store_true", help="Truncate tables before seeding")
    args = parser.parse_args()

    with app.app_context():
        print("\n🌱  SentinelOps Database Seeder")
        print(f"    Database: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}\n")

        if args.force:
            force_reset()

        seed_users()
        seed_config()
        seed_policy()
        seed_sample_notifications()

        print("\n✅  Seeding complete!\n")


if __name__ == "__main__":
    main()
