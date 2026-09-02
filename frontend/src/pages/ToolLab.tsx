import { ShieldCheck } from "lucide-react";
import { Flow, Pill } from "../components/UI";
import { AdminExamView } from "../components/AdminExamView";
import { useApp } from "../context/AppContext";

export function ToolLab() {
  const { bootstrap, user } = useApp();
  const title = <>工具调用：<span>会推理 vs 会执行</span></>;
  const intro = "同一道密码学计算题，对比大模型“无工具调用”与“调用安全工具精确计算”的差异，直观看到工具为智能体带来的可靠执行能力。";
  if (user?.role === "admin") return <AdminExamView expId="08" tag="实验 08 · Harness" title={title} intro={intro} />;

  return <div className="lab-page tool-page">
    <div className="page-title">
      <div><Pill tone="blue">实验 08 · Harness</Pill><h1>{title}</h1><p>{intro}</p></div>
      <div className="page-title-badges"><Pill tone="blue">{bootstrap?.providers?.llm_status?.model || "DeepSeek"}</Pill><Pill tone="mint"><ShieldCheck size={13} /> 白名单安全工具</Pill></div>
    </div>

    <Flow steps={["选择计算题", "PATH A 无工具调用", "PATH B 调用安全工具", "正确性对比", "结论"]} active={0} />
  </div>;
}
