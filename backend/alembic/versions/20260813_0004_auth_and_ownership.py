"""Add users, server-side sessions, roles, and project ownership.

Revision ID: 20260813_0004
Revises: 20260813_0003
Create Date: 2026-08-13
"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260813_0004"
down_revision: str | None = "20260813_0003"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("password_hash", sa.String(400), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_table(
        "auth_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(40), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_agent", sa.String(400), nullable=True),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])
    op.add_column("experiment_projects", sa.Column("owner_id", sa.String(40), nullable=True))
    op.create_foreign_key("fk_experiment_projects_owner", "experiment_projects", "users", ["owner_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_experiment_projects_owner_id", "experiment_projects", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_experiment_projects_owner_id", table_name="experiment_projects")
    op.drop_constraint("fk_experiment_projects_owner", "experiment_projects", type_="foreignkey")
    op.drop_column("experiment_projects", "owner_id")
    op.drop_table("auth_sessions")
    op.drop_table("users")
