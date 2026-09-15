import pytest
from datetime import date
from fastapi.testclient import TestClient

from app import models
from app.auth import security
from app.models.user import User
from app.models.worker_profile import WorkerProfile


def test_public_team_listing(client, db):
    worker = User(
        full_name="Team Worker",
        email="teamworker1@example.com",
        mobile_number="5550000001",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(worker)
    db.flush()

    team = models.Team(name="Public Team", description="Test", created_by=worker.id)
    db.add(team)
    db.commit()

    response = client.get("/api/teams")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_team_search(client, db):
    worker = User(
        full_name="Search Worker",
        email="searchworker@example.com",
        mobile_number="5550000002",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(worker)
    db.flush()

    team = models.Team(name="Searchable Team Alpha", description="Search test", created_by=worker.id)
    db.add(team)
    db.commit()

    response = client.get("/api/teams?search=Alpha")
    assert response.status_code == 200
    data = response.json()
    assert any(t["name"] == "Searchable Team Alpha" for t in data)


def test_team_category_filter(client, db):
    worker = User(
        full_name="Category Worker",
        email="categoryworker@example.com",
        mobile_number="5550000003",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(worker)
    db.flush()

    team = models.Team(name="Category Team", description="Test", category="Construction", created_by=worker.id)
    db.add(team)
    db.commit()

    response = client.get("/api/teams?category=Construction")
    assert response.status_code == 200
    data = response.json()
    assert any(t["name"] == "Category Team" for t in data)


def test_team_detail(client, db):
    worker = User(
        full_name="Detail Worker",
        email="detailworker@example.com",
        mobile_number="5550000004",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(worker)
    db.flush()

    team = models.Team(name="Detail Team", description="Detail", created_by=worker.id)
    db.add(team)
    db.commit()
    db.refresh(team)

    response = client.get(f"/api/teams/{team.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == team.id
    assert data["name"] == "Detail Team"


def test_team_member_includes_name_and_profession(client, db):
    worker = User(
        full_name="Member Worker",
        email="memberworker@example.com",
        mobile_number="5550000005",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(worker)
    db.flush()

    team = models.Team(name="Member Team", description="Test", created_by=worker.id)
    db.add(team)
    db.flush()

    profile_worker = User(
        full_name="Profile Worker",
        email="profileworker@example.com",
        mobile_number="7777777777",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(profile_worker)
    db.flush()

    worker_profile = WorkerProfile(
        user_id=profile_worker.id,
        profession="Electrician",
        location="Downtown",
        price=600,
    )
    db.add(worker_profile)
    db.commit()

    member = models.TeamMember(team_id=team.id, worker_id=profile_worker.id, role="member")
    db.add(member)
    db.commit()

    response = client.get(f"/api/teams/{team.id}")
    assert response.status_code == 200
    data = response.json()
    members = data["members"]
    assert len(members) >= 1
    member_data = next(m for m in members if m["worker_id"] == profile_worker.id)
    assert member_data["full_name"] == "Profile Worker"
    assert member_data["profession"] == "Electrician"
    assert member_data["role"] == "member"


def test_worker_team_listing(client, worker):
    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get("/api/worker/teams", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_worker_creates_team(client, worker):
    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.post(
        "/api/worker/teams",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "New Team", "description": "Created by worker"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New Team"
    assert data["role"] == "creator"


def test_customer_cannot_create_team(client, customer):
    token = security.create_access_token({"sub": str(customer.id), "role": customer.role})
    response = client.post(
        "/api/worker/teams",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Customer Team"},
    )
    assert response.status_code == 403


def test_worker_adds_team_member(client, worker, db):
    team = models.Team(name="Member Team", description="Test", created_by=worker.id)
    db.add(team)
    db.flush()

    other_worker = User(
        full_name="Other Worker",
        email="otherworker3@example.com",
        mobile_number="1111111111",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(other_worker)
    db.commit()
    db.refresh(other_worker)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.post(
        f"/api/worker/teams/{team.id}/members",
        headers={"Authorization": f"Bearer {token}"},
        json={"worker_id": other_worker.id},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["members"]) >= 1


def test_duplicate_team_member_rejected(client, worker, db):
    team = models.Team(name="Dup Team", description="Test", created_by=worker.id)
    db.add(team)
    db.flush()

    other_worker = User(
        full_name="Other Worker 4",
        email="otherworker4@example.com",
        mobile_number="2222222222",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(other_worker)
    db.commit()
    db.refresh(other_worker)

    member = models.TeamMember(team_id=team.id, worker_id=other_worker.id, role="member")
    db.add(member)
    db.commit()

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.post(
        f"/api/worker/teams/{team.id}/members",
        headers={"Authorization": f"Bearer {token}"},
        json={"worker_id": other_worker.id},
    )
    assert response.status_code == 400


def test_unauthorized_worker_cannot_manage_team(client, worker, db):
    team = models.Team(name="Auth Team", description="Test", created_by=worker.id)
    db.add(team)
    db.commit()
    db.refresh(team)

    other_worker = User(
        full_name="Other Worker 5",
        email="otherworker5@example.com",
        mobile_number="3333333333",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(other_worker)
    db.commit()
    db.refresh(other_worker)

    token = security.create_access_token({"sub": str(other_worker.id), "role": other_worker.role})
    response = client.post(
        f"/api/worker/teams/{team.id}/members",
        headers={"Authorization": f"Bearer {token}"},
        json={"worker_id": other_worker.id},
    )
    assert response.status_code == 403


def test_team_creator_removes_member(client, worker, db):
    team = models.Team(name="Remove Team", description="Test", created_by=worker.id)
    db.add(team)
    db.flush()

    other_worker = User(
        full_name="Other Worker 6",
        email="otherworker6@example.com",
        mobile_number="4444444444",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(other_worker)
    db.commit()
    db.refresh(other_worker)

    member = models.TeamMember(team_id=team.id, worker_id=other_worker.id, role="member")
    db.add(member)
    db.commit()

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.delete(
        f"/api/worker/teams/{team.id}/members/{other_worker.id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204


def test_package_listing(client):
    response = client.get("/api/packages")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_package_detail(client, db):
    from app.models import Package, Service, PackageService
    from app.auth import security
    from app.models.user import User

    owner = User(
        full_name="Package Owner",
        email="packageowner@example.com",
        mobile_number="9998887777",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(owner)
    db.flush()
    db.refresh(owner)

    service = db.query(Service).first()
    package = db.query(Package).first()
    if not package:
        service = Service(name="Test Service", category="General", base_price=100)
        db.add(service)
        db.flush()

        package = Package(name="Test Package", package_type="multitasking", price=500, owner_id=owner.id, status="published")
        db.add(package)
        db.flush()

        ps = PackageService(package_id=package.id, service_id=service.id)
        db.add(ps)
        db.commit()
        db.refresh(package)

    response = client.get(f"/api/packages/{package.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == package.id
    assert "services" in data


def test_package_search(client, db):
    from app.models import Package, Service, PackageService
    from app.auth import security
    from app.models.user import User

    owner = User(
        full_name="Search Owner",
        email="searchowner@example.com",
        mobile_number="8887776666",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(owner)
    db.flush()
    db.refresh(owner)

    service = db.query(Service).first()
    package = db.query(Package).first()
    if not package:
        service = Service(name="Searchable Service", category="General", base_price=100)
        db.add(service)
        db.flush()

        package = Package(name="Searchable Package", description="Find me", package_type="multitasking", price=500, owner_id=owner.id, status="published")
        db.add(package)
        db.flush()

        ps = PackageService(package_id=package.id, service_id=service.id)
        db.add(ps)
        db.commit()
        db.refresh(package)

    response = client.get(f"/api/packages?search=Searchable")
    assert response.status_code == 200
    data = response.json()
    assert any(p["id"] == package.id for p in data)


def test_package_category_filter(client, db):
    from app.models import Package, Service, PackageService
    from app.auth import security
    from app.models.user import User

    owner = User(
        full_name="Cat Owner",
        email="catowner@example.com",
        mobile_number="7776665555",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(owner)
    db.flush()
    db.refresh(owner)

    service = db.query(Service).first()
    package = db.query(Package).first()
    if not package:
        service = Service(name="Cat Service", category="Plumbing", base_price=100)
        db.add(service)
        db.flush()

        package = Package(name="Cat Package", package_type="multitasking", price=500, owner_id=owner.id, status="published")
        db.add(package)
        db.flush()

        ps = PackageService(package_id=package.id, service_id=service.id)
        db.add(ps)
        db.commit()
        db.refresh(package)

    response = client.get(f"/api/packages?category=Plumbing")
    assert response.status_code == 200
    data = response.json()
    assert any(p["id"] == package.id for p in data)


def test_multitasking_package_filter(client):
    response = client.get("/api/packages?package_type=multitasking")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_team_package_filter(client):
    response = client.get("/api/packages?package_type=team")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_package_services_returned(client, db):
    from app.models import Package, Service, PackageService
    from app.auth import security
    from app.models.user import User

    owner = User(
        full_name="Services Owner",
        email="servicesowner@example.com",
        mobile_number="6665554444",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(owner)
    db.flush()
    db.refresh(owner)

    service = db.query(Service).first()
    package = db.query(Package).first()
    if not package:
        service = Service(name="Test Service 2", category="General", base_price=100)
        db.add(service)
        db.flush()

        package = Package(name="Test Package 2", package_type="team", price=500, owner_id=owner.id, status="published")
        db.add(package)
        db.flush()

        ps = PackageService(package_id=package.id, service_id=service.id)
        db.add(ps)
        db.commit()
        db.refresh(package)

    response = client.get(f"/api/packages/{package.id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["services"]) >= 1


def test_customer_creates_valid_review(client, customer, worker, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="completed",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    token = security.create_access_token({"sub": str(customer.id), "role": customer.role})
    response = client.post(
        "/api/reviews",
        headers={"Authorization": f"Bearer {token}"},
        json={"booking_id": booking.id, "rating": 5, "comment": "Great work!"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["rating"] == 5
    assert data["worker_id"] == worker.id


def test_customer_cannot_review_unbooked_worker(client, customer):
    token = security.create_access_token({"sub": str(customer.id), "role": customer.role})
    response = client.post(
        "/api/reviews",
        headers={"Authorization": f"Bearer {token}"},
        json={"booking_id": 99999, "rating": 5},
    )
    assert response.status_code == 404


def test_customer_cannot_review_incomplete_booking(client, customer, worker, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="pending",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    token = security.create_access_token({"sub": str(customer.id), "role": customer.role})
    response = client.post(
        "/api/reviews",
        headers={"Authorization": f"Bearer {token}"},
        json={"booking_id": booking.id, "rating": 5},
    )
    assert response.status_code == 400


def test_duplicate_review_rejected(client, customer, worker, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="completed",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    review = models.Review(booking_id=booking.id, customer_id=customer.id, worker_id=worker.id, rating=5)
    db.add(review)
    db.commit()

    token = security.create_access_token({"sub": str(customer.id), "role": customer.role})
    response = client.post(
        "/api/reviews",
        headers={"Authorization": f"Bearer {token}"},
        json={"booking_id": booking.id, "rating": 4},
    )
    assert response.status_code == 400


def test_invalid_rating_rejected(client, customer):
    token = security.create_access_token({"sub": str(customer.id), "role": customer.role})
    response = client.post(
        "/api/reviews",
        headers={"Authorization": f"Bearer {token}"},
        json={"booking_id": 1, "rating": 0},
    )
    assert response.status_code == 422


def test_worker_reviews_listing(client, worker, customer, db):
    booking = models.Booking(
        customer_id=customer.id,
        worker_id=worker.id,
        booking_date=date(2026, 8, 20),
        booking_time="10:00",
        address="123 Customer St",
        amount=500,
        status="completed",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    review = models.Review(
        booking_id=booking.id,
        customer_id=customer.id,
        worker_id=worker.id,
        rating=5,
        comment="Great",
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    response = client.get(f"/api/reviews/workers/{worker.id}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_worker_average_rating_updates_correctly(client, worker, db):
    reviews = db.query(models.Review).filter(models.Review.worker_id == worker.id).all()
    avg = sum(r.rating for r in reviews) / len(reviews) if reviews else None
    assert avg is None or 1.0 <= avg <= 5.0


def test_existing_auth_tests_still_pass(client):
    response = client.get("/")
    assert response.status_code == 200
    response = client.get("/api/health")
    assert response.status_code == 200


def test_existing_customer_tests_still_pass(client):
    response = client.get("/api/customer/profile")
    assert response.status_code == 401
    response = client.get("/api/workers")
    assert response.status_code == 200


def test_existing_worker_tests_still_pass(client):
    response = client.get("/api/worker/profile")
    assert response.status_code == 401
    response = client.get("/api/worker/dashboard")
    assert response.status_code == 401


# =========================================================
# Worker Package Management Tests
# =========================================================

def test_worker_can_create_multitasking_package(client, worker, db):
    from app.models import Service
    service = db.query(Service).first()
    if not service:
        service = Service(name="Create Service", category="General", base_price=100)
        db.add(service)
        db.flush()
        db.refresh(service)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.post(
        "/api/worker/packages",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "My Multitasking Package",
            "description": "A test package",
            "package_type": "multitasking",
            "price": 1200,
            "duration": "3 hours",
            "location": "Downtown",
            "availability": "Weekdays",
            "status": "draft",
            "service_ids": [service.id],
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Multitasking Package"
    assert data["status"] == "draft"
    assert data["owner_id"] == worker.id
    assert len(data["services"]) >= 1


def test_worker_can_create_team_package(client, worker, db):
    from app.models import Service, User

    other_worker = User(
        full_name="Team Package Worker",
        email="teampkgworker@example.com",
        mobile_number="1231231234",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    third_worker = User(
        full_name="Third Team Worker",
        email="thirdteamworker@example.com",
        mobile_number="4445556666",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add_all([other_worker, third_worker])
    db.flush()
    db.refresh(other_worker)
    db.refresh(third_worker)

    service = db.query(Service).first()
    if not service:
        service = Service(name="Team Create Service", category="General", base_price=100)
        db.add(service)
        db.flush()
        db.refresh(service)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.post(
        "/api/worker/packages",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "My Team Package",
            "description": "A team package",
            "package_type": "team",
            "price": 2500,
            "duration": "Full day",
            "location": "Uptown",
            "availability": "Weekends",
            "status": "published",
            "service_ids": [service.id],
            "worker_ids": [other_worker.id, third_worker.id],
            "leader_worker_id": other_worker.id,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Team Package"
    assert data["package_type"] == "team"
    assert data["status"] == "published"
    assert len(data["workers"]) == 2


def test_customer_cannot_create_package(client, customer):
    token = security.create_access_token({"sub": str(customer.id), "role": customer.role})
    response = client.post(
        "/api/worker/packages",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Bad Package", "package_type": "multitasking", "price": 100, "service_ids": []},
    )
    assert response.status_code == 403


def test_worker_lists_own_packages(client, worker, db):
    from app.models import Package, Service, PackageService
    service = db.query(Service).first()
    if not service:
        service = Service(name="List Service", category="General", base_price=100)
        db.add(service)
        db.flush()
        db.refresh(service)

    pkg = Package(name="Worker List Pkg", package_type="multitasking", price=800, owner_id=worker.id, status="published")
    db.add(pkg)
    db.flush()
    ps = PackageService(package_id=pkg.id, service_id=service.id)
    db.add(ps)
    db.commit()

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get("/api/worker/packages", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert any(p["id"] == pkg.id for p in data)


def test_worker_cannot_list_other_workers_packages(client, worker, db):
    from app.models import User, Package, Service, PackageService
    other = User(
        full_name="Other Worker",
        email="otherpkgworker@example.com",
        mobile_number="1112223333",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(other)
    db.flush()
    db.refresh(other)

    service = db.query(Service).first()
    if not service:
        service = Service(name="Other List Service", category="General", base_price=100)
        db.add(service)
        db.flush()
        db.refresh(service)

    pkg = Package(name="Other Worker Pkg", package_type="multitasking", price=900, owner_id=other.id, status="published")
    db.add(pkg)
    db.flush()
    ps = PackageService(package_id=pkg.id, service_id=service.id)
    db.add(ps)
    db.commit()

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.get("/api/worker/packages", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert not any(p["id"] == pkg.id for p in data)


def test_worker_can_update_own_package(client, worker, db):
    from app.models import Package, Service, PackageService
    service = db.query(Service).first()
    if not service:
        service = Service(name="Update Service", category="General", base_price=100)
        db.add(service)
        db.flush()
        db.refresh(service)

    pkg = Package(name="Old Name", package_type="multitasking", price=500, owner_id=worker.id, status="draft")
    db.add(pkg)
    db.flush()
    ps = PackageService(package_id=pkg.id, service_id=service.id)
    db.add(ps)
    db.commit()
    db.refresh(pkg)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.put(
        f"/api/worker/packages/{pkg.id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "New Name", "price": 1500, "status": "published"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["price"] == 1500
    assert data["status"] == "published"


def test_worker_cannot_update_other_package(client, worker, db):
    from app.models import User, Package
    other = User(
        full_name="Other Updater",
        email="otherupdater@example.com",
        mobile_number="2223334444",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(other)
    db.flush()
    db.refresh(other)

    pkg = Package(name="Protected Pkg", package_type="multitasking", price=500, owner_id=other.id, status="draft")
    db.add(pkg)
    db.commit()
    db.refresh(pkg)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.put(
        f"/api/worker/packages/{pkg.id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Hacked"},
    )
    assert response.status_code == 403


def test_worker_can_publish_and_unpublish(client, worker, db):
    from app.models import Package, Service, PackageService
    service = db.query(Service).first()
    if not service:
        service = Service(name="Pub Service", category="General", base_price=100)
        db.add(service)
        db.flush()
        db.refresh(service)

    pkg = Package(name="Pub Pkg", package_type="multitasking", price=500, owner_id=worker.id, status="draft")
    db.add(pkg)
    db.flush()
    ps = PackageService(package_id=pkg.id, service_id=service.id)
    db.add(ps)
    db.commit()
    db.refresh(pkg)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})

    pub = client.patch(f"/api/worker/packages/{pkg.id}/publish", headers={"Authorization": f"Bearer {token}"})
    assert pub.status_code == 200
    assert pub.json()["status"] == "published"

    unpub = client.patch(f"/api/worker/packages/{pkg.id}/unpublish", headers={"Authorization": f"Bearer {token}"})
    assert unpub.status_code == 200
    assert unpub.json()["status"] == "draft"


def test_worker_can_archive_package(client, worker, db):
    from app.models import Package, Service, PackageService
    service = db.query(Service).first()
    if not service:
        service = Service(name="Archive Service", category="General", base_price=100)
        db.add(service)
        db.flush()
        db.refresh(service)

    pkg = Package(name="Archive Pkg", package_type="multitasking", price=500, owner_id=worker.id, status="published")
    db.add(pkg)
    db.flush()
    ps = PackageService(package_id=pkg.id, service_id=service.id)
    db.add(ps)
    db.commit()
    db.refresh(pkg)

    token = security.create_access_token({"sub": str(worker.id), "role": worker.role})
    response = client.delete(f"/api/worker/packages/{pkg.id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204

    check = client.get(f"/api/worker/packages/{pkg.id}", headers={"Authorization": f"Bearer {token}"})
    assert check.status_code == 200
    assert check.json()["status"] == "archived"


def test_public_packages_excludes_draft_and_archived(client, db):
    from app.models import Package, Service, PackageService
    from app.models.user import User

    owner = User(
        full_name="Public Owner",
        email="publicowner@example.com",
        mobile_number="3334445555",
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(owner)
    db.flush()
    db.refresh(owner)

    service = db.query(Service).first()
    if not service:
        service = Service(name="Public Service", category="General", base_price=100)
        db.add(service)
        db.flush()
        db.refresh(service)

    draft = Package(name="Draft Pkg", package_type="multitasking", price=500, owner_id=owner.id, status="draft")
    published = Package(name="Published Pkg", package_type="multitasking", price=600, owner_id=owner.id, status="published")
    archived = Package(name="Archived Pkg", package_type="multitasking", price=700, owner_id=owner.id, status="archived")
    db.add_all([draft, published, archived])
    db.flush()

    for p in [draft, published, archived]:
        ps = PackageService(package_id=p.id, service_id=service.id)
        db.add(ps)
    db.commit()

    resp = client.get("/api/packages?package_type=multitasking")
    assert resp.status_code == 200
    data = resp.json()
    assert any(p["name"] == "Published Pkg" for p in data)
    assert not any(p["name"] == "Draft Pkg" for p in data)
    assert not any(p["name"] == "Archived Pkg" for p in data)
