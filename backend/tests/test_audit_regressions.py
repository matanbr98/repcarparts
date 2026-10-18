"""Regression tests from the reliability audit. Each test reproduces a defect found by probing the app."""
from datetime import date, timedelta


def _d(days_ago):
    return (date.today() - timedelta(days=days_ago)).isoformat()


def _due(u, car_id):
    return {i["part"]: i for i in u.get(f"/cars/{car_id}/maintenance-due").json()}


def _codes(resp_json):
    return {w["code"] for w in resp_json.get("warnings", [])}


# ---- hard integrity rules ---------------------------------------------------------------------

def test_whitespace_title_rejected_and_does_not_brick_history(make_user):
    """Was: record persisted with an empty title, response validation 500, and every later
    GET /records for that vehicle returned 500."""
    u = make_user()
    car = u.make_car()
    r = u.add_record(car["id"], service_date=_d(1), title="   ")
    assert r.status_code == 422 and r.json()["error"]["fields"]["title"]
    assert u.get(f"/cars/{car['id']}/records").status_code == 200
    assert u.get(f"/cars/{car['id']}/records").json() == []


def test_update_blank_title_rejected(make_user):
    u = make_user()
    car = u.make_car()
    rid = u.add_record(car["id"], service_date=_d(3), title="Oil").json()["id"]
    r = u.put(f"/cars/{car['id']}/records/{rid}", json={"title": "   "})
    assert r.status_code == 422
    assert u.get(f"/cars/{car['id']}/records").json()[0]["title"] == "Oil"


def test_huge_cost_and_odometer_are_422_not_500(make_user):
    u = make_user()
    car = u.make_car()
    for field, value in (("cost", "99999999999999999999"), ("odometer_km", "99999999999999999999"), ("odometer_km", "3000001")):
        r = u.add_record(car["id"], service_date=_d(1), title="x", **{field: value})
        assert r.status_code == 422, (field, value, r.text)
    assert u.get(f"/cars/{car['id']}/records").json() == []


def test_negative_values_rejected_on_create_and_update(make_user):
    u = make_user()
    car = u.make_car()
    assert u.add_record(car["id"], service_date=_d(1), title="x", cost="-5").status_code == 422
    assert u.add_record(car["id"], service_date=_d(1), title="x", odometer_km="-1").status_code == 422
    rid = u.add_record(car["id"], service_date=_d(1), title="ok", cost="10").json()["id"]
    assert u.put(f"/cars/{car['id']}/records/{rid}", json={"cost": -1}).status_code == 422
    assert u.put(f"/cars/{car['id']}/records/{rid}", json={"odometer_km": -1}).status_code == 422


def test_absurd_dates_rejected_plausible_future_allowed_with_warning(make_user):
    u = make_user()
    car = u.make_car()
    for bad in ("9999-12-31", "0001-01-01", "1899-12-31"):
        assert u.add_record(car["id"], service_date=bad, title="x").status_code == 422, bad
    assert u.add_record(car["id"], service_date=(date.today() + timedelta(days=400)).isoformat(), title="x").status_code == 422
    soon = u.add_record(car["id"], service_date=(date.today() + timedelta(days=10)).isoformat(), title="Booked")
    assert soon.status_code == 200
    assert "future_date" in _codes(soon.json())
    # same bounds on update
    rid = soon.json()["id"]
    assert u.put(f"/cars/{car['id']}/records/{rid}", json={"service_date": "9999-01-01"}).status_code == 422


def test_cleared_cost_on_update_becomes_zero_not_null(make_user):
    u = make_user()
    car = u.make_car()
    rid = u.add_record(car["id"], service_date=_d(2), title="x", cost="120").json()["id"]
    r = u.put(f"/cars/{car['id']}/records/{rid}", json={"cost": None})
    assert r.status_code == 200 and r.json()["cost"] == 0
    assert u.get(f"/cars/{car['id']}/expenses").json()["total"] == 0


# ---- maintenance matching ---------------------------------------------------------------------

def test_ignition_coil_is_not_an_oil_change(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(5), title="Ignition coil replaced", odometer_km="50000")
    assert _due(u, car["id"])["oil_change"]["status"] == "unknown"


def test_other_type_with_recognisable_title_counts_towards_category(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(5), title="Front brake pads replaced", treatment_type="other", odometer_km="50000")
    assert _due(u, car["id"])["brake_pads"]["status"] == "ok"


def test_regional_spellings_and_plurals_match(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(5), title="New tyres fitted")
    u.add_record(car["id"], service_date=_d(5), title="New batteries")
    due = _due(u, car["id"])
    assert due["tires"]["status"] == "ok" and due["battery"]["status"] == "ok"


def test_oil_filter_title_does_not_reset_oil_change(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(400), title="Engine oil change", treatment_type="oil_change")
    u.add_record(car["id"], service_date=_d(2), title="Oil filter", treatment_type=None)
    due = _due(u, car["id"])
    assert due["oil_change"]["status"] == "overdue"      # only the filter was renewed
    assert due["oil_filter"]["status"] == "ok"


# ---- baseline selection / calculations --------------------------------------------------------

def test_latest_dated_service_is_the_baseline_even_if_entered_first(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(5), treatment_type="oil_change", title="Oil", odometer_km="60000")
    # historical entry added afterwards must not become the baseline
    u.add_record(car["id"], service_date=_d(700), treatment_type="oil_change", title="Oil", odometer_km="20000")
    item = _due(u, car["id"])["oil_change"]
    assert item["last_service_date"] == _d(5) and item["last_service_km"] == 60000
    assert item["status"] == "ok"


def test_overdue_by_mileage_only_and_by_date_only(make_user):
    u = make_user()
    km_car, date_car = u.make_car(nickname="km"), u.make_car(nickname="date")
    u.add_record(km_car["id"], service_date=_d(10), treatment_type="oil_change", title="Oil", odometer_km="50000")
    assert u.put(f"/cars/{km_car['id']}/odometer", json={"odometer_km": 61000}).status_code == 200
    item = _due(u, km_car["id"])["oil_change"]
    assert item["remaining_days"] > 0 and item["remaining_km"] < 0 and item["status"] == "overdue"

    u.add_record(date_car["id"], service_date=_d(200), treatment_type="oil_change", title="Oil", odometer_km="50000")
    item = _due(u, date_car["id"])["oil_change"]
    assert item["remaining_days"] < 0 and (item["remaining_km"] is None or item["remaining_km"] > 0)
    assert item["status"] == "overdue"


def test_interval_crossing_calendar_year(make_user):
    u = make_user()
    car = u.make_car()
    # a service late last year whose 180-day interval ends this year
    last_dec = date(date.today().year - 1, 12, 20)
    u.add_record(car["id"], service_date=last_dec.isoformat(), treatment_type="oil_change", title="Oil")
    item = _due(u, car["id"])["oil_change"]
    assert item["due_date"] == (last_dec + timedelta(days=180)).isoformat()
    assert item["due_date"][:4] == str(last_dec.year + 1)


def test_missing_odometer_and_missing_everything_do_not_crash(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(30), treatment_type="oil_change", title="Oil")  # no odometer
    item = _due(u, car["id"])["oil_change"]
    assert item["due_km"] is None and item["remaining_km"] is None and item["status"] == "ok"
    assert u.get(f"/cars/{car['id']}/overview").json()["odometer"]["odometer_km"] is None


def test_editing_latest_service_moves_baseline_and_deleting_falls_back(make_user):
    u = make_user()
    car = u.make_car()
    old = u.add_record(car["id"], service_date=_d(300), treatment_type="oil_change", title="Oil", odometer_km="40000").json()
    new = u.add_record(car["id"], service_date=_d(5), treatment_type="oil_change", title="Oil", odometer_km="49000").json()
    assert _due(u, car["id"])["oil_change"]["status"] == "ok"
    assert u.delete(f"/cars/{car['id']}/records/{new['id']}").status_code == 200
    item = _due(u, car["id"])["oil_change"]
    assert item["last_service_date"] == _d(300) and item["status"] == "overdue"
    assert u.put(f"/cars/{car['id']}/records/{old['id']}", json={"service_date": _d(2)}).status_code == 200
    assert _due(u, car["id"])["oil_change"]["status"] == "ok"


# ---- odometer consistency ---------------------------------------------------------------------

def test_newer_service_with_lower_mileage_warns_but_is_saved(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(100), title="A", odometer_km="100000")
    r = u.add_record(car["id"], service_date=_d(10), title="B", odometer_km="90000")
    assert r.status_code == 200
    assert "odometer_regression" in _codes(r.json())
    assert any("100,000" in w["message"] for w in r.json()["warnings"])
    assert "odometer_regression" in {w["code"] for w in u.get(f"/cars/{car['id']}/overview").json()["warnings"]}


def test_historical_service_with_lower_mileage_is_not_flagged(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(10), title="Recent", odometer_km="90000")
    r = u.add_record(car["id"], service_date=_d(400), title="Old", odometer_km="60000")
    assert r.status_code == 200 and r.json()["warnings"] == []


def test_same_day_readings_far_apart_warn(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(5), title="A", odometer_km="50000")
    r = u.add_record(car["id"], service_date=_d(5), title="B", odometer_km="58000")
    assert "same_day_mismatch" in _codes(r.json())
    small = u.add_record(car["id"], service_date=_d(9), title="D", odometer_km="40000")
    ok = u.add_record(car["id"], service_date=_d(9), title="E", odometer_km="40050")  # small drift is fine
    assert "same_day_mismatch" not in {w["code"] for w in ok.json()["warnings"]}
    assert small.status_code == 200


def test_implausible_distance_between_services_warns(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(3), title="A", odometer_km="10000")
    r = u.add_record(car["id"], service_date=_d(1), title="B", odometer_km="90000")
    assert "implausible_distance" in _codes(r.json())


def test_service_before_model_year_and_duplicates_warn(make_user):
    u = make_user()
    car = u.make_car(year=2020)
    r = u.add_record(car["id"], service_date="2015-05-01", title="Too early")
    assert "before_model_year" in _codes(r.json())
    u.add_record(car["id"], service_date=_d(9), title="Oil", treatment_type="oil_change", cost="300")
    dup = u.add_record(car["id"], service_date=_d(9), title="Oil", treatment_type="oil_change", cost="300")
    assert "possible_duplicate" in _codes(dup.json())


def test_deleting_highest_odometer_record_lowers_effective_km_and_floor(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(50), title="A", odometer_km="80000")
    top = u.add_record(car["id"], service_date=_d(5), title="B", odometer_km="95000").json()
    assert u.get(f"/cars/{car['id']}/overview").json()["odometer"]["odometer_km"] == 95000
    # floor blocks a lower manual reading, and tells the user which service holds it
    blocked = u.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 85000})
    assert blocked.status_code == 422 and "B" in blocked.json()["error"]["message"]
    assert u.delete(f"/cars/{car['id']}/records/{top['id']}").status_code == 200
    assert u.get(f"/cars/{car['id']}/overview").json()["odometer"]["odometer_km"] == 80000
    assert u.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 85000}).status_code == 200


def test_editing_highest_record_odometer_down_updates_current_reading(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(50), title="A", odometer_km="80000")
    top = u.add_record(car["id"], service_date=_d(5), title="B", odometer_km="950000").json()  # typo
    assert u.get(f"/cars/{car['id']}/overview").json()["odometer"]["odometer_km"] == 950000
    assert u.put(f"/cars/{car['id']}/records/{top['id']}", json={"odometer_km": 95000}).status_code == 200
    assert u.get(f"/cars/{car['id']}/overview").json()["odometer"]["odometer_km"] == 95000


def test_manual_odometer_below_an_earlier_dated_service_is_flagged(make_user):
    u = make_user()
    car = u.make_car()
    assert u.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 100000}).status_code == 200
    # an older service later entered with a higher reading than the manual value
    r = u.add_record(car["id"], service_date=_d(400), title="Old", odometer_km="120000")
    assert r.status_code == 200
    codes = {w["code"] for w in u.get(f"/cars/{car['id']}/overview").json()["warnings"]}
    assert "manual_regression" in codes


def test_large_manual_odometer_jump_warns_but_saves(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(5), title="A", odometer_km="50000")
    r = u.put(f"/cars/{car['id']}/odometer", json={"odometer_km": 150000})
    assert r.status_code == 200 and "large_jump" in {w["code"] for w in r.json()["warnings"]}
    assert r.json()["odometer_km"] == 150000


# ---- expenses / search / csv / receipts -------------------------------------------------------

def test_expenses_update_after_edit_delete_and_zero_cost(make_user):
    u = make_user()
    car = u.make_car()
    a = u.add_record(car["id"], service_date=f"{date.today().year}-01-15", title="A", cost="100", treatment_type="oil_change").json()
    b = u.add_record(car["id"], service_date=f"{date.today().year - 1}-06-01", title="B", cost="250", treatment_type="tires").json()
    z = u.add_record(car["id"], service_date=_d(3), title="Free check", cost="0").json()
    ex = u.get(f"/cars/{car['id']}/expenses").json()
    assert ex["total"] == 350 and ex["records_count"] == 3
    this_year = u.get(f"/cars/{car['id']}/expenses", params={"year": date.today().year}).json()
    assert this_year["year_total"] == 100 and this_year["records_count"] == 2
    assert u.put(f"/cars/{car['id']}/records/{a['id']}", json={"cost": 175}).status_code == 200
    assert u.get(f"/cars/{car['id']}/expenses").json()["total"] == 425
    assert u.delete(f"/cars/{car['id']}/records/{b['id']}").status_code == 200
    ex = u.get(f"/cars/{car['id']}/expenses").json()
    assert ex["total"] == 175 and ex["records_count"] == 2
    assert u.get("/me/cost-summary").json()["total_cost"] == 175
    assert u.get("/garage").json()["cars"][0]["total_cost"] == 175
    assert z["cost"] == 0


def test_expenses_classify_legacy_titles_like_maintenance_does(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(4), title="Engine oil change", cost="200")  # no treatment_type
    types = {t["treatment_type"]: t for t in u.get(f"/cars/{car['id']}/expenses").json()["by_type"]}
    assert "oil_change" in types and types["oil_change"]["total"] == 200


def test_search_treats_percent_and_underscore_literally(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(4), title="Wiper blades", notes="50% off")
    u.add_record(car["id"], service_date=_d(5), title="Brake fluid", notes="snake_case")
    u.add_record(car["id"], service_date=_d(6), title="Plain", notes="nothing")
    q = lambda s: [r["title"] for r in u.get(f"/cars/{car['id']}/records", params={"q": s}).json()]
    assert q("%") == ["Wiper blades"]
    assert q("_") == ["Brake fluid"]
    assert sorted(q("")) == ["Brake fluid", "Plain", "Wiper blades"]
    csv = u.get(f"/cars/{car['id']}/records.csv", params={"q": "%"})
    assert csv.status_code == 200 and b"Wiper blades" in csv.content and b"Plain" not in csv.content


def test_csv_has_zero_cost_rows_and_neutralises_formulas(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], service_date=_d(4), title="=HYPERLINK(1)", cost="0")
    body = u.get(f"/cars/{car['id']}/records.csv").content.decode("utf-8-sig")
    assert "'=HYPERLINK(1)" in body and ",0," in body


def test_deleting_one_record_keeps_other_records_receipts(make_user, png_bytes):
    u = make_user()
    car = u.make_car()
    img = ("r.png", png_bytes, "image/png")
    a = u.add_record(car["id"], service_date=_d(4), title="A", image=img).json()
    b = u.add_record(car["id"], service_date=_d(5), title="B", image=img).json()
    assert a["image_url"] != b["image_url"]
    assert u.c.get("/" + b["image_url"]).status_code == 200
    assert u.delete(f"/cars/{car['id']}/records/{a['id']}").status_code == 200
    assert u.c.get("/" + a["image_url"]).status_code == 404
    assert u.c.get("/" + b["image_url"]).status_code == 200


def test_replace_receipt_keeps_unrelated_files(make_user, png_bytes):
    u = make_user()
    car = u.make_car()
    img = ("r.png", png_bytes, "image/png")
    a = u.add_record(car["id"], service_date=_d(4), title="A", image=img).json()
    b = u.add_record(car["id"], service_date=_d(5), title="B", image=img).json()
    r = u.put(f"/cars/{car['id']}/records/{a['id']}/image", files={"image": ("n.png", png_bytes, "image/png")})
    assert r.status_code == 200
    assert u.c.get("/" + a["image_url"]).status_code == 404       # old receipt of A removed
    assert u.c.get("/" + r.json()["image_url"]).status_code == 200
    assert u.c.get("/" + b["image_url"]).status_code == 200       # B untouched
    assert u.delete(f"/cars/{car['id']}/records/{a['id']}/image").json()["image_url"] is None


# ---- isolation --------------------------------------------------------------------------------

def test_warnings_and_overview_are_private_to_the_owner(make_user):
    a, b = make_user(), make_user()
    car = a.make_car()
    a.add_record(car["id"], service_date=_d(100), title="A", odometer_km="100000")
    a.add_record(car["id"], service_date=_d(10), title="B", odometer_km="90000")
    assert b.get(f"/cars/{car['id']}/overview").status_code == 403
    assert a.get(f"/cars/{car['id']}/overview").json()["warnings"]
    # same-looking data on another user's vehicle is evaluated independently
    other = b.make_car()
    r = b.add_record(other["id"], service_date=_d(10), title="B", odometer_km="90000")
    assert r.json()["warnings"] == []
