from __future__ import annotations

import base64
import json
import re
from typing import Any
from urllib.parse import urlparse

import httpx

from app.config import VLMSettings


VLM_SYSTEM_PROMPT = """你是 CryptoLLMLab 密码学实验报告的严格评分助手。
要求：
1. 使用中文评分与点评，术语可保留英文缩写。
2. 严格依据给定的评分细则（rubric）逐项打分，每项分数不得超过该项满分，也不得为负。
3. 只依据学生报告图片中的真实内容评分，不臆测、不编造未出现的内容。
4. 只输出要求的 JSON，不输出任何解释、前后缀或 Markdown 代码块以外的文字。"""


class VLMProvider:
    """面向 OpenAI 兼容多模态服务的评分 Provider：将报告 PDF 逐页栅格化为图片后送入 VLM。"""

    is_remote = True

    def __init__(
        self, settings: VLMSettings, client: httpx.Client | None = None
    ) -> None:
        if not settings.remote_configured:
            raise ValueError("VLM Provider 配置不完整")
        self.settings = settings
        self.name = f"{settings.provider_name} · {settings.model}"
        self._client = client or httpx.Client(timeout=settings.timeout_seconds)
        self.last_provider_name = self.name
        self.last_error: str | None = None

    def status(self) -> dict[str, Any]:
        return {
            "configured": True,
            "provider": self.settings.provider_name,
            "protocol": "OpenAI-compatible",
            "model": self.settings.model,
            "endpoint_host": urlparse(self.settings.base_url).hostname,
            "last_provider": self.last_provider_name,
            "last_error": self.last_error,
        }

    def _chat(self, prompt: str, images: list[bytes]) -> str:
        content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        for image in images:
            encoded = base64.b64encode(image).decode("ascii")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{encoded}"},
                }
            )
        messages = [
            {"role": "system", "content": VLM_SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ]
        try:
            response = self._client.post(
                f"{self.settings.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.settings.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.settings.model,
                    "messages": messages,
                    "temperature": self.settings.temperature,
                    "max_tokens": self.settings.max_tokens,
                    "stream": False,
                },
            )
            response.raise_for_status()
            payload = response.json()
            raw = payload["choices"][0]["message"]["content"]
            if not isinstance(raw, str) or not raw.strip():
                raise ValueError("模型返回了空内容")
            self.last_provider_name = self.name
            self.last_error = None
            return raw
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as error:
            self.last_error = self._safe_error(error)
            raise RuntimeError(self.last_error) from error

    def to_markdown(self, images: list[bytes]) -> str:
        """把 PDF 逐页图片转成干净 markdown（结构化文本抽取，不做臆测）。"""
        if not images:
            raise ValueError("没有可解析的页面图片")
        prompt = (
            "以下是一份 PDF 文档的逐页图片。请把它转录为干净、结构化的 Markdown：\n"
            "1. 用 # / ## 还原标题层级；正文按段落组织。\n"
            "2. 表格用 Markdown 表格还原；公式用 LaTeX（$...$）。\n"
            "3. 忠实转录可见内容，不要翻译、不要总结、不要臆测或补充图中没有的内容。\n"
            "4. 只输出 Markdown 正文本身，不要用 ``` 代码块包裹整篇，也不要额外说明。"
        )
        markdown = self._chat(prompt, images).strip()
        fence = re.match(r"^```(?:markdown)?\s*(.+?)```$", markdown, re.DOTALL)
        if fence:
            markdown = fence.group(1).strip()
        if not markdown:
            raise ValueError("VLM 未返回可用的 Markdown")
        return markdown

    def grade(
        self, images: list[bytes], rubric: dict[str, Any], scoring_prompt: str
    ) -> dict[str, Any]:
        items = [item for item in rubric.get("items", []) if isinstance(item, dict)]
        if not items:
            raise ValueError("评分细则为空，无法评分")
        prompt = self._build_prompt(items, scoring_prompt)
        raw = self._chat(prompt, images)
        return self.parse_grading(raw, items, model=self.settings.model)

    @staticmethod
    def _build_prompt(items: list[dict[str, Any]], scoring_prompt: str) -> str:
        rubric_lines = [
            f"- 细则 {index + 1}（id={item.get('id')}）：{item.get('description', '')}，满分 {item.get('points', 0)} 分"
            for index, item in enumerate(items)
        ]
        item_ids = [str(item.get("id")) for item in items]
        instruction = (scoring_prompt or "").strip()
        return (
            (f"评分指令：{instruction}\n\n" if instruction else "")
            + "以下是学生提交的实验报告 PDF 逐页图片。请按下面的评分细则逐项打分：\n"
            + "\n".join(rubric_lines)
            + "\n\n请只返回如下结构的 JSON（不要额外文字、不要 Markdown 代码块）：\n"
            + '{"items": [{"rubric_item_id": "<细则id>", "score": <数字>, "comment": "<简短点评>"}], "overall_comment": "<总体点评>"}\n'
            + f"items 必须且仅覆盖这些细则 id：{item_ids}。每项 score 为 0 到该项满分之间的数字。"
        )

    @staticmethod
    def parse_grading(
        raw: str, items: list[dict[str, Any]], *, model: str | None = None
    ) -> dict[str, Any]:
        """解析模型返回的评分 JSON，并映射为 grading_record 的 items 结构；对模型输出做防御性校验。"""
        data = _extract_json(raw)
        by_id = {str(item.get("id")): item for item in items}
        returned = {}
        if isinstance(data, dict):
            for entry in data.get("items", []) or []:
                if isinstance(entry, dict) and entry.get("rubric_item_id") is not None:
                    returned[str(entry.get("rubric_item_id"))] = entry
        graded_items: list[dict[str, Any]] = []
        total = 0.0
        max_total = 0.0
        for item in items:
            item_id = str(item.get("id"))
            max_points = _as_number(item.get("points"), 0)
            max_total += max_points
            entry = returned.get(item_id, {})
            score = _as_number(entry.get("score"), 0)
            score = max(0.0, min(score, max_points))
            comment = entry.get("comment")
            comment = comment.strip() if isinstance(comment, str) else ""
            total += score
            graded_items.append(
                {
                    "rubric_item_id": item_id,
                    "score": _clean_number(score),
                    "max": _clean_number(max_points),
                    "comment": comment,
                }
            )
        overall = ""
        if isinstance(data, dict) and isinstance(data.get("overall_comment"), str):
            overall = data["overall_comment"].strip()
        return {
            "items": graded_items,
            "total": _clean_number(total),
            "max_total": _clean_number(max_total),
            "overall_comment": overall,
            "model": model,
        }

    @staticmethod
    def _safe_error(error: Exception) -> str:
        if isinstance(error, httpx.HTTPStatusError):
            return f"模型服务返回 HTTP {error.response.status_code}"
        if isinstance(error, httpx.TimeoutException):
            return "模型服务调用超时"
        if isinstance(error, httpx.NetworkError):
            return "无法连接模型服务"
        return "模型响应格式无效"


def _extract_json(raw: str) -> Any:
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.+?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except (json.JSONDecodeError, ValueError):
            return {}
    return {}


def _as_number(value: Any, default: float) -> float:
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"-?\d+(?:\.\d+)?", value)
        if match:
            try:
                return float(match.group(0))
            except ValueError:
                return default
    return default


def _clean_number(value: float) -> float | int:
    rounded = round(float(value), 2)
    if rounded == int(rounded):
        return int(rounded)
    return rounded


def build_vlm_provider(settings: VLMSettings | None = None) -> VLMProvider | None:
    resolved = settings or VLMSettings.from_env()
    if resolved.remote_configured:
        return VLMProvider(resolved)
    return None


def vlm_status(provider: VLMProvider | None) -> dict[str, Any]:
    if isinstance(provider, VLMProvider):
        return provider.status()
    return {
        "configured": False,
        "provider": "未配置",
        "protocol": "OpenAI-compatible",
        "model": None,
        "endpoint_host": None,
        "last_provider": None,
        "last_error": None,
    }
