# Repcarparts

Repcarparts is a full-stack web app for tracking vehicle maintenance: cars, service
records with receipt photos, replaced parts, costs and upcoming service reminders.

## Features

- Accounts with roles: `user` and `manager`; JWT authentication
- Cars: create, edit, delete
- Service records: create, edit, delete, receipt photo (replace / remove), filter and search
  (text, type, year, date range), newest first
- CSV export of the (filtered) service history, Excel-friendly with Hebrew support
- Maintenance status per item based on both date and mileage: ok / due soon / overdue / unknown
- Garage overview: one call for the home screen with per-car odometer, last service, spend and worst status
- Expenses: totals, per treatment type, per month, per year
- Reminders: managers broadcast or target users (optionally for a specific car); users add their
  own reminders, mark them done or delete them
- Manager area: users list, statistics, average part costs
- Manual odometer with consistency warnings (readings that go backwards, implausible distances,
  duplicates) - warnings never block saving
- Future-dated services are saved as "Scheduled" and only count for maintenance status once their date arrives
- Security hardening: strong-secret enforcement, rate-limited login, validated image uploads,
  token invalidation on password change, no default admin account

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy, SQLite, Alembic migrations |
| Auth | JWT (python-jose), passlib password hashes |
| Frontend | React 19, React Router, Vite |
| Tests | pytest + FastAPI TestClient (backend), Vitest + Testing Library (frontend) |

The API contract lives in [docs/API_CONTRACT.md](docs/API_CONTRACT.md); design notes in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); a step-by-step local run in
[docs/RUNNING.md](docs/RUNNING.md).

## Quick start (Windows PowerShell)

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# generate a secret once
python -c "import secrets;print(secrets.token_urlsafe(48))"

$env:JWT_SECRET    = "<paste the generated secret>"
$env:DATABASE_PATH = "$PWD\.devdata\repcarparts.db"   # optional, default backend/repcarparts.db
$env:UPLOAD_DIR    = "$PWD\.devdata\uploads"          # optional, default backend/uploads
uvicorn app.main:app --reload --port 8000
```

Database migrations (Alembic) are applied automatically on startup.
For local development without a secret you may set `$env:APP_ENV = "dev"`.
All variables are listed in [.env.example](.env.example).

### Clean development database

Nothing needs to be created by hand: when `DATABASE_PATH` points to a file that does not exist,
the server creates it and applies all Alembic migrations on startup. Use a git-ignored folder:

```powershell
cd backend
New-Item -ItemType Directory .devdata\uploads -Force
$env:DATABASE_PATH = "$PWD\.devdata\repcarparts.db"
$env:UPLOAD_DIR    = "$PWD\.devdata\uploads"
$env:ADMIN_USERNAME = "admin"; $env:ADMIN_PASSWORD = "<strong password>"   # first start only
uvicorn app.main:app --port 8000
```

Log in as that admin (you are asked to choose a new password), then register normal users in
the UI. To start over, stop the server and delete `.devdata`. The default location
(`backend/repcarparts.db`, `backend/uploads`) is also git-ignored.

### Admin / manager account

There is no default account. Set (or reset) a manager password with the CLI:

```powershell
cd backend
python -m app.cli set-password <username>
```

It prompts for the password without echo and never prints it. If a legacy `aa` account with a
weak password is found in an existing database it is locked automatically
(`must_change_password`) and must be reset with the command above. Data is never deleted.

A user flagged `must_change_password` (the env-bootstrapped admin, or a locked legacy `aa`) can only
call `GET /me` and `PUT /me/password` until a new password is set; everything else returns
`403 password_change_required` and the UI routes to the change-password screen.
Usernames are not case-sensitive for new registrations.

### Frontend

Requires **Node 20.19+ or 22.12+** (Vite 7). On older Node, `npm run dev` fails with
`crypto.hash is not a function`; `npm run build` + `npx vite preview` still work.

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173
# or, a production build:
npm run build
npx vite preview --port 4173    # http://localhost:4173 (add it to CORS_ORIGINS)
```

Set `VITE_API_URL` (default `http://127.0.0.1:8000`) in `frontend/.env` if the API runs elsewhere.

## Tests

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest
```

```powershell
cd frontend
npm test           # vitest
npm run lint
```

Backend tests use a temporary database and upload folder and set their own environment, so they never
touch your data. See `backend/tests/`.

## Known behaviour worth knowing

- Costs of future-dated ("Scheduled") services are currently included in expense totals, although
  they do not count for maintenance status. See
  [docs/FUTURE_DATED_COSTS.md](docs/FUTURE_DATED_COSTS.md) for the recommended change.

## Project structure

```
backend/
  app/            FastAPI application (routers, models, schemas, config, CLI)
  alembic/        database migrations
  tests/          pytest suite (written against docs/API_CONTRACT.md)
  requirements.txt
frontend/
  src/            React app
docs/             API contract, architecture, running guide
.env.example      configuration reference
```

## Security notes

- Keep `JWT_SECRET` secret, at least 32 random characters; the server refuses to start without
  it unless `APP_ENV=dev`.
- Passwords are stored hashed; changing a password invalidates all earlier tokens.
- Login is rate limited; registration validates username and password strength.
- Uploads: JPEG, PNG or WebP only, max 5 MB, content-sniffed, stored under random UUID names.
- Database files, uploads and `.env` are git-ignored. Never commit real user data.
- Restrict `CORS_ORIGINS` to your real frontend origin(s) in production and serve over HTTPS.
