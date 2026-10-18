"""Legacy (v1) database must upgrade in place without losing data (contract s8, s10)."""
import sqlite3

from conftest import isolated_env, run_isolated
from legacy_db import NEW_REMINDER_COLS, NEW_USER_COLS, build_legacy_db

BOOT = """
import json
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as c:
    r = c.post('/auth/login', json={'username':'dana','password':'Strong-Pass-1'})
    tok = r.json().get('access_token')
    h = {'Authorization': 'Bearer ' + tok} if tok else {}
    cars = c.get('/cars', headers=h).json() if tok else None
    recs = c.get('/cars/1/records', headers=h).json() if tok else None
    rems = c.get('/me/reminders', headers=h).json() if tok else None
    garage = c.get('/garage', headers=h).json() if tok else None
print(json.dumps({'login': r.status_code, 'cars': cars, 'recs': recs, 'rems': rems, 'garage': garage}))
"""


def _cols(db, table):
    con = sqlite3.connect(db)
    try:
        return {r[1] for r in con.execute(f"PRAGMA table_info({table})")}
    finally:
        con.close()


def test_upgrade_preserves_rows_and_adds_columns(tmp_path):
    db = build_legacy_db(tmp_path / "legacy.db")
    out = run_isolated(BOOT, isolated_env(tmp_path, DATABASE_PATH=str(db)))

    # new columns exist
    assert NEW_USER_COLS <= _cols(db, "users")
    assert NEW_REMINDER_COLS <= _cols(db, "reminders")
    assert "created_at" in _cols(db, "service_records")

    # old data preserved + usable through the API
    assert out["login"] == 200
    assert [c["nickname"] for c in out["cars"]] == ["dana-car"]
    titles = {r["title"] for r in out["recs"]}
    assert titles == {"Oil change", "Brakes"}
    assert [r["title"] for r in out["rems"]] == ["Test drive"]
    assert out["rems"][0]["source"] == "manager" and out["rems"][0]["done"] is False
    assert out["garage"]["summary"]["cars"] == 1

    con = sqlite3.connect(db)
    assert con.execute("select count(*) from users").fetchone()[0] == 2
    assert con.execute("select count(*) from service_records").fetchone()[0] == 2
    assert con.execute("select cost from service_records where id=1").fetchone()[0] == 350
    # new-column defaults on old rows
    mc, pv = con.execute("select must_change_password, pwd_version from users where username='dana'").fetchone()
    assert mc in (0, None, False) and pv in (0, None)
    con.close()


def test_upgrade_is_idempotent(tmp_path):
    db = build_legacy_db(tmp_path / "legacy.db")
    env = isolated_env(tmp_path, DATABASE_PATH=str(db))
    run_isolated(BOOT, env)
    out = run_isolated(BOOT, env)  # second boot must not fail or duplicate
    assert out["login"] == 200 and len(out["recs"]) == 2
