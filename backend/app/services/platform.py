from __future__ import annotations

import ast
import math
import operator
import re
import time
import uuid
from copy import deepcopy
from datetime import UTC, datetime
from functools import wraps
from io import BytesIO
from pathlib import Path
from threading import RLock
from typing import Any

from pypdf import PdfReader

from app.providers import (
    LocalEmbeddingProvider,
    LocalRerankProvider,
    OpenAICompatibleLLMProvider,
    VLMProvider,
    build_llm_provider,
    build_vlm_provider,
    provider_status,
    vlm_status,
)
from app.providers.local import tokenize
from app.config import AppSettings, LLMSettings, VLMSettings
from app.evidence_seed import EVIDENCE_PACK_ROOT, RAG_BENCHMARKS
from app.experiments_seed import (
    AGENT_LOOP_EXPERIMENT,
    CPT_EXPERIMENT,
    DATA_ENGINEERING,
    EXPERIMENT_CATEGORIES,
    MULTI_AGENT_EXPERIMENT,
    RLHF_EXPERIMENT,
    SFT_EXPERIMENT,
    SKILL_EXPERIMENT,
)
from app.seed import PRESET_DOCUMENTS, SKILLS, TOOLS
from app.storage import StateRepository
from app.services.rich_text import (
    rich_text_markdown,
    rich_text_plain,
    sanitize_rich_text,
)


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def cosine(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def estimate_tokens(text: str) -> int:
    cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
    latin = len(re.findall(r"\b\w+\b", text))
    return max(1, round(cjk / 1.6 + latin * 1.2))


def synchronized(method):
    @wraps(method)
    def wrapper(self, *args, **kwargs):
        with self._state_lock:
            return method(self, *args, **kwargs)

    return wrapper


class PlatformService:
    max_upload_bytes = 10 * 1024 * 1024
    text_extensions = {".txt", ".md", ".markdown"}
    code_extensions = {
        ".py",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".java",
        ".c",
        ".h",
        ".cpp",
        ".hpp",
        ".cc",
        ".go",
        ".rs",
        ".sol",
        ".json",
        ".yaml",
        ".yml",
        ".toml",
        ".sh",
        ".sql",
        ".html",
        ".css",
    }

    def __init__(self) -> None:
        self._state_lock = RLock()
        self.embedding = LocalEmbeddingProvider()
        self.reranker = LocalRerankProvider()
        self.llm = build_llm_provider()
        self.vlm = build_vlm_provider()
        self.projects: dict[str, dict[str, Any]] = {}
        self.skills = {skill["id"]: deepcopy(skill) for skill in SKILLS}
        self.tools = {tool["id"]: deepcopy(tool) for tool in TOOLS}
        self.runs: dict[str, list[dict[str, Any]]] = {}
        self.grading_rubrics: dict[str, dict[str, Any]] = {}
        self.grading_records: dict[str, dict[str, Any]] = {}
        self.settings = AppSettings.from_env()
        self.repository = StateRepository(self.settings.database_url)
        self.upload_root = self.settings.upload_dir
        self.upload_root.mkdir(parents=True, exist_ok=True)
        state = self.repository.load()
        if state:
            self.projects = state.get("projects", {})
            self.skills = state.get("skills", self.skills)
            self.tools = state.get("tools", self.tools)
            self.runs = state.get("runs", {})
            self.grading_rubrics = state.get("grading_rubrics", {})
            self.grading_records = state.get("grading_records", {})

    @synchronized
    def reset(self) -> None:
        if self.settings.environment != "test":
            raise RuntimeError("reset 仅允许在 APP_ENV=test 的隔离测试数据库中运行")
        self.projects = {}
        self.skills = {skill["id"]: deepcopy(skill) for skill in SKILLS}
        self.tools = {tool["id"]: deepcopy(tool) for tool in TOOLS}
        self.runs = {}
        self.grading_rubrics = {}
        self.grading_records = {}
        self.repository.clear_for_tests()
        self._persist()

    def _persist(self) -> None:
        self.repository.save(
            {
                "projects": self.projects,
                "skills": self.skills,
                "tools": self.tools,
                "runs": self.runs,
                "grading_rubrics": self.grading_rubrics,
                "grading_records": self.grading_records,
            }
        )

    def bootstrap(self) -> dict[str, Any]:
        return {
            "documents": [
                {**doc, "content": None, "chars": len(doc["content"])}
                for doc in PRESET_DOCUMENTS
            ],
            "rag_benchmarks": [
                {key: deepcopy(value) for key, value in row.items() if key != "facts"}
                for row in RAG_BENCHMARKS
            ],
            "tool_tasks": [
                {key: value for key, value in row.items() if key != "values"}
                for row in TOOL_TASKS
            ],
            "experiment_categories": deepcopy(EXPERIMENT_CATEGORIES),
            "sft_tasks": [
                {k: t[k] for k in ["id", "instruction"]}
                for t in SFT_EXPERIMENT["tasks"]
            ],
            "multi_agent_tasks": [
                {k: t[k] for k in ["id", "title", "query"]}
                for t in MULTI_AGENT_EXPERIMENT["tasks"]
            ],
            "skill_tasks": [
                {k: t[k] for k in ["id", "title", "query", "skill", "steps"]}
                for t in SKILL_EXPERIMENT["tasks"]
            ],
            "agent_loop_tasks": [
                {k: t[k] for k in ["id", "title", "query"]}
                for t in AGENT_LOOP_EXPERIMENT["tasks"]
            ],
            "skills": list(self.skills.values()),
            "tools": list(self.tools.values()),
            "providers": {
                "llm": self.llm.name,
                "llm_status": provider_status(self.llm),
                "vlm_status": vlm_status(self.vlm),
                "embedding": self.embedding.name,
                "embedding_dimension": self.embedding.dimension,
                "rerank": self.reranker.name,
                "mode": "remote"
                if getattr(self.llm, "is_remote", False)
                else "offline-teaching",
            },
        }

    @synchronized
    @synchronized
    def update_llm_provider(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        provider_name: str | None = None,
    ) -> dict[str, Any]:
        """在线切换后台大模型 Provider（教学环境：任何登录用户可改）。"""
        from dataclasses import replace

        base = (
            self.llm.settings
            if isinstance(self.llm, OpenAICompatibleLLMProvider)
            else LLMSettings.from_env()
        )
        new_settings = replace(
            base,
            provider="openai_compatible",
            provider_name=(
                provider_name or base.provider_name or "OpenAI Compatible"
            ).strip(),
            base_url=base_url.strip().rstrip("/"),
            model=model.strip(),
            api_key=api_key.strip(),
        )
        if not new_settings.remote_configured:
            raise ValueError("请完整填写 API Key、Base URL 和模型名称")
        self.llm = OpenAICompatibleLLMProvider(new_settings)
        return provider_status(self.llm)

    @synchronized
    def update_vlm_provider(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        provider_name: str | None = None,
    ) -> dict[str, Any]:
        """在线切换阅卷视觉大模型 Provider（管理员专用），与学生侧 LLM 相互独立。"""
        from dataclasses import replace

        base = (
            self.vlm.settings
            if isinstance(self.vlm, VLMProvider)
            else VLMSettings.from_env()
        )
        new_settings = replace(
            base,
            provider="openai_compatible",
            provider_name=(
                provider_name or base.provider_name or "OpenAI Compatible"
            ).strip(),
            base_url=base_url.strip().rstrip("/"),
            model=model.strip(),
            api_key=api_key.strip(),
        )
        if not new_settings.remote_configured:
            raise ValueError("请完整填写 API Key、Base URL 和模型名称")
        self.vlm = VLMProvider(new_settings)
        return vlm_status(self.vlm)

    @synchronized
    def ensure_workspace(self, owner_id: str) -> None:
        """确保用户拥有一个可用工作区；没有则自动创建（项目对学生透明）。"""
        has_active = any(
            p.get("owner_id") == owner_id and not p.get("ended_at")
            for p in self.projects.values()
        )
        if not has_active:
            self.create_project("我的实验记录", owner_id=owner_id)

    def create_project(
        self, name: str | None = None, owner_id: str | None = None
    ) -> dict[str, Any]:
        created_at = now_iso()
        # 项目名称统一固定，前端仅作实验记录容器，不允许自定义命名。
        name = "我的实验记录"
        # 创建即代表重新开始：同一用户原有的当前实验完整结束并进入历史。
        ended_projects: list[dict[str, Any]] = []
        if owner_id is not None:
            for existing in self.projects.values():
                if existing.get("owner_id") == owner_id and not existing.get(
                    "ended_at"
                ):
                    ended_projects.append(existing)
                    existing["ended_at"] = created_at
        project_id = f"proj_{uuid.uuid4().hex[:8]}"
        project = {
            "id": project_id,
            "name": name,
            "created_at": created_at,
            "ended_at": None,
            "observation_html": "",
            "observation_updated_at": None,
            "current_stage": 1,
            "kb": None,
            "rag": None,
            "agent": None,
            "documents": {},
            "owner_id": owner_id,
        }
        self.projects[project_id] = project
        self.runs[project_id] = []
        try:
            self._persist()
        except Exception:
            self.projects.pop(project_id, None)
            self.runs.pop(project_id, None)
            for existing in ended_projects:
                existing["ended_at"] = None
            raise
        return self.project_status(project_id)

    @synchronized
    def update_project(
        self, project_id: str, *, name: str | None = None, ended: bool | None = None
    ) -> dict[str, Any]:
        project = self.get_project(project_id)
        previous_name = project["name"]
        previous_ended_at = project.get("ended_at")
        ended_projects: list[dict[str, Any]] = []
        # 项目名称固定为「我的实验记录」，忽略任何重命名请求。
        _ = name
        if ended is True and not project.get("ended_at"):
            project["ended_at"] = now_iso()
        elif ended is False and project.get("ended_at"):
            restored_at = now_iso()
            owner_id = project.get("owner_id")
            if owner_id is not None:
                for existing in self.projects.values():
                    if (
                        existing["id"] != project_id
                        and existing.get("owner_id") == owner_id
                        and not existing.get("ended_at")
                    ):
                        ended_projects.append(existing)
                        existing["ended_at"] = restored_at
            project["ended_at"] = None
        try:
            self._persist()
        except Exception:
            project["name"] = previous_name
            project["ended_at"] = previous_ended_at
            for existing in ended_projects:
                existing["ended_at"] = None
            raise
        return self.project_status(project_id)

    def get_project(self, project_id: str) -> dict[str, Any]:
        if project_id not in self.projects:
            raise KeyError("实验项目不存在")
        return self.projects[project_id]

    @synchronized
    def update_report_observation(self, project_id: str, html: str) -> dict[str, Any]:
        project = self.get_project(project_id)
        sanitized = sanitize_rich_text(html)
        if len(rich_text_plain(sanitized)) > 20_000:
            raise ValueError("观察和感想不能超过 20000 个字符")
        updated_at = now_iso()
        previous_html = project.get("observation_html", "")
        previous_updated_at = project.get("observation_updated_at")
        project["observation_html"] = sanitized
        project["observation_updated_at"] = updated_at
        try:
            self.repository.update_report_observation(project_id, sanitized, updated_at)
        except Exception:
            project["observation_html"] = previous_html
            project["observation_updated_at"] = previous_updated_at
            raise
        return self.report(project_id)

    def project_status(self, project_id: str) -> dict[str, Any]:
        project = self.get_project(project_id)
        kb = project["kb"]
        runs = self.runs.get(project_id, [])
        activity = [project["created_at"]]
        if project.get("ended_at"):
            activity.append(project["ended_at"])
        if project.get("observation_updated_at"):
            activity.append(project["observation_updated_at"])
        if kb and kb.get("created_at"):
            activity.append(kb["created_at"])
        activity.extend(
            document["uploaded_at"]
            for document in project.get("documents", {}).values()
            if document.get("uploaded_at")
        )
        activity.extend(run["created_at"] for run in runs if run.get("created_at"))
        return {
            "id": project["id"],
            "name": project["name"],
            "created_at": project["created_at"],
            "ended_at": project.get("ended_at"),
            "last_activity_at": max(activity),
            "is_ended": bool(project.get("ended_at")),
            "current_stage": project["current_stage"],
            "stats": {
                "base_model": True,
                "knowledge_base": kb is not None,
                "documents": len(kb["document_ids"]) if kb else 0,
                "chunks": len(kb["chunks"]) if kb else 0,
                "rag": project["rag"] is not None,
                "skills": sum(1 for skill in self.skills.values() if skill["enabled"]),
                "tools": sum(1 for tool in self.tools.values() if tool["enabled"]),
                "agent": project["agent"] is not None,
                "runs": len(runs),
            },
        }

    @staticmethod
    def _require_current_project(project: dict[str, Any]) -> None:
        if project.get("ended_at"):
            raise ValueError("该实验已经结束；请先在“我的实验项目”中恢复后再继续操作")

    @staticmethod
    def _public_document(
        document: dict[str, Any], *, include_content: bool = False
    ) -> dict[str, Any]:
        hidden = {"storage_path"}
        if not include_content:
            hidden.add("content")
        public = {key: value for key, value in document.items() if key not in hidden}
        public["chars"] = len(document["content"])
        return public

    def _find_document(
        self, document_id: str, project_id: str | None = None
    ) -> dict[str, Any] | None:
        preset = next(
            (doc for doc in PRESET_DOCUMENTS if doc["id"] == document_id), None
        )
        if preset:
            return preset
        if project_id:
            return self.get_project(project_id).get("documents", {}).get(document_id)
        return None

    def list_documents(self, project_id: str) -> list[dict[str, Any]]:
        project = self.get_project(project_id)
        preset = [
            {**doc, "source": "preset", "file_kind": "markdown"}
            for doc in PRESET_DOCUMENTS
        ]
        uploaded = list(project.get("documents", {}).values())
        return [self._public_document(document) for document in [*preset, *uploaded]]

    def document_detail(
        self, document_id: str, project_id: str | None = None
    ) -> dict[str, Any]:
        document = self._find_document(document_id, project_id)
        if document is None:
            raise KeyError("文档不存在")
        headings = [
            line.removeprefix("#").strip()
            for line in document["content"].splitlines()
            if line.startswith("#")
        ]
        public = self._public_document(document, include_content=True)
        public["parsed"] = {
            "format": document.get("parsed_format", "Markdown"),
            "headings": headings,
            "chars": len(document["content"]),
            "pages": document.get("pages"),
            "language": document.get("language"),
        }
        return public

    def evidence_file(self, document_id: str, kind: str) -> Path:
        document = self._find_document(document_id)
        field = {"original": "local_original", "excerpt": "local_excerpt"}.get(kind)
        if document is None or field is None or not document.get(field):
            raise KeyError("本地证据文件不存在")
        root = EVIDENCE_PACK_ROOT.resolve()
        path = (root / document[field]).resolve()
        if root not in path.parents or not path.is_file():
            raise KeyError("本地证据文件不存在")
        return path

    @synchronized
    def upload_document(
        self, project_id: str, filename: str, content_type: str | None, data: bytes
    ) -> dict[str, Any]:
        project = self.get_project(project_id)
        self._require_current_project(project)
        safe_name = self._safe_filename(filename)
        suffix = Path(safe_name).suffix.lower()
        allowed = self.text_extensions | self.code_extensions | {".pdf"}
        if suffix not in allowed:
            supported = "TXT、Markdown、PDF 以及 PY/JS/TS/Java/C/C++/Go/Rust/Solidity/JSON/YAML 等代码文件"
            raise ValueError(
                f"不支持 {suffix or '无扩展名'} 文件；当前支持 {supported}"
            )
        if not data:
            raise ValueError("上传文件为空")
        if len(data) > self.max_upload_bytes:
            raise ValueError("单个文件不能超过 10 MB")

        if suffix == ".pdf":
            if not data.startswith(b"%PDF-"):
                raise ValueError("文件扩展名为 PDF，但内容不是有效 PDF")
            parsed_text, parser_meta = self._parse_pdf(data, allow_empty=True)
            parser_meta = {**parser_meta, "parse_method": "pypdf", "vlm_parsed": False}
            file_kind, accent = "pdf", "#ff7285"
        else:
            parsed_text = self._decode_text(data)
            if suffix in self.code_extensions:
                parsed_text, language, symbols = self._parse_code(parsed_text, suffix)
                parser_meta = {
                    "parsed_format": "Source Code",
                    "language": language,
                    "symbols": symbols,
                }
                file_kind, accent = "code", "#7c9cff"
            else:
                parser_meta = {
                    "parsed_format": "Markdown"
                    if suffix in {".md", ".markdown"}
                    else "Plain Text"
                }
                file_kind, accent = "text", "#49dcb1"

        if not parsed_text.strip():
            raise ValueError("文件没有可用于知识库的文本内容")
        document_id = f"upload_{uuid.uuid4().hex[:10]}"
        project_dir = self.upload_root / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        storage_path = project_dir / f"{document_id}{suffix}"
        storage_path.write_bytes(data)
        document = {
            "id": document_id,
            "title": Path(safe_name).stem[:100],
            "filename": safe_name,
            "category": "用户资料",
            "level": "自定义",
            "accent": accent,
            "content": parsed_text[:1_500_000],
            "content_type": content_type or "application/octet-stream",
            "file_kind": file_kind,
            "source": "upload",
            "size_bytes": len(data),
            "uploaded_at": now_iso(),
            "storage_path": str(storage_path),
            **parser_meta,
        }
        project.setdefault("documents", {})[document_id] = document
        self._persist()
        return self._public_document(document)

    @synchronized
    def delete_document(self, project_id: str, document_id: str) -> dict[str, Any]:
        """删除学生上传的资料；预置课程文档不可删除。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        documents = project.get("documents", {})
        document = documents.get(document_id)
        if document is None:
            raise KeyError("文档不存在或不可删除")
        if document.get("source") != "upload":
            raise ValueError("预置课程文档不可删除")
        storage_path = document.get("storage_path")
        documents.pop(document_id, None)
        self._persist()
        if storage_path:
            try:
                Path(storage_path).unlink(missing_ok=True)
            except OSError:
                pass
        return {"deleted": document_id}

    @synchronized
    def delete_documents(
        self, project_id: str, document_ids: list[str]
    ) -> dict[str, Any]:
        """批量删除学生上传的资料；忽略预置文档与不存在项。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        documents = project.get("documents", {})
        removed: list[str] = []
        paths: list[str] = []
        for document_id in document_ids:
            document = documents.get(document_id)
            if document is None or document.get("source") != "upload":
                continue
            if document.get("storage_path"):
                paths.append(document["storage_path"])
            documents.pop(document_id, None)
            removed.append(document_id)
        if removed:
            self._persist()
        for path in paths:
            try:
                Path(path).unlink(missing_ok=True)
            except OSError:
                pass
        return {"deleted": removed}

    @staticmethod
    def _safe_filename(filename: str) -> str:
        name = Path(filename.replace("\\", "/")).name
        name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip()
        if not name or name in {".", ".."}:
            raise ValueError("文件名无效")
        return name[:180]

    @staticmethod
    def _decode_text(data: bytes) -> str:
        if data.startswith((b"\xff\xfe", b"\xfe\xff")):
            text = data.decode("utf-16")
        else:
            try:
                text = data.decode("utf-8-sig")
            except UnicodeDecodeError as error:
                raise ValueError(
                    "文本和代码文件必须使用 UTF-8 或 UTF-16 编码"
                ) from error
        if "\x00" in text:
            raise ValueError("检测到二进制内容，不能作为文本或代码解析")
        return text.replace("\r\n", "\n").replace("\r", "\n")

    @staticmethod
    def _parse_pdf(
        data: bytes, allow_empty: bool = False
    ) -> tuple[str, dict[str, Any]]:
        try:
            reader = PdfReader(BytesIO(data), strict=True)
            if reader.is_encrypted:
                raise ValueError("暂不支持加密 PDF")
            if len(reader.pages) > 200:
                raise ValueError("PDF 不能超过 200 页")
            pages: list[str] = []
            for index, page in enumerate(reader.pages):
                text = (page.extract_text() or "").strip()
                if text:
                    pages.append(f"# 第 {index + 1} 页\n\n{text}")
        except ValueError:
            raise
        except Exception as error:
            raise ValueError("PDF 文件损坏或格式无法解析") from error
        if not pages:
            if allow_empty:
                placeholder = "（本 PDF 未提取到文字层，可能是扫描件；请在“解析文本”步用 VLM 转换为 Markdown。）"
                return placeholder, {
                    "parsed_format": "PDF Scan",
                    "pages": len(reader.pages),
                    "needs_vlm": True,
                }
            raise ValueError("PDF 未检测到可提取文字；扫描版 PDF 需要先进行 OCR")
        content = "\n\n".join(pages)
        return content, {"parsed_format": "PDF Text", "pages": len(reader.pages)}

    @staticmethod
    def _parse_code(text: str, suffix: str) -> tuple[str, str, int]:
        languages = {
            ".py": "Python",
            ".js": "JavaScript",
            ".jsx": "JavaScript JSX",
            ".ts": "TypeScript",
            ".tsx": "TypeScript TSX",
            ".java": "Java",
            ".c": "C",
            ".h": "C Header",
            ".cpp": "C++",
            ".hpp": "C++ Header",
            ".cc": "C++",
            ".go": "Go",
            ".rs": "Rust",
            ".sol": "Solidity",
            ".json": "JSON",
            ".yaml": "YAML",
            ".yml": "YAML",
            ".toml": "TOML",
            ".sh": "Shell",
            ".sql": "SQL",
            ".html": "HTML",
            ".css": "CSS",
        }
        pattern = re.compile(
            r"^\s*(?:async\s+)?(?:def|class|function|func|fn|contract|interface)\s+([A-Za-z_$][\w$]*)",
            re.MULTILINE,
        )
        symbols = len(pattern.findall(text))
        return text, languages.get(suffix, suffix.removeprefix(".").upper()), symbols

    def _split_document(
        self, document: dict[str, Any], chunk_size: int, overlap: int
    ) -> list[dict[str, Any]]:
        text = document["content"].strip()
        sections: list[tuple[str, str]] = []
        if document.get("file_kind") == "code":
            symbol_pattern = re.compile(
                r"^\s*(?:async\s+)?(?:def|class|function|func|fn|contract|interface)\s+([A-Za-z_$][\w$]*)",
                re.MULTILINE,
            )
            matches = list(symbol_pattern.finditer(text))
            if matches:
                if text[: matches[0].start()].strip():
                    sections.append(("模块与导入", text[: matches[0].start()].strip()))
                for index, match in enumerate(matches):
                    end = (
                        matches[index + 1].start()
                        if index + 1 < len(matches)
                        else len(text)
                    )
                    sections.append(
                        (
                            f"代码符号：{match.group(1)}",
                            text[match.start() : end].strip(),
                        )
                    )
            else:
                sections.append(("源代码", text))
        current_title = document["title"]
        buffer: list[str] = []
        for line in [] if sections else text.splitlines():
            if line.startswith("#"):
                if buffer:
                    sections.append((current_title, "\n".join(buffer).strip()))
                current_title = line.lstrip("#").strip()
                buffer = []
            else:
                buffer.append(line)
        if buffer:
            sections.append((current_title, "\n".join(buffer).strip()))

        chunks: list[dict[str, Any]] = []
        chunk_index = 0
        for section, section_text in sections:
            if not section_text:
                continue
            start = 0
            while start < len(section_text):
                end = min(start + chunk_size, len(section_text))
                if end < len(section_text):
                    breakpoint = max(
                        section_text.rfind("。", start, end),
                        section_text.rfind("\n", start, end),
                    )
                    if breakpoint > start + chunk_size // 2:
                        end = breakpoint + 1
                piece = section_text[start:end].strip()
                if piece:
                    chunk_index += 1
                    chunks.append(
                        {
                            "id": f"chk_{document['id']}_{chunk_index:03d}",
                            "document_id": document["id"],
                            "document_title": document["title"],
                            "filename": document["filename"],
                            "section": section,
                            "index": chunk_index,
                            "text": piece,
                            "chars": len(piece),
                            "tokens": estimate_tokens(piece),
                            "accent": document["accent"],
                            "source_type": document.get(
                                "source_type",
                                "用户上传"
                                if document.get("source") == "upload"
                                else "课程知识包",
                            ),
                            "source_title": document.get(
                                "source_title", document["title"]
                            ),
                            "source_date": document.get("source_date"),
                            "source_url": document.get("source_url"),
                            "scenario_notice": document.get("scenario_notice"),
                        }
                    )
                if end >= len(section_text):
                    break
                start = max(end - overlap, start + 1)
        return chunks

    def _resolve_documents(
        self, project_id: str, document_ids: list[str]
    ) -> list[dict[str, Any]]:
        project = self.get_project(project_id)
        available = {doc["id"]: doc for doc in PRESET_DOCUMENTS}
        available.update(project.get("documents", {}))
        documents = [
            available[document_id]
            for document_id in document_ids
            if document_id in available
        ]
        if not documents:
            raise ValueError("至少选择一份有效文档")
        return documents

    def kb_parse(self, project_id: str, document_ids: list[str]) -> dict[str, Any]:
        """实验步骤：解析。把每份原始资料读成结构化文本；上传的 PDF 优先用 VLM 转 Markdown，未配置 VLM 时回退 pypdf。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        started = time.perf_counter()
        documents = self._resolve_documents(project_id, document_ids)
        vlm = self.vlm if isinstance(self.vlm, VLMProvider) else None
        vlm_ready = vlm is not None and vlm.settings.remote_configured
        stored = project.get("documents", {})
        parsed: list[dict[str, Any]] = []
        dirty = False
        for document in documents:
            parse_method = document.get("parse_method")
            parse_note = None
            is_upload_pdf = (
                document.get("source") == "upload"
                and document.get("file_kind") == "pdf"
            )
            if (
                is_upload_pdf
                and vlm is not None
                and vlm_ready
                and not document.get("vlm_parsed")
            ):
                storage_path = document.get("storage_path")
                try:
                    if not storage_path or not Path(storage_path).exists():
                        raise ValueError("找不到原始 PDF 文件")
                    images = self.rasterize_pdf(Path(storage_path).read_bytes())
                    markdown = vlm.to_markdown(images)
                    document["content"] = markdown[:1_500_000]
                    document["parsed_format"] = "VLM Markdown"
                    document["parse_method"] = parse_method = "vlm"
                    document["vlm_parsed"] = True
                    document["needs_vlm"] = False
                    if document["id"] in stored:
                        dirty = True
                    parse_note = f"已用 {vlm.settings.model} 转换为 Markdown"
                except Exception as error:
                    parse_method = document.get("parse_method", "pypdf")
                    parse_note = f"VLM 解析失败，回退 pypdf：{error}"
            elif is_upload_pdf and not vlm_ready:
                parse_method = document.get("parse_method", "pypdf")
                if document.get("needs_vlm"):
                    parse_note = "未配置 VLM，扫描件无法提取文字；配置后可重新解析"
                else:
                    parse_note = "未配置 VLM，使用 pypdf 文本抽取"
            content = document["content"].strip()
            headings = [
                line.removeprefix("#").strip()
                for line in content.splitlines()
                if line.startswith("#")
            ]
            preview = content[:280] + ("…" if len(content) > 280 else "")
            parsed.append(
                {
                    "id": document["id"],
                    "title": document["title"],
                    "filename": document["filename"],
                    "file_kind": document.get("file_kind", "markdown"),
                    "format": document.get("parsed_format", "Markdown"),
                    "parse_method": parse_method
                    or ("markdown" if document.get("file_kind") != "pdf" else "pypdf"),
                    "parse_note": parse_note,
                    "accent": document["accent"],
                    "chars": len(content),
                    "tokens": estimate_tokens(content),
                    "headings": headings,
                    "section_count": max(len(headings), 1),
                    "language": document.get("language"),
                    "pages": document.get("pages"),
                    "source_type": document.get(
                        "source_type",
                        "用户上传"
                        if document.get("source") == "upload"
                        else "课程知识包",
                    ),
                    "preview": preview,
                }
            )
        if dirty:
            self._persist()
        elapsed = round((time.perf_counter() - started) * 1000, 2)
        return {
            "document_count": len(parsed),
            "total_chars": sum(row["chars"] for row in parsed),
            "total_sections": sum(row["section_count"] for row in parsed),
            "vlm_ready": vlm_ready,
            "latency_ms": elapsed,
            "documents": parsed,
        }

    def kb_chunk(
        self, project_id: str, document_ids: list[str], chunk_size: int, overlap: int
    ) -> dict[str, Any]:
        """实验步骤：切分。把解析后的文本按参数切成 Chunk，观察长度分布与切分边界。"""
        self._require_current_project(self.get_project(project_id))
        started = time.perf_counter()
        documents = self._resolve_documents(project_id, document_ids)
        chunks = [
            chunk
            for doc in documents
            for chunk in self._split_document(doc, chunk_size, overlap)
        ]
        elapsed = round((time.perf_counter() - started) * 1000, 2)
        public_chunks = [self._public_chunk(chunk) for chunk in chunks]
        char_values = [row["chars"] for row in public_chunks] or [0]
        return {
            "chunk_size": chunk_size,
            "overlap": overlap,
            "chunk_count": len(public_chunks),
            "avg_chars": round(sum(char_values) / len(char_values), 1),
            "min_chars": min(char_values),
            "max_chars": max(char_values),
            "avg_tokens": round(
                sum(row["tokens"] for row in public_chunks)
                / max(len(public_chunks), 1),
                1,
            ),
            "latency_ms": elapsed,
            "chunks": public_chunks,
        }

    def kb_embed(
        self, project_id: str, document_ids: list[str], chunk_size: int, overlap: int
    ) -> dict[str, Any]:
        """实验步骤：向量化。对切好的 Chunk 逐条生成向量，展示真实维度与向量预览。"""
        self._require_current_project(self.get_project(project_id))
        started = time.perf_counter()
        documents = self._resolve_documents(project_id, document_ids)
        chunks = [
            chunk
            for doc in documents
            for chunk in self._split_document(doc, chunk_size, overlap)
        ]
        vectors = self.embedding.embed([chunk["text"] for chunk in chunks])
        elapsed = round((time.perf_counter() - started) * 1000, 2)
        embedded = []
        for chunk, vector in zip(chunks, vectors):
            item = self._public_chunk(chunk)
            item["embedding_preview"] = [round(value, 4) for value in vector[:8]]
            item["vector_norm"] = round(
                math.sqrt(sum(value * value for value in vector)), 4
            )
            embedded.append(item)
        return {
            "model": self.embedding.name,
            "dimension": self.embedding.dimension,
            "chunk_count": len(embedded),
            "latency_ms": elapsed,
            "chunks": embedded,
        }

    @synchronized
    def reset_knowledge_base(self, project_id: str) -> dict[str, Any]:
        """重做本实验：清空已建知识库与 RAG 结果，向导回到起点；不删除已上传资料。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        project["kb"] = None
        project["rag"] = None
        project["current_stage"] = 1
        runs = self.runs.get(project_id, [])
        self.runs[project_id] = [
            run for run in runs if run["type"] not in {"knowledge_base", "rag"}
        ]
        self._persist()
        return self.project_status(project_id)

    @synchronized
    def build_kb(
        self,
        project_id: str,
        document_ids: list[str],
        chunk_size: int,
        overlap: int,
        embedding_model: str,
    ) -> dict[str, Any]:
        project = self.get_project(project_id)
        self._require_current_project(project)
        started = time.perf_counter()
        available = {doc["id"]: doc for doc in PRESET_DOCUMENTS}
        available.update(project.get("documents", {}))
        documents = [
            available[document_id]
            for document_id in document_ids
            if document_id in available
        ]
        if not documents:
            raise ValueError("至少选择一份有效文档")
        chunks = [
            chunk
            for doc in documents
            for chunk in self._split_document(doc, chunk_size, overlap)
        ]
        vectors = self.embedding.embed([chunk["text"] for chunk in chunks])
        for chunk, vector in zip(chunks, vectors):
            chunk["embedding"] = vector
        elapsed = round((time.perf_counter() - started) * 1000, 2)
        kb = {
            "id": f"kb_{uuid.uuid4().hex[:8]}",
            "name": "Crypto Knowledge Base",
            "document_ids": [doc["id"] for doc in documents],
            "chunk_size": chunk_size,
            "overlap": overlap,
            "embedding_model": embedding_model,
            "dimension": self.embedding.dimension,
            "vector_store": self.repository.vector_store_name,
            "status": "ready",
            "build_ms": elapsed,
            "created_at": now_iso(),
            "chunks": chunks,
        }
        project["kb"] = kb
        project["current_stage"] = max(project["current_stage"], 2)
        public = self._public_kb(kb, include_chunks=True)
        self._record(
            project_id,
            "knowledge_base",
            {"documents": document_ids},
            public,
            {"build_ms": elapsed},
        )
        return public

    def _public_chunk(
        self, chunk: dict[str, Any], *, include_embedding: bool = False
    ) -> dict[str, Any]:
        public = {key: value for key, value in chunk.items() if key != "embedding"}
        if include_embedding:
            public["embedding_preview"] = chunk["embedding"][:8]
        return public

    def _public_kb(
        self, kb: dict[str, Any], *, include_chunks: bool = False
    ) -> dict[str, Any]:
        public = {key: value for key, value in kb.items() if key != "chunks"}
        public["document_count"] = len(kb["document_ids"])
        public["chunk_count"] = len(kb["chunks"])
        public["avg_tokens"] = round(
            sum(row["tokens"] for row in kb["chunks"]) / max(len(kb["chunks"]), 1), 1
        )
        if include_chunks:
            public["chunks"] = [
                self._public_chunk(chunk, include_embedding=True)
                for chunk in kb["chunks"]
            ]
        return public

    def kb_stats(self, project_id: str) -> dict[str, Any]:
        kb = self.get_project(project_id)["kb"]
        if not kb:
            raise ValueError("请先构建知识库")
        return self._public_kb(kb, include_chunks=True)

    def search(
        self, project_id: str, query: str, top_k: int, threshold: float
    ) -> dict[str, Any]:
        project = self.get_project(project_id)
        kb = project["kb"]
        if not kb:
            raise ValueError("请先构建知识库")
        started = time.perf_counter()
        query_vector = self.embedding.embed([query])[0]
        results: list[dict[str, Any]] = []
        query_terms = set(tokenize(query))
        query_ascii = set(re.findall(r"[a-z][a-z0-9-]+", query.lower()))
        candidates = (
            self.repository.vector_candidates(project_id, query_vector) or kb["chunks"]
        )
        for chunk in candidates:
            vector_score = chunk.get(
                "_vector_score", cosine(query_vector, chunk["embedding"])
            )
            candidate_terms = set(tokenize(f"{chunk['section']} {chunk['text']}"))
            lexical_score = len(query_terms & candidate_terms) / max(
                min(len(query_terms), 30), 1
            )
            document_ascii = set(
                re.findall(r"[a-z][a-z0-9-]+", chunk["document_title"].lower())
            )
            section_ascii = set(
                re.findall(r"[a-z][a-z0-9-]+", chunk["section"].lower())
            )
            document_bonus = min(0.12, len(query_ascii & document_ascii) * 0.06)
            section_bonus = min(0.24, len(query_ascii & section_ascii) * 0.16)
            score = (
                vector_score * 0.56
                + lexical_score * 0.44
                + document_bonus
                + section_bonus
            )
            if score >= threshold:
                item = self._public_chunk(chunk)
                item.pop("_vector_score", None)
                item["score"] = round(min(score, 0.99), 4)
                results.append(item)
        results.sort(key=lambda row: row["score"], reverse=True)
        latency = round((time.perf_counter() - started) * 1000, 2)
        return {
            "query": query,
            "embedding": {
                "model": self.embedding.name,
                "dimension": self.embedding.dimension,
                "preview": query_vector[:8],
            },
            "results": results[:top_k],
            "latency_ms": latency,
            "top_k": top_k,
            "threshold": threshold,
            "explanation": self._search_explanation(
                len(results[:top_k]), top_k, threshold
            ),
        }

    @staticmethod
    def _search_explanation(result_count: int, top_k: int, threshold: float) -> str:
        if result_count == 0:
            return "没有片段通过阈值。尝试降低 Similarity Threshold，或检查知识库是否包含相关主题。"
        if top_k <= 1:
            return "Top-K 较低，答案可能缺少交叉证据或工程背景。"
        if top_k >= 12 or threshold < 0:
            return "当前配置会引入较多弱相关片段，Context 噪声和冲突风险上升。"
        return "检索规模与阈值处于教学建议区间；仍应逐条核查片段是否真正回答问题。"

    def rag_embed_query(self, project_id: str, query: str) -> dict[str, Any]:
        """RAG 步骤：把问题编码成向量，让它与知识库片段处于同一语义空间。"""
        project = self.get_project(project_id)
        if not project["kb"]:
            raise ValueError("请先构建知识库")
        started = time.perf_counter()
        vector = self.embedding.embed([query])[0]
        return {
            "query": query,
            "model": self.embedding.name,
            "dimension": self.embedding.dimension,
            "preview": [round(value, 4) for value in vector[:8]],
            "vector_norm": round(math.sqrt(sum(value * value for value in vector)), 4),
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        }

    def rag_rerank(
        self,
        project_id: str,
        query: str,
        items: list[dict[str, Any]],
        rerank_enabled: bool,
        rerank_top_n: int,
    ) -> dict[str, Any]:
        """RAG 步骤：对检索候选做交叉重排，把最贴题的证据顶到前面。"""
        self.get_project(project_id)
        started = time.perf_counter()
        before = [dict(item) for item in items]
        if rerank_enabled:
            after = self.reranker.rerank(query, before)
        else:
            after = [dict(item, rerank_score=item.get("score", 0.0)) for item in before]
        after = after[:rerank_top_n]
        moved = [item["id"] for item in before[:rerank_top_n]] != [
            item["id"] for item in after
        ]
        return {
            "enabled": rerank_enabled,
            "provider": self.reranker.name,
            "before": [item["id"] for item in before],
            "after": [item["id"] for item in after],
            "items": after,
            "reordered": bool(rerank_enabled and moved),
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        }

    def rag_build_context(
        self,
        project_id: str,
        query: str,
        items: list[dict[str, Any]],
        max_context_tokens: int,
    ) -> dict[str, Any]:
        """RAG 步骤：在 token 预算内装配上下文，决定哪些证据真正进入提示词。"""
        self.get_project(project_id)
        started = time.perf_counter()
        context: list[dict[str, Any]] = []
        dropped: list[dict[str, Any]] = []
        used_tokens = 0
        for item in items:
            tokens = int(item.get("tokens", 0))
            if used_tokens + tokens > max_context_tokens and context:
                dropped.append(item)
                continue
            context.append(item)
            used_tokens += tokens
        return {
            "items": context,
            "dropped": dropped,
            "tokens": used_tokens,
            "max_tokens": max_context_tokens,
            "utilization": round(used_tokens / max(max_context_tokens, 1), 3),
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        }

    @synchronized
    def rag_compare(self, request: Any) -> dict[str, Any]:
        project = self.get_project(request.project_id)
        self._require_current_project(project)
        benchmark = (
            next(
                (row for row in RAG_BENCHMARKS if row["id"] == request.benchmark_id),
                None,
            )
            if request.benchmark_id
            else None
        )
        if request.benchmark_id and not benchmark:
            raise ValueError("RAG 基准任务不存在")
        if benchmark and request.query.strip() != benchmark["question"]:
            raise ValueError("基准任务问题已被修改；请作为自定义问题运行")
        started = time.perf_counter()
        search = self.search(
            request.project_id, request.query, request.top_k, request.threshold
        )
        before = search["results"]
        after = (
            self.reranker.rerank(request.query, before)
            if request.rerank_enabled
            else [dict(item, rerank_score=item["score"]) for item in before]
        )
        after = after[: request.rerank_top_n]
        context: list[dict[str, Any]] = []
        used_tokens = 0
        for item in after:
            if used_tokens + item["tokens"] > request.max_context_tokens and context:
                continue
            context.append(item)
            used_tokens += item["tokens"]
        base_answer = self.llm.generate(request.query)
        base_provider = getattr(self.llm, "last_provider_name", self.llm.name)
        rag_answer = self._strip_internal_source_markers(
            self.llm.generate(request.query, context=context)
        )
        scored_rag_answer = rag_answer
        rag_provider = getattr(self.llm, "last_provider_name", self.llm.name)
        citations = [
            self._citation(index + 1, item, self.get_project(request.project_id))
            for index, item in enumerate(context)
        ]
        if citations:
            rag_answer += "\n\n" + " ".join(
                f"[{row['index']}] {row['document']} · {row['section']}"
                for row in citations
            )
        duration = round((time.perf_counter() - started) * 1000, 2)
        key_terms = set(tokenize(request.query))
        hit_terms = set(token for item in context for token in tokenize(item["text"]))
        hit_rate = round(
            min(1.0, len(key_terms & hit_terms) / max(len(key_terms), 1)), 2
        )
        evaluation = (
            self._evaluate_rag_benchmark(
                benchmark,
                base_answer,
                scored_rag_answer,
                self.get_project(request.project_id),
            )
            if benchmark
            else None
        )
        trace = {
            "query": request.query,
            "embedding": search["embedding"],
            "retrieval": before,
            "rerank": {
                "enabled": request.rerank_enabled,
                "provider": self.reranker.name,
                "before": [item["id"] for item in before],
                "after": [item["id"] for item in after],
                "items": after,
            },
            "context": {
                "items": context,
                "tokens": used_tokens,
                "max_tokens": request.max_context_tokens,
            },
            "prompt": {
                "template": request.prompt_template,
                "structure": [
                    "System：密码学教学助手",
                    "Context：仅使用给定知识片段",
                    f"Question：{request.query}",
                    "Requirements：结论、依据、边界、引用",
                ],
            },
        }
        quality_score = (
            evaluation["rag_score"]
            if evaluation
            else round(62 + hit_rate * 22 + min(len(citations), 3) * 4, 1)
        )
        result = {
            "run_id": f"rag_{uuid.uuid4().hex[:8]}",
            "base": {"provider": base_provider, "answer": base_answer, "citations": []},
            "rag": {
                "provider": rag_provider,
                "answer": rag_answer,
                "citations": citations,
            },
            "trace": trace,
            "metrics": {
                "context_hit_rate": hit_rate,
                "citation_coverage": 1.0 if citations else 0.0,
                "retrieved_chunks": len(before),
                "context_chunks": len(context),
                "latency_ms": duration,
                "quality_score": quality_score,
                "base_fact_score": evaluation["base_score"] if evaluation else None,
                "rag_fact_score": evaluation["rag_score"] if evaluation else None,
                "knowledge_gain": evaluation["knowledge_gain"] if evaluation else None,
            },
            "benchmark": evaluation,
            "diagnosis": self._rag_diagnosis(
                evaluation, len(before), request.top_k, request.threshold
            ),
        }
        project = self.get_project(request.project_id)
        project["rag"] = {
            "id": f"pipeline_{uuid.uuid4().hex[:8]}",
            "top_k": request.top_k,
            "threshold": request.threshold,
            "rerank_enabled": request.rerank_enabled,
            "rerank_top_n": request.rerank_top_n,
            "prompt_template": request.prompt_template,
        }
        project["current_stage"] = max(project["current_stage"], 3)
        self._record(
            request.project_id,
            "rag",
            {"query": request.query},
            result,
            result["metrics"],
        )
        return result

    @staticmethod
    def _citation(
        index: int, item: dict[str, Any], project: dict[str, Any]
    ) -> dict[str, Any]:
        preset = next(
            (
                document
                for document in PRESET_DOCUMENTS
                if document["id"] == item["document_id"]
            ),
            None,
        )
        document = preset or project.get("documents", {}).get(item["document_id"], {})
        return {
            "index": index,
            "chunk_id": item["id"],
            "document": item["document_title"],
            "section": item["section"],
            "score": item.get("rerank_score", item["score"]),
            "source_type": document.get(
                "source_type",
                "用户上传" if document.get("source") == "upload" else "课程知识包",
            ),
            "source_title": document.get(
                "source_title", document.get("title", item["document_title"])
            ),
            "source_date": document.get("source_date"),
            "source_url": document.get("source_url"),
            "scenario_notice": document.get("scenario_notice"),
        }

    @staticmethod
    def _answer_fact_checks(
        answer: str, facts: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        normalized = answer.lower().replace(",", "").replace("，", "")
        return [
            {
                "id": fact["id"],
                "label": fact["label"],
                "hit": all(token.lower() in normalized for token in fact["tokens"]),
            }
            for fact in facts
        ]

    @staticmethod
    def _strip_internal_source_markers(answer: str) -> str:
        """Keep implementation IDs out of student-facing prose."""
        cleaned = re.sub(
            r"\s*[（(]\s*(?:来源\s*[：:]|见\s*)?(?:chunk_id\s*[=:]\s*)?[`\"']?chk_[^）)\n]+[）)]",
            "",
            answer,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(
            r"[`\"']?chk_[a-z0-9_.-]+[`\"']?",
            "知识库证据",
            cleaned,
            flags=re.IGNORECASE,
        )
        return re.sub(r"[ \t]+\n", "\n", cleaned).strip()

    def _evaluate_rag_benchmark(
        self,
        benchmark: dict[str, Any],
        base_answer: str,
        rag_answer: str,
        project: dict[str, Any],
    ) -> dict[str, Any]:
        base_checks = self._answer_fact_checks(base_answer, benchmark["facts"])
        rag_checks = self._answer_fact_checks(rag_answer, benchmark["facts"])
        base_score = round(
            sum(row["hit"] for row in base_checks) / len(base_checks) * 100
        )
        rag_score = round(sum(row["hit"] for row in rag_checks) / len(rag_checks) * 100)
        indexed = (
            set(project.get("kb", {}).get("document_ids", []))
            if project.get("kb")
            else set()
        )
        missing = [
            document_id
            for document_id in benchmark["document_ids"]
            if document_id not in indexed
        ]
        return {
            "id": benchmark["id"],
            "label": benchmark["label"],
            "kind": benchmark["kind"],
            "base_score": base_score,
            "rag_score": rag_score,
            "knowledge_gain": rag_score - base_score,
            "facts": [
                {
                    **fact,
                    "base_hit": base_checks[index]["hit"],
                    "rag_hit": rag_checks[index]["hit"],
                }
                for index, fact in enumerate(benchmark["facts"])
            ],
            "required_document_ids": benchmark["document_ids"],
            "missing_document_ids": missing,
            "scoring_note": "按预先公布的关键事实逐项匹配；分数衡量证据要点覆盖，不等同于语言风格评分。",
        }

    @staticmethod
    def _rag_diagnosis(
        evaluation: dict[str, Any] | None,
        result_count: int,
        top_k: int,
        threshold: float,
    ) -> str:
        if evaluation:
            if evaluation["missing_document_ids"]:
                return f"知识库缺少基准资料：{'、'.join(evaluation['missing_document_ids'])}。请回到实验一选中资料并重建。"
            gain = evaluation["knowledge_gain"]
            if gain >= 40:
                return f"RAG 多命中 {gain} 个百分点的关键事实，知识增益明显；请继续核查引用是否真正支持结论。"
            if gain > 0:
                return f"RAG 多命中 {gain} 个百分点；可调 Top-K / Rerank 检查是否还有证据遗漏。"
            return "本题 Base LLM 已覆盖较多要点，或检索未形成增益。换用私域制度任务，或检查 Context 中是否命中所需资料。"
        return PlatformService._search_explanation(result_count, top_k, threshold)

    @synchronized
    def update_skill(self, skill_id: str, payload: Any) -> dict[str, Any]:
        if skill_id not in self.skills:
            raise KeyError("Skill 不存在")
        self.skills[skill_id].update(payload.model_dump())
        self._persist()
        return self.skills[skill_id]

    def run_tool(
        self, tool_name: str, arguments: dict[str, Any], project_id: str | None = None
    ) -> dict[str, Any]:
        if tool_name == "knowledge_search":
            if not project_id:
                raise ValueError("knowledge_search 需要 project_id")
            query = str(arguments.get("query", ""))
            result = self.search(
                project_id,
                query,
                int(arguments.get("top_k", 3)),
                float(arguments.get("threshold", 0.05)),
            )
            return {"tool": tool_name, "status": "success", "output": result["results"]}
        if tool_name == "calculator":
            expression = str(arguments.get("expression", ""))
            value = safe_calculate(expression)
            return {
                "tool": tool_name,
                "status": "success",
                "output": {"expression": expression, "value": value},
            }
        if tool_name == "crypto_formula_tool":
            operation = arguments.get("operation")
            values = [int(value) for value in arguments.get("values", [])]
            if operation == "gcd" and len(values) == 2:
                answer = math.gcd(values[0], values[1])
            elif operation == "mod_inverse" and len(values) == 2:
                answer = pow(values[0], -1, values[1])
            elif operation == "mod_pow" and len(values) == 3:
                answer = pow(values[0], values[1], values[2])
            else:
                raise ValueError("仅支持 gcd(a,b)、mod_inverse(a,m)、mod_pow(a,e,m)")
            return {
                "tool": tool_name,
                "status": "success",
                "output": {"operation": operation, "values": values, "value": answer},
            }
        raise KeyError("Tool 不存在")

    @synchronized
    def tool_experiment(
        self, project_id: str, task_id: str, custom_question: str | None = None
    ) -> dict[str, Any]:
        """实验：Tools 工具调用（手写）。同一道密码学计算题，对比模型口算与调用安全工具的差异。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        task = next((row for row in TOOL_TASKS if row["id"] == task_id), None)
        if task is None:
            raise ValueError("计算任务不存在")

        started = time.perf_counter()
        correct_answer = compute_tool_answer(task["operation"], task["values"])

        # PATH A：无工具，模型纯自然语言推理（大数运算容易出错）。
        no_tool_prompt = (
            f"{task['question']}\n\n"
            "请仅凭自己的推算直接给出答案，不要使用任何外部计算工具或代码。"
            "在回答的最后一行用“答案：<整数>”的格式给出最终结果。"
        )
        no_tool_answer = self.llm.generate(no_tool_prompt)
        no_tool_provider = getattr(self.llm, "last_provider_name", self.llm.name)
        no_tool_value = extract_final_integer(no_tool_answer)
        no_tool_correct = no_tool_value == correct_answer

        # PATH B：调用安全工具精确计算，再让模型基于工具结果作答。
        tool_started = time.perf_counter()
        tool_output = compute_tool_answer(task["operation"], task["values"])
        tool_duration = round((time.perf_counter() - tool_started) * 1000, 3)
        tool_call = {
            "tool": "crypto_formula_tool",
            "permission": "白名单",
            "input": {"operation": task["operation"], "values": task["values"]},
            "output": {"value": tool_output},
            "status": "success",
            "duration_ms": tool_duration,
        }
        with_tool_prompt = (
            f"{task['question']}\n\n"
            f"一个经过验证的安全密码学工具 crypto_formula_tool 已计算出结果：{tool_output}。"
            "请基于这个可信的工具结果，用一句话向学生说明答案及其含义。"
            "在回答的最后一行用“答案：<整数>”的格式给出最终结果。"
        )
        with_tool_answer = self.llm.generate(with_tool_prompt)
        with_tool_provider = getattr(self.llm, "last_provider_name", self.llm.name)
        with_tool_value = extract_final_integer(with_tool_answer)
        with_tool_correct = with_tool_value == correct_answer

        duration = round((time.perf_counter() - started) * 1000, 2)
        result = {
            "run_id": f"tool_{uuid.uuid4().hex[:8]}",
            "task": {
                key: task[key]
                for key in [
                    "id",
                    "label",
                    "category",
                    "question",
                    "operation",
                    "values",
                    "hint",
                ]
            },
            "correct_answer": correct_answer,
            "no_tool": {
                "provider": no_tool_provider,
                "answer": no_tool_answer,
                "value": no_tool_value,
                "correct": no_tool_correct,
            },
            "with_tool": {
                "provider": with_tool_provider,
                "answer": with_tool_answer,
                "value": with_tool_value,
                "correct": with_tool_correct,
                "tool_call": tool_call,
            },
            "metrics": {
                "no_tool_correct": no_tool_correct,
                "with_tool_correct": with_tool_correct,
                "accuracy_gain": int(with_tool_correct) - int(no_tool_correct),
                "latency_ms": duration,
            },
            "diagnosis": self._tool_diagnosis(no_tool_correct, with_tool_correct),
        }
        project["current_stage"] = max(project.get("current_stage", 1), 1)
        self._record(
            project_id,
            "tool_experiment",
            {"task_id": task_id},
            result,
            result["metrics"],
        )
        return result

    @staticmethod
    def _tool_diagnosis(no_tool_correct: bool, with_tool_correct: bool) -> str:
        if not no_tool_correct and with_tool_correct:
            return "无工具时模型对大数运算给出了错误结果；接入安全计算工具后得到精确答案。这说明工具让智能体能做“可靠执行”，而不只是“语言推理”。"
        if no_tool_correct and with_tool_correct:
            return "本题模型口算恰好正确，但大数或更复杂运算下口算并不可靠；工具提供的是确定性的精确保证。可换更大的数再试一次。"
        if not no_tool_correct and not with_tool_correct:
            return "两条路径都未给出正确整数，请检查题目数值或重试；正常情况下工具路径应当稳定正确。"
        return "无工具路径正确而工具路径异常，属于少见情况，请重试本题。"

    # ── 实验 1：数据工程 ──────────────────────────────────────────
    @synchronized
    def data_engineering_experiment(self, project_id: str) -> dict[str, Any]:
        """密码语料构建与治理：对比原始杂乱语料与清洗后的高质量数据集。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        started = time.perf_counter()
        raw = DATA_ENGINEERING["raw_samples"]
        kept_ids = set(DATA_ENGINEERING["kept_ids"])
        cleaned = [dict(s, kept=s["id"] in kept_ids) for s in raw]
        raw_count = len(raw)
        kept_count = len(kept_ids)
        removed = raw_count - kept_count
        dup_count = sum(
            1
            for s in raw
            if "重复" in " ".join(s["issues"]) or "完全重复" in s["issues"]
        )
        result = {
            "run_id": f"data_{uuid.uuid4().hex[:8]}",
            "stages": DATA_ENGINEERING["pipeline_stages"],
            "samples": cleaned,
            "off": {
                "label": "原始语料",
                "count": raw_count,
                "quality": 38,
                "note": "含广告、HTML 标签、重复、低质与违规内容，直接用于训练会污染模型。",
            },
            "on": {
                "label": "治理后语料",
                "count": kept_count,
                "quality": 94,
                "note": "去重、清洗、质量过滤与规范化后保留的高质量密码学语料。",
            },
            "metrics": {
                "raw_count": raw_count,
                "kept_count": kept_count,
                "removed_count": removed,
                "dedup_rate": round(dup_count / raw_count, 2),
                "retention_rate": round(kept_count / raw_count, 2),
                "quality_gain": 94 - 38,
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            },
            "diagnosis": f"原始 {raw_count} 条样本经过去重/清洗/过滤/规范化后保留 {kept_count} 条高质量语料（保留率 {round(kept_count / raw_count * 100)}%）。数据质量是模型能力的地基——脏数据会直接污染后续训练。",
        }
        project["current_stage"] = max(project.get("current_stage", 1), 1)
        self._record(project_id, "data_engineering", {}, result, result["metrics"])
        return result

    # ── 实验 2：继续预训练 CPT ────────────────────────────────────
    @synchronized
    def cpt_experiment(self, project_id: str) -> dict[str, Any]:
        """继续预训练：对比通用基座与注入密码知识后的基座（知识探针 + loss 曲线）。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        started = time.perf_counter()
        probes = CPT_EXPERIMENT["probes"]
        base_hits = sum(1 for p in probes if p["base_hit"])
        cpt_hits = sum(1 for p in probes if p["cpt_hit"])
        total = len(probes)
        result = {
            "run_id": f"cpt_{uuid.uuid4().hex[:8]}",
            "probes": probes,
            "loss_curve": {
                "steps": CPT_EXPERIMENT["steps"],
                "base": CPT_EXPERIMENT["loss_curve_base"],
                "cpt": CPT_EXPERIMENT["loss_curve_cpt"],
            },
            "corpus_tokens": CPT_EXPERIMENT["corpus_tokens"],
            "off": {
                "label": "通用基座",
                "probe_score": round(base_hits / total * 100),
                "note": "对通用常识尚可，但对密码学专业事实经常答错或含糊。",
            },
            "on": {
                "label": "密码 CPT 基座",
                "probe_score": round(cpt_hits / total * 100),
                "note": "在密码语料上继续预训练后，领域知识探针命中率显著提升。",
            },
            "metrics": {
                "base_probe_score": round(base_hits / total * 100),
                "cpt_probe_score": round(cpt_hits / total * 100),
                "probe_gain": round((cpt_hits - base_hits) / total * 100),
                "final_loss_base": CPT_EXPERIMENT["loss_curve_base"][-1],
                "final_loss_cpt": CPT_EXPERIMENT["loss_curve_cpt"][-1],
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            },
            "diagnosis": f"在 {CPT_EXPERIMENT['corpus_tokens']} 密码语料上继续预训练后，领域知识探针命中率从 {round(base_hits / total * 100)}% 提升到 {round(cpt_hits / total * 100)}%，训练 loss 也明显低于通用基座。CPT 把领域知识写进了模型参数。",
        }
        project["current_stage"] = max(project.get("current_stage", 1), 1)
        self._record(project_id, "cpt", {}, result, result["metrics"])
        return result

    # ── 实验 3：监督微调 SFT ──────────────────────────────────────
    @synchronized
    def sft_experiment(self, project_id: str, task_id: str) -> dict[str, Any]:
        """监督微调：真实调用大模型，对比"未对齐"与"已对齐"两种回答风格。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        task = next((t for t in SFT_EXPERIMENT["tasks"] if t["id"] == task_id), None)
        if task is None:
            raise ValueError("SFT 任务不存在")
        started = time.perf_counter()
        instruction = task["instruction"]
        base_prompt = (
            "你在扮演一个【只做过预训练、没有经过指令微调】的语言模型。"
            "你不擅长遵循指令，倾向于续写、重复问题或答非所问，回答冗长发散、缺乏结构。"
            f"现在面对这句输入，请以这种「未对齐」的方式回应（不要表现得像助手）：\n\n{instruction}"
        )
        sft_prompt = (
            "你是一个经过监督微调（SFT）、良好对齐的密码学助手。"
            "请严格遵循指令，回答简洁、专业、有结构；涉及不安全请求时礼貌拒绝并给出合规引导。"
            f"\n\n指令：{instruction}"
        )
        base_answer = self.llm.generate(base_prompt)
        base_provider = getattr(self.llm, "last_provider_name", self.llm.name)
        sft_answer = self.llm.generate(sft_prompt)
        sft_provider = getattr(self.llm, "last_provider_name", self.llm.name)
        result = {
            "run_id": f"sft_{uuid.uuid4().hex[:8]}",
            "task": {
                k: task[k] for k in ["id", "instruction", "base_style", "sft_style"]
            },
            "off": {
                "label": "仅预训练（未对齐）",
                "provider": base_provider,
                "answer": base_answer,
                "style": task["base_style"],
            },
            "on": {
                "label": "SFT 微调后（已对齐）",
                "provider": sft_provider,
                "answer": sft_answer,
                "style": task["sft_style"],
            },
            "metrics": {
                "instruction_follow_base": SFT_EXPERIMENT["instruction_follow_base"],
                "instruction_follow_sft": SFT_EXPERIMENT["instruction_follow_sft"],
                "follow_gain": round(
                    SFT_EXPERIMENT["instruction_follow_sft"]
                    - SFT_EXPERIMENT["instruction_follow_base"],
                    2,
                ),
                "sample_pairs": SFT_EXPERIMENT["sample_pairs"],
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            },
            "diagnosis": "同一条指令，未对齐模型倾向续写/发散，SFT 后模型遵循指令、结构化作答并能安全拒绝。SFT 用大量指令-回答对教会模型「如何听话」。",
        }
        project["current_stage"] = max(project.get("current_stage", 1), 1)
        self._record(project_id, "sft", {"task_id": task_id}, result, result["metrics"])
        return result

    # ── 实验 4：偏好对齐 RLHF / DPO ───────────────────────────────
    @synchronized
    def rlhf_experiment(self, project_id: str) -> dict[str, Any]:
        """偏好对齐：展示偏好对、奖励打分，对比 SFT 与 DPO 的胜率/安全率。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        started = time.perf_counter()
        pairs = RLHF_EXPERIMENT["preference_pairs"]
        avg_chosen = round(sum(p["reward_chosen"] for p in pairs) / len(pairs), 1)
        avg_rejected = round(sum(p["reward_rejected"] for p in pairs) / len(pairs), 1)
        result = {
            "run_id": f"rlhf_{uuid.uuid4().hex[:8]}",
            "preference_pairs": pairs,
            "off": {
                "label": "SFT 模型（未对齐偏好）",
                "win_rate": RLHF_EXPERIMENT["win_rate_sft"],
                "safety_rate": RLHF_EXPERIMENT["safety_rate_sft"],
            },
            "on": {
                "label": "DPO 对齐后",
                "win_rate": RLHF_EXPERIMENT["win_rate_dpo"],
                "safety_rate": RLHF_EXPERIMENT["safety_rate_dpo"],
            },
            "metrics": {
                "avg_reward_chosen": avg_chosen,
                "avg_reward_rejected": avg_rejected,
                "reward_margin": round(avg_chosen - avg_rejected, 1),
                "win_rate_gain": round(
                    RLHF_EXPERIMENT["win_rate_dpo"] - RLHF_EXPERIMENT["win_rate_sft"], 2
                ),
                "safety_gain": round(
                    RLHF_EXPERIMENT["safety_rate_dpo"]
                    - RLHF_EXPERIMENT["safety_rate_sft"],
                    2,
                ),
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            },
            "diagnosis": f"通过 chosen/rejected 偏好对训练，奖励模型给「更好回答」打高分（均值 {avg_chosen} vs {avg_rejected}）。DPO 对齐后人类偏好胜率从 {round(RLHF_EXPERIMENT['win_rate_sft'] * 100)}% 升到 {round(RLHF_EXPERIMENT['win_rate_dpo'] * 100)}%，安全率也大幅提升。",
        }
        project["current_stage"] = max(project.get("current_stage", 1), 1)
        self._record(project_id, "rlhf", {}, result, result["metrics"])
        return result

    # ── 实验 10：多智能体协同 ─────────────────────────────────────
    @synchronized
    def multi_agent_experiment(self, project_id: str, task_id: str) -> dict[str, Any]:
        """多智能体协同：对比单 Agent 独自完成 vs 多 Agent 分工协作。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        task = next(
            (t for t in MULTI_AGENT_EXPERIMENT["tasks"] if t["id"] == task_id), None
        )
        if task is None:
            raise ValueError("多智能体任务不存在")
        started = time.perf_counter()
        query = task["query"]
        roles = MULTI_AGENT_EXPERIMENT["roles"]

        # OFF：单 Agent 一次性回答
        single_answer = self.llm.generate(
            f"你是一个密码学助手，请独自完成下面这个复杂任务（只有你一个人，没有其他协作者）：\n\n{query}"
        )
        single_provider = getattr(self.llm, "last_provider_name", self.llm.name)

        # ON：多 Agent 分工，每个角色真实调用一次
        role_outputs: list[dict[str, Any]] = []
        context = ""
        for role in roles:
            role_prompt = (
                f"你是一个多智能体协作系统中的【{role['name']}】，职责是：{role['role']}。"
                f"当前任务：{query}\n\n"
            )
            if context:
                role_prompt += f"前序 Agent 的产出：\n{context}\n\n请基于以上产出，只完成你这个角色的部分，简明扼要。"
            else:
                role_prompt += "你是第一个处理者，请只完成你这个角色的部分，简明扼要。"
            output = self.llm.generate(role_prompt)
            role_outputs.append(
                {
                    "id": role["id"],
                    "name": role["name"],
                    "role": role["role"],
                    "color": role["color"],
                    "output": output,
                }
            )
            context += f"\n【{role['name']}】：{output[:400]}\n"
        multi_provider = getattr(self.llm, "last_provider_name", self.llm.name)
        final_answer = role_outputs[-1]["output"]

        result = {
            "run_id": f"ma_{uuid.uuid4().hex[:8]}",
            "task": {"id": task["id"], "title": task["title"], "query": query},
            "off": {
                "label": "单 Agent",
                "provider": single_provider,
                "answer": single_answer,
                "note": "一个 Agent 独自扛下规划、专业、审查、汇总所有职责，容易顾此失彼。",
            },
            "on": {
                "label": "多 Agent 协同",
                "provider": multi_provider,
                "roles": role_outputs,
                "final_answer": final_answer,
                "note": "规划→专家→审查→汇总分工协作，每个角色专注一件事，交叉审查降低疏漏。",
            },
            "metrics": {
                "single_agents": 1,
                "multi_agents": len(roles),
                "single_length": len(single_answer),
                "multi_length": sum(len(r["output"]) for r in role_outputs),
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            },
            "diagnosis": f"单 Agent 独自完成时需要一次性兼顾规划、专业、审查、汇总，容易疏漏；{len(roles)} 个 Agent 分工协作后，每个角色专注一件事，并通过审查 Agent 交叉把关，复杂任务的完整性和可靠性更高。",
        }
        project["current_stage"] = max(project.get("current_stage", 1), 1)
        self._record(
            project_id, "multi_agent", {"task_id": task_id}, result, result["metrics"]
        )
        return result

    # ── 实验 7：Skills 技能封装 ───────────────────────────────────
    @synchronized
    def skill_experiment(self, project_id: str, task_id: str) -> dict[str, Any]:
        """Skills：对比纯 prompt 自由发挥 vs 挂载 Skill（结构化流程注入）。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        task = next((t for t in SKILL_EXPERIMENT["tasks"] if t["id"] == task_id), None)
        if task is None:
            raise ValueError("Skill 任务不存在")
        started = time.perf_counter()
        query = task["query"]
        skill = self.skills.get(task["skill"], {})
        steps = task["steps"]

        # OFF：纯 prompt，模型自由发挥
        free_answer = self.llm.generate(query)
        free_provider = getattr(self.llm, "last_provider_name", self.llm.name)

        # ON：注入 Skill 的结构化流程
        skill_prompt = (
            f"你是密码学助手。请严格按照【{skill.get('label', task['skill'])}】技能的既定流程作答：\n"
            + "\n".join(f"{i + 1}. {s}" for i, s in enumerate(steps))
            + f"\n\n请按上述每个步骤分节输出，确保流程完整、不遗漏。\n\n用户任务：{query}"
        )
        skill_answer = self.llm.generate(skill_prompt)
        skill_provider = getattr(self.llm, "last_provider_name", self.llm.name)

        result = {
            "run_id": f"skill_{uuid.uuid4().hex[:8]}",
            "task": {"id": task["id"], "title": task["title"], "query": query},
            "skill": {
                "id": task["skill"],
                "label": skill.get("label", task["skill"]),
                "steps": steps,
            },
            "off": {
                "label": "纯 Prompt 自由发挥",
                "provider": free_provider,
                "answer": free_answer,
                "note": "没有结构约束，回答的组织方式全凭模型即兴发挥，步骤可能缺失或跑偏。",
            },
            "on": {
                "label": f"挂载 Skill · {skill.get('label', task['skill'])}",
                "provider": skill_provider,
                "answer": skill_answer,
                "note": "Skill 注入了固定流程，模型按既定步骤逐节作答，流程规范、可复用、可教学。",
            },
            "metrics": {
                "skill_steps": len(steps),
                "off_length": len(free_answer),
                "on_length": len(skill_answer),
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            },
            "diagnosis": f"同一任务，纯 prompt 时模型自由发挥、步骤不稳定；挂载「{skill.get('label', task['skill'])}」Skill 后，模型严格按 {len(steps)} 个既定步骤作答，流程规范可复用。Skill 把专家经验固化成可挂载的能力。",
        }
        project["current_stage"] = max(project.get("current_stage", 1), 1)
        self._record(
            project_id, "skills", {"task_id": task_id}, result, result["metrics"]
        )
        return result

    # ── 实验 9：Agent 闭环（Planning + Memory）────────────────────
    @synchronized
    def agent_loop_experiment(self, project_id: str, task_id: str) -> dict[str, Any]:
        """Agent 闭环：对比单步直答 vs 先规划再执行（Planning + Memory）。"""
        project = self.get_project(project_id)
        self._require_current_project(project)
        task = next(
            (t for t in AGENT_LOOP_EXPERIMENT["tasks"] if t["id"] == task_id), None
        )
        if task is None:
            raise ValueError("Agent 闭环任务不存在")
        started = time.perf_counter()
        query = task["query"]

        # OFF：单步直接回答
        direct_answer = self.llm.generate(query)
        direct_provider = getattr(self.llm, "last_provider_name", self.llm.name)

        # ON：先让模型生成结构化计划，再逐步执行、带记忆
        plan_prompt = (
            f"你是一个会规划的密码学 Agent。面对下面的复杂任务，先不要直接回答，"
            f"而是输出一个 3-5 步的结构化执行计划（每行一步，简短）：\n\n{query}"
        )
        plan_text = self.llm.generate(plan_prompt)
        plan_steps = [
            re.sub(r"^\s*[\d.、)\-]+\s*", "", line).strip()
            for line in plan_text.splitlines()
            if line.strip() and len(line.strip()) > 2
        ][:5]

        execute_prompt = (
            f"你是一个会规划、有记忆的密码学 Agent。你已经为任务制定了如下计划：\n"
            + "\n".join(f"{i + 1}. {s}" for i, s in enumerate(plan_steps))
            + f"\n\n现在请严格按这个计划逐步执行，最终给出结构化、完整的方案。\n\n任务：{query}"
        )
        planned_answer = self.llm.generate(execute_prompt)
        planned_provider = getattr(self.llm, "last_provider_name", self.llm.name)

        result = {
            "run_id": f"loop_{uuid.uuid4().hex[:8]}",
            "task": {"id": task["id"], "title": task["title"], "query": query},
            "off": {
                "label": "单步直答（无规划无记忆）",
                "provider": direct_provider,
                "answer": direct_answer,
                "note": "模型一步到位地回答复杂任务，容易遗漏步骤、缺乏条理。",
            },
            "on": {
                "label": "规划 + 记忆闭环",
                "provider": planned_provider,
                "plan": plan_steps,
                "answer": planned_answer,
                "note": "先生成结构化计划，再按计划逐步执行并保留上下文记忆，条理清晰、覆盖完整。",
            },
            "metrics": {
                "plan_steps": len(plan_steps),
                "off_length": len(direct_answer),
                "on_length": len(planned_answer),
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            },
            "diagnosis": f"面对复杂任务，单步直答容易遗漏；先规划出 {len(plan_steps)} 步计划再逐步执行，配合上下文记忆，方案更有条理、覆盖更完整。这就是 Agent 从「一问一答」升级为「会规划、能推进」的关键。",
        }
        project["current_stage"] = max(project.get("current_stage", 1), 1)
        self._record(
            project_id, "agent_loop", {"task_id": task_id}, result, result["metrics"]
        )
        return result

    @synchronized
    def agent_run(
        self, project_id: str, query: str, memory_enabled: bool
    ) -> dict[str, Any]:
        project = self.get_project(project_id)
        self._require_current_project(project)
        if not project["kb"]:
            raise ValueError("Agent 需要实验一生成的知识库")
        lowered = query.lower()
        is_selection = any(
            term in lowered
            for term in [
                "选型",
                "应该选择",
                "优先考虑",
                "方案",
                "he、mpc、tee",
                "he, mpc, tee",
            ]
        )
        is_compare = any(term in lowered for term in ["比较", "区别", "差异", "哪个"])
        selected_skill = (
            "crypto_selection"
            if is_selection
            else "crypto_compare"
            if is_compare
            else "crypto_explain"
        )
        skill = self.skills[selected_skill]
        candidates = []
        for name in ["HE", "MPC", "TEE", "AES", "RSA", "SM4", "ECC", "PQC"]:
            if name.lower() in lowered:
                candidates.append(name)
        plan = self._agent_plan(selected_skill, candidates)
        search_result = self.search(project_id, query, 5, 0.02)
        tool_calls = [
            {
                "tool": "knowledge_search",
                "input": {"query": query, "top_k": 5},
                "status": "success",
                "summary": f"命中 {len(search_result['results'])} 个知识片段",
                "output": search_result["results"][:3],
                "duration_ms": search_result["latency_ms"],
            }
        ]
        answer = self._agent_answer(
            query, selected_skill, plan, search_result["results"]
        )
        answer_provider = getattr(self.llm, "last_provider_name", self.llm.name)
        trace_steps = [
            {
                "type": "classification",
                "title": "任务分类",
                "detail": skill["label"],
                "status": "completed",
            },
            {
                "type": "plan",
                "title": "生成结构化计划",
                "detail": f"{len(plan)} 个可观察步骤",
                "status": "completed",
            },
            {
                "type": "skill",
                "title": "选择 Skill",
                "detail": selected_skill,
                "status": "completed",
            },
            {
                "type": "tool",
                "title": "调用 Tool",
                "detail": "knowledge_search",
                "status": "completed",
            },
            {
                "type": "observation",
                "title": "读取工具结果",
                "detail": f"{len(search_result['results'])} 个相关 Chunk",
                "status": "completed",
            },
            {
                "type": "final",
                "title": "组装最终建议",
                "detail": "包含依据、权衡和部署建议",
                "status": "completed",
            },
        ]
        result = {
            "run_id": f"agent_{uuid.uuid4().hex[:8]}",
            "goal": query,
            "classification": skill["label"],
            "selected_skill": skill,
            "plan": plan,
            "tool_calls": tool_calls,
            "trace_steps": trace_steps,
            "answer": answer,
            "answer_provider": answer_provider,
            "memory": {
                "enabled": memory_enabled,
                "stored": memory_enabled,
                "items": 1 if memory_enabled else 0,
            },
            "metrics": {
                "status": "completed",
                "steps": len(trace_steps),
                "tool_success_rate": 1.0,
                "citations": min(3, len(search_result["results"])),
            },
        }
        project["agent"] = {
            "id": "mini_crypto_agent",
            "skills": [row["id"] for row in self.skills.values() if row["enabled"]],
            "tools": [row["id"] for row in self.tools.values() if row["enabled"]],
        }
        project["current_stage"] = 4
        self._record(project_id, "agent", {"query": query}, result, result["metrics"])
        return result

    @staticmethod
    def _agent_plan(skill: str, candidates: list[str]) -> list[str]:
        target = " / ".join(candidates) if candidates else "候选密码技术"
        if skill == "crypto_selection":
            return [
                "提取隐私目标、参与方与性能约束",
                f"检索 {target} 的安全边界",
                "比较信任假设与计算/通信成本",
                "按场景给出主方案与备选方案",
                "列出实施风险和验证清单",
            ]
        if skill == "crypto_compare":
            return [
                f"分别检索 {target}",
                "比较安全基础与参数",
                "比较性能和部署约束",
                "结合场景生成建议",
            ]
        return [
            f"检索 {target} 的权威知识",
            "解释安全基础",
            "描述工作流程",
            "补充常见误用",
        ]

    def _agent_answer(
        self, query: str, skill: str, plan: list[str], results: list[dict[str, Any]]
    ) -> str:
        lowered = query.lower()
        if getattr(self.llm, "is_remote", False):
            instruction = (
                f"用户任务：{query}\n\n已选择 Skill：{skill}\n公开执行计划：\n"
                + "\n".join(f"{index + 1}. {item}" for index, item in enumerate(plan))
                + "\n\n请输出结构化的密码学任务结果。包括：选型/结论、关键依据、技术权衡、实施建议和风险检查清单。"
            )
            return self.llm.generate(instruction, context=results[:4])
        if all(term in lowered for term in ["he", "mpc", "tee"]):
            return (
                "## 选型结论\n\n"
                "如果是**单一云服务器代为统计、数据方不愿向云披露明文**，优先从 HE 评估；如果数据来自多个互不信任机构，优先 MPC；若需要运行复杂现有程序且能接受硬件信任，则 TEE 通常是性能更现实的路径。\n\n"
                "| 技术 | 云端能否见明文 | 核心信任 | 主要成本 | 适合场景 |\n"
                "|---|---|---|---|---|\n"
                "| HE | 否 | 数学安全与密钥持有者 | 密文膨胀、算子受限 | 单服务器外包统计/推理 |\n"
                "| MPC | 各方不见其他输入 | 不超过阈值的参与方不合谋 | 网络轮次与通信 | 跨机构联合计算 |\n"
                "| TEE | enclave 外不可见，内部为明文 | CPU、固件、证明链 | 侧信道与可信代码 | 复杂逻辑、低延迟 |\n\n"
                "## 建议路线\n\n"
                "先用 CKKS/BFV 验证统计表达式是否适配；不适配时评估 TEE，并对 enclave 做远程证明和最小化可信代码。"
                "如果存在多个独立数据拥有方，再把 MPC 作为主方案。无论选择哪条路线，都需单独处理访问控制、结果泄露与密钥轮换。"
            )
        grounded = self.llm.generate(query, context=results[:3])
        return f"## 分析结果\n\n{grounded}\n\n## 工程检查清单\n\n- 明确威胁模型与安全目标\n- 只使用标准化算法和参数\n- 验证密钥、Nonce 与错误处理\n- 记录引用与部署假设"

    def _record(
        self,
        project_id: str,
        run_type: str,
        input_data: dict[str, Any],
        output: dict[str, Any],
        metrics: dict[str, Any],
    ) -> None:
        self.runs.setdefault(project_id, []).append(
            {
                "id": f"run_{uuid.uuid4().hex[:8]}",
                "type": run_type,
                "input": input_data,
                "output": output,
                "metrics": metrics,
                "created_at": now_iso(),
            }
        )
        self._persist()

    def report(self, project_id: str) -> dict[str, Any]:
        project = self.get_project(project_id)
        status = self.project_status(project_id)
        runs = self.runs.get(project_id, [])
        rag_runs = [run for run in runs if run["type"] == "rag"]
        agent_runs = [run for run in runs if run["type"] == "agent"]
        kb = project["kb"]
        scores = {
            "知识库构建": 92 if kb else 0,
            "RAG 检索": round(
                sum(run["metrics"].get("quality_score", 0) for run in rag_runs)
                / max(len(rag_runs), 1)
            )
            if rag_runs
            else 0,
            "专业回答": 88 if rag_runs else 0,
            "Skill 使用": 90 if agent_runs else 0,
            "Tool 使用": 95 if agent_runs else 0,
            "Agent 完成率": round(
                100
                * sum(
                    1
                    for run in agent_runs
                    if run["metrics"].get("status") == "completed"
                )
                / max(len(agent_runs), 1)
            )
            if agent_runs
            else 0,
        }
        observation_html = sanitize_rich_text(project.get("observation_html", ""))
        observation_markdown = rich_text_markdown(observation_html)
        markdown = self._report_markdown(
            project, status, runs, scores, observation_markdown
        )
        kb_details = None
        documents: list[dict[str, Any]] = []
        if kb:
            kb_details = {
                key: kb[key]
                for key in [
                    "id",
                    "name",
                    "chunk_size",
                    "overlap",
                    "embedding_model",
                    "dimension",
                ]
                if key in kb
            }
            for document_id in kb["document_ids"]:
                document = self._find_document(document_id, project_id)
                if document:
                    documents.append(
                        {
                            "id": document["id"],
                            "title": document["title"],
                            "filename": document["filename"],
                            "source": document.get("source", "preset"),
                        }
                    )
        return {
            "project": status,
            "runs": runs,
            "scores": scores,
            "markdown": markdown,
            "generated_at": now_iso(),
            "observation": {
                "html": observation_html,
                "text": rich_text_plain(observation_html),
                "markdown": observation_markdown,
                "updated_at": project.get("observation_updated_at"),
            },
            "details": {
                "knowledge_base": kb_details,
                "documents": documents,
                "rag_pipeline": deepcopy(project["rag"]),
                "agent": deepcopy(project["agent"]),
            },
        }

    EXPERIMENT_RUN_TYPE_MAP: dict[str, str] = {
        "01": "data_engineering",
        "02": "cpt",
        "03": "sft",
        "04": "rlhf",
        "05": "knowledge_base",
        "06": "rag",
        "07": "skills",
        "08": "tool_experiment",
        "09": "agent_loop",
        "10": "multi_agent",
    }

    EXPERIMENT_LABELS: dict[str, str] = {
        "01": "密码语料构建",
        "02": "继续预训练 CPT",
        "03": "监督微调 SFT",
        "04": "偏好对齐 RLHF",
        "05": "向量知识库",
        "06": "RAG 检索增强",
        "07": "Skills 技能封装",
        "08": "Tools 工具调用",
        "09": "Agent 闭环",
        "10": "多智能体协同",
    }

    EXPERIMENT_OBJECTIVES: dict[str, list[str]] = {
        f"{exp['index']:02d}": list(exp.get("objectives", []))
        for cat in EXPERIMENT_CATEGORIES
        for exp in cat["experiments"]
    }

    EXPERIMENT_TITLES: dict[str, str] = {
        f"{exp['index']:02d}": exp["title"]
        for cat in EXPERIMENT_CATEGORIES
        for exp in cat["experiments"]
    }

    EXPERIMENT_AB: dict[str, dict[str, str]] = {
        f"{exp['index']:02d}": {"off": exp.get("off", ""), "on": exp.get("on", "")}
        for cat in EXPERIMENT_CATEGORIES
        for exp in cat["experiments"]
    }

    def experiment_report(self, project_id: str, exp_id: str) -> dict[str, Any]:
        project = self.get_project(project_id)
        run_type = self.EXPERIMENT_RUN_TYPE_MAP.get(exp_id)
        if not run_type:
            raise KeyError(f"未知实验编号: {exp_id}")
        runs = [r for r in self.runs.get(project_id, []) if r["type"] == run_type]
        obs = project.get("experiment_observations", {}).get(exp_id, {})
        pdf = project.get("experiment_reports", {}).get(exp_id, {})
        latest_run = runs[-1] if runs else None
        return {
            "exp_id": exp_id,
            "label": self.EXPERIMENT_LABELS[exp_id],
            "title": self.EXPERIMENT_TITLES.get(exp_id, self.EXPERIMENT_LABELS[exp_id]),
            "objectives": self.EXPERIMENT_OBJECTIVES.get(exp_id, []),
            "ab": self.EXPERIMENT_AB.get(exp_id, {"off": "", "on": ""}),
            "run_type": run_type,
            "run_count": len(runs),
            "latest_run": latest_run,
            "observation": {
                "html": obs.get("html", ""),
                "text": rich_text_plain(obs.get("html", "")),
                "updated_at": obs.get("updated_at"),
            },
            "report_pdf": {
                "filename": pdf.get("filename"),
                "size_bytes": pdf.get("size_bytes"),
                "uploaded_at": pdf.get("uploaded_at"),
            }
            if pdf.get("filename")
            else None,
            "grading": self._grading_view(project_id, exp_id),
        }

    def experiment_reports_summary(self, project_id: str) -> list[dict[str, Any]]:
        project = self.get_project(project_id)
        all_runs = self.runs.get(project_id, [])
        observations = project.get("experiment_observations", {})
        reports = project.get("experiment_reports", {})
        result: list[dict[str, Any]] = []
        for exp_id in sorted(self.EXPERIMENT_RUN_TYPE_MAP):
            run_type = self.EXPERIMENT_RUN_TYPE_MAP[exp_id]
            runs = [r for r in all_runs if r["type"] == run_type]
            obs = observations.get(exp_id, {})
            latest = runs[-1] if runs else None
            grade = self.grading_records.get(self._grading_key(project_id, exp_id), {})
            result.append(
                {
                    "exp_id": exp_id,
                    "label": self.EXPERIMENT_LABELS[exp_id],
                    "run_count": len(runs),
                    "has_observation": bool(obs.get("html")),
                    "has_report_pdf": bool(reports.get(exp_id, {}).get("filename")),
                    "latest_run_at": latest["created_at"] if latest else None,
                    "observation_updated_at": obs.get("updated_at"),
                    "has_grade": grade.get("status") == "graded",
                    "grade_total": grade.get("total")
                    if grade.get("status") == "graded"
                    else None,
                }
            )
        return result

    @synchronized
    def save_experiment_observation(
        self, project_id: str, exp_id: str, html: str
    ) -> dict[str, Any]:
        project = self.get_project(project_id)
        if exp_id not in self.EXPERIMENT_RUN_TYPE_MAP:
            raise KeyError(f"未知实验编号: {exp_id}")
        sanitized = sanitize_rich_text(html)
        if len(rich_text_plain(sanitized)) > 20_000:
            raise ValueError("观察和感想不能超过 20000 个字符")
        observations = project.setdefault("experiment_observations", {})
        observations[exp_id] = {"html": sanitized, "updated_at": now_iso()}
        self._persist()
        return self.experiment_report(project_id, exp_id)

    @synchronized
    def upload_experiment_report_pdf(
        self, project_id: str, exp_id: str, filename: str, data: bytes
    ) -> dict[str, Any]:
        project = self.get_project(project_id)
        if exp_id not in self.EXPERIMENT_RUN_TYPE_MAP:
            raise KeyError(f"未知实验编号: {exp_id}")
        if not data:
            raise ValueError("上传文件为空")
        if not data.startswith(b"%PDF-"):
            raise ValueError("报告必须是有效的 PDF 文件")
        if len(data) > self.max_upload_bytes:
            raise ValueError("报告 PDF 不能超过 10 MB")
        safe_name = self._safe_filename(filename)
        if Path(safe_name).suffix.lower() != ".pdf":
            raise ValueError("报告文件必须是 PDF 格式")
        reports_dir = self.upload_root / project_id / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        storage_path = reports_dir / f"{exp_id}.pdf"
        storage_path.write_bytes(data)
        reports = project.setdefault("experiment_reports", {})
        reports[exp_id] = {
            "filename": safe_name,
            "size_bytes": len(data),
            "uploaded_at": now_iso(),
            "storage_path": str(storage_path),
        }
        self._persist()
        self._auto_grade_submission(project_id, exp_id, data)
        return self.experiment_report(project_id, exp_id)

    def experiment_report_pdf_path(
        self, project_id: str, exp_id: str
    ) -> tuple[str, str]:
        project = self.get_project(project_id)
        pdf = project.get("experiment_reports", {}).get(exp_id, {})
        storage_path = pdf.get("storage_path")
        if not storage_path or not Path(storage_path).exists():
            raise KeyError("该实验尚未上传报告 PDF")
        return storage_path, pdf.get("filename", f"{exp_id}.pdf")

    @synchronized
    def delete_experiment_report_pdf(
        self, project_id: str, exp_id: str
    ) -> dict[str, Any]:
        project = self.get_project(project_id)
        reports = project.get("experiment_reports", {})
        pdf = reports.pop(exp_id, None)
        if pdf and pdf.get("storage_path"):
            try:
                Path(pdf["storage_path"]).unlink(missing_ok=True)
            except OSError:
                pass
        self._persist()
        return self.experiment_report(project_id, exp_id)

    DEFAULT_SCORING_PROMPT = (
        "请依据评分细则，对照报告中的实际内容逐项打分，给出简短、具体、可追溯的中文点评。"
        "对未完成或缺失的要点应扣分并说明原因。"
    )

    @staticmethod
    def _grading_key(project_id: str, exp_id: str) -> str:
        return f"{project_id}:{exp_id}"

    def _default_rubric(self, exp_id: str) -> dict[str, Any]:
        return {"items": [], "scoring_prompt": "", "updated_at": None}

    def get_rubric(self, exp_id: str) -> dict[str, Any]:
        if exp_id not in self.EXPERIMENT_RUN_TYPE_MAP:
            raise KeyError(f"未知实验编号: {exp_id}")
        rubric = self.grading_rubrics.get(exp_id) or self._default_rubric(exp_id)
        items = [deepcopy(item) for item in rubric.get("items", [])]
        total_points = sum(self._as_points(item.get("points")) for item in items)
        return {
            "exp_id": exp_id,
            "label": self.EXPERIMENT_LABELS[exp_id],
            "title": self.EXPERIMENT_TITLES.get(exp_id, self.EXPERIMENT_LABELS[exp_id]),
            "items": items,
            "scoring_prompt": rubric.get("scoring_prompt", ""),
            "total_points": total_points,
            "sums_to_100": total_points == 100,
            "updated_at": rubric.get("updated_at"),
        }

    def list_rubrics(self) -> list[dict[str, Any]]:
        return [
            self.get_rubric(exp_id) for exp_id in sorted(self.EXPERIMENT_RUN_TYPE_MAP)
        ]

    @staticmethod
    def _as_points(value: Any) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return 0.0
        return max(0.0, number)

    @synchronized
    def update_rubric(
        self,
        exp_id: str,
        items: list[dict[str, Any]],
        scoring_prompt: str,
    ) -> dict[str, Any]:
        if exp_id not in self.EXPERIMENT_RUN_TYPE_MAP:
            raise KeyError(f"未知实验编号: {exp_id}")
        normalized: list[dict[str, Any]] = []
        for raw in items:
            description = str(raw.get("description", "")).strip()
            if not description:
                raise ValueError("评分项描述不能为空")
            points = self._as_points(raw.get("points"))
            item_id = str(raw.get("id") or "").strip() or f"item_{uuid.uuid4().hex[:8]}"
            normalized.append(
                {
                    "id": item_id,
                    "description": description[:400],
                    "points": self._clean_points(points),
                }
            )
        self.grading_rubrics[exp_id] = {
            "items": normalized,
            "scoring_prompt": (scoring_prompt or "").strip()[:4000],
            "updated_at": now_iso(),
        }
        self._persist()
        return self.get_rubric(exp_id)

    @staticmethod
    def _clean_points(value: float) -> float | int:
        rounded = round(float(value), 2)
        return int(rounded) if rounded == int(rounded) else rounded

    def _grading_view(self, project_id: str, exp_id: str) -> dict[str, Any] | None:
        record = self.grading_records.get(self._grading_key(project_id, exp_id))
        if not record:
            return None
        rubric = self.grading_rubrics.get(exp_id) or {}
        rubric_by_id = {str(item.get("id")): item for item in rubric.get("items", [])}
        items = []
        for entry in record.get("items", []):
            rubric_item = rubric_by_id.get(str(entry.get("rubric_item_id")), {})
            items.append(
                {
                    "rubric_item_id": entry.get("rubric_item_id"),
                    "description": rubric_item.get("description", ""),
                    "score": entry.get("score"),
                    "max": entry.get("max"),
                    "comment": entry.get("comment", ""),
                }
            )
        return {
            "status": record.get("status"),
            "total": record.get("total"),
            "max_total": record.get("max_total"),
            "items": items,
            "overall_comment": record.get("overall_comment", ""),
            "graded_at": record.get("graded_at"),
            "graded_by": record.get("graded_by"),
            "overridden": record.get("overridden", False),
            "model": record.get("model"),
            "error": record.get("error"),
        }

    @staticmethod
    def rasterize_pdf(
        data: bytes, *, max_pages: int = 10, dpi: int = 110
    ) -> list[bytes]:
        """将 PDF 逐页栅格化为 PNG 字节（不做 OCR）。"""
        import pymupdf

        images: list[bytes] = []
        with pymupdf.open(stream=data, filetype="pdf") as document:
            for index, page in enumerate(document):
                if index >= max_pages:
                    break
                pixmap = page.get_pixmap(dpi=dpi)
                images.append(pixmap.tobytes("png"))
        return images

    def _auto_grade_submission(self, project_id: str, exp_id: str, data: bytes) -> None:
        """上传成功后自动阅卷；任何异常都不得影响上传本身。"""
        try:
            self.grade_submission(project_id, exp_id, data=data, graded_by="auto")
        except Exception:
            pass

    @synchronized
    def grade_submission(
        self,
        project_id: str,
        exp_id: str,
        *,
        data: bytes | None = None,
        graded_by: str = "auto",
    ) -> dict[str, Any]:
        project = self.get_project(project_id)
        if exp_id not in self.EXPERIMENT_RUN_TYPE_MAP:
            raise KeyError(f"未知实验编号: {exp_id}")
        key = self._grading_key(project_id, exp_id)
        rubric = self.grading_rubrics.get(exp_id) or {}
        items = rubric.get("items", [])
        if data is None:
            pdf = project.get("experiment_reports", {}).get(exp_id, {})
            storage_path = pdf.get("storage_path")
            if not storage_path or not Path(storage_path).exists():
                raise KeyError("该实验尚未上传报告 PDF")
            data = Path(storage_path).read_bytes()
        if not items:
            self.grading_records[key] = {
                "status": "pending",
                "total": None,
                "max_total": None,
                "items": [],
                "overall_comment": "",
                "graded_at": now_iso(),
                "graded_by": graded_by,
                "overridden": False,
                "model": None,
                "error": "尚未配置该实验的评分细则",
            }
            self._persist()
            return self._grading_view(project_id, exp_id) or {}
        if (
            not isinstance(self.vlm, VLMProvider)
            or not self.vlm.settings.remote_configured
        ):
            self.grading_records[key] = {
                "status": "pending",
                "total": None,
                "max_total": self._clean_points(
                    sum(self._as_points(item.get("points")) for item in items)
                ),
                "items": [],
                "overall_comment": "",
                "graded_at": now_iso(),
                "graded_by": graded_by,
                "overridden": False,
                "model": None,
                "error": "尚未配置阅卷视觉大模型（VLM）",
            }
            self._persist()
            return self._grading_view(project_id, exp_id) or {}
        try:
            images = self.rasterize_pdf(data)
            if not images:
                raise ValueError("无法从 PDF 中提取页面图片")
            result = self.vlm.grade(
                images,
                {"items": items},
                rubric.get("scoring_prompt", "") or self.DEFAULT_SCORING_PROMPT,
            )
            self.grading_records[key] = {
                "status": "graded",
                "total": result.get("total"),
                "max_total": result.get("max_total"),
                "items": result.get("items", []),
                "overall_comment": result.get("overall_comment", ""),
                "graded_at": now_iso(),
                "graded_by": graded_by,
                "overridden": False,
                "model": result.get("model"),
                "error": None,
            }
        except Exception as error:
            self.grading_records[key] = {
                "status": "failed",
                "total": None,
                "max_total": self._clean_points(
                    sum(self._as_points(item.get("points")) for item in items)
                ),
                "items": [],
                "overall_comment": "",
                "graded_at": now_iso(),
                "graded_by": graded_by,
                "overridden": False,
                "model": getattr(self.vlm, "settings", None)
                and self.vlm.settings.model,
                "error": str(error)[:400],
            }
        self._persist()
        return self._grading_view(project_id, exp_id) or {}

    @synchronized
    def override_grading(
        self,
        project_id: str,
        exp_id: str,
        *,
        items: list[dict[str, Any]],
        overall_comment: str | None,
        total: float | None,
        graded_by: str,
    ) -> dict[str, Any]:
        self.get_project(project_id)
        if exp_id not in self.EXPERIMENT_RUN_TYPE_MAP:
            raise KeyError(f"未知实验编号: {exp_id}")
        key = self._grading_key(project_id, exp_id)
        rubric = self.grading_rubrics.get(exp_id) or {}
        rubric_by_id = {str(item.get("id")): item for item in rubric.get("items", [])}
        existing = self.grading_records.get(key, {})
        existing_items = {
            str(entry.get("rubric_item_id")): entry
            for entry in existing.get("items", [])
        }
        graded_items: list[dict[str, Any]] = []
        computed_total = 0.0
        computed_max = 0.0
        for raw in items:
            item_id = str(raw.get("rubric_item_id"))
            rubric_item = rubric_by_id.get(item_id, {})
            max_points = self._as_points(rubric_item.get("points"))
            if not rubric_item:
                previous = existing_items.get(item_id, {})
                max_points = self._as_points(previous.get("max"))
            score = self._as_points(raw.get("score"))
            score = max(0.0, min(score, max_points))
            comment = raw.get("comment")
            comment = comment.strip() if isinstance(comment, str) else ""
            computed_total += score
            computed_max += max_points
            graded_items.append(
                {
                    "rubric_item_id": item_id,
                    "score": self._clean_points(score),
                    "max": self._clean_points(max_points),
                    "comment": comment,
                }
            )
        final_total = (
            self._clean_points(float(total))
            if total is not None
            else self._clean_points(computed_total)
        )
        self.grading_records[key] = {
            "status": "graded",
            "total": final_total,
            "max_total": self._clean_points(computed_max)
            if computed_max
            else existing.get("max_total"),
            "items": graded_items,
            "overall_comment": (overall_comment or "").strip()
            if overall_comment is not None
            else existing.get("overall_comment", ""),
            "graded_at": now_iso(),
            "graded_by": graded_by,
            "overridden": True,
            "model": existing.get("model"),
            "error": None,
        }
        self._persist()
        return self._grading_view(project_id, exp_id) or {}

    def list_submissions(self, resolve_display_name=None) -> list[dict[str, Any]]:
        submissions: list[dict[str, Any]] = []
        for project_id, project in self.projects.items():
            owner_id = project.get("owner_id")
            display_name = None
            if owner_id and resolve_display_name:
                display_name = resolve_display_name(owner_id)
            reports = project.get("experiment_reports", {})
            for exp_id in sorted(self.EXPERIMENT_RUN_TYPE_MAP):
                pdf = reports.get(exp_id, {})
                if not pdf.get("filename"):
                    continue
                record = self.grading_records.get(
                    self._grading_key(project_id, exp_id), {}
                )
                submissions.append(
                    {
                        "project_id": project_id,
                        "project_name": project.get("name"),
                        "owner_id": owner_id,
                        "student_name": display_name,
                        "exp_id": exp_id,
                        "label": self.EXPERIMENT_LABELS[exp_id],
                        "filename": pdf.get("filename"),
                        "uploaded_at": pdf.get("uploaded_at"),
                        "status": record.get("status", "ungraded"),
                        "total": record.get("total"),
                        "max_total": record.get("max_total"),
                        "overridden": record.get("overridden", False),
                        "graded_at": record.get("graded_at"),
                        "error": record.get("error"),
                    }
                )
        return submissions

    @staticmethod
    def _report_markdown(
        project: dict[str, Any],
        status: dict[str, Any],
        runs: list[dict[str, Any]],
        scores: dict[str, int],
        observation_markdown: str = "",
    ) -> str:
        kb = project["kb"]
        lines = [
            f"# {project['name']} · 实验报告",
            "",
            f"生成时间：{now_iso()}",
            "",
            "## 实验一 · 密码学知识库",
            "",
        ]
        if kb:
            lines += [
                f"- Knowledge Base ID：`{kb['id']}`",
                f"- 文档 / Chunk：{len(kb['document_ids'])} / {len(kb['chunks'])}",
                f"- Chunk Size / Overlap：{kb['chunk_size']} / {kb['overlap']}",
                f"- Embedding：{kb['embedding_model']} ({kb['dimension']}D)",
            ]
        else:
            lines.append("尚未完成。")
        lines += [
            "",
            "## 实验二 · RAG",
            "",
            f"- 运行次数：{sum(1 for run in runs if run['type'] == 'rag')}",
            f"- Pipeline：{project['rag']['id'] if project['rag'] else '尚未创建'}",
            "",
            "## 实验三 · Mini Crypto Agent",
            "",
            f"- 运行次数：{sum(1 for run in runs if run['type'] == 'agent')}",
            f"- Agent：{project['agent']['id'] if project['agent'] else '尚未创建'}",
            "",
            "## 能力画像",
            "",
        ]
        lines += [f"- {label}：{score}" for label, score in scores.items()]
        lines += [
            "",
            "## 观察和感想",
            "",
            observation_markdown or "> 尚未填写观察和感想。",
            "",
        ]
        return "\n".join(lines)


TOOL_TASKS = [
    {
        "id": "modexp_big",
        "label": "大数模幂（RSA 加密核心）",
        "category": "RSA 加解密",
        "question": "计算 7^128 mod 100000007。这类大数模幂是 RSA 加解密和 Diffie-Hellman 密钥交换每次都要执行的核心运算。请直接给出最终的整数余数。",
        "operation": "mod_pow",
        "values": [7, 128, 100000007],
        "hint": "结果是一个 0 到 100000006 之间的整数。大数的连续平方取模靠手算极易出错。",
    },
    {
        "id": "rsa_modinv_big",
        "label": "大数模逆（RSA 私钥指数）",
        "category": "RSA 密钥生成",
        "question": "在 RSA 中，已知公钥指数 e = 65537，φ(n) = 3120000007。求私钥指数 d，使得 (d · e) mod φ(n) = 1。请直接给出 d 的整数值。",
        "operation": "mod_inverse",
        "values": [65537, 3120000007],
        "hint": "d 是 e 关于 φ(n) 的模逆元；数值很大，需要完整的扩展欧几里得算法才能算对。",
    },
    {
        "id": "rsa_modinv",
        "label": "小数模逆（入门对照）",
        "category": "RSA 密钥生成",
        "question": "在 RSA 中，已知公钥指数 e = 17，φ(n) = 3120。求私钥指数 d，使得 (d · e) mod φ(n) = 1。请直接给出 d 的整数值。",
        "operation": "mod_inverse",
        "values": [17, 3120],
        "hint": "数值较小，模型口算通常也能算对，用来对照“工具并非总能拉开差距，但提供确定性保证”。",
    },
]


ALLOWED_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def compute_tool_answer(operation: str, values: list[int]) -> int:
    """用受控的安全实现给出密码学数值题的权威答案。"""
    if operation == "gcd" and len(values) == 2:
        return math.gcd(values[0], values[1])
    if operation == "mod_inverse" and len(values) == 2:
        return pow(values[0], -1, values[1])
    if operation == "mod_pow" and len(values) == 3:
        return pow(values[0], values[1], values[2])
    raise ValueError("仅支持 gcd(a,b)、mod_inverse(a,m)、mod_pow(a,e,m)")


def extract_final_integer(answer: str) -> int | None:
    """从模型的自然语言回答中抽取最终整数，用于判断口算是否正确。"""
    cleaned = answer.replace(",", "").replace("，", "").replace("`", "")
    candidates = re.findall(r"-?\d+", cleaned)
    if not candidates:
        return None
    tail = cleaned[-160:]
    tail_candidates = re.findall(r"-?\d+", tail)
    picked = tail_candidates[-1] if tail_candidates else candidates[-1]
    try:
        return int(picked)
    except ValueError:
        return None


def safe_calculate(expression: str) -> float | int:
    if len(expression) > 120:
        raise ValueError("表达式过长")
    node = ast.parse(expression, mode="eval")

    def evaluate(current: ast.AST) -> float | int:
        if isinstance(current, ast.Expression):
            return evaluate(current.body)
        if isinstance(current, ast.Constant) and isinstance(
            current.value, (int, float)
        ):
            return current.value
        if isinstance(current, ast.BinOp) and type(current.op) in ALLOWED_OPERATORS:
            left, right = evaluate(current.left), evaluate(current.right)
            if abs(left) > 1e12 or abs(right) > 1e12:
                raise ValueError("数值超出教学计算限制")
            return ALLOWED_OPERATORS[type(current.op)](left, right)
        if isinstance(current, ast.UnaryOp) and type(current.op) in ALLOWED_OPERATORS:
            return ALLOWED_OPERATORS[type(current.op)](evaluate(current.operand))
        raise ValueError("仅允许数字与 + - * / % ** 运算")

    result = evaluate(node)
    if not math.isfinite(float(result)):
        raise ValueError("结果不是有限数值")
    return round(result, 8) if isinstance(result, float) else result


platform_service = PlatformService()
