import io

from fastapi.testclient import TestClient

from app import models
from app.auth import security


def _png_bytes():
    return b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def _worker_token(worker):
    return security.create_access_token({"sub": str(worker.id), "role": "worker"})


def _make_work_photo(db, worker, image_url="http://127.0.0.1:8000/static/worker-work-photos/work-a.png"):
    photo = models.WorkerWorkPhoto(
        worker_id=worker.id,
        image_url=image_url,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


def test_worker_can_upload_work_photo(client, worker, db):
    token = _worker_token(worker)
    resp = client.post(
        "/api/worker/work-photos",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("work.png", io.BytesIO(_png_bytes()), "image/png")},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["worker_id"] == worker.id
    assert "/static/worker-work-photos/" in body["image_url"]


def test_worker_can_list_own_work_photos(client, worker, db):
    _make_work_photo(db, worker, "http://127.0.0.1:8000/static/worker-work-photos/one.png")
    _make_work_photo(db, worker, "http://127.0.0.1:8000/static/worker-work-photos/two.png")

    token = _worker_token(worker)
    resp = client.get(
        "/api/worker/work-photos",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    photos = resp.json()
    assert len(photos) == 2
    assert all(p["worker_id"] == worker.id for p in photos)


def test_worker_cannot_delete_another_workers_photo(client, worker, db):
    other = models.User(
        full_name="Other Worker",
        email="other_worker@example.com",
        mobile_number="3333333333",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(other)
    db.commit()
    db.refresh(other)

    photo = _make_work_photo(db, other)

    token = _worker_token(worker)
    resp = client.delete(
        f"/api/worker/work-photos/{photo.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404, resp.text

    # Photo must still exist in DB.
    db.expire_all()
    still = db.query(models.WorkerWorkPhoto).filter(models.WorkerWorkPhoto.id == photo.id).first()
    assert still is not None


def test_worker_can_delete_own_photo(client, worker, db):
    photo = _make_work_photo(db, worker)
    token = _worker_token(worker)

    resp = client.delete(
        f"/api/worker/work-photos/{photo.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204, resp.text

    db.expire_all()
    still = db.query(models.WorkerWorkPhoto).filter(models.WorkerWorkPhoto.id == photo.id).first()
    assert still is None


def test_customer_can_view_worker_work_photos(client, customer, worker, db):
    photo = _make_work_photo(db, worker)
    customer_token = security.create_access_token(
        {"sub": str(customer.id), "role": "customer"}
    )

    resp = client.get(
        f"/api/workers/{worker.id}/work-photos",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert resp.status_code == 200
    photos = resp.json()
    assert len(photos) == 1
    assert photos[0]["id"] == photo.id
    assert photos[0]["image_url"] == photo.image_url
    # Public response must not expose private info.
    assert "mobile_number" not in photos[0]
    assert "email" not in photos[0]


def test_public_view_does_not_require_auth(client, worker, db):
    _make_work_photo(db, worker)
    resp = client.get(f"/api/workers/{worker.id}/work-photos")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_invalid_file_type_rejected(client, worker, db):
    token = _worker_token(worker)
    resp = client.post(
        "/api/worker/work-photos",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("work.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert resp.status_code == 415, resp.text


def test_file_larger_than_5mb_rejected(client, worker, db):
    token = _worker_token(worker)
    # 5MB + 1 byte
    big = b"\x00" * (5 * 1024 * 1024 + 1)
    resp = client.post(
        "/api/worker/work-photos",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("big.png", io.BytesIO(big), "image/png")},
    )
    assert resp.status_code == 413, resp.text
