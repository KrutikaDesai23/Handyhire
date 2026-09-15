from datetime import datetime, timedelta, timezone
from os import getenv
from typing import Optional

from jose import jwt
from passlib.context import CryptContext

_DEFAULT_SECRET = "CHANGE_ME_TO_A_STRONG_RANDOM_SECRET"
APP_ENV = getenv("APP_ENV", "development").strip().lower()
SECRET_KEY = getenv("SECRET_KEY", _DEFAULT_SECRET)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

if APP_ENV == "production" and SECRET_KEY == _DEFAULT_SECRET:
    raise RuntimeError(
        "SECRET_KEY must be configured with a strong random value in production"
    )

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
