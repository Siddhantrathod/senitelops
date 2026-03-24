"""
SentinelOps Database Configuration
SQLAlchemy + Flask-Migrate setup for PostgreSQL
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()


def init_db(app):
    """Initialize database and migration engine with the Flask app."""
    db.init_app(app)
    migrate.init_app(app, db)

    with app.app_context():
        import models  # noqa: F401
        # Auto-create any tables that don't exist yet.
        # Safe to call repeatedly — only creates missing tables, never drops existing ones.
        db.create_all()
