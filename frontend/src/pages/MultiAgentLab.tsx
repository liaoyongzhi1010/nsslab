import { ExperimentHeader } from "../components/ExperimentShell";

export function MultiAgentLab() {
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 10 · Harness"
      title={<>多智能体<span>协同</span></>}
      intro="复杂任务交给单个 Agent 容易顾此失彼。对比单 Agent 独自完成，与规划→专家→审查→汇总多 Agent 分工协作的差异。"
      flowSteps={["复杂任务", "单 Agent 独做", "多 Agent 分工", "交叉审查", "协同交付"]}
      flowActive={0}
    />
  </div>;
}
