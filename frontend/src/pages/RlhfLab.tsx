import { useState } from "react";
import { Check, Scale, ShieldCheck, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { api } from "../api";
import { Metric, Pill } from "../components/UI";
import { ExperimentHeader, RunBar, WaitState } from "../components/ExperimentShell";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

export function RlhfLab() {
  const { project, refreshProject } = useApp();
  const [run, setRun] = useState<Dict | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  if (!project) return <WaitState>请先在“我的实验项目”中创建或选择一个项目。</WaitState>;

  const execute = async () => {
    setRunning(true); setError("");
    try { const r = await api.runRlhfExperiment({ project_id: project.id }); setRun(r); await refreshProject(); }
    catch (e) { setError((e as Error).message); } finally { setRunning(false); }
  };

  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 04 · 模型训练与对齐"
      mode="仿真"
      title={<>偏好对齐 <span>RLHF / DPO</span></>}
      intro="SFT 让模型会答，偏好对齐让模型答得更符合人类偏好、更安全。通过 chosen / rejected 偏好对与奖励打分，对比 DPO 对齐前后的胜率与安全率。"
      flowSteps={["收集偏好对", "奖励模型打分", "DPO 优化", "胜率/安全率提升"]}
      flowActive={running ? 2 : run ? 3 : 0}
    />

    <RunBar running={running} onRun={execute} label="运行偏好对齐" runningLabel="正在进行偏好对齐…">
      <div className="question-label"><Scale size={18} /><div><strong>人类偏好对齐</strong><small>用 chosen / rejected 偏好对训练奖励模型，DPO 优化策略</small></div></div>
    </RunBar>

    {error && <div className="error-banner">{error}</div>}

    {run && !running && <>
      <section className="panel">
        <div className="panel-head"><div><span className="step-label">PREFERENCE PAIRS</span><h2>偏好对与奖励打分</h2><p>每对 (prompt, chosen, rejected) 由奖励模型打分，DPO 拉高 chosen 概率、压低 rejected。</p></div><Pill tone="mint">奖励差 +{run.metrics.reward_margin}</Pill></div>
        <div className="pref-list">
          {run.preference_pairs.map((p: Dict) => <div className="pref-pair" key={p.id}>
            <div className="pref-prompt">{p.prompt}</div>
            <div className="pref-options">
              <div className="pref-chosen"><div className="pref-tag"><ThumbsUp size={13} /> Chosen · 奖励 {p.reward_chosen}</div><p>{p.chosen}</p><i className="reward-bar" style={{ width: `${p.reward_chosen * 10}%` }} /></div>
              <div className="pref-rejected"><div className="pref-tag"><ThumbsDown size={13} /> Rejected · 奖励 {p.reward_rejected}</div><p>{p.rejected}</p><i className="reward-bar" style={{ width: `${p.reward_rejected * 10}%` }} /></div>
            </div>
          </div>)}
        </div>
      </section>

      <section className="panel gain-panel">
        <div className="panel-head"><div><span className="step-label">ALIGNMENT SCORECARD</span><h2>对齐效果</h2><p>{run.diagnosis}</p></div><Pill tone="mint"><ShieldCheck size={13} /> 安全 +{Math.round(run.metrics.safety_gain * 100)}%</Pill></div>
        <div className="gain-summary">
          <article><span>SFT 模型</span><strong>{Math.round(run.off.win_rate * 100)}%</strong><small>人类偏好胜率</small></article>
          <Check size={20} />
          <article className="rag-score"><span>DPO 对齐后</span><strong>{Math.round(run.on.win_rate * 100)}%</strong><small>人类偏好胜率</small></article>
        </div>
        <div className="side-metrics tool-metrics">
          <Metric label="Chosen 均值奖励" value={run.metrics.avg_reward_chosen} tone="mint" />
          <Metric label="Rejected 均值奖励" value={run.metrics.avg_reward_rejected} tone="amber" />
          <Metric label="胜率提升" value={`+${Math.round(run.metrics.win_rate_gain * 100)}%`} tone="blue" />
          <Metric label="安全率提升" value={`+${Math.round(run.metrics.safety_gain * 100)}%`} tone="purple" />
        </div>
      </section>
    </>}

    {!run && !running && <WaitState>点击运行，观察偏好对齐如何用 chosen/rejected 偏好对提升模型的人类偏好胜率与安全性。</WaitState>}
  </div>;
}
