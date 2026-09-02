# CryptoLLMLab 项目交接说明

> 交接快照：2026-08-29 12:47:35 CST  
> 源码包标识：`20260829_124735`  
> 项目定位：面向密码学教学的 AI 实验平台  
> 运行入口：<http://localhost:8080>

## 1. 接手后先看这些文件

1. 本文件：运行方式、数据恢复、架构边界和后续事项。
2. `README.md`：完整使用说明、实验流程和容器命令。
3. `AI赋能密码学实验平台_Codex开发说明.md`：最初的产品与开发需求。
4. `backend/resources/rag-evidence-pack/README.md`：本地密码学资料、来源和校验规则。
5. `compose.yaml`：PostgreSQL/pgvector、FastAPI 和 Nginx 三服务部署栈。

当前目录不是 Git 仓库，交接包不包含历史提交。接手后建议立即初始化 Git、提交本快照，并配置远程私有仓库。

## 2. 当前可运行状态

交接快照制作时，三个容器均通过健康检查：

- `cryptolab-database-1`：PostgreSQL 17 + pgvector
- `cryptolab-backend-1`：FastAPI API
- `cryptolab-web-1`：React 静态站点 + Nginx

当前数据库迁移版本为 `20260815_0006 (head)`。快照数据规模：

- 2 个用户
- 7 个实验项目
- 8 份项目资料
- 177 个 Chunk
- 36 条运行记录
- 5 个上传卷文件

交接包附带 PostgreSQL 和上传卷备份。数据库备份排除了 `auth_sessions` 表的数据，恢复后所有人都需要重新登录。

### 交接前验证结果

```text
后端：28 passed
前端：TypeScript + Vite production build 通过
Compose：docker compose config --quiet 通过
资料：rag-evidence-pack/SHA256SUMS 共 32 项全部通过
```

已知测试告警：FastAPI 测试环境提示 Starlette `TestClient` 的 httpx 兼容性弃用告警，不影响当前测试通过；升级依赖时需要处理。

## 3. 产品主流程

平台将三项实验串成一个持续项目：

```text
上传/选择密码学资料
  → 文本解析与 Chunk 切分
  → Embedding 与 pgvector 检索
  → Base LLM / Crypto-RAG A/B 对比
  → Skills + Tools + Planning + Memory Agent
  → 历史实验管理与报告导出
```

主要能力：

- 学生注册、学生/管理员登录和项目数据隔离。
- 当前实验、结束实验、历史实验、恢复实验和重新开始。
- TXT、Markdown、PDF 和常见代码文件上传；代码只解析不执行。
- Chunk、向量预览、Top-K、阈值、Rerank 和上下文过程观察。
- 私域制度、NIST/NSA 精确参数、国产商密标准、鲲鹏 secGear、飞腾 PhyTEE 专题实验。
- OpenAI-compatible LLM Provider，可接 Qwen 或其他兼容模型，失败时可回退到离线教学模型。
- Agent 的结构化计划、Skill 路由、安全工具、运行 Trace 和实验级短期记忆。
- 项目级富文本“观察和感想”，自动保存并合并导出 JSON、Markdown、PDF 和 DOCX。
- 深色/浅色主题和三级字号设置。

## 4. 技术架构

| 层 | 技术 | 入口/职责 |
|---|---|---|
| Web | React 18、TypeScript、Vite、React Router | `frontend/src` |
| Markdown | react-markdown + remark-gfm | Agent/RAG 回答与表格渲染 |
| API | FastAPI、Pydantic | `backend/app/main.py` |
| 编排 | Python 服务层 | `backend/app/services/platform.py` |
| 数据 | SQLAlchemy、PostgreSQL 17、pgvector | `backend/app/storage.py` |
| 迁移 | Alembic | `backend/alembic` |
| LLM | OpenAI-compatible Chat Completions | `backend/app/providers` |
| 文档 | pypdf | PDF 文本提取 |
| 报告 | ReportLab、python-docx | PDF/DOCX 导出 |
| 认证 | Argon2id、服务端会话、HttpOnly Cookie | `backend/app/services/auth.py` |
| 部署 | Docker Compose、Nginx | `compose.yaml` |

## 5. 重要目录

```text
backend/app/                     FastAPI、模型、Provider、服务层
backend/alembic/                 结构化数据库迁移
backend/tests/                   API 与 Provider 测试
backend/resources/rag-evidence-pack/
                                 本地原文、教学摘编、manifest 和哈希
backend/scripts/                 旧 SQLite 导入工具
frontend/src/pages/              总览、项目、三项实验、报告、登录注册
frontend/src/components/         布局、Markdown、富文本和通用 UI
frontend/scripts/                浏览器 E2E 脚本
screenshots/                     已有页面与流程截图
handoff-data/                    本次交接的可选运行数据备份
```

## 6. 推荐方式：干净启动

适合接手者先验证代码，不继承当前实验数据。

```bash
cp .env.container.example .env.container
cp backend/.env.example backend/.env
```

编辑 `.env.container`：

- 设置新的 PostgreSQL 密码。
- 设置新的管理员和预置学生账号密码。
- 正式 HTTPS 部署时设置 `SESSION_COOKIE_SECURE=true`。
- 不需要公开注册时设置 `REGISTRATION_ENABLED=false`。

如果暂时不接远程模型，可将 `backend/.env` 中的 Provider 保持为本地教学模式；如接 Qwen 或其他服务，填写：

```dotenv
LLM_PROVIDER=openai_compatible
LLM_PROVIDER_NAME=your-provider
LLM_BASE_URL=https://your-compatible-endpoint/v1
LLM_MODEL=your-model
LLM_API_KEY=your-new-key
LLM_FALLBACK_TO_LOCAL=true
```

启动：

```bash
docker compose --env-file .env.container up -d --build
docker compose --env-file .env.container ps
curl http://localhost:8080/api/health
```

不要运行 `docker compose down -v`，除非明确希望删除 PostgreSQL 和上传资料卷。

## 7. 可选方式：恢复本次交接数据

只建议在新的、空的 Docker 环境中恢复。若目标环境已有数据，应先单独备份。

### 7.1 准备配置和镜像

```bash
cp .env.container.example .env.container
cp backend/.env.example backend/.env
# 修改新密码和 Provider 配置
docker compose --env-file .env.container build
docker compose --env-file .env.container up -d database
```

等待数据库健康后恢复 PostgreSQL：

```bash
docker compose --env-file .env.container exec -T database sh -lc \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' \
  < handoff-data/cryptolab-postgres-20260829_124735.dump
```

恢复上传资料卷：

```bash
docker compose --env-file .env.container run --rm --no-deps --entrypoint sh backend -lc \
  'tar -C /data/uploads -xzf -' \
  < handoff-data/cryptolab-uploads-20260829_124735.tar.gz
```

启动全部服务并验证：

```bash
docker compose --env-file .env.container up -d
docker compose --env-file .env.container exec -T backend alembic current
curl http://localhost:8080/api/health
```

注意：

- 备份包含用户和密码哈希，但不包含登录会话。
- 初始账号环境变量不会覆盖数据库中已经存在的密码。
- 若需要继承现有账号，请由原负责人通过安全渠道提供登录信息；不要把密码写入仓库。
- 上传卷包含用户上传内容，只能交给有权接触这些实验资料的开发者。

## 8. 配置与敏感信息

交接 ZIP **不包含**：

- 根目录 `.env.container`
- `backend/.env`
- 任何 LLM API Key
- `account_demo.txt` 中的本机演示账号信息
- 浏览器 Cookie 和服务端会话数据

只包含 `.env.container.example` 和 `backend/.env.example`。接手者必须创建自己的配置和密钥。不要把 `.env` 文件提交到 Git。

Provider 配置只存在后端环境变量中，不会下发到浏览器。`/api/health` 只返回脱敏后的 Provider 名称、模型和主机信息。

## 9. 数据库与迁移规则

- 容器启动入口会自动执行 `alembic upgrade head`。
- 不要直接修改生产表结构后跳过 Alembic。
- 新迁移文件放在 `backend/alembic/versions`，并同时补测试。
- `reset()` 只允许在 `APP_ENV=test` 使用。
- 当前 Embedding 存储为 pgvector `vector(128)`，带 HNSW 余弦索引。
- `backend/cryptolab.db` 是旧版 SQLite 遗留文件，当前正式运行不使用；交接包不包含它。

## 10. 开发与测试

### 容器开发验证

```bash
docker compose --env-file .env.container up -d --build
docker compose --env-file .env.container logs -f backend
```

### 后端测试

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. pytest -q tests
```

测试使用独立内存 SQLite，不应连接开发或生产数据库。

### 前端构建

```bash
cd frontend
npm ci
npm run build
```

### E2E

```bash
cd frontend
E2E_BASE_URL=http://127.0.0.1:8080 \
E2E_USERNAME=你的测试账号 \
E2E_PASSWORD='你的测试密码' \
npm run test:e2e
```

## 11. 当前已知限制

1. 后端仍保留少量进程内实验编排缓存，因此生产容器固定单 worker，尚不能直接横向扩容。
2. 耗时的 RAG/Agent 调用仍是同步请求，没有 Celery、RQ 或其他任务队列。
3. Embedding 是教学用 128 维实现；若切换生产 Embedding，需要新增模型配置、维度迁移和重建索引流程。
4. PDF 只做文本层提取，扫描 PDF 没有 OCR。
5. 上传文件使用 Docker 本地卷，没有接对象存储、病毒扫描或内容审核。
6. Provider 管理后台尚未完成，侧栏“Provider 配置”目前不是完整管理页面。
7. 侧栏“知识手册”目前不是完整独立页面。
8. 报告支持 `.docx`，不生成旧式二进制 `.doc`。
9. 还没有 CI/CD、集中日志、指标、告警、定期备份与恢复演练。
10. 当前目录没有 Git 历史。
11. 前端已经增加主题和字号控制，但旧组件仍有少量微型元数据字体；后续 UI 必须继续按可访问性要求系统性清理，操作文字不应再使用 7–9px 字号。
12. 本地权威资料适合教学复现；正式公开发布前仍需逐项复核版权、再分发许可和来源日期。

## 12. 建议后续优先级

### P0：正式平台基础

- 初始化 Git 和 CI，锁定 Python/Node 依赖版本。
- 将编排状态彻底持久化，接入后台任务队列和任务状态 API。
- 增加审计日志、结构化日志、错误追踪、Prometheus 指标和健康告警。
- 完成 HTTPS、反向代理、安全响应头、速率限制和密码重置流程。
- 建立数据库与上传卷的自动备份、校验和恢复演练。

### P1：教学与 RAG 质量

- 建设管理员 Provider 配置页，密钥应进入专用 Secrets 管理，不进入数据库明文或前端。
- 支持 OCR、更多解析器、文档版本管理和重复文件检测。
- 支持可替换 Embedding/Rerank Provider、异步重建和索引版本。
- 引入可重复的 RAG/Agent 评测集、实验参数快照和结果对比。
- 完成全站可访问性检查，正文、标签、按钮、图表坐标和 Trace 信息保证可读。

### P2：部署与运维

- 对象存储、CDN、多实例 API 和队列 Worker。
- 开发/测试/预发布/生产环境隔离。
- 数据保留、删除、导出与合规策略。
- 操作手册、教师手册、学生实验手册和管理员手册。

## 13. 交接验收清单

- [ ] ZIP 的 SHA-256 与随包校验文件一致。
- [ ] 接手者使用自己的 `.env`，未复用旧 API Key。
- [ ] `docker compose up -d --build` 后三个服务健康。
- [ ] 能注册/登录、创建项目和打开三个实验。
- [ ] 能构建知识库并看到 Chunk/向量。
- [ ] 能运行 RAG A/B 对比和 Agent。
- [ ] 能保存观察和感想并导出 PDF/DOCX。
- [ ] 若恢复数据，项目数和上传资料可核对，旧会话不可继续使用。
- [ ] 初始化 Git 并保存本交接快照为第一个基线提交。

