from io import BytesIO

from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, StreamObject

from app.main import app, auth_service
from app.services.platform import platform_service


client = TestClient(app)


def setup_function():
    platform_service.reset()
    platform_service.vlm = None
    auth_service.ensure_bootstrap_users()
    client.cookies.clear()
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Admin-Test-Password-2026!"},
    )
    assert login.status_code == 200


def _make_pdf() -> bytes:
    buffer = BytesIO()
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    font_ref = writer._add_object(font)
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})}
    )
    stream = StreamObject()
    stream.set_data(b"BT /F1 12 Tf 72 720 Td (Experiment report body.) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(buffer)
    return buffer.getvalue()


def _login_student():
    client.cookies.clear()
    login = client.post(
        "/api/auth/login",
        json={"username": "student", "password": "Student-Test-Password-2026!"},
    )
    assert login.status_code == 200
    return client.get("/api/projects").json()[0]["id"]


def test_rubric_crud_and_sum_warning():
    rubrics = client.get("/api/admin/rubrics")
    assert rubrics.status_code == 200
    assert len(rubrics.json()) == 10

    saved = client.put(
        "/api/admin/rubrics/01",
        json={
            "items": [
                {"description": "实验目的", "points": 40},
                {"description": "结果分析", "points": 50},
            ],
            "scoring_prompt": "请严格评分",
        },
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["total_points"] == 90
    assert body["sums_to_100"] is False
    assert body["scoring_prompt"] == "请严格评分"
    assert all(item["id"] for item in body["items"])

    updated = client.put(
        "/api/admin/rubrics/01",
        json={
            "items": [
                {"id": body["items"][0]["id"], "description": "实验目的", "points": 40},
                {"description": "结果分析", "points": 60},
            ],
            "scoring_prompt": "严格评分",
        },
    )
    assert updated.json()["total_points"] == 100
    assert updated.json()["sums_to_100"] is True


def test_rubric_requires_admin():
    _login_student()
    assert client.get("/api/admin/rubrics").status_code == 403
    assert client.put("/api/admin/rubrics/01", json={"items": []}).status_code == 403


def test_upload_without_vlm_marks_pending_but_upload_succeeds():
    client.put(
        "/api/admin/rubrics/01",
        json={
            "items": [{"description": "目的", "points": 100}],
            "scoring_prompt": "严格评分",
        },
    )
    project_id = _login_student()
    response = client.post(
        f"/api/reports/{project_id}/experiments/01/pdf",
        files={"file": ("report.pdf", _make_pdf(), "application/pdf")},
    )
    assert response.status_code == 201
    grading = response.json()["grading"]
    assert grading["status"] == "pending"
    assert grading["error"] and "VLM" in grading["error"]


def test_upload_without_rubric_marks_pending():
    project_id = _login_student()
    response = client.post(
        f"/api/reports/{project_id}/experiments/02/pdf",
        files={"file": ("report.pdf", _make_pdf(), "application/pdf")},
    )
    assert response.status_code == 201
    assert response.json()["grading"]["status"] == "pending"


def test_admin_can_list_submissions_and_override_score():
    client.put(
        "/api/admin/rubrics/03",
        json={
            "items": [
                {"description": "目的", "points": 40},
                {"description": "分析", "points": 60},
            ],
            "scoring_prompt": "严格评分",
        },
    )
    project_id = _login_student()
    client.post(
        f"/api/reports/{project_id}/experiments/03/pdf",
        files={"file": ("report.pdf", _make_pdf(), "application/pdf")},
    )

    client.cookies.clear()
    client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Admin-Test-Password-2026!"},
    )
    submissions = client.get("/api/admin/submissions")
    assert submissions.status_code == 200
    rows = submissions.json()
    row = next(r for r in rows if r["project_id"] == project_id and r["exp_id"] == "03")
    assert row["student_name"] == "测试学生"
    assert row["status"] == "pending"

    rubric = client.get("/api/admin/rubrics/03").json()
    item_ids = [item["id"] for item in rubric["items"]]
    override = client.put(
        f"/api/admin/submissions/{project_id}/03/override",
        json={
            "items": [
                {"rubric_item_id": item_ids[0], "score": 35, "comment": "目的明确"},
                {"rubric_item_id": item_ids[1], "score": 55, "comment": "分析到位"},
            ],
            "overall_comment": "总体不错",
        },
    )
    assert override.status_code == 200
    graded = override.json()
    assert graded["status"] == "graded"
    assert graded["overridden"] is True
    assert graded["total"] == 90


def test_override_score_is_clamped_to_rubric_max():
    client.put(
        "/api/admin/rubrics/04",
        json={
            "items": [{"description": "目的", "points": 30}],
            "scoring_prompt": "评分",
        },
    )
    project_id = _login_student()
    client.post(
        f"/api/reports/{project_id}/experiments/04/pdf",
        files={"file": ("report.pdf", _make_pdf(), "application/pdf")},
    )
    client.cookies.clear()
    client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Admin-Test-Password-2026!"},
    )
    rubric = client.get("/api/admin/rubrics/04").json()
    item_id = rubric["items"][0]["id"]
    override = client.put(
        f"/api/admin/submissions/{project_id}/04/override",
        json={"items": [{"rubric_item_id": item_id, "score": 90, "comment": "满分"}]},
    )
    assert override.json()["items"][0]["score"] == 30
    assert override.json()["total"] == 30


def test_student_sees_own_grading_in_experiment_report():
    client.put(
        "/api/admin/rubrics/05",
        json={
            "items": [{"description": "目的", "points": 100}],
            "scoring_prompt": "评分",
        },
    )
    project_id = _login_student()
    client.post(
        f"/api/reports/{project_id}/experiments/05/pdf",
        files={"file": ("report.pdf", _make_pdf(), "application/pdf")},
    )
    client.cookies.clear()
    client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Admin-Test-Password-2026!"},
    )
    rubric = client.get("/api/admin/rubrics/05").json()
    item_id = rubric["items"][0]["id"]
    client.put(
        f"/api/admin/submissions/{project_id}/05/override",
        json={
            "items": [{"rubric_item_id": item_id, "score": 88, "comment": "很好"}],
            "overall_comment": "通过",
        },
    )

    project_id_again = _login_student()
    report = client.get(f"/api/reports/{project_id_again}/experiments/05").json()
    assert report["grading"]["status"] == "graded"
    assert report["grading"]["total"] == 88
    assert report["grading"]["items"][0]["comment"] == "很好"
    assert report["grading"]["items"][0]["description"] == "目的"


def test_auto_grade_with_mock_vlm_produces_graded_record():
    import httpx

    from app.config import VLMSettings
    from app.providers.vlm import VLMProvider

    client.put(
        "/api/admin/rubrics/06",
        json={
            "items": [{"description": "目的", "points": 100}],
            "scoring_prompt": "评分",
        },
    )
    rubric = client.get("/api/admin/rubrics/06").json()
    item_id = rubric["items"][0]["id"]

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": '{"items": [{"rubric_item_id": "%s", "score": 72, "comment": "自动评分"}], "overall_comment": "自动阅卷完成"}'
                            % item_id
                        }
                    }
                ]
            },
        )

    platform_service.vlm = VLMProvider(
        VLMSettings(
            provider="openai_compatible",
            provider_name="Mock VLM",
            base_url="https://vlm.example.test/v1",
            model="stub-vl",
            api_key="vlm-secret",
            timeout_seconds=5,
            temperature=0.1,
            max_tokens=800,
        ),
        httpx.Client(transport=httpx.MockTransport(handler)),
    )

    project_id = _login_student()
    response = client.post(
        f"/api/reports/{project_id}/experiments/06/pdf",
        files={"file": ("report.pdf", _make_pdf(), "application/pdf")},
    )
    assert response.status_code == 201
    grading = response.json()["grading"]
    assert grading["status"] == "graded"
    assert grading["total"] == 72
    assert grading["model"] == "stub-vl"


def test_vlm_config_requires_admin_and_hot_swaps():
    _login_student()
    assert client.get("/api/admin/vlm").status_code == 403

    client.cookies.clear()
    client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Admin-Test-Password-2026!"},
    )
    assert client.get("/api/admin/vlm").json()["configured"] is False
    saved = client.post(
        "/api/admin/vlm",
        json={
            "api_key": "vlm-secret",
            "base_url": "https://vlm.example.test/v1",
            "model": "qwen-vl",
        },
    )
    assert saved.status_code == 200
    assert saved.json()["configured"] is True
    assert saved.json()["model"] == "qwen-vl"
    assert "vlm-secret" not in str(saved.json())
