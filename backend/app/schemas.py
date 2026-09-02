from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=80)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("实验名称至少需要 2 个字符")
        return value


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=80)
    ended: bool | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if len(value) < 2:
            raise ValueError("实验名称至少需要 2 个字符")
        return value

    @model_validator(mode="after")
    def require_change(self):
        if self.name is None and self.ended is None:
            raise ValueError("至少需要提交一项修改")
        return self


class LoginRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=256)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    display_name: str | None = Field(default=None, max_length=80)
    password: str = Field(min_length=8, max_length=256)


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    display_name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=12, max_length=256)
    role: Literal["student", "admin"] = "student"


class KBParseRequest(BaseModel):
    project_id: str
    document_ids: list[str] = Field(min_length=1)


class KBChunkRequest(KBParseRequest):
    chunk_size: int = Field(default=512, ge=128, le=1024)
    overlap: int = Field(default=64, ge=0, le=256)

    @model_validator(mode="after")
    def overlap_less_than_size(self):
        if self.overlap >= self.chunk_size:
            raise ValueError("overlap 必须小于 chunk_size")
        return self


class KBBuildRequest(KBChunkRequest):
    embedding_model: str = "CryptoHash-128 · 确定性向量"


class QueryEmbedRequest(BaseModel):
    project_id: str
    query: str = Field(min_length=2, max_length=1000)


class SearchRequest(BaseModel):
    project_id: str
    query: str = Field(min_length=2, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=20)
    threshold: float = Field(default=0.08, ge=-1, le=1)


class RAGRequest(SearchRequest):
    benchmark_id: str | None = Field(default=None, max_length=80)
    rerank_enabled: bool = True
    rerank_top_n: int = Field(default=3, ge=1, le=10)
    max_context_tokens: int = Field(default=1600, ge=200, le=8000)
    prompt_template: str = "严谨教学"


class RagRetrievedItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    document_id: str
    document_title: str
    section: str
    text: str
    tokens: int = 0
    score: float = 0.0


class RagRerankRequest(BaseModel):
    project_id: str
    query: str = Field(min_length=2, max_length=1000)
    items: list[RagRetrievedItem] = Field(min_length=1)
    rerank_enabled: bool = True
    rerank_top_n: int = Field(default=3, ge=1, le=10)


class RagContextRequest(BaseModel):
    project_id: str
    query: str = Field(min_length=2, max_length=1000)
    items: list[RagRetrievedItem] = Field(min_length=1)
    max_context_tokens: int = Field(default=1600, ge=200, le=8000)


class SkillUpdate(BaseModel):
    description: str = Field(min_length=4, max_length=500)
    steps: list[str] = Field(min_length=1, max_length=12)
    enabled: bool = True


class ToolRunRequest(BaseModel):
    project_id: str | None = None
    arguments: dict[str, Any]


class AgentRunRequest(BaseModel):
    project_id: str
    query: str = Field(min_length=2, max_length=2000)
    memory_enabled: bool = True


class ToolExperimentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str
    task_id: str = Field(min_length=1, max_length=40)


class ProjectScopedRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str


class DocumentBulkDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str
    document_ids: list[str] = Field(min_length=1, max_length=200)


class TaskScopedRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str
    task_id: str = Field(min_length=1, max_length=40)


class ProviderUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    api_key: str = Field(min_length=1, max_length=512)
    base_url: str = Field(min_length=4, max_length=512)
    model: str = Field(min_length=1, max_length=128)
    provider_name: str | None = Field(default=None, max_length=64)


class ReportExportRequest(BaseModel):
    format: Literal["pdf", "docx"]
    conclusion: str = Field(default="", max_length=20_000)


class ReportObservationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    html: str = Field(default="", max_length=50_000)


class RubricItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, max_length=40)
    description: str = Field(min_length=1, max_length=400)
    points: float = Field(ge=0, le=100)


class RubricUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[RubricItem] = Field(default_factory=list, max_length=50)
    scoring_prompt: str = Field(default="", max_length=4000)


class VLMProviderUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    api_key: str = Field(min_length=1, max_length=512)
    base_url: str = Field(min_length=4, max_length=512)
    model: str = Field(min_length=1, max_length=128)
    provider_name: str | None = Field(default=None, max_length=64)


class GradingOverrideItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rubric_item_id: str = Field(min_length=1, max_length=40)
    score: float = Field(ge=0, le=100)
    comment: str = Field(default="", max_length=2000)


class GradingOverrideRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[GradingOverrideItem] = Field(default_factory=list, max_length=50)
    overall_comment: str | None = Field(default=None, max_length=4000)
    total: float | None = Field(default=None, ge=0, le=100)
