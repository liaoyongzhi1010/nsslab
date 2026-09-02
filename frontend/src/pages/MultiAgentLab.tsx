import { useState } from "react";
import { Bot, Network, Users } from "lucide-react";
import { api } from "../api";
import { MarkdownAnswer } from "../components/MarkdownAnswer";
import { Metric, Pill } from "../components/UI";
import { ComparePanel, ExperimentHeader, RunBar, WaitState } from "../components/ExperimentShell";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const fallbackTasks: Dict[] = [
  { id: "ma_migration", title: "企业密码迁移方案评审", query: "某银行要把核心系统从 RSA-2048 迁移到后量子密码，请给出完整迁移方案，并从安全、性能、合规三方面评审。" },
  { id: "ma_protocol", title: "安全通信协议设计", query: "为物联网设备设计一个端到端安全通信方案，覆盖密钥交换、数据加密、身份认证，并评估其弱点。" },
];

export function MultiAgentLab() {
  const { bootstrap, project, refreshProject } = useApp();
  const tasks: Dict[] = bootstrap?.multi_agent_tasks?.length ? bootstrap.multi_agent_tasks : fallbackTasks;
  const [taskId, setTaskId] = useState(tasks[0].id);
  const [run, setRun] = useState<Dict | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const task = tasks.find((t) => t.id === taskId) || tasks[0];

  if (!project) return <WaitState>请先在“我的实验项目”中创建或选择一个项目。</WaitState>;

  const execute = async () => {
    setRunning(true); setError("");
    try { const r = await api.runMultiAgentExperiment({ project_id: project.id, task_id: taskId }); setRun(r); await refreshProject(); }
    catch (e) { setError((e as Error).message); } finally { setRunning(false); }
  };

  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 10 · Harness"
      mode="真实"
      title={<>多智能体<span>协同</span></>}
      intro="复杂任务交给单个 Agent 容易顾此失彼。对比单 Agent 独自完成，与规划→专家→审查→汇总多 Agent 分工协作的差异。"
      flowSteps={["复杂任务", "单 Agent 独做", "多 Agent 分工", "交叉审查", "协同交付"]}
      flowActive={running ? 2 : run ? 4 : 0}
    />

    <RunBar running={running} onRun={execute} label="运行 A/B 对比" runningLabel="单 Agent 与多 Agent 团队正在分别作答…">
      <div className="question-label"><Network size={18} /><div><strong>{task.title}</strong><small>真实调用后台大模型，多 Agent 分工需 4-5 次调用，请稍候</small></div></div>
      <div className="tool-question"><MarkdownAnswer>{task.query}</MarkdownAnswer></div>
      <div className="question-chips">{tasks.map((t) => <button className={taskId === t.id ? "active" : ""} key={t.id} disabled={running} onClick={() => { setTaskId(t.id); setRun(null); }}>{t.title}</button>)}</div>
    </RunBar>

    {error && <div className="error-banner">{error}</div>}

    {run && !running && <>
      <ComparePanel
        offLabel={run.off.label}
        onLabel={run.on.label}
        offTone="amber"
        offHead={<><Bot size={14} /> {run.off.provider} · 1 个 Agent 独自完成</>}
        onHead={<><Users size={14} /> {run.on.provider} · {run.on.roles.length} 个 Agent 分工</>}
        offBody={<MarkdownAnswer>{run.off.answer}</MarkdownAnswer>}
        onBody={<div className="agent-roles">{run.on.roles.map((r: Dict) => <details key={r.id} open={r.id === "writer"}><summary style={{ ["--role-color" as string]: r.color }}><i style={{ background: r.color }} /><strong>{r.name}</strong><small>{r.role}</small></summary><div className="role-output"><MarkdownAnswer>{r.output}</MarkdownAnswer></div></details>)}</div>}
      />
      <section className="panel gain-panel">
        <div className="panel-head"><div><span className="step-label">COLLABORATION SCORECARD</span><h2>协同效果</h2><p>{run.diagnosis}</p></div><Pill tone="mint"><Users size={13} /> {run.metrics.multi_agents} Agents</Pill></div>
        <div className="side-metrics tool-metrics">
          <Metric label="单 Agent" value="1 个" tone="amber" />
          <Metric label="多 Agent" value={`${run.metrics.multi_agents} 个`} tone="mint" />
          <Metric label="单 Agent 产出" value={`${run.metrics.single_length} 字`} tone="blue" />
          <Metric label="协同总产出" value={`${run.metrics.multi_length} 字`} tone="purple" />
        </div>
      </section>
    </>}

    {!run && !running && <WaitState>选择一个复杂任务并运行，对比单 Agent 与多 Agent 团队协作的完整性差异。</WaitState>}
  </div>;
}
