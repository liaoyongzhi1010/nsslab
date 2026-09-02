import httpx

from app.config import LLMSettings
from app.providers.openai_compatible import OpenAICompatibleLLMProvider


def settings() -> LLMSettings:
    return LLMSettings(
        provider="openai_compatible",
        provider_name="Test Provider",
        base_url="https://llm.example.test/v1",
        model="test-model",
        api_key="test-secret",
        timeout_seconds=5,
        temperature=0.2,
        max_tokens=300,
        fallback_to_local=True,
    )


def test_openai_compatible_provider_uses_generic_chat_completions():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://llm.example.test/v1/chat/completions"
        assert request.headers["Authorization"] == "Bearer test-secret"
        assert b'"model":"test-model"' in request.content
        return httpx.Response(200, json={"choices": [{"message": {"content": "远程模型回答"}}]})

    provider = OpenAICompatibleLLMProvider(settings(), httpx.Client(transport=httpx.MockTransport(handler)))
    assert provider.generate("测试问题") == "远程模型回答"
    assert provider.last_provider_name == "Test Provider · test-model"
    assert provider.status()["endpoint_host"] == "llm.example.test"


def test_remote_failure_falls_back_without_exposing_secret():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": "bad key"})

    provider = OpenAICompatibleLLMProvider(settings(), httpx.Client(transport=httpx.MockTransport(handler)))
    answer = provider.generate("RSA 为什么不适合直接加密大文件？")
    assert "RSA" in answer
    assert provider.last_provider_name.endswith("Fallback")
    assert provider.last_error == "模型服务返回 HTTP 401"
    assert "test-secret" not in str(provider.status())
