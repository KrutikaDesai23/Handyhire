"""Seed minimal safe demo data into the existing HandyHire Neon database.

Uses the existing database connection and models only.
Does not modify models, routers, or any other files.
"""

import os
import sys

# Ensure backend package imports resolve correctly when run from repo root.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database.connection import Base, engine
from app.models import (
    Package,
    PackageService,
    Service,
    Team,
    TeamMember,
    User,
    WorkerProfile,
)

load_dotenv(dotenv_path=os.path.join(BACKEND_DIR, ".env"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
PASSWORD = "demopass123"
PASSWORD_HASH = pwd_context.hash(PASSWORD)


def seed():
    session = Session(bind=engine)
    try:
        # Check if demo data already exists to avoid duplicates.
        existing_demo_customer = (
            session.query(User).filter(User.email == "demo.customer@handyhire.com").first()
        )
        if existing_demo_customer:
            print("Demo data already exists. Aborting seed to avoid duplicates.")
            return

        print("Creating demo customer...")
        demo_customer = User(
            full_name="Demo Customer",
            email="demo.customer@handyhire.com",
            mobile_number="+919999000111",
            password_hash=PASSWORD_HASH,
            role="customer",
            address="123 Demo Street, Test City",
            city="Test City",
        )
        session.add(demo_customer)
        session.flush()
        customer_id = demo_customer.id
        print(f"  Customer ID: {customer_id}")

        print("Creating demo worker 1...")
        demo_worker_1 = User(
            full_name="Demo Worker Alpha",
            email="demo.worker.alpha@handyhire.com",
            mobile_number="+919999000222",
            password_hash=PASSWORD_HASH,
            role="worker",
        )
        session.add(demo_worker_1)
        session.flush()
        worker_1_id = demo_worker_1.id

        worker_profile_1 = WorkerProfile(
            user_id=worker_1_id,
            profession="Electrician",
            bio="Demo electrician with 5 years of experience.",
            experience="5 years",
            qualification="Certified Electrician",
            location="Test City",
            price=500,
            availability="pre-booking",
            profile_image=None,
        )
        session.add(worker_profile_1)
        print(f"  Worker 1 ID: {worker_1_id}")

        print("Creating demo worker 2...")
        demo_worker_2 = User(
            full_name="Demo Worker Beta",
            email="demo.worker.beta@handyhire.com",
            mobile_number="+919999000333",
            password_hash=PASSWORD_HASH,
            role="worker",
        )
        session.add(demo_worker_2)
        session.flush()
        worker_2_id = demo_worker_2.id

        worker_profile_2 = WorkerProfile(
            user_id=worker_2_id,
            profession="Plumber",
            bio="Demo plumber with 3 years of experience.",
            experience="3 years",
            qualification="Certified Plumber",
            location="Test City",
            price=450,
            availability="on-spot",
            profile_image=None,
        )
        session.add(worker_profile_2)
        print(f"  Worker 2 ID: {worker_2_id}")

        print("Creating demo services...")
        service_1 = Service(
            name="Electrical Repair",
            description="Demo electrical repair service.",
            category="electrical",
            base_price=500,
        )
        service_2 = Service(
            name="Plumbing Repair",
            description="Demo plumbing repair service.",
            category="plumbing",
            base_price=450,
        )
        service_3 = Service(
            name="Home Cleaning",
            description="Demo home cleaning service.",
            category="cleaning",
            base_price=300,
        )
        session.add_all([service_1, service_2, service_3])
        session.flush()
        service_1_id = service_1.id
        service_2_id = service_2.id
        service_3_id = service_3.id
        print(f"  Service 1 ID: {service_1_id}")
        print(f"  Service 2 ID: {service_2_id}")
        print(f"  Service 3 ID: {service_3_id}")

        print("Creating demo team...")
        demo_team = Team(
            name="Demo Team Alpha",
            description="Demo team containing both demo workers.",
            category="electrical",
            created_by=worker_1_id,
        )
        session.add(demo_team)
        session.flush()
        team_id = demo_team.id

        team_member_1 = TeamMember(
            team_id=team_id,
            worker_id=worker_1_id,
            role="Lead",
        )
        team_member_2 = TeamMember(
            team_id=team_id,
            worker_id=worker_2_id,
            role="Assistant",
        )
        session.add_all([team_member_1, team_member_2])
        print(f"  Team ID: {team_id}")

        print("Creating demo packages...")
        package_1 = Package(
            name="Basic Home Care",
            description="Demo basic home care package.",
            package_type="basic",
            price=600,
        )
        session.add(package_1)
        session.flush()
        package_1_id = package_1.id

        package_service_1a = PackageService(
            package_id=package_1_id,
            service_id=service_2_id,
        )
        package_service_1b = PackageService(
            package_id=package_1_id,
            service_id=service_3_id,
        )
        session.add_all([package_service_1a, package_service_1b])
        print(f"  Package 1 ID: {package_1_id}")

        package_2 = Package(
            name="Premium Home Care",
            description="Demo premium home care package.",
            package_type="premium",
            price=1000,
        )
        session.add(package_2)
        session.flush()
        package_2_id = package_2.id

        package_service_2a = PackageService(
            package_id=package_2_id,
            service_id=service_1_id,
        )
        package_service_2b = PackageService(
            package_id=package_2_id,
            service_id=service_2_id,
        )
        package_service_2c = PackageService(
            package_id=package_2_id,
            service_id=service_3_id,
        )
        session.add_all([package_service_2a, package_service_2b, package_service_2c])
        print(f"  Package 2 ID: {package_2_id}")

        session.commit()
        print("\nSeed completed successfully.")
        print("=" * 50)
        print(f"Customer ID:    {customer_id}")
        print(f"Worker 1 ID:    {worker_1_id}")
        print(f"Worker 2 ID:    {worker_2_id}")
        print(f"Service 1 ID:   {service_1_id}")
        print(f"Service 2 ID:   {service_2_id}")
        print(f"Service 3 ID:   {service_3_id}")
        print(f"Team ID:        {team_id}")
        print(f"Package 1 ID:   {package_1_id}")
        print(f"Package 2 ID:   {package_2_id}")
        print("=" * 50)
        print(f"Demo password for all users: {PASSWORD}")

    except Exception as e:
        session.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed()
