"""Regression tests for the final correctness round: future-dated services, conservative classification,
server-enforced forced password change, deterministic same-day baselines, case-insensitive usernames."""
from datetime import date, timedelta
from types import SimpleNamespace as NS
from urllib.parse import unquote

import pytest

from app import maintenance


def _d(days_ago):
    return (date.today() - timedelta(days=days_ago)).isoformat()


def _ahead(days):
    return (date.today() + timedelta(days=days)).isoformat()


def _due(u, car_id):
    return {i["part"]: i for i in u.get(f"/cars/{car_id}/maintenance-due").json()}


# ---------------------------------------------------------------- 1. future-dated services

def test_future_dated_service_is_saved_with_warning_but_not_the_baseline(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(100), treatment_type="oil_change", title="Oil", odometer_km="50000")
    r = u.add_record(car["id"], service_date=_ahead(10), treatment_type="oil_change", title="Oil (booked)", odometer_km="60000")
    assert r.status_code == 200
    codes = {w["code"]: w for w in r.json()["warnings"]}
    assert "future_date" in codes and "not counted for maintenance" in codes["future_date"]["message"]

    item = _due(u, car["id"])["oil_change"]
    assert item["last_service_date"] == _d(100) and item["last_service_km"] == 50000   # past one wins
    # the booked service's odometer is not a current reading either
    ov = u.get(f"/cars/{car['id']}/overview").json()
    assert ov["odometer"]["odometer_km"] == 50000
    # ...but it is stored, listed and costed
    assert len(u.get(f"/cars/{car['id']}/records").json()) == 2


def test_future_only_history_is_unknown_until_the_date_arrives(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_ahead(5), treatment_type="oil_change", title="Booked oil", odometer_km="70000")
    assert _due(u, car["id"])["oil_change"]["status"] == "unknown"
    g = u.get("/garage").json()["cars"][0]
    assert g["last_service_date"] is None and g["odometer_km"] is None


def test_future_service_becomes_baseline_once_its_date_arrives():
    """Pure-function check of 'calculations update correctly afterwards': same data, later 'today'."""
    today = date(2026, 6, 1)
    past = NS(id=1, service_date=date(2026, 1, 1), odometer_km=50000, treatment_type="oil_change", title="Oil", parts_replaced=None)
    booked = NS(id=2, service_date=date(2026, 6, 20), odometer_km=60000, treatment_type="oil_change", title="Oil", parts_replaced=None)

    before = {i["part"]: i for i in maintenance.compute([past, booked], today=today)}["oil_change"]
    assert before["last_service_date"] == date(2026, 1, 1) and before["last_service_km"] == 50000

    after = {i["part"]: i for i in maintenance.compute([past, booked], today=date(2026, 6, 20))}["oil_change"]
    assert after["last_service_date"] == date(2026, 6, 20) and after["last_service_km"] == 60000
    assert after["due_km"] == 70000 and after["status"] == "ok"
    assert maintenance.current_km([past, booked], today) == 50000
    assert maintenance.current_km([past, booked], date(2026, 6, 20)) == 60000


def test_future_service_odometer_does_not_raise_the_manual_odometer_floor(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_ahead(30), title="Booked", odometer_km="200000")
    assert u.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 80000}).status_code == 200


def test_future_service_does_not_create_odometer_regression_warnings(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(5), title="Now", odometer_km="90000")
    r = u.add_record(car["id"], service_date=_ahead(20), title="Booked", odometer_km="95000")
    assert {w["code"] for w in r.json()["warnings"]} == {"future_date"}


# ---------------------------------------------------------------- 2. classification

def _rec(title, treatment_type=None, parts=None):
    return NS(id=1, service_date=date(2026, 1, 1), odometer_km=None, title=title,
              treatment_type=treatment_type, parts_replaced=parts)


@pytest.mark.parametrize(
    "title,ttype,expected",
    [
        # explicit type is the source of truth, whatever the title says
        ("Oil change", "tires", {"tires"}),
        ("Whatever", "battery", {"battery"}),
        ("Oil change", "lights", set()),
        # legacy / Other: clear phrases are recognised
        ("Oil change", None, {"oil_change"}),
        ("Engine oil", None, {"oil_change"}),
        ("Oil filter", None, {"oil_filter"}),
        ("Oil and filter change", "other", {"oil_change", "oil_filter"}),
        ("Oil change + filter", None, {"oil_change", "oil_filter"}),
        ("Air filter", "other", {"air_filter"}),
        ("Cabin filter replaced", None, {"air_filter"}),
        ("Front brake pads replaced", "other", {"brake_pads"}),
        ("New brakes", None, {"brake_pads"}),
        ("New tyres fitted", None, {"tires"}),
        ("Car battery", None, {"battery"}),
        # look-alikes must NOT be classified
        ("Ignition coil replaced", None, set()),
        ("Oil leak repair", None, set()),
        ("Oil pressure sensor", "other", set()),
        ("Brake fluid flush", None, set()),
        ("Tire rotation", None, set()),
        ("Tire pressure check", "other", set()),
        ("Puncture repair tyre", None, set()),
        ("Battery terminal cleaning", None, set()),
        ("Boil water", None, set()),
        ("Foil wrap", None, set()),
    ],
)
def test_classification_is_explicit_first_and_conservative(title, ttype, expected):
    assert maintenance.records_parts(_rec(title, ttype)) == expected


def test_parts_replaced_chunks_are_evaluated_conservatively():
    assert maintenance.records_parts(_rec("Service", None, "Oil filter, Brake pads")) == {"oil_filter", "brake_pads"}
    assert maintenance.records_parts(_rec("Service", None, "Ignition coil, spark cable")) == set()


# ---------------------------------------------------------------- 3. forced password change (server side)

@pytest.fixture()
def forced_user(make_user):
    from app import models
    from app.database import SessionLocal

    u = make_user()
    with SessionLocal() as db:
        row = db.query(models.User).filter(models.User.id == u.user_id).first()
        row.must_change_password = True
        db.commit()
    return u


def test_forced_password_change_blocks_everything_except_the_change_flow(forced_user):
    u = forced_user
    for method, path in (
        ("get", "/cars"), ("get", "/garage"), ("get", "/me/reminders"), ("get", "/me/cost-summary"),
        ("put", "/me"), ("get", "/manager/users"),
    ):
        r = getattr(u, method)(path, **({"json": {"name": "x"}} if method == "put" else {}))
        assert r.status_code == 403, (method, path, r.status_code)
        assert r.json()["error"]["code"] == "password_change_required", (path, r.text)
    assert u.post("/cars", json={"nickname": "n", "make": "m", "model": "x"}).status_code == 403
    assert u.post("/me/profile-picture", files={"image": ("a.png", b"x", "image/png")}).status_code == 403

    me = u.get("/me")
    assert me.status_code == 200 and me.json()["must_change_password"] is True


def test_forced_password_change_completes_and_unlocks_the_account(forced_user, client):
    u = forced_user
    done = u.put("/me/password", json={"current_password": "UserPass-123", "new_password": "BrandNew-pass-9"})
    assert done.status_code == 200 and done.json()["access_token"]
    new = {"Authorization": "Bearer " + done.json()["access_token"]}
    assert client.get("/cars", headers=new).status_code == 200
    assert client.get("/me", headers=new).json()["must_change_password"] is False
    assert u.get("/cars").status_code == 401                      # old token is dead
    assert client.post("/auth/login", json={"username": u.username, "password": "BrandNew-pass-9"}).status_code == 200


def test_login_still_works_while_a_change_is_pending(forced_user, client):
    r = client.post("/auth/login", json={"username": forced_user.username, "password": "UserPass-123"})
    assert r.status_code == 200 and r.json()["must_change_password"] is True


def test_forced_change_rejects_a_wrong_current_password_without_unlocking(forced_user):
    r = forced_user.put("/me/password", json={"current_password": "nope-nope-1", "new_password": "BrandNew-pass-9"})
    assert r.status_code == 400
    assert forced_user.get("/cars").status_code == 403


# ---------------------------------------------------------------- 4. same-day records

def test_same_day_same_category_uses_higher_reading_regardless_of_entry_order(make_user):
    u = make_user()
    a, b = u.make_car(nickname="hi-first"), u.make_car(nickname="lo-first")
    for car, order in ((a, ("50500", "50000")), (b, ("50000", "50500"))):
        for km in order:
            u.add_record(car["id"], service_date=_d(20), treatment_type="oil_change", title="Oil", odometer_km=km)
        item = _due(u, car["id"])["oil_change"]
        assert item["last_service_km"] == 50500, car["nickname"]
        assert item["due_km"] == 60500


def test_same_day_same_category_with_different_readings_warns(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(20), treatment_type="oil_change", title="Oil", odometer_km="50000")
    r = u.add_record(car["id"], service_date=_d(20), treatment_type="oil_change", title="Oil again", odometer_km="52000")
    w = {x["code"]: x for x in r.json()["warnings"]}
    assert "same_day_category_mismatch" in w
    assert "52,000" in w["same_day_category_mismatch"]["message"] and "baseline" in w["same_day_category_mismatch"]["message"]


def test_same_day_close_readings_do_not_warn(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(20), treatment_type="oil_change", title="Oil", odometer_km="50000")
    r = u.add_record(car["id"], service_date=_d(20), treatment_type="oil_change", title="Oil", odometer_km="50040")
    assert "same_day_category_mismatch" not in {w["code"] for w in r.json()["warnings"]}


def test_same_day_different_categories_do_not_trigger_category_warning(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(20), treatment_type="oil_change", title="Oil", odometer_km="50000")
    r = u.add_record(car["id"], service_date=_d(20), treatment_type="brake_pads", title="Pads", odometer_km="50300")
    assert "same_day_category_mismatch" not in {w["code"] for w in r.json()["warnings"]}


# ---------------------------------------------------------------- 5. usernames

def test_registration_rejects_usernames_differing_only_by_case(client):
    assert client.post("/auth/register", json={"username": "CaseUser_One", "password": "Passw0rd-xyz"}).status_code == 201
    for variant in ("caseuser_one", "CASEUSER_ONE", "caseUSER_one"):
        r = client.post("/auth/register", json={"username": variant, "password": "Passw0rd-xyz"})
        assert r.status_code == 409, variant
        assert r.json()["error"]["code"] == "conflict"


def test_login_tolerates_case_when_unambiguous(client):
    client.post("/auth/register", json={"username": "MixedCase_Two", "password": "Passw0rd-xyz"})
    ok = client.post("/auth/login", json={"username": "mixedcase_two", "password": "Passw0rd-xyz"})
    assert ok.status_code == 200
    assert client.post("/auth/login", json={"username": "mixedcase_two", "password": "wrong-pass-1"}).status_code == 401


def test_existing_case_duplicates_are_preserved_and_exact_login_still_works(client):
    from app import models
    from app.database import SessionLocal
    from app.security import hash_password

    with SessionLocal() as db:
        db.add(models.User(username="LegacyDup", password_hash=hash_password("Legacy-pass-1"), role="user"))
        db.add(models.User(username="legacydup", password_hash=hash_password("Legacy-pass-2"), role="user"))
        db.commit()
    assert client.post("/auth/login", json={"username": "LegacyDup", "password": "Legacy-pass-1"}).status_code == 200
    assert client.post("/auth/login", json={"username": "legacydup", "password": "Legacy-pass-2"}).status_code == 200
    # ambiguous different-case login is refused instead of guessing an account
    assert client.post("/auth/login", json={"username": "LEGACYDUP", "password": "Legacy-pass-1"}).status_code == 401
    # and nobody can add a third variant
    assert client.post("/auth/register", json={"username": "LegacyDUP", "password": "Passw0rd-xyz"}).status_code == 409


# ---------------------------------------------------------------- 6. CSV filename

def test_csv_filename_keeps_non_ascii_vehicle_names(make_user):
    u = make_user()
    car = u.make_car(nickname="רכב משפחתי")
    cd = u.get(f"/cars/{car['id']}/records.csv").headers["content-disposition"]
    assert f'filename="car-{car["id"]}-records.csv"' in cd          # ASCII fallback is always present
    star = cd.split("filename*=UTF-8''")[1]
    assert unquote(star) == "רכב משפחתי-service-history.csv"


def test_csv_filename_falls_back_when_name_has_no_letters(make_user):
    u = make_user()
    car = u.make_car(nickname="!!!")
    cd = u.get(f"/cars/{car['id']}/records.csv").headers["content-disposition"]
    assert "filename*=" not in cd and f'car-{car["id"]}-records.csv' in cd


def test_csv_filename_ascii_name(make_user):
    u = make_user()
    car = u.make_car(nickname="My Car")
    cd = u.get(f"/cars/{car['id']}/records.csv").headers["content-disposition"]
    assert "filename*=UTF-8''My%20Car-service-history.csv" in cd
