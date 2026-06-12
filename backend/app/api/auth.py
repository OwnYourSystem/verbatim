"""Auth router — login endpoint only."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import TokenResponse, create_access_token, verify_password
from app.core.config import get_settings
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = "owner"
    password: str


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Exchange username + password for a JWT.

    Checks the users table first; falls back to PASSWORD_HASH env var for
    the 'owner' account (backward compatibility with single-user deployments).
    """
    settings = get_settings()
    authenticated = False

    # Check DB users table first
    user: User | None = db.query(User).filter(
        User.username == body.username,
        User.is_active == True,  # noqa: E712
    ).first()

    if user:
        authenticated = verify_password(body.password, user.password_hash)
    elif body.username == "owner" and settings.password_hash:
        # Legacy fallback: owner account stored as env var
        authenticated = verify_password(body.password, settings.password_hash)

    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    return TokenResponse(access_token=create_access_token(body.username))
