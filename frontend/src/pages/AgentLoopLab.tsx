import { useState } from "react";
import { Bot, ListTree, Route, Zap } from "lucide-react";
import { api } from "../api";
import { MarkdownAnswer } from "../components/MarkdownAnswer";
import { Metric, Pill } from "../components/UI";
import { ComparePanel, ExperimentHeader, RunBar, WaitState } from "../components/ExperimentShell";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const fallbackTasks: Dict[] = [
  { id: "al_migration", title: "分步迁移规划", query: "帮我规划把一个老系统从 3DES 迁移到 AES-GCM 的完整步骤。" },
  { id: "al_design", title: "多约束方案设计", query: "设计一个满足国密合规、支持国际业务、且要考虑后量子迁移的密钥管理方案。" },
];

export function AgentLoopLab() {
  const { bootstrap, project, refreshProject } = useApp();
  const tasks: Dict[] = bootstrap?.agent_loop_tasks?.length ? bootstrap.agent_loop_tasks : fallbackTasks;
  const [taskId, setTaskId] = useState(tasks[0].id);
  const [run, setRun] = useState<Dict | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const task = tasks.find((t) => t.id === taskId) || tasks[0];

  if (!project) return <WaitState>请先在“我的实验项目”中创建或选择一个项目。</WaitState>;

  const execute = async () => {
    setRunning(true); setError("");
    try { const r = await api.runAgentLoopExperiment({ project_id: project.id, task_id: taskId }); setRun(r); await refreshProject(); }
    catch (e) { setError((e as Error).message); } finally { setRunning(false); }
  };

  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 09 · Harness"
      mode="真实"
      title={<>Agent <span>闭环</span></>}
      intro="Agent 从“一问一答”升级为“会规划、能推进”。同一复杂任务，对比单步直答与先规划再执行（Planning + Memory）的差异。"
      flowSteps={["复杂任务", "单步直答", "生成计划", "按计划执行", "对比完整度"]}
      flowActive={running ? 2 : run ? 4 : 0}
    />

    <RunBar running={running} onRun={execute} label="运行 A/B 对比" runningLabel="分别以单步直答与规划闭环作答…">
      <div className="question-label"><Route size={18} /><div><strong>{task.title}</strong><small>对比单步直答 vs 规划+记忆闭环（真实调用后台大模型）</small></div></div>
      <div className="tool-question"><MarkdownAnswer>{task.query}</MarkdownAnswer></div>
      <div className="question-chips">{tasks.map((t) => <button className={taskId === t.id ? "active" : ""} key={t.id} disabled={running} onClick={() => { setTaskId(t.id); setRun(null); }}>{t.title}</button>)}</div>
    </RunBar>

    {error && <div className="error-banner">{error}</div>}

    {run && !running && <>
      <ComparePanel
        offLabel={run.off.label}
        onLabel={run.on.label}
        offTone="amber"
        offHead={<><Zap size={14} /> {run.off.provider} · 一步到位</>}
        onHead={<><ListTree size={14} /> {run.on.provider} · {run.on.plan.length} 步规划</>}
        offBody={<MarkdownAnswer>{run.off.answer}</MarkdownAnswer>}
        onBody={<><div className="plan-preview"><span className="plan-preview-title"><Route size={13} /> 执行计划</span>{run.on.plan.map((s: string, i: number) => <div className="plan-preview-step" key={i}><b>{i + 1}</b>{s}</div>)}</div><MarkdownAnswer>{run.on.answer}</MarkdownAnswer></>}
      />
      <section className="panel gain-panel">
        <div className="panel-head"><div><span className="step-label">AGENT LOOP SCORECARD</span><h2>规划闭环效果</h2><p>{run.diagnosis}</p></div><Pill tone="mint"><ListTree size={13} /> {run.metrics.plan_steps} 步计划</Pill></div>
        <div className="side-metrics tool-metrics">
          <Metric label="计划步数" value={run.metrics.plan_steps} tone="mint" />
          <Metric label="单步直答字数" value={run.metrics.off_length} tone="amber" />
          <Metric label="规划执行字数" value={run.metrics.on_length} tone="blue" />
          <Metric label="耗时" value={run.metrics.latency_ms} suffix="ms" tone="purple" />
        </div>
      </section>
    </>}

    {!run && !running && <WaitState>选择一个复杂任务并运行，对比单步直答与“先规划再执行”的完整度差异。</WaitState>}
  </div>;
}
