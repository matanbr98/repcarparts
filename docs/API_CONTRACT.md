# Repcarparts API Contract (v2, draft for approval)

Status: **DRAFT – Phase 0**. Source of truth for backend, frontend and QA work.
Base URL: `VITE_API_URL` (default `http://127.0.0.1:8000`). All bodies are JSON unless noted.
Compatibility rule: every v1 endpoint keeps its path, method and existing response fields.
Changes below are **additive** unless marked `BREAKING`.

## 0. Conventions

**Error shape (all non-2xx)**
```json
{ "error": { "code": "validation_error", "message": "Human readable", "fields": { "service_date": "Invalid date" } } }
```
Codes: `unauthorized` 401, `forbidden` 403, `not_found` 404, `conflict` 409,
`validation_error` 422/400, `rate_limited` 429, `file_too_large` 413, `unsupported_media` 415.
v1 clients read `detail`; the backend also keeps a top-level `"detail": "<message>"` for compatibility.

**Auth**: `Authorization: Bearer <jwt>`. JWT claims: `sub`, `role`, `iat`, `exp`, `pwd_v`
(`pwd_v` bumps on password change, which invalidates old tokens).
Frontend: any 401 on an authenticated call clears the session and redirects to `/login`.

**Dates** `YYYY-MM-DD`. **Money** integer ILS (unchanged; decimals are out of scope).
**Ownership**: user sees only own cars/records/reminders; `manager` sees all (unchanged).
**Uploads** `image/jpeg|png|webp`, max 5 MB, server-generated UUID filename, content-sniffed.
Returned `image_url` stays `uploads/<file>` (old values keep working).

## 1. Auth & profile (existing, hardened)

| Method | Path | Change |
|---|---|---|
| POST | `/auth/login` | Rate limited. Response adds `must_change_password: bool`. |
| POST | `/auth/register` | `username` 3-40 `[A-Za-z0-9_.-]`, `password` >= 8. |
| GET/PUT | `/me` | `UserOut` adds `must_change_password`. |
| PUT | `/me/password` | `new_password` >= 8; clears `must_change_password`; bumps `pwd_v`. |
| POST | `/me/profile-picture` | Upload rules above; replaces and removes the old file. |

## 2. Vehicles

| Method | Path | Notes |
|---|---|---|
| GET | `/cars` | Existing. Unchanged. |
| POST | `/cars` | Existing. |
| **PUT** | `/cars/{id}` | **NEW** partial update: `nickname, make, model, year, license_plate`. |
| DELETE | `/cars/{id}` | Existing. Now also removes dependent reminders' `car_id` (set null). |
| **GET** | `/garage` | **NEW** one call for the home screen, see below. |

`GET /garage` → `200`
```json
{
  "summary": { "cars": 2, "services_this_year": 5, "spend_this_year": 1840, "spend_total": 5200 },
  "cars": [{
    "id": 1, "nickname": "suzi", "make": "suzuki", "model": "splash", "year": 2012, "license_plate": "123456",
    "user_id": 1,
    "odometer_km": 84500,
    "last_service_date": "2026-03-01",
    "total_cost": 1200,
    "records_count": 4,
    "status": "overdue",
    "most_urgent": { "item": "oil_change", "status": "overdue", "due_date": "2026-01-10", "due_km": 80000 }
  }]
}
```
`status` ∈ `ok | due_soon | overdue | unknown` (worst item wins; `unknown` if nothing is tracked yet).
`odometer_km` is the max odometer over the car's records (nullable).

## 3. Service records

| Method | Path | Notes |
|---|---|---|
| GET | `/cars/{id}/records` | **Now ordered** `service_date desc, id desc`. Optional query: `q` (title/notes/parts), `type` (treatment_type), `year`, `date_from`, `date_to`. Response array shape unchanged. |
| POST | `/cars/{id}/records` | multipart/form-data, same fields as v1. Invalid date → 422 (was 500). |
| PUT | `/cars/{id}/records/{rid}` | JSON patch (unchanged). **NEW** multipart variant is not added; replacing a receipt uses the endpoint below. |
| **PUT** | `/cars/{id}/records/{rid}/image` | **NEW** multipart `image`; replaces the receipt. `DELETE` on the same path removes it. |
| DELETE | `/cars/{id}/records/{rid}` | Existing. |
| **GET** | `/cars/{id}/records.csv` | **NEW** CSV export of the filtered list (same query params), `text/csv`, UTF-8 BOM so Excel opens Hebrew correctly. Columns: `date,title,treatment_type,odometer_km,cost,parts_replaced,notes`. |

`treatment_type` allowed values: `oil_change, oil_filter, air_filter, brake_pads, battery, tires, lights, wipers, other`
(plus legacy free text is tolerated on read).

## 4. Maintenance status (mileage- and date-based)

`GET /cars/{id}/maintenance-due` → **response items gain fields; existing ones stay**
```json
[{
  "part": "oil_change",
  "label": "Oil change",
  "last_service_date": "2025-09-01",
  "last_service_km": 70000,
  "due_date": "2026-03-01",
  "due_km": 80000,
  "remaining_days": -45,
  "remaining_km": -4500,
  "progress": 1.0,
  "status": "overdue"
}]
```
Rules: intervals per `treatment_type`
(oil_change 180 d / 10 000 km, oil_filter 180 d / 10 000 km, air_filter 365 d / 20 000 km,
brake_pads 730 d / 40 000 km, tires 1095 d / 50 000 km, battery 1095 d, lights/wipers/other not tracked).
Item is `overdue` if either threshold is passed, `due_soon` within 21 days or 1 000 km, else `ok`;
`unknown` if never serviced. Current km = car's latest odometer. Legacy records with
no `treatment_type` fall back to the existing substring match.
`progress` = max(elapsed/interval days, elapsed/interval km), clamped 0..1.

## 5. Expenses

`GET /cars/{id}/expenses?year=2026` → (`year` optional; default = all time)
```json
{
  "total": 5200, "year_total": 1840, "records_count": 4,
  "by_type": [{ "treatment_type": "oil_change", "label": "Oil change", "total": 600, "count": 2 }],
  "by_month": [{ "month": "2026-01", "total": 300 }]
}
```
Existing `/me/cost-summary` and `/cars/{id}/cost-summary` are unchanged.

## 6. Reminders

| Method | Path | Notes |
|---|---|---|
| GET | `/me/reminders` | Existing; items gain `done: bool`, `done_at: date|null`, `car_label: string|null`, `source: "manager"|"self"`. |
| **POST** | `/me/reminders` | **NEW** self reminder: `{title, message?, due_date?, car_id?}` (car must be owned). |
| **PATCH** | `/me/reminders/{id}` | **NEW** `{done: bool}` (own reminders only). |
| **DELETE** | `/me/reminders/{id}` | **NEW** own `source=self` reminders only. |
| POST | `/manager/reminders` | Existing multipart. **NEW** validation: `target_car_id` must belong to the target user (broadcast ignores `target_car_id`). Bad `due_date` → 422. |

## 7. Manager (existing, unchanged paths)

`/manager/users`, `/manager/stats`, `/manager/parts-averages`: shape unchanged.
`parts-averages` now groups by `treatment_type` when present (legacy fallback to old parsing).

## 8. Schema changes (additive only, Alembic)

| Table | Change |
|---|---|
| `users` | `+ must_change_password BOOLEAN DEFAULT 0`, `+ pwd_version INTEGER DEFAULT 0`, `+ created_at DATE NULL` |
| `reminders` | `+ done BOOLEAN DEFAULT 0`, `+ done_at DATE NULL`, `+ source VARCHAR(10) DEFAULT 'manager'` |
| `service_records` | `+ created_at DATE NULL` (optional) |
| `cars` | no change |

No column is dropped or renamed; the downgrade removes only the added columns.

## 9. Configuration (env)

| Var | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | yes (non-dev) | >= 32 chars; server refuses to start without it unless `APP_ENV=dev` |
| `APP_ENV` | no | `dev` / `prod` (default `prod`) |
| `CORS_ORIGINS` | no | comma list; default `http://localhost:5173,http://127.0.0.1:5173` |
| `ACCESS_TOKEN_MINUTES` | no | default 720 |
| `DATABASE_PATH` | no | default `backend/repcarparts.db` |
| `UPLOAD_DIR` | no | default `backend/uploads` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | no | one-time admin bootstrap, see below |

## 10. Admin bootstrap (replaces `aa/aa`)

1. Startup **never** creates a default manager.
2. A startup migration finds any user whose password hash verifies against the literal `aa`
   (or username `aa` with a known-weak password) and sets `must_change_password = 1`,
   `pwd_version += 1` (kills old tokens) and replaces the hash with a random unusable one,
   so the account cannot log in until reset. **No row is deleted, and cars/records stay attached.**
3. The operator sets a real password with the CLI: `python -m app.cli set-password <username>`
   (prompts, no echo, never printed). Alternatively `ADMIN_USERNAME` + `ADMIN_PASSWORD` env vars
   create/reset a manager once at startup (the password is not logged).
4. Next login prompts a mandatory password change if `must_change_password` is set.
