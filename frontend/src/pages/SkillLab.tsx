import { ExperimentHeader } from "../components/ExperimentShell";

export function SkillLab() {
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 07 · Harness"
      title={<>Skills <span>技能封装</span></>}
      intro="Skill 把专家经验固化成可挂载的结构化流程。同一任务，对比纯 prompt 自由发挥与挂载 Skill 后按既定步骤作答的差异。"
      flowSteps={["用户任务", "纯 prompt 作答", "挂载 Skill 流程", "对比规范度"]}
      flowActive={0}
    />
  </div>;
}
