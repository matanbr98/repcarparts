# 🚗 repcarparts
Repcarparts is a full-stack web application that helps users track vehicle maintenance, manage replaced car parts, and maintain a complete service history.

Keeping service paperwork, receipts and mileage in one place is easy to neglect. Repcarparts gives each owner a personal garage: add your cars, log every service with its cost and receipt photo, and see at a glance which maintenance items are due. Managers can additionally send reminders to users and view usage statistics.

## ✨ Features
- **Garage dashboard** – all cars on one screen with odometer, last service, total spend and the most urgent maintenance status
- **Vehicle management** – add, edit and delete cars; manual odometer updates
- **Service history & timeline** – add, edit and delete service records with replaced parts, notes and costs; filter and search by text, type, year or date range
- **Maintenance status** – per item, based on both date and mileage: ok / due soon / overdue / unknown
- **Odometer consistency warnings** – readings that go backwards, implausible distances and duplicates are flagged (warnings never block saving)
- **Expenses & reports** – totals per treatment type, month and year with a spend chart, plus CSV export of the (filtered) service history
- **Receipts** – attach, replace, remove and preview receipt photos
- **Reminders** – managers can broadcast or target reminders to users (optionally per car); users can add their own, mark them done or delete them
- **Manager area** – users list, statistics and average part costs
- **Accounts & roles** – registration/login with `user` and `manager` roles, profile picture and password change
- **Responsive UI** – redesigned interface with the Repcarparts logo

## 🛠 Tech Stack
- **Backend:** FastAPI (Python), SQLAlchemy, Alembic migrations
- **Frontend:** React 19, React Router, Vite
- **Storage:** SQLite database file + local folder for uploaded receipts
- **Auth:** JWT (python-jose), hashed passwords (passlib), role-based authorization
- **Tests:** pytest (backend), Vitest + Testing Library (frontend), ESLint

## 🏗 Architecture
The React single-page app talks to the FastAPI REST API over HTTP using a JWT bearer token. The API validates input, applies the maintenance and odometer logic, and persists data with SQLAlchemy to SQLite; the schema is managed by Alembic migrations that run automatically on startup. Receipt images are validated and stored on the local filesystem.

Further details: [API contract](docs/API_CONTRACT.md) · [Architecture notes](docs/ARCHITECTURE.md) · [Local run guide](docs/RUNNING.md)

## 📦 Project Structure

```
backend/      FastAPI app (app/), Alembic migrations (alembic/), tests (tests/)
frontend/     React + Vite app (src/)
docs/         API contract, architecture, run guide
.env.example  backend configuration reference
```

## 🚀 Getting Started

**Prerequisites:** Python 3.10+, Node.js 20.19+ or 22.12+, Git.

```bash
git clone https://github.com/matanbr98/repcarparts.git
cd repcarparts
```

### Backend
From `backend/`:
```bash
python -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Configure it with environment variables. The backend reads the process environment (it does not load `.env` files by itself), so export the values listed in [`.env.example`](.env.example). `JWT_SECRET` (at least 32 characters) is required unless `APP_ENV=dev`:

```bash
export JWT_SECRET="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
export CORS_ORIGINS="http://localhost:5173"
# PowerShell: $env:JWT_SECRET = "<generated secret>"
```

Start the API (default `http://127.0.0.1:8000`):
```bash
uvicorn app.main:app --reload
```

**Clean development database:** nothing has to be created by hand. If the file at `DATABASE_PATH` (default `backend/repcarparts.db`) does not exist, it is created and all migrations are applied at startup. To use a throwaway database, point `DATABASE_PATH` and `UPLOAD_DIR` at a git-ignored folder such as `backend/.devdata/` and delete it to start over.

**First manager account:** there is no default account. Create or reset one with the CLI (prompts for the password, never prints it):
```bash
python -m app.cli set-password <username>
```
Alternatively set `ADMIN_USERNAME` and `ADMIN_PASSWORD` for the first start only. Regular users can register in the UI.

### Frontend
From `frontend/`:
```bash
npm install
npm run dev
```
The app runs at `http://localhost:5173`. If the API is elsewhere, set `VITE_API_URL` in `frontend/.env` (see `frontend/.env.example`).

## 🧪 Tests
Backend, from `backend/` (with the virtual environment active):
```bash
pip install -r requirements-dev.txt
python -m pytest
```
Frontend, from `frontend/`:
```bash
npm test
npm run lint
npm run build
```
Backend tests use a temporary database and upload folder, so they never touch your data.

## 🔒 Security Notes
- Passwords are hashed; changing a password invalidates earlier tokens; login is rate limited.
- Uploads accept JPEG, PNG or WebP only (max 5 MB), are content-checked and stored under random names.
- Databases, uploads, virtual environments and `.env` files are git-ignored. Never commit real user data or secrets.
- This is a local/portfolio project; if you deploy it, restrict `CORS_ORIGINS` and serve it over HTTPS.

## ℹ️ Known Behaviour
Costs of future-dated ("Scheduled") services are currently included in expense totals although they do not count for maintenance status. See [docs/FUTURE_DATED_COSTS.md](docs/FUTURE_DATED_COSTS.md).
