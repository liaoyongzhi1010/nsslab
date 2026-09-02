import { ExperimentHeader } from "../components/ExperimentShell";

export function CptLab() {
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 02 · 模型训练与对齐"
      title={<>继续预训练 <span>CPT</span></>}
      intro="在通用基座上用密码学语料继续预训练，把领域知识写进模型参数。用知识探针和训练 loss 曲线，对比通用基座与密码 CPT 基座的差异。"
      flowSteps={["通用基座", "加载密码语料", "继续预训练", "loss 下降", "知识探针评估"]}
      flowActive={0}
    />
  </div>;
}
