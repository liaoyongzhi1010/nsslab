"""Scope agent identifiers to each project.

Revision ID: 20260813_0003
Revises: 20260813_0002
Create Date: 2026-08-13
"""
from typing import Sequence

from alembic import op


revision: str = "20260813_0003"
down_revision: str | None = "20260813_0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("agents_pkey", "agents", type_="primary")
    op.create_primary_key("agents_pkey", "agents", ["project_id", "id"])


def downgrade() -> None:
    op.drop_constraint("agents_pkey", "agents", type_="primary")
    op.create_primary_key("agents_pkey", "agents", ["id"])
