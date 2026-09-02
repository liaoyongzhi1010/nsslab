"""Grading rubrics and records.

Revision ID: 20260904_0008
Revises: 20260902_0007
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260904_0008"
down_revision: str | None = "20260902_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "grading_rubrics",
        sa.Column("id", sa.String(length=8), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_table(
        "grading_records",
        sa.Column("id", sa.String(length=80), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("grading_records")
    op.drop_table("grading_rubrics")
