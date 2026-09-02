import { ExperimentHeader } from "../components/ExperimentShell";
import { AdminExamView } from "../components/AdminExamView";
import { useApp } from "../context/AppContext";

export function DataLab() {
  const { user } = useApp();
  const tag = "实验 01 · 数据工程";
  const title = <>密码语料<span>构建与治理</span></>;
  const intro = "模型能力的地基是数据。对比原始杂乱语料与经过去重、清洗、质量过滤、规范化后的高质量数据集，看数据治理如何决定训练质量。";
  if (user?.role === "admin") return <AdminExamView expId="01" tag={tag} title={title} intro={intro} />;
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag={tag}
      title={title}
      intro={intro}
      flowSteps={["原始语料", "去重", "清洗", "质量过滤", "规范化", "高质量数据集"]}
      flowActive={0}
    />
  </div>;
}
