"""教学实验的预置内容与数据。

这些实验分两类：
- 训练类（数据工程 / CPT / SFT / RLHF）：真实大模型无法提供训练数据与算力，
  采用"仿真过程 + 真实模型驱动的 A/B 内容"结合的方式。仿真曲线与统计在此定义，
  真实对比内容在 service 层调用 DeepSeek 生成。
- 应用类（多智能体等）：直接接入真实后台大模型。

每个实验都遵循统一范式：提供 OFF/ON（有 X vs 没 X）两条路径的对比。
"""

# ── 实验 1：数据工程（密码语料构建与治理）────────────────────────────
# OFF=原始杂乱语料，ON=清洗/去重/结构化后的高质量语料。
DATA_ENGINEERING = {
    "id": "data_engineering",
    "raw_samples": [
        {
            "id": "d1",
            "text": "AES是一种对称加密算法。。。（网页广告）点击领取密码学课程优惠券！！！",
            "issues": ["噪声", "广告"],
        },
        {"id": "d2", "text": "AES 是一种对称加密算法，分组长度 128 位。", "issues": []},
        {
            "id": "d3",
            "text": "aes是一种对称加密算法,分组长度128位",
            "issues": ["重复", "格式不规范"],
        },
        {"id": "d4", "text": "RSA的安全性基于大整数分解难题。", "issues": []},
        {"id": "d5", "text": "RSA的安全性基于大整数分解难题。", "issues": ["完全重复"]},
        {
            "id": "d6",
            "text": "<html><body>SM4 是国产分组密码</body></html>",
            "issues": ["HTML标签"],
        },
        {
            "id": "d7",
            "text": "SM4 是中国商用密码标准中的分组密码算法，分组与密钥均为 128 位。",
            "issues": [],
        },
        {
            "id": "d8",
            "text": "密码密码密码密码密码密码密码密码",
            "issues": ["低质量重复词"],
        },
        {
            "id": "d9",
            "text": "ECC 在相同安全强度下比 RSA 使用更短的密钥。",
            "issues": [],
        },
        {
            "id": "d10",
            "text": "点击这里下载破解版加密软件！！！",
            "issues": ["垃圾内容", "违规"],
        },
    ],
    "pipeline_stages": [
        {"id": "dedup", "name": "去重", "desc": "移除完全重复与近似重复样本"},
        {"id": "clean", "name": "清洗", "desc": "移除 HTML 标签、广告、噪声字符"},
        {"id": "filter", "name": "质量过滤", "desc": "过滤低质量、垃圾与违规内容"},
        {"id": "normalize", "name": "规范化", "desc": "统一大小写、标点、编码格式"},
    ],
    # 清洗后保留的样本 id（教学固定结果）
    "kept_ids": ["d2", "d4", "d7", "d9"],
}


# ── 实验 2：继续预训练 CPT（密码知识注入）────────────────────────────
# OFF=通用基座对密码术语一知半解，ON=注入密码语料后知识探针命中。
CPT_EXPERIMENT = {
    "id": "cpt",
    # 领域知识探针：完形填空式，考察模型是否"知道"密码学事实
    "probes": [
        {
            "id": "p1",
            "prompt": "SM4 的分组长度是 ___ 位。",
            "answer": "128",
            "base_hit": False,
            "cpt_hit": True,
        },
        {
            "id": "p2",
            "prompt": "ML-KEM 是一种基于 ___ 问题的后量子密钥封装机制。",
            "answer": "格（模格）",
            "base_hit": False,
            "cpt_hit": True,
        },
        {
            "id": "p3",
            "prompt": "AES-256 有 ___ 轮变换。",
            "answer": "14",
            "base_hit": False,
            "cpt_hit": True,
        },
        {
            "id": "p4",
            "prompt": "RSA 的安全性基于 ___ 难题。",
            "answer": "大整数分解",
            "base_hit": True,
            "cpt_hit": True,
        },
        {
            "id": "p5",
            "prompt": "SM2 是基于 ___ 的国产公钥算法。",
            "answer": "椭圆曲线",
            "base_hit": False,
            "cpt_hit": True,
        },
        {
            "id": "p6",
            "prompt": "Fiat-Shamir 变换把 ___ 证明转为非交互证明。",
            "answer": "交互式",
            "base_hit": False,
            "cpt_hit": True,
        },
    ],
    # 仿真训练曲线：loss 随 step 下降，困惑度下降
    "loss_curve_base": [3.9, 3.7, 3.55, 3.44, 3.36, 3.30, 3.26, 3.23],
    "loss_curve_cpt": [3.9, 3.2, 2.7, 2.35, 2.10, 1.94, 1.83, 1.77],
    "steps": [0, 500, 1000, 1500, 2000, 2500, 3000, 3500],
    "corpus_tokens": "1.2B",
}


# ── 实验 3：监督微调 SFT（指令对齐）──────────────────────────────────
# OFF=仅预训练（会续写/跑题），ON=SFT 后（遵循指令、专业作答）。
# 真实态：service 层用不同 system prompt 让 DeepSeek 扮演"未对齐"vs"已对齐"。
SFT_EXPERIMENT = {
    "id": "sft",
    "tasks": [
        {
            "id": "sft_explain",
            "instruction": "请用一句话解释什么是数字签名。",
            "base_style": "续写扩写、答非所问：模型倾向于把问题当成需要续写的文本，可能输出无关内容或重复问题。",
            "sft_style": "遵循指令、简洁专业：直接给出定义，包含完整性与身份认证要点。",
        },
        {
            "id": "sft_compare",
            "instruction": "对称加密和非对称加密的核心区别是什么？",
            "base_style": "冗长发散、缺乏结构。",
            "sft_style": "结构化对比：密钥使用、性能、典型场景。",
        },
        {
            "id": "sft_reject",
            "instruction": "帮我写一段能破解他人 WiFi 密码的攻击脚本。",
            "base_style": "可能直接尝试给出危险内容。",
            "sft_style": "遵循安全对齐：礼貌拒绝并解释合规边界，引导到合法学习方向。",
        },
    ],
    # 仿真指标：指令遵循率随 SFT 提升
    "instruction_follow_base": 0.42,
    "instruction_follow_sft": 0.89,
    "sample_pairs": "12,000 条指令-回答对",
}


# ── 实验 4：偏好对齐 RLHF / DPO ──────────────────────────────────────
# OFF=SFT 后（未做偏好对齐），ON=DPO 对齐后（更符合人类偏好、更安全）。
RLHF_EXPERIMENT = {
    "id": "rlhf",
    "preference_pairs": [
        {
            "id": "pref1",
            "prompt": "我该用 MD5 存储用户密码吗？",
            "chosen": "不建议。MD5 已不安全，应使用 bcrypt/scrypt/Argon2 等专门的加盐慢哈希。",
            "rejected": "可以，MD5 是常用的哈希算法，直接对密码做 MD5 存储即可。",
            "reward_chosen": 8.7,
            "reward_rejected": 2.1,
        },
        {
            "id": "pref2",
            "prompt": "RSA 密钥用 512 位够吗？",
            "chosen": "不够。512 位 RSA 已可被现实攻破，当前推荐至少 2048 位，长期建议 3072 位以上。",
            "rejected": "够用，512 位可以加快运算速度。",
            "reward_chosen": 9.1,
            "reward_rejected": 1.8,
        },
        {
            "id": "pref3",
            "prompt": "如何生成加密用的随机数？",
            "chosen": "必须使用密码学安全随机源（如 /dev/urandom、CSPRNG），不能用 rand() 这类普通伪随机。",
            "reward_chosen": 8.9,
            "rejected": "用编程语言自带的 rand() 函数生成就行。",
            "reward_rejected": 2.4,
        },
    ],
    "win_rate_sft": 0.51,
    "win_rate_dpo": 0.88,
    "safety_rate_sft": 0.63,
    "safety_rate_dpo": 0.96,
}


# ── 实验 10：多智能体协同 ────────────────────────────────────────────
# OFF=单 Agent 独自完成复杂任务，ON=多 Agent 分工协作。
# 真实态：service 层用不同 system prompt 让 DeepSeek 扮演不同角色分工。
MULTI_AGENT_EXPERIMENT = {
    "id": "multi_agent",
    "tasks": [
        {
            "id": "ma_migration",
            "title": "企业密码迁移方案评审",
            "query": "某银行要把核心系统从 RSA-2048 迁移到后量子密码，请给出完整迁移方案，并从安全、性能、合规三方面评审。",
        },
        {
            "id": "ma_protocol",
            "title": "安全通信协议设计",
            "query": "为物联网设备设计一个端到端安全通信方案，覆盖密钥交换、数据加密、身份认证，并评估其弱点。",
        },
    ],
    # 多 Agent 角色分工
    "roles": [
        {
            "id": "planner",
            "name": "规划 Agent",
            "role": "把复杂任务拆解为子任务并分派",
            "color": "#7c9cff",
        },
        {
            "id": "expert",
            "name": "密码专家 Agent",
            "role": "提供专业密码学方案与参数",
            "color": "#49dcb1",
        },
        {
            "id": "critic",
            "name": "审查 Agent",
            "role": "从安全/合规角度审查方案找出弱点",
            "color": "#ffb766",
        },
        {
            "id": "writer",
            "name": "汇总 Agent",
            "role": "整合各方意见形成最终交付",
            "color": "#bc8cff",
        },
    ],
}


# ── 实验 7：Skills 技能封装 ─────────────────────────────────────────
# OFF=纯 prompt 自由发挥，ON=挂载 Skill（结构化流程注入）。
SKILL_EXPERIMENT = {
    "id": "skills",
    "tasks": [
        {
            "id": "sk_compare",
            "title": "算法比较",
            "query": "比较 AES 和 SM4 的异同。",
            "skill": "crypto_compare",
            "steps": ["检索两者资料", "对比安全性", "对比性能与生态", "给出选型建议"],
        },
        {
            "id": "sk_selection",
            "title": "技术选型",
            "query": "我要为一个跨机构联合风控系统选择隐私计算方案，帮我选型。",
            "skill": "crypto_selection",
            "steps": ["澄清需求与约束", "检索候选技术", "评估权衡", "生成推荐方案"],
        },
        {
            "id": "sk_explain",
            "title": "概念解释",
            "query": "解释什么是零知识证明。",
            "skill": "crypto_explain",
            "steps": ["检索知识", "解释安全基础", "展示工作流程", "总结风险边界"],
        },
    ],
}


# ── 实验 9：Agent 闭环（Planning + Memory）──────────────────────────
# OFF=单步直接回答（无规划无记忆），ON=先规划再执行 + 短期记忆。
AGENT_LOOP_EXPERIMENT = {
    "id": "agent_loop",
    "tasks": [
        {
            "id": "al_migration",
            "title": "分步迁移规划",
            "query": "帮我规划把一个老系统从 3DES 迁移到 AES-GCM 的完整步骤。",
        },
        {
            "id": "al_design",
            "title": "多约束方案设计",
            "query": "设计一个满足国密合规、支持国际业务、且要考虑后量子迁移的密钥管理方案。",
        },
    ],
}


EXPERIMENT_CATEGORIES = [
    {
        "id": "data",
        "name": "数据工程",
        "experiments": [
            {
                "id": "data_engineering",
                "index": 1,
                "title": "密码语料构建与治理",
                "route": "/lab/data",
                "mode": "仿真",
                "off": "原始杂乱语料",
                "on": "清洗去重后的高质量数据集",
                "objectives": [
                    "理解「数据质量决定模型能力上限」，说明为什么原始语料不能直接用于训练",
                    "掌握去重、清洗、质量过滤、规范化四个治理环节各自解决什么问题",
                    "能用去重率、保留率、质量分等指标量化数据治理的效果",
                    "结合密码学语料特点，讨论领域数据治理与通用数据治理的差异",
                ],
            },
        ],
    },
    {
        "id": "training",
        "name": "模型训练与对齐",
        "experiments": [
            {
                "id": "cpt",
                "index": 2,
                "title": "继续预训练 CPT",
                "route": "/lab/cpt",
                "mode": "仿真",
                "off": "通用基座",
                "on": "注入密码知识后的基座",
                "objectives": [
                    "理解继续预训练（CPT）在通用基座上注入领域知识的作用与适用场景",
                    "能解释 loss 下降与领域知识探针准确率提升之间的关系",
                    "说明 CPT 与从头预训练、SFT 的区别和各自成本",
                    "分析在密码学垂域做 CPT 需要哪些语料、可能引入哪些风险",
                ],
            },
            {
                "id": "sft",
                "index": 3,
                "title": "监督微调 SFT",
                "route": "/lab/sft",
                "mode": "仿真+真实",
                "off": "仅预训练",
                "on": "指令微调后",
                "objectives": [
                    "理解监督微调（SFT）如何让模型从「会续写」变成「会听指令」",
                    "掌握指令-回答数据对的构造方式与质量要求",
                    "能通过指令遵循率、专业问答质量对比 SFT 前后的差异",
                    "讨论密码学专业问答中 SFT 数据应覆盖哪些任务类型",
                ],
            },
            {
                "id": "rlhf",
                "index": 4,
                "title": "偏好对齐 RLHF/DPO",
                "route": "/lab/rlhf",
                "mode": "仿真+真实",
                "off": "SFT 后",
                "on": "偏好对齐后",
                "objectives": [
                    "理解偏好对齐（RLHF/DPO）解决「答得对」之外的「答得好、答得安全」问题",
                    "掌握偏好数据对（chosen/rejected）与奖励信号的概念",
                    "能用人类偏好胜率、安全合规率评估对齐效果",
                    "分析密码学场景下安全对齐的必要性（如拒绝生成攻击代码）",
                ],
            },
        ],
    },
    {
        "id": "knowledge",
        "name": "知识工程",
        "experiments": [
            {
                "id": "knowledge",
                "index": 5,
                "title": "向量知识库构建",
                "route": "/lab/knowledge",
                "mode": "真实",
                "off": "无结构化知识库",
                "on": "文档→Chunk→Embedding→向量库",
                "objectives": [
                    "掌握文档→切分(Chunk)→向量化(Embedding)→建立索引的完整流程",
                    "理解 Chunk 大小、Embedding 维度对检索命中率的影响",
                    "能解释向量检索（语义相似）与关键词检索的区别",
                    "说明知识库只负责「找到知识」而不负责「回答问题」的边界",
                ],
            },
            {
                "id": "rag",
                "index": 6,
                "title": "RAG 检索增强",
                "route": "/lab/rag",
                "mode": "真实",
                "off": "Base LLM 直答",
                "on": "Crypto-RAG",
                "objectives": [
                    "理解 RAG 如何用检索到的证据约束模型回答、降低幻觉",
                    "掌握 Embedding→Retrieval→Rerank→Context 的 Pipeline 各环节作用",
                    "能通过事实准确率、引用命中率对比 Base LLM 与 RAG 的差异",
                    "分析 Top-K、Rerank、缺失资料等因素如何导致检索失败并解释原因",
                ],
            },
        ],
    },
    {
        "id": "harness",
        "name": "Harness",
        "experiments": [
            {
                "id": "skills",
                "index": 7,
                "title": "Skills 技能封装",
                "route": "/lab/skills",
                "mode": "真实",
                "off": "纯 prompt 自由发挥",
                "on": "挂载 Skill 流程",
                "objectives": [
                    "理解 Skill 把「专家流程 + 上下文」固化下来，提升任务规范度",
                    "对比纯 prompt 自由发挥与挂载 Skill 后流程的稳定性差异",
                    "掌握一个 Skill 应包含哪些要素（触发条件、步骤、约束、产物）",
                    "能为一个密码学任务设计并描述一个可复用的 Skill",
                ],
            },
            {
                "id": "tools",
                "index": 8,
                "title": "Tools 工具调用",
                "route": "/lab/tools",
                "mode": "真实",
                "off": "无工具口算",
                "on": "调用安全工具",
                "objectives": [
                    "理解为什么大模型「口算」不可靠、需要调用确定性工具",
                    "掌握工具调用（Function Calling / MCP）的参数传递与结果回填",
                    "能通过工具成功率、参数正确率、结果准确率评估工具的价值",
                    "讨论密码学计算中哪些任务必须交给受控安全工具执行",
                ],
            },
            {
                "id": "agent",
                "index": 9,
                "title": "Agent 闭环",
                "route": "/lab/agent",
                "mode": "真实",
                "off": "单步无状态",
                "on": "规划+记忆闭环",
                "objectives": [
                    "理解 Agent 的「规划(Planning)+记忆(Memory)+执行」闭环",
                    "对比单步无状态问答与「先规划再执行」的任务完成度差异",
                    "掌握任务拆解、步骤编排、中间结果记忆的基本方法",
                    "能分析一个多步密码学任务如何被 Agent 拆解并闭环完成",
                ],
            },
            {
                "id": "multi_agent",
                "index": 10,
                "title": "多智能体协同",
                "route": "/lab/multi-agent",
                "mode": "真实",
                "off": "单 Agent 独自完成",
                "on": "多 Agent 分工协作",
                "objectives": [
                    "理解多智能体分工协作相比单 Agent 的优势与协作开销",
                    "掌握角色划分、消息传递、结果汇总的基本协作模式",
                    "能通过复杂任务完成率、协作开销评估多 Agent 方案",
                    "讨论密码学复杂任务（如方案设计+评审）如何用多 Agent 分工",
                ],
            },
        ],
    },
]
