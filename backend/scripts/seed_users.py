"""Seed default users into the users table.

Run after init_db.py (or alembic upgrade head):
  python scripts/seed_users.py

Creates:
  - tester / Tester@Verbatim2026   (role=tester)

The 'owner' account uses the PASSWORD_HASH env var (not seeded here).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from passlib.hash import bcrypt
from sqlalchemy.orm import Session

from app.db import get_engine
from app.models import Base, User

USERS = [
    {"username": "tester", "password": "Tester@Verbatim2026", "role": "tester"},
]


def seed() -> None:
    engine = get_engine()
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        for u in USERS:
            exists = db.query(User).filter(User.username == u["username"]).first()
            if not exists:
                db.add(User(
                    username=u["username"],
                    password_hash=bcrypt.hash(u["password"]),
                    role=u["role"],
                ))
                print(f"Created user: {u['username']}")
            else:
                print(f"User already exists: {u['username']}")
        db.commit()
    print("Done.")


if __name__ == "__main__":
    seed()
