from app.auth import security
from app.database.connection import test_database_connection
from jose import jwt

SECRET_KEY = security.SECRET_KEY
ALGORITHM = security.ALGORITHM


def test_postgresql_connection():
    assert test_database_connection() is True


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "HandyHire backend is running!"


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


def test_customer_registration(client):
    payload = {
        "full_name": "Test Customer",
        "email": "customer1@example.com",
        "mobile_number": "9999999999",
        "password": "securepassword",
        "address": "123 Main St",
        "city": "Test City",
    }
    response = client.post("/api/auth/register/customer", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "customer"
    assert data["access_token"] is not None
    assert data["user_id"] >= 1
    assert data["full_name"] == "Test Customer"


def test_worker_registration(client):
    payload = {
        "full_name": "Test Worker",
        "email": "worker1@example.com",
        "mobile_number": "8888888888",
        "password": "securepassword",
        "profession": "Plumber",
        "location": "Downtown",
        "price": 500,
    }
    response = client.post("/api/auth/register/worker", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "worker"
    assert data["access_token"] is not None
    assert data["user_id"] >= 1
    assert data["full_name"] == "Test Worker"


def test_duplicate_email_registration(client):
    payload = {
        "full_name": "First User",
        "email": "dup@example.com",
        "mobile_number": "7777777777",
        "password": "securepassword",
    }
    response = client.post("/api/auth/register/customer", json=payload)
    assert response.status_code == 201

    payload2 = {
        "full_name": "Second User",
        "email": "dup@example.com",
        "mobile_number": "6666666666",
        "password": "securepassword",
    }
    response = client.post("/api/auth/register/customer", json=payload2)
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]


def test_password_is_hashed(client, db):
    payload = {
        "full_name": "Hash Test",
        "email": "hashtest@example.com",
        "mobile_number": "5555555555",
        "password": "mysecretpassword",
    }
    response = client.post("/api/auth/register/customer", json=payload)
    assert response.status_code == 201

    from app.models.user import User

    user = db.query(User).filter(User.email == "hashtest@example.com").first()
    assert user is not None
    assert user.password_hash != "mysecretpassword"
    assert security.verify_password("mysecretpassword", user.password_hash) is True
    assert security.verify_password("wrongpassword", user.password_hash) is False


def test_customer_login(client):
    payload = {
        "full_name": "Login Customer",
        "email": "logincustomer@example.com",
        "mobile_number": "1111111111",
        "password": "loginpass123",
    }
    response = client.post("/api/auth/register/customer", json=payload)
    assert response.status_code == 201

    login_payload = {"email": "logincustomer@example.com", "password": "loginpass123"}
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] is not None
    assert data["token_type"] == "bearer"
    assert data["role"] == "customer"
    assert data["user_id"] >= 1


def test_worker_login(client):
    payload = {
        "full_name": "Login Worker",
        "email": "loginworker@example.com",
        "mobile_number": "2222222222",
        "password": "loginpass123",
        "profession": "Electrician",
        "location": "Uptown",
        "price": 800,
    }
    response = client.post("/api/auth/register/worker", json=payload)
    assert response.status_code == 201

    login_payload = {"email": "loginworker@example.com", "password": "loginpass123"}
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["access_token"] is not None
    assert data["role"] == "worker"


def test_invalid_password_login(client):
    payload = {
        "full_name": "Bad Login",
        "email": "badlogin@example.com",
        "mobile_number": "3333333333",
        "password": "correctpassword",
    }
    response = client.post("/api/auth/register/customer", json=payload)
    assert response.status_code == 201

    login_payload = {"email": "badlogin@example.com", "password": "wrongpassword"}
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_jwt_generation():
    token = security.create_access_token({"sub": "1", "role": "customer"})
    assert token is not None
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded["sub"] == "1"
    assert decoded["role"] == "customer"
    assert "exp" in decoded


def test_get_me_with_valid_token(client):
    payload = {
        "full_name": "Me User",
        "email": "meuser@example.com",
        "mobile_number": "4444444444",
        "password": "mepassword",
    }
    response = client.post("/api/auth/register/customer", json=payload)
    assert response.status_code == 201
    token = response.json()["access_token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "meuser@example.com"
    assert data["role"] == "customer"
    assert data["full_name"] == "Me User"


def test_get_me_without_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_customer_role_separation(client):
    customer_payload = {
        "full_name": "Sep Customer",
        "email": "sep_cust@example.com",
        "mobile_number": "1212121212",
        "password": "sepassword",
    }
    response = client.post("/api/auth/register/customer", json=customer_payload)
    assert response.status_code == 201
    customer_token = response.json()["access_token"]

    worker_payload = {
        "full_name": "Sep Worker",
        "email": "sep_work@example.com",
        "mobile_number": "1313131313",
        "password": "swpassword",
        "profession": "Carpenter",
        "location": "Suburb",
        "price": 400,
    }
    response = client.post("/api/auth/register/worker", json=worker_payload)
    assert response.status_code == 201
    worker_token = response.json()["access_token"]

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {customer_token}"})
    assert response.status_code == 200
    assert response.json()["role"] == "customer"

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {worker_token}"})
    assert response.status_code == 200
    assert response.json()["role"] == "worker"


def test_invalid_token_rejected(client):
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer invalidtoken123"})
    assert response.status_code == 401
