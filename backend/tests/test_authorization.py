"""Ownership: user A must not touch user B's data; manager can; /manager/* is manager-only."""
import pytest


@pytest.fixture()
def victim(make_user, png_bytes):
    owner = make_user()
    car = owner.make_car(nickname="victim-car")
    rec = owner.add_record(car["id"], service_date="2026-01-05", title="Secret", odometer_km=1000,
                           cost=100, treatment_type="oil_change").json()
    rem = owner.post("/me/reminders", json={"title": "mine"})
    return type("V", (), {"owner": owner, "car": car, "rec": rec,
                          "reminder_id": rem.json().get("id") if rem.status_code in (200, 201) else None})


def _assert_denied(r):
    assert r.status_code in (403, 404), r.text
    assert r.json()["error"]["code"] in ("forbidden", "not_found")


def test_other_user_cannot_read_or_modify_car(victim, bob):
    cid = victim.car["id"]
    _assert_denied(bob.put(f"/cars/{cid}", json={"nickname": "hacked"}))
    _assert_denied(bob.delete(f"/cars/{cid}"))
    _assert_denied(bob.get(f"/cars/{cid}/maintenance-due"))
    _assert_denied(bob.get(f"/cars/{cid}/cost-summary"))
    _assert_denied(bob.get(f"/cars/{cid}/expenses"))
    # untouched
    assert victim.owner.get("/cars").json()[0]["nickname"] == "victim-car"
    assert cid not in [c["id"] for c in bob.get("/cars").json()]
    assert cid not in [c["id"] for c in bob.get("/garage").json()["cars"]]


def test_other_user_cannot_access_records(victim, bob):
    cid, rid = victim.car["id"], victim.rec["id"]
    _assert_denied(bob.get(f"/cars/{cid}/records"))
    _assert_denied(bob.add_record(cid, title="inject"))
    _assert_denied(bob.put(f"/cars/{cid}/records/{rid}", json={"title": "hacked"}))
    _assert_denied(bob.delete(f"/cars/{cid}/records/{rid}"))
    _assert_denied(bob.get(f"/cars/{cid}/records.csv"))
    _assert_denied(bob.delete(f"/cars/{cid}/records/{rid}/image"))
    assert victim.owner.get(f"/cars/{cid}/records").json()[0]["title"] == "Secret"


def test_other_user_cannot_replace_receipt(victim, bob, png_bytes):
    cid, rid = victim.car["id"], victim.rec["id"]
    r = bob.put(f"/cars/{cid}/records/{rid}/image", files={"image": ("a.png", png_bytes, "image/png")})
    _assert_denied(r)


def test_record_path_must_match_car(make_user):
    """A record id addressed through a car that does not own it must 404 (IDOR)."""
    u = make_user()
    c1, c2 = u.make_car(), u.make_car(nickname="other")
    rid = u.add_record(c1["id"], title="x").json()["id"]
    r = u.put(f"/cars/{c2['id']}/records/{rid}", json={"title": "moved"})
    assert r.status_code in (403, 404)


def test_other_user_cannot_touch_my_reminder(victim, bob):
    if victim.reminder_id is None:
        pytest.skip("POST /me/reminders not implemented yet")
    rid = victim.reminder_id
    _assert_denied(bob.patch(f"/me/reminders/{rid}", json={"done": True}))
    _assert_denied(bob.delete(f"/me/reminders/{rid}"))


def test_other_user_cannot_create_reminder_for_foreign_car(victim, bob):
    r = bob.post("/me/reminders", json={"title": "x", "car_id": victim.car["id"]})
    # AMBIGUOUS: contract only says "car must be owned"; 403/404/422 are all plausible.
    assert r.status_code in (403, 404, 422)


def test_manager_can_read_and_modify_any_car(victim, manager):
    cid, rid = victim.car["id"], victim.rec["id"]
    assert manager.get(f"/cars/{cid}/records").status_code == 200
    assert manager.get(f"/cars/{cid}/records.csv").status_code == 200
    assert manager.get(f"/cars/{cid}/maintenance-due").status_code == 200
    assert manager.get(f"/cars/{cid}/expenses").status_code == 200
    assert manager.put(f"/cars/{cid}", json={"nickname": "by-mgr"}).status_code == 200
    assert manager.put(f"/cars/{cid}/records/{rid}", json={"title": "by-mgr"}).status_code == 200
    assert cid in [c["id"] for c in manager.get("/cars").json()]


@pytest.mark.parametrize("path", ["/manager/users", "/manager/stats", "/manager/parts-averages"])
def test_manager_endpoints_forbidden_for_users(alice, path):
    r = alice.get(path)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"


def test_manager_endpoints_require_auth(client):
    assert client.get("/manager/users").status_code == 401


def test_manager_endpoints_ok_for_manager(manager):
    assert isinstance(manager.get("/manager/users").json(), list)
    stats = manager.get("/manager/stats").json()
    assert {"users", "cars", "records", "total_cost"} <= set(stats)
    assert isinstance(manager.get("/manager/parts-averages").json(), list)


def test_user_cannot_post_manager_reminder(alice):
    r = alice.post("/manager/reminders", data={"title": "t", "message": "m", "broadcast_all_users": "true"})
    assert r.status_code == 403
