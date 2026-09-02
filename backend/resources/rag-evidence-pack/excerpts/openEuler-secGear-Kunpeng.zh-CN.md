# openEuler secGear：鲲鹏 TEE 开发路径教学摘编

> 资料性质：CryptoLLMLab 根据 openEuler 24.03 LTS SP4 官方开发指南整理。命令、文件名和产物路径容易随版本变化，实验结论必须绑定该文档版本。

## 应用拆分模型

secGear 的 helloworld 示例把主体分为非安全侧 `host/main.c`、安全与非安全侧接口 `helloworld.edl`、安全侧 `enclave/hello.c`。开发者先识别敏感逻辑并放入可信执行环境，通过 EDL 定义边界；代码生成工具生成两侧交互代码，最后对安全侧二进制签名。

## 鲲鹏侧专有文件

示例目录在 enclave 一侧包含 `manifest.txt` 和 `config_cloud.ini`。官方指南把二者列为鲲鹏开发者证书相关文件，并说明需要向华为业务负责人申请开发者证书；获得后放入相应代码目录。这与 SGX 示例中的 `Enclave.config.xml`、`Enclave.lds` 不同。

## ARM 构建与运行

指南给出的 ARM 构建关键参数是 `cmake -DENCLAVE=GP ..`。安装后运行路径为 `/vendor/bin/secgear_helloworld`。x86 示例则先加载 Intel SGX SDK 环境，以 `cmake ..` 构建，并从 `./examples/helloworld/host/secgear_helloworld` 运行。

## 可验证边界

正确说出 TrustZone 或“鲲鹏支持 TEE”仍不等于能复现工程。可复现实验需要同时命中代码分区、EDL、鲲鹏证书文件、`-DENCLAVE=GP` 和实际运行路径，这些细节非常适合衡量 RAG 是否检索到了版本化开发资料。

