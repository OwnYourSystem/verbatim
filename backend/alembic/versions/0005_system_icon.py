"""Add icon column to systems table

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-12
"""
import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("systems", sa.Column("icon", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("systems", "icon")
