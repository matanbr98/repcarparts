def test_create_and_list_car(make_user):
    u = make_user()
    car = u.make_car(nickname="zoom", make="honda", model="civic", year=2020, license_plate="99-999-99")
    assert car["nickname"] == "zoom" and car["user_id"] == u.user_id
    listed = u.get("/cars").json()
    assert [c["id"] for c in listed] == [car["id"]]


def test_update_car_partial(make_user):
    u = make_user()
    car = u.make_car()
    r = u.put(f"/cars/{car['id']}", json={"nickname": "renamed", "year": 2019})
    assert r.status_code == 200
    b = r.json()
    assert b["nickname"] == "renamed" and b["year"] == 2019
    assert b["make"] == car["make"] and b["model"] == car["model"]  # untouched
    assert u.get("/cars").json()[0]["nickname"] == "renamed"


def test_update_missing_car_404(alice):
    r = alice.put("/cars/99999999", json={"nickname": "x"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_create_car_validation(alice):
    r = alice.post("/cars", json={"nickname": "no make"})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_delete_car_removes_records_and_nulls_reminder_car(make_user):
    u = make_user()
    car = u.make_car()
    u.add_record(car["id"], title="r1")
    rem = u.post("/me/reminders", json={"title": "check", "car_id": car["id"]})
    assert u.delete(f"/cars/{car['id']}").status_code == 200
    assert u.get("/cars").json() == []
    assert u.get(f"/cars/{car['id']}/records").status_code == 404
    if rem.status_code in (200, 201):
        left = [x for x in u.get("/me/reminders").json() if x["id"] == rem.json()["id"]]
        assert left and left[0]["car_id"] is None  # contract s2: car_id set null


def test_cars_require_auth(client):
    assert client.get("/cars").status_code == 401
    assert client.post("/cars", json={"nickname": "a", "make": "b", "model": "c"}).status_code == 401


def test_get_single_car_owner_and_forbidden(make_user):
    a, b = make_user(), make_user()
    car = a.make_car()
    ok = a.get(f"/cars/{car['id']}")
    assert ok.status_code == 200 and ok.json()["id"] == car["id"]
    assert b.get(f"/cars/{car['id']}").status_code == 403
    r = a.get("/cars/99999999")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"
