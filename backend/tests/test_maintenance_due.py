from datetime import date, timedelta

import pytest


def _d(days_ago):
    return (date.today() - timedelta(days=days_ago)).isoformat()


def _items(u, car_id):
    r = u.get(f"/cars/{car_id}/maintenance-due")
    assert r.status_code == 200, r.text
    return {i["part"]: i for i in r.json()}


@pytest.fixture()
def uc(make_user):
    u = make_user()
    return u, u.make_car()


def test_item_shape(uc):
    u, car = uc
    u.add_record(car["id"], service_date=_d(10), treatment_type="oil_change", odometer_km=50000)
    it = _items(u, car["id"])["oil_change"]
    for k in ("part", "label", "last_service_date", "last_service_km", "due_date", "due_km",
              "remaining_days", "remaining_km", "progress", "status"):
        assert k in it
    assert it["last_service_km"] == 50000 and it["due_km"] == 60000
    assert it["due_date"] == (date.today() - timedelta(days=10) + timedelta(days=180)).isoformat()
    assert it["remaining_days"] == 170
    assert 0 <= it["progress"] <= 1


def test_date_based_ok(uc):
    u, car = uc
    u.add_record(car["id"], service_date=_d(10), treatment_type="oil_change")
    assert _items(u, car["id"])["oil_change"]["status"] == "ok"


def test_date_based_due_soon(uc):
    u, car = uc
    u.add_record(car["id"], service_date=_d(180 - 10), treatment_type="oil_change")  # 10 days left (<=21)
    assert _items(u, car["id"])["oil_change"]["status"] == "due_soon"


def test_date_based_overdue(uc):
    u, car = uc
    u.add_record(car["id"], service_date=_d(200), treatment_type="oil_change")
    it = _items(u, car["id"])["oil_change"]
    assert it["status"] == "overdue" and it["remaining_days"] == -20 and it["progress"] == 1.0


def test_date_boundary_21_days_is_due_soon_22_is_ok(make_user):
    u = make_user()
    c1, c2 = u.make_car(), u.make_car()
    u.add_record(c1["id"], service_date=_d(180 - 21), treatment_type="oil_change")
    u.add_record(c2["id"], service_date=_d(180 - 22), treatment_type="oil_change")
    assert _items(u, c1["id"])["oil_change"]["status"] == "due_soon"
    assert _items(u, c2["id"])["oil_change"]["status"] == "ok"


def test_km_based_overdue(uc):
    u, car = uc
    u.add_record(car["id"], service_date=_d(5), treatment_type="oil_change", odometer_km=50000)
    u.add_record(car["id"], service_date=_d(1), treatment_type="other", odometer_km=60500)  # current km
    it = _items(u, car["id"])["oil_change"]
    assert it["status"] == "overdue" and it["remaining_km"] == -500


def test_km_based_due_soon(uc):
    u, car = uc
    u.add_record(car["id"], service_date=_d(5), treatment_type="oil_change", odometer_km=50000)
    u.add_record(car["id"], service_date=_d(1), treatment_type="other", odometer_km=59200)
    it = _items(u, car["id"])["oil_change"]
    assert it["status"] == "due_soon" and it["remaining_km"] == 800


def test_km_based_ok(uc):
    u, car = uc
    u.add_record(car["id"], service_date=_d(5), treatment_type="oil_change", odometer_km=50000)
    u.add_record(car["id"], service_date=_d(1), treatment_type="other", odometer_km=52000)
    assert _items(u, car["id"])["oil_change"]["status"] == "ok"


def test_worst_threshold_wins_and_progress_is_max(uc):
    u, car = uc
    # date: 100/180 elapsed (0.55) ; km: 9000/10000 elapsed (0.9) -> progress 0.9, due_soon by km
    u.add_record(car["id"], service_date=_d(100), treatment_type="oil_change", odometer_km=50000)
    u.add_record(car["id"], service_date=_d(1), treatment_type="other", odometer_km=59000)
    it = _items(u, car["id"])["oil_change"]
    assert it["status"] == "due_soon"
    assert it["progress"] == pytest.approx(0.9, abs=0.02)


def test_intervals_per_type(uc):
    u, car = uc
    u.add_record(car["id"], service_date=_d(0), treatment_type="tires", odometer_km=10000, title="t")
    u.add_record(car["id"], service_date=_d(0), treatment_type="brake_pads", odometer_km=10000, title="b")
    u.add_record(car["id"], service_date=_d(0), treatment_type="air_filter", odometer_km=10000, title="a")
    u.add_record(car["id"], service_date=_d(0), treatment_type="battery", title="bat")
    items = _items(u, car["id"])
    assert items["tires"]["due_km"] == 60000
    assert items["brake_pads"]["due_km"] == 50000
    assert items["air_filter"]["due_km"] == 30000
    assert items["battery"]["due_date"] == (date.today() + timedelta(days=1095)).isoformat()


def test_untracked_types_not_listed_as_due(uc):
    u, car = uc
    u.add_record(car["id"], service_date=_d(0), treatment_type="wipers", title="w")
    # contract: lights/wipers/other are not tracked. AMBIGUOUS whether they appear at all;
    # if present they must not be flagged overdue.
    it = _items(u, car["id"]).get("wipers")
    assert it is None or it["status"] in ("ok", "unknown")


def test_unknown_when_never_serviced(uc):
    u, car = uc
    # AMBIGUOUS: contract says `unknown` if never serviced; unclear whether tracked parts are
    # listed with status unknown for a brand-new car, or the list is empty. Either is accepted,
    # but nothing may be reported ok/overdue.
    items = _items(u, car["id"])
    assert all(i["status"] == "unknown" for i in items.values())


def test_legacy_record_without_treatment_type_substring_fallback(uc):
    u, car = uc
    u.add_record(car["id"], service_date=_d(300), title="Oil change", parts_replaced="oil filter")
    # AMBIGUOUS: key naming of legacy-derived items is not specified; require that some item
    # mentioning "oil" is produced from the legacy substring match and is overdue (300d > 180d).
    items = _items(u, car["id"])
    oil = [i for k, i in items.items() if "oil" in k.lower() or "oil" in str(i.get("label", "")).lower()]
    assert oil, f"no oil item derived from legacy record: {list(items)}"
    assert any(i["status"] == "overdue" for i in oil)
