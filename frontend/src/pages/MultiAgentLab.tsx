import { ExperimentHeader } from "../components/ExperimentShell";
import { AdminExamView } from "../components/AdminExamView";
import { useApp } from "../context/AppContext";

export function MultiAgentLab() {
  const { user } = useApp();
  const tag = "实验 10 · Harness";
  const title = <>多智能体<span>协同</span></>;
  const intro = "复杂任务交给单个 Agent 容易顾此失彼。对比单 Agent 独自完成，与规划→专家→审查→汇总多 Agent 分工协作的差异。";
  if (user?.role === "admin") return <AdminExamView expId="10" tag={tag} title={title} intro={intro} />;
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag={tag}
      title={title}
      intro={intro}
      flowSteps={["复杂任务", "单 Agent 独做", "多 Agent 分工", "交叉审查", "协同交付"]}
      flowActive={0}
    />
  </div>;
}
