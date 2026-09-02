import { useState } from "react";
import { Check, Database, Filter, Sparkles, TrendingUp, X } from "lucide-react";
import { api } from "../api";
import { Metric, Pill } from "../components/UI";
import { ComparePanel, ExperimentHeader, RunBar, WaitState } from "../components/ExperimentShell";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

export function DataLab() {
  const { project, refreshProject } = useApp();
  const [run, setRun] = useState<Dict | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  if (!project) return <WaitState>请先在“我的实验项目”中创建或选择一个项目。</WaitState>;

  const execute = async () => {
    setRunning(true); setError("");
    try { const r = await api.runDataExperiment({ project_id: project.id }); setRun(r); await refreshProject(); }
    catch (e) { setError((e as Error).message); } finally { setRunning(false); }
  };

  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 01 · 数据工程"
      mode="仿真"
      title={<>密码语料<span>构建与治理</span></>}
      intro="模型能力的地基是数据。对比原始杂乱语料与经过去重、清洗、质量过滤、规范化后的高质量数据集，看数据治理如何决定训练质量。"
      flowSteps={["原始语料", "去重", "清洗", "质量过滤", "规范化", "高质量数据集"]}
      flowActive={running ? 3 : run ? 5 : 0}
    />

    <RunBar running={running} onRun={execute} label="运行数据治理流水线" runningLabel="正在执行清洗流水线…">
      <div className="question-label"><Database size={18} /><div><strong>密码学语料治理</strong><small>对 10 条原始样本执行去重 / 清洗 / 过滤 / 规范化</small></div></div>
    </RunBar>

    {error && <div className="error-banner">{error}</div>}

    {run && !running && <>
      <div className="pipeline-stages">
        {run.stages.map((s: Dict, i: number) => <div className="pipeline-stage" key={s.id}><span className="stage-num">{i + 1}</span><div><strong>{s.name}</strong><small>{s.desc}</small></div><Filter size={15} /></div>)}
      </div>

      <ComparePanel
        offLabel={run.off.label}
        onLabel={run.on.label}
        offTone="amber"
        offHead={<><Database size={14} /> 原始语料 · {run.off.count} 条 · 质量分 {run.off.quality}</>}
        onHead={<><Sparkles size={14} /> 治理后 · {run.on.count} 条 · 质量分 {run.on.quality}</>}
        offBody={<div className="sample-list">{run.samples.map((s: Dict) => <div className={`sample-row ${s.kept ? "" : "dropped"}`} key={s.id}><p>{s.text}</p>{s.issues.length > 0 ? <div className="sample-issues">{s.issues.map((iss: string) => <span key={iss}>{iss}</span>)}</div> : <span className="sample-ok">合格</span>}</div>)}</div>}
        onBody={<div className="sample-list">{run.samples.filter((s: Dict) => s.kept).map((s: Dict) => <div className="sample-row kept" key={s.id}><Check size={13} /><p>{s.text}</p></div>)}</div>}
      />

      <section className="panel gain-panel">
        <div className="panel-head"><div><span className="step-label">DATA SCORECARD</span><h2>数据治理效果</h2><p>{run.diagnosis}</p></div><Pill tone="mint"><TrendingUp size={13} /> 质量 +{run.metrics.quality_gain}</Pill></div>
        <div className="side-metrics tool-metrics">
          <Metric label="原始样本" value={run.metrics.raw_count} tone="amber" />
          <Metric label="保留样本" value={run.metrics.kept_count} tone="mint" />
          <Metric label="去重率" value={`${Math.round(run.metrics.dedup_rate * 100)}%`} tone="blue" />
          <Metric label="保留率" value={`${Math.round(run.metrics.retention_rate * 100)}%`} tone="purple" />
        </div>
      </section>
    </>}

    {!run && !running && <WaitState>点击运行，观察原始语料经过治理流水线后如何变成高质量训练数据。</WaitState>}
  </div>;
}
