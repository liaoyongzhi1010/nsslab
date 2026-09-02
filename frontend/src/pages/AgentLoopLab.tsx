import { ExperimentHeader } from "../components/ExperimentShell";
import { AdminExamView } from "../components/AdminExamView";
import { useApp } from "../context/AppContext";

export function AgentLoopLab() {
  const { user } = useApp();
  const tag = "实验 09 · Harness";
  const title = <>Agent <span>闭环</span></>;
  const intro = "Agent 从“一问一答”升级为“会规划、能推进”。同一复杂任务，对比单步直答与先规划再执行（Planning + Memory）的差异。";
  if (user?.role === "admin") return <AdminExamView expId="09" tag={tag} title={title} intro={intro} />;
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag={tag}
      title={title}
      intro={intro}
      flowSteps={["复杂任务", "单步直答", "生成计划", "按计划执行", "对比完整度"]}
      flowActive={0}
    />
  </div>;
}
