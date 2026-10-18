from datetime import date, timedelta

import pytest


def _d(days_ago):
    return (date.today() - timedelta(days=days_ago)).isoformat()


# ---------------------------- expenses ---------------------------------------

def test_expenses_all_time(seeded_car):
    s = seeded_car
    r = s.user.get(f"/cars/{s.car['id']}/expenses")
    assert r.status_code == 200
    b = r.json()
    assert b["total"] == 3450 and b["records_count"] == 4
    by_type = {t["treatment_type"]: t for t in b["by_type"]}
    assert by_type["oil_change"]["total"] == 650 and by_type["oil_change"]["count"] == 2
    assert by_type["tires"]["total"] == 2000
    assert by_type["brake_pads"]["total"] == 800
    assert "label" in by_type["oil_change"]
    by_month = {m["month"]: m["total"] for m in b["by_month"]}
    assert by_month["2025-06"] == 300 and by_month["2025-12"] == 800 and by_month["2026-02"] == 2350
    assert [m["month"] for m in b["by_month"]] == sorted(by_month)  # chronological


def test_expenses_year(seeded_car):
    s = seeded_car
    b = s.user.get(f"/cars/{s.car['id']}/expenses", params={"year": 2026}).json()
    assert b["year_total"] == 2350
    b = s.user.get(f"/cars/{s.car['id']}/expenses", params={"year": 2025}).json()
    assert b["year_total"] == 1100
    # AMBIGUOUS: whether `total`/`by_type`/`by_month` are year-filtered when `year` is passed.


def test_expenses_empty_car(make_user):
    u = make_user()
    car = u.make_car()
    b = u.get(f"/cars/{car['id']}/expenses").json()
    assert b["total"] == 0 and b["by_type"] == [] and b["by_month"] == [] and b["records_count"] == 0


def test_legacy_cost_summary_unchanged(seeded_car):
    s = seeded_car
    assert s.user.get(f"/cars/{s.car['id']}/cost-summary").json() == {"car_id": s.car["id"], "total_cost": 3450}
    me = s.user.get("/me/cost-summary").json()
    assert me["total_cost"] == 3450 and me["by_car"][0]["car_id"] == s.car["id"]


# ---------------------------- garage ------------------------------------------

def test_garage_empty_user(make_user):
    u = make_user()
    g = u.get("/garage").json()
    assert g["cars"] == []
    assert g["summary"] == {"cars": 0, "services_this_year": 0, "spend_this_year": 0, "spend_total": 0}


def test_garage_summary_and_car_fields(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(0), treatment_type="oil_change", odometer_km=1000, cost=100, title="a")
    u.add_record(car["id"], service_date=_d(0), treatment_type="tires", odometer_km=3000, cost=200, title="b")
    u.add_record(car["id"], service_date="2020-01-01", treatment_type="battery", odometer_km=500, cost=50, title="c")
    g = u.get("/garage").json()
    s = g["summary"]
    assert s["cars"] == 1 and s["services_this_year"] == 2
    assert s["spend_this_year"] == 300 and s["spend_total"] == 350
    c = g["cars"][0]
    assert c["id"] == car["id"] and c["user_id"] == u.user_id
    assert c["records_count"] == 3 and c["total_cost"] == 350
    assert c["last_service_date"] == _d(0)
    assert c["odometer_km"] == 3000  # max, not latest-by-id


def test_garage_odometer_is_max_even_if_latest_record_is_lower(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(30), odometer_km=90000, title="old")
    u.add_record(car["id"], service_date=_d(1), odometer_km=85000, title="typo")
    assert u.get("/garage").json()["cars"][0]["odometer_km"] == 90000


def test_garage_car_without_records(make_user):
    u = make_user()
    u.make_car()
    c = u.get("/garage").json()["cars"][0]
    assert c["odometer_km"] is None and c["last_service_date"] is None
    assert c["records_count"] == 0 and c["total_cost"] == 0
    assert c["status"] == "unknown" and c["most_urgent"] is None


def test_garage_status_rolls_up_worst_item(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(400), treatment_type="oil_change", title="old oil")  # overdue
    u.add_record(car["id"], service_date=_d(1), treatment_type="battery", title="fresh battery")   # ok
    c = u.get("/garage").json()["cars"][0]
    assert c["status"] == "overdue"
    assert c["most_urgent"]["item"] == "oil_change" and c["most_urgent"]["status"] == "overdue"


def test_garage_status_ok_and_due_soon(make_user):
    u = make_user()
    ok_car, soon_car = u.make_car(nickname="ok"), u.make_car(nickname="soon")
    # "ok" requires history for at least half of the tracked categories (3 of 6)
    for t in ("oil_change", "oil_filter", "air_filter"):
        u.add_record(ok_car["id"], service_date=_d(1), treatment_type=t, title=t)
    u.add_record(soon_car["id"], service_date=_d(170), treatment_type="oil_change", title="y")
    by_nick = {c["nickname"]: c for c in u.get("/garage").json()["cars"]}
    assert by_nick["ok"]["status"] == "ok"
    assert by_nick["soon"]["status"] == "due_soon"


def test_garage_only_own_cars(alice, bob):
    ac = alice.make_car(nickname="alice-only")
    ids = [c["id"] for c in bob.get("/garage").json()["cars"]]
    assert ac["id"] not in ids


def test_garage_requires_auth(client):
    assert client.get("/garage").status_code == 401
