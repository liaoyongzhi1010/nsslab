# AI 赋能密码学研究与教学实验平台
## ——第一期建设思路与 Codex 开发说明

> 文档定位：本文件用于指导 Codex 完成第一期实验平台的原型设计与实现。第一期不追求完整复现大型垂域模型训练体系，而是把“玄知密码大模型”建设过程中的关键机制拆解为学生可观察、可操作、可比较的实验流程，使学生能够在实验中理解：密码学领域知识如何进入大模型系统、RAG 为什么能够提升专业性、Skills/Tools/Agent 如何让大模型从“会回答”扩展到“会完成密码学任务”。

---

# 1. 项目定位

## 1.1 项目名称（暂定）

**AI 赋能密码学研究与教学实验平台**

可使用英文副标题：

**AI for Cryptography Teaching & Research Lab**

第一期可以在系统内部将学生逐步构建的实验对象称为：

**CryptoLLMLab Model / Mini Crypto Agent**

## 1.2 核心定位

本平台不是一个普通的“调用大模型 API 的聊天网站”，也不是要求学生从头训练一个数十亿参数模型。

平台的核心目标是：

> 以密码学作为唯一垂域，以玄知密码大模型的建设实践为参考原型，将“数据 → 知识库 → RAG → Skills → Tools → Agent → Evaluation”的关键过程拆解成可视化实验，让学生在逐步孵化一个小型密码学智能体的过程中理解垂域大模型的构建方法和工作原理。

第一期重点服务两个目标：

1. **教学目标**：帮助学生理解垂域大模型系统的构建机制，而不是只会调用模型。
2. **科研启蒙目标**：让学生理解 AI 如何与密码学知识、算法、协议和工具结合，为后续 MPC、HE、DP、PQC、TEE、ABE、ZKP、Blockchain 等高级研究实验奠定基础。

## 1.3 第一阶段总体学习路径

平台中三个实验必须连续衔接，不做成三个互相独立的小 Demo。

学生最终完成的是同一个“小型密码学大模型/密码学智能体”的逐步孵化过程：

```text
通用大模型
   │
   ▼
密码学领域资料
   │
   ▼
实验一：密码学向量知识库
   │
   ▼
Crypto Knowledge Base
   │
   ▼
实验二：密码学 RAG
   │
   ▼
具备领域知识增强的 Crypto-RAG
   │
   ▼
实验三：Skills + Tools + Agent
   │
   ▼
Mini Crypto Agent
   │
   ▼
实验测评与能力画像
```

---

# 2. 与“玄知密码大模型”的关系

本平台第一期不复刻玄知的全部工程系统，而是抽取其中最适合教学的关键机制。

玄知 V2 的整体思路可抽象为四个体系：

- 数据体系
- 模型体系
- 智能体体系
- 测评体系

其中与第一期实验直接相关的能力包括：

- 领域知识库
- Embedding 与向量检索
- RAG 知识增强
- 智能路由
- Skills / Tool 类能力
- Planning
- Memory
- Agent 工作流
- 任务完成率与能力测评

第一期不真正实现大规模 CPT、SFT、RLHF 或多模型训练，但需要在架构上保留未来接入这些实验的扩展能力。

---

# 3. 第一期开发表达原则

## 3.1 密码学必须贯穿全部实验

所有预置语料、问题、案例、Skills 和 Agent 任务均以密码学为主，不使用旅游、餐饮、医疗问答等无关通用案例。

建议第一期覆盖以下密码学主题：

- AES
- DES（作为历史对照）
- RSA
- ECC
- SM2
- SM3
- SM4
- Hash
- 数字签名
- Diffie-Hellman
- 基础密码协议
- MPC
- HE（BFV、CKKS 基础）
- DP（基础概念）
- PQC / ML-KEM / ML-DSA 基础
- TEE / SGX / TrustZone 基础
- ZKP 基础

其中第一期重点仍放在基础密码学 + 2~3 个前沿主题，不要求一次塞入所有领域。

## 3.2 “过程可观察”优先于“结果炫酷”

平台最重要的价值是让学生看到系统内部发生了什么。

例如不能只展示：

```text
问题 → 答案
```

而应该展示：

```text
问题
↓
Query Embedding
↓
Vector Retrieval
↓
Top-K
↓
Rerank
↓
Context Construction
↓
Prompt
↓
LLM
↓
Answer
```

Agent 同理，应展示可观察的计划、技能选择、工具调用和工具结果，但不展示模型私有思维链。

## 3.3 实验参数必须可调

学生不能只是点击“运行”。

至少应允许修改：

- Chunk Size
- Chunk Overlap
- Embedding Model
- Top-K
- Similarity Threshold
- 是否启用 Rerank
- Rerank Top-N
- Prompt Template
- Temperature（可选）
- 最大 Context 长度（可选）

学生修改参数后，需要看到检索结果、上下文和答案变化。

## 3.4 允许“故意做错”

实验需要支持错误配置，让学生观察失败原因，例如：

- Chunk 太小
- Chunk 太大
- Top-K 太低
- Top-K 太高
- 相似度阈值太高导致没有文档
- 相似度阈值太低导致噪声进入 Context
- 禁用 Rerank
- 使用低质量文档

系统应能解释：

> 当前结果为什么变差。

---

# 4. 第一阶段三个核心实验

# 4.1 实验一：密码学领域向量知识库构建

## 4.1.1 实验名称

**实验一：从密码学资料到向量知识库**

## 4.1.2 教学目标

学生理解：

- Document 是什么
- 文档为什么需要解析和清洗
- Chunk 是什么
- Chunk Size / Overlap 的作用
- Embedding 的作用
- 向量数据库存储的是什么
- 语义相似度检索是如何工作的
- 向量知识库本身“只负责找知识，不负责回答问题”

## 4.1.3 预置材料

第一期建议系统内置一个“小型密码学知识包”：

```text
AES.md
RSA.md
ECC.md
SM2.md
SM3.md
SM4.md
Hash.md
DH.md
PQC.md
ZKP.md
TEE.md
HE.md
```

每份材料不需要太长，建议 2~10 页等价内容即可。

后续支持学生上传：

- PDF
- TXT
- Markdown
- DOCX（可后置）

## 4.1.4 实验流程

### Step 1：选择/上传密码学资料

界面显示：

```text
原始文档
↓
文本抽取
↓
结构化结果
```

学生可以查看原始内容和解析后的 Markdown/纯文本结果。

### Step 2：Chunk 切分

参数：

```text
Chunk Size: 128 / 256 / 512 / 1024
Overlap: 0 / 32 / 64 / 128
```

界面显示：

```text
Chunk 001
Chunk 002
Chunk 003
...
```

点击 Chunk 可查看：

- 文本内容
- 字符数 / token 数
- 来源文档
- 页码/章节（若可获得）

### Step 3：Embedding

允许选择一个或多个 Embedding 模型。

第一期至少支持：

- 一个默认本地/开放 Embedding 模型
- 一个可配置的外部 Embedding API（如果有 Key）

系统为 Chunk 生成向量，并存入向量数据库。

### Step 4：二维语义空间可视化

将向量通过 PCA / UMAP / t-SNE 中任意一种方式做二维降维展示。

示意：

```text
AES ●   ● SM4

                 ● RSA
                      ● ECC

                                ● ZKP
```

要求：

- 可按文档着色/分组
- 鼠标悬停显示 Chunk 摘要
- 不要求学生理解降维算法细节，但应说明“二维图只是高维向量的近似可视化”

### Step 5：向量查询

问题示例：

> AES 为什么比 RSA 更适合大规模数据加密？

系统展示：

```text
Query
↓
Embedding
↓
Vector Search
↓
Top-K Results
```

结果表：

| Rank | 文档 | Chunk | Similarity |
|---|---|---|---:|
| 1 | AES | 性能特点 | 0.91 |
| 2 | 对称密码 | 应用场景 | 0.87 |
| 3 | RSA | 计算特性 | 0.83 |

## 4.1.5 实验输出

学生完成实验后保存：

- Knowledge Base ID
- 文档数
- Chunk 数
- Embedding Model
- Chunk Size
- Overlap
- 索引状态

该知识库直接作为实验二输入。

## 4.1.6 核心观察指标

- Chunk 数量
- 平均 Chunk Token
- 索引构建时间
- Query 延迟
- Top-K 相似度
- 检索相关率（可人工标记）

---

# 4.2 实验二：密码学 RAG 与领域知识增强

## 4.2.1 实验名称

**实验二：RAG 如何让大模型回答得更专业**

## 4.2.2 教学目标

学生理解：

- 基础大模型为什么会产生幻觉或知识不充分
- RAG 与训练/微调的区别
- Query Embedding
- Retrieval
- Top-K
- Rerank
- Context Construction
- Prompt Augmentation
- Grounded Answer
- RAG 的效果也受到参数和知识库质量影响

## 4.2.3 必须采用 A/B 双路对比

同一个问题同时运行：

### Path A：Base LLM

```text
Question
↓
LLM
↓
Answer A
```

### Path B：Crypto-RAG

```text
Question
↓
Embedding
↓
Crypto Knowledge Base
↓
Top-K
↓
Rerank
↓
Context
↓
LLM
↓
Answer B
```

前端必须左右对照展示。

## 4.2.4 预置密码学问题集

建议第一期准备 20~50 个问题，划分为不同难度。

### 基础问题

- AES-128、AES-192、AES-256 的主要区别是什么？
- 为什么 RSA 不适合直接加密大文件？
- Hash 与加密的区别是什么？

### 对比问题

- SM2 与 RSA 的主要差异是什么？
- AES 与 SM4 有哪些异同？
- BFV 与 CKKS 分别适合什么计算场景？

### 专业问题

- TrustZone 与 SGX 的内存隔离机制有什么区别？
- 为什么交互式零知识证明中的挑战需要随机且不可预测？
- ML-KEM 与传统 RSA 密钥交换的思路有什么区别？

## 4.2.5 RAG 过程观察器

必须显示以下信息：

### ① 用户问题

```text
为什么 RSA 不适合加密 1GB 文件？
```

### ② Query Embedding

只显示向量维度和前若干值，不要求完整打印：

```text
Dimension: 768
Preview: [0.132, -0.562, 0.091, ...]
```

### ③ Retrieval

显示 Top-K Chunk：

```text
Chunk 102 | RSA 计算复杂度 | 0.927
Chunk 034 | Hybrid Encryption | 0.884
Chunk 221 | AES 性能 | 0.817
```

### ④ Rerank

展示排序前后：

```text
Before: 102, 34, 221, 98, 18
After : 34, 102, 221
```

### ⑤ Context

显示最终进入模型的知识片段及 token 数。

### ⑥ Final Prompt

显示可公开的 Prompt 结构：

```text
System
Context
Question
Answer Requirements
```

不展示模型内部思维链。

### ⑦ Final Answer

展示回答，并标记引用来源 Chunk。

## 4.2.6 可调参数

- Top-K
- Similarity threshold
- Rerank on/off
- Rerank Top-N
- Prompt Template
- Max Context Token

## 4.2.7 必须提供“破坏实验”

学生选择不同参数，系统比较：

```text
Top-K = 1
→ 信息不足

Top-K = 5
→ 通常较好

Top-K = 20
→ Context 噪声增加
```

系统不应把上述结论写死，应根据实际结果展示变化。

## 4.2.8 评价维度

第一期不必构造复杂 LLM-as-a-Judge，可先实现简单版：

- 领域关键词覆盖率
- 来源引用数
- Context 命中率
- 答案与标准答案相似度
- 人工评分

后续升级：

- Correctness
- Faithfulness
- Context Relevance
- Answer Relevance
- Hallucination Rate

## 4.2.9 实验输出

保存：

- RAG Pipeline ID
- 使用的 Knowledge Base
- Embedding Model
- Top-K
- Rerank 配置
- Prompt Template
- 对照测试结果

实验三直接复用该 RAG Pipeline。

---

# 4.3 实验三：密码学 Skills、Tools 与 Agent

## 4.3.1 实验名称

**实验三：从密码学大模型到密码学智能体**

## 4.3.2 教学目标

学生理解：

```text
LLM
+
Knowledge
+
Skills
+
Tools
+
Planning
+
Memory
=
Agent
```

重点理解大模型“会回答”和智能体“会执行任务”的区别。

第一期先做 Single Agent，不直接做复杂 Multi-Agent。

## 4.3.3 内置 Crypto Agent

学生基于实验二的 Crypto-RAG 继续构建：

**Mini Crypto Agent**

Agent 具备：

- 密码学知识检索
- Skill 选择
- Tool 调用
- 简单规划
- 实验级短期记忆
- 最终结果输出

## 4.3.4 第一批 Skills

### Skill 1：crypto_explain

用途：解释密码学概念。

输入：

```text
topic
level
```

输出结构：

```text
概念
数学/安全基础
工作流程
典型算法
应用场景
注意事项
```

示例：

> 什么是椭圆曲线密码？

### Skill 2：crypto_compare

用途：比较两个密码算法/技术。

输入：

```text
algorithm_a
algorithm_b
scenario(optional)
```

输出：

- 安全基础
- 密钥/参数
- 性能
- 优点
- 局限
- 适用场景

示例：

> AES 和 RSA 哪个适合加密 10GB 文件？

### Skill 3：crypto_selection

用途：根据需求进行技术选型。

输入：

```text
requirements
constraints
```

可能检索：

- AES/RSA/ECC
- HE
- MPC
- TEE
- DP
- PQC

示例：

> 我希望服务器在不看到明文的情况下完成统计计算，应该选择什么技术？

## 4.3.5 Skills 配置格式

建议 Skill 使用 YAML 或 JSON 描述，便于教学查看与编辑。

示例：

```yaml
name: crypto_compare
description: 比较两个密码算法或密码技术的安全性、效率与适用场景
inputs:
  - algorithm_a
  - algorithm_b
  - scenario
steps:
  - retrieve_knowledge
  - compare_security
  - compare_performance
  - compare_scenarios
  - generate_recommendation
outputs:
  - comparison
  - recommendation
```

学生可编辑 description / steps / prompt template。

## 4.3.6 第一批 Tools

### Tool 1：knowledge_search

调用实验二的 Crypto-RAG Retrieval 模块。

### Tool 2：calculator

用于简单数值计算。

示例：

> 某 AES 实现处理 10GB 数据需要 20 秒，吞吐量提升 25% 后预计需要多少时间？

Agent 应调用 calculator，而不是完全依赖语言模型口算。

### Tool 3：python_runner（可选，建议放入沙箱）

用于简单密码学教学计算，例如：

- 模幂计算
- 欧几里得算法
- GCD
- 模逆
- 简单有限域演示

第一期必须限制危险能力，不提供系统命令执行权限。

### Tool 4：crypto_formula_tool（可选）

封装安全的基础密码学计算：

- gcd
- mod_inverse
- modular_exponentiation
- simple_entropy

## 4.3.7 Agent 工作过程观察器

展示：

```text
User Request
↓
Task Classification
↓
Plan
↓
Skill Selection
↓
Tool Call
↓
Tool Result
↓
Knowledge Retrieval
↓
Answer Assembly
↓
Final Answer
```

严禁展示模型私有 Chain-of-Thought。

可展示的是结构化计划，例如：

```json
{
  "goal": "比较 AES 与 RSA 在大文件加密中的适用性",
  "steps": [
    "查询 AES 性能和典型应用",
    "查询 RSA 数据长度与性能限制",
    "比较两者",
    "给出工程建议"
  ]
}
```

## 4.3.8 Agent 示例任务

### Task A：算法解释

> 解释 RSA 为什么需要大整数分解困难性。

### Task B：算法比较

> AES 与 SM4 在结构和应用上有什么区别？

### Task C：技术选型

> 需要在云端对密文进行统计，应该优先考虑 HE、MPC 还是 TEE？

### Task D：组合任务

> 为“移动端上传敏感文件到云端存储”的场景给出一个密码保护方案，并解释为什么这样选。

该任务要求 Agent：

- 解析需求
- 查询知识库
- 选择 Skill
- 必要时调用工具
- 生成结构化方案

## 4.3.9 实验输出

保存：

- Agent ID
- RAG Pipeline ID
- Skills 列表
- Tools 列表
- Agent Prompt
- 完成任务记录
- 成功/失败次数

---

# 5. 平台核心页面设计

第一期建议至少实现以下页面。

## 5.1 首页 / Dashboard

首页不要做成单一 ChatGPT 风格输入框。

建议结构：

```text
AI 赋能密码学实验平台

[实验一] 密码学知识库
      ↓
[实验二] Crypto-RAG
      ↓
[实验三] Crypto Agent
```

右侧显示当前学生的模型状态：

```text
我的 CryptoLLMLab

Base Model            ✓
Knowledge Base        ✓
Documents             12
Chunks                486
RAG                    ✓
Skills                 3
Tools                  3
Agent                  ✓
```

## 5.2 实验一页面

左侧：步骤导航

```text
1. 文档
2. 解析
3. Chunk
4. Embedding
5. Index
6. Retrieval
```

中间：主要实验区域

右侧：参数与观察指标

## 5.3 实验二页面

核心必须是 A/B 对照：

```text
┌──────── Base LLM ────────┐   ┌──────── Crypto-RAG ────────┐
│                           │   │                              │
│ Answer A                  │   │ Answer B                     │
│                           │   │ Retrieval / Source           │
└───────────────────────────┘   └──────────────────────────────┘
```

底部：RAG Pipeline Viewer。

## 5.4 实验三页面

上半区：Agent Builder

```text
LLM
Knowledge Base
Skills
Tools
Memory
```

下半区：Agent Run Trace

```text
Plan → Skill → Tool → Observation → Final
```

## 5.5 实验报告页面

自动生成：

- 实验参数
- 运行次数
- 检索结果
- A/B 对照结果
- 学生结论填写区域

支持导出 Markdown / PDF（PDF 可放后续）。

---

# 6. 推荐系统架构

第一期建议采用易维护、易部署的 Web 架构。

## 6.1 前端

优先建议：

- React + TypeScript
- Vite / Next.js（二选一）
- Tailwind CSS（可选）
- ECharts / Plotly（用于可视化）

如已有 Vue 技术栈，也可以使用 Vue 3，平台不强制。

## 6.2 后端

推荐：

- Python
- FastAPI
- Pydantic
- SQLAlchemy

理由：

- RAG / Embedding / Agent 工具链生态更丰富
- 实验代码展示方便
- 后续便于接入 ML 与密码学 Python 库

## 6.3 数据库

结构化数据：

- PostgreSQL

原型阶段可用：

- SQLite

文件：

- 本地文件系统（MVP）
- MinIO（正式版）

## 6.4 向量数据库

MVP 优先：

- FAISS / Chroma

正式版可选：

- Qdrant
- Milvus
- pgvector

建议第一期封装统一 VectorStore Interface，避免锁死。

## 6.5 模型接口抽象

必须实现统一模型接口：

```python
class LLMProvider:
    generate(...)

class EmbeddingProvider:
    embed(...)

class RerankProvider:
    rerank(...)
```

允许未来切换：

- OpenAI-compatible API
- Qwen
- DeepSeek
- 本地 vLLM
- Ollama

系统不能把某个厂商写死。

---

# 7. 后端核心模块

建议目录：

```text
backend/
  app/
    api/
    core/
    models/
    schemas/
    services/
      document_service/
      chunk_service/
      embedding_service/
      vector_service/
      rag_service/
      skill_service/
      tool_service/
      agent_service/
      evaluation_service/
    providers/
      llm/
      embedding/
      rerank/
    sandbox/
    experiments/
```

## 7.1 Document Service

职责：

- 文档上传
- 文本抽取
- 文档元数据
- 解析结果

## 7.2 Chunk Service

职责：

- Recursive split
- Token-based split
- Overlap
- Chunk metadata

## 7.3 Embedding Service

职责：

- 单文本 Embedding
- 批量 Embedding
- 缓存
- 模型切换

## 7.4 Vector Service

职责：

- Index
- Search
- Delete
- Rebuild

## 7.5 RAG Service

职责：

```text
query
→ embed
→ retrieve
→ rerank
→ context
→ prompt
→ llm
→ citations
```

必须返回完整 trace，供前端过程观察器使用。

## 7.6 Skill Service

职责：

- Skill 注册
- Skill 编辑
- Skill 列表
- Skill Prompt
- Skill Steps

## 7.7 Tool Service

职责：

- Tool 注册
- 参数 schema
- 执行
- 执行结果
- 安全限制

## 7.8 Agent Service

职责：

- Task Classification
- Plan
- Skill Selection
- Tool Routing
- RAG Retrieval
- Memory
- Run Trace

---

# 8. 数据模型建议

## 8.1 User

```text
id
name
role
class_id
```

## 8.2 ExperimentProject

```text
id
user_id
name
created_at
current_stage
```

## 8.3 Document

```text
id
project_id
filename
type
source
parsed_text
metadata
```

## 8.4 Chunk

```text
id
document_id
text
tokens
chunk_index
metadata
embedding_id
```

## 8.5 KnowledgeBase

```text
id
project_id
name
embedding_model
chunk_size
overlap
vector_store
```

## 8.6 RAGPipeline

```text
id
project_id
knowledge_base_id
top_k
threshold
rerank_enabled
rerank_top_n
prompt_template
```

## 8.7 Skill

```text
id
name
description
input_schema
steps
prompt_template
enabled
```

## 8.8 Tool

```text
id
name
description
input_schema
permission_level
```

## 8.9 Agent

```text
id
project_id
name
rag_pipeline_id
skills
tools
memory_config
agent_prompt
```

## 8.10 RunTrace

```text
id
run_type
project_id
input
steps
retrievals
tool_calls
output
metrics
created_at
```

---

# 9. API 建议

## 文档

```text
POST   /api/documents/upload
GET    /api/documents/{id}
POST   /api/documents/{id}/parse
```

## Chunk

```text
POST   /api/chunks/build
GET    /api/chunks?document_id=...
```

## Knowledge Base

```text
POST   /api/kb
POST   /api/kb/{id}/index
POST   /api/kb/{id}/search
GET    /api/kb/{id}/stats
```

## RAG

```text
POST   /api/rag/run
POST   /api/rag/compare
GET    /api/rag/runs/{id}
```

## Skills

```text
GET    /api/skills
POST   /api/skills
PUT    /api/skills/{id}
```

## Tools

```text
GET    /api/tools
POST   /api/tools/{name}/run
```

## Agent

```text
POST   /api/agents
POST   /api/agents/{id}/run
GET    /api/agents/{id}/runs
```

---

# 10. 安全和沙箱要求

由于平台后续可能包含代码执行和密码实验，第一期必须从架构上做安全隔离。

## 10.1 Python Runner

禁止：

- shell=True
- 任意系统命令
- 任意网络访问
- 任意文件系统访问
- fork bomb
- 无限 CPU / 内存

建议：

- Docker sandbox
- 超时
- CPU / memory limit
- 临时目录
- 白名单 Python 包

第一期若开发周期有限，可以先不开通通用 Python Runner，只实现安全的 calculator 和 crypto_formula_tool。

## 10.2 文件上传

- 限制文件大小
- 限制扩展名
- 隔离保存
- 不直接执行文件

---

# 11. 可观测性要求

所有实验流程必须生成 Trace。

示例 RAG Trace：

```json
{
  "query": "为什么 RSA 不适合直接加密大文件？",
  "embedding": {
    "model": "xxx",
    "dimension": 768
  },
  "retrieval": [
    {"chunk_id": 34, "score": 0.91},
    {"chunk_id": 102, "score": 0.87}
  ],
  "rerank": [34, 102],
  "context_tokens": 1320,
  "answer": "..."
}
```

Agent Trace：

```json
{
  "goal": "比较 AES 和 RSA",
  "plan": [
    "检索 AES",
    "检索 RSA",
    "比较安全性",
    "比较性能",
    "生成建议"
  ],
  "selected_skill": "crypto_compare",
  "tool_calls": [
    {
      "tool": "knowledge_search",
      "status": "success"
    }
  ],
  "status": "completed"
}
```

---

# 12. 测评体系（第一期简化版）

玄知本身具有独立的密码学测评体系，因此本实验平台也不能只看“能不能出答案”。

第一期建议至少测：

## 12.1 Knowledge Base

- 文档数量
- Chunk 数量
- 检索准确率
- 平均检索时延

## 12.2 RAG

- Context Hit Rate
- Citation Coverage
- Answer Similarity
- Human Score

## 12.3 Agent

- Task Completion Rate
- Skill Selection Accuracy
- Tool Success Rate
- Average Steps

最终给学生一个能力画像：

```text
CryptoLLMLab Model

知识库构建       90
RAG 检索         86
专业回答         88
Skill 使用       81
Tool 使用        85
Agent 完成率     79
```

这些分数第一期主要用于教学反馈，不作为严谨科研 Benchmark。

---

# 13. 实验报告机制

每个实验结束后自动生成实验记录。

## 实验一报告

- 文档列表
- Chunk 参数
- Embedding 模型
- Chunk 数
- 检索示例

## 实验二报告

- Base LLM 输出
- RAG 输出
- Top-K
- Rerank
- 引用 Chunk
- 对比评价
- 学生结论

## 实验三报告

- Agent 配置
- Skills
- Tools
- Run Trace
- 任务成功率
- 学生总结

支持：

- Markdown 导出
- JSON 导出

---

# 14. 第一阶段 MVP 范围

Codex 第一轮优先完成真正可运行的 MVP，不要过早实现复杂功能。

## 必须实现

- [ ] 用户进入平台后创建一个实验项目
- [ ] 预置密码学文档
- [ ] 文档解析
- [ ] Chunk 可视化
- [ ] Embedding
- [ ] Vector Search
- [ ] Knowledge Base
- [ ] Base LLM vs RAG 对比
- [ ] RAG Trace
- [ ] 至少 3 个 Crypto Skills
- [ ] 至少 2 个 Tools
- [ ] Single Crypto Agent
- [ ] Agent Trace
- [ ] 简单实验报告

## 第二轮再实现

- [ ] 用户上传 PDF
- [ ] Rerank 模型可切换
- [ ] 二维向量可视化
- [ ] Python Sandbox
- [ ] 教师端
- [ ] 班级管理
- [ ] 自动评分
- [ ] 高级测评

## 暂不实现

- [ ] CPT 真实训练
- [ ] SFT 大规模训练
- [ ] RLHF
- [ ] 多 Agent 协同
- [ ] 自动代码生成复杂密码工程
- [ ] 真实形式化验证工具链

---

# 15. 后续扩展路线

第一期完成后，可沿玄知体系继续扩展。

## Phase 2：密码学高级智能体实验

- MPC Agent
- HE Agent
- DP Agent
- PQC Agent
- TEE Agent
- ABE Agent
- ZKP Agent
- Blockchain Agent

## Phase 3：模型训练实验

采用“小规模可模拟/可运行”的方式：

- Dataset
- Instruction Data
- SFT
- LoRA
- Preference Data
- RLHF 概念模拟

## Phase 4：AI 赋能密码学研究

- 论文知识检索
- 协议比较
- 安全模型分析
- 参数推荐
- 算法设计辅助
- 代码辅助
- 形式化验证
- Benchmark

---

# 16. 推荐 Codex 开发顺序

Codex 不要一次性把所有功能一起写。

建议严格按下面顺序开发：

## Sprint 1：项目骨架

1. 创建前端和后端目录
2. FastAPI + React/Vue 基础通信
3. Project / Document / KB 数据模型
4. 内置密码学示例文档

## Sprint 2：实验一

1. 文档解析
2. Chunk
3. Embedding Provider
4. Vector Store
5. Retrieval
6. UI 可视化

完成后必须能跑通：

```text
AES 文档
→ Chunk
→ Embedding
→ Search
```

## Sprint 3：实验二

1. LLM Provider
2. RAG Pipeline
3. Rerank（可以先 Mock/简单实现）
4. Trace
5. Base vs RAG 页面
6. 引用 Chunk

## Sprint 4：实验三

1. Skill Schema
2. 三个 Crypto Skills
3. knowledge_search tool
4. calculator tool
5. Agent Orchestrator
6. Agent Trace

## Sprint 5：实验报告

1. Run History
2. Metrics
3. Markdown Export
4. UI 收尾

---

# 17. 验收场景

系统至少能完整演示下面三条链路。

## 场景 A：向量知识库

用户选择 AES、RSA、ECC 文档。

配置：

```text
Chunk Size = 512
Overlap = 64
```

输入：

> RSA 为什么不适合直接加密大文件？

系统能够返回多个相关 Chunk 和相似度。

## 场景 B：RAG

输入：

> TrustZone 与 SGX 的隔离机制有什么区别？

系统同时展示 Base LLM 与 Crypto-RAG。

Crypto-RAG 页面必须能展开查看：

- Retrieval
- Rerank
- Context
- Sources

## 场景 C：Agent

输入：

> 我需要在云服务器上处理敏感数据，但希望云平台看不到原始明文。请比较 HE、MPC、TEE 并给出选型建议。

Agent 应：

1. 识别为技术选型任务
2. 选择 crypto_selection
3. 调用 knowledge_search
4. 比较 HE / MPC / TEE
5. 输出结构化建议
6. 展示完整 Run Trace

---

# 18. 最终产品应给学生形成的认知

完成三项实验后，学生应能够明确回答：

1. 密码学领域知识如何被加工成大模型可使用的知识库？
2. Embedding 和向量数据库分别解决什么问题？
3. 为什么 RAG 能提高密码学专业问答的准确性和可解释性？
4. RAG 为什么也会失败？
5. Skill 与 Prompt 有什么关系？
6. Tool 给大模型增加了什么能力？
7. Agent 与普通聊天模型的本质区别是什么？
8. 一个垂域大模型系统为什么不仅仅是“一个训练后的模型”？
9. AI 可以如何进一步赋能密码学研究与教学？

---

# 19. 开发原则总结

Codex 实现过程中应始终遵守以下原则：

1. **密码学是核心领域，不做泛化 Demo。**
2. **三个实验必须连续继承，不做孤立页面。**
3. **过程可视化优先。**
4. **参数可调、允许失败、支持对比。**
5. **不要只做聊天界面。**
6. **RAG 必须可观察 Retrieval / Rerank / Context。**
7. **Agent 必须可观察 Plan / Skill / Tool / Result。**
8. **不展示模型私有思维链。**
9. **模型、Embedding、Rerank、Vector DB 必须做 Provider/Interface 抽象。**
10. **第一期先完成小而完整的 MVP，再扩展高级智能体和训练体系。**
