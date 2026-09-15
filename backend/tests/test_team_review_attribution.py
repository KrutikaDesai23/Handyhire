from datetime import date

from app import models
from app.auth import security
from app.models.user import User


def test_team_package_review_is_attributed_to_leader(client, db, customer):
    owner = User(
        full_name="Package Owner",
        email="review-owner@example.com",
        mobile_number="9100000001",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    leader = User(
        full_name="Team Leader",
        email="review-leader@example.com",
        mobile_number="9100000002",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    member = User(
        full_name="Team Member",
        email="review-member@example.com",
        mobile_number="9100000003",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add_all([owner, leader, member])
    db.flush()

    package = models.Package(
        name="Review Team Package",
        package_type="team",
        price=1200,
        owner_id=owner.id,
        status="published",
    )
    db.add(package)
    db.flush()
    db.add_all([
        models.PackageWorker(package_id=package.id, worker_id=leader.id, is_leader=True),
        models.PackageWorker(package_id=package.id, worker_id=member.id, is_leader=False),
    ])

    # Simulate a historical team booking where worker_id still points to the
    # package owner. Review attribution must still resolve the actual leader.
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=owner.id,
        package_id=package.id,
        booking_date=date(2099, 9, 1),
        booking_time="10:00",
        hours=1,
        address="123 Review St",
        amount=1200,
        status="completed",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    token = security.create_access_token({"sub": str(customer.id), "role": customer.role})
    response = client.post(
        "/api/reviews",
        headers={"Authorization": f"Bearer {token}"},
        json={"booking_id": booking.id, "rating": 5, "comment": "Great team"},
    )

    assert response.status_code == 201
    assert response.json()["worker_id"] == leader.id

    stored = db.query(models.Review).filter(models.Review.booking_id == booking.id).first()
    assert stored is not None
    assert stored.worker_id == leader.id
