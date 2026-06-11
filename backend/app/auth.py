"""Single-user JWT authentication.

Login flow:
  POST /auth/login  {password}  →  {access_token, token_type}

Every other route uses Depends(get_current_user).  The dependency verifies
the JWT signature and expiry; raises HTTP 401 on any failure.

Environment variables (set in Render, never committed):
  PASSWORD_HASH   bcrypt hash of the owner's password
                  Generate with:  python -c "from passlib.hash import bcrypt; print(bcrypt.hash('yourpassword'))"
  JWT_SECRET      32+ random bytes, e.g. openssl rand -hex 32
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.hash import bcrypt
from pydantic import BaseModel

from app.core.config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.verify(plain, hashed)


def create_access_token() -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": "owner", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """FastAPI dependency — validates JWT, returns subject ('owner').

    Raises HTTP 401 on missing, expired, or tampered tokens.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    settings = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        sub: str | None = payload.get("sub")
        if sub != "owner":
            raise JWTError("bad subject")
        return sub
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
