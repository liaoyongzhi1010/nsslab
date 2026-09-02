import { ExperimentHeader } from "../components/ExperimentShell";

export function AgentLoopLab() {
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 09 · Harness"
      title={<>Agent <span>闭环</span></>}
      intro="Agent 从“一问一答”升级为“会规划、能推进”。同一复杂任务，对比单步直答与先规划再执行（Planning + Memory）的差异。"
      flowSteps={["复杂任务", "单步直答", "生成计划", "按计划执行", "对比完整度"]}
      flowActive={0}
    />
  </div>;
}
