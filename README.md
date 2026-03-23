# SentinelOps

**SentinelOps** is a DevSecOps security scanning platform that runs automated security scans on GitHub repositories and displays results through a rich web dashboard.

## Features

- **SAST** — Static analysis via Bandit (Python) and Semgrep (multi-language)
- **Secret detection** — Gitleaks scans for hardcoded secrets
- **Container/FS scanning** — Trivy for Docker images and filesystem
- **DAST** — OWASP ZAP dynamic scanning
- **Policy enforcement** — Configurable score thresholds and blocking rules
- **Dashboard** — React web UI with pipeline history, reports, admin panel
- **Auth** — JWT, bcrypt passwords, Google OAuth 2.0, role-based access (admin/user/viewer)

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Python 3.10+ | Backend |
| Node.js 18+ | Frontend |
| PostgreSQL 14+ | Database |
| `bandit`, `semgrep` | SAST tools — `pip install bandit semgrep` |
| `gitleaks` | Secret scanner — [install](https://github.com/gitleaks/gitleaks#installing) |
| `trivy` | Container scanner — [install](https://aquasecurity.github.io/trivy/latest/getting-started/installation/) |
| Docker (optional) | Required for image scanning |

---

## Setup

### 1. Clone & configure

```bash
git clone <repo-url>
cd SENITELOPS

# Copy and edit environment variables
cp .env.example .env
# Edit .env: set JWT_SECRET_KEY, DATABASE_URL, GOOGLE_CLIENT_ID, etc.
```

### 2. Create the PostgreSQL database

```bash
psql -U postgres -c "CREATE USER sentinelops WITH PASSWORD 'sentinelops';"
psql -U postgres -c "CREATE DATABASE sentinelops OWNER sentinelops;"
```

### 3. Install Python dependencies & run migrations

```bash
pip install -r requirements.txt

cd dashboard
flask --app migrate_config db upgrade   # apply migrations
python seed.py                          # seed default admin + config
```

### 4. Start the backend

```bash
cd dashboard
python3 dashboard-backend.py
# Backend runs on http://localhost:5000
```

### 5. Start the frontend

```bash
cd dashboard/frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173 (or 3000)
```

---

## Default Credentials (after seeding)

| User | Password | Role |
|------|----------|------|
| `admin` | `admin123` | Admin |
| `viewer` | `viewer123` | Viewer |

> ⚠️ Change these immediately in any shared or production environment.

---

## Architecture

```
GitHub Webhook / Manual Trigger
        ↓
pipeline_executor.py (8 stages)
  clone → docker build → SAST → Gitleaks → Trivy → DAST → policy eval → decision
        ↓
Flask REST API (dashboard-backend.py) + PostgreSQL
        ↓
React Dashboard (dashboard/frontend/)
```

### Directory structure

```
SENITELOPS/
├── .env.example             # Environment variable template
├── requirements.txt         # Python dependencies
├── security_decision_engine.py  # Standalone CLI decision engine
├── config/config.json       # Local config (repo URL, branch)
├── pipeline/                # Scanning pipeline module
│   ├── pipeline_executor.py # Main orchestrator
│   ├── sast_scanner.py      # Bandit + Semgrep
│   ├── gitleaks_scanner.py  # Secret detection
│   └── dast_scanner.py      # ZAP DAST
├── dashboard/
│   ├── dashboard-backend.py # Flask REST API
│   ├── models.py            # SQLAlchemy ORM models
│   ├── database.py          # DB + migration setup
│   ├── seed.py              # DB seeder
│   ├── migrate_config.py    # Alembic migration entry-point
│   ├── migrations/          # Alembic migration scripts
│   └── frontend/            # React/Vite frontend
└── runtime/
    ├── reports/             # Scanner output JSON files
    └── history/             # Pipeline run history
```

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET_KEY` | Secret for JWT signing — **must change in production** |
| `DATABASE_URL` | PostgreSQL connection string |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed origins |
| `FRONTEND_URL` | Frontend base URL (used for OAuth redirects) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GITHUB_WEBHOOK_SECRET` | HMAC secret for GitHub webhook verification |

---

## Contributing

1. Create a feature branch
2. Run `python -m py_compile dashboard/models.py dashboard/dashboard-backend.py` before committing
3. Submit a PR
