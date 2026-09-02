import { useState } from "react";
import { ListChecks, Sparkles, Wand2 } from "lucide-react";
import { api } from "../api";
import { MarkdownAnswer } from "../components/MarkdownAnswer";
import { Metric, Pill } from "../components/UI";
import { ComparePanel, ExperimentHeader, RunBar, WaitState } from "../components/ExperimentShell";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const fallbackTasks: Dict[] = [
  { id: "sk_compare", title: "算法比较", query: "比较 AES 和 SM4 的异同。", skill: "crypto_compare", steps: ["检索两者资料", "对比安全性", "对比性能与生态", "给出选型建议"] },
  { id: "sk_selection", title: "技术选型", query: "我要为一个跨机构联合风控系统选择隐私计算方案，帮我选型。", skill: "crypto_selection", steps: ["澄清需求与约束", "检索候选技术", "评估权衡", "生成推荐方案"] },
  { id: "sk_explain", title: "概念解释", query: "解释什么是零知识证明。", skill: "crypto_explain", steps: ["检索知识", "解释安全基础", "展示工作流程", "总结风险边界"] },
];

export function SkillLab() {
  const { bootstrap, project, refreshProject } = useApp();
  const tasks: Dict[] = bootstrap?.skill_tasks?.length ? bootstrap.skill_tasks : fallbackTasks;
  const [taskId, setTaskId] = useState(tasks[0].id);
  const [run, setRun] = useState<Dict | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const task = tasks.find((t) => t.id === taskId) || tasks[0];

  if (!project) return <WaitState>请先在“我的实验项目”中创建或选择一个项目。</WaitState>;

  const execute = async () => {
    setRunning(true); setError("");
    try { const r = await api.runSkillExperiment({ project_id: project.id, task_id: taskId }); setRun(r); await refreshProject(); }
    catch (e) { setError((e as Error).message); } finally { setRunning(false); }
  };

  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 07 · Harness"
      mode="真实"
      title={<>Skills <span>技能封装</span></>}
      intro="Skill 把专家经验固化成可挂载的结构化流程。同一任务，对比纯 prompt 自由发挥与挂载 Skill 后按既定步骤作答的差异。"
      flowSteps={["用户任务", "纯 prompt 作答", "挂载 Skill 流程", "对比规范度"]}
      flowActive={running ? 1 : run ? 3 : 0}
    />

    <RunBar running={running} onRun={execute} label="运行 A/B 对比" runningLabel="分别以纯 prompt 与 Skill 流程作答…">
      <div className="question-label"><ListChecks size={18} /><div><strong>{task.title}</strong><small>挂载 Skill：{task.skill} · {task.steps.length} 个既定步骤</small></div></div>
      <div className="tool-question"><MarkdownAnswer>{task.query}</MarkdownAnswer></div>
      <div className="skill-steps-preview">{task.steps.map((s: string, i: number) => <span key={s}><b>{i + 1}</b>{s}</span>)}</div>
      <div className="question-chips">{tasks.map((t) => <button className={taskId === t.id ? "active" : ""} key={t.id} disabled={running} onClick={() => { setTaskId(t.id); setRun(null); }}>{t.title}</button>)}</div>
    </RunBar>

    {error && <div className="error-banner">{error}</div>}

    {run && !running && <>
      <ComparePanel
        offLabel={run.off.label}
        onLabel={run.on.label}
        offTone="amber"
        offHead={<><Wand2 size={14} /> {run.off.provider} · 无流程约束</>}
        onHead={<><Sparkles size={14} /> {run.on.provider} · {run.skill.steps.length} 步流程</>}
        offBody={<MarkdownAnswer>{run.off.answer}</MarkdownAnswer>}
        onBody={<MarkdownAnswer>{run.on.answer}</MarkdownAnswer>}
      />
      <section className="panel gain-panel">
        <div className="panel-head"><div><span className="step-label">SKILL SCORECARD</span><h2>技能封装效果</h2><p>{run.diagnosis}</p></div><Pill tone="mint">{run.skill.label}</Pill></div>
        <div className="side-metrics tool-metrics">
          <Metric label="Skill 步骤数" value={run.metrics.skill_steps} tone="mint" />
          <Metric label="纯 prompt 字数" value={run.metrics.off_length} tone="amber" />
          <Metric label="Skill 字数" value={run.metrics.on_length} tone="blue" />
          <Metric label="耗时" value={run.metrics.latency_ms} suffix="ms" tone="purple" />
        </div>
      </section>
    </>}

    {!run && !running && <WaitState>选择一个任务并运行，对比纯 prompt 与挂载 Skill 后的流程规范度差异。</WaitState>}
  </div>;
}
