from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

import httpx

from app.config import LLMSettings

from .interfaces import LLMProvider
from .local import LocalLLMProvider


SYSTEM_PROMPT = """你是 CryptoLLMLab 密码学研究与教学助手。
要求：
1. 使用中文回答，术语可保留英文缩写。
2. 清楚区分安全假设、算法机制和工程建议，说明适用边界与常见误用。
3. 不编造标准、参数、来源或实验结果；证据不足时明确说明。
4. 只输出可公开的最终答案，不输出隐藏推理过程或 Chain-of-Thought。
5. 若提供了知识库上下文，涉及版本化标准、机构政策或内部资料的事实只能依据上下文；上下文不足时明确指出缺少哪项证据，不要用模型记忆补齐。
6. 不要自行生成引用编号，也不要输出 chunk_id 或内部片段标识；平台会追加真实引用。"""


class OpenAICompatibleLLMProvider(LLMProvider):
    """面向 Qwen、DeepSeek、Ollama 等服务的通用 Chat Completions Provider。"""

    is_remote = True

    def __init__(
        self, settings: LLMSettings, client: httpx.Client | None = None
    ) -> None:
        if not settings.remote_configured:
            raise ValueError("OpenAI-compatible Provider 配置不完整")
        self.settings = settings
        self.name = f"{settings.provider_name} · {settings.model}"
        self._client = client or httpx.Client(timeout=settings.timeout_seconds)
        self.last_provider_name = self.name
        self.last_error: str | None = None

    def generate(
        self, prompt: str, *, context: list[dict[str, Any]] | None = None
    ) -> str:
        messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        if context:
            context_text = "\n\n".join(
                f'<source chunk_id="{item["id"]}" document="{item["document_title"]}" section="{item["section"]}">\n{item["text"]}\n</source>'
                for item in context
            )
            messages.append(
                {
                    "role": "user",
                    "content": f"以下是经过检索与重排的密码学知识库片段：\n\n{context_text}\n\n用户问题：{prompt}\n\n请只用这些片段回答其中的版本化标准、机构政策和内部事实；证据缺失就明确说明。给出有依据、结构清楚的最终答案。",
                }
            )
        else:
            messages.append({"role": "user", "content": prompt})

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
            content = payload["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise ValueError("模型返回了空内容")
            self.last_provider_name = self.name
            self.last_error = None
            return content.strip()
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as error:
            self.last_error = self._safe_error(error)
            raise RuntimeError(self.last_error) from error

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

    @staticmethod
    def _safe_error(error: Exception) -> str:
        if isinstance(error, httpx.HTTPStatusError):
            return f"模型服务返回 HTTP {error.response.status_code}"
        if isinstance(error, httpx.TimeoutException):
            return "模型服务调用超时"
        if isinstance(error, httpx.NetworkError):
            return "无法连接模型服务"
        return "模型响应格式无效"


def build_llm_provider(settings: LLMSettings | None = None) -> LLMProvider:
    resolved = settings or LLMSettings.from_env()
    if resolved.remote_configured:
        return OpenAICompatibleLLMProvider(resolved)
    return LocalLLMProvider()


def provider_status(provider: LLMProvider) -> dict[str, Any]:
    if isinstance(provider, OpenAICompatibleLLMProvider):
        return provider.status()
    return {
        "configured": False,
        "provider": "Local",
        "protocol": "offline-teaching",
        "model": provider.name,
        "endpoint_host": None,
        "last_provider": provider.name,
        "last_error": None,
    }
