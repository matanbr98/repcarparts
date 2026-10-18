# Architecture

## Overview

```
React (Vite)  --HTTP/JSON, Bearer JWT-->  FastAPI  --SQLAlchemy-->  SQLite file
                                              |
                                              +--> UPLOAD_DIR (receipt / profile images, served at /uploads/*)
```

- **Frontend** (`frontend/src`): React SPA. Stores the token, sends `Authorization: Bearer`,
  and on any 401 clears the session and redirects to `/login`.
- **Backend** (`backend/app`): FastAPI app exposing the endpoints in `docs/API_CONTRACT.md`.
  Configuration comes only from environment variables (contract section 9).
- **Database**: SQLite via SQLAlchemy. Schema changes are Alembic migrations, additive only;
  startup upgrades legacy databases in place without deleting rows.

## Data model

| Table | Purpose |
|---|---|
| `users` | accounts, `role` (`user`/`manager`), `must_change_password`, `pwd_version` |
| `cars` | vehicles, owned by a user |
| `service_records` | service history per car; `treatment_type` drives maintenance status |
| `reminders` | manager-created or self-created, optional car, `done`, `source` |

## Key rules

- **Ownership**: users see only their own cars, records and reminders; managers see all.
  Record routes are always checked against the car in the path.
- **Auth**: JWT claims `sub`, `role`, `iat`, `exp`, `pwd_v`. Role is re-read from the database;
  `pwd_v` must match the user's `pwd_version`, so a password change invalidates old tokens.
- **Errors**: every non-2xx returns `{"error": {"code", "message", "fields?"}, "detail"}`.
- **Uploads**: type sniffed from content, 5 MB cap, UUID filenames, old files deleted when a
  receipt is replaced or removed.
- **Maintenance status**: per treatment type interval (days and km); overdue if either is passed,
  due soon within 21 days or 1000 km; current km is the car's latest odometer.
- **Admin bootstrap**: no default manager; legacy `aa` weak accounts are locked at startup;
  operators use `python -m app.cli set-password <username>`.

## Testing

`backend/tests` runs the real app via TestClient against a temporary SQLite file and upload
folder. Startup, rate limiting and migration tests run in isolated subprocesses with their own
database so they cannot influence each other.
