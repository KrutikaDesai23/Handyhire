"""Verify demo seed data via HandyHire API endpoints."""

import requests

BASE_URL = "http://127.0.0.1:8000"


def verify():
    # 1. Verify customer via login
    print("=== Verifying Demo Customer ===")
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "demo.customer@handyhire.com", "password": "demopass123"},
    )
    print(f"Login status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"Customer user_id: {data['user_id']}")
        print(f"Customer full_name: {data['full_name']}")
        print(f"Customer role: {data['role']}")
    else:
        print(f"Login failed: {resp.text}")

    # 2. Verify workers
    print("\n=== Verifying Demo Workers ===")
    resp = requests.get(f"{BASE_URL}/api/workers")
    print(f"List workers status: {resp.status_code}")
    if resp.status_code == 200:
        workers = resp.json()
        for w in workers:
            if w["full_name"].startswith("Demo Worker"):
                print(f"Worker ID: {w['id']}, Name: {w['full_name']}, Profession: {w['profession']}")

    # 3. Verify services
    print("\n=== Verifying Demo Services ===")
    resp = requests.get(f"{BASE_URL}/api/services")
    print(f"List services status: {resp.status_code}")
    if resp.status_code == 200:
        services = resp.json()
        for s in services:
            if s["id"] in [5, 6, 7]:
                print(f"Service ID: {s['id']}, Name: {s['name']}, Category: {s['category']}, Base Price: {s['base_price']}")

    # 4. Verify teams
    print("\n=== Verifying Demo Team ===")
    resp = requests.get(f"{BASE_URL}/api/teams")
    print(f"List teams status: {resp.status_code}")
    if resp.status_code == 200:
        teams = resp.json()
        for t in teams:
            if t.get("name", "").startswith("Demo Team"):
                print(f"Team ID: {t['id']}, Name: {t['name']}, Created By: {t['created_by']}")
                for m in t.get("members", []):
                    print(f"  Member worker_id: {m['worker_id']}, role: {m['role']}")

    # 5. Verify packages
    print("\n=== Verifying Demo Packages ===")
    resp = requests.get(f"{BASE_URL}/api/packages")
    print(f"List packages status: {resp.status_code}")
    if resp.status_code == 200:
        packages = resp.json()
        for p in packages:
            if p.get("name", "").startswith("Basic") or p.get("name", "").startswith("Premium"):
                print(f"Package ID: {p['id']}, Name: {p['name']}, Type: {p['package_type']}, Price: {p['price']}")
                for s in p.get("services", []):
                    print(f"  Service ID: {s['id']}, Name: {s['name']}")


if __name__ == "__main__":
    verify()
