"""Auth router — login endpoint only.  /health and / are public; everything else is guarded."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.auth import TokenResponse, create_access_token, verify_password
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    password: str


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    """Exchange the owner password for a JWT.

    PASSWORD_HASH env var must be a bcrypt hash — never store the plaintext.
    """
    settings = get_settings()
    password_hash = settings.password_hash
    if not password_hash or not verify_password(body.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )
    return TokenResponse(access_token=create_access_token())
