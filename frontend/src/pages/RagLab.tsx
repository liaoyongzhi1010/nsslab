import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookMarked, BrainCircuit, Check, ChevronDown, CircleDot, Database, GitCompareArrows, Info, LoaderCircle, Play, Quote, Search, Sparkles, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { MarkdownAnswer } from "../components/MarkdownAnswer";
import { EmptyState, Metric, Pill, StepNav, Stepper, type StepMeta } from "../components/UI";
import { AdminExamView } from "../components/AdminExamView";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const privateQuestion = "依据《海岚医疗密码迁移与事件处置手册 v3.2》，事件 CRYPTO-2026-04 中：支付网关与影像归档各属什么级别？支付网关采用哪些算法参数？KMS 批次、轮换时限、验证标签和受控回滚窗口分别是什么？";
const fallbackBenchmarks: Dict[] = [{ id: "private_incident", label: "私域制度（效果最明显）", kind: "PRIVATE", question: privateQuestion, document_ids: ["hailan_crypto_manual"] }];

const steps: StepMeta[] = [
  { title: "提出问题", caption: "Question" },
  { title: "问题向量化", caption: "Embedding" },
  { title: "检索", caption: "Retrieval" },
  { title: "重排", caption: "Rerank" },
  { title: "组装上下文", caption: "Context" },
  { title: "生成与接地", caption: "Answer" },
];

export function RagLab() {
  const { bootstrap, project, ragRun, setRagRun, refreshProject, user } = useApp();
  const navigate = useNavigate();
  const benchmarks = bootstrap?.rag_benchmarks?.length ? bootstrap.rag_benchmarks : fallbackBenchmarks;
  const [step, setStep] = useState(0);
  const [benchmarkId, setBenchmarkId] = useState("private_incident");
  const [query, setQuery] = useState(privateQuestion);
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.02);
  const [rerank, setRerank] = useState(true);
  const [topN, setTopN] = useState(3);
  const [contextTokens, setContextTokens] = useState(1600);
  const [promptTemplate, setPromptTemplate] = useState("严谨教学");

  const [embedResult, setEmbedResult] = useState<Dict | null>(null);
  const [retrieveResult, setRetrieveResult] = useState<Dict | null>(null);
  const [rerankResult, setRerankResult] = useState<Dict | null>(null);
  const [contextResult, setContextResult] = useState<Dict | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [traceTab, setTraceTab] = useState("retrieval");
  const selectedBenchmark = benchmarks.find((item: Dict) => item.id === benchmarkId);
  const inputsTouched = useRef(false);

  const resetDownstream = () => { setEmbedResult(null); setRetrieveResult(null); setRerankResult(null); setContextResult(null); setRagRun(null); };

  useEffect(() => {
    if (!inputsTouched.current) { inputsTouched.current = true; return; }
    resetDownstream();
  }, [query, topK, threshold, rerank, topN, contextTokens]);

  const completed = useMemo(() => {
    if (!query.trim()) return 0;
    if (!embedResult) return 1;
    if (!retrieveResult) return 2;
    if (!rerankResult) return 3;
    if (!contextResult) return 4;
    if (!ragRun) return 5;
    return 6;
  }, [query, embedResult, retrieveResult, rerankResult, contextResult, ragRun]);

  useEffect(() => { if (step > completed) setStep(completed); }, [completed, step]);

  if (user?.role === "admin") return <AdminExamView expId="06" tag="实验 06 · 知识工程" title={<>用证据看见<span>RAG 增益</span></>} intro="逐阶段亲手运行 RAG 流水线：问题向量化 → 检索 → 重排 → 组装上下文 → 让 Base LLM 与 Crypto-RAG 同题对比。每一步都是独立小实验。" />;

  if (!project?.stats.knowledge_base) return <RagGate />;

  const runEmbed = async () => {
    setError(""); setBusy(true);
    try { setEmbedResult(await api.ragEmbedQuery({ project_id: project.id, query })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const runRetrieve = async () => {
    setError(""); setBusy(true);
    try { setRetrieveResult(await api.search({ project_id: project.id, query, top_k: topK, threshold })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const runRerank = async () => {
    setError(""); setBusy(true);
    try { setRerankResult(await api.ragRerank({ project_id: project.id, query, items: retrieveResult?.results || [], rerank_enabled: rerank, rerank_top_n: topN })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const runContext = async () => {
    setError(""); setBusy(true);
    try { setContextResult(await api.ragContext({ project_id: project.id, query, items: rerankResult?.items || [], max_context_tokens: contextTokens })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const runAnswer = async () => {
    setError(""); setBusy(true);
    try {
      const result = await api.ragCompare({ project_id: project.id, query, benchmark_id: benchmarkId || null, top_k: topK, threshold, rerank_enabled: rerank, rerank_top_n: topN, max_context_tokens: contextTokens, prompt_template: promptTemplate });
      setRagRun(result); await refreshProject();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const goNext = () => setStep((s) => Math.min(s + 1, 5));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="lab-page rag-page">
      <div className="page-title"><div><Pill tone="blue">实验 06 · 知识工程</Pill><h1>用证据看见<span>RAG 增益</span></h1><p>逐阶段亲手运行 RAG 流水线：问题向量化 → 检索 → 重排 → 组装上下文 → 让 Base LLM 与 Crypto-RAG 同题对比。每一步都是独立小实验。</p></div><div className="page-title-badges"><Pill tone="mint"><Check size={13} /> 继承 {project.stats.documents} 份文档 / {project.stats.chunks} Chunks</Pill></div></div>

      <Stepper steps={steps} current={step} furthest={completed} onSelect={setStep} />

      {error && <div className="error-banner">{error}</div>}

      {step === 0 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 01 / 06" title="提出问题 / 选择证据基准题"
            why="RAG 要解决的是“模型没学过或记不准的知识”。基准题预先公布关键事实清单，运行后可逐条打分——这样 RAG 的增益是可测的，而不是“看起来更好”。" badge={<Pill tone="blue"><Search size={13} /> QUESTION</Pill>} />
          <div className="query-composer"><Search size={19} /><textarea aria-label="RAG 对比问题" value={query} onChange={(event) => { setQuery(event.target.value); setBenchmarkId(""); }} /></div>
          <div className="question-chips benchmark-chips">{benchmarks.map((item: Dict) => <button className={benchmarkId === item.id ? "active" : ""} key={item.id} onClick={() => { setBenchmarkId(item.id); setQuery(item.question); }}>{item.label}</button>)}</div>
          {selectedBenchmark && <div className="benchmark-note"><BookMarked size={16} /><span><strong>{selectedBenchmark.kind} EVIDENCE TASK</strong> 所需资料：{selectedBenchmark.document_ids.join("、")}。关键事实清单由后端固定，回答后会同时评分。</span></div>}
          <StepNav onNext={goNext} nextDisabled={!query.trim()} nextHint={!query.trim() ? "请输入或选择一个问题" : "进入问题向量化"} backDisabled />
        </section>
      )}

      {step === 1 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 02 / 06" title="问题向量化 Query Embedding"
            why="要在向量空间里比较相似度，问题必须先用同一个 Embedding 模型编码成向量，和知识库片段处于同一空间——否则“距离”没有意义。" />
          <QuestionRecap query={query} />
          <RunBar label="把问题编码成向量" hint="使用与建库相同的 Embedding 模型" done={!!embedResult} busy={busy} onRun={runEmbed} runLabel={embedResult ? "重新向量化" : "运行向量化"} />
          {embedResult && <>
            <div className="embedding-line"><span>QUERY EMBEDDING</span><strong>{embedResult.dimension}D</strong><code>[{embedResult.preview.slice(0, 6).join(", ")}, …]</code><small>{embedResult.latency_ms} ms</small></div>
            <div className="observer-note"><Info size={15} /><span>问题已成为 {embedResult.dimension} 维向量（‖v‖={embedResult.vector_norm}）。下一步用它和库中所有片段算相似度。</span></div>
          </>}
          {!embedResult && <EmptyState title="尚未向量化">运行后可看到问题向量的维度与预览。</EmptyState>}
          <StepNav onBack={goBack} onNext={goNext} nextDisabled={!embedResult} nextHint={!embedResult ? "先运行向量化" : "进入检索"} />
        </section>
      )}

      {step === 2 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 03 / 06" title="检索 Retrieval"
            why="用问题向量在知识库里找出方向最接近的片段。Top-K 控制取回数量，阈值过滤弱相关片段。这一步决定了“证据的候选池”。" />
          <div className="step-params">
            <label>Top-K <b>{topK}</b><input type="range" min="1" max="20" value={topK} onChange={(e) => setTopK(Number(e.target.value))} /><span className="range-ends"><small>1</small><small>20</small></span></label>
            <label>Similarity Threshold <b>{threshold.toFixed(2)}</b><input type="range" min="-0.1" max="0.8" step="0.02" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /><span className="range-ends"><small>噪声更多</small><small>过滤严格</small></span></label>
          </div>
          <RunBar label="检索相关片段" hint="改动参数后需重新检索" done={!!retrieveResult} busy={busy} onRun={runRetrieve} runLabel={retrieveResult ? "重新检索" : "运行检索"} />
          {retrieveResult && <>
            <div className="diagnosis"><Sparkles size={15} /><span>{retrieveResult.explanation}</span></div>
            <div className="trace-list">{retrieveResult.results.map((item: Dict, index: number) => <div className="trace-item" key={item.id}><span>{index + 1}</span><div><strong>{item.document_title} · {item.section}</strong><p>{item.text}</p><small>{item.id}</small></div><b>{item.score.toFixed(3)}</b></div>)}</div>
            {!retrieveResult.results.length && <EmptyState title="零个检索结果">阈值过滤了全部片段，试着调低阈值。</EmptyState>}
          </>}
          {!retrieveResult && <EmptyState title="尚未检索">运行检索，取回候选证据片段。</EmptyState>}
          <StepNav onBack={goBack} onNext={goNext} nextDisabled={!retrieveResult?.results?.length} nextHint={!retrieveResult?.results?.length ? "需要至少一个检索结果" : "进入重排"} />
        </section>
      )}

      {step === 3 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 04 / 06" title="重排 Rerank"
            why="向量检索快但粗糙。重排用更贴题的打分对候选重新排序，把最相关的证据顶到前面，再截取 Top-N 进入上下文。关掉它可对比排序差异。" />
          <div className="step-params">
            <label className="switch-inline"><span>启用 Rerank</span><button className={`switch ${rerank ? "on" : ""}`} aria-label="启用 Rerank" onClick={() => setRerank(!rerank)}><i /></button></label>
            <label>Rerank Top-N <b>{topN}</b><input type="range" min="1" max="10" value={topN} onChange={(e) => setTopN(Number(e.target.value))} disabled={!rerank} /><span className="range-ends"><small>1</small><small>10</small></span></label>
          </div>
          <RunBar label="对候选片段重排序" hint={rerank ? "交叉打分并截取 Top-N" : "已禁用，将沿用检索顺序"} done={!!rerankResult} busy={busy} onRun={runRerank} runLabel={rerankResult ? "重新重排" : "运行重排"} />
          {rerankResult && <>
            <div className="rerank-compare"><div><span>BEFORE</span>{rerankResult.before.map((id: string, index: number) => <b key={id}>{index + 1}<small>{id}</small></b>)}</div><ArrowRight /><div><span>AFTER</span>{rerankResult.items.map((item: Dict, index: number) => <b key={item.id} className="active">{index + 1}<small>{item.id}{item.rerank_score != null ? ` · ${Number(item.rerank_score).toFixed(3)}` : ""}</small></b>)}</div></div>
            {!rerankResult.enabled && <div className="diagnosis"><TriangleAlert size={15} />Rerank 已禁用，排序完全沿用向量相似度。</div>}
            {rerankResult.enabled && <div className="observer-note"><Info size={15} /><span>{rerankResult.reordered ? "重排改变了顺序——说明向量相似度和贴题度并不完全一致。" : "本次重排未改变顺序；换个问题或调大 Top-K 更容易看到差异。"}</span></div>}
          </>}
          {!rerankResult && <EmptyState title="尚未重排">运行后对比重排前后的顺序变化。</EmptyState>}
          <StepNav onBack={goBack} onNext={goNext} nextDisabled={!rerankResult} nextHint={!rerankResult ? "先运行重排" : "进入组装上下文"} />
        </section>
      )}

      {step === 4 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 05 / 06" title="组装上下文 Context"
            why="进入提示词的证据受 token 预算限制。这一步按预算装箱：装得下的进上下文，超预算的被丢弃。预算太小→证据不足；太大→噪声和成本上升。" />
          <div className="step-params">
            <label>Max Context Tokens <b>{contextTokens}</b><input type="range" min="400" max="4000" step="200" value={contextTokens} onChange={(e) => setContextTokens(Number(e.target.value))} /><span className="range-ends"><small>400</small><small>4000</small></span></label>
          </div>
          <RunBar label="在预算内装配上下文" hint="决定哪些证据真正进入提示词" done={!!contextResult} busy={busy} onRun={runContext} runLabel={contextResult ? "重新组装" : "运行组装"} />
          {contextResult && <>
            <div className="context-meter"><span><b>{contextResult.tokens}</b> / {contextResult.max_tokens} tokens · 利用率 {Math.round(contextResult.utilization * 100)}%</span><i><em style={{ width: `${Math.min(100, contextResult.utilization * 100)}%` }} /></i></div>
            {contextResult.items.map((item: Dict, index: number) => <details key={item.id} open={index === 0}><summary><span>[{index + 1}] {item.document_title} · {item.section}</span><small>{item.tokens} tokens <ChevronDown size={14} /></small></summary><p>{item.text}</p></details>)}
            {!!contextResult.dropped.length && <div className="stale-note"><TriangleAlert size={15} />有 {contextResult.dropped.length} 个片段因超出预算被丢弃。若关键证据被丢，可调大预算。</div>}
          </>}
          {!contextResult && <EmptyState title="尚未组装">运行后查看进入上下文的片段与 token 用量。</EmptyState>}
          <StepNav onBack={goBack} onNext={goNext} nextDisabled={!contextResult} nextHint={!contextResult ? "先组装上下文" : "进入生成与接地"} />
        </section>
      )}

      {step === 5 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 06 / 06" title="生成与接地 · A/B 对比"
            why="最后一步同题跑两路：A 组 Base LLM 只靠模型内部知识；B 组 Crypto-RAG 把上面组装的证据喂给模型。对照关键事实清单打分，就能量化“证据接地”带来的知识增益。" badge={<Pill tone="mint"><GitCompareArrows size={13} /> A / B</Pill>} />
          <div className="step-params">
            <label>Prompt Template<select value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)}><option>严谨教学</option><option>工程简报</option><option>苏格拉底引导</option></select></label>
          </div>
          <RunBar label="运行 Base LLM 与 Crypto-RAG 双路对比" hint="一次调用同时产出两路答案、引用与事实计分板" done={!!ragRun} busy={busy} onRun={runAnswer} runLabel={ragRun ? "重新运行对比" : "运行 A/B 对比"} />
          {busy && !ragRun && <RagExecutionState />}
          {ragRun && <>
            <div className="compare-grid">
              <article className="answer-card base-answer"><div className="answer-head"><div className="path-badge">A</div><div><span>对照组</span><h2>Base LLM</h2></div><Pill tone="neutral">无检索上下文</Pill></div><div className="answer-provenance"><BrainCircuit size={14} /> {ragRun.base.provider} · 仅使用模型内部知识</div><div className="answer-body"><MarkdownAnswer>{ragRun.base.answer}</MarkdownAnswer></div><div className="answer-foot warning"><TriangleAlert size={16} /> 无来源引用，版本和私域事实无法直接核查</div></article>
              <article className="answer-card rag-answer"><div className="answer-head"><div className="path-badge">B</div><div><span>实验组</span><h2>Crypto-RAG</h2></div><Pill tone="mint">已检索接地</Pill></div><div className="answer-provenance"><Database size={14} /> Crypto Knowledge Base · {ragRun.rag.citations.length} 个引用</div><div className="answer-body"><MarkdownAnswer>{ragRun.rag.answer}</MarkdownAnswer></div><CitationList citations={ragRun.rag.citations} /></article>
            </div>
            {ragRun.benchmark && <GainPanel benchmark={ragRun.benchmark} />}
            <section className="trace-viewer"><div className="panel-head"><div><h2>RAG 过程观察器</h2><p>回看完整流水线的中间结果；不展示模型私有思维链。</p></div><Pill tone="blue">TRACE {ragRun.run_id}</Pill></div>
              <div className="trace-tabs">{[["retrieval", "① Retrieval"], ["rerank", "② Rerank"], ["context", "③ Context"], ["prompt", "④ Final Prompt"]].map(([id, label]) => <button className={traceTab === id ? "active" : ""} onClick={() => setTraceTab(id)} key={id}>{label}</button>)}</div>
              {traceTab === "retrieval" && <div className="trace-content"><div className="embedding-line"><span>QUERY EMBEDDING</span><strong>{ragRun.trace.embedding.dimension}D</strong><code>[{ragRun.trace.embedding.preview.slice(0, 6).join(", ")}, …]</code></div><div className="trace-list">{ragRun.trace.retrieval.map((item: Dict, index: number) => <div className="trace-item" key={item.id}><span>{index + 1}</span><div><strong>{item.document_title} · {item.section}</strong><p>{item.text}</p><small>{item.id}</small></div><b>{item.score.toFixed(3)}</b></div>)}</div></div>}
              {traceTab === "rerank" && <div className="trace-content"><div className="rerank-compare"><div><span>BEFORE</span>{ragRun.trace.rerank.before.map((id: string, index: number) => <b key={id}>{index + 1}<small>{id}</small></b>)}</div><ArrowRight /><div><span>AFTER</span>{ragRun.trace.rerank.items.map((item: Dict, index: number) => <b key={item.id} className="active">{index + 1}<small>{item.id} · {item.rerank_score.toFixed(3)}</small></b>)}</div></div>{!ragRun.trace.rerank.enabled && <div className="diagnosis"><TriangleAlert size={15} />Rerank 已禁用，排序完全沿用向量相似度。</div>}</div>}
              {traceTab === "context" && <div className="trace-content"><div className="context-meter"><span><b>{ragRun.trace.context.tokens}</b> / {ragRun.trace.context.max_tokens} tokens</span><i><em style={{ width: `${Math.min(100, ragRun.trace.context.tokens / ragRun.trace.context.max_tokens * 100)}%` }} /></i></div>{ragRun.trace.context.items.map((item: Dict, index: number) => <details key={item.id} open={index === 0}><summary><span>[{index + 1}] {item.document_title} · {item.section}</span><small>{item.tokens} tokens <ChevronDown size={14} /></small></summary><p>{item.text}</p></details>)}</div>}
              {traceTab === "prompt" && <div className="trace-content prompt-structure">{ragRun.trace.prompt.structure.map((row: string, index: number) => <div key={row}><span>{String(index + 1).padStart(2, "0")}</span><code>{row}</code></div>)}<p><CircleDot size={14} /> 这里只展示可公开的 Prompt 组成，不展示 Chain-of-Thought。</p></div>}
            </section>
            <div className="step-done-banner"><Check size={16} /><div><strong>知识工程 06 完成</strong><span>你已完整体验 RAG：从问题向量化到证据接地作答。可在报告中心记录这次的知识增益结论。</span></div><button className="btn ghost compact" onClick={() => navigate("/report/experiment/06")}>去写实验报告<ArrowRight size={15} /></button></div>
          </>}
          {!ragRun && !busy && <EmptyState title="尚未运行对比">运行后并排查看 Base LLM 与 Crypto-RAG 的答案和评分。</EmptyState>}
          <StepNav onBack={goBack} nextDisabled nextLabel="已完成" />
        </section>
      )}
    </div>
  );
}

function StepHead({ kicker, title, why, badge }: { kicker: string; title: string; why: string; badge?: React.ReactNode }) {
  return <>
    <div className="step-head">
      <div className="step-head-copy"><span className="step-kicker">{kicker}</span><h2>{title}</h2></div>
      {badge}
    </div>
    <div className="step-why"><Info size={16} /><span><strong>这一步在做什么：</strong>{why}</span></div>
  </>;
}

function RunBar({ label, hint, done, busy, onRun, runLabel }: { label: string; hint: string; done: boolean; busy: boolean; onRun: () => void; runLabel: string }) {
  return <div className={`step-run-bar ${done ? "done" : ""}`}>
    <div><strong>{label}</strong><small>{hint}</small></div>
    <button className={`btn primary ${busy ? "is-running" : ""}`} onClick={onRun} disabled={busy} aria-busy={busy}>{busy ? <><LoaderCircle className="spin" size={16} />运行中…</> : <><Play size={16} />{runLabel}</>}</button>
  </div>;
}

function QuestionRecap({ query }: { query: string }) {
  return <div className="question-recap"><Search size={15} /><p>{query}</p></div>;
}

function RagExecutionState() {
  const phases = ["准备问题", "知识检索", "Rerank", "组装上下文", "双路生成", "事实评分"];
  return <section className="rag-execution" role="status" aria-live="polite" aria-busy="true">
    <div className="rag-execution-head"><span className="loading-orbit blue"><LoaderCircle className="spin" size={25} /><i /></span><div><strong>正在执行 A/B 对比</strong><small>请等待 Base LLM、Crypto-RAG 和关键事实评分全部完成。</small></div><Pill tone="blue">PROCESSING</Pill></div>
    <div className="execution-phases" aria-label={`处理流程：${phases.join("、")}`}>{phases.map((phase, index) => <span key={phase} style={{ animationDelay: `${index * .32}s` }}><i />{phase}</span>)}</div>
  </section>;
}

function CitationList({ citations }: { citations: Dict[] }) {
  return <div className="citation-list"><strong><Quote size={15} /> 可核验来源</strong>{citations.map((cite) => <span key={cite.chunk_id}><b>[{cite.index}]</b>{cite.document}<small>{cite.source_type} · {cite.source_date || "未标日期"} · {cite.section}</small>{cite.source_url && <a href={cite.source_url} target="_blank" rel="noreferrer">查看原始来源</a>}{cite.scenario_notice && <em>{cite.scenario_notice}</em>}</span>)}</div>;
}

function GainPanel({ benchmark }: { benchmark: Dict }) {
  return <section className="gain-panel"><div className="panel-head"><div><h2>知识增益计分板</h2><p>{benchmark.scoring_note}</p></div><Pill tone={benchmark.knowledge_gain > 0 ? "mint" : "amber"}>知识增益 {benchmark.knowledge_gain > 0 ? "+" : ""}{benchmark.knowledge_gain}</Pill></div><div className="gain-summary"><article><span>对照组 · Base LLM</span><strong>{benchmark.base_score}</strong><small>关键事实命中率</small></article><ArrowRight /><article className="rag-score"><span>实验组 · Crypto-RAG</span><strong>{benchmark.rag_score}</strong><small>关键事实命中率</small></article></div><div className="fact-check-grid">{benchmark.facts.map((fact: Dict) => <div key={fact.id}><span>{fact.label}</span><i className={fact.base_hit ? "hit" : "miss"}>{fact.base_hit ? "✓ 对照" : "× 对照"}</i><i className={fact.rag_hit ? "hit" : "miss"}>{fact.rag_hit ? "✓ RAG" : "× RAG"}</i></div>)}</div>{benchmark.missing_document_ids.length > 0 && <div className="error-banner">知识库缺少：{benchmark.missing_document_ids.join("、")}。请回到实验 05 选中挑战包并重建。</div>}</section>;
}

function RagGate() {
  const navigate = useNavigate();
  return <div className="gate"><BrainCircuit size={38} /><h1>需要先完成实验 05</h1><p>请先选中与基准题对应的“RAG 证据挑战包”或“国产密码与 TEE 专题包”，构建知识库后再运行证据基准。</p><button className="btn primary" onClick={() => navigate("/lab/knowledge")}>前往实验 05</button></div>;
}
