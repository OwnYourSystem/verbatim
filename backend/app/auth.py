"""Multi-user JWT authentication.

Login flow:
  POST /auth/login  {username, password}  →  {access_token, token_type}

Users are stored in the `users` table. The legacy single-user PASSWORD_HASH
env var still works if no users row exists for "owner" (backward compat).

Every other route uses Depends(get_current_user). The dependency verifies
the JWT signature and expiry; raises HTTP 401 on any failure.

Environment variables (set in Render, never committed):
  PASSWORD_HASH   bcrypt hash of the owner's password (legacy fallback)
  JWT_SECRET      32+ random bytes, e.g. openssl rand -hex 32
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

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


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """FastAPI dependency — validates JWT, returns username.

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
        if not sub:
            raise JWTError("missing subject")
        return sub
    except JWTError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from err
