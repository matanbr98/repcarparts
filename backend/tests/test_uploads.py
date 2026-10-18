import re
from pathlib import Path

import pytest

UUID_RE = re.compile(r"^[0-9a-fA-F-]{32,36}\.(png|jpg|jpeg|webp)$")


def _disk(upload_dir, image_url):
    assert image_url.startswith("uploads/")
    return upload_dir / Path(image_url).name


@pytest.fixture()
def car_user(make_user):
    u = make_user()
    return u, u.make_car()


@pytest.mark.parametrize("fname,ctype,fixture", [
    ("r.png", "image/png", "png_bytes"),
    ("r.jpg", "image/jpeg", "jpeg_bytes"),
    ("r.webp", "image/webp", "webp_bytes"),
])
def test_accepts_allowed_images(car_user, upload_dir, request, fname, ctype, fixture):
    u, car = car_user
    data = request.getfixturevalue(fixture)
    r = u.add_record(car["id"], image=(fname, data, ctype))
    assert r.status_code in (200, 201), r.text
    url = r.json()["image_url"]
    assert _disk(upload_dir, url).exists()
    assert _disk(upload_dir, url).read_bytes() == data


def test_filename_is_server_generated_uuid(car_user, upload_dir, png_bytes):
    u, car = car_user
    url = u.add_record(car["id"], image=("my receipt.png", png_bytes, "image/png")).json()["image_url"]
    name = Path(url).name
    assert "receipt" not in name
    assert UUID_RE.match(name), name


def test_same_filename_does_not_collide(car_user, upload_dir, png_bytes, jpeg_bytes):
    u, car = car_user
    a = u.add_record(car["id"], title="a", image=("same.png", png_bytes, "image/png")).json()["image_url"]
    b = u.add_record(car["id"], title="b", image=("same.png", jpeg_bytes, "image/jpeg")).json()["image_url"]
    assert a != b
    assert _disk(upload_dir, a).read_bytes() == png_bytes
    assert _disk(upload_dir, b).read_bytes() != png_bytes


def test_rejects_text_renamed_png(car_user, upload_dir):
    u, car = car_user
    before = set(upload_dir.glob("*")) if upload_dir.exists() else set()
    r = u.add_record(car["id"], image=("evil.png", b"this is just text, not an image", "image/png"))
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "unsupported_media"
    after = set(upload_dir.glob("*")) if upload_dir.exists() else set()
    assert before == after, "rejected upload left a file on disk"
    assert u.get(f"/cars/{car['id']}/records").json() == []  # no half-created record


def test_rejects_html_with_image_content_type(car_user):
    u, car = car_user
    r = u.add_record(car["id"], image=("x.jpg", b"<html><script>alert(1)</script></html>", "image/jpeg"))
    assert r.status_code == 415


def test_rejects_oversize(car_user, png_bytes):
    u, car = car_user
    big = png_bytes + b"\x00" * (5 * 1024 * 1024)
    r = u.add_record(car["id"], image=("big.png", big, "image/png"))
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "file_too_large"


def test_path_traversal_filename_is_harmless(car_user, upload_dir, png_bytes):
    u, car = car_user
    r = u.add_record(car["id"], image=("../../evil.png", png_bytes, "image/png"))
    assert r.status_code in (200, 201, 415, 422)
    if r.status_code in (200, 201):
        url = r.json()["image_url"]
        assert ".." not in url and "\\" not in url and url.count("/") == 1
        assert _disk(upload_dir, url).exists()
    assert not (upload_dir.parent / "evil.png").exists()
    assert not (upload_dir.parent.parent / "evil.png").exists()


def test_replace_receipt_deletes_old_file(car_user, upload_dir, png_bytes, jpeg_bytes):
    u, car = car_user
    rec = u.add_record(car["id"], image=("a.png", png_bytes, "image/png")).json()
    old = _disk(upload_dir, rec["image_url"])
    assert old.exists()
    r = u.put(f"/cars/{car['id']}/records/{rec['id']}/image", files={"image": ("b.jpg", jpeg_bytes, "image/jpeg")})
    assert r.status_code == 200, r.text
    new_url = r.json()["image_url"]
    assert new_url != rec["image_url"]
    assert _disk(upload_dir, new_url).exists()
    assert not old.exists()


def test_remove_receipt_deletes_file(car_user, upload_dir, png_bytes):
    u, car = car_user
    rec = u.add_record(car["id"], image=("a.png", png_bytes, "image/png")).json()
    f = _disk(upload_dir, rec["image_url"])
    r = u.delete(f"/cars/{car['id']}/records/{rec['id']}/image")
    assert r.status_code in (200, 204)
    assert not f.exists()
    got = [x for x in u.get(f"/cars/{car['id']}/records").json() if x["id"] == rec["id"]][0]
    assert got["image_url"] is None


def test_delete_record_removes_receipt_file(car_user, upload_dir, png_bytes):
    """AMBIGUOUS: contract only explicitly requires cleanup on replace/remove; deleting the
    record is the natural extension (avoids orphans)."""
    u, car = car_user
    rec = u.add_record(car["id"], image=("a.png", png_bytes, "image/png")).json()
    f = _disk(upload_dir, rec["image_url"])
    u.delete(f"/cars/{car['id']}/records/{rec['id']}")
    assert not f.exists()


def test_uploaded_file_is_served(client, car_user, png_bytes):
    u, car = car_user
    url = u.add_record(car["id"], image=("a.png", png_bytes, "image/png")).json()["image_url"]
    r = client.get("/" + url)
    assert r.status_code == 200 and r.content == png_bytes


def test_profile_picture_upload_and_replace(make_user, upload_dir, png_bytes, jpeg_bytes):
    u = make_user()
    r = u.post("/me/profile-picture", files={"file": ("p.png", png_bytes, "image/png")})
    if r.status_code == 422:  # field name may be `image` or `file`; v1 name is checked below
        r = u.post("/me/profile-picture", files={"image": ("p.png", png_bytes, "image/png")})
    assert r.status_code == 200, r.text
    first = r.json()["profile_image_url"]
    assert _disk(upload_dir, first).exists()
    r2 = u.post("/me/profile-picture", files={"file": ("q.jpg", jpeg_bytes, "image/jpeg")})
    if r2.status_code == 422:
        r2 = u.post("/me/profile-picture", files={"image": ("q.jpg", jpeg_bytes, "image/jpeg")})
    assert r2.status_code == 200
    assert not _disk(upload_dir, first).exists()
    bad = u.post("/me/profile-picture", files={"file": ("x.png", b"text", "image/png")})
    assert bad.status_code in (415, 422)
