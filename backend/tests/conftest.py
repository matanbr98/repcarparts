"""Shared fixtures. Tests are written against docs/API_CONTRACT.md (v2)."""
import itertools
import json
import os
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

ADMIN_USERNAME = "qa_manager"
ADMIN_PASSWORD = "Manager-Pass-123"
ADMIN_PASSWORD_CHANGED = "Manager-Changed-456"
TEST_SECRET = "test-secret-at-least-32-characters-long!!"
USER_PASSWORD = "UserPass-123"

# ---- environment must be set BEFORE `app` is imported -----------------------
_BASE = Path(tempfile.mkdtemp(prefix="repcar_qa_"))
os.environ.update(
    APP_ENV="dev",
    JWT_SECRET=TEST_SECRET,
    DATABASE_PATH=str(_BASE / "test.db"),
    UPLOAD_DIR=str(_BASE / "uploads"),
    CORS_ORIGINS="http://localhost:5173",
    # contract s10: env bootstrap creates a manager at startup (password not logged)
    ADMIN_USERNAME=ADMIN_USERNAME,
    ADMIN_PASSWORD=ADMIN_PASSWORD,
)
UPLOAD_PATH = Path(os.environ["UPLOAD_DIR"])
DB_PATH = Path(os.environ["DATABASE_PATH"])

# ---- isolation guard: tests must NEVER touch real data ----------------------
_TMP_ROOT = Path(tempfile.gettempdir()).resolve()
for _p in (UPLOAD_PATH, DB_PATH):
    _rp = _p.resolve()
    if _TMP_ROOT not in _rp.parents or BACKEND_DIR in _rp.parents:
        raise RuntimeError(f"Test isolation violated: {_rp} is not inside the temp dir {_TMP_ROOT}")
os.environ["TESTING_ISOLATED"] = "1"


def _png(w=2, h=2):
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def _jpeg():
    # Smallest well-known valid baseline JPEG (1x1) is long; a SOI + JFIF APP0 + EOI
    # skeleton is enough for magic-byte content sniffing.
    return (b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            + b"\xff\xdb\x00\x43\x00" + bytes([8]) * 64
            + b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
            + b"\xff\xda\x00\x08\x01\x01\x00\x00\x3f\x00\x00\xff\xd9")


def _webp():
    body = b"WEBP" + b"VP8L" + struct.pack("<I", 5) + b"\x2f\x00\x00\x00\x00" + b"\x00"
    return b"RIFF" + struct.pack("<I", len(body)) + body


PNG_BYTES, JPEG_BYTES, WEBP_BYTES = _png(), _jpeg(), _webp()


@pytest.fixture(scope="session")
def png_bytes():
    return PNG_BYTES


@pytest.fixture(scope="session")
def jpeg_bytes():
    return JPEG_BYTES


@pytest.fixture(scope="session")
def webp_bytes():
    return WEBP_BYTES


@pytest.fixture(scope="session")
def upload_dir():
    return UPLOAD_PATH


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """Rate limiting is per-process state; keep tests independent of each other."""
    from app.security import reset_rate_limits

    reset_rate_limits()
    yield


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as c:  # runs lifespan / startup
        yield c


_counter = itertools.count(1)


def unique_name(prefix="user"):
    return f"{prefix}_{next(_counter)}_{os.getpid()}"


class Api:
    """Thin helper around TestClient for authenticated calls."""

    def __init__(self, client, token=None, username=None, user_id=None):
        self.c, self.token, self.username, self.user_id = client, token, username, user_id

    @property
    def h(self):
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def get(self, p, **kw):
        return self.c.get(p, headers=self.h, **kw)

    def post(self, p, **kw):
        return self.c.post(p, headers=self.h, **kw)

    def put(self, p, **kw):
        return self.c.put(p, headers=self.h, **kw)

    def patch(self, p, **kw):
        return self.c.patch(p, headers=self.h, **kw)

    def delete(self, p, **kw):
        return self.c.delete(p, headers=self.h, **kw)

    def make_car(self, **over):
        body = dict(nickname="suzi", make="suzuki", model="splash", year=2012, license_plate="123456")
        body.update(over)
        r = self.post("/cars", json=body)
        assert r.status_code in (200, 201), r.text
        return r.json()

    def add_record(self, car_id, service_date="2026-01-10", title="Service", image=None, **fields):
        data = {"title": title, "service_date": service_date}
        data.update({k: str(v) for k, v in fields.items() if v is not None})
        files = {"image": image} if image else None
        return self.post(f"/cars/{car_id}/records", data=data, files=files)


def register_and_login(client, username=None, password=USER_PASSWORD):
    username = username or unique_name()
    r = client.post("/auth/register", json={"username": username, "password": password})
    assert r.status_code in (200, 201), r.text
    uid = r.json()["id"]
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return Api(client, r.json()["access_token"], username, uid)


@pytest.fixture(scope="session")
def make_user(client):
    """Factory: new registered + logged-in user (costs one login each)."""
    return lambda **kw: register_and_login(client, **kw)


@pytest.fixture(scope="session")
def alice(client):
    return register_and_login(client, unique_name("alice"))


@pytest.fixture(scope="session")
def bob(client):
    return register_and_login(client, unique_name("bob"))


@pytest.fixture(scope="session")
def manager(client):
    r = client.post("/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin bootstrap via env failed: {r.text}"
    assert r.json()["role"] == "manager"
    assert r.json()["must_change_password"] is True  # env-bootstrapped admin must pick a real password
    token = r.json()["access_token"]
    # The backend enforces the forced change: complete it exactly like a real admin would.
    done = client.put(
        "/me/password",
        json={"current_password": ADMIN_PASSWORD, "new_password": ADMIN_PASSWORD_CHANGED},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert done.status_code == 200, done.text
    return Api(client, done.json()["access_token"], ADMIN_USERNAME)


@pytest.fixture()
def seeded_car(make_user):
    """Fresh user + car with known records (insertion order differs from date order).

    ids[0] 2025-06-01 50000km oil_change  300  parts 'oil filter' notes 'castrol'
    ids[1] 2026-02-01 60000km tires      2000  parts '4 tires'
    ids[2] 2025-12-15 58000km brake_pads  800  parts 'front pads' notes 'squeal'
    ids[3] 2026-02-01 61000km oil_change  350
    Total 3450. Expected newest-first order: ids[3], ids[1], ids[2], ids[0].
    """
    u = make_user()
    car = u.make_car()
    specs = [
        ("2025-06-01", "Oil change summer", "oil_change", 50000, 300, "oil filter", "castrol"),
        ("2026-02-01", "New tires", "tires", 60000, 2000, "4 tires", None),
        ("2025-12-15", "Brakes", "brake_pads", 58000, 800, "front pads", "squeal"),
        ("2026-02-01", "Oil again", "oil_change", 61000, 350, None, None),
    ]
    ids = []
    for d, t, tt, km, cost, parts, notes in specs:
        r = u.add_record(car["id"], service_date=d, title=t, treatment_type=tt,
                         odometer_km=km, cost=cost, parts_replaced=parts, notes=notes)
        assert r.status_code in (200, 201), r.text
        ids.append(r.json()["id"])
    return type("Seed", (), {"user": u, "car": car, "record_ids": ids})


def isolated_env(tmp_path, **extra):
    env = dict(APP_ENV="dev", JWT_SECRET=TEST_SECRET, CORS_ORIGINS="http://localhost:5173",
               DATABASE_PATH=str(tmp_path / "iso.db"), UPLOAD_DIR=str(tmp_path / "uploads"),
               PYTHONPATH=str(BACKEND_DIR))
    env.update(extra)
    return env


def run_isolated(code: str, env: dict, timeout=180):
    """Run python `code` in a fresh process (fresh app + DB) from backend/ and
    return the JSON printed on the last stdout line."""
    full_env = {k: v for k, v in os.environ.items()
                if k not in ("ADMIN_USERNAME", "ADMIN_PASSWORD")}
    full_env.update(env)
    p = subprocess.run([sys.executable, "-c", code], cwd=BACKEND_DIR, env=full_env,
                       capture_output=True, text=True, timeout=timeout)
    assert p.returncode == 0, f"stdout={p.stdout}\nstderr={p.stderr}"
    return json.loads(p.stdout.strip().splitlines()[-1])
