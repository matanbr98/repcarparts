"""Contract s0: every non-2xx has {"error": {code,message,...}} plus top-level `detail`."""
import pytest


def _check(r, status, code):
    assert r.status_code == status, r.text
    b = r.json()
    assert b["error"]["code"] == code
    assert isinstance(b["error"]["message"], str) and b["error"]["message"]
    assert isinstance(b.get("detail"), str) and b["detail"]   # v1 compatibility


def test_401_shape(client):
    _check(client.get("/cars"), 401, "unauthorized")


def test_403_shape(alice):
    _check(alice.get("/manager/stats"), 403, "forbidden")


def test_404_shape(alice):
    _check(alice.put("/cars/99999999", json={"nickname": "x"}), 404, "not_found")


def test_unknown_route_shape(client):
    r = client.get("/definitely/not/here")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_422_has_field_errors(alice):
    r = alice.post("/cars", json={"nickname": "x"})
    _check(r, 422, "validation_error")
    fields = r.json()["error"].get("fields")
    assert isinstance(fields, dict) and ("make" in fields or "model" in fields)


def test_invalid_date_field_named(make_user):
    u = make_user()
    car = u.make_car()
    r = u.add_record(car["id"], service_date="bad")
    _check(r, 422, "validation_error")
    assert "service_date" in (r.json()["error"].get("fields") or {})


def test_401_login_shape(client):
    r = client.post("/auth/login", json={"username": "nobody_x", "password": "wrongwrong1"})
    _check(r, 401, "unauthorized")


def test_413_and_415_shapes(make_user, png_bytes):
    u = make_user()
    car = u.make_car()
    r = u.add_record(car["id"], image=("a.png", png_bytes + b"\0" * (5 * 1024 * 1024), "image/png"))
    _check(r, 413, "file_too_large")
    r = u.add_record(car["id"], image=("a.png", b"hello", "image/png"))
    _check(r, 415, "unsupported_media")


def test_no_stack_trace_on_bad_input(alice):
    r = alice.get("/cars/not-an-int/records")
    assert r.status_code == 422
    assert "Traceback" not in r.text
