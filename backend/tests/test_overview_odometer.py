from datetime import date, timedelta


def _d(days_ago):
    return (date.today() - timedelta(days=days_ago)).isoformat()


# ---- honest overall status ---------------------------------------------------

def test_single_fresh_category_is_not_reported_on_track(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(1), treatment_type="oil_change", title="Oil")
    ov = u.get(f"/cars/{car['id']}/overview").json()
    assert ov["status"] == "unknown"  # insufficient data, not "ok"
    assert ov["coverage"] == {"tracked": 6, "known": 1}


def test_majority_coverage_and_fresh_is_ok(make_user):
    u = make_user()
    car = u.make_car()
    for t in ("oil_change", "oil_filter", "air_filter"):
        u.add_record(car["id"], service_date=_d(1), treatment_type=t, title=t)
    ov = u.get(f"/cars/{car['id']}/overview").json()
    assert ov["status"] == "ok" and ov["coverage"]["known"] == 3


def test_overdue_always_wins_even_with_little_data(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(400), treatment_type="oil_change", title="Oil")
    ov = u.get(f"/cars/{car['id']}/overview").json()
    assert ov["status"] == "overdue"
    assert ov["most_urgent"]["item"] == "oil_change"


def test_no_records_is_unknown_with_zero_coverage(make_user):
    u = make_user()
    car = u.make_car()
    ov = u.get(f"/cars/{car['id']}/overview").json()
    assert ov["status"] == "unknown" and ov["coverage"]["known"] == 0
    assert ov["odometer"]["odometer_km"] is None and ov["odometer"]["source"] is None


# ---- odometer ----------------------------------------------------------------

def test_set_odometer_without_service(make_user):
    u = make_user()
    car = u.make_car()
    r = u.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 123456})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["odometer_km"] == 123456 and b["source"] == "manual" and b["manual_km"] == 123456
    assert b["manual_updated_at"] == date.today().isoformat()
    g = {c["id"]: c for c in u.get("/garage").json()["cars"]}
    assert g[car["id"]]["odometer_km"] == 123456


def test_odometer_cannot_go_below_logged_service_reading(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(5), odometer_km=90000, treatment_type="oil_change", title="Oil")
    r = u.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 80000})
    assert r.status_code == 422
    assert r.json()["error"]["fields"]["odometer_km"]
    assert u.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 90000}).status_code == 200


def test_manual_odometer_drives_km_due_calculation(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(10), odometer_km=50000, treatment_type="oil_change", title="Oil")
    before = {i["part"]: i for i in u.get(f"/cars/{car['id']}/maintenance-due").json()}["oil_change"]
    assert before["status"] == "ok" and before["remaining_km"] == 10000
    u.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 60500})
    after = {i["part"]: i for i in u.get(f"/cars/{car['id']}/maintenance-due").json()}["oil_change"]
    assert after["remaining_km"] == -500 and after["status"] == "overdue"


def test_later_service_with_higher_km_overrides_manual(make_user):
    u = make_user()
    car = u.make_car()
    u.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 70000})
    u.add_record(car["id"], service_date=_d(1), odometer_km=72000, treatment_type="tires", title="Tires")
    o = u.get(f"/cars/{car['id']}/overview").json()["odometer"]
    assert o["odometer_km"] == 72000 and o["source"] == "service"


def test_odometer_authorization_and_validation(make_user):
    a, b = make_user(), make_user()
    car = a.make_car()
    assert b.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 1}).status_code == 403
    assert b.get(f"/cars/{car['id']}/overview").status_code == 403
    assert a.put(f"/cars/{car['id']}/odometer", json={"odometer_km": -5}).status_code == 422
    assert a.put("/cars/99999999/odometer", json={"odometer_km": 5}).status_code == 404
