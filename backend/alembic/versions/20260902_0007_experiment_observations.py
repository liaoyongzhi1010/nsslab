"""Persist per-experiment observations.

Revision ID: 20260902_0007
Revises: 20260815_0006
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260902_0007"
down_revision: str | None = "20260815_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "experiment_projects",
        sa.Column("experiment_observations_json", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("experiment_projects", "experiment_observations_json")
