import httpx
import pytest

from app.config import VLMSettings
from app.providers.vlm import VLMProvider


def settings() -> VLMSettings:
    return VLMSettings(
        provider="openai_compatible",
        provider_name="Test VLM",
        base_url="https://vlm.example.test/v1",
        model="test-vlm",
        api_key="vlm-secret",
        timeout_seconds=5,
        temperature=0.1,
        max_tokens=800,
    )


RUBRIC = {
    "items": [
        {"id": "a", "description": "目的清晰", "points": 40},
        {"id": "b", "description": "结论可靠", "points": 60},
    ]
}


def test_vlm_grade_sends_images_and_maps_result():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://vlm.example.test/v1/chat/completions"
        assert request.headers["Authorization"] == "Bearer vlm-secret"
        assert b"image_url" in request.content
        assert b"data:image/png;base64," in request.content
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": '```json\n{"items": [{"rubric_item_id": "a", "score": 38, "comment": "不错"}, {"rubric_item_id": "b", "score": 50, "comment": "可加强"}], "overall_comment": "整体良好"}\n```'
                        }
                    }
                ]
            },
        )

    provider = VLMProvider(
        settings(), httpx.Client(transport=httpx.MockTransport(handler))
    )
    result = provider.grade([b"\x89PNG-fake"], RUBRIC, "严格评分")
    assert result["total"] == 88
    assert result["max_total"] == 100
    assert result["overall_comment"] == "整体良好"
    assert {item["rubric_item_id"] for item in result["items"]} == {"a", "b"}


def test_vlm_grade_clamps_scores_and_defaults_missing_items():
    result = VLMProvider.parse_grading(
        '{"items": [{"rubric_item_id": "a", "score": 999, "comment": "超分"}], "overall_comment": "x"}',
        RUBRIC["items"],
        model="m",
    )
    scores = {item["rubric_item_id"]: item["score"] for item in result["items"]}
    assert scores["a"] == 40
    assert scores["b"] == 0
    assert result["total"] == 40
    assert result["model"] == "m"


def test_vlm_grade_failure_does_not_leak_secret():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"message": "boom"})

    provider = VLMProvider(
        settings(), httpx.Client(transport=httpx.MockTransport(handler))
    )
    with pytest.raises(RuntimeError) as excinfo:
        provider.grade([b"png"], RUBRIC, "评分")
    assert "vlm-secret" not in str(excinfo.value)
    assert provider.last_error == "模型服务返回 HTTP 500"


def test_parse_grading_handles_garbage_json():
    result = VLMProvider.parse_grading("模型没有返回 JSON", RUBRIC["items"])
    assert result["total"] == 0
    assert result["max_total"] == 100
    assert len(result["items"]) == 2
