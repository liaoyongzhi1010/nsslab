# CryptoLLMLab · AI 赋能密码学实验平台

一个面向密码学教学的可运行 MVP，连续呈现：

`密码学资料 → 向量知识库 → Crypto-RAG → Skills / Tools / Agent → 实验报告`

## 推荐：容器化运行

正式部署使用 PostgreSQL 17 + pgvector、FastAPI API 和 Nginx 前端组成的容器应用栈。对使用者仍然只需一条启动命令：

```bash
cp .env.container.example .env.container
# 编辑 .env.container，务必修改数据库密码、管理员密码和学生密码
docker compose --env-file .env.container up -d --build
```

打开 <http://localhost:8080>。查看状态：

```bash
docker compose --env-file .env.container ps
docker compose --env-file .env.container logs -f backend
```

登录角色分为学生和管理员。学生只能访问自己创建的实验项目；管理员可查看全部项目、创建账号并修改全局 Skill 配置。初始账号由 `.env.container` 中的 `AUTH_ADMIN_*` 与 `AUTH_STUDENT_*` 配置在首次启动时写入数据库，密码以 Argon2id 哈希保存。登录态使用服务端会话和 HttpOnly、SameSite Cookie，原始会话令牌不会落库。已有但尚无归属的实验项目会自动归属给初始管理员。

登录页开放学生自助注册，注册成功后自动登录并进入独立工作区。公开注册接口固定创建学生角色，不接受管理员角色；可通过 `.env.container` 的 `REGISTRATION_ENABLED=false` 关闭公开注册。管理员账号仅能由初始配置或已有管理员创建。

初始账号只负责首次引导：修改环境变量不会覆盖数据库中已存在账号的密码。正式对外部署前应设置独立高强度密码，并在 HTTPS 反向代理下将 `SESSION_COOKIE_SECURE=true`。

数据库和上传文件分别保存在 Docker 命名卷 `cryptolab_postgres_data` 与 `cryptolab_uploads_data` 中，更新容器不会清除数据。PostgreSQL 端口只绑定到宿主机 `127.0.0.1`，不会直接暴露到外网。不要使用 `docker compose down -v`，`-v` 会明确删除持久卷。

停止或更新：

```bash
docker compose --env-file .env.container stop
docker compose --env-file .env.container up -d --build
```

## 源码开发运行

```bash
# 终端 1：先启动正式数据库
docker compose --env-file .env.container up -d database

# 终端 2：后端
cd backend && source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 终端 3：前端
cd frontend
npm install
npm run dev
```

打开 <http://localhost:5173>。默认离线教学 Provider 不需要模型 API Key。源码模式需确保 `DATABASE_URL` 指向开发数据库；生产、开发和测试数据库不得共用。

## 数据库与迁移

正式数据已按项目、上传资料、知识库、Chunk/Embedding、RAG Pipeline、Agent、Run Trace、Skills 和 Tools 建立关系表。Embedding 使用 pgvector `vector(128)` 列和 HNSW 余弦索引，检索候选由 PostgreSQL 执行；数据库变更由 Alembic 管理，后端容器启动时自动执行安全的增量迁移。当前容器固定为单个 API worker，进程内编排状态由锁保护；后续改造成完全无状态任务服务后再横向扩容 API。

测试套件强制使用独立的内存 SQLite 数据库，并且 `reset()` 仅在 `APP_ENV=test` 时可用，不能再清理开发或生产数据库。

如需把旧版 `backend/cryptolab.db` 的剩余项目一次性导入 PostgreSQL，请先启动数据库并执行迁移，再运行：

```bash
cd backend
source .venv/bin/activate
python scripts/import_legacy_sqlite.py ./cryptolab.db
```

旧 SQLite 文件只读，不会被删除。导入前建议先备份。

备份 PostgreSQL：

```bash
docker compose --env-file .env.container exec -T database \
  pg_dump -U cryptolab -Fc cryptolab > cryptolab-$(date +%Y%m%d).dump
```

## 配置真实大模型

后端统一使用 OpenAI-compatible Chat Completions 协议。复制配置模板：

```bash
cd backend
cp .env.example .env
```

在 `.env` 中填写 `LLM_PROVIDER_NAME`、`LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY` 后重启后端。Qwen 中国大陆默认业务空间可使用：

```dotenv
LLM_PROVIDER=openai_compatible
LLM_PROVIDER_NAME=Qwen
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus
LLM_API_KEY=your-key
```

切换其他兼容模型时只需替换以上四项；密钥只保存在被 Git 忽略的 `backend/.env`，不会下发到浏览器。远程服务异常时默认显式回退至离线教学模型。

## 验证

```bash
cd backend && PYTHONPATH=. .venv/bin/pytest -q tests
cd frontend && npm run build
docker compose --env-file .env.container config
```

若本机安装了 Google Chrome，可在前后端启动后运行完整浏览器验收：

```bash
cd frontend && E2E_USERNAME=student E2E_PASSWORD='你的学生密码' npm run test:e2e
# 验收容器化入口：
cd frontend && E2E_BASE_URL=http://127.0.0.1:8080 E2E_USERNAME=student E2E_PASSWORD='你的学生密码' npm run test:e2e
```

验收脚本覆盖项目创建、知识库构建、RSA 检索、TrustZone/SGX RAG、HE/MPC/TEE Agent、报告及 390px 移动端布局。

## RAG 证据挑战实验

为了避免通用大模型凭参数记忆就能回答、让 RAG 实验退化成主观文风比较，实验一预置了“RAG 证据挑战包”：

- NIST FIPS 203：ML-KEM-768 的精确密钥、密文和共享秘密尺寸
- NIST IR 8547 Initial Public Draft：需要同时陈述“草案”状态的 PQC 迁移边界
- NSA CNSA 2.0 FAQ v2.1：特定版本的算法参数、2027/2030/2031 节点与 NSS 适用范围
- NIST IR 8545：HQC 入选补充 KEM，但尚不能称为已发布 FIPS
- NIST IR 8610（2026-05-14）：进入附加 PQC 签名第三轮的九个候选及其“尚未标准化”边界
- “海岚医疗”课程私域手册：明确标注为虚构教学情境，包含模型不可能预先知道的资产、事件和处置编号

权威资料在卡片和回答引用中都带发布日期与官方原始链接；内置内容是便于切分和课堂核验的中文证据摘编，不冒充官方原文。

实验一另提供“国产密码与 TEE 专题包”，新增 10 份资料：

- 国产商密标准：GB/T 32905—2016（SM3）、GB/T 32907—2016（SM4）、GB/T 35276—2017（SM2 使用规范）、GB/T 39786—2021（信息系统密码应用基本要求）
- 行业密码规范：国家密码管理局第 45 号公告中的 2023 版 GM/T 实施/旧版废止关系；第 43 号公告中的 GM/T 0115、0116 测评文件
- 鲲鹏/openEuler：secGear 24.03 LTS SP4 开发指南和统一远程证明资料
- 飞腾：PhyTCM/PhyTPCM、PhyCrypto、PhyTEE/PhyCCA 平台资料，TEE 方案实例和 PSPA 端到云白皮书

实验二现提供 10 道固定题，其中新增 GM/T 版本替换、39786/0115/0116 文件角色、鲲鹏 secGear 构建细节、飞腾安全栈边界四道高区分度题。系统以预先定义的关键事实分别计算 Base LLM 与 Crypto-RAG 命中率，展示 `Knowledge Gain`，同时保留 Retrieval、Rerank、Context 和来源追溯。

推荐课堂路径：先运行“私域制度”建立明显正例，再运行 FIPS/CNSA 的版本化精确题；最后改问 AES/RSA 通识题，观察 Base LLM 本身已经足够强时 RAG 增益缩小。随后把 Top-K 调为 1/20、关闭 Rerank 或移除所需资料，制造检索失败并解释原因。这比只比较两段回答“哪段更好”更能体现向量检索的能力与边界。

挑战资料已冻结到 [`backend/resources/rag-evidence-pack`](backend/resources/rag-evidence-pack/README.md)：`originals/` 保存官方 PDF、网页文本快照和代码仓文档，`excerpts/` 保存平台实际切分的中文教学摘编，`manifest.json` 和 `SHA256SUMS` 记录版本与文件校验值。登录后打开实验一的资料预览，可直接访问“本地原始 PDF”或“本地官方资料”以及“本地教学摘编”，课堂运行不依赖外网。

## 实验报告导出

报告页支持导出 JSON、Markdown、PDF 和 Word（`.docx`）。页面中的“写下你的观察和感想”是项目级持久化富文本编辑器，支持标题、粗体、斜体、下划线、删除线、列表、引用和安全链接，并自动保存到 PostgreSQL；刷新页面或从历史实验重新进入时仍可恢复。后端会对白名单标签与链接协议再次清洗，PDF/Word 会保留可表达的富文本格式，Markdown/JSON 则包含对应的 Markdown、纯文本和安全 HTML。

PDF/Word 由后端根据真实实验记录生成，包含三项实验的配置与最近结果、能力评分、运行历史，以及用户填写的观察和感想。

## 目录

- `backend/app/providers`：LLM / Embedding / Rerank Provider 抽象及离线实现
- `backend/app/storage.py`：SQLAlchemy 结构化关系模型与 PostgreSQL/pgvector 持久层
- `backend/alembic`：数据库增量迁移
- `backend/app/services`：文档切分、向量检索、RAG、Agent 与报告
- `frontend/src/pages`：Dashboard、三项连续实验与报告
- `compose.yaml`：数据库、API、Web 前端的一键部署栈
- `AI赋能密码学实验平台_Codex开发说明.md`：产品需求原文

## 用户资料上传

实验一支持将用户资料与预置密码学知识包混合构建知识库：

- 文本：TXT、Markdown
- PDF：逐页提取文字；扫描版 PDF 暂需预先 OCR
- 代码：Python、JavaScript/TypeScript、Java、C/C++、Go、Rust、Solidity、JSON/YAML、Shell、SQL 等

单文件上限 10 MB。代码文件只做静态文本解析与函数/类边界切分，不会导入、编译或执行；上传路径按实验项目隔离。
