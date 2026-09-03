# CryptoLLMLab 开发交接文档

> 面向接手开发者的总体工程交接文档。读完本文档你应能：跑起来项目、看懂目录与数据流、把剩余实验页从「占位」补成「完整交互」、并把代码推送到 Gitee 协作。
>
> 配套文档：
> - `README.md`：运维/部署/数据库/真实模型接入（本文不重复，只做索引）。
> - `AI赋能密码学实验平台_Codex开发说明.md`：最初的产品需求原文。
> - `HANDOFF.md`：历史交接记录。

---

## 1. 这是什么

CryptoLLMLab 是一个面向密码学教学的实验平台，主线是让学生按 10 个实验逐步体验「从数据到智能体」的全过程：

```
数据工程 → CPT → SFT → RLHF → 向量知识库 → RAG → Skills → Tools → Agent 闭环 → 多智能体
```

平台是**单页应用（SPA）+ FastAPI 后端 + PostgreSQL(pgvector)**，前端按登录角色（学生 / 管理员）在**同一套 URL** 上渲染不同内容：

- **学生**：做实验、写观察、上传实验报告 PDF、导出报告。
- **管理员**：不做实验；进任意实验页只看到「标题 + 实验要点（只读）+ 评分 rubric + 打分 prompt」；另有「成绩管理」阅卷台和「阅卷视觉大模型(VLM)」配置。

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 6 + react-router-dom 7 + lucide-react 图标 + react-markdown |
| 后端 | Python + FastAPI + SQLAlchemy + Alembic 迁移 + Pydantic v2 |
| 数据库 | PostgreSQL 17 + pgvector（`vector` 列 + 余弦索引） |
| 模型接入 | OpenAI 兼容 Chat Completions 协议；离线教学 Provider 兜底；阅卷用多模态 VLM |
| 部署 | Docker Compose 三容器：`database` / `backend` / `web`(Nginx) |

---

## 3. 快速跑起来

### 3.1 容器化（推荐，最接近线上）

```bash
cp .env.container.example .env.container
# 编辑 .env.container：务必改 POSTGRES_PASSWORD / AUTH_ADMIN_* / AUTH_STUDENT_*
docker compose --env-file .env.container up -d --build
# 打开 http://localhost:8080
```

### 3.2 源码开发模式（改前端/后端时用）

```bash
# 终端1：只起数据库
docker compose --env-file .env.container up -d database

# 终端2：后端
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 终端3：前端（Vite 默认代理到 8000）
cd frontend
npm install
npm run dev
# 打开 http://localhost:5173
```

默认账号来自 `.env.container` 的 `AUTH_ADMIN_*` / `AUTH_STUDENT_*`，首次启动写入数据库（Argon2id 哈希）。

---

## 4. 目录结构

```
CryptoLLMLab/
├─ backend/
│  ├─ app/
│  │  ├─ main.py                 # 所有 FastAPI 路由（HTTP 入口）
│  │  ├─ schemas.py              # Pydantic 请求/响应模型
│  │  ├─ config.py               # 环境变量配置（Settings）
│  │  ├─ storage.py              # SQLAlchemy 表模型 + PostgreSQL/pgvector 持久层
│  │  ├─ experiments_seed.py     # ★ 10 个实验的预置数据 + EXPERIMENT_CATEGORIES（前端目录来源）
│  │  ├─ evidence_seed.py        # RAG 证据挑战包 / 国产密码 & TEE 专题资料
│  │  ├─ seed.py                 # 预置知识库文档
│  │  ├─ providers/              # 模型 Provider 抽象与实现
│  │  │  ├─ interfaces.py        # LLMProvider / EmbeddingProvider / RerankProvider 抽象基类
│  │  │  ├─ local.py             # 离线教学实现（无需 Key）
│  │  │  ├─ openai_compatible.py # 真实 OpenAI 兼容实现
│  │  │  └─ vlm.py               # 阅卷视觉大模型（PDF 逐页转图片打分）
│  │  └─ services/
│  │     ├─ platform.py          # ★ 核心业务：KB/RAG/8 个实验/评分/报告，全在这里
│  │     ├─ auth.py              # 登录/会话/账号
│  │     ├─ report_export.py     # 报告导出 PDF/Word/Markdown
│  │     └─ rich_text.py         # 富文本清洗
│  ├─ alembic/versions/          # 数据库迁移（新增表/列时加）
│  └─ tests/                     # pytest（当前 46 passed）
├─ frontend/
│  └─ src/
│     ├─ App.tsx                 # 路由表
│     ├─ api.ts                  # ★ 所有后端接口的前端封装
│     ├─ context/AppContext.tsx  # 全局状态：user / project / bootstrap / kb 等
│     ├─ types.ts                # 前端类型
│     ├─ styles.css              # 全站样式（含配色变量 --mint/--muted/--faint）
│     ├─ components/
│     │  ├─ Layout.tsx           # 侧栏 + 顶栏（按角色区分导航）
│     │  ├─ ExperimentShell.tsx  # 实验页通用骨架：ExperimentHeader/RunBar/ComparePanel
│     │  ├─ AdminExamView.tsx    # ★ 管理员进实验页看到的只读视图（标题+要点+rubric）
│     │  ├─ RubricPanel.tsx      # rubric 编辑（仅管理员）
│     │  └─ UI.tsx               # Stepper/Flow/StepNav/Pill/EmptyState/Metric 等原子组件
│     └─ pages/                  # 每个页面一个文件（见第 6 节）
├─ compose.yaml                  # 三容器编排
├─ .env.container.example        # 部署环境变量模板
└─ *.md                          # 文档
```

---

## 5. 数据流与关键概念

### 5.1 一次请求怎么走

```
前端页面 → api.ts 封装的 fetch → FastAPI main.py 路由
   → Depends(current_user / require_admin) 鉴权
   → platform_service.<方法>()  业务逻辑
   → storage.py 落库 (PostgreSQL/pgvector)
   → 返回 JSON → 前端渲染
```

### 5.2 角色与隔离（务必遵守）

- 前端：`const { user } = useApp();` 后 `if (user?.role !== "admin") return null;` 隐藏管理内容。
- 后端：管理接口一律 `Depends(require_admin)`；项目数据访问用 `authorize_project(project_id, user)`（管理员可看全部，学生只能看自己的）。
- **两端都要挡**，绝不能只靠前端隐藏。

### 5.3 项目（project）

- 每个学生同时只有一个「当前实验」项目，名称**固定为「我的实验记录」**（前端无命名/重命名入口，后端 `create_project`/`update_project` 也强制忽略自定义名）。
- 项目是所有实验数据的容器：知识库、Chunk、RAG、Run Trace、每个实验的报告 PDF 与评分都挂在 project 下。

### 5.4 Provider 抽象（接真实模型只改实现）

`backend/app/providers/interfaces.py` 定义了三个抽象：`LLMProvider.generate` / `EmbeddingProvider.embed` / `RerankProvider.rerank`。
- 离线兜底：`local.py`（无需 Key，用于教学与测试）。
- 真实模型：`openai_compatible.py`，由 `.env` 的 `LLM_BASE_URL/LLM_MODEL/LLM_API_KEY` 驱动，也可在前端 Provider 页在线热切换。
- 阅卷 VLM：`vlm.py`，由 `VLM_*` 环境变量驱动，仅管理员在 Provider 页配置。

---

## 6. 实验现状（★ 接手重点）

**后端 10 个实验的接口和业务逻辑已全部实现**（`platform.py` 里 `data_engineering_experiment` / `cpt_experiment` / `sft_experiment` / `rlhf_experiment` / `skill_experiment` / `tool_experiment` / `agent_loop_experiment` / `multi_agent_experiment`，以及 KB/RAG 全套）。

**前端只有 2 个实验做完了完整交互，其余 8 个是占位页**：

| 实验 | 路由 | 前端页面 | 状态 |
|---|---|---|---|
| 05 向量知识库 | `/lab/knowledge` | `KnowledgeLab.tsx` (389 行) | ✅ 完整分步向导（参考样板）|
| 06 RAG 检索增强 | `/lab/rag` | `RagLab.tsx` (269 行) | ✅ 完整 A/B 对比 |
| 01 数据工程 | `/lab/data` | `DataLab.tsx` (20 行) | ⏳ 占位，后端接口已就绪 |
| 02 CPT | `/lab/cpt` | `CptLab.tsx` | ⏳ 占位 |
| 03 SFT | `/lab/sft` | `SftLab.tsx` | ⏳ 占位 |
| 04 RLHF | `/lab/rlhf` | `RlhfLab.tsx` | ⏳ 占位 |
| 07 Skills | `/lab/skills` | `SkillLab.tsx` | ⏳ 占位 |
| 08 Tools | `/lab/tools` | `ToolLab.tsx` | ⏳ 占位 |
| 09 Agent 闭环 | `/lab/agent` | `AgentLoopLab.tsx` | ⏳ 占位 |
| 10 多智能体 | `/lab/multi-agent` | `MultiAgentLab.tsx` | ⏳ 占位 |

> 所以接手的**主要工作量 = 把 8 个占位前端页，按 05/06 的范式接上已有的后端接口**。

### 占位页长这样（`DataLab.tsx`）

```tsx
export function DataLab() {
  const { user } = useApp();
  const tag = "实验 01 · 数据工程";
  const title = <>密码语料<span>构建与治理</span></>;
  const intro = "……";
  if (user?.role === "admin") return <AdminExamView expId="01" tag={tag} title={title} intro={intro} />;
  return <div className="lab-page tool-page">
    <ExperimentHeader tag={tag} title={title} intro={intro}
      flowSteps={["原始语料", "去重", "清洗", "质量过滤", "规范化", "高质量数据集"]} flowActive={0} />
    {/* TODO: 学生交互区，调用 api.runDataExperiment(...) 渲染 A/B 结果 */}
  </div>;
}
```

管理员分支（`AdminExamView`）已经写好了，**不用动**；你只需要补学生分支的交互区。

---

## 7. 如何实现一个实验页（分步指南）

以「实验 01 数据工程」为例（其它实验同理，只是换 api 方法和字段）。

### Step 1 — 看后端返回什么

后端方法在 `platform.py::data_engineering_experiment`，返回结构：

```jsonc
{
  "run_id": "data_xxxx",
  "stages": [{ "id": "dedup", "name": "去重", "desc": "…" }, …],
  "samples": [{ "id": "d1", "text": "…", "issues": ["噪声","广告"], "kept": false }, …],
  "off": { "label": "原始语料", "count": 10, "quality": 38, "note": "…" },
  "on":  { "label": "治理后语料", "count": 4, "quality": 94, "note": "…" },
  "metrics": { "dedup_rate": .2, "retention_rate": .4, "quality_gain": 56, … },
  "diagnosis": "原始 10 条…保留 4 条…"
}
```

对应的路由：`POST /api/experiments/data/run`，body 是 `{ "project_id": "..." }`。

### Step 2 — 前端 api.ts 已有封装

`frontend/src/api.ts` 里已经有对应方法（无需新增）：

```ts
runDataExperiment:  (payload) => request("/api/experiments/data/run", { method:"POST", ... }),
runCptExperiment:   (payload) => request("/api/experiments/cpt/run", ...),
runSftExperiment:   (payload) => request("/api/experiments/sft/run", ...),   // 需要 task_id
runRlhfExperiment:  (payload) => request("/api/experiments/rlhf/run", ...),
runSkillExperiment: (payload) => request("/api/experiments/skills/run", ...),// 需要 task_id
runToolExperiment:  (payload) => request("/api/experiments/tools/run", ...), // 需要 task_id
runAgentLoopExperiment:  (payload) => request("/api/experiments/agent-loop/run", ...),
runMultiAgentExperiment: (payload) => request("/api/experiments/multi-agent/run", ...),
```

> 注意：部分实验需要 `task_id`（SFT/Skills/Tools/AgentLoop/MultiAgent 的题目从 `experiments_seed.py` 里取，前端从 `bootstrap.experiment_categories` 拿或写死题目列表）。

### Step 3 — 用通用组件拼学生交互区

复用 `ExperimentShell.tsx` 里的 `RunBar`（运行按钮）+ `ComparePanel`（OFF/ON 双栏对比）。骨架：

```tsx
import { useState } from "react";
import { ExperimentHeader, RunBar, ComparePanel, WaitState } from "../components/ExperimentShell";
import { AdminExamView } from "../components/AdminExamView";
import { useApp } from "../context/AppContext";
import { api } from "../api";
import type { Dict } from "../types";

export function DataLab() {
  const { user, project } = useApp();
  const tag = "实验 01 · 数据工程";
  const title = <>密码语料<span>构建与治理</span></>;
  const intro = "……";
  if (user?.role === "admin") return <AdminExamView expId="01" tag={tag} title={title} intro={intro} />;

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Dict | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    if (!project) return;
    setRunning(true); setError("");
    try { setResult(await api.runDataExperiment({ project_id: project.id })); }
    catch (e) { setError((e as Error).message); }
    finally { setRunning(false); }
  };

  return <div className="lab-page tool-page">
    <ExperimentHeader tag={tag} title={title} intro={intro}
      flowSteps={["原始语料","去重","清洗","质量过滤","规范化","高质量数据集"]}
      flowActive={result ? 5 : 0} />
    <RunBar running={running} onRun={run} label="运行数据治理对比" />
    {error && <div className="provider-msg err">{error}</div>}
    {result ? <ComparePanel
      offLabel={result.off.label} onLabel={result.on.label}
      offHead={<>质量分 {result.off.quality}</>} onHead={<>质量分 {result.on.quality}</>}
      offBody={result.off.note} onBody={result.on.note} />
      : <WaitState>点击上方按钮运行 A/B 对比。</WaitState>}
  </div>;
}
```

> 想要更精致的分步体验（像实验 05），用 `UI.tsx` 里的 `Stepper` / `StepNav` 组件，把「原始→去重→清洗→…」做成一步一个小实验。参照 `KnowledgeLab.tsx` 的 `steps`/`step` 状态机写法。

### Step 4 — 验证（每次改完必跑）

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npx vite build
```

后端如有改动：

```bash
cd backend && APP_ENV=test DATABASE_URL="sqlite+pysqlite:///:memory:" DATABASE_AUTO_CREATE=true \
  LLM_PROVIDER=local AUTH_ADMIN_USERNAME=admin AUTH_ADMIN_PASSWORD='Admin-Test-Password-2026!' \
  AUTH_STUDENT_USERNAME=student AUTH_STUDENT_PASSWORD='Student-Test-Password-2026!' \
  PYTHONPATH=. .venv/bin/python -m pytest -q tests
```

---

## 8. 新增/修改一个实验的完整链路（如果要动后端）

1. **预置数据**：在 `experiments_seed.py` 加数据字典，并在 `EXPERIMENT_CATEGORIES` 里补一项（`index/title/route/mode/off/on/objectives`）——前端实验目录、`AdminExamView` 的「实验要点」都来自这里。
2. **业务方法**：在 `services/platform.py` 加 `xxx_experiment(self, project_id, …)`，用 `self._record(...)` 记录 Run Trace。
3. **请求模型**：如需新参数，在 `schemas.py` 加/改 Pydantic 模型（注意 `extra="forbid"` 时字段要对齐）。
4. **路由**：在 `main.py` 加 `@app.post("/api/experiments/xxx/run")`，带 `Depends(current_user)` + `authorize_project`。
5. **前端封装**：在 `api.ts` 加方法。
6. **前端页面**：在 `pages/` 加页面，在 `App.tsx` 注册路由，在 `Layout.tsx` 侧栏加入口。
7. **评分**（可选）：管理员在实验页配置 rubric（合计 100 分）+ 打分 prompt；也可用 `PUT /api/admin/rubrics/{expId}` 直接写。

### 数据库有结构变化时

```bash
cd backend
alembic revision -m "描述"      # 生成迁移
# 编辑 alembic/versions/xxx.py
alembic upgrade head            # 应用
```

不要手改线上表结构；一律走迁移。

---

## 9. 评分与阅卷（管理端）

- 每个实验一套 rubric：`grading_rubrics` 表，payload = `{ items:[{id,description,points}], scoring_prompt }`，items 分值合计应为 100。
- 学生上传实验报告 PDF → 后端 `_auto_grade_submission` 自动触发 VLM 打分（PDF 逐页转图片送入多模态模型，**不做 OCR**）。
- 管理员在「成绩管理」查看队列、按实验/学生筛选、下载 PDF、重新评分、人工复核逐项改分。
- 相关接口：`GET/PUT /api/admin/rubrics/{expId}`、`GET /api/admin/submissions`、`POST /api/admin/submissions/{pid}/{expId}/grade`、`PUT …/override`、`GET/POST /api/admin/vlm`。

---

## 10. 约定与坑

- **改代码前先读文件**（用编辑器/IDE 打开确认上下文再改）。
- **不加多余注释**；跟随现有代码风格。
- **配色**：次级文字统一用青绿调变量 `--muted` / `--faint`，主色 `--mint`；不要写死冷灰 hex。
- **字号**：全站用 `calc(Npx * var(--font-scale))`，支持 A−/A/A+ 三档。
- **上传类型**：TXT / Markdown / PDF / 代码；不支持图片。PDF 在「解析文本」步用 VLM 转 Markdown，未配 VLM 回退 pypdf。
- **from __future__ import annotations** 下，`main.py` 里 `schemas` 的 import 名字漏了会让 FastAPI 把 body 当 query 参数导致 422——改 import 块时别误删。
- 提交 commit 用中文、说清「为什么」；只有用户明确要求时才 commit（见下节）。

---

## 11. 推送到 Gitee 协作

当前 `origin` 指向 GitHub。要把项目托管/协作到 **Gitee**，两种方式：

### 方式 A：新增 Gitee 为第二远程（保留 GitHub）

```bash
# 1. 在 gitee.com 上先建一个空仓库（不要勾选自动初始化 README）
# 2. 添加远程（把 <你的用户名>/<仓库名> 换成实际值）
git remote add gitee https://gitee.com/<你的用户名>/<仓库名>.git

# 3. 推送当前分支和全部历史
git push -u gitee main

# 以后同时推两个远程：
git push origin main && git push gitee main
```

### 方式 B：把 Gitee 作为主远程

```bash
git remote rename origin github        # 原 GitHub 改名保留
git remote add origin https://gitee.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 别人从 Gitee 接手

```bash
git clone https://gitee.com/<你的用户名>/<仓库名>.git
cd <仓库名>
# 按第 3 节「快速跑起来」启动，然后按第 7 节实现实验
```

> 提示：
> - `.env` / `.env.container` 已被 `.gitignore` 忽略，**不会**推送密钥；接手者需自己 `cp .env.container.example .env.container` 并填。
> - 若用 HTTPS 推送 Gitee，首次会要求输入 Gitee 账号/密码或私人令牌；也可配置 SSH key 用 `git@gitee.com:...` 形式。
> - Gitee 单文件/仓库大小有限制，本仓库纯代码无大文件，正常推送即可。

---

## 12. 验收清单（交付前自查）

```bash
# 前端类型 + 构建
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run build

# 后端测试
cd backend && APP_ENV=test DATABASE_URL="sqlite+pysqlite:///:memory:" DATABASE_AUTO_CREATE=true \
  LLM_PROVIDER=local AUTH_ADMIN_USERNAME=admin AUTH_ADMIN_PASSWORD='Admin-Test-Password-2026!' \
  AUTH_STUDENT_USERNAME=student AUTH_STUDENT_PASSWORD='Student-Test-Password-2026!' \
  PYTHONPATH=. .venv/bin/python -m pytest -q tests

# compose 配置校验
docker compose --env-file .env.container config
```

- [ ] 前端 tsc 无报错、`npm run build` 成功
- [ ] 后端 pytest 全绿（当前基线 46 passed）
- [ ] 学生登录能做实验、上传报告、导出报告
- [ ] 管理员进实验页只见只读视图 + rubric；成绩管理能筛选/下载/复核
- [ ] 新实验页两端角色隔离正确（学生看不到管理内容）
```
