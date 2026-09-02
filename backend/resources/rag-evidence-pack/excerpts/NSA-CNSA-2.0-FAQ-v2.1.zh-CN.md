# NSA CNSA 2.0 FAQ v2.1：证据摘编

> 适用边界：本资料描述美国 National Security Systems（NSS）的 CNSA 2.0 要求，不应直接外推为所有商业系统的通用合规规则。

## General Purpose Algorithms

- 信息保护：AES-256。
- 密钥建立：ML-KEM-1024，规范为 FIPS 203。
- 数字签名：ML-DSA-87，规范为 FIPS 204。
- 通用哈希：SHA-384 或 SHA-512。

## 迁移节点（FAQ v2.1 所述）

- 2027-01-01 起，新的 NSS 采购原则上要求符合 CNSA 2.0，除非另有说明。
- 2030-12-31 前，不能支持 CNSA 2.0 的设备和服务原则上应完成淘汰。
- 2031-12-31 起，原则上强制使用 CNSA 2.0 算法。
- 总体目标是 2035 年前使全部 NSS 具备量子抗性。

## 容易答错的边界

CNSA 2.0 采用的是标准化后的 ML-KEM 与 ML-DSA；仅标称“CRYSTALS-Kyber”或“CRYSTALS-Dilithium”但不遵循 FIPS 203/204 的实现不因此自动合规。SHA3-384/512 只在 FAQ 指定的内部硬件完整性等受限场景允许，并非通用哈希的默认选项。
