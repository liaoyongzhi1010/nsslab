from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import (
    Cookie,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.schemas import (
    AgentRunRequest,
    KBBuildRequest,
    LoginRequest,
    ProjectCreate,
    ProjectScopedRequest,
    ProjectUpdate,
    ProviderUpdateRequest,
    RAGRequest,
    RegisterRequest,
    ReportExportRequest,
    ReportObservationUpdate,
    SearchRequest,
    SkillUpdate,
    TaskScopedRequest,
    ToolExperimentRequest,
    ToolRunRequest,
    UserCreate,
)
from app.services.auth import AuthService
from app.services.platform import platform_service
from app.services.report_export import build_docx, build_pdf


SESSION_COOKIE = "cryptolab_session"
auth_service = AuthService(platform_service.repository, platform_service.settings)


@asynccontextmanager
async def lifespan(_: FastAPI):
    auth_service.ensure_bootstrap_users()
    if platform_service.settings.admin_username:
        admin = auth_service.user_by_username(platform_service.settings.admin_username)
        if admin:
            platform_service.repository.assign_unowned_projects(admin["id"])
            for project_id, project in platform_service.projects.items():
                project["owner_id"] = platform_service.repository.project_owner_id(
                    project_id
                )
    yield


app = FastAPI(
    title="CryptoLLMLab API",
    description="AI 赋能密码学研究与教学实验平台",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def handle_error(error: Exception) -> None:
    if isinstance(error, KeyError):
        raise HTTPException(status_code=404, detail=str(error).strip("'")) from error
    if isinstance(error, (ValueError, SyntaxError, ZeroDivisionError)):
        raise HTTPException(status_code=400, detail=str(error)) from error
    raise error


def current_user(
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> dict[str, Any]:
    user = auth_service.user_for_token(session_token)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
    return user


def require_admin(
    user: Annotated[dict[str, Any], Depends(current_user)],
) -> dict[str, Any]:
    if user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限"
        )
    return user


def authorize_project(project_id: str, user: dict[str, Any]) -> None:
    owner_id = platform_service.repository.project_owner_id(project_id)
    if owner_id is None:
        if user["role"] != "admin":
            raise HTTPException(status_code=403, detail="无权访问该实验项目")
        return
    if user["role"] != "admin" and owner_id != user["id"]:
        raise HTTPException(status_code=403, detail="无权访问该实验项目")


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=platform_service.settings.session_ttl_hours * 3600,
        httponly=True,
        secure=platform_service.settings.session_cookie_secure,
        samesite="strict",
        path="/",
    )


@app.get("/api/health")
def health():
    provider = platform_service.bootstrap()["providers"]
    return {
        "status": "ok",
        "service": "cryptolab-api",
        "database": "ok" if platform_service.repository.ping() else "unavailable",
        "mode": provider["mode"],
        "llm": provider["llm_status"],
    }


@app.get("/api/ready")
def ready():
    try:
        platform_service.repository.ping()
        return {"status": "ready", "database": "ok"}
    except Exception as error:
        raise HTTPException(status_code=503, detail="database unavailable") from error


@app.post("/api/auth/login")
def login(payload: LoginRequest, request: Request, response: Response):
    try:
        user, token = auth_service.authenticate(
            payload.username, payload.password, request.headers.get("user-agent")
        )
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    platform_service.ensure_workspace(user["id"])
    set_session_cookie(response, token)
    return {"user": user}


@app.post("/api/auth/register", status_code=201)
def register(payload: RegisterRequest, request: Request, response: Response):
    if not platform_service.settings.registration_enabled:
        raise HTTPException(status_code=403, detail="平台当前未开放注册")
    try:
        # 公开注册固定创建学生账号；管理员角色只能由管理员接口创建。
        display_name = (payload.display_name or "").strip() or payload.username
        auth_service.create_user(
            payload.username, display_name, "student", payload.password
        )
        user, token = auth_service.authenticate(
            payload.username, payload.password, request.headers.get("user-agent")
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    platform_service.ensure_workspace(user["id"])
    set_session_cookie(response, token)
    return {"user": user}


@app.post("/api/auth/logout", status_code=204)
def logout(
    response: Response,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
):
    auth_service.logout(session_token)
    response.delete_cookie(
        SESSION_COOKIE,
        path="/",
        httponly=True,
        samesite="strict",
        secure=platform_service.settings.session_cookie_secure,
    )


@app.get("/api/auth/me")
def me(user: Annotated[dict[str, Any], Depends(current_user)]):
    return {"user": user}


@app.get("/api/admin/users")
def list_users(_: Annotated[dict[str, Any], Depends(require_admin)]):
    return auth_service.list_users()


@app.post("/api/admin/users", status_code=201)
def create_user(
    payload: UserCreate, _: Annotated[dict[str, Any], Depends(require_admin)]
):
    try:
        return auth_service.create_user(
            payload.username, payload.display_name, payload.role, payload.password
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/bootstrap")
def bootstrap(user: Annotated[dict[str, Any], Depends(current_user)]):
    return platform_service.bootstrap()


@app.post("/api/provider/llm")
def update_provider(
    payload: ProviderUpdateRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        return platform_service.update_llm_provider(
            api_key=payload.api_key,
            base_url=payload.base_url,
            model=payload.model,
            provider_name=payload.provider_name,
        )
    except Exception as error:
        handle_error(error)


@app.get("/api/projects")
def list_projects(
    user: Annotated[dict[str, Any], Depends(current_user)], include_ended: bool = False
):
    project_ids = platform_service.repository.list_projects_for_user(
        user["id"], user["role"], include_ended
    )
    return [platform_service.project_status(project_id) for project_id in project_ids]


@app.post("/api/projects", status_code=201)
def create_project(
    payload: ProjectCreate, user: Annotated[dict[str, Any], Depends(current_user)]
):
    return platform_service.create_project(payload.name, user["id"])


@app.get("/api/projects/{project_id}")
def project_status(
    project_id: str, user: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        authorize_project(project_id, user)
        return platform_service.project_status(project_id)
    except Exception as error:
        handle_error(error)


@app.patch("/api/projects/{project_id}")
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(project_id, user)
        return platform_service.update_project(
            project_id, **payload.model_dump(exclude_none=True)
        )
    except Exception as error:
        handle_error(error)


@app.get("/api/documents/{document_id}")
def document_detail(
    document_id: str,
    user: Annotated[dict[str, Any], Depends(current_user)],
    project_id: str | None = None,
):
    try:
        if project_id:
            authorize_project(project_id, user)
        return platform_service.document_detail(document_id, project_id)
    except Exception as error:
        handle_error(error)


@app.get("/api/evidence/{document_id}/{kind}")
def evidence_file(
    document_id: str, kind: str, _: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        path = platform_service.evidence_file(document_id, kind)
        media_type = (
            "application/pdf"
            if path.suffix.lower() == ".pdf"
            else "text/markdown; charset=utf-8"
            if path.suffix.lower() == ".md"
            else "text/plain; charset=utf-8"
        )
        return FileResponse(
            path,
            media_type=media_type,
            filename=path.name,
            content_disposition_type="inline",
        )
    except Exception as error:
        handle_error(error)


@app.get("/api/projects/{project_id}/documents")
def project_documents(
    project_id: str, user: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        authorize_project(project_id, user)
        return platform_service.list_documents(project_id)
    except Exception as error:
        handle_error(error)


@app.post("/api/documents/upload", status_code=201)
async def upload_document(
    user: Annotated[dict[str, Any], Depends(current_user)],
    project_id: str = Form(...),
    file: UploadFile = File(...),
):
    try:
        authorize_project(project_id, user)
        data = await file.read(platform_service.max_upload_bytes + 1)
        return platform_service.upload_document(
            project_id, file.filename or "untitled", file.content_type, data
        )
    except Exception as error:
        handle_error(error)
    finally:
        await file.close()


@app.post("/api/kb/build")
def build_kb(
    payload: KBBuildRequest, user: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.build_kb(**payload.model_dump())
    except Exception as error:
        handle_error(error)


@app.get("/api/kb/{project_id}/stats")
def kb_stats(project_id: str, user: Annotated[dict[str, Any], Depends(current_user)]):
    try:
        authorize_project(project_id, user)
        return platform_service.kb_stats(project_id)
    except Exception as error:
        handle_error(error)


@app.post("/api/kb/search")
def search(
    payload: SearchRequest, user: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.search(**payload.model_dump())
    except Exception as error:
        handle_error(error)


@app.post("/api/rag/compare")
def rag_compare(
    payload: RAGRequest, user: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.rag_compare(payload)
    except Exception as error:
        handle_error(error)


@app.get("/api/skills")
def list_skills(_: Annotated[dict[str, Any], Depends(current_user)]):
    return list(platform_service.skills.values())


@app.put("/api/skills/{skill_id}")
def update_skill(
    skill_id: str,
    payload: SkillUpdate,
    _: Annotated[dict[str, Any], Depends(require_admin)],
):
    try:
        return platform_service.update_skill(skill_id, payload)
    except Exception as error:
        handle_error(error)


@app.get("/api/tools")
def list_tools(_: Annotated[dict[str, Any], Depends(current_user)]):
    return list(platform_service.tools.values())


@app.post("/api/tools/{tool_name}/run")
def run_tool(
    tool_name: str,
    payload: ToolRunRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        if payload.project_id:
            authorize_project(payload.project_id, user)
        return platform_service.run_tool(
            tool_name, payload.arguments, payload.project_id
        )
    except Exception as error:
        handle_error(error)


@app.post("/api/agents/run")
def agent_run(
    payload: AgentRunRequest, user: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.agent_run(**payload.model_dump())
    except Exception as error:
        handle_error(error)


@app.post("/api/experiments/tools/run")
def run_tool_experiment(
    payload: ToolExperimentRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.tool_experiment(payload.project_id, payload.task_id)
    except Exception as error:
        handle_error(error)


@app.post("/api/experiments/data/run")
def run_data_experiment(
    payload: ProjectScopedRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.data_engineering_experiment(payload.project_id)
    except Exception as error:
        handle_error(error)


@app.post("/api/experiments/cpt/run")
def run_cpt_experiment(
    payload: ProjectScopedRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.cpt_experiment(payload.project_id)
    except Exception as error:
        handle_error(error)


@app.post("/api/experiments/sft/run")
def run_sft_experiment(
    payload: TaskScopedRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.sft_experiment(payload.project_id, payload.task_id)
    except Exception as error:
        handle_error(error)


@app.post("/api/experiments/rlhf/run")
def run_rlhf_experiment(
    payload: ProjectScopedRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.rlhf_experiment(payload.project_id)
    except Exception as error:
        handle_error(error)


@app.post("/api/experiments/multi-agent/run")
def run_multi_agent_experiment(
    payload: TaskScopedRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.multi_agent_experiment(
            payload.project_id, payload.task_id
        )
    except Exception as error:
        handle_error(error)


@app.post("/api/experiments/skills/run")
def run_skill_experiment(
    payload: TaskScopedRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.skill_experiment(payload.project_id, payload.task_id)
    except Exception as error:
        handle_error(error)


@app.post("/api/experiments/agent-loop/run")
def run_agent_loop_experiment(
    payload: TaskScopedRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(payload.project_id, user)
        return platform_service.agent_loop_experiment(
            payload.project_id, payload.task_id
        )
    except Exception as error:
        handle_error(error)


@app.get("/api/reports/{project_id}")
def report(project_id: str, user: Annotated[dict[str, Any], Depends(current_user)]):
    try:
        authorize_project(project_id, user)
        return platform_service.report(project_id)
    except Exception as error:
        handle_error(error)


@app.put("/api/reports/{project_id}/observation")
def update_report_observation(
    project_id: str,
    payload: ReportObservationUpdate,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(project_id, user)
        return platform_service.update_report_observation(project_id, payload.html)
    except Exception as error:
        handle_error(error)


@app.post("/api/reports/{project_id}/export")
def export_report(
    project_id: str,
    payload: ReportExportRequest,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(project_id, user)
        report_data = platform_service.report(project_id)
        extension = payload.format
        if extension == "pdf":
            content = build_pdf(report_data, payload.conclusion)
            media_type = "application/pdf"
        else:
            content = build_docx(report_data, payload.conclusion)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"{report_data['project']['name']}-实验报告.{extension}"
        disposition = f"attachment; filename=cryptollmlab-report.{extension}; filename*=UTF-8''{quote(filename)}"
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": disposition, "Cache-Control": "no-store"},
        )
    except Exception as error:
        handle_error(error)


@app.get("/api/reports/{project_id}/experiments")
def experiment_reports_summary(
    project_id: str, user: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        authorize_project(project_id, user)
        return platform_service.experiment_reports_summary(project_id)
    except Exception as error:
        handle_error(error)


@app.get("/api/reports/{project_id}/experiments/{exp_id}")
def experiment_report(
    project_id: str, exp_id: str, user: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        authorize_project(project_id, user)
        return platform_service.experiment_report(project_id, exp_id)
    except Exception as error:
        handle_error(error)


@app.put("/api/reports/{project_id}/experiments/{exp_id}/observation")
def save_experiment_observation(
    project_id: str,
    exp_id: str,
    payload: ReportObservationUpdate,
    user: Annotated[dict[str, Any], Depends(current_user)],
):
    try:
        authorize_project(project_id, user)
        return platform_service.save_experiment_observation(
            project_id, exp_id, payload.html
        )
    except Exception as error:
        handle_error(error)


@app.post("/api/reports/{project_id}/experiments/{exp_id}/pdf", status_code=201)
async def upload_experiment_report_pdf(
    project_id: str,
    exp_id: str,
    user: Annotated[dict[str, Any], Depends(current_user)],
    file: UploadFile = File(...),
):
    try:
        authorize_project(project_id, user)
        data = await file.read(platform_service.max_upload_bytes + 1)
        return platform_service.upload_experiment_report_pdf(
            project_id, exp_id, file.filename or "report.pdf", data
        )
    except Exception as error:
        handle_error(error)
    finally:
        await file.close()


@app.get("/api/reports/{project_id}/experiments/{exp_id}/pdf")
def get_experiment_report_pdf(
    project_id: str, exp_id: str, user: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        authorize_project(project_id, user)
        path, filename = platform_service.experiment_report_pdf_path(project_id, exp_id)
        return FileResponse(
            path,
            media_type="application/pdf",
            filename=filename,
            content_disposition_type="inline",
            headers={"Cache-Control": "no-store"},
        )
    except Exception as error:
        handle_error(error)


@app.delete("/api/reports/{project_id}/experiments/{exp_id}/pdf")
def delete_experiment_report_pdf(
    project_id: str, exp_id: str, user: Annotated[dict[str, Any], Depends(current_user)]
):
    try:
        authorize_project(project_id, user)
        return platform_service.delete_experiment_report_pdf(project_id, exp_id)
    except Exception as error:
        handle_error(error)
