import { ExperimentHeader } from "../components/ExperimentShell";
import { AdminExamView } from "../components/AdminExamView";
import { useApp } from "../context/AppContext";

export function SkillLab() {
  const { user } = useApp();
  const tag = "实验 07 · Harness";
  const title = <>Skills <span>技能封装</span></>;
  const intro = "Skill 把专家经验固化成可挂载的结构化流程。同一任务，对比纯 prompt 自由发挥与挂载 Skill 后按既定步骤作答的差异。";
  if (user?.role === "admin") return <AdminExamView expId="07" tag={tag} title={title} intro={intro} />;
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag={tag}
      title={title}
      intro={intro}
      flowSteps={["用户任务", "纯 prompt 作答", "挂载 Skill 流程", "对比规范度"]}
      flowActive={0}
    />
  </div>;
}
