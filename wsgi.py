import sys
import os

# Add dashboard/ to path so bare imports (auth_routes, database, models, pipeline) all resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "dashboard"))

from dashboard.app import app  # noqa

if __name__ == "__main__":
    app.run()
```

### Fix 2 — Fix the Procfile
```
web: gunicorn wsgi:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120