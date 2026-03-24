"""WSGI entry point – imports the Flask app from dashboard-backend.py.

Gunicorn cannot import modules with hyphens in their name, so this
thin wrapper does the import explicitly using importlib.
"""
import importlib.util
import os

_here = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "dashboard_backend",
    os.path.join(_here, "dashboard-backend.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

app = _mod.app
