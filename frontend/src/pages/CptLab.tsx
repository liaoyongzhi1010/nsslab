import { useState } from "react";
import { BrainCircuit, Check, TrendingDown, X } from "lucide-react";
import { api } from "../api";
import { Metric, Pill } from "../components/UI";
import { ExperimentHeader, RunBar, WaitState } from "../components/ExperimentShell";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

function LossCurve({ steps, base, cpt }: { steps: number[]; base: number[]; cpt: number[] }) {
  const w = 520, h = 200, pad = 34;
  const maxL = Math.max(...base, ...cpt), minL = Math.min(...base, ...cpt);
  const x = (i: number) => pad + (i / (steps.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - minL) / (maxL - minL)) * (h - pad * 2);
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className="loss-curve" role="img" aria-label="训练 loss 曲线">
    <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#263640" />
    <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#263640" />
    <path d={path(base)} fill="none" stroke="#8798a1" strokeWidth="2" strokeDasharray="4 3" />
    <path d={path(cpt)} fill="none" stroke="#49dcb1" strokeWidth="2.5" />
    {cpt.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#49dcb1" />)}
    <text x={w - pad} y={y(base[base.length - 1]) - 8} fill="#8798a1" fontSize="11" textAnchor="end">通用基座</text>
    <text x={w - pad} y={y(cpt[cpt.length - 1]) + 16} fill="#49dcb1" fontSize="11" textAnchor="end">密码 CPT</text>
  </svg>;
}

export function CptLab() {
  const { project, refreshProject } = useApp();
  const [run, setRun] = useState<Dict | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  if (!project) return <WaitState>请先在“我的实验项目”中创建或选择一个项目。</WaitState>;

  const execute = async () => {
    setRunning(true); setError("");
    try { const r = await api.runCptExperiment({ project_id: project.id }); setRun(r); await refreshProject(); }
    catch (e) { setError((e as Error).message); } finally { setRunning(false); }
  };

  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 02 · 模型训练与对齐"
      mode="仿真"
      title={<>继续预训练 <span>CPT</span></>}
      intro="在通用基座上用密码学语料继续预训练，把领域知识写进模型参数。用知识探针和训练 loss 曲线，对比通用基座与密码 CPT 基座的差异。"
      flowSteps={["通用基座", "加载密码语料", "继续预训练", "loss 下降", "知识探针评估"]}
      flowActive={running ? 2 : run ? 4 : 0}
    />

    <RunBar running={running} onRun={execute} label="运行继续预训练" runningLabel="正在继续预训练…">
      <div className="question-label"><BrainCircuit size={18} /><div><strong>密码知识注入</strong><small>在 {run?.corpus_tokens || "1.2B"} 密码语料上继续预训练，用 6 道知识探针评估</small></div></div>
    </RunBar>

    {error && <div className="error-banner">{error}</div>}

    {run && !running && <>
      <section className="panel">
        <div className="panel-head"><div><span className="step-label">TRAINING LOSS</span><h2>训练 loss 曲线</h2><p>密码 CPT 的 loss 明显低于仅在通用数据上训练的基座。</p></div><Pill tone="mint"><TrendingDown size={13} /> loss {run.metrics.final_loss_base} → {run.metrics.final_loss_cpt}</Pill></div>
        <LossCurve steps={run.loss_curve.steps} base={run.loss_curve.base} cpt={run.loss_curve.cpt} />
      </section>

      <section className="panel gain-panel">
        <div className="panel-head"><div><span className="step-label">KNOWLEDGE PROBES</span><h2>领域知识探针</h2><p>{run.diagnosis}</p></div><Pill tone="mint">探针 +{run.metrics.probe_gain}%</Pill></div>
        <div className="probe-grid">
          {run.probes.map((p: Dict) => <div className="probe-row" key={p.id}>
            <p>{p.prompt}</p>
            <span className="probe-answer">{p.answer}</span>
            <i className={p.base_hit ? "hit" : "miss"}>{p.base_hit ? <><Check size={12} /> 基座</> : <><X size={12} /> 基座</>}</i>
            <i className={p.cpt_hit ? "hit" : "miss"}>{p.cpt_hit ? <><Check size={12} /> CPT</> : <><X size={12} /> CPT</>}</i>
          </div>)}
        </div>
        <div className="side-metrics tool-metrics">
          <Metric label="基座探针命中" value={`${run.metrics.base_probe_score}%`} tone="amber" />
          <Metric label="CPT 探针命中" value={`${run.metrics.cpt_probe_score}%`} tone="mint" />
          <Metric label="知识增益" value={`+${run.metrics.probe_gain}%`} tone="blue" />
          <Metric label="最终 loss" value={run.metrics.final_loss_cpt} tone="purple" />
        </div>
      </section>
    </>}

    {!run && !running && <WaitState>点击运行，观察继续预训练如何降低 loss 并让模型掌握密码学领域知识。</WaitState>}
  </div>;
}
