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


def _make_booking(db, customer, worker, status="pending"):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 9, 1),
        booking_time="10:00",
        address="123 Test St",
        amount=500,
        status=status,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def _worker_headers(worker):
    token = security.create_access_token({"sub": str(worker.id), "role": "worker"})
    return {"Authorization": f"Bearer {token}"}


def _customer_headers(customer):
    token = security.create_access_token({"sub": str(customer.id), "role": "customer"})
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------
# 1. accepted -> in_progress succeeds
# ---------------------------------------------------------
def test_accepted_to_in_progress(client, worker, customer, db):
    booking = _make_booking(db, customer, worker, status="accepted")
    resp = client.put(
        f"/api/worker/bookings/{booking.id}/status?new_status=in_progress",
        headers=_worker_headers(worker),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"


# ---------------------------------------------------------
# 2. in_progress -> completion_requested succeeds
# ---------------------------------------------------------
def test_in_progress_to_completion_requested(client, worker, customer, db):
    booking = _make_booking(db, customer, worker, status="in_progress")
    resp = client.put(
        f"/api/worker/bookings/{booking.id}/status?new_status=completion_requested",
        headers=_worker_headers(worker),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completion_requested"


# ---------------------------------------------------------
# 3. accepted -> completed is rejected
# ---------------------------------------------------------
def test_accepted_to_completed_rejected(client, worker, customer, db):
    booking = _make_booking(db, customer, worker, status="accepted")
    resp = client.put(
        f"/api/worker/bookings/{booking.id}/status?new_status=completed",
        headers=_worker_headers(worker),
    )
    assert resp.status_code == 400


# ---------------------------------------------------------
# 4. in_progress -> completed is rejected through worker endpoint
# ---------------------------------------------------------
def test_in_progress_to_completed_rejected(client, worker, customer, db):
    booking = _make_booking(db, customer, worker, status="in_progress")
    resp = client.put(
        f"/api/worker/bookings/{booking.id}/status?new_status=completed",
        headers=_worker_headers(worker),
    )
    assert resp.status_code == 400


# ---------------------------------------------------------
# 5. customer confirms completion -> completed
# ---------------------------------------------------------
def test_customer_confirms_completion(client, worker, customer, db):
    booking = _make_booking(db, customer, worker, status="completion_requested")
    resp = client.put(
        f"/api/customer/bookings/{booking.id}/confirm-completion",
        headers=_customer_headers(customer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "completed"


# ---------------------------------------------------------
# 6. customer rejects completion -> in_progress
# ---------------------------------------------------------
def test_customer_rejects_completion_returns_in_progress(client, worker, customer, db):
    booking = _make_booking(db, customer, worker, status="completion_requested")
    resp = client.put(
        f"/api/customer/bookings/{booking.id}/reject-completion",
        headers=_customer_headers(customer),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"


# ---------------------------------------------------------
# 7. team booking status remains coordinated
# ---------------------------------------------------------
def test_team_booking_coordinated_in_progress(client, db, customer):
    owner = _make_worker(db, "Owner", "owner@example.com", "1111111111", "Manager")
    m1 = _make_worker(db, "John", "john@example.com", "2222222222", "Electrician")
    m2 = _make_worker(db, "Mike", "mike@example.com", "3333333333", "Plumber")

    pkg = models.Package(
        name="Team",
        description="Team package",
        package_type="team",
        price=1000,
        status="published",
        owner_id=owner.id,
    )
    db.add(pkg)
    db.flush()
    db.add(models.PackageWorker(package_id=pkg.id, worker_id=m1.id, is_leader=True))
    db.add(models.PackageWorker(package_id=pkg.id, worker_id=m2.id, is_leader=False))
    db.commit()

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
    db.flush()
    # m1 already started; m2 still accepted
    db.add(models.BookingWorker(booking_id=booking.id, worker_id=m1.id, status="in_progress"))
    db.add(models.BookingWorker(booking_id=booking.id, worker_id=m2.id, status="accepted"))
    db.commit()
    db.refresh(booking)

    # m2 starts -> all members in_progress -> booking becomes in_progress
    resp = client.put(
        f"/api/worker/bookings/{booking.id}/status?new_status=in_progress",
        headers=_worker_headers(m2),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"


# ---------------------------------------------------------
# 8. team members cannot bypass the required sequence
# ---------------------------------------------------------
def test_team_member_cannot_skip_to_completion(client, db, customer):
    owner = _make_worker(db, "Owner", "owner2@example.com", "1111111112", "Manager")
    m1 = _make_worker(db, "John", "john2@example.com", "2222222223", "Electrician")
    m2 = _make_worker(db, "Mike", "mike2@example.com", "3333333334", "Plumber")

    pkg = models.Package(
        name="Team2",
        description="Team package",
        package_type="team",
        price=1000,
        status="published",
        owner_id=owner.id,
    )
    db.add(pkg)
    db.flush()
    db.add(models.PackageWorker(package_id=pkg.id, worker_id=m1.id, is_leader=True))
    db.add(models.PackageWorker(package_id=pkg.id, worker_id=m2.id, is_leader=False))
    db.commit()

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
    db.flush()
    db.add(models.BookingWorker(booking_id=booking.id, worker_id=m1.id, status="accepted"))
    db.add(models.BookingWorker(booking_id=booking.id, worker_id=m2.id, status="accepted"))
    db.commit()
    db.refresh(booking)

    # Member cannot jump accepted -> completion_requested (must go through in_progress)
    resp = client.put(
        f"/api/worker/bookings/{booking.id}/status?new_status=completion_requested",
        headers=_worker_headers(m1),
    )
    assert resp.status_code == 400


@pytest.mark.parametrize("new_status", ["accepted", "rejected"])
def test_team_package_decisions_must_use_requests_flow(client, db, customer, new_status):
    owner = _make_worker(db, "Package Owner", "team-owner@example.com", "1111111191", "Manager")
    leader = _make_worker(db, "Package Leader", "team-leader@example.com", "2222222291", "Electrician")
    member = _make_worker(db, "Package Member", "team-member@example.com", "3333333391", "Plumber")

    package = models.Package(
        name="Team Package",
        description="Competition team package",
        package_type="team",
        price=1500,
        status="published",
        owner_id=owner.id,
    )
    db.add(package)
    db.flush()
    db.add(models.PackageWorker(package_id=package.id, worker_id=leader.id, is_leader=True))
    db.add(models.PackageWorker(package_id=package.id, worker_id=member.id, is_leader=False))

    booking = models.Booking(
        customer_id=customer.id,
        worker_id=leader.id,
        package_id=package.id,
        booking_date=date(2026, 11, 20),
        booking_time="10:00",
        address="Competition demo address",
        amount=package.price,
        status="pending",
    )
    db.add(booking)
    db.flush()
    leader_assignment = models.BookingWorker(booking_id=booking.id, worker_id=leader.id, status="pending")
    member_assignment = models.BookingWorker(booking_id=booking.id, worker_id=member.id, status="pending")
    db.add_all([leader_assignment, member_assignment])
    db.add(models.BookingRequest(
        booking_id=booking.id,
        worker_id=leader.id,
        customer_id=customer.id,
        status="pending",
    ))
    db.commit()

    response = client.put(
        f"/api/worker/bookings/{booking.id}/status?new_status={new_status}",
        headers=_worker_headers(leader),
    )

    assert response.status_code == 400
    assert response.json()["detail"].startswith("Team package requests must be accepted or rejected")
    db.refresh(booking)
    db.refresh(leader_assignment)
    db.refresh(member_assignment)
    assert booking.status == "pending"
    assert leader_assignment.status == "pending"
    assert member_assignment.status == "pending"



def test_team_activity_returns_viewer_specific_progress(client, db, customer):
    owner = _make_worker(db, "Activity Owner", "activity-owner@example.com", "1111111181", "Manager")
    leader = _make_worker(db, "Activity Leader", "activity-leader@example.com", "2222222281", "Electrician")
    member = _make_worker(db, "Activity Member", "activity-member@example.com", "3333333381", "Plumber")

    package = models.Package(
        name="Activity Team Package",
        description="Team progress test",
        package_type="team",
        price=1500,
        status="published",
        owner_id=owner.id,
    )
    db.add(package)
    db.flush()
    db.add_all([
        models.PackageWorker(package_id=package.id, worker_id=leader.id, is_leader=True),
        models.PackageWorker(package_id=package.id, worker_id=member.id, is_leader=False),
    ])

    booking = models.Booking(
        customer_id=customer.id,
        worker_id=leader.id,
        package_id=package.id,
        booking_date=date(2026, 11, 20),
        booking_time="10:00",
        address="Competition demo address",
        amount=1500,
        status="accepted",
    )
    db.add(booking)
    db.flush()
    db.add_all([
        models.BookingWorker(booking_id=booking.id, worker_id=leader.id, status="in_progress"),
        models.BookingWorker(booking_id=booking.id, worker_id=member.id, status="accepted"),
    ])
    db.commit()

    response = client.get(
        "/api/worker/bookings",
        headers=_worker_headers(leader),
    )

    assert response.status_code == 200
    item = next(row for row in response.json() if row["id"] == booking.id)
    assert item["status"] == "accepted"
    assert item["viewer_status"] == "in_progress"


def test_customer_completion_response_preserves_package_type(client, worker, customer, db):
    package = models.Package(
        name="Completion Package",
        description="Package completion response regression",
        package_type="multitasking",
        price=1500,
        status="published",
        owner_id=worker.id,
    )
    db.add(package)
    db.flush()

    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        package_id=package.id,
        booking_date=date(2026, 11, 20),
        booking_time="10:00",
        address="123 Test St",
        amount=1500,
        status="completion_requested",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    response = client.put(
        f"/api/customer/bookings/{booking.id}/confirm-completion",
        headers=_customer_headers(customer),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    assert response.json()["package_id"] == package.id
    assert response.json()["package_type"] == "multitasking"


def test_team_member_can_cancel_accepted_team_booking(client, db, customer):
    owner = _make_worker(db, "Owner Cancel", "owner-cancel@example.com", "1111111198", "Manager")
    member = _make_worker(db, "Member Cancel", "member-cancel@example.com", "2222222298", "Electrician")
    other = _make_worker(db, "Other Cancel", "other-cancel@example.com", "3333333398", "Plumber")
    package = models.Package(name="Team Cancel", description="Team", package_type="team", price=1000, status="published", owner_id=owner.id)
    db.add(package)
    db.flush()
    booking = models.Booking(customer_id=customer.id, worker_id=member.id, package_id=package.id, booking_date=date(2026, 11, 20), booking_time="10:00", address="123 Test St", amount=1000, status="accepted")
    db.add(booking)
    db.flush()
    first = models.BookingWorker(booking_id=booking.id, worker_id=member.id, status="accepted")
    second = models.BookingWorker(booking_id=booking.id, worker_id=other.id, status="accepted")
    db.add_all([first, second])
    db.commit()
    response = client.put(f"/api/worker/bookings/{booking.id}/status?new_status=cancelled", headers=_worker_headers(member))
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert response.json()["viewer_status"] == "cancelled"
    db.refresh(booking)
    db.refresh(first)
    db.refresh(second)
    assert booking.status == "cancelled"
    assert first.status == "cancelled"
    assert second.status == "cancelled"
