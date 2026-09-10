import pytest
from datetime import date

from app import models
from app.models.user import User
from app.models.worker_profile import WorkerProfile


def _make_worker(db, name, email, mobile, profession, location, price, availability, experience=None):
    user = User(
        full_name=name,
        email=email,
        mobile_number=mobile,
        password_hash="x",
        role="worker",
    )
    db.add(user)
    db.flush()
    profile = WorkerProfile(
        user_id=user.id,
        profession=profession,
        location=location,
        price=price,
        availability=availability,
        experience=experience,
    )
    db.add(profile)
    db.flush()
    db.refresh(user)
    return user


def _make_review(db, worker, customer, rating):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 9, 1),
        booking_time="10:00",
        address="123 Test St",
        amount=500,
        status="completed",
    )
    db.add(booking)
    db.flush()
    review = models.Review(
        booking_id=booking.id,
        customer_id=customer.id,
        worker_id=worker.id,
        rating=rating,
    )
    db.add(review)
    db.flush()


def _make_customer(db):
    user = User(
        full_name="Customer",
        email="cust@example.com",
        mobile_number="9999999999",
        password_hash="x",
        role="customer",
    )
    db.add(user)
    db.flush()
    return user


# ---------------------------------------------------------
# 1. profession filter
# ---------------------------------------------------------
def test_profession_filter(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Canacona", 400, "both")
    resp = client.get("/api/workers?profession=Electrician")
    assert resp.status_code == 200
    data = resp.json()
    assert all(w["profession"] == "Electrician" for w in data)
    assert len(data) == 1


# ---------------------------------------------------------
# 2. location filter
# ---------------------------------------------------------
def test_location_filter(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 400, "both")
    resp = client.get("/api/workers?location=Canacona")
    data = resp.json()
    assert all(w["location"] == "Canacona" for w in data)
    assert len(data) == 1


# ---------------------------------------------------------
# 3. availability filter
# ---------------------------------------------------------
def test_availability_filter(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "pre-booking")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 400, "on-spot")
    resp = client.get("/api/workers?availability=pre-booking")
    data = resp.json()
    assert all("pre-booking" in (w["availability"] or "") for w in data)
    assert len(data) == 1


# ---------------------------------------------------------
# 4. min_price
# ---------------------------------------------------------
def test_min_price_filter(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 300, "both")
    resp = client.get("/api/workers?min_price=400")
    data = resp.json()
    assert all(w["price"] >= 400 for w in data)
    assert len(data) == 1


# ---------------------------------------------------------
# 5. max_price
# ---------------------------------------------------------
def test_max_price_filter(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 300, "both")
    resp = client.get("/api/workers?max_price=400")
    data = resp.json()
    assert all(w["price"] <= 400 for w in data)
    assert len(data) == 1


# ---------------------------------------------------------
# 6. combined price filters
# ---------------------------------------------------------
def test_combined_price_filters(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 300, "both")
    _make_worker(db, "Sara", "s@e.com", "3333333333", "Carpenter", "Margao", 450, "both")
    resp = client.get("/api/workers?min_price=350&max_price=480")
    data = resp.json()
    assert all(350 <= w["price"] <= 480 for w in data)
    assert len(data) == 1


# ---------------------------------------------------------
# 7-9. search by name / profession / location
# ---------------------------------------------------------
def test_search_by_name(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 400, "both")
    resp = client.get("/api/workers?search=John")
    data = resp.json()
    assert len(data) == 1
    assert data[0]["full_name"] == "John"


def test_search_by_profession(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 400, "both")
    resp = client.get("/api/workers?search=Plumber")
    data = resp.json()
    assert len(data) == 1
    assert data[0]["profession"] == "Plumber"


def test_search_by_location(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 400, "both")
    resp = client.get("/api/workers?search=Canacona")
    data = resp.json()
    assert len(data) == 1
    assert data[0]["location"] == "Canacona"


# ---------------------------------------------------------
# 10. combined filters
# ---------------------------------------------------------
def test_combined_filters(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Canacona", 300, "both")
    _make_worker(db, "Sara", "s@e.com", "3333333333", "Electrician", "Margao", 400, "both")
    resp = client.get("/api/workers?profession=Electrician&location=Canacona&max_price=600")
    data = resp.json()
    assert len(data) == 1
    assert data[0]["full_name"] == "John"


# ---------------------------------------------------------
# 11. min_rating
# ---------------------------------------------------------
def test_min_rating_filter(client, db):
    cust = _make_customer(db)
    w1 = _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    w2 = _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 400, "both")
    _make_review(db, w1, cust, 5)
    _make_review(db, w2, cust, 2)
    resp = client.get("/api/workers?min_rating=4")
    data = resp.json()
    assert len(data) == 1
    assert data[0]["full_name"] == "John"


def test_min_rating_excludes_no_review_workers(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    resp = client.get("/api/workers?min_rating=4")
    data = resp.json()
    assert len(data) == 0


# ---------------------------------------------------------
# 12. rating sort
# ---------------------------------------------------------
def test_rating_sort(client, db):
    cust = _make_customer(db)
    w1 = _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    w2 = _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 400, "both")
    _make_review(db, w1, cust, 5)
    _make_review(db, w2, cust, 2)
    resp = client.get("/api/workers?sort=rating")
    data = resp.json()
    ratings = [w["average_rating"] for w in data if w["average_rating"] is not None]
    assert ratings == sorted(ratings, reverse=True)


# ---------------------------------------------------------
# 13. price ascending
# ---------------------------------------------------------
def test_price_asc_sort(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 300, "both")
    resp = client.get("/api/workers?sort=price_asc")
    data = resp.json()
    prices = [w["price"] for w in data]
    assert prices == sorted(prices)


# ---------------------------------------------------------
# 14. price descending
# ---------------------------------------------------------
def test_price_desc_sort(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 300, "both")
    resp = client.get("/api/workers?sort=price_desc")
    data = resp.json()
    prices = [w["price"] for w in data]
    assert prices == sorted(prices, reverse=True)


# ---------------------------------------------------------
# 15. name sorting
# ---------------------------------------------------------
def test_name_sort(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    _make_worker(db, "Mike", "m@e.com", "2222222222", "Plumber", "Margao", 300, "both")
    _make_worker(db, "Alice", "a@e.com", "3333333333", "Carpenter", "Margao", 400, "both")
    resp = client.get("/api/workers?sort=name")
    data = resp.json()
    names = [w["full_name"] for w in data]
    assert names == sorted(names)


# ---------------------------------------------------------
# 16. invalid filter values
# ---------------------------------------------------------
def test_invalid_sort_rejected(client):
    resp = client.get("/api/workers?sort=bogus")
    assert resp.status_code == 422


def test_invalid_min_rating_rejected(client):
    resp = client.get("/api/workers?min_rating=6")
    assert resp.status_code == 422


# ---------------------------------------------------------
# 17. no parameters still works
# ---------------------------------------------------------
def test_no_params_still_works(client, db):
    _make_worker(db, "John", "j@e.com", "1111111111", "Electrician", "Canacona", 500, "both")
    resp = client.get("/api/workers")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1
