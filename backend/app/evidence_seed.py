"""Evidence-oriented teaching corpus and deterministic RAG benchmarks."""

from pathlib import Path


EVIDENCE_PACK_ROOT = Path(__file__).resolve().parent.parent / "resources" / "rag-evidence-pack"
EXCERPT_ROOT = EVIDENCE_PACK_ROOT / "excerpts"


def _local_excerpt(filename: str) -> str:
    """Load the frozen classroom copy; fail fast if packaging is incomplete."""
    return (EXCERPT_ROOT / filename).read_text(encoding="utf-8")

EVIDENCE_DOCUMENTS = [
    {
        "id": "nist_fips203", "title": "NIST FIPS 203：ML-KEM 参数与报文尺寸",
        "filename": "NIST-FIPS-203-ML-KEM.md", "category": "权威标准", "level": "证据型", "accent": "#49dcb1",
        "source_type": "NIST 正式标准", "source_title": "FIPS 203, Module-Lattice-Based Key-Encapsulation Mechanism Standard",
        "source_date": "2024-08-13", "source_url": "https://doi.org/10.6028/NIST.FIPS.203",
        "local_original": "originals/NIST-FIPS-203.pdf", "local_excerpt": "excerpts/NIST-FIPS-203-ML-KEM.zh-CN.md",
        "content": _local_excerpt("NIST-FIPS-203-ML-KEM.zh-CN.md"),
    },
    {
        "id": "nist_ir8547", "title": "NIST IR 8547：后量子迁移时间线（初稿）",
        "filename": "NIST-IR-8547-Transition-Draft.md", "category": "迁移指南", "level": "证据型", "accent": "#7c9cff",
        "source_type": "NIST 初始公开草案", "source_title": "NIST IR 8547 ipd, Transition to Post-Quantum Cryptography Standards",
        "source_date": "2024-11-12", "source_url": "https://doi.org/10.6028/NIST.IR.8547.ipd",
        "local_original": "originals/NIST-IR-8547-ipd.pdf", "local_excerpt": "excerpts/NIST-IR-8547-Transition-Draft.zh-CN.md",
        "content": _local_excerpt("NIST-IR-8547-Transition-Draft.zh-CN.md"),
    },
    {
        "id": "nsa_cnsa20", "title": "NSA CNSA 2.0 FAQ v2.1：算法套件与期限",
        "filename": "NSA-CNSA-2.0-FAQ-v2.1.md", "category": "政策资料", "level": "证据型", "accent": "#ffb766",
        "source_type": "NSA 官方 FAQ", "source_title": "Commercial National Security Algorithm Suite 2.0 and Quantum Computing FAQ, v2.1",
        "source_date": "2024-12", "source_url": "https://media.defense.gov/2022/Sep/07/2003071836/-1/-1/0/CSI_CNSA_2.0_FAQ_.PDF",
        "local_original": "originals/NSA-CNSA-2.0-FAQ-v2.1.pdf", "local_excerpt": "excerpts/NSA-CNSA-2.0-FAQ-v2.1.zh-CN.md",
        "content": _local_excerpt("NSA-CNSA-2.0-FAQ-v2.1.zh-CN.md"),
    },
    {
        "id": "nist_hqc_2025", "title": "NIST IR 8545：HQC 入选补充 KEM",
        "filename": "NIST-IR-8545-HQC.md", "category": "最新进展", "level": "证据型", "accent": "#bc8cff",
        "source_type": "NIST 最终报告", "source_title": "NIST IR 8545, Status Report on the Fourth Round of the NIST PQC Standardization Process",
        "source_date": "2025-03-11", "source_url": "https://doi.org/10.6028/NIST.IR.8545",
        "local_original": "originals/NIST-IR-8545.pdf", "local_excerpt": "excerpts/NIST-IR-8545-HQC.zh-CN.md",
        "content": _local_excerpt("NIST-IR-8545-HQC.zh-CN.md"),
    },
    {
        "id": "nist_ir8610_2026", "title": "NIST IR 8610：附加 PQC 签名第三轮候选",
        "filename": "NIST-IR-8610-Additional-Signatures.md", "category": "2026 最新进展", "level": "证据型", "accent": "#3bc7f3",
        "source_type": "NIST 最终报告", "source_title": "NIST IR 8610, Status Report on the Second Round of the Additional Digital Signature Schemes",
        "source_date": "2026-05-14", "source_url": "https://doi.org/10.6028/NIST.IR.8610",
        "local_original": "originals/NIST-IR-8610.pdf", "local_excerpt": "excerpts/NIST-IR-8610-Additional-Signatures.zh-CN.md",
        "content": _local_excerpt("NIST-IR-8610-Additional-Signatures.zh-CN.md"),
    },
    {
        "id": "hailan_crypto_manual", "title": "海岚医疗密码迁移与事件处置手册 v3.2（课程情境）",
        "filename": "Hailan-Crypto-Manual-v3.2.md", "category": "课程专属资料", "level": "私域证据", "accent": "#ff7285",
        "source_type": "虚构教学情境", "source_title": "CryptoLLMLab 课程专属案例，不代表任何真实机构政策",
        "source_date": "2026-07-15", "scenario_notice": "本文中的机构、事件、编号和制度均为教学虚构。",
        "local_excerpt": "excerpts/Hailan-Crypto-Manual-v3.2.zh-CN.md",
        "content": _local_excerpt("Hailan-Crypto-Manual-v3.2.zh-CN.md"),
    },
    {
        "id": "cn_sm3_gbt32905", "title": "GB/T 32905—2016：SM3 密码杂凑算法",
        "filename": "GBT-32905-2016-SM3.md", "category": "国产商密标准", "level": "国家标准", "accent": "#d89a5b",
        "source_type": "国家标准（现行）", "source_title": "GB/T 32905—2016 信息安全技术 SM3 密码杂凑算法",
        "source_date": "2016-08-29", "source_url": "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=45B1A67F20F3BF339211C391E9278F5E",
        "local_original": "originals/GBT-32905-2016-SM3.pdf", "local_excerpt": "excerpts/GBT-32905-2016-SM3.zh-CN.md",
        "content": _local_excerpt("GBT-32905-2016-SM3.zh-CN.md"),
    },
    {
        "id": "cn_sm4_gbt32907", "title": "GB/T 32907—2016：SM4 分组密码算法",
        "filename": "GBT-32907-2016-SM4.md", "category": "国产商密标准", "level": "国家标准", "accent": "#e5ad55",
        "source_type": "国家标准（现行）", "source_title": "GB/T 32907—2016 信息安全技术 SM4 分组密码算法",
        "source_date": "2016-08-29", "source_url": "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=7803DE42D3BC5E80B0C3E5D8E873D56A",
        "local_original": "originals/GBT-32907-2016-SM4.pdf", "local_excerpt": "excerpts/GBT-32907-2016-SM4.zh-CN.md",
        "content": _local_excerpt("GBT-32907-2016-SM4.zh-CN.md"),
    },
    {
        "id": "cn_sm2_gbt35276", "title": "GB/T 35276—2017：SM2 密码算法使用规范",
        "filename": "GBT-35276-2017-SM2-Usage.md", "category": "国产商密标准", "level": "国家标准", "accent": "#d78070",
        "source_type": "国家标准（现行）", "source_title": "GB/T 35276—2017 信息安全技术 SM2 密码算法使用规范",
        "source_date": "2017-12-29", "source_url": "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=2127A9F19CB5D7F20D17D334ECA63EE5",
        "local_original": "originals/GBT-35276-2017-SM2-Usage.pdf", "local_excerpt": "excerpts/GBT-35276-2017-SM2-Usage.zh-CN.md",
        "content": _local_excerpt("GBT-35276-2017-SM2-Usage.zh-CN.md"),
    },
    {
        "id": "cn_crypto_baseline_gbt39786", "title": "GB/T 39786—2021：信息系统密码应用基本要求",
        "filename": "GBT-39786-2021-Crypto-Application.md", "category": "行业密码规范", "level": "合规基线", "accent": "#cf7272",
        "source_type": "国家标准（现行）", "source_title": "GB/T 39786—2021 信息安全技术 信息系统密码应用基本要求",
        "source_date": "2021-03-09", "source_url": "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=53282C88712CE157043B7A2C590278FC",
        "local_original": "originals/GBT-39786-2021-Crypto-Application.pdf", "local_excerpt": "excerpts/GBT-39786-2021-Crypto-Application.zh-CN.md",
        "content": _local_excerpt("GBT-39786-2021-Crypto-Application.zh-CN.md"),
    },
    {
        "id": "gmit_2023_revision", "title": "国家密码管理局第 45 号公告：2023 版行业标准",
        "filename": "SCA-GMT-2023-Revision.md", "category": "行业密码规范", "level": "版本证据", "accent": "#ff866f",
        "source_type": "国家密码管理局官方公告", "source_title": "国家密码管理局公告（第45号）",
        "source_date": "2023-12-23", "source_url": "https://www.sca.gov.cn/sca/xxgk/2023-12/23/content_1061160.shtml",
        "local_original": "originals/SCA-Announcement-45-2023.html.txt", "local_excerpt": "excerpts/SCA-GMT-2023-Revision.zh-CN.md",
        "content": _local_excerpt("SCA-GMT-2023-Revision.zh-CN.md"),
    },
    {
        "id": "gmit_eval_2021", "title": "GM/T 0115/0116—2021：密码应用测评文件",
        "filename": "SCA-GMT-0115-0116-2021.md", "category": "行业密码规范", "level": "测评证据", "accent": "#dd709d",
        "source_type": "国家密码管理局官方公告", "source_title": "国家密码管理局公告（第43号）",
        "source_date": "2021-10-19", "source_url": "https://www.sca.gov.cn/sca/xxgk/2021-10/19/content_1060880.shtml",
        "local_original": "originals/SCA-Announcement-43-2021.html.txt", "local_excerpt": "excerpts/SCA-GMT-0115-0116-2021.zh-CN.md",
        "content": _local_excerpt("SCA-GMT-0115-0116-2021.zh-CN.md"),
    },
    {
        "id": "kunpeng_secgear_dev", "title": "openEuler secGear：鲲鹏 TEE 开发路径",
        "filename": "openEuler-secGear-Kunpeng.md", "category": "国产平台 TEE", "level": "工程实操", "accent": "#4db9cb",
        "source_type": "openEuler 官方开发指南", "source_title": "secGear 开发指南（openEuler 24.03 LTS SP4）",
        "source_date": "2026-08-15 同步", "source_url": "https://docs.openeuler.org/zh/docs/24.03_LTS_SP4/server/secgear/developer_guide.html",
        "local_original": "originals/openEuler-secGear-Kunpeng-Developer-Guide.html.txt", "local_excerpt": "excerpts/openEuler-secGear-Kunpeng.zh-CN.md",
        "content": _local_excerpt("openEuler-secGear-Kunpeng.zh-CN.md"),
    },
    {
        "id": "kunpeng_secgear_attestation", "title": "openEuler secGear：统一远程证明",
        "filename": "openEuler-secGear-Attestation.md", "category": "国产平台 TEE", "level": "远程证明", "accent": "#53a8df",
        "source_type": "openEuler 官方代码仓资料", "source_title": "secGear Unified Attestation Service README",
        "source_date": "2026-08-15 同步", "source_url": "https://gitee.com/openeuler/secGear/blob/master/service/attestation/README.md",
        "local_original": "originals/openEuler-secGear-Attestation.md", "local_excerpt": "excerpts/openEuler-secGear-Attestation.zh-CN.md",
        "content": _local_excerpt("openEuler-secGear-Attestation.zh-CN.md"),
    },
    {
        "id": "phytium_phytee_platform", "title": "飞腾安全平台：PhyTCM、PhyCrypto 与 PhyTEE",
        "filename": "Phytium-PhyTEE-Platform.md", "category": "国产平台 TEE", "level": "平台能力", "accent": "#8b9ce8",
        "source_type": "飞腾官方开发者资料", "source_title": "飞腾开发者平台：安全",
        "source_date": "2026-08-15 同步", "source_url": "https://www.phytium.com.cn/developer/8/",
        "local_original": "originals/Phytium-PhyTEE-Developer-Page.html.txt", "local_excerpt": "excerpts/Phytium-PhyTEE-Platform.zh-CN.md",
        "content": _local_excerpt("Phytium-PhyTEE-Platform.zh-CN.md"),
    },
    {
        "id": "phytium_tee_architecture", "title": "飞腾 TEE/PSPA 架构与产品实例",
        "filename": "Phytium-TEE-Architecture.md", "category": "国产平台 TEE", "level": "架构证据", "accent": "#aa8de5",
        "source_type": "飞腾官方白皮书与方案", "source_title": "飞腾端到云全栈解决方案白皮书 2.0 / TEE 方案页",
        "source_date": "2026-08-15 同步", "source_url": "https://www.phytium.com.cn/solution/detail/?id=110",
        "local_original": "originals/Phytium-End-to-Cloud-Whitepaper-2.0.pdf", "local_excerpt": "excerpts/Phytium-TEE-Architecture.zh-CN.md",
        "content": _local_excerpt("Phytium-TEE-Architecture.zh-CN.md"),
    },
]


RAG_BENCHMARKS = [
    {
        "id": "private_incident", "label": "私域制度（效果最明显）", "kind": "PRIVATE",
        "question": "依据《海岚医疗密码迁移与事件处置手册 v3.2》，事件 CRYPTO-2026-04 中：支付网关与影像归档各属什么级别？支付网关采用哪些算法参数？KMS 批次、轮换时限、验证标签和受控回滚窗口分别是什么？",
        "document_ids": ["hailan_crypto_manual"],
        "facts": [
            {"id": "asset_levels", "label": "资产级别 P0 / P1", "tokens": ["p0", "p1"]},
            {"id": "kem", "label": "X25519 + ML-KEM-768", "tokens": ["x25519", "ml-kem-768"]},
            {"id": "signature", "label": "ML-DSA-65", "tokens": ["ml-dsa-65"]},
            {"id": "kms", "label": "KMS-7B / 72 小时", "tokens": ["kms-7b", "72"]},
            {"id": "evidence", "label": "ORCHID-9", "tokens": ["orchid-9"]},
            {"id": "rollback", "label": "30 分钟受控回滚", "tokens": ["30", "回滚"]},
        ],
    },
    {
        "id": "fips203_sizes", "label": "精确参数（FIPS 203）", "kind": "STANDARD",
        "question": "严格依据 NIST FIPS 203，列出 ML-KEM-768 的封装密钥、解封装密钥、密文和共享秘密的字节数，并说明它是否用于直接加密大文件。",
        "document_ids": ["nist_fips203"],
        "facts": [
            {"id": "ek", "label": "封装密钥 1184 bytes", "tokens": ["1184"]},
            {"id": "dk", "label": "解封装密钥 2400 bytes", "tokens": ["2400"]},
            {"id": "ct", "label": "密文 1088 bytes", "tokens": ["1088"]},
            {"id": "ss", "label": "共享秘密 32 bytes", "tokens": ["32"]},
            {"id": "scope", "label": "KEM 建立共享秘密", "tokens": ["共享", "秘密"]},
        ],
    },
    {
        "id": "cnsa_timeline", "label": "版本化政策（CNSA 2.0）", "kind": "POLICY",
        "question": "依据 NSA CNSA 2.0 FAQ v2.1，给出通用密钥建立、签名和哈希的指定参数，并列出 2027、2030、2031 三个迁移节点。说明适用范围。",
        "document_ids": ["nsa_cnsa20"],
        "facts": [
            {"id": "algorithms", "label": "ML-KEM-1024 / ML-DSA-87", "tokens": ["ml-kem-1024", "ml-dsa-87"]},
            {"id": "hash", "label": "SHA-384 或 SHA-512", "tokens": ["sha-384", "sha-512"]},
            {"id": "2027", "label": "2027 新采购", "tokens": ["2027", "采购"]},
            {"id": "2030", "label": "2030 淘汰不支持设备", "tokens": ["2030", "淘汰"]},
            {"id": "2031", "label": "2031 强制使用", "tokens": ["2031", "强制"]},
            {"id": "scope", "label": "适用于 NSS", "tokens": ["nss"]},
        ],
    },
    {
        "id": "hqc_status", "label": "最新进展（HQC）", "kind": "CURRENT",
        "question": "根据 NIST IR 8545，第四轮唯一将被标准化的补充密钥建立算法是什么？它是否已经替代 ML-KEM，是否可以直接称为已发布 FIPS？",
        "document_ids": ["nist_hqc_2025"],
        "facts": [
            {"id": "hqc", "label": "HQC", "tokens": ["hqc"]},
            {"id": "only", "label": "第四轮唯一入选", "tokens": ["唯一"]},
            {"id": "supplement", "label": "补充而非替代 ML-KEM", "tokens": ["补充", "ml-kem"]},
            {"id": "status", "label": "尚非已发布 FIPS", "tokens": ["尚", "fips"]},
        ],
    },
    {
        "id": "nist_signatures_2026", "label": "2026 最新进展（IR 8610）", "kind": "CURRENT",
        "question": "严格依据 NIST IR 8610，列出进入附加后量子数字签名第三轮的全部九个候选。这个结果是否代表九个算法已经标准化？最终入选方案旨在补充哪些已发布标准？",
        "document_ids": ["nist_ir8610_2026"],
        "facts": [
            {"id": "first_three", "label": "FAEST / HAWK / MAYO", "tokens": ["faest", "hawk", "mayo"]},
            {"id": "middle_three", "label": "MQOM / QR-UOV / SDitH", "tokens": ["mqom", "qr-uov", "sdith"]},
            {"id": "last_three", "label": "SNOVA / SQIsign / UOV", "tokens": ["snova", "sqisign", "uov"]},
            {"id": "status", "label": "仅进入第三轮，不等于标准化", "tokens": ["第三轮", "不等于", "标准化"]},
            {"id": "portfolio", "label": "补充 FIPS 204/205/186-5 与 SP 800-208", "tokens": ["fips 204", "fips 205", "fips 186-5", "sp 800-208"]},
        ],
    },
    {
        "id": "nist_transition", "label": "草案边界（IR 8547）", "kind": "DRAFT",
        "question": "依据 NIST IR 8547 初始公开草案，112-bit 与 128-bit 以上量子脆弱算法的拟议迁移节点是什么？AES 是否都要在 2035 年淘汰？回答时必须说明文件状态。",
        "document_ids": ["nist_ir8547"],
        "facts": [
            {"id": "draft", "label": "初始公开草案", "tokens": ["草案"]},
            {"id": "112", "label": "112-bit：2030 弃用 / 2035 禁用", "tokens": ["112", "2030", "2035"]},
            {"id": "128", "label": "128-bit+：2035 禁用", "tokens": ["128", "2035"]},
            {"id": "aes", "label": "至少 128-bit 对称原语可继续", "tokens": ["对称", "继续"]},
        ],
    },
    {
        "id": "gmt_2023_revision", "label": "现行版本（GM/T 2023）", "kind": "DOMESTIC",
        "question": "严格依据国家密码管理局第45号公告：25项标准何时实施、18项旧标准何时废止？分别说明 GM/T 0009、0010、0011 的 2023 版名称及被废止旧版，并给出 GM/T 0132—2023 的名称。",
        "document_ids": ["gmit_2023_revision"],
        "facts": [
            {"id": "date", "label": "2024-06-01 同日实施与废止", "tokens": ["2024", "6 月 1 日", "实施", "废止"]},
            {"id": "counts", "label": "25 项新标准 / 18 项旧标准", "tokens": ["25", "18"]},
            {"id": "sm2", "label": "0009—2023 / 0009—2012", "tokens": ["0009", "sm2", "2012"]},
            {"id": "syntax", "label": "0010 加密签名消息语法", "tokens": ["0010", "加密签名消息语法", "2012"]},
            {"id": "trusted", "label": "0011 可信密码支撑平台", "tokens": ["0011", "可信密码支撑平台", "2012"]},
            {"id": "guide", "label": "0132 信息系统密码应用实施指南", "tokens": ["0132", "信息系统密码应用实施指南"]},
        ],
    },
    {
        "id": "gmit_eval_stack", "label": "密评文件角色（39786/0115/0116）", "kind": "DOMESTIC",
        "question": "依据本地官方资料，区分 GB/T 39786—2021、GM/T 0115—2021、GM/T 0116—2021 的文件名称和角色，并给出 GB/T 39786 的实施日期以及 0115/0116 的共同实施日期。",
        "document_ids": ["cn_crypto_baseline_gbt39786", "gmit_eval_2021"],
        "facts": [
            {"id": "baseline", "label": "39786 信息系统密码应用基本要求", "tokens": ["39786", "信息系统密码应用基本要求"]},
            {"id": "baseline_date", "label": "39786 于 2021-10-01 实施", "tokens": ["2021", "10 月 1 日"]},
            {"id": "evaluation", "label": "0115 信息系统密码应用测评要求", "tokens": ["0115", "信息系统密码应用测评要求"]},
            {"id": "process", "label": "0116 信息系统密码应用测评过程指南", "tokens": ["0116", "信息系统密码应用测评过程指南"]},
            {"id": "gmit_date", "label": "0115/0116 于 2022-05-01 实施", "tokens": ["2022", "5 月 1 日"]},
        ],
    },
    {
        "id": "kunpeng_secgear_build", "label": "鲲鹏开发细节（secGear）", "kind": "TEE",
        "question": "严格依据 openEuler 24.03 LTS SP4 secGear 开发指南：helloworld 如何划分 host、EDL 和 enclave？鲲鹏侧需要哪两个配置/证书文件、证书如何取得、CMake 参数和运行路径是什么？再指出 x86 示例的不同文件或运行路径。",
        "document_ids": ["kunpeng_secgear_dev"],
        "facts": [
            {"id": "split", "label": "main.c / helloworld.edl / hello.c", "tokens": ["main.c", "helloworld.edl", "hello.c"]},
            {"id": "files", "label": "manifest.txt / config_cloud.ini", "tokens": ["manifest.txt", "config_cloud.ini"]},
            {"id": "certificate", "label": "向华为业务负责人申请开发者证书", "tokens": ["华为业务负责人", "开发者证书"]},
            {"id": "cmake", "label": "cmake -DENCLAVE=GP", "tokens": ["-denclave=gp"]},
            {"id": "arm_path", "label": "/vendor/bin/secgear_helloworld", "tokens": ["/vendor/bin/secgear_helloworld"]},
            {"id": "x86", "label": "SGX 文件与 x86 运行路径", "tokens": ["enclave.config.xml", "enclave.lds", "./examples/helloworld/host/secgear_helloworld"]},
        ],
    },
    {
        "id": "phytium_security_stack", "label": "飞腾安全栈边界（PhyTEE）", "kind": "TEE",
        "question": "依据飞腾官方资料，分别说明 PhyTCM/PhyTPCM、PhyCrypto、PhyTEE/PhyCCA 的作用；列出官方 TEE 方案中的三个 CPU 型号，并说明普通世界不能访问安全世界的哪些资源。回答还要指出该方案能否外推到所有飞腾平台。",
        "document_ids": ["phytium_phytee_platform", "phytium_tee_architecture"],
        "facts": [
            {"id": "trust", "label": "PhyTCM/PhyTPCM：硬件可信根", "tokens": ["phytcm", "phytpcm", "硬件可信根"]},
            {"id": "crypto", "label": "PhyCrypto：密码算法加速", "tokens": ["phycrypto", "密码算法加速"]},
            {"id": "tee", "label": "PhyTEE/PhyCCA：TEE 与机密计算", "tokens": ["phytee", "phycca", "机密计算"]},
            {"id": "cpus", "label": "FT-2000/4 / D2000 / S2500", "tokens": ["ft-2000/4", "d2000", "s2500"]},
            {"id": "isolation", "label": "内存、缓存和外围安全硬件隔离", "tokens": ["内存", "缓存", "外围安全硬件"]},
            {"id": "scope", "label": "不能外推至所有平台", "tokens": ["不能", "所有飞腾"]},
        ],
    },
]
