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

    For 'owner' account: always checks PASSWORD_HASH env var first.
    For other users: checks the users table.
    """
    settings = get_settings()
    authenticated = False

    # Owner account: always use PASSWORD_HASH env var (single-user deployment)
    if body.username == "owner":
        if settings.password_hash:
            authenticated = verify_password(body.password, settings.password_hash)
    else:
        # Other users: check DB users table
        user: User | None = db.query(User).filter(
            User.username == body.username,
            User.is_active == True,  # noqa: E712
        ).first()
        if user:
            authenticated = verify_password(body.password, user.password_hash)

    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    return TokenResponse(access_token=create_access_token(body.username))
