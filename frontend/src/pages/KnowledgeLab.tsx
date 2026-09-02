import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Box, Check, Code2, Database, Download, ExternalLink, FileCode2, FileText, FileType2, Info, LoaderCircle, Play, RotateCcw, Search, Sparkles, Trash2, UploadCloud, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { EmptyState, Metric, Pill, StepNav, Stepper, type StepMeta } from "../components/UI";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const evidenceDocumentIds = ["nist_fips203", "nist_ir8547", "nsa_cnsa20", "nist_hqc_2025", "nist_ir8610_2026", "hailan_crypto_manual"];
const defaultDocumentIds = ["aes", "rsa", "ecc", "sm4", "tee", "he", "mpc", ...evidenceDocumentIds];
const exampleQueries = ["事件 CRYPTO-2026-04 的 KMS 批次和验证标签是什么？", "GM/T 0009—2023 何时实施，旧版何时废止？", "鲲鹏 secGear 的 ARM 构建参数和运行路径是什么？", "PhyTCM、PhyCrypto 与 PhyTEE 分别解决什么问题？"];

const steps: StepMeta[] = [
  { title: "选择资料", caption: "语料来源" },
  { title: "解析文本", caption: "Parse" },
  { title: "Chunk 切分", caption: "Chunk" },
  { title: "Embedding", caption: "向量化" },
  { title: "建立索引", caption: "Index" },
  { title: "向量检索", caption: "Search" },
];

export function KnowledgeLab() {
  const { bootstrap, project, kb, setKb, refreshProject } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(defaultDocumentIds);
  const [documents, setDocuments] = useState<Dict[]>([]);
  const [hiddenPresetIds, setHiddenPresetIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [chunkSize, setChunkSize] = useState(512);
  const [overlap, setOverlap] = useState(64);

  const [parseResult, setParseResult] = useState<Dict | null>(null);
  const [chunkResult, setChunkResult] = useState<Dict | null>(null);
  const [embedResult, setEmbedResult] = useState<Dict | null>(null);
  const [searchResult, setSearchResult] = useState<Dict | null>(null);

  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(exampleQueries[0]);
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.02);
  const [preview, setPreview] = useState<Dict | null>(null);
  const [activeChunk, setActiveChunk] = useState<Dict | null>(null);
  const [error, setError] = useState("");
  const selectionTouched = useRef(false);
  const paramsTouched = useRef(false);

  useEffect(() => {
    if (project?.stats.knowledge_base && !kb) api.kbStats(project.id).then(setKb).catch(() => undefined);
    if (project) api.projectDocuments(project.id).then(setDocuments).catch(() => undefined);
  }, [project?.id]);

  useEffect(() => {
    if (!selectionTouched.current) { selectionTouched.current = true; return; }
    setParseResult(null); setChunkResult(null); setEmbedResult(null); setSearchResult(null);
  }, [selected]);

  useEffect(() => {
    if (!paramsTouched.current) { paramsTouched.current = true; return; }
    setChunkResult(null); setEmbedResult(null); setSearchResult(null);
  }, [chunkSize, overlap]);

  const completed = useMemo(() => {
    if (!selected.length) return 0;
    if (!parseResult) return 1;
    if (!chunkResult) return 2;
    if (!embedResult) return 3;
    if (!kb) return 4;
    return 5;
  }, [selected.length, parseResult, chunkResult, embedResult, kb]);

  useEffect(() => { if (step > completed) setStep(completed); }, [completed, step]);

  if (!project) return <ProjectGate />;

  const allDocs = documents.length ? documents : (bootstrap?.documents || []);
  const uploadedDocs = allDocs.filter((d: Dict) => d.source === "upload");
  const presetGridDocs = allDocs.filter((d: Dict) => d.source !== "upload" && !hiddenPresetIds.includes(d.id));

  const toggleDocument = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const uploadFiles = async (files: FileList | File[]) => {
    const queue = Array.from(files);
    if (!queue.length) return;
    setUploading(true); setError(""); setUploadMessage("");
    const uploaded: Dict[] = [];
    try {
      for (const file of queue) uploaded.push(await api.uploadDocument(project.id, file));
      setDocuments((current) => [...current, ...uploaded]);
      setSelected((current) => [...new Set([...current, ...uploaded.map((item) => item.id)])]);
      setUploadMessage(`已解析 ${uploaded.length} 份资料，并自动加入本次知识库`);
    } catch (err) {
      setError((err as Error).message);
      if (uploaded.length) {
        setDocuments((current) => [...current, ...uploaded]);
        setSelected((current) => [...new Set([...current, ...uploaded.map((item) => item.id)])]);
      }
    } finally {
      setUploading(false); setDragging(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const deleteDocument = async (documentId: string) => {
    setError("");
    try {
      await api.deleteDocument(project.id, documentId);
      setDocuments((current) => current.filter((item) => item.id !== documentId));
      setSelected((current) => current.filter((id) => id !== documentId));
    } catch (err) { setError((err as Error).message); }
  };

  const removePresetDocument = (documentId: string) => {
    setHiddenPresetIds((current) => current.includes(documentId) ? current : [...current, documentId]);
    setSelected((current) => current.filter((id) => id !== documentId));
  };

  const bulkDeleteUploaded = async () => {
    const ids = uploadedDocs.map((d) => d.id);
    if (!ids.length) return;
    setError("");
    try {
      await api.bulkDeleteDocuments(project.id, ids);
      setDocuments((current) => current.filter((item) => item.source !== "upload"));
      setSelected((current) => current.filter((id) => !ids.includes(id)));
    } catch (err) { setError((err as Error).message); }
  };

  const allVisibleIds = [...uploadedDocs, ...presetGridDocs].map((d: Dict) => d.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id: string) => selected.includes(id));
  const toggleSelectAll = () => setSelected(allSelected ? [] : allVisibleIds);

  const runParse = async () => {
    setError(""); setBusy(true);
    try { setParseResult(await api.kbParse({ project_id: project.id, document_ids: selected })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const runChunk = async () => {
    setError(""); setBusy(true);
    try { setChunkResult(await api.kbChunk({ project_id: project.id, document_ids: selected, chunk_size: chunkSize, overlap })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const runEmbed = async () => {
    setError(""); setBusy(true);
    try { setEmbedResult(await api.kbEmbed({ project_id: project.id, document_ids: selected, chunk_size: chunkSize, overlap })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const runBuild = async () => {
    setError(""); setBusy(true);
    try {
      const result = await api.buildKb({ project_id: project.id, document_ids: selected, chunk_size: chunkSize, overlap, embedding_model: bootstrap?.providers.embedding });
      setKb(result); await refreshProject();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const runSearch = async () => {
    setError(""); setBusy(true);
    try { setSearchResult(await api.search({ project_id: project.id, query, top_k: topK, threshold })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const resetExperiment = async () => {
    setError("");
    try {
      await api.resetKb(project.id);
      setKb(null); setParseResult(null); setChunkResult(null); setEmbedResult(null); setSearchResult(null);
      setHiddenPresetIds([]);
      setSelected(defaultDocumentIds);
      setStep(0);
      await refreshProject();
    } catch (err) { setError((err as Error).message); }
  };

  const goNext = () => setStep((s) => Math.min(s + 1, 5));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="lab-page">
      <div className="page-title"><div><Pill tone="blue">实验 05 · 知识工程</Pill><h1>从密码学资料到<span>向量知识库</span></h1><p>把文档加工为可检索知识。每一步都是一个独立小实验：先看清这一步做什么，再亲手运行、观察它真实的中间产物。</p></div>{(kb || completed > 0) && <button className="btn ghost compact reset-exp" onClick={resetExperiment} title="清空已建知识库并回到第一步"><RotateCcw size={14} />重新开始本实验</button>}</div>

      <Stepper steps={steps} current={step} furthest={completed} onSelect={setStep} />

      {error && <div className="error-banner">{error}</div>}

      {step === 0 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 01 / 06" title="选择或上传密码学资料"
            why="RAG 的一切都建立在语料之上。这一步不做任何计算，只决定“知识边界”——知识库里没有的内容，后面再强的检索也找不出来。" badge={<Pill tone="blue">{selected.length} 份已选</Pill>} />

          <div
            className={`upload-zone ${dragging ? "dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}
          >
            <input ref={fileInput} type="file" multiple hidden aria-label="上传密码学资料" accept=".txt,.md,.markdown,.pdf,.py,.js,.jsx,.ts,.tsx,.java,.c,.h,.cpp,.hpp,.cc,.go,.rs,.sol,.json,.yaml,.yml,.toml,.sh,.sql,.html,.css" onChange={(event) => event.target.files && void uploadFiles(event.target.files)} />
            <div className="upload-icon"><UploadCloud size={22} /></div>
            <div><strong>{uploading ? "正在安全解析资料…" : "拖拽资料到这里，或选择文件"}</strong><span>支持 TXT / Markdown / PDF / Code · 单文件 ≤ 10 MB</span></div>
            <button className="btn primary" disabled={uploading} onClick={() => fileInput.current?.click()}><UploadCloud size={16} />{uploading ? "解析中…" : "选择文件"}</button>
          </div>
          {uploadMessage && <div className="upload-success"><Check size={14} />{uploadMessage}</div>}

          {uploadedDocs.length > 0 && <div className="doc-section">
            <div className="doc-section-head"><span className="doc-section-title">我的上传</span><small>{uploadedDocs.length} 份 · 可删除</small><div className="doc-section-spacer" /><button className="btn ghost compact danger" onClick={bulkDeleteUploaded}><Trash2 size={14} />清空上传</button></div>
            <div className="document-grid">
              {uploadedDocs.map((document) => <article className={`document-card user-document ${selected.includes(document.id) ? "selected" : ""}`} key={document.id} style={{ "--doc-color": document.accent } as React.CSSProperties}>
                <button className="doc-select" aria-label={`选择 ${document.title}`} onClick={() => toggleDocument(document.id)}>{selected.includes(document.id) && <Check size={13} />}</button>
                <div className="doc-file">{document.file_kind === "code" ? <Code2 size={21} /> : document.file_kind === "pdf" ? <FileType2 size={21} /> : <FileText size={21} />}</div><div className="doc-copy"><strong>{document.filename}</strong><span>{document.title}</span><small>{document.category} · {document.file_kind === "code" ? document.language : document.level} · 已上传</small></div>
                <div className="doc-actions"><button className="doc-preview" onClick={() => api.document(document.id, project.id).then(setPreview)} aria-label={`预览 ${document.title}`}><FileCode2 size={15} /></button><button className="doc-delete" onClick={() => deleteDocument(document.id)} aria-label={`删除 ${document.title}`}><Trash2 size={15} /></button></div>
              </article>)}
            </div>
          </div>}

          <div className="doc-section">
            <div className="doc-section-head"><span className="doc-section-title">课程语料</span><div className="doc-section-spacer" /><label className="corpus-check"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="全选" /><span>{allSelected ? "取消全选" : "全选"}</span></label></div>
            <div className="document-grid">
              {presetGridDocs.map((document) => <article className={`document-card user-document ${selected.includes(document.id) ? "selected" : ""}`} key={document.id} style={{ "--doc-color": document.accent } as React.CSSProperties}>
                <button className="doc-select" aria-label={`选择 ${document.title}`} onClick={() => toggleDocument(document.id)}>{selected.includes(document.id) && <Check size={13} />}</button>
                <div className="doc-file">{document.file_kind === "code" ? <Code2 size={21} /> : document.file_kind === "pdf" ? <FileType2 size={21} /> : <FileText size={21} />}</div><div className="doc-copy"><strong>{document.filename}</strong><span>{document.title}</span><small>{document.category} · {document.file_kind === "code" ? document.language : document.level}</small>{document.source_type && <em>{document.source_type}{document.source_date ? ` · ${document.source_date}` : ""}</em>}</div>
                <div className="doc-actions"><button className="doc-preview" onClick={() => api.document(document.id, project.id).then(setPreview)} aria-label={`预览 ${document.title}`}><FileCode2 size={15} /></button><button className="doc-delete" onClick={() => removePresetDocument(document.id)} aria-label={`移除 ${document.title}`}><Trash2 size={15} /></button></div>
              </article>)}
            </div>
          </div>
          <StepNav onNext={goNext} nextDisabled={selected.length === 0} nextHint={selected.length === 0 ? "至少选择一份资料才能继续" : `已选 ${selected.length} 份，进入解析`} backDisabled />
        </section>
      )}

      {step === 1 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 02 / 06" title="解析文本"
            why="不同格式要先统一读成干净文本。TXT / Markdown / 代码直接读取；上传的 PDF 会逐页转成图片交给 VLM 还原为 Markdown（表格、公式、扫描件都能处理），未配置 VLM 时回退 pypdf 文本抽取。" />
          <RunBar label="解析所选资料" hint={`将读取 ${selected.length} 份资料；PDF 优先走 VLM 转 Markdown`} done={!!parseResult} busy={busy} onRun={runParse} runLabel={parseResult ? "重新解析" : "运行解析"} />
          {parseResult && <>
            {parseResult.vlm_ready === false && parseResult.documents.some((d: Dict) => d.file_kind === "pdf") && <div className="stale-note"><Info size={15} /><span>未配置阅卷/解析 VLM，PDF 使用 pypdf 文本抽取；扫描件可能无法提取文字。配置 VLM 后重新解析即可转为高质量 Markdown。</span></div>}
            <div className="step-stat-row">
              <Metric label="文档" value={parseResult.document_count} />
              <Metric label="总字符" value={parseResult.total_chars} tone="blue" />
              <Metric label="识别段落" value={parseResult.total_sections} tone="purple" />
              <Metric label="解析耗时" value={parseResult.latency_ms} suffix="ms" tone="amber" />
            </div>
            <div className="parse-doc-list">
              {parseResult.documents.map((doc: Dict) => <button key={doc.id} className="parse-doc-card" style={{ "--doc-color": doc.accent } as React.CSSProperties} onClick={() => api.document(doc.id, project.id).then(setPreview)}>
                <i>{doc.file_kind === "code" ? <Code2 size={17} /> : doc.file_kind === "pdf" ? <FileType2 size={17} /> : <FileText size={17} />}</i>
                <div className="parse-doc-copy"><strong>{doc.title}</strong><small>{doc.format} · {doc.chars} 字 · {doc.section_count} 段{doc.pages ? ` · ${doc.pages} 页` : ""}</small>{doc.parse_note && <em className="parse-doc-note">{doc.parse_note}</em>}<p>{doc.preview}</p></div>
                <span className={`parse-method-badge ${doc.parse_method === "vlm" ? "vlm" : ""}`}>{doc.parse_method === "vlm" ? "VLM · MD" : doc.parse_method === "pypdf" ? "pypdf" : doc.file_kind === "code" ? "Code" : "MD"}</span>
              </button>)}
            </div>
            <div className="observer-note"><Info size={15} /><span>点击任意卡片可查看该文档的完整解析结果与标题树。绿色 VLM·MD 表示 PDF 已被视觉模型还原为结构化 Markdown。</span></div>
          </>}
          {!parseResult && <EmptyState title="尚未解析">点击上方“运行解析”，把原始资料读成结构化文本。</EmptyState>}
          <StepNav onBack={goBack} onNext={goNext} nextDisabled={!parseResult} nextHint={!parseResult ? "先运行解析" : "进入 Chunk 切分"} />
        </section>
      )}

      {step === 2 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 03 / 06" title="Chunk 切分"
            why="大模型和向量检索都有长度上限，必须把长文切成片段。切太大→检索不精准；切太小→语义被截断。重叠（overlap）用来避免关键句被切在边界。" />
          <div className="step-params">
            <label>Chunk Size <b>{chunkSize}</b><input type="range" min="128" max="1024" step="128" value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))} /><span className="range-ends"><small>128</small><small>1024</small></span></label>
            <label>Chunk Overlap <b>{overlap}</b><input type="range" min="0" max="128" step="32" value={overlap} onChange={(e) => setOverlap(Number(e.target.value))} /><span className="range-ends"><small>0</small><small>128</small></span></label>
          </div>
          <RunBar label="按当前参数切分" hint="改动滑块后需重新切分才会生效" done={!!chunkResult} busy={busy} onRun={runChunk} runLabel={chunkResult ? "重新切分" : "运行切分"} />
          {chunkResult && <>
            <div className="step-stat-row">
              <Metric label="Chunk 数" value={chunkResult.chunk_count} />
              <Metric label="平均字符" value={chunkResult.avg_chars} tone="blue" />
              <Metric label="最短 / 最长" value={`${chunkResult.min_chars} / ${chunkResult.max_chars}`} tone="purple" />
              <Metric label="平均 Tokens" value={chunkResult.avg_tokens} tone="amber" />
            </div>
            <div className="chunk-observer">
              <div className="observer-head"><div><h3>Chunk Observer</h3><span>点击片段检查来源、长度</span></div><div className="legend"><i className="dot mint" /> 基础密码 <i className="dot blue" /> 公钥/隐私计算</div></div>
              <div className="chunk-map">
                {chunkResult.chunks.map((chunk: Dict, index: number) => <button key={chunk.id} className="chunk-cell" onClick={() => setActiveChunk(chunk)} style={{ "--chunk-color": chunk.accent } as React.CSSProperties} title={`${chunk.document_title} · ${chunk.section}`}>
                  <span className="chunk-cell-head"><b>片段 {String(index + 1).padStart(2, "0")}</b><small>{chunk.chars} 字</small></span>
                  <strong>{chunk.document_title}</strong>
                  <em>{chunk.section}</em>
                </button>)}
              </div>
              <div className="teaching-tip"><Box size={18} /><strong>试着故意做错</strong><p>把 Chunk Size 拉到最小或 overlap 设为 0，再重新切分，观察片段数量与语义完整度的变化。</p></div>
            </div>
          </>}
          {!chunkResult && <EmptyState title="尚未切分">调整参数并运行切分，观察 Chunk 数量与长度分布。</EmptyState>}
          <StepNav onBack={goBack} onNext={goNext} nextDisabled={!chunkResult} nextHint={!chunkResult ? "先运行切分" : "进入 Embedding"} />
        </section>
      )}

      {step === 3 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 04 / 06" title="Embedding 向量化"
            why="计算机不能直接比较文字含义，必须先把每个 Chunk 映射成高维向量。语义相近的片段，向量方向也相近——这正是后面“向量检索”的基础。" />
          <RunBar label="为每个 Chunk 生成向量" hint={chunkResult ? `将向量化 ${chunkResult.chunk_count} 个片段` : "使用上一步的切分结果"} done={!!embedResult} busy={busy} onRun={runEmbed} runLabel={embedResult ? "重新向量化" : "运行向量化"} />
          {embedResult && <>
            <div className="embedding-line"><span>EMBEDDING MODEL</span><strong>{embedResult.dimension}D</strong><code>{embedResult.model}</code><small>{embedResult.latency_ms} ms</small></div>
            <div className="chunk-map">
              {embedResult.chunks.map((chunk: Dict, index: number) => <button key={chunk.id} className="chunk-cell" onClick={() => setActiveChunk(chunk)} style={{ "--chunk-color": chunk.accent } as React.CSSProperties} title={`${chunk.document_title} · ${chunk.section}`}>
                <span className="chunk-cell-head"><b>片段 {String(index + 1).padStart(2, "0")}</b><small>‖v‖={chunk.vector_norm}</small></span>
                <strong>{chunk.document_title}</strong>
                <code className="vector-inline">[{chunk.embedding_preview.slice(0, 5).join(", ")}, …]</code>
              </button>)}
            </div>
            <div className="observer-note"><Sparkles size={15} /><span>每个片段现在都是一个 {embedResult.dimension} 维向量（此处只展示前几维）。点击卡片可查看更完整的向量预览。</span></div>
          </>}
          {!embedResult && <EmptyState title="尚未向量化">运行向量化，把文字片段变成可计算的向量。</EmptyState>}
          <StepNav onBack={goBack} onNext={goNext} nextDisabled={!embedResult} nextHint={!embedResult ? "先运行向量化" : "进入建立索引"} />
        </section>
      )}

      {step === 4 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 05 / 06" title="建立向量索引"
            why="把所有向量写入向量库并建立索引，检索时才能在毫秒级找到最相近的片段。这一步会正式生成知识库，供检索与实验 06 的 RAG 使用。" />
          <RunBar label="写入向量库并建立索引" hint="完成后知识库即就绪，可被 RAG 引用" done={!!kb} busy={busy} onRun={runBuild} runLabel={kb ? "按当前参数重建" : "建立知识库"} />
          {kb ? <>
            <div className="success-banner"><span><Check size={15} /></span><div><strong>{kb.name} 已就绪</strong><small>{kb.id} · {kb.vector_store}</small></div><Pill tone="mint">INDEX READY</Pill></div>
            <div className="step-stat-row">
              <Metric label="Documents" value={kb.document_count} />
              <Metric label="Chunks" value={kb.chunk_count} tone="blue" />
              <Metric label="Avg. Tokens" value={kb.avg_tokens} tone="purple" />
              <Metric label="Build Time" value={kb.build_ms} suffix="ms" tone="amber" />
            </div>
            <div className="observer-note"><Info size={15} /><span>索引已建立。现在知识库“会找知识”了——但它只负责找，不负责回答。下一步亲手检索验证。</span></div>
          </> : <EmptyState title="尚未建立索引">运行后将生成正式知识库。</EmptyState>}
          <StepNav onBack={goBack} onNext={goNext} nextDisabled={!kb} nextHint={!kb ? "先建立索引" : "进入向量检索"} />
        </section>
      )}

      {step === 5 && (
        <section className="panel step-panel">
          <StepHead kicker="STEP 06 / 06" title="向量检索实验"
            why="检索 = 把问题也变成向量，再找出方向最接近的片段。请记住：知识库只负责“找到相关知识”，不负责“回答问题”——回答是实验 06 的 RAG 才做的事。" badge={<Pill tone="neutral"><Database size={13} /> VECTOR SEARCH</Pill>} />
          <div className="step-params">
            <label>Search Top-K <b>{topK}</b><input type="range" min="1" max="20" value={topK} onChange={(e) => setTopK(Number(e.target.value))} /><span className="range-ends"><small>1</small><small>20</small></span></label>
            <label>Similarity Threshold <b>{threshold.toFixed(2)}</b><input type="range" min="-0.1" max="0.8" step="0.02" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /><span className="range-ends"><small>噪声更多</small><small>过滤严格</small></span></label>
          </div>
          <div className="query-composer"><Search size={19} /><textarea aria-label="向量检索问题" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="btn primary" disabled={busy} onClick={runSearch}>{busy ? "检索中…" : "运行检索"}<ArrowRight size={16} /></button></div>
          <div className="examples">示例：{exampleQueries.map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
          {searchResult && <div className="retrieval-results">
            <div className="embedding-line"><span>QUERY EMBEDDING</span><strong>{searchResult.embedding.dimension}D</strong><code>[{searchResult.embedding.preview.slice(0, 5).join(", ")}, …]</code><small>{searchResult.latency_ms} ms</small></div>
            <div className="diagnosis"><Sparkles size={15} /><span>{searchResult.explanation}</span></div>
            <div className="result-table"><div className="result-row table-head"><span>RANK</span><span>SOURCE / CHUNK</span><span>CONTENT PREVIEW</span><span>SIMILARITY</span></div>
              {searchResult.results.map((row: Dict, index: number) => <div className="result-row" key={row.id}><span className="rank">{String(index + 1).padStart(2, "0")}</span><span><strong>{row.document_title}</strong><small>{row.section} · {row.id}</small></span><p>{row.text}</p><span className="score"><i style={{ width: `${Math.max(5, row.score * 100)}%` }} /><b>{row.score.toFixed(3)}</b></span></div>)}
              {!searchResult.results.length && <EmptyState title="零个检索结果">当前阈值过滤了全部片段，这是有效的“破坏实验”结果。</EmptyState>}
            </div>
          </div>}
          {!searchResult && <EmptyState title="尚未检索">输入问题并运行检索，看看知识库找回哪些片段。</EmptyState>}
          <div className="step-done-banner"><Check size={16} /><div><strong>知识工程 05 完成</strong><span>你已亲手走完“资料 → 解析 → 切分 → 向量 → 索引 → 检索”。接下来在实验 06 让 LLM 用这些证据作答。</span></div><button className="btn ghost compact" onClick={() => navigate("/lab/rag")}>前往实验 06<ArrowRight size={15} /></button></div>
          <StepNav onBack={goBack} nextDisabled nextLabel="已完成" />
        </section>
      )}

      {preview && <div className="drawer-backdrop" onMouseDown={() => setPreview(null)}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}><button className="drawer-close" onClick={() => setPreview(null)}><X /></button><Pill tone="blue">PARSED {preview.parsed.format?.toUpperCase()}</Pill><h2>{preview.title}</h2><div className="parse-meta"><span>{preview.filename}</span><span>{preview.parsed.chars} chars</span>{preview.parsed.pages && <span>{preview.parsed.pages} pages</span>}{preview.parsed.language && <span>{preview.parsed.language}</span>}<span>{preview.parsed.headings.length} sections</span></div>{preview.source_type && <div className="evidence-source-note"><strong>{preview.source_type}</strong><span>{preview.source_title}</span><small>{preview.source_date || "未标日期"}{preview.source_url ? " · 可在线核验" : ""}</small></div>}{(preview.local_original || preview.local_excerpt) && <div className="local-evidence-actions">{preview.local_original && <a className="btn ghost compact" href={`/api/evidence/${preview.id}/original`} target="_blank" rel="noreferrer"><ExternalLink size={14} />{preview.local_original.toLowerCase().endsWith(".pdf") ? "本地原始 PDF" : "本地官方资料"}</a>}{preview.local_excerpt && <a className="btn ghost compact" href={`/api/evidence/${preview.id}/excerpt`} target="_blank" rel="noreferrer"><Download size={14} />本地摘编</a>}<small>无需访问互联网；在线来源仍用于版本核验。</small></div>}<pre>{preview.content}</pre></aside></div>}
      {activeChunk && <div className="drawer-backdrop" onMouseDown={() => setActiveChunk(null)}><aside className="drawer compact-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="drawer-close" onClick={() => setActiveChunk(null)}><X /></button><Pill tone="mint">{activeChunk.id}</Pill><h2>{activeChunk.section}</h2><div className="parse-meta"><span>{activeChunk.document_title}</span><span>{activeChunk.chars} chars</span><span>{activeChunk.tokens} tokens</span></div><p className="chunk-full-text">{activeChunk.text}</p>{activeChunk.embedding_preview && <><h3>Embedding Preview</h3><code className="vector-code">[{activeChunk.embedding_preview.join(", ")}, …]</code><p className="dim-note">只展示前 8 维；完整向量为 {embedResult?.dimension || kb?.dimension} 维。</p></>}</aside></div>}
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

function ProjectGate() {
  const navigate = useNavigate();
  return <div className="gate"><Database size={38} /><h1>先创建一个实验项目</h1><p>项目用于串联知识库、RAG、Agent 和报告。</p><button className="btn primary" onClick={() => navigate("/")}>返回总览创建项目</button></div>;
}
