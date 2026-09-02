import { useState } from "react";
import { ArrowRight, BadgeCheck, Calculator, CircleX, GitCompareArrows, LoaderCircle, ShieldCheck, TriangleAlert, Wrench } from "lucide-react";
import { api } from "../api";
import { MarkdownAnswer } from "../components/MarkdownAnswer";
import { EmptyState, Flow, Metric, Pill } from "../components/UI";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const fallbackTasks: Dict[] = [
  { id: "rsa_modinv", label: "RSA 私钥指数：模逆", category: "RSA 密钥生成", question: "在 RSA 中，已知公钥指数 e = 17，φ(n) = 3120。求私钥指数 d，使得 (d · e) mod φ(n) = 1。请直接给出 d 的整数值。", operation: "mod_inverse", hint: "d 是 e 关于 φ(n) 的模逆元。" },
  { id: "modexp", label: "快速幂：模幂运算", category: "Diffie-Hellman / RSA", question: "计算 7^263 mod 3233。请直接给出最终的整数余数。", operation: "mod_pow", hint: "结果是 0 到 3232 之间的整数。" },
  { id: "gcd", label: "欧几里得算法：最大公约数", category: "密钥参数校验", question: "求 gcd(1071, 462)。", operation: "gcd", hint: "使用辗转相除法。" },
];

export function ToolLab() {
  const { bootstrap, project, refreshProject } = useApp();
  const tasks: Dict[] = bootstrap?.tool_tasks?.length ? bootstrap.tool_tasks : fallbackTasks;
  const [taskId, setTaskId] = useState(tasks[0].id);
  const [run, setRun] = useState<Dict | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const task = tasks.find((item) => item.id === taskId) || tasks[0];

  if (!project) return <EmptyState title="请先选择实验项目">在“我的实验项目”中创建或选择一个项目后再运行本实验。</EmptyState>;

  const execute = async () => {
    setRunning(true); setError("");
    try {
      const result = await api.runToolExperiment({ project_id: project.id, task_id: taskId });
      setRun(result); await refreshProject();
    } catch (err) { setError((err as Error).message); }
    finally { setRunning(false); }
  };

  return <div className="lab-page tool-page">
    <div className="page-title">
      <div><Pill tone="blue">实验 · TOOLS</Pill><h1>工具调用：<span>会推理 vs 会执行</span></h1><p>同一道密码学计算题，对比大模型“无工具调用”与“调用安全工具精确计算”的差异，直观看到工具为智能体带来的可靠执行能力。</p></div>
      <div className="page-title-badges"><Pill tone="blue">{bootstrap?.providers?.llm_status?.model || "DeepSeek"} · 每次运行 2 次生成</Pill><Pill tone="mint"><ShieldCheck size={13} /> 白名单安全工具</Pill></div>
    </div>

    <Flow steps={["选择计算题", "PATH A 无工具调用", "PATH B 调用安全工具", "正确性对比", "结论"]} active={running ? 2 : run ? 4 : 0} />

    <div className="tool-task-panel panel">
      <div className="question-label"><Calculator size={18} /><div><strong>密码学计算任务</strong><small>无工具路径与有工具路径将各生成一次回答并自动判分</small></div></div>
      <div className="tool-question"><MarkdownAnswer>{task.question}</MarkdownAnswer></div>
      {task.hint && <div className="benchmark-note"><TriangleAlert size={16} /><span>{task.hint}</span></div>}
      <button className={`btn primary ${running ? "is-running" : ""}`} onClick={execute} disabled={running} aria-busy={running}>{running ? <><LoaderCircle className="spin" size={17} />正在运行双路对比…</> : <>运行 A/B 对比<GitCompareArrows size={17} /></>}</button>
      <div className="question-chips">{tasks.map((item) => <button className={taskId === item.id ? "active" : ""} key={item.id} disabled={running} onClick={() => { setTaskId(item.id); setRun(null); }}>{item.label}</button>)}</div>
    </div>

    {error && <div className="error-banner">{error}</div>}

    {run && !running && <>
      <div className="compare-grid">
        <article className="answer-card base-answer">
          <div className="answer-head"><div className="path-badge">A</div><div><span>对照组</span><h2>无工具 · 纯推理</h2></div><Pill tone={run.no_tool.correct ? "mint" : "red"}>{run.no_tool.correct ? "恰好正确" : "计算错误"}</Pill></div>
          <div className="answer-provenance"><Calculator size={14} /> {run.no_tool.provider} · 仅凭模型自身推算</div>
          <div className="answer-body"><MarkdownAnswer>{run.no_tool.answer}</MarkdownAnswer></div>
          <div className={`answer-foot ${run.no_tool.correct ? "" : "warning"}`}>{run.no_tool.correct ? <><BadgeCheck size={16} /> 模型给出 {run.no_tool.value}，与正确答案一致</> : <><CircleX size={16} /> 模型给出 {run.no_tool.value ?? "无法解析"}，正确答案为 {run.correct_answer}</>}</div>
        </article>
        <article className="answer-card rag-answer">
          <div className="answer-head"><div className="path-badge">B</div><div><span>实验组</span><h2>调用安全工具</h2></div><Pill tone={run.with_tool.correct ? "mint" : "red"}>{run.with_tool.correct ? "精确正确" : "异常"}</Pill></div>
          <div className="answer-provenance"><Wrench size={14} /> crypto_formula_tool · 确定性精确计算</div>
          <div className="answer-body"><MarkdownAnswer>{run.with_tool.answer}</MarkdownAnswer></div>
          <div className="answer-foot"><BadgeCheck size={16} /> 工具返回 {run.with_tool.tool_call.output.value}，模型据此作答</div>
        </article>
      </div>

      <section className="panel gain-panel">
        <div className="panel-head"><div><h2>正确性对比</h2><p>以受控安全实现的结果为权威答案，逐路径判定是否正确。</p></div><Pill tone={run.metrics.accuracy_gain > 0 ? "mint" : "amber"}>准确率 {run.metrics.accuracy_gain > 0 ? "+" : ""}{run.metrics.accuracy_gain}</Pill></div>
        <div className="gain-summary">
          <article><span>对照组 · 无工具</span><strong className={run.no_tool.correct ? "" : "miss-value"}>{run.no_tool.value ?? "—"}</strong><small>{run.no_tool.correct ? "正确" : "错误"}</small></article>
          <ArrowRight />
          <article className="rag-score"><span>实验组 · 有工具</span><strong>{run.with_tool.value ?? "—"}</strong><small>{run.with_tool.correct ? "正确" : "异常"}</small></article>
          <div className="answer-key"><span>权威答案</span><b>{run.correct_answer}</b></div>
        </div>
        <div className="tool-call-trace">
          <div className="subsection-head"><span><Wrench size={15} /> TOOL CALL</span><small>{run.with_tool.tool_call.permission} · {run.with_tool.tool_call.duration_ms} ms</small></div>
          <code className="tool-call-line">crypto_formula_tool({run.with_tool.tool_call.input.operation}, [{run.with_tool.tool_call.input.values.join(", ")}]) <ArrowRight size={13} /> {run.with_tool.tool_call.output.value}</code>
        </div>
        <div className="diagnosis"><TriangleAlert size={15} />{run.diagnosis}</div>
      </section>

      <div className="side-metrics tool-metrics">
        <Metric label="无工具" value={run.no_tool.correct ? "正确" : "错误"} tone={run.no_tool.correct ? "mint" : "amber"} />
        <Metric label="有工具" value={run.with_tool.correct ? "正确" : "异常"} tone="mint" />
        <Metric label="准确率增益" value={`${run.metrics.accuracy_gain > 0 ? "+" : ""}${run.metrics.accuracy_gain}`} tone="blue" />
        <Metric label="Latency" value={run.metrics.latency_ms} suffix="ms" tone="purple" />
      </div>
    </>}

    {!run && !running && <EmptyState title="等待运行">选择一道密码学计算题并点击“运行 A/B 对比”，即可并排看到无工具调用与安全工具精确计算的差异。</EmptyState>}
  </div>;
}
