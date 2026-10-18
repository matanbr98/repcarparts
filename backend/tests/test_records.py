import csv
import io

import pytest


def _ids(resp):
    return [r["id"] for r in resp.json()]


def test_create_record_roundtrip(make_user):
    u = make_user()
    car = u.make_car()
    r = u.add_record(car["id"], service_date="2026-03-01", title="Oil", odometer_km=1234, cost=250,
                     treatment_type="oil_change", parts_replaced="filter", notes="n")
    assert r.status_code in (200, 201), r.text
    b = r.json()
    assert b["service_date"] == "2026-03-01" and b["odometer_km"] == 1234 and b["cost"] == 250
    assert b["car_id"] == car["id"] and b["image_url"] is None


@pytest.mark.parametrize("bad", ["2026-13-45", "not-a-date", "01/02/2026", ""])
def test_create_record_invalid_date_is_422(make_user, bad):
    u = make_user()
    car = u.make_car()
    r = u.add_record(car["id"], service_date=bad)
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "validation_error"


def test_update_record(seeded_car):
    s = seeded_car
    rid = s.record_ids[0]
    r = s.user.put(f"/cars/{s.car['id']}/records/{rid}", json={"title": "Changed", "cost": 1, "service_date": "2025-07-01"})
    assert r.status_code == 200
    assert r.json()["title"] == "Changed" and r.json()["cost"] == 1 and r.json()["service_date"] == "2025-07-01"


def test_update_record_invalid_date(seeded_car):
    s = seeded_car
    r = s.user.put(f"/cars/{s.car['id']}/records/{s.record_ids[0]}", json={"service_date": "garbage"})
    assert r.status_code == 422


def test_delete_record(seeded_car):
    s = seeded_car
    assert s.user.delete(f"/cars/{s.car['id']}/records/{s.record_ids[0]}").status_code == 200
    assert s.record_ids[0] not in _ids(s.user.get(f"/cars/{s.car['id']}/records"))


def test_delete_missing_record_404(seeded_car):
    s = seeded_car
    assert s.user.delete(f"/cars/{s.car['id']}/records/99999999").status_code == 404


def test_default_order_newest_first_then_id_desc(seeded_car):
    s = seeded_car
    got = _ids(s.user.get(f"/cars/{s.car['id']}/records"))
    ids = s.record_ids
    assert got == [ids[3], ids[1], ids[2], ids[0]]


def test_filter_q_matches_title_notes_parts(seeded_car):
    s = seeded_car
    url = f"/cars/{s.car['id']}/records"
    ids = s.record_ids
    assert set(_ids(s.user.get(url, params={"q": "tires"}))) == {ids[1]}      # title + parts
    assert set(_ids(s.user.get(url, params={"q": "squeal"}))) == {ids[2]}     # notes
    assert set(_ids(s.user.get(url, params={"q": "front pads"}))) == {ids[2]}  # parts
    assert _ids(s.user.get(url, params={"q": "zzzz-nothing"})) == []


def test_filter_type(seeded_car):
    s = seeded_car
    url = f"/cars/{s.car['id']}/records"
    got = _ids(s.user.get(url, params={"type": "oil_change"}))
    assert got == [s.record_ids[3], s.record_ids[0]]


def test_filter_year(seeded_car):
    s = seeded_car
    url = f"/cars/{s.car['id']}/records"
    assert set(_ids(s.user.get(url, params={"year": 2025}))) == {s.record_ids[0], s.record_ids[2]}
    assert set(_ids(s.user.get(url, params={"year": 2026}))) == {s.record_ids[1], s.record_ids[3]}


def test_filter_date_range_inclusive(seeded_car):
    s = seeded_car
    url = f"/cars/{s.car['id']}/records"
    got = set(_ids(s.user.get(url, params={"date_from": "2025-12-15", "date_to": "2026-02-01"})))
    assert got == {s.record_ids[1], s.record_ids[2], s.record_ids[3]}
    assert set(_ids(s.user.get(url, params={"date_from": "2026-01-01"}))) == {s.record_ids[1], s.record_ids[3]}
    assert set(_ids(s.user.get(url, params={"date_to": "2025-12-01"}))) == {s.record_ids[0]}


def test_filters_combine(seeded_car):
    s = seeded_car
    url = f"/cars/{s.car['id']}/records"
    assert _ids(s.user.get(url, params={"type": "oil_change", "year": 2026})) == [s.record_ids[3]]


def test_csv_export(seeded_car):
    s = seeded_car
    r = s.user.get(f"/cars/{s.car['id']}/records.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert r.content.startswith(b"\xef\xbb\xbf"), "UTF-8 BOM missing"
    rows = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
    assert rows[0] == ["date", "title", "treatment_type", "odometer_km", "cost", "parts_replaced", "notes"]
    assert len(rows) == 5
    assert rows[1][:5] == ["2026-02-01", "Oil again", "oil_change", "61000", "350"]  # newest first
    assert rows[-1][1] == "Oil change summer" and rows[-1][5] == "oil filter" and rows[-1][6] == "castrol"


def test_csv_respects_filters(seeded_car):
    s = seeded_car
    r = s.user.get(f"/cars/{s.car['id']}/records.csv", params={"type": "tires"})
    rows = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
    assert len(rows) == 2 and rows[1][1] == "New tires"


def test_csv_hebrew_and_quoting(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], title='החלפת שמן, "מלא"', notes="שורה\nשנייה", service_date="2026-04-01")
    r = u.get(f"/cars/{car['id']}/records.csv")
    rows = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
    assert rows[1][1] == 'החלפת שמן, "מלא"'
    assert rows[1][6] == "שורה\nשנייה"


def test_csv_formula_injection_guard(make_user):
    """AMBIGUOUS (not in contract): spreadsheet formula injection. A title starting with '='
    should be neutralised (e.g. prefixed with an apostrophe). Remove if product disagrees."""
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], title="=HYPERLINK(\"http://evil\")", service_date="2026-04-01")
    body = u.get(f"/cars/{car['id']}/records.csv").content.decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(body)))
    assert not rows[1][1].startswith("=")
