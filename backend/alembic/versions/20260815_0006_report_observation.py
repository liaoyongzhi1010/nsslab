"""Persist rich-text report observations.

Revision ID: 20260815_0006
Revises: 20260814_0005
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260815_0006"
down_revision: str | None = "20260814_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("experiment_projects", sa.Column("observation_html", sa.Text(), server_default="", nullable=False))
    op.add_column("experiment_projects", sa.Column("observation_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("experiment_projects", "observation_updated_at")
    op.drop_column("experiment_projects", "observation_html")
