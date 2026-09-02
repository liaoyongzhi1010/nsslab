from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from typing import Any

from .interfaces import EmbeddingProvider, LLMProvider, RerankProvider


def tokenize(text: str) -> list[str]:
    lowered = text.lower()
    latin = re.findall(r"[a-z][a-z0-9-]{1,}|\d+(?:\.\d+)?", lowered)
    chinese_runs = re.findall(r"[\u4e00-\u9fff]+", lowered)
    cjk: list[str] = []
    for run in chinese_runs:
        cjk.extend(list(run))
        cjk.extend(run[index : index + 2] for index in range(len(run) - 1))
    aliases = {
        "大文件": ["批量数据", "混合加密"],
        "云端": ["服务器", "云平台"],
        "看不到": ["不可见", "机密性"],
        "后量子": ["pqc", "ml-kem"],
    }
    expanded = latin + cjk
    for key, values in aliases.items():
        if key in lowered:
            expanded.extend(values)
    return expanded


class LocalEmbeddingProvider(EmbeddingProvider):
    """零配置、可复现的确定性特征哈希向量。"""

    name = "CryptoHash-128 · 确定性向量"
    dimension = 128

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._one(text) for text in texts]

    def _one(self, text: str) -> list[float]:
        vector = [0.0] * self.dimension
        counts = Counter(tokenize(text))
        for token, frequency in counts.items():
            digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimension
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign * (1.0 + math.log(frequency))
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [round(value / norm, 6) for value in vector]


class LocalRerankProvider(RerankProvider):
    name = "CryptoLexical-Rerank"

    def rerank(self, query: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        query_terms = set(tokenize(query))
        reranked: list[dict[str, Any]] = []
        for item in items:
            candidate_terms = set(
                tokenize(f"{item['document_title']} {item['section']} {item['text']}")
            )
            overlap = len(query_terms & candidate_terms) / max(len(query_terms), 1)
            title_bonus = (
                0.08
                if any(term in item["document_title"].lower() for term in query_terms)
                else 0
            )
            enriched = dict(item)
            enriched["rerank_score"] = round(
                item["score"] * 0.66 + overlap * 0.34 + title_bonus, 4
            )
            reranked.append(enriched)
        return sorted(reranked, key=lambda row: row["rerank_score"], reverse=True)


class LocalLLMProvider(LLMProvider):
    """无 API Key 时的可预测教学生成器，不冒充真实大模型。"""

    name = "CryptoTutor Local"
    is_remote = False
    last_provider_name = name

    def generate(
        self, prompt: str, *, context: list[dict[str, Any]] | None = None
    ) -> str:
        question = prompt.lower()
        grounded = bool(context)
        if "crypto-2026-04" in question or "海岚医疗" in prompt:
            if not grounded:
                return "我不了解该机构的内部资产分级、事件编号与处置手册，无法可靠给出 KMS 批次、验证标签或回滚窗口；请提供指定资料。"
            return (
                "根据课程情境手册，**支付网关为 P0**，**影像归档为 P1**。支付网关使用 **X25519 + ML-KEM-768** 混合密钥建立，"
                "身份签名采用 **ML-DSA-65**。事件处置要求在 **72 小时**内轮换 **KMS-7B** 批次的 KEK，验证证据标记为 **ORCHID-9**；"
                "兼容性回滚最多允许 **30 分钟受控回滚**，之后必须恢复混合握手或停服，不能静默降级。该机构及规则均为教学虚构。"
            )
        if (
            "fips 203" in question
            and "ml-kem-768" in question
            and any(term in question for term in ["字节", "尺寸", "封装密钥"])
        ):
            if not grounded:
                return "ML-KEM-768 是后量子密钥封装参数集，但精确密钥与密文尺寸应查询当前 FIPS 203 原文，不能仅凭模型记忆作合规判断。"
            return (
                "FIPS 203 Table 3 给出的 ML-KEM-768 尺寸为：**封装密钥 1184 字节、解封装密钥 2400 字节、密文 1088 字节、共享秘密 32 字节**。"
                "它是 KEM，用来建立共享秘密，再由对称密码保护业务数据；不用于直接加密大文件。"
            )
        if "cnsa 2.0" in question and all(
            year in question for year in ["2027", "2030", "2031"]
        ):
            if not grounded:
                return "CNSA 2.0 涉及后量子算法与分阶段迁移，但精确参数、日期和适用系统应以指定版本的 NSA 文件为准。"
            return (
                "NSA FAQ v2.1 对 NSS 指定 **ML-KEM-1024** 密钥建立、**ML-DSA-87** 签名，通用哈希为 **SHA-384 或 SHA-512**。"
                "节点是：**2027** 年起新 NSS **采购**原则上须合规；**2030** 年底前**淘汰**不能支持 CNSA 2.0 的设备和服务；"
                "**2031** 年底起原则上**强制**使用。适用范围是美国 National Security Systems（NSS），不应直接外推为所有商业系统规则。"
            )
        if "ir 8545" in question and "hqc" in question:
            if not grounded:
                return "HQC 是后量子密钥建立候选之一；其当前标准状态需要查询 NIST 的最新正式报告。"
            return "NIST IR 8545 选定 **HQC** 作为第四轮**唯一**将被标准化的补充 KEM，用于**补充**而非替代 **ML-KEM**。报告表示标准将被制定，因此它**尚**不能称为已发布的 **FIPS**。"
        if "ir 8610" in question and "九" in prompt:
            if not grounded:
                return "我无法仅凭内置知识可靠确认 2026 年 NIST 附加后量子签名流程的最新候选名单和标准状态，请提供 IR 8610。"
            return (
                "NIST IR 8610 列出的九个第三轮候选是 **FAEST、HAWK、MAYO、MQOM、QR-UOV、SDitH、SNOVA、SQIsign、UOV**。"
                "它们只是进入**第三轮**评估，**不等于已经标准化**。最终入选方案旨在补充 **FIPS 204、FIPS 205、FIPS 186-5** 与 **SP 800-208**。"
            )
        if "ir 8547" in question and "2035" in question:
            if not grounded:
                return "NIST 正在推动 2035 前后的后量子迁移，但不同安全强度、算法类型和文件版本的节点并不相同，应核查原始文件。"
            return (
                "这是 NIST IR 8547 **初始公开草案**的拟议时间线：约 **112-bit** 的量子脆弱算法在 **2030** 年后拟弃用、**2035** 年后拟禁用；"
                "**128-bit** 或以上的量子脆弱公钥算法在 **2035** 年后拟禁用。至少 128-bit 经典安全强度的批准**对称**原语仍可**继续**获批，因此不能说 AES 都要淘汰。"
            )
        if "第45号公告" in prompt and all(
            term in question for term in ["0009", "0010", "0011", "0132"]
        ):
            if not grounded:
                return "这些密码行业标准存在新版实施和旧版废止关系。仅凭模型记忆无法可靠确认具体批次、日期和完整名称，应查询国家密码管理局公告。"
            return (
                "国家密码管理局第 45 号公告发布 **25** 项密码行业标准，均自 **2024 年 6 月 1 日实施**；列出的 **18** 项旧标准也在 **2024 年 6 月 1 日废止**。\n\n"
                "- **GM/T 0009—2023《SM2 密码算法使用规范》**实施，**GM/T 0009—2012**废止。\n"
                "- **GM/T 0010—2023《SM2 密码算法加密签名消息语法规范》**实施，**GM/T 0010—2012**废止。\n"
                "- **GM/T 0011—2023《可信计算 可信密码支撑平台功能与接口规范》**实施，**GM/T 0011—2012**废止。\n"
                "- **GM/T 0132—2023**的名称是**《信息系统密码应用实施指南》**。"
            )
        if all(term in question for term in ["39786", "0115", "0116"]):
            if not grounded:
                return "这三份文件分别涉及密码应用基本要求、测评要求与测评过程，但准确名称和实施日期应以国家标准平台及国家密码管理局公告为准。"
            return (
                "三份文件处在不同角色：**GB/T 39786—2021《信息系统密码应用基本要求》**给出信息系统密码应用的基本要求，"
                "自 **2021 年 10 月 1 日**实施；**GM/T 0115—2021《信息系统密码应用测评要求》**对应测评要求；"
                "**GM/T 0116—2021《信息系统密码应用测评过程指南》**对应测评过程。0115 与 0116 均自 **2022 年 5 月 1 日**实施。"
            )
        if "secgear" in question and all(
            term in question for term in ["host", "edl", "enclave"]
        ):
            if not grounded:
                return "secGear 通过非安全侧与可信侧拆分应用，并提供跨 TEE 的开发接口；具体证书文件、构建参数和产物路径会随平台与版本变化，需要查阅指定版本开发指南。"
            return (
                "openEuler 24.03 LTS SP4 示例分为非安全侧 **host/main.c**、接口 **helloworld.edl** 和安全侧 **enclave/hello.c**。"
                "鲲鹏侧使用 **manifest.txt**、**config_cloud.ini**，开发者证书需向**华为业务负责人**申请；构建关键参数是 "
                "`cmake -DENCLAVE=GP ..`，运行路径为 `/vendor/bin/secgear_helloworld`。x86/SGX 示例使用 "
                "**Enclave.config.xml**、**Enclave.lds**，运行 `./examples/helloworld/host/secgear_helloworld`。"
            )
        if all(term in question for term in ["phytcm", "phycrypto", "phytee"]):
            if not grounded:
                return "飞腾平台包含可信根、密码加速和可信执行环境等不同安全能力；具体产品名称、支持处理器与隔离边界应依据飞腾官方资料核验。"
            return (
                "飞腾官方把能力分为：**PhyTCM/PhyTPCM：硬件可信根**；**PhyCrypto：密码算法加速**；"
                "**PhyTEE/PhyCCA：可信执行环境与机密计算**。官方 TEE 方案实例列出 **FT-2000/4、D2000、S2500**。"
                "在该架构描述中，普通世界不能访问安全世界的**内存、缓存和外围安全硬件**。这是特定方案和型号的证据，"
                "**不能外推到所有飞腾平台**，仍需核查具体芯片、固件和软件栈。"
            )
        if "rsa" in question and any(
            key in question for key in ["1gb", "大文件", "直接加密"]
        ):
            if not grounded:
                return (
                    "RSA 属于非对称加密，计算开销通常高于对称加密，因此一般不直接用来处理大文件。"
                    "工程中常把 RSA 与对称加密组合使用，但具体限制仍需结合填充方式和密钥长度判断。"
                )
            return (
                "RSA 不适合直接加密 1GB 文件，关键不只是“速度慢”：\n\n"
                "1. **明文长度受限**：RSA 一次只能处理小于模数的消息；使用 OAEP 后，可用长度还要扣除填充开销。\n"
                "2. **吞吐成本高**：大整数模幂远慢于 AES 的分组与硬件流水线，切块逐段做 RSA 既慢又易误用。\n"
                "3. **正确方案是混合加密**：随机生成 AES 会话密钥，用 AES-GCM 加密文件；再用 RSA-OAEP 封装会话密钥。\n\n"
                "这样同时获得大数据吞吐、完整性保护和密钥分发能力。"
            )
        if "trustzone" in question and "sgx" in question:
            if not grounded:
                return "TrustZone 和 SGX 都通过硬件隔离保护敏感计算。前者常见于 ARM，后者常见于 Intel 平台，二者适用环境有所不同。"
            return (
                "TrustZone 与 SGX 的隔离边界不同：\n\n"
                "- **TrustZone** 将 SoC 划分为 Secure World 与 Normal World，安全状态可贯穿 CPU、内存控制器和外设，总体边界更像“系统级可信域”。\n"
                "- **SGX** 在普通操作系统进程内创建 enclave。受保护页面由 EPC 管理并具备内存加密与完整性保护，OS/Hypervisor 仍管理资源但不能直接读取 enclave 明文。\n"
                "- **选型**：设备固件、密钥服务和可信外设链路更适合 TrustZone；希望缩小云端应用可信计算基、保护特定用户态代码与数据时可考虑 SGX 类 enclave。\n\n"
                "两者都不能自动消除侧信道、I/O 边界和可信代码漏洞。"
            )
        if all(term in question for term in ["he", "mpc", "tee"]):
            return (
                "三类技术保护边界不同：HE 让服务器直接在密文上计算，隐私强但算子和性能受限；"
                "MPC 由多方交互联合计算，适合互不信任的数据协作方，但通信成本较高；"
                "TEE 依靠硬件隔离在受保护区域处理明文，改造成本低、性能较好，但需要信任硬件与证明链。"
            )
        if "aes" in question and "sm4" in question:
            return (
                "AES 与 SM4 都是 128 位分组的对称密码。AES 支持 128/192/256 位密钥并采用替换-置换网络；"
                "SM4 使用固定 128 位密钥和 32 轮非平衡 Feistel 型迭代结构。二者应结合合规要求、硬件支持和协议生态选用。"
            )
        if grounded and context:
            topics = "、".join(
                dict.fromkeys(item["document_title"] for item in context[:3])
            )
            return (
                f"根据知识库中 {topics} 的资料，可先把问题拆为安全假设、性能开销与部署边界三个方面。"
                "当前检索片段给出了可核查的领域依据；建议优先采用标准化构造，并结合具体威胁模型验证参数与实现。"
            )
        return "这个问题涉及密码学安全假设、算法参数与工程场景。建议先明确攻击者能力和性能约束，再依据标准选择成熟构造。"
