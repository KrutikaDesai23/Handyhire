from app import models
from app.auth import security
from app.models.user import User
from app.models.worker_profile import WorkerProfile


def _make_worker(db, name, email, mobile, profession):
    worker = User(
        full_name=name,
        email=email,
        mobile_number=mobile,
        password_hash=security.hash_password("password123"),
        role="worker",
    )
    db.add(worker)
    db.flush()

    db.add(
        WorkerProfile(
            user_id=worker.id,
            profession=profession,
            location="Goa",
            price=500,
        )
    )
    db.flush()
    return worker


def test_public_team_package_detail_exposes_exact_leader(client, db):
    owner = _make_worker(
        db,
        "Package Owner",
        "publicleaderowner@example.com",
        "9100000001",
        "Coordinator",
    )
    leader = _make_worker(
        db,
        "Team Leader",
        "publicleader@example.com",
        "9100000002",
        "Electrician",
    )
    member = _make_worker(
        db,
        "Team Member",
        "publicmember@example.com",
        "9100000003",
        "Plumber",
    )

    package = models.Package(
        name="Public Leader Team",
        description="Team package leader test",
        package_type="team",
        price=1500,
        status="published",
        owner_id=owner.id,
    )
    db.add(package)
    db.flush()

    db.add_all([
        models.PackageWorker(
            package_id=package.id,
            worker_id=leader.id,
            is_leader=True,
        ),
        models.PackageWorker(
            package_id=package.id,
            worker_id=member.id,
            is_leader=False,
        ),
    ])
    db.commit()

    response = client.get(f"/api/packages/{package.id}")

    assert response.status_code == 200
    workers = response.json()["workers"]
    assert len(workers) == 2

    by_id = {item["worker_id"]: item for item in workers}
    assert by_id[leader.id]["is_leader"] is True
    assert by_id[member.id]["is_leader"] is False
    assert sum(1 for item in workers if item["is_leader"]) == 1
