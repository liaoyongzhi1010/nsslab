"""Create CryptoLab production schema.

Revision ID: 20260813_0001
Revises:
Create Date: 2026-08-13
"""
from typing import Sequence

from alembic import op
from pgvector.sqlalchemy import Vector
import sqlalchemy as sa


revision: str = "20260813_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "experiment_projects",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_stage", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("project_id", sa.String(40), sa.ForeignKey("experiment_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("filename", sa.String(200), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("level", sa.String(40), nullable=False),
        sa.Column("accent", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(160), nullable=False),
        sa.Column("file_kind", sa.String(40), nullable=False),
        sa.Column("source", sa.String(30), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("storage_path", sa.String(600), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
    )
    op.create_index("ix_documents_project_id", "documents", ["project_id"])
    op.create_table(
        "knowledge_bases",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("project_id", sa.String(40), sa.ForeignKey("experiment_projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("document_ids", sa.JSON(), nullable=False),
        sa.Column("chunk_size", sa.Integer(), nullable=False),
        sa.Column("overlap", sa.Integer(), nullable=False),
        sa.Column("embedding_model", sa.String(160), nullable=False),
        sa.Column("dimension", sa.Integer(), nullable=False),
        sa.Column("vector_store", sa.String(80), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("build_ms", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_knowledge_bases_project_id", "knowledge_bases", ["project_id"])
    op.create_table(
        "chunks",
        sa.Column("id", sa.String(80), primary_key=True),
        sa.Column("knowledge_base_id", sa.String(50), sa.ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.String(50), nullable=False),
        sa.Column("document_title", sa.String(160), nullable=False),
        sa.Column("filename", sa.String(200), nullable=False),
        sa.Column("section", sa.String(240), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("chars", sa.Integer(), nullable=False),
        sa.Column("tokens", sa.Integer(), nullable=False),
        sa.Column("accent", sa.String(20), nullable=False),
        sa.Column("embedding", Vector(128), nullable=False),
    )
    op.create_index("ix_chunks_knowledge_base_id", "chunks", ["knowledge_base_id"])
    op.create_index("ix_chunks_document_id", "chunks", ["document_id"])
    if bind.dialect.name == "postgresql":
        op.execute("CREATE INDEX ix_chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops)")
    op.create_table(
        "rag_pipelines",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("project_id", sa.String(40), sa.ForeignKey("experiment_projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("top_k", sa.Integer(), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column("rerank_enabled", sa.Boolean(), nullable=False),
        sa.Column("rerank_top_n", sa.Integer(), nullable=False),
        sa.Column("prompt_template", sa.String(160), nullable=False),
    )
    op.create_index("ix_rag_pipelines_project_id", "rag_pipelines", ["project_id"])
    op.create_table(
        "agents",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("project_id", sa.String(40), sa.ForeignKey("experiment_projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("tools", sa.JSON(), nullable=False),
    )
    op.create_index("ix_agents_project_id", "agents", ["project_id"])
    op.create_table(
        "run_traces",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("project_id", sa.String(40), sa.ForeignKey("experiment_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_type", sa.String(40), nullable=False),
        sa.Column("input", sa.JSON(), nullable=False),
        sa.Column("output", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_run_traces_project_id", "run_traces", ["project_id"])
    op.create_index("ix_run_traces_run_type", "run_traces", ["run_type"])
    op.create_table("skills", sa.Column("id", sa.String(80), primary_key=True), sa.Column("payload", sa.JSON(), nullable=False))
    op.create_table("tools", sa.Column("id", sa.String(80), primary_key=True), sa.Column("payload", sa.JSON(), nullable=False))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_hnsw")
    for table in ["tools", "skills", "run_traces", "agents", "rag_pipelines", "chunks", "knowledge_bases", "documents", "experiment_projects"]:
        op.drop_table(table)
