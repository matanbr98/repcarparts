import time

import pytest
from jose import jwt

from conftest import TEST_SECRET, USER_PASSWORD, isolated_env, run_isolated, unique_name
from legacy_db import build_legacy_db


def _register(client, **over):
    body = {"username": unique_name("v"), "password": USER_PASSWORD}
    body.update(over)
    return client.post("/auth/register", json=body)


def test_register_ok(client):
    r = _register(client)
    assert r.status_code == 201
    body = r.json()
    assert body["role"] == "user"
    assert "password" not in body and "password_hash" not in body
    assert body.get("must_change_password") is False


@pytest.mark.parametrize("username", ["ab", "x" * 41, "bad name", "evil;drop", "שלום"])
def test_register_rejects_bad_username(client, username):
    r = _register(client, username=username)
    assert r.status_code in (400, 422)
    assert r.json()["error"]["code"] == "validation_error"


def test_register_rejects_short_password(client):
    r = _register(client, password="short7!")
    assert r.status_code in (400, 422)
    assert r.json()["error"]["code"] == "validation_error"


def test_register_duplicate_username(client):
    name = unique_name("dup")
    assert _register(client, username=name).status_code == 201
    r = _register(client, username=name)
    # Contract lists `conflict` 409; v1 returned 400. Accept both statuses, require code.
    assert r.status_code in (400, 409)
    assert r.json()["error"]["code"] in ("conflict", "validation_error")


def test_login_success_shape(client, alice):
    r = client.post("/auth/login", json={"username": alice.username, "password": USER_PASSWORD})
    assert r.status_code == 200
    b = r.json()
    assert b["token_type"] == "bearer" and b["role"] == "user"
    assert b["must_change_password"] is False
    claims = jwt.get_unverified_claims(b["access_token"])
    assert {"sub", "role", "iat", "exp", "pwd_v"} <= set(claims)


def test_login_wrong_password(client, alice):
    r = client.post("/auth/login", json={"username": alice.username, "password": "nope-nope-nope"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_login_unknown_user(client):
    r = client.post("/auth/login", json={"username": "ghost_user_zzz", "password": "whatever123"})
    assert r.status_code == 401


def test_me_requires_token(client):
    r = client.get("/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_me_returns_profile(alice):
    r = alice.get("/me")
    assert r.status_code == 200
    assert r.json()["username"] == alice.username
    assert r.json()["must_change_password"] is False


def test_garbage_token_rejected(client):
    r = client.get("/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


def test_expired_token_rejected(client, alice):
    claims = {"sub": str(alice.user_id), "role": "user", "iat": int(time.time()) - 7200,
              "exp": int(time.time()) - 3600, "pwd_v": 0}
    tok = jwt.encode(claims, TEST_SECRET, algorithm="HS256")
    assert client.get("/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_token_signed_with_wrong_secret_rejected(client, alice):
    claims = {"sub": str(alice.user_id), "role": "user", "iat": int(time.time()),
              "exp": int(time.time()) + 3600, "pwd_v": 0}
    tok = jwt.encode(claims, "another-secret-another-secret-123456", algorithm="HS256")
    assert client.get("/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_role_claim_cannot_be_escalated(client, alice):
    """A token whose `role` claim says manager but is signed validly for a plain user
    must not grant manager access (server must trust the DB role, not the claim)."""
    claims = {"sub": str(alice.user_id), "role": "manager", "iat": int(time.time()),
              "exp": int(time.time()) + 3600, "pwd_v": 0}
    tok = jwt.encode(claims, TEST_SECRET, algorithm="HS256")
    r = client.get("/manager/users", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code in (401, 403)


def test_tokens_invalid_after_password_change(client, make_user):
    u = make_user()
    old_token = u.token
    new_pw = "Brand-New-Pass-9"
    r = u.put("/me/password", json={"current_password": USER_PASSWORD, "new_password": new_pw})
    assert r.status_code == 200, r.text
    assert client.get("/me", headers={"Authorization": f"Bearer {old_token}"}).status_code == 401
    assert client.post("/auth/login", json={"username": u.username, "password": USER_PASSWORD}).status_code == 401
    r = client.post("/auth/login", json={"username": u.username, "password": new_pw})
    assert r.status_code == 200
    assert client.get("/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"}).status_code == 200


def test_change_password_rules(make_user):
    u = make_user()
    r = u.put("/me/password", json={"current_password": "wrong-wrong", "new_password": "LongEnough-1"})
    assert r.status_code in (400, 401, 403)
    r = u.put("/me/password", json={"current_password": USER_PASSWORD, "new_password": "short"})
    assert r.status_code in (400, 422)


def test_no_default_aa_account(client):
    r = client.post("/auth/login", json={"username": "aa", "password": "aa"})
    assert r.status_code == 401


def test_rate_limiting_login(tmp_path):
    """Isolated process so the limiter does not poison the shared session client.
    AMBIGUOUS: contract does not state the threshold; we allow up to 60 attempts."""
    code = """
import json
from fastapi.testclient import TestClient
from app.main import app
codes=[]; body=None
with TestClient(app) as c:
    for i in range(60):
        r = c.post('/auth/login', json={'username':'nobody','password':'bad-password-1'})
        codes.append(r.status_code)
        if r.status_code == 429:
            body = r.json(); break
print(json.dumps({'codes': codes, 'body': body}))
"""
    out = run_isolated(code, isolated_env(tmp_path))
    assert 429 in out["codes"], "login is not rate limited within 60 attempts"
    assert out["body"]["error"]["code"] == "rate_limited"


def test_legacy_aa_account_locked_and_must_change_password(tmp_path):
    db = tmp_path / "iso.db"
    build_legacy_db(db)
    code = """
import json, sqlite3, os
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as c:
    r = c.post('/auth/login', json={'username':'aa','password':'aa'})
    login_status = r.status_code
con = sqlite3.connect(os.environ['DATABASE_PATH'])
row = con.execute("select must_change_password, pwd_version, password_hash from users where username='aa'").fetchone()
cars = con.execute('select count(*) from cars').fetchone()[0]
dana = con.execute("select count(*) from users where username='dana'").fetchone()[0]
print(json.dumps({'login': login_status, 'row': [row[0], row[1]], 'hash_is_aa': False if row is None else row[2] == 'aa', 'cars': cars, 'dana': dana}))
"""
    out = run_isolated(code, isolated_env(tmp_path, DATABASE_PATH=str(db)))
    assert out["login"] in (401, 403)
    assert out["row"][0] == 1               # must_change_password
    assert out["row"][1] >= 1               # pwd_version bumped
    assert out["cars"] == 1 and out["dana"] == 1   # nothing deleted
