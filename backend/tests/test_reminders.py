import pytest

from conftest import unique_name


def _mgr_post(manager, **data):
    base = {"title": "Service due", "message": "Please book a service"}
    base.update({k: (str(v).lower() if isinstance(v, bool) else str(v)) for k, v in data.items()})
    return manager.post("/manager/reminders", data=base)


def _titles(u):
    return {r["title"]: r for r in u.get("/me/reminders").json()}


def test_manager_broadcast_reaches_users_not_managers(manager, make_user):
    u1, u2 = make_user(), make_user()
    t = unique_name("bcast")
    r = _mgr_post(manager, title=t, broadcast_all_users=True, due_date="2026-12-31")
    assert r.status_code == 201, r.text
    for u in (u1, u2):
        got = _titles(u)[t]
        assert got["source"] == "manager" and got["done"] is False and got["done_at"] is None
        assert got["due_date"] == "2026-12-31"
        assert "car_label" in got
    assert t not in _titles(manager)


def test_broadcast_ignores_target_car_id(manager, make_user):
    u = make_user()
    car = u.make_car()
    t = unique_name("bc2")
    r = _mgr_post(manager, title=t, broadcast_all_users=True, target_car_id=car["id"])
    assert r.status_code == 201, r.text
    assert _titles(u)[t]["car_id"] is None


def test_targeted_reminder_only_to_target_with_car_label(manager, make_user):
    target, other = make_user(), make_user()
    car = target.make_car(nickname="zoomer")
    t = unique_name("tgt")
    r = _mgr_post(manager, title=t, target_user_id=target.user_id, target_car_id=car["id"])
    assert r.status_code == 201, r.text
    got = _titles(target)[t]
    assert got["car_id"] == car["id"]
    assert got["car_label"] and "zoomer" in got["car_label"]
    assert t not in _titles(other)


def test_target_car_must_belong_to_target_user(manager, make_user):
    target, other = make_user(), make_user()
    foreign_car = other.make_car()
    r = _mgr_post(manager, target_user_id=target.user_id, target_car_id=foreign_car["id"])
    assert r.status_code in (400, 422)
    assert r.json()["error"]["code"] == "validation_error"


def test_manager_reminder_bad_due_date_422(manager, make_user):
    u = make_user()
    r = _mgr_post(manager, target_user_id=u.user_id, due_date="31/12/2026")
    assert r.status_code == 422


def test_manager_reminder_with_image(manager, make_user, png_bytes):
    u = make_user()
    r = manager.post("/manager/reminders",
                     data={"title": "pic", "message": "m", "target_user_id": str(u.user_id)},
                     files={"image": ("a.png", png_bytes, "image/png")})
    assert r.status_code == 201, r.text
    assert r.json()[0]["image_url"].startswith("uploads/")


def test_self_reminder_lifecycle(make_user):
    u = make_user()
    car = u.make_car(nickname="mine")
    r = u.post("/me/reminders", json={"title": "Buy wipers", "message": "front", "due_date": "2026-11-01",
                                      "car_id": car["id"]})
    assert r.status_code in (200, 201), r.text
    rem = r.json()
    assert rem["source"] == "self" and rem["done"] is False and rem["car_id"] == car["id"]
    assert "mine" in (rem["car_label"] or "")

    r = u.patch(f"/me/reminders/{rem['id']}", json={"done": True})
    assert r.status_code == 200
    assert r.json()["done"] is True and r.json()["done_at"]
    r = u.patch(f"/me/reminders/{rem['id']}", json={"done": False})
    assert r.json()["done"] is False and r.json()["done_at"] is None

    assert u.delete(f"/me/reminders/{rem['id']}").status_code in (200, 204)
    assert rem["id"] not in [x["id"] for x in u.get("/me/reminders").json()]


def test_self_reminder_message_optional_and_title_required(make_user):
    u = make_user()
    assert u.post("/me/reminders", json={"title": "only title"}).status_code in (200, 201)
    r = u.post("/me/reminders", json={"message": "no title"})
    assert r.status_code == 422


def test_self_reminder_bad_date(make_user):
    u = make_user()
    assert u.post("/me/reminders", json={"title": "x", "due_date": "nope"}).status_code == 422


def test_self_reminder_car_must_be_owned(alice, bob):
    car = alice.make_car()
    r = bob.post("/me/reminders", json={"title": "x", "car_id": car["id"]})
    assert r.status_code in (403, 404, 422)  # AMBIGUOUS code; see test_authorization


def test_user_cannot_delete_manager_reminder(manager, make_user):
    u = make_user()
    t = unique_name("keep")
    _mgr_post(manager, title=t, target_user_id=u.user_id)
    rem = _titles(u)[t]
    r = u.delete(f"/me/reminders/{rem['id']}")
    assert r.status_code in (403, 404)
    assert t in _titles(u)


def test_user_can_mark_manager_reminder_done(manager, make_user):
    u = make_user()
    t = unique_name("done")
    _mgr_post(manager, title=t, target_user_id=u.user_id)
    rid = _titles(u)[t]["id"]
    r = u.patch(f"/me/reminders/{rid}", json={"done": True})
    assert r.status_code == 200 and r.json()["done"] is True


def test_patch_missing_reminder_404(alice):
    assert alice.patch("/me/reminders/99999999", json={"done": True}).status_code == 404
