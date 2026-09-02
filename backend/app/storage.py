from __future__ import annotations

import json
import os
from contextlib import contextmanager
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterator

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    create_engine,
    delete,
    event,
    select,
    text,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)
from sqlalchemy.pool import StaticPool

from app.seed import SKILLS, TOOLS


def database_url() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://cryptolab:cryptolab@127.0.0.1:5432/cryptolab",
    )


def _engine(url: str) -> Engine:
    options: dict[str, Any] = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
        if url in {"sqlite://", "sqlite:///:memory:"} or ":memory:" in url:
            options["poolclass"] = StaticPool
    engine = create_engine(url, **options)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def enable_foreign_keys(dbapi_connection: Any, _: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


class Base(DeclarativeBase):
    pass


class UserRecord(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    username: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(400), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    projects: Mapped[list["ProjectRecord"]] = relationship(back_populates="owner")
    sessions: Mapped[list["AuthSessionRecord"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class AuthSessionRecord(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)
    user: Mapped[UserRecord] = relationship(back_populates="sessions")


class ProjectRecord(Base):
    __tablename__ = "experiment_projects"
    __table_args__ = (
        Index(
            "uq_experiment_projects_active_owner",
            "owner_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL AND owner_id IS NOT NULL"),
            sqlite_where=text("ended_at IS NULL AND owner_id IS NOT NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    current_stage: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    observation_html: Mapped[str] = mapped_column(
        Text, nullable=False, default="", server_default=""
    )
    observation_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    experiment_observations_json: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )
    owner_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    owner: Mapped[UserRecord | None] = relationship(back_populates="projects")
    documents: Mapped[list["DocumentRecord"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    knowledge_base: Mapped["KnowledgeBaseRecord | None"] = relationship(
        back_populates="project", cascade="all, delete-orphan", uselist=False
    )
    rag_pipeline: Mapped["RAGPipelineRecord | None"] = relationship(
        back_populates="project", cascade="all, delete-orphan", uselist=False
    )
    agent: Mapped["AgentRecord | None"] = relationship(
        back_populates="project", cascade="all, delete-orphan", uselist=False
    )
    runs: Mapped[list["RunRecord"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class DocumentRecord(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("experiment_projects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    filename: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    level: Mapped[str] = mapped_column(String(40), nullable=False)
    accent: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(160), nullable=False)
    file_kind: Mapped[str] = mapped_column(String(40), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    storage_path: Mapped[str] = mapped_column(String(600), nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, nullable=False, default=dict
    )
    project: Mapped[ProjectRecord] = relationship(back_populates="documents")


class KnowledgeBaseRecord(Base):
    __tablename__ = "knowledge_bases"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("experiment_projects.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    document_ids: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    chunk_size: Mapped[int] = mapped_column(Integer, nullable=False)
    overlap: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(160), nullable=False)
    dimension: Mapped[int] = mapped_column(Integer, nullable=False)
    vector_store: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    build_ms: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    project: Mapped[ProjectRecord] = relationship(back_populates="knowledge_base")
    chunks: Mapped[list["ChunkRecord"]] = relationship(
        back_populates="knowledge_base",
        cascade="all, delete-orphan",
        order_by="ChunkRecord.chunk_index",
    )


class ChunkRecord(Base):
    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    knowledge_base_id: Mapped[str] = mapped_column(
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    document_id: Mapped[str] = mapped_column(String(50), index=True)
    document_title: Mapped[str] = mapped_column(String(160), nullable=False)
    filename: Mapped[str] = mapped_column(String(200), nullable=False)
    section: Mapped[str] = mapped_column(String(240), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    chars: Mapped[int] = mapped_column(Integer, nullable=False)
    tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    accent: Mapped[str] = mapped_column(String(20), nullable=False)
    # PostgreSQL 上由 pgvector 提供向量列；SQLite 测试中类型会自动退化为 JSON。
    embedding: Mapped[list[float]] = mapped_column(
        Vector(128).with_variant(JSON, "sqlite"), nullable=False
    )
    knowledge_base: Mapped[KnowledgeBaseRecord] = relationship(back_populates="chunks")


class RAGPipelineRecord(Base):
    __tablename__ = "rag_pipelines"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("experiment_projects.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    top_k: Mapped[int] = mapped_column(Integer, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    rerank_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    rerank_top_n: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt_template: Mapped[str] = mapped_column(String(160), nullable=False)
    project: Mapped[ProjectRecord] = relationship(back_populates="rag_pipeline")


class AgentRecord(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("experiment_projects.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    )
    skills: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    tools: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    project: Mapped[ProjectRecord] = relationship(back_populates="agent")


class RunRecord(Base):
    __tablename__ = "run_traces"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        ForeignKey("experiment_projects.id", ondelete="CASCADE"), index=True
    )
    run_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    input_json: Mapped[dict[str, Any]] = mapped_column("input", JSON, nullable=False)
    output_json: Mapped[dict[str, Any]] = mapped_column("output", JSON, nullable=False)
    metrics_json: Mapped[dict[str, Any]] = mapped_column(
        "metrics", JSON, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    project: Mapped[ProjectRecord] = relationship(back_populates="runs")


class SkillRecord(Base):
    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class ToolRecord(Base):
    __tablename__ = "tools"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class GradingRubricRecord(Base):
    __tablename__ = "grading_rubrics"

    id: Mapped[str] = mapped_column(String(8), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


class GradingRecord(Base):
    __tablename__ = "grading_records"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _exp_json_section(raw: Any, section: str) -> dict:
    """读取 experiment_observations_json；兼容旧的扁平结构（直接是 observations）。"""
    if not isinstance(raw, dict):
        return {}
    if "observations" in raw or "reports" in raw:
        value = raw.get(section)
        return value if isinstance(value, dict) else {}
    # 旧结构：整个 JSON 就是 observations
    return raw if section == "observations" else {}


class StateRepository:
    """结构化 SQLAlchemy 持久层；正式环境使用 PostgreSQL + pgvector。"""

    def __init__(self, url: str | None = None) -> None:
        self.url = url or database_url()
        self.engine = _engine(self.url)
        self.Session = sessionmaker(self.engine, expire_on_commit=False)
        if os.getenv("DATABASE_AUTO_CREATE", "false").lower() in {
            "1",
            "true",
            "yes",
        } or self.url.startswith("sqlite"):
            Base.metadata.create_all(self.engine)
            self._ensure_columns()

    def _ensure_columns(self) -> None:
        """为已存在的表补齐新增列（轻量迁移，仅处理向后兼容的新增字段）。"""
        migrations = {
            "experiment_projects": {
                "experiment_observations_json": "JSON",
            },
        }
        with self.engine.begin() as connection:
            for table, columns in migrations.items():
                try:
                    existing = (
                        {
                            row[1]
                            for row in connection.exec_driver_sql(
                                f"PRAGMA table_info({table})"
                            ).fetchall()
                        }
                        if self.url.startswith("sqlite")
                        else set()
                    )
                except Exception:
                    existing = set()
                if not self.url.startswith("sqlite"):
                    continue
                for column, column_type in columns.items():
                    if column not in existing:
                        connection.exec_driver_sql(
                            f"ALTER TABLE {table} ADD COLUMN {column} {column_type}"
                        )

    @contextmanager
    def session(self) -> Iterator[Session]:
        with self.Session.begin() as session:
            yield session

    def ping(self) -> bool:
        with self.Session() as session:
            session.execute(select(1))
        return True

    @property
    def vector_store_name(self) -> str:
        return (
            "PostgreSQL + pgvector"
            if self.url.startswith("postgresql")
            else "SQLite Test Vector Store"
        )

    def vector_candidates(
        self, project_id: str, query_vector: list[float], limit: int = 100
    ) -> list[dict[str, Any]] | None:
        """由 PostgreSQL/pgvector 完成候选召回；测试环境保留纯 Python 路径。"""
        if not self.url.startswith("postgresql"):
            return None
        distance = ChunkRecord.embedding.cosine_distance(query_vector)
        statement = (
            select(ChunkRecord, distance.label("distance"))
            .join(
                KnowledgeBaseRecord,
                ChunkRecord.knowledge_base_id == KnowledgeBaseRecord.id,
            )
            .where(KnowledgeBaseRecord.project_id == project_id)
            .order_by(distance)
            .limit(limit)
        )
        with self.Session() as session:
            rows = session.execute(statement).all()
            return [
                {
                    "id": chunk.id,
                    "document_id": chunk.document_id,
                    "document_title": chunk.document_title,
                    "filename": chunk.filename,
                    "section": chunk.section,
                    "index": chunk.chunk_index,
                    "text": chunk.text,
                    "chars": chunk.chars,
                    "tokens": chunk.tokens,
                    "accent": chunk.accent,
                    "embedding": list(chunk.embedding),
                    "_vector_score": 1.0 - float(row_distance),
                }
                for chunk, row_distance in rows
            ]

    def load(self) -> dict[str, Any]:
        with self.Session() as session:
            projects = list(
                session.scalars(
                    select(ProjectRecord).order_by(ProjectRecord.created_at)
                )
            )
            skills = list(session.scalars(select(SkillRecord)))
            tools = list(session.scalars(select(ToolRecord)))
            rubrics = list(session.scalars(select(GradingRubricRecord)))
            gradings = list(session.scalars(select(GradingRecord)))
            state: dict[str, Any] = {
                "projects": {},
                "runs": {},
                "skills": {row.id: deepcopy(row.payload) for row in skills}
                or {row["id"]: deepcopy(row) for row in SKILLS},
                "tools": {row.id: deepcopy(row.payload) for row in tools}
                or {row["id"]: deepcopy(row) for row in TOOLS},
                "grading_rubrics": {row.id: deepcopy(row.payload) for row in rubrics},
                "grading_records": {row.id: deepcopy(row.payload) for row in gradings},
            }
            for row in projects:
                documents: dict[str, Any] = {}
                for document in row.documents:
                    metadata = deepcopy(document.metadata_json or {})
                    documents[document.id] = {
                        "id": document.id,
                        "title": document.title,
                        "filename": document.filename,
                        "category": document.category,
                        "level": document.level,
                        "accent": document.accent,
                        "content": document.content,
                        "content_type": document.content_type,
                        "file_kind": document.file_kind,
                        "source": document.source,
                        "size_bytes": document.size_bytes,
                        "uploaded_at": document.uploaded_at.isoformat(),
                        "storage_path": document.storage_path,
                        **metadata,
                    }
                kb = None
                if row.knowledge_base:
                    record = row.knowledge_base
                    kb = {
                        "id": record.id,
                        "name": record.name,
                        "document_ids": list(record.document_ids),
                        "chunk_size": record.chunk_size,
                        "overlap": record.overlap,
                        "embedding_model": record.embedding_model,
                        "dimension": record.dimension,
                        "vector_store": record.vector_store,
                        "status": record.status,
                        "build_ms": record.build_ms,
                        "created_at": record.created_at.isoformat(),
                        "chunks": [
                            {
                                "id": chunk.id,
                                "document_id": chunk.document_id,
                                "document_title": chunk.document_title,
                                "filename": chunk.filename,
                                "section": chunk.section,
                                "index": chunk.chunk_index,
                                "text": chunk.text,
                                "chars": chunk.chars,
                                "tokens": chunk.tokens,
                                "accent": chunk.accent,
                                "embedding": list(chunk.embedding),
                            }
                            for chunk in record.chunks
                        ],
                    }
                rag = None
                if row.rag_pipeline:
                    record = row.rag_pipeline
                    rag = {
                        "id": record.id,
                        "top_k": record.top_k,
                        "threshold": record.threshold,
                        "rerank_enabled": record.rerank_enabled,
                        "rerank_top_n": record.rerank_top_n,
                        "prompt_template": record.prompt_template,
                    }
                agent = None
                if row.agent:
                    agent = {
                        "id": row.agent.id,
                        "skills": list(row.agent.skills),
                        "tools": list(row.agent.tools),
                    }
                state["projects"][row.id] = {
                    "id": row.id,
                    "name": row.name,
                    "created_at": row.created_at.isoformat(),
                    "ended_at": row.ended_at.isoformat() if row.ended_at else None,
                    "observation_html": row.observation_html or "",
                    "observation_updated_at": row.observation_updated_at.isoformat()
                    if row.observation_updated_at
                    else None,
                    "experiment_observations": deepcopy(
                        _exp_json_section(
                            row.experiment_observations_json, "observations"
                        )
                    ),
                    "experiment_reports": deepcopy(
                        _exp_json_section(row.experiment_observations_json, "reports")
                    ),
                    "current_stage": row.current_stage,
                    "kb": kb,
                    "rag": rag,
                    "agent": agent,
                    "documents": documents,
                    "owner_id": row.owner_id,
                }
                state["runs"][row.id] = [
                    {
                        "id": run.id,
                        "type": run.run_type,
                        "input": deepcopy(run.input_json),
                        "output": deepcopy(run.output_json),
                        "metrics": deepcopy(run.metrics_json),
                        "created_at": run.created_at.isoformat(),
                    }
                    for run in sorted(row.runs, key=lambda item: item.created_at)
                ]
            return state

    def save(self, state: dict[str, Any]) -> None:
        """将服务内状态原子同步至规范化关系表；不会执行建库或清库操作。"""
        with self.session() as session:
            # 已结束项目必须先落库，再写入新的当前项目，以满足“每位用户仅一个当前实验”的唯一约束。
            project_items = sorted(
                state.get("projects", {}).items(),
                key=lambda item: item[1].get("ended_at") is None,
            )
            for project_id, project in project_items:
                session.merge(
                    ProjectRecord(
                        id=project_id,
                        name=project["name"],
                        created_at=_as_datetime(project["created_at"]),
                        ended_at=_as_datetime(project["ended_at"])
                        if project.get("ended_at")
                        else None,
                        observation_html=project.get("observation_html", ""),
                        observation_updated_at=_as_datetime(
                            project["observation_updated_at"]
                        )
                        if project.get("observation_updated_at")
                        else None,
                        experiment_observations_json={
                            "observations": deepcopy(
                                project.get("experiment_observations") or {}
                            ),
                            "reports": deepcopy(
                                project.get("experiment_reports") or {}
                            ),
                        },
                        current_stage=project.get("current_stage", 1),
                        owner_id=project.get("owner_id"),
                    )
                )
                session.flush()
                session.execute(
                    delete(DocumentRecord).where(
                        DocumentRecord.project_id == project_id
                    )
                )
                session.execute(
                    delete(KnowledgeBaseRecord).where(
                        KnowledgeBaseRecord.project_id == project_id
                    )
                )
                session.execute(
                    delete(RAGPipelineRecord).where(
                        RAGPipelineRecord.project_id == project_id
                    )
                )
                session.execute(
                    delete(AgentRecord).where(AgentRecord.project_id == project_id)
                )
                session.execute(
                    delete(RunRecord).where(RunRecord.project_id == project_id)
                )
                for document in project.get("documents", {}).values():
                    known = {
                        "id",
                        "title",
                        "filename",
                        "category",
                        "level",
                        "accent",
                        "content",
                        "content_type",
                        "file_kind",
                        "source",
                        "size_bytes",
                        "uploaded_at",
                        "storage_path",
                    }
                    metadata = {
                        key: deepcopy(value)
                        for key, value in document.items()
                        if key not in known
                    }
                    session.add(
                        DocumentRecord(
                            id=document["id"],
                            project_id=project_id,
                            title=document["title"],
                            filename=document["filename"],
                            category=document["category"],
                            level=document["level"],
                            accent=document["accent"],
                            content=document["content"],
                            content_type=document["content_type"],
                            file_kind=document["file_kind"],
                            source=document["source"],
                            size_bytes=document["size_bytes"],
                            uploaded_at=_as_datetime(document["uploaded_at"]),
                            storage_path=document["storage_path"],
                            metadata_json=metadata,
                        )
                    )
                kb = project.get("kb")
                if kb:
                    record = KnowledgeBaseRecord(
                        id=kb["id"],
                        project_id=project_id,
                        name=kb["name"],
                        document_ids=deepcopy(kb["document_ids"]),
                        chunk_size=kb["chunk_size"],
                        overlap=kb["overlap"],
                        embedding_model=kb["embedding_model"],
                        dimension=kb["dimension"],
                        vector_store="pgvector"
                        if self.url.startswith("postgresql")
                        else "SQLiteVectorTestStore",
                        status=kb["status"],
                        build_ms=kb["build_ms"],
                        created_at=_as_datetime(kb["created_at"]),
                    )
                    session.add(record)
                    session.flush()
                    for chunk in kb["chunks"]:
                        session.add(
                            ChunkRecord(
                                id=chunk["id"],
                                knowledge_base_id=kb["id"],
                                document_id=chunk["document_id"],
                                document_title=chunk["document_title"],
                                filename=chunk["filename"],
                                section=chunk["section"],
                                chunk_index=chunk["index"],
                                text=chunk["text"],
                                chars=chunk["chars"],
                                tokens=chunk["tokens"],
                                accent=chunk["accent"],
                                embedding=chunk["embedding"],
                            )
                        )
                rag = project.get("rag")
                if rag:
                    session.add(RAGPipelineRecord(project_id=project_id, **rag))
                agent = project.get("agent")
                if agent:
                    session.add(AgentRecord(project_id=project_id, **agent))
                for run in state.get("runs", {}).get(project_id, []):
                    session.add(
                        RunRecord(
                            id=run["id"],
                            project_id=project_id,
                            run_type=run["type"],
                            input_json=deepcopy(run["input"]),
                            output_json=deepcopy(run["output"]),
                            metrics_json=deepcopy(run["metrics"]),
                            created_at=_as_datetime(run["created_at"]),
                        )
                    )
            session.execute(delete(SkillRecord))
            session.execute(delete(ToolRecord))
            session.add_all(
                SkillRecord(id=key, payload=deepcopy(value))
                for key, value in state.get("skills", {}).items()
            )
            session.add_all(
                ToolRecord(id=key, payload=deepcopy(value))
                for key, value in state.get("tools", {}).items()
            )
            session.execute(delete(GradingRubricRecord))
            session.execute(delete(GradingRecord))
            session.add_all(
                GradingRubricRecord(id=key, payload=deepcopy(value))
                for key, value in state.get("grading_rubrics", {}).items()
            )
            session.add_all(
                GradingRecord(id=key, payload=deepcopy(value))
                for key, value in state.get("grading_records", {}).items()
            )

    def update_report_observation(
        self, project_id: str, html: str, updated_at: str
    ) -> None:
        with self.session() as session:
            record = session.get(ProjectRecord, project_id)
            if record is None:
                raise KeyError("实验项目不存在")
            record.observation_html = html
            record.observation_updated_at = _as_datetime(updated_at)

    def clear_for_tests(self) -> None:
        if not self.url.startswith("sqlite") or os.getenv("APP_ENV") != "test":
            raise RuntimeError("拒绝清理非测试数据库")
        with self.session() as session:
            for model in [
                AuthSessionRecord,
                RunRecord,
                ChunkRecord,
                AgentRecord,
                RAGPipelineRecord,
                KnowledgeBaseRecord,
                DocumentRecord,
                ProjectRecord,
                SkillRecord,
                ToolRecord,
                GradingRubricRecord,
                GradingRecord,
            ]:
                session.execute(delete(model))

    def project_owner_id(self, project_id: str) -> str | None:
        with self.Session() as session:
            return session.scalar(
                select(ProjectRecord.owner_id).where(ProjectRecord.id == project_id)
            )

    def assign_unowned_projects(self, owner_id: str) -> int:
        from sqlalchemy import update

        with self.session() as session:
            result = session.execute(
                update(ProjectRecord)
                .where(ProjectRecord.owner_id.is_(None))
                .values(owner_id=owner_id)
            )
            return int(result.rowcount or 0)

    def list_projects_for_user(
        self, user_id: str, role: str, include_ended: bool = False
    ) -> list[str]:
        with self.Session() as session:
            statement = select(ProjectRecord.id).order_by(
                ProjectRecord.created_at.desc()
            )
            if role != "admin":
                statement = statement.where(ProjectRecord.owner_id == user_id)
            if not include_ended:
                statement = statement.where(ProjectRecord.ended_at.is_(None))
            return list(session.scalars(statement))


def import_legacy_sqlite(source: Path, target: StateRepository) -> int:
    """一次性导入旧版 app_state SQLite 数据；源文件只读，不会被删除。"""
    import sqlite3

    if not source.exists():
        raise FileNotFoundError(source)
    with sqlite3.connect(f"file:{source}?mode=ro", uri=True) as connection:
        row = connection.execute("SELECT payload FROM app_state WHERE id=1").fetchone()
    if not row:
        return 0
    legacy = json.loads(row[0])
    state = target.load()
    for project_id, project in legacy.get("projects", {}).items():
        if project_id in state.setdefault("projects", {}):
            raise ValueError(
                f"目标数据库已存在项目 {project_id}；为避免覆盖，导入已中止"
            )
        state["projects"][project_id] = project
        state.setdefault("runs", {})[project_id] = legacy.get("runs", {}).get(
            project_id, []
        )
    for key in ["skills", "tools"]:
        state.setdefault(key, {}).update(legacy.get(key, {}))
    target.save(state)
    return len(legacy.get("projects", {}))
