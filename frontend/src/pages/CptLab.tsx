import { ExperimentHeader } from "../components/ExperimentShell";
import { AdminExamView } from "../components/AdminExamView";
import { useApp } from "../context/AppContext";

export function CptLab() {
  const { user } = useApp();
  const tag = "实验 02 · 模型训练与对齐";
  const title = <>继续预训练 <span>CPT</span></>;
  const intro = "在通用基座上用密码学语料继续预训练，把领域知识写进模型参数。用知识探针和训练 loss 曲线，对比通用基座与密码 CPT 基座的差异。";
  if (user?.role === "admin") return <AdminExamView expId="02" tag={tag} title={title} intro={intro} />;
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag={tag}
      title={title}
      intro={intro}
      flowSteps={["通用基座", "加载密码语料", "继续预训练", "loss 下降", "知识探针评估"]}
      flowActive={0}
    />
  </div>;
}
