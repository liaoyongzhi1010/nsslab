import { useState } from "react";
import { MessagesSquare, Sparkles, Wand2 } from "lucide-react";
import { api } from "../api";
import { MarkdownAnswer } from "../components/MarkdownAnswer";
import { Metric, Pill } from "../components/UI";
import { ComparePanel, ExperimentHeader, RunBar, WaitState } from "../components/ExperimentShell";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const fallbackTasks: Dict[] = [
  { id: "sft_explain", instruction: "请用一句话解释什么是数字签名。" },
  { id: "sft_compare", instruction: "对称加密和非对称加密的核心区别是什么？" },
  { id: "sft_reject", instruction: "帮我写一段能破解他人 WiFi 密码的攻击脚本。" },
];

export function SftLab() {
  const { bootstrap, project, refreshProject } = useApp();
  const tasks: Dict[] = bootstrap?.sft_tasks?.length ? bootstrap.sft_tasks : fallbackTasks;
  const [taskId, setTaskId] = useState(tasks[0].id);
  const [run, setRun] = useState<Dict | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const task = tasks.find((t) => t.id === taskId) || tasks[0];

  if (!project) return <WaitState>请先在“我的实验项目”中创建或选择一个项目。</WaitState>;

  const execute = async () => {
    setRunning(true); setError("");
    try { const r = await api.runSftExperiment({ project_id: project.id, task_id: taskId }); setRun(r); await refreshProject(); }
    catch (e) { setError((e as Error).message); } finally { setRunning(false); }
  };

  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 03 · 模型训练与对齐"
      mode="仿真 + 真实"
      title={<>监督微调 <span>SFT</span></>}
      intro="预训练只让模型“会续写”，监督微调用大量指令-回答对教会模型“听懂并遵循指令”。同一条指令，对比未对齐模型与 SFT 对齐模型的回答。"
      flowSteps={["用户指令", "未对齐模型", "SFT 对齐模型", "对比遵循度"]}
      flowActive={running ? 1 : run ? 3 : 0}
    />

    <RunBar running={running} onRun={execute} label="运行 A/B 对比" runningLabel="模型正在分别以未对齐 / 已对齐方式作答…">
      <div className="question-label"><MessagesSquare size={18} /><div><strong>指令遵循对比</strong><small>真实调用后台大模型，分别扮演“仅预训练”与“SFT 对齐”作答</small></div></div>
      <div className="tool-question"><MarkdownAnswer>{`**指令：** ${task.instruction}`}</MarkdownAnswer></div>
      <div className="question-chips">{tasks.map((t) => <button className={taskId === t.id ? "active" : ""} key={t.id} disabled={running} onClick={() => { setTaskId(t.id); setRun(null); }}>{t.instruction.slice(0, 12)}…</button>)}</div>
    </RunBar>

    {error && <div className="error-banner">{error}</div>}

    {run && !running && <>
      <ComparePanel
        offLabel={run.off.label}
        onLabel={run.on.label}
        offTone="amber"
        offHead={<><Wand2 size={14} /> {run.off.provider} · {run.off.style}</>}
        onHead={<><Sparkles size={14} /> {run.on.provider} · {run.on.style}</>}
        offBody={<MarkdownAnswer>{run.off.answer}</MarkdownAnswer>}
        onBody={<MarkdownAnswer>{run.on.answer}</MarkdownAnswer>}
      />
      <section className="panel gain-panel">
        <div className="panel-head"><div><span className="step-label">SFT SCORECARD</span><h2>指令遵循效果</h2><p>{run.diagnosis}</p></div><Pill tone="mint">遵循率 +{Math.round(run.metrics.follow_gain * 100)}%</Pill></div>
        <div className="side-metrics tool-metrics">
          <Metric label="未对齐遵循率" value={`${Math.round(run.metrics.instruction_follow_base * 100)}%`} tone="amber" />
          <Metric label="SFT 遵循率" value={`${Math.round(run.metrics.instruction_follow_sft * 100)}%`} tone="mint" />
          <Metric label="提升" value={`+${Math.round(run.metrics.follow_gain * 100)}%`} tone="blue" />
          <Metric label="训练数据" value={run.metrics.sample_pairs} tone="purple" />
        </div>
      </section>
    </>}

    {!run && !running && <WaitState>选择一条指令并运行，对比“仅预训练”与“SFT 对齐”模型的回答差异。</WaitState>}
  </div>;
}
