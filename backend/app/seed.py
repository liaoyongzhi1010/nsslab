from app.evidence_seed import EVIDENCE_DOCUMENTS


PRESET_DOCUMENTS = [
    {
        "id": "aes",
        "title": "AES 与混合加密",
        "filename": "AES.md",
        "category": "基础密码学",
        "level": "基础",
        "accent": "#49dcb1",
        "content": """# AES 与混合加密

## 算法概览
AES 是 128 位分组的对称密码，支持 128、192、256 位密钥，对应 10、12、14 轮变换。每轮主要包含字节代换、行移位、列混合和轮密钥加。AES 的安全性不是来自隐藏算法，而是来自密钥空间、轮函数扩散与长期公开分析。

## 工程模式
分组密码不能直接裸用。大文件和网络记录通常采用 AES-GCM 等认证加密模式，同时提供机密性和完整性。Nonce 在同一密钥下不得重复；密钥需来自安全随机源或规范的 KDF，而不是用户口令文本。

## 为什么适合大数据
AES 具有高吞吐、低内存开销，并被现代处理器指令集广泛加速。工程系统通常使用混合加密：随机生成 AES 会话密钥来加密正文，再用 RSA-OAEP、ECIES 类方案或 KEM 封装短小的会话密钥。这样把公钥密码的密钥分发能力与对称密码的数据处理性能结合起来。
""",
    },
    {
        "id": "rsa",
        "title": "RSA 与公钥加密边界",
        "filename": "RSA.md",
        "category": "公钥密码",
        "level": "基础",
        "accent": "#7c9cff",
        "content": """# RSA 与公钥加密边界

## 数学基础
RSA 的经典安全性与大整数分解困难问题相关。公钥包含模数 n 与指数 e，私钥指数 d 满足相应模关系。实际系统必须采用经过标准化的填充：加密通常使用 OAEP，签名通常使用 PSS，不能直接进行教科书式 RSA 运算。

## 消息长度限制
RSA 一次可处理的消息严格小于模数，OAEP 还会占用与哈希长度有关的空间。例如 2048 位 RSA 配合 SHA-256 的 OAEP，单次明文上限只有约 190 字节。把大文件机械切块后逐块 RSA 加密不仅非常慢，还容易破坏消息绑定与完整性语义。

## 混合加密
RSA 适合加密或封装随机生成的短会话密钥，不适合直接处理 1GB 文件。标准工程路径是：生成随机 AES 密钥，以 AES-GCM 加密文件，再使用 RSA-OAEP 加密 AES 密钥。私钥操作还应采用恒定时间实现、CRT 防护与错误处理，降低侧信道和故障攻击风险。
""",
    },
    {
        "id": "ecc",
        "title": "ECC 与数字签名",
        "filename": "ECC.md",
        "category": "公钥密码",
        "level": "进阶",
        "accent": "#bc8cff",
        "content": """# ECC 与数字签名

## 椭圆曲线密码
ECC 在有限域椭圆曲线点群上工作，安全性通常依赖椭圆曲线离散对数问题。与传统 RSA 相比，ECC 在相近安全级别下通常使用更短的密钥和签名，适合带宽与存储受限的场景。

## 密钥交换与签名
ECDH 用于协商共享秘密，输出必须进入 KDF 派生会话密钥。ECDSA、EdDSA 与 SM2 签名用于身份认证与完整性。实现必须验证曲线点、使用安全随机数或确定性 nonce，并避免时间与缓存侧信道。

## 工程注意
曲线与参数必须来自成熟标准；不要自定义曲线。数字签名不提供机密性，签名验证也必须绑定正确的身份、上下文和协议 transcript。
""",
    },
    {
        "id": "sm4",
        "title": "SM4 分组密码",
        "filename": "SM4.md",
        "category": "商用密码",
        "level": "基础",
        "accent": "#ffb766",
        "content": """# SM4 分组密码

SM4 是 128 位分组、128 位密钥的对称分组密码，共 32 轮。轮函数包含非线性 S 盒、循环移位与线性扩散，解密使用逆序轮密钥。SM4 与 AES 的分组长度相同，但密钥规格、轮结构和软硬件生态不同。

SM4 常用于中国商用密码合规场景。实际应用需要结合 GCM、CBC 等规范模式；CBC 还需单独提供消息认证。算法选型不仅比较理论轮数，还应考虑协议标准、实现认证、硬件加速、密钥管理和侧信道防护。
""",
    },
    {
        "id": "tee",
        "title": "TEE：TrustZone 与 SGX",
        "filename": "TEE.md",
        "category": "隐私计算",
        "level": "前沿",
        "accent": "#ff7285",
        "content": """# 可信执行环境 TEE

## TrustZone
ARM TrustZone 通过安全状态把系统划分为 Secure World 与 Normal World。总线、内存控制器和外设可识别安全属性，因此隔离覆盖整个 SoC。安全世界通常运行可信固件、可信 OS 与 TA，边界较大；安全监控器负责世界切换。

## Intel SGX
SGX 在普通用户进程地址空间中创建 enclave，以 EPC 页面保存受保护内容。内存加密引擎在数据离开处理器封装时提供机密性和完整性，操作系统负责调度和页管理但不应直接读取 enclave 明文。远程证明让外部验证者检查 enclave 身份和平台状态。

## 边界与风险
TrustZone 偏向设备/系统级隔离，SGX 偏向应用级 enclave 和较小可信计算基。TEE 中数据会在处理器内以明文参与计算，因此需要信任 CPU 厂商、固件与证明基础设施。二者都需单独治理侧信道、回滚、I/O 泄露和可信代码漏洞。
""",
    },
    {
        "id": "he",
        "title": "同态加密 HE",
        "filename": "HE.md",
        "category": "隐私计算",
        "level": "前沿",
        "accent": "#3bc7f3",
        "content": """# 同态加密 HE

同态加密允许计算方在不知道明文和私钥的情况下对密文执行运算，解密结果对应明文上的计算。BFV/BGV 适合精确的模整数运算；CKKS 通过近似编码支持实数向量与机器学习推理，但需要跟踪缩放和误差。

密文噪声会随运算增长，乘法深度决定参数与是否需要 bootstrapping。HE 几乎不需要数据方在线交互，适合单服务器外包计算，但密文膨胀和计算开销显著，并非任意程序都能直接高效迁移。
""",
    },
    {
        "id": "mpc",
        "title": "多方安全计算 MPC",
        "filename": "MPC.md",
        "category": "隐私计算",
        "level": "前沿",
        "accent": "#f5d05d",
        "content": """# 多方安全计算 MPC

MPC 让多个参与方在不公开各自输入的情况下联合计算函数，只揭示约定输出。常见技术包括秘密分享、混淆电路和不经意传输。安全模型需明确半诚实或恶意对手、腐化阈值及是否允许多数合谋。

MPC 不依赖单一可信硬件，适合跨机构联合统计、风控和隐私求交。代价是参与方需在线交互，网络轮次与通信量可能成为瓶颈；协议选择与预处理对实际性能影响很大。
""",
    },
    {
        "id": "zkp",
        "title": "零知识证明 ZKP",
        "filename": "ZKP.md",
        "category": "密码协议",
        "level": "前沿",
        "accent": "#a9e46c",
        "content": """# 零知识证明 ZKP

零知识证明让证明者在不泄露见证的情况下，使验证者相信某个陈述为真。核心性质是完备性、可靠性和零知识性。交互式 Sigma 协议通常经历承诺、随机挑战和响应；挑战必须不可预测，否则作弊者可能预先构造可通过验证的 transcript。

Fiat-Shamir 变换可在随机预言模型下用哈希派生挑战，构造非交互证明。SNARK、STARK 等系统在证明大小、验证效率、可信设置和抗量子性方面有不同权衡。
""",
    },
    {
        "id": "pqc",
        "title": "后量子密码与 ML-KEM",
        "filename": "PQC.md",
        "category": "后量子密码",
        "level": "前沿",
        "accent": "#ef86df",
        "content": """# 后量子密码 PQC

大规模容错量子计算机会威胁 RSA 与椭圆曲线离散对数体系。后量子密码在经典计算平台上使用被认为能抵抗量子攻击的数学问题。ML-KEM 是基于模格问题的密钥封装机制，通信双方封装和解封装共享密钥，而不是像 RSA 那样直接对消息做幂运算。

PQC 迁移要盘点长期密钥、证书、协议和“现在收集、未来解密”风险。混合密钥交换可以组合传统算法与 PQC，但必须正确组合秘密并防止降级。ML-DSA 是格基数字签名方案，与 ML-KEM 的用途不能混淆。
""",
    },
]

PRESET_DOCUMENTS.extend(EVIDENCE_DOCUMENTS)


SKILLS = [
    {
        "id": "crypto_explain",
        "name": "crypto_explain",
        "label": "概念解释",
        "description": "从安全基础、工作流程和应用边界解释密码学概念",
        "inputs": ["topic", "level"],
        "steps": ["retrieve_knowledge", "explain_security_basis", "show_workflow", "summarize_risks"],
        "enabled": True,
        "color": "#49dcb1",
    },
    {
        "id": "crypto_compare",
        "name": "crypto_compare",
        "label": "算法比较",
        "description": "比较两个密码算法或技术的安全性、效率和适用场景",
        "inputs": ["algorithm_a", "algorithm_b", "scenario"],
        "steps": ["retrieve_both", "compare_security", "compare_performance", "recommend"],
        "enabled": True,
        "color": "#7c9cff",
    },
    {
        "id": "crypto_selection",
        "name": "crypto_selection",
        "label": "技术选型",
        "description": "依据威胁模型、性能约束与部署条件选择密码技术",
        "inputs": ["requirements", "constraints"],
        "steps": ["classify_requirements", "retrieve_candidates", "evaluate_tradeoffs", "generate_recommendation"],
        "enabled": True,
        "color": "#bc8cff",
    },
]


TOOLS = [
    {
        "id": "knowledge_search",
        "name": "knowledge_search",
        "label": "知识检索",
        "description": "调用当前 Crypto Knowledge Base 的向量检索",
        "permission": "只读",
        "enabled": True,
    },
    {
        "id": "calculator",
        "name": "calculator",
        "label": "安全计算器",
        "description": "执行受限的四则运算与吞吐量估算",
        "permission": "安全沙箱",
        "enabled": True,
    },
    {
        "id": "crypto_formula_tool",
        "name": "crypto_formula_tool",
        "label": "密码公式工具",
        "description": "安全执行 GCD、模逆和模幂运算",
        "permission": "白名单",
        "enabled": True,
    },
]
