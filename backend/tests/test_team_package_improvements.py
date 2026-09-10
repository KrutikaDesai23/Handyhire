import pytest
from datetime import date

from app import models
from app.auth import security
from app.models.user import User
from app.models.worker_profile import WorkerProfile


def _make_worker(db, name, email, mobile, profession):
    user = User(
        full_name=name,
        email=email,
        mobile_number=mobile,
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(user)
    db.flush()
    profile = WorkerProfile(
        user_id=user.id,
        profession=profession,
        location="Downtown",
        price=500,
    )
    db.add(profile)
    db.flush()
    db.refresh(user)
    return user


def _make_team_package(db, owner, members, leader, name="Test Team"):
    pkg = models.Package(
        name=name,
        description="Team package",
        package_type="team",
        price=1000,
        status="published",
        owner_id=owner.id,
    )
    db.add(pkg)
    db.flush()

    for member in members:
        db.add(models.PackageWorker(
            package_id=pkg.id,
            worker_id=member.id,
            is_leader=(member.id == leader.id),
        ))
    db.commit()
    db.refresh(pkg)
    return pkg


def _create_team_booking(db, customer, pkg, members):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=pkg.owner_id,
        package_id=pkg.id,
        booking_date=date(2026, 9, 1),
        booking_time="10:00",
        address="123 Test St",
        amount=pkg.price,
        status="accepted",
    )
    db.add(booking)
    db.flush()

    for member in members:
        db.add(models.BookingWorker(
            booking_id=booking.id,
            worker_id=member.id,
            status="accepted",
        ))
    db.commit()
    db.refresh(booking)
    return booking


def _customer_headers(customer):
    token = security.create_access_token({"sub": str(customer.id), "role": "customer"})
    return {"Authorization": f"Bearer {token}"}


def _worker_headers(worker):
    token = security.create_access_token({"sub": str(worker.id), "role": "worker"})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------
# A. Team package with 2 members
# ---------------------------------------------------------
def test_team_package_two_members(client, db, customer):
    owner = _make_worker(db, "Owner", "owner@example.com", "1111111111", "Manager")
    m1 = _make_worker(db, "John", "john@example.com", "2222222222", "Electrician")
    m2 = _make_worker(db, "Mike", "mike@example.com", "3333333333", "Plumber")

    pkg = _make_team_package(db, owner, [m1, m2], m1)

    rows = (
        db.query(models.PackageWorker)
        .filter(models.PackageWorker.package_id == pkg.id)
        .all()
    )
    assert len(rows) == 2
    leaders = [r for r in rows if r.is_leader]
    assert len(leaders) == 1
    assert leaders[0].worker_id == m1.id


# ---------------------------------------------------------
# B. Team package with 3 members + professions
# ---------------------------------------------------------
def test_team_package_three_members_professions(client, db, customer):
    owner = _make_worker(db, "Owner", "owner2@example.com", "1111111112", "Manager")
    m1 = _make_worker(db, "John", "john2@example.com", "2222222223", "Electrician")
    m2 = _make_worker(db, "Mike", "mike2@example.com", "3333333334", "Plumber")
    m3 = _make_worker(db, "Sarah", "sarah@example.com", "4444444444", "Carpenter")

    pkg = _make_team_package(db, owner, [m1, m2, m3], m2)

    resp = client.get(f"/api/packages/{pkg.id}")
    data = resp.json()
    assert len(data["workers"]) == 3
    professions = {w["worker_id"]: w["profession"] for w in data["workers"]}
    assert professions[m1.id] == "Electrician"
    assert professions[m2.id] == "Plumber"
    assert professions[m3.id] == "Carpenter"


# ---------------------------------------------------------
# C. Leader phone in customer booking detail
# ---------------------------------------------------------
def test_customer_booking_detail_leader_phone(client, db, customer):
    owner = _make_worker(db, "Owner", "owner3@example.com", "1111111113", "Manager")
    m1 = _make_worker(db, "John", "john3@example.com", "2222222224", "Electrician")
    m2 = _make_worker(db, "Mike", "mike3@example.com", "3333333335", "Plumber")

    pkg = _make_team_package(db, owner, [m1, m2], m1)
    booking = _create_team_booking(db, customer, pkg, [m1, m2])

    resp = client.get(
        f"/api/bookings/customer/bookings/{booking.id}",
        headers=_customer_headers(customer),
    )
    assert resp.status_code == 200
    data = resp.json()
    # Leader is m1 (John) -> phone 2222222224, NOT owner 1111111113
    assert data["worker_phone"] == "2222222224"
    assert data["worker_name"] == "John"


# ---------------------------------------------------------
# D. Leader contact in provider booking detail
# ---------------------------------------------------------
def test_provider_booking_detail_leader_contact(client, db, customer):
    owner = _make_worker(db, "Owner", "owner4@example.com", "1111111114", "Manager")
    m1 = _make_worker(db, "John", "john4@example.com", "2222222225", "Electrician")
    m2 = _make_worker(db, "Mike", "mike4@example.com", "3333333336", "Plumber")

    pkg = _make_team_package(db, owner, [m1, m2], m2)
    booking = _create_team_booking(db, customer, pkg, [m1, m2])

    resp = client.get(
        f"/api/worker/bookings/{booking.id}",
        headers=_worker_headers(m1),
    )
    assert resp.status_code == 200
    data = resp.json()
    # Leader is m2 (Mike) -> phone 3333333336
    assert data["worker_phone"] == "3333333336"
    assert data["worker_name"] == "Mike"


# ---------------------------------------------------------
# E. Customer booking details: all members, profession, leader
# ---------------------------------------------------------
def test_customer_booking_details_members(client, db, customer):
    owner = _make_worker(db, "Owner", "owner5@example.com", "1111111115", "Manager")
    m1 = _make_worker(db, "John", "john5@example.com", "2222222226", "Electrician")
    m2 = _make_worker(db, "Mike", "mike5@example.com", "3333333337", "Plumber")

    pkg = _make_team_package(db, owner, [m1, m2], m1)
    booking = _create_team_booking(db, customer, pkg, [m1, m2])

    resp = client.get(
        f"/api/bookings/customer/bookings/{booking.id}",
        headers=_customer_headers(customer),
    )
    data = resp.json()
    members = data["team_members"]
    assert len(members) == 2
    by_id = {m["worker_id"]: m for m in members}
    assert by_id[m1.id]["profession"] == "Electrician"
    assert by_id[m1.id]["is_leader"] is True
    assert by_id[m2.id]["profession"] == "Plumber"
    assert by_id[m2.id]["is_leader"] is False


# ---------------------------------------------------------
# F. Provider booking details: all members, profession, leader
# ---------------------------------------------------------
def test_provider_booking_details_members(client, db, customer):
    owner = _make_worker(db, "Owner", "owner6@example.com", "1111111116", "Manager")
    m1 = _make_worker(db, "John", "john6@example.com", "2222222227", "Electrician")
    m2 = _make_worker(db, "Mike", "mike6@example.com", "3333333338", "Plumber")

    pkg = _make_team_package(db, owner, [m1, m2], m2)
    booking = _create_team_booking(db, customer, pkg, [m1, m2])

    resp = client.get(
        f"/api/worker/bookings/{booking.id}",
        headers=_worker_headers(m1),
    )
    data = resp.json()
    members = data["team_members"]
    assert len(members) == 2
    by_id = {m["worker_id"]: m for m in members}
    assert by_id[m1.id]["profession"] == "Electrician"
    assert by_id[m1.id]["is_leader"] is False
    assert by_id[m2.id]["profession"] == "Plumber"
    assert by_id[m2.id]["is_leader"] is True


# ---------------------------------------------------------
# G. Individual booking: worker phone stays the worker's
# ---------------------------------------------------------
def test_individual_booking_worker_phone(client, db, customer, worker):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 9, 1),
        booking_time="10:00",
        address="123 Test St",
        amount=500,
        status="accepted",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    resp = client.get(
        f"/api/bookings/customer/bookings/{booking.id}",
        headers=_customer_headers(customer),
    )
    data = resp.json()
    assert data["worker_phone"] == worker.mobile_number
    assert data["worker_name"] == worker.full_name


# ---------------------------------------------------------
# H. Multitasking package: worker phone stays owner's
# ---------------------------------------------------------
def test_multitasking_package_worker_phone(client, db, customer):
    owner = _make_worker(db, "Owner", "owner7@example.com", "1111111117", "Manager")
    pkg = models.Package(
        name="Multi",
        description="Multitasking",
        package_type="multitasking",
        price=800,
        status="published",
        owner_id=owner.id,
    )
    db.add(pkg)
    db.commit()
    db.refresh(pkg)

    booking = models.Booking(
        customer_id=customer.id,
        worker_id=owner.id,
        package_id=pkg.id,
        booking_date=date(2026, 9, 1),
        booking_time="10:00",
        address="123 Test St",
        amount=pkg.price,
        status="accepted",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    resp = client.get(
        f"/api/bookings/customer/bookings/{booking.id}",
        headers=_customer_headers(customer),
    )
    data = resp.json()
    # Multitasking: worker_phone remains the owner's phone
    assert data["worker_phone"] == owner.mobile_number
    assert data["worker_name"] == owner.full_name


# ---------------------------------------------------------
# I. Provider request includes team members
# ---------------------------------------------------------
def test_provider_request_includes_team(client, db, customer):
    owner = _make_worker(db, "Owner", "owner8@example.com", "1111111118", "Manager")
    m1 = _make_worker(db, "John", "john8@example.com", "2222222228", "Electrician")
    m2 = _make_worker(db, "Mike", "mike8@example.com", "3333333339", "Plumber")

    pkg = _make_team_package(db, owner, [m1, m2], m1)
    booking = _create_team_booking(db, customer, pkg, [m1, m2])

    req = models.BookingRequest(
        booking_id=booking.id,
        worker_id=m1.id,
        customer_id=customer.id,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    resp = client.get(
        f"/api/worker/requests/{req.id}",
        headers=_worker_headers(m1),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["team_members"]) == 2
    by_id = {m["worker_id"]: m for m in data["team_members"]}
    assert by_id[m1.id]["is_leader"] is True
    assert by_id[m1.id]["profession"] == "Electrician"
    assert by_id[m2.id]["profession"] == "Plumber"
