from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    """统一 LLM 接口，真实模型只需替换该实现。"""

    name: str

    @abstractmethod
    def generate(self, prompt: str, *, context: list[dict[str, Any]] | None = None) -> str:
        raise NotImplementedError


class EmbeddingProvider(ABC):
    """统一 Embedding 接口。"""

    name: str
    dimension: int

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError


class RerankProvider(ABC):
    """统一 Rerank 接口。"""

    name: str

    @abstractmethod
    def rerank(self, query: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        raise NotImplementedError

