"""Scope chunk identifiers to each knowledge base.

Revision ID: 20260813_0002
Revises: 20260813_0001
Create Date: 2026-08-13
"""
from typing import Sequence

from alembic import op


revision: str = "20260813_0002"
down_revision: str | None = "20260813_0001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("chunks_pkey", "chunks", type_="primary")
    op.create_primary_key("chunks_pkey", "chunks", ["knowledge_base_id", "id"])


def downgrade() -> None:
    op.drop_constraint("chunks_pkey", "chunks", type_="primary")
    op.create_primary_key("chunks_pkey", "chunks", ["id"])
