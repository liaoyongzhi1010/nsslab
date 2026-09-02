"""Add the current/completed experiment lifecycle.

Revision ID: 20260814_0005
Revises: 20260813_0004
Create Date: 2026-08-14
"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260814_0005"
down_revision: str | None = "20260813_0004"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("experiment_projects", sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_experiment_projects_ended_at", "experiment_projects", ["ended_at"])
    # 兼容已有数据：每个所有者保留最近创建的一项为当前实验，其余完整转入历史。
    op.execute(
        """
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at DESC, id DESC) AS position
            FROM experiment_projects
        )
        UPDATE experiment_projects AS project
        SET ended_at = CURRENT_TIMESTAMP
        FROM ranked
        WHERE project.id = ranked.id AND ranked.position > 1
        """
    )
    op.create_index(
        "uq_experiment_projects_active_owner",
        "experiment_projects",
        ["owner_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL AND owner_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_experiment_projects_active_owner", table_name="experiment_projects")
    op.drop_index("ix_experiment_projects_ended_at", table_name="experiment_projects")
    op.drop_column("experiment_projects", "ended_at")
