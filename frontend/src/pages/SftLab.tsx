import { ExperimentHeader } from "../components/ExperimentShell";
import { AdminExamView } from "../components/AdminExamView";
import { useApp } from "../context/AppContext";

export function SftLab() {
  const { user } = useApp();
  const tag = "实验 03 · 模型训练与对齐";
  const title = <>监督微调 <span>SFT</span></>;
  const intro = "预训练只让模型“会续写”，监督微调用大量指令-回答对教会模型“听懂并遵循指令”。同一条指令，对比未对齐模型与 SFT 对齐模型的回答。";
  if (user?.role === "admin") return <AdminExamView expId="03" tag={tag} title={title} intro={intro} />;
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag={tag}
      title={title}
      intro={intro}
      flowSteps={["用户指令", "未对齐模型", "SFT 对齐模型", "对比遵循度"]}
      flowActive={0}
    />
  </div>;
}
