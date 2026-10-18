# Running locally (Windows PowerShell)

This guide keeps development data under `backend/.devdata/` (git-ignored) so the default
`backend/repcarparts.db` and `backend/uploads` are never touched.

## 1. Backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1          # or: python -m venv venv; pip install -r requirements.txt

# once: create a secret
python -c "import secrets;print(secrets.token_urlsafe(48))"

$env:JWT_SECRET    = "<generated secret>"
$env:DATABASE_PATH = "$PWD\.devdata\repcarparts.db"
$env:UPLOAD_DIR    = "$PWD\.devdata\uploads"

uvicorn app.main:app --reload --port 8000
```

On startup the schema is migrated automatically (existing rows are preserved).
Check: <http://127.0.0.1:8000/health> and the interactive docs at <http://127.0.0.1:8000/docs>.

To make a throw-away dev copy of an existing database (once; skip this for a clean start,
the server creates an empty, fully migrated database on first launch):

```powershell
mkdir backend\.devdata\uploads -Force
Copy-Item backend\repcarparts.db backend\.devdata\repcarparts.db
Copy-Item backend\uploads\* backend\.devdata\uploads\
```

## 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The API base URL is `VITE_API_URL`
(default `http://127.0.0.1:8000`); the origin must be in `CORS_ORIGINS`.

## 3. Lock / reset the legacy `aa` account

The old default `aa/aa` account is locked automatically at startup if its password is still
`aa` (it gets `must_change_password` and cannot log in). To give it (or any user) a real
password:

```powershell
cd backend
python -m app.cli set-password aa
```

The command prompts twice without echo. Log in afterwards; if `must_change_password` is set the
UI asks you to choose a new password.

Alternative one-time bootstrap through the environment (remove afterwards):

```powershell
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "<strong password>"
```

## 4. Tests

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest            # whole suite
.\venv\Scripts\python.exe -m pytest tests\test_records.py -k csv
```

The suite sets `APP_ENV=dev`, a test `JWT_SECRET`, and temporary `DATABASE_PATH` / `UPLOAD_DIR`
itself; it needs no servers running and does not touch `.devdata`.

## Troubleshooting

- *Server refuses to start*: `JWT_SECRET` is missing or shorter than 32 characters (or set `APP_ENV=dev`).
- *CORS errors in the browser*: add the frontend origin to `CORS_ORIGINS`.
- *Login returns 429*: wait a minute; login is rate limited.
