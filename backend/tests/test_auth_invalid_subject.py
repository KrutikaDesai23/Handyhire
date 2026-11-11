from jose import jwt

from app.auth import security


def test_signed_token_with_non_numeric_subject_returns_401(client):
    token = jwt.encode(
        {"sub": "not-a-number", "role": "customer"},
        security.SECRET_KEY,
        algorithm=security.ALGORITHM,
    )

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401
