"""
Flask-Migrate / Alembic configuration entry-point.

Usage (from the dashboard/ directory):
    flask --app migrate_config db init          # one-time: create migrations/
    flask --app migrate_config db migrate -m "initial"   # generate migration
    flask --app migrate_config db upgrade       # apply migration
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from flask import Flask

app = Flask(__name__)

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://sentinelops:sentinelops@localhost:5432/sentinelops"
)
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

from database import db, migrate  # noqa: E402

db.init_app(app)
migrate.init_app(app, db)

# Import all models so Alembic detects them
import models  # noqa: F401, E402
