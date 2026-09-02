import { useState } from "react";
import { ArrowRight, BookMarked, BrainCircuit, Check, ChevronDown, CircleDot, Database, GitCompareArrows, LoaderCircle, Quote, Search, SlidersHorizontal, Sparkles, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { MarkdownAnswer } from "../components/MarkdownAnswer";
import { EmptyState, Flow, Metric, Pill } from "../components/UI";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const privateQuestion = "依据《海岚医疗密码迁移与事件处置手册 v3.2》，事件 CRYPTO-2026-04 中：支付网关与影像归档各属什么级别？支付网关采用哪些算法参数？KMS 批次、轮换时限、验证标签和受控回滚窗口分别是什么？";
const fallbackBenchmarks: Dict[] = [{ id: "private_incident", label: "私域制度（效果最明显）", kind: "PRIVATE", question: privateQuestion, document_ids: ["hailan_crypto_manual"] }];

export function RagLab() {
  const { bootstrap, project, ragRun, setRagRun, refreshProject } = useApp();
  const navigate = useNavigate();
  const benchmarks = bootstrap?.rag_benchmarks?.length ? bootstrap.rag_benchmarks : fallbackBenchmarks;
  const [benchmarkId, setBenchmarkId] = useState("private_incident");
  const [query, setQuery] = useState(privateQuestion);
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.02);
  const [rerank, setRerank] = useState(true);
  const [topN, setTopN] = useState(3);
  const [contextTokens, setContextTokens] = useState(1600);
  const [promptTemplate, setPromptTemplate] = useState("严谨教学");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [traceTab, setTraceTab] = useState("retrieval");
  const selectedBenchmark = benchmarks.find((item: Dict) => item.id === benchmarkId);

  if (!project?.stats.knowledge_base) return <RagGate />;

  const run = async () => {
    setRunning(true); setError("");
    try {
      const result = await api.ragCompare({ project_id: project.id, query, benchmark_id: benchmarkId || null, top_k: topK, threshold, rerank_enabled: rerank, rerank_top_n: topN, max_context_tokens: contextTokens, prompt_template: promptTemplate });
      setRagRun(result); await refreshProject();
    } catch (err) { setError((err as Error).message); }
    finally { setRunning(false); }
  };

  return <div className="lab-page rag-page">
    <div className="page-title"><div><Pill tone="blue">实验 06 · 知识工程</Pill><h1>用证据看见<span>RAG 增益</span></h1><p>不再比较泛泛的概念解释：用私域规则、精确参数、最新进展和版本化政策逐项核验知识增益。</p></div><div className="page-title-badges"><Pill tone="mint"><Check size={13} /> 继承 {project.stats.documents} 份文档 / {project.stats.chunks} Chunks</Pill></div></div>
    <Flow steps={["Question", "Query Embedding", "Retrieval", "Rerank", "Context", "LLM", "Grounded Answer"]} active={running ? 4 : ragRun ? 6 : 0} />
    <div className="rag-question-panel panel">
      <div className="question-label"><Search size={18} /><div><strong>证据基准任务</strong><small>BASE LLM 与 CRYPTO-RAG 同时运行并逐项评分</small></div></div>
      <textarea aria-label="RAG 对比问题" value={query} disabled={running} onChange={(event) => { setQuery(event.target.value); setBenchmarkId(""); }} />
      <button className={`btn primary ${running ? "is-running" : ""}`} onClick={run} disabled={running} aria-busy={running}>{running ? <><LoaderCircle className="spin" size={17} />正在运行双路对比…</> : <>运行 A/B 对比<GitCompareArrows size={17} /></>}</button>
      <div className="question-chips benchmark-chips">{benchmarks.map((item: Dict) => <button className={benchmarkId === item.id ? "active" : ""} key={item.id} disabled={running} onClick={() => { setBenchmarkId(item.id); setQuery(item.question); }}>{item.label}</button>)}</div>
    </div>
    {selectedBenchmark && <div className="benchmark-note"><BookMarked size={16} /><span><strong>{selectedBenchmark.kind} EVIDENCE TASK</strong> 所需资料：{selectedBenchmark.document_ids.join("、")}。关键事实清单由后端固定，回答后会同时评分。</span></div>}
    {error && <div className="error-banner">{error}</div>}
    {running && <RagExecutionState />}
    {!running && <div className="rag-layout"><div className="rag-content">
      <div className="compare-grid">
        <article className="answer-card base-answer"><div className="answer-head"><div className="path-badge">A</div><div><span>对照组</span><h2>Base LLM</h2></div><Pill tone="neutral">无检索上下文</Pill></div>{ragRun ? <><div className="answer-provenance"><BrainCircuit size={14} /> {ragRun.base.provider} · 仅使用模型内部知识</div><div className="answer-body"><MarkdownAnswer>{ragRun.base.answer}</MarkdownAnswer></div><div className="answer-foot warning"><TriangleAlert size={16} /> 无来源引用，版本和私域事实无法直接核查</div></> : <EmptyState title="等待运行">左侧路径不会访问密码学知识库。</EmptyState>}</article>
        <article className="answer-card rag-answer"><div className="answer-head"><div className="path-badge">B</div><div><span>实验组</span><h2>Crypto-RAG</h2></div><Pill tone="mint">已检索接地</Pill></div>{ragRun ? <><div className="answer-provenance"><Database size={14} /> Crypto Knowledge Base · {ragRun.rag.citations.length} 个引用</div><div className="answer-body"><MarkdownAnswer>{ragRun.rag.answer}</MarkdownAnswer></div><CitationList citations={ragRun.rag.citations} /></> : <EmptyState title="等待运行">右侧路径会执行 Embedding → Retrieval → Rerank → Context。</EmptyState>}</article>
      </div>
      {ragRun?.benchmark && <GainPanel benchmark={ragRun.benchmark} />}
      {ragRun && <section className="panel trace-viewer"><div className="panel-head"><div><span className="step-label">PIPELINE VIEWER</span><h2>RAG 过程观察器</h2><p>公开系统结构与中间结果，不展示模型私有思维链。</p></div><Pill tone="blue">TRACE {ragRun.run_id}</Pill></div>
        <div className="trace-tabs">{[["retrieval", "① Retrieval"], ["rerank", "② Rerank"], ["context", "③ Context"], ["prompt", "④ Final Prompt"]].map(([id, label]) => <button className={traceTab === id ? "active" : ""} onClick={() => setTraceTab(id)} key={id}>{label}</button>)}</div>
        {traceTab === "retrieval" && <div className="trace-content"><div className="embedding-line"><span>QUERY EMBEDDING</span><strong>{ragRun.trace.embedding.dimension}D</strong><code>[{ragRun.trace.embedding.preview.slice(0, 6).join(", ")}, …]</code></div><div className="trace-list">{ragRun.trace.retrieval.map((item: Dict, index: number) => <div className="trace-item" key={item.id}><span>{index + 1}</span><div><strong>{item.document_title} · {item.section}</strong><p>{item.text}</p><small>{item.id}</small></div><b>{item.score.toFixed(3)}</b></div>)}</div></div>}
        {traceTab === "rerank" && <div className="trace-content"><div className="rerank-compare"><div><span>BEFORE</span>{ragRun.trace.rerank.before.map((id: string, index: number) => <b key={id}>{index + 1}<small>{id}</small></b>)}</div><ArrowRight /><div><span>AFTER</span>{ragRun.trace.rerank.items.map((item: Dict, index: number) => <b key={item.id} className="active">{index + 1}<small>{item.id} · {item.rerank_score.toFixed(3)}</small></b>)}</div></div>{!ragRun.trace.rerank.enabled && <div className="diagnosis"><TriangleAlert size={15} />Rerank 已禁用，排序完全沿用向量相似度。</div>}</div>}
        {traceTab === "context" && <div className="trace-content"><div className="context-meter"><span><b>{ragRun.trace.context.tokens}</b> / {ragRun.trace.context.max_tokens} tokens</span><i><em style={{ width: `${Math.min(100, ragRun.trace.context.tokens / ragRun.trace.context.max_tokens * 100)}%` }} /></i></div>{ragRun.trace.context.items.map((item: Dict, index: number) => <details key={item.id} open={index === 0}><summary><span>[{index + 1}] {item.document_title} · {item.section}</span><small>{item.tokens} tokens <ChevronDown size={14} /></small></summary><p>{item.text}</p></details>)}</div>}
        {traceTab === "prompt" && <div className="trace-content prompt-structure">{ragRun.trace.prompt.structure.map((row: string, index: number) => <div key={row}><span>{String(index + 1).padStart(2, "0")}</span><code>{row}</code></div>)}<p><CircleDot size={14} /> 这里只展示可公开的 Prompt 组成，不展示 Chain-of-Thought。</p></div>}
      </section>}
    </div><RagParameters topK={topK} setTopK={setTopK} threshold={threshold} setThreshold={setThreshold} rerank={rerank} setRerank={setRerank} topN={topN} setTopN={setTopN} contextTokens={contextTokens} setContextTokens={setContextTokens} promptTemplate={promptTemplate} setPromptTemplate={setPromptTemplate} ragRun={ragRun} /></div>}
  </div>;
}

function RagExecutionState() { const phases = ["准备问题", "知识检索", "Rerank", "组装上下文", "双路生成", "事实评分"]; return <section className="rag-execution panel" role="status" aria-live="polite" aria-busy="true">
  <div className="rag-execution-head"><span className="loading-orbit blue"><LoaderCircle className="spin" size={25} /><i /></span><div><strong>正在执行 A/B 对比</strong><small>任务已提交，请等待 Base LLM、Crypto-RAG 和关键事实评分全部完成。</small></div><Pill tone="blue">PROCESSING</Pill></div>
  <div className="ab-execution-grid">
    <article><span className="path-badge">A</span><div><small>PATH A</small><strong>Base LLM</strong><em>Qwen · 不加载知识库上下文</em></div><span className="signal-bars" aria-hidden="true"><i /><i /><i /><i /></span></article>
    <span className="compare-pulse" aria-hidden="true">A/B<i /></span>
    <article className="rag-lane"><span className="path-badge">B</span><div><small>PATH B</small><strong>Crypto-RAG</strong><em>检索 · 重排 · 上下文 · Qwen</em></div><span className="signal-bars" aria-hidden="true"><i /><i /><i /><i /></span></article>
  </div>
  <div className="execution-phases" aria-label={`处理流程：${phases.join("、")}`}>{phases.map((phase, index) => <span key={phase} style={{ animationDelay: `${index * .32}s` }}><i />{phase}</span>)}</div>
  <p>动画表示任务仍在处理中，不代表精确完成百分比；结果返回后将自动切换到回答对比和知识增益计分板。请勿重复提交或关闭页面。</p>
</section>; }

function CitationList({ citations }: { citations: Dict[] }) { return <div className="citation-list"><strong><Quote size={15} /> 可核验来源</strong>{citations.map((cite) => <span key={cite.chunk_id}><b>[{cite.index}]</b>{cite.document}<small>{cite.source_type} · {cite.source_date || "未标日期"} · {cite.section}</small>{cite.source_url && <a href={cite.source_url} target="_blank" rel="noreferrer">查看原始来源</a>}{cite.scenario_notice && <em>{cite.scenario_notice}</em>}</span>)}</div>; }

function GainPanel({ benchmark }: { benchmark: Dict }) { return <section className="panel gain-panel"><div className="panel-head"><div><h2>知识增益计分板</h2><p>{benchmark.scoring_note}</p></div><Pill tone={benchmark.knowledge_gain > 0 ? "mint" : "amber"}>知识增益 {benchmark.knowledge_gain > 0 ? "+" : ""}{benchmark.knowledge_gain}</Pill></div><div className="gain-summary"><article><span>对照组 · Base LLM</span><strong>{benchmark.base_score}</strong><small>关键事实命中率</small></article><ArrowRight /><article className="rag-score"><span>实验组 · Crypto-RAG</span><strong>{benchmark.rag_score}</strong><small>关键事实命中率</small></article></div><div className="fact-check-grid">{benchmark.facts.map((fact: Dict) => <div key={fact.id}><span>{fact.label}</span><i className={fact.base_hit ? "hit" : "miss"}>{fact.base_hit ? "✓ 对照" : "× 对照"}</i><i className={fact.rag_hit ? "hit" : "miss"}>{fact.rag_hit ? "✓ RAG" : "× RAG"}</i></div>)}</div>{benchmark.missing_document_ids.length > 0 && <div className="error-banner">知识库缺少：{benchmark.missing_document_ids.join("、")}。请回到实验一选中挑战包并重建。</div>}</section>; }

interface ParametersProps { topK: number; setTopK: (value: number) => void; threshold: number; setThreshold: (value: number) => void; rerank: boolean; setRerank: (value: boolean) => void; topN: number; setTopN: (value: number) => void; contextTokens: number; setContextTokens: (value: number) => void; promptTemplate: string; setPromptTemplate: (value: string) => void; ragRun: Dict | null; }
function RagParameters(props: ParametersProps) { return <aside className="parameter-panel"><div className="parameter-title"><SlidersHorizontal size={18} /><div><strong>RAG 参数</strong><small>每次运行即时生效</small></div></div><label>Top-K <b>{props.topK}</b><input type="range" min="1" max="20" value={props.topK} onChange={(event) => props.setTopK(Number(event.target.value))} /></label><label>Similarity Threshold <b>{props.threshold.toFixed(2)}</b><input type="range" min="-0.1" max="0.8" step="0.02" value={props.threshold} onChange={(event) => props.setThreshold(Number(event.target.value))} /></label><div className="switch-row"><div><strong>启用 Rerank</strong><small>词汇交叉编码教学模拟</small></div><button className={`switch ${props.rerank ? "on" : ""}`} aria-label="启用 Rerank" onClick={() => props.setRerank(!props.rerank)}><i /></button></div><label>Rerank Top-N <b>{props.topN}</b><input type="range" min="1" max="10" value={props.topN} onChange={(event) => props.setTopN(Number(event.target.value))} disabled={!props.rerank} /></label><label>Max Context Token <b>{props.contextTokens}</b><input type="range" min="400" max="4000" step="200" value={props.contextTokens} onChange={(event) => props.setContextTokens(Number(event.target.value))} /></label><label>Prompt Template<select value={props.promptTemplate} onChange={(event) => props.setPromptTemplate(event.target.value)}><option>严谨教学</option><option>工程简报</option><option>苏格拉底引导</option></select></label>{props.ragRun && <><div className="parameter-divider" /><span className="param-section">本次指标</span><div className="side-metrics"><Metric label="Context Hit" value={`${Math.round(props.ragRun.metrics.context_hit_rate * 100)}%`} /><Metric label="Citations" value={props.ragRun.metrics.context_chunks} tone="blue" /><Metric label={props.ragRun.benchmark ? "Fact Score" : "Quality"} value={props.ragRun.metrics.quality_score} tone="purple" /><Metric label="Latency" value={props.ragRun.metrics.latency_ms} suffix="ms" tone="amber" /></div><div className="diagnosis"><Sparkles size={15} />{props.ragRun.diagnosis}</div></>}<div className="teaching-tip blue"><BookMarked size={18} /><strong>破坏实验</strong><p>比较私域题与通识题；再用 Top-K = 1 / 5 / 20、关闭 Rerank，观察增益何时消失。</p></div></aside>; }

function RagGate() { const navigate = useNavigate(); return <div className="gate"><BrainCircuit size={38} /><h1>需要先完成实验一</h1><p>请先选中与基准题对应的“RAG 证据挑战包”或“国产密码与 TEE 专题包”，构建知识库后再运行证据基准。</p><button className="btn primary" onClick={() => navigate("/lab/knowledge")}>前往实验一</button></div>; }
