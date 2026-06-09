"""Create all tables directly against DATABASE_URL (dev convenience).

For production, prefer Alembic:
    alembic revision --autogenerate -m "initial schema"
    alembic upgrade head

Usage (from backend/):
    python scripts/init_db.py
"""
from app.db import init_db

if __name__ == "__main__":
    init_db()
    print("Tables created.")
