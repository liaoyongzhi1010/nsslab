import { ExperimentHeader } from "../components/ExperimentShell";
import { AdminExamView } from "../components/AdminExamView";
import { useApp } from "../context/AppContext";

export function RlhfLab() {
  const { user } = useApp();
  const tag = "实验 04 · 模型训练与对齐";
  const title = <>偏好对齐 <span>RLHF / DPO</span></>;
  const intro = "SFT 让模型会答，偏好对齐让模型答得更符合人类偏好、更安全。通过 chosen / rejected 偏好对与奖励打分，对比 DPO 对齐前后的胜率与安全率。";
  if (user?.role === "admin") return <AdminExamView expId="04" tag={tag} title={title} intro={intro} />;
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag={tag}
      title={title}
      intro={intro}
      flowSteps={["收集偏好对", "奖励模型打分", "DPO 优化", "胜率/安全率提升"]}
      flowActive={0}
    />
  </div>;
}
