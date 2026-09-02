import { ExperimentHeader } from "../components/ExperimentShell";

export function RlhfLab() {
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 04 · 模型训练与对齐"
      title={<>偏好对齐 <span>RLHF / DPO</span></>}
      intro="SFT 让模型会答，偏好对齐让模型答得更符合人类偏好、更安全。通过 chosen / rejected 偏好对与奖励打分，对比 DPO 对齐前后的胜率与安全率。"
      flowSteps={["收集偏好对", "奖励模型打分", "DPO 优化", "胜率/安全率提升"]}
      flowActive={0}
    />
  </div>;
}
