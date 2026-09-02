import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, BookOpenCheck, Box, Check, ChevronDown, Code2, Database, Download, ExternalLink, FileCode2, FileText, FileType2, LoaderCircle, Play, Search, SlidersHorizontal, Sparkles, UploadCloud, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { EmptyState, Flow, LoadingBlock, Metric, Pill } from "../components/UI";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const evidenceDocumentIds = ["nist_fips203", "nist_ir8547", "nsa_cnsa20", "nist_hqc_2025", "nist_ir8610_2026", "hailan_crypto_manual"];
const domesticEvidenceIds = ["cn_sm3_gbt32905", "cn_sm4_gbt32907", "cn_sm2_gbt35276", "cn_crypto_baseline_gbt39786", "gmit_2023_revision", "gmit_eval_2021", "kunpeng_secgear_dev", "kunpeng_secgear_attestation", "phytium_phytee_platform", "phytium_tee_architecture"];
const defaultDocumentIds = ["aes", "rsa", "ecc", "sm4", "tee", "he", "mpc", ...evidenceDocumentIds];
const exampleQueries = ["事件 CRYPTO-2026-04 的 KMS 批次和验证标签是什么？", "GM/T 0009—2023 何时实施，旧版何时废止？", "鲲鹏 secGear 的 ARM 构建参数和运行路径是什么？", "PhyTCM、PhyCrypto 与 PhyTEE 分别解决什么问题？"];

export function KnowledgeLab() {
  const { bootstrap, project, kb, setKb, refreshProject } = useApp();
  const [selected, setSelected] = useState<string[]>(defaultDocumentIds);
  const [documents, setDocuments] = useState<Dict[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [chunkSize, setChunkSize] = useState(512);
  const [overlap, setOverlap] = useState(64);
  const [building, setBuilding] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState(exampleQueries[0]);
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.02);
  const [searchResult, setSearchResult] = useState<Dict | null>(null);
  const [preview, setPreview] = useState<Dict | null>(null);
  const [activeChunk, setActiveChunk] = useState<Dict | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (project?.stats.knowledge_base && !kb) api.kbStats(project.id).then(setKb).catch(() => undefined);
    if (project) api.projectDocuments(project.id).then(setDocuments).catch(() => undefined);
  }, [project?.id]);

  const avgChunkWidth = useMemo(() => kb?.chunks?.length ? Math.round(kb.chunks.reduce((sum: number, row: Dict) => sum + row.chars, 0) / kb.chunks.length) : 0, [kb]);

  if (!project) return <ProjectGate />;

  const presetDocs = (bootstrap?.documents || []).filter((d: Dict) => d.source !== "upload");
  const manualCategories = Array.from(new Set(presetDocs.map((d) => d.category)));

  const toggleDocument = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const togglePack = (ids: string[]) => setSelected((current) => {
    const allSelected = ids.every((id) => current.includes(id));
    return allSelected ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])];
  });
  const evidencePackSelected = evidenceDocumentIds.every((id) => selected.includes(id));
  const evidencePackPartial = !evidencePackSelected && evidenceDocumentIds.some((id) => selected.includes(id));
  const domesticPackSelected = domesticEvidenceIds.every((id) => selected.includes(id));
  const domesticPackPartial = !domesticPackSelected && domesticEvidenceIds.some((id) => selected.includes(id));

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

  const build = async () => {
    setError(""); setBuilding(true); setSearchResult(null);
    try {
      const result = await api.buildKb({ project_id: project.id, document_ids: selected, chunk_size: chunkSize, overlap, embedding_model: bootstrap?.providers.embedding });
      setKb(result); await refreshProject();
    } catch (err) { setError((err as Error).message); }
    finally { setBuilding(false); }
  };

  const runSearch = async () => {
    setError(""); setSearching(true);
    try { setSearchResult(await api.search({ project_id: project.id, query, top_k: topK, threshold })); }
    catch (err) { setError((err as Error).message); }
    finally { setSearching(false); }
  };

  return (
    <div className="lab-page">
      <div className="page-title"><div><Pill tone="blue">实验 05 · 知识工程</Pill><h1>从密码学资料到<span>向量知识库</span></h1><p>把文档加工为可检索知识。重点观察每一步的中间产物，而不只是最终结果。</p></div></div>
      <Flow steps={["选择资料", "解析文本", "Chunk 切分", "Embedding", "建立索引", "向量检索"]} active={building ? 3 : kb ? 5 : 0} />

      <section className={`panel manual-inline ${manualOpen ? "open" : ""}`}>
        <button className="manual-inline-head" type="button" onClick={() => setManualOpen((v) => !v)}>
          <BookOpen size={18} />
          <div><strong>预置知识手册</strong><small>{presetDocs.length} 篇密码学基础文档 — 知识库、RAG 与智能体实验的领域知识来源</small></div>
          <ChevronDown size={18} className={`chevron ${manualOpen ? "open" : ""}`} />
        </button>
        {manualOpen && <div className="manual-inline-body">
          {manualCategories.map((cat) => <div key={cat} className="manual-inline-cat">
            <span className="manual-inline-cat-label">{cat}</span>
            <div className="manual-grid compact">
              {presetDocs.filter((d) => d.category === cat).map((doc) => <button className="manual-card compact" key={doc.id} onClick={() => api.document(doc.id, project.id).then(setPreview)} style={{ ["--doc-accent" as string]: doc.accent }}>
                <i><FileText size={16} /></i>
                <div><strong>{doc.title}</strong><small>{doc.filename} · {doc.level} · {doc.chars} 字</small></div>
              </button>)}
            </div>
          </div>)}
        </div>}
      </section>

      <div className="lab-layout">
        <div className="lab-main">
          <section className="panel">
            <div className="panel-head"><div><span className="step-label">STEP 01</span><h2>选择或上传密码学资料</h2><p>预置知识包 + 你的文本、PDF 和代码 · 点击文档可查看解析结果</p></div><Pill tone="blue">{selected.length} SELECTED</Pill></div>
            <div
              className={`upload-zone ${dragging ? "dragging" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
              onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}
            >
              <input ref={fileInput} type="file" multiple hidden aria-label="上传密码学资料" accept=".txt,.md,.markdown,.pdf,.py,.js,.jsx,.ts,.tsx,.java,.c,.h,.cpp,.hpp,.cc,.go,.rs,.sol,.json,.yaml,.yml,.toml,.sh,.sql,.html,.css" onChange={(event) => event.target.files && void uploadFiles(event.target.files)} />
              <div className="upload-icon"><UploadCloud size={22} /></div>
              <div><strong>{uploading ? "正在安全解析资料…" : "拖拽资料到这里，或选择文件"}</strong><span>TXT / Markdown / PDF / Code · 单文件不超过 10 MB · 代码只解析，不执行</span></div>
              <button className="btn ghost compact" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? "解析中…" : "选择文件"}</button>
            </div>
            {uploadMessage && <div className="upload-success"><Check size={14} />{uploadMessage}</div>}
            {error && <div className="error-banner">{error}</div>}
            <div className="evidence-pack-banner"><Sparkles size={17} /><div><strong>RAG 证据挑战包</strong><span>已预选 5 份 NIST / NSA 权威摘编 + 1 份课程私域手册，专门用于放大 Base LLM 与 RAG 的可测差异。</span></div><button className={`btn ghost compact pack-toggle ${evidencePackSelected ? "is-selected" : ""}`} aria-pressed={evidencePackSelected} onClick={() => togglePack(evidenceDocumentIds)}>{evidencePackSelected ? <><X size={16} />取消选中挑战包</> : <><Check size={16} />{evidencePackPartial ? "补全挑战包" : "选中挑战包"}</>}</button></div>
            <div className="evidence-pack-banner domestic-pack"><BookOpenCheck size={17} /><div><strong>国产密码与 TEE 专题包</strong><span>10 份国家标准、密码行业规范、鲲鹏 secGear 与飞腾 PhyTEE/PSPA 官方资料；原文和教学摘编均已同步到本地。</span></div><button className={`btn ghost compact pack-toggle ${domesticPackSelected ? "is-selected" : ""}`} aria-pressed={domesticPackSelected} onClick={() => togglePack(domesticEvidenceIds)}>{domesticPackSelected ? <><X size={16} />取消选中专题包</> : <><Check size={16} />{domesticPackPartial ? "补全专题包" : "选中专题包"}</>}</button></div>
            <div className="document-grid">
              {(documents.length ? documents : bootstrap?.documents || []).map((document) => <article className={`document-card ${selected.includes(document.id) ? "selected" : ""} ${document.source === "upload" ? "user-document" : ""}`} key={document.id} style={{ "--doc-color": document.accent } as React.CSSProperties}>
                <button className="doc-select" aria-label={`选择 ${document.title}`} onClick={() => toggleDocument(document.id)}>{selected.includes(document.id) && <Check size={13} />}</button>
                <div className="doc-file">{document.file_kind === "code" ? <Code2 size={21} /> : document.file_kind === "pdf" ? <FileType2 size={21} /> : <FileText size={21} />}</div><div className="doc-copy"><strong>{document.filename}</strong><span>{document.title}</span><small>{document.category} · {document.file_kind === "code" ? document.language : document.level}{document.source === "upload" ? " · 已上传" : ""}</small>{document.source_type && <em>{document.source_type}{document.source_date ? ` · ${document.source_date}` : ""}</em>}</div>
                <button className="doc-preview" onClick={() => api.document(document.id, project.id).then(setPreview)} aria-label={`预览 ${document.title}`}><FileCode2 size={15} /></button>
              </article>)}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><div><span className="step-label">STEP 02—05</span><h2>切分、向量化并建立索引</h2><p>一次运行生成全部中间产物，可在下方逐个检查 Chunk 与向量预览。</p></div><button className={`btn primary ${building ? "is-running" : ""}`} onClick={build} disabled={building || selected.length === 0} aria-busy={building}>{building ? <><LoaderCircle className="spin" size={16} />构建中…</> : <><Play size={16} />{kb ? "按当前参数重建" : "构建知识库"}</>}</button></div>
            {building ? <LoadingBlock label="正在构建向量知识库" detail="系统正在解析资料、切分 Chunk、生成向量并写入索引。" phases={["解析资料", "Chunk 切分", "Embedding", "建立索引"]} /> : kb ? <>
              <div className="success-banner"><span><Check size={15} /></span><div><strong>{kb.name} 已就绪</strong><small>{kb.id} · {kb.vector_store}</small></div><Pill tone="mint">INDEX READY</Pill></div>
              <div className="metrics-row"><Metric label="Documents" value={kb.document_count} /><Metric label="Chunks" value={kb.chunk_count} tone="blue" /><Metric label="Avg. Tokens" value={kb.avg_tokens} tone="purple" /><Metric label="Build Time" value={kb.build_ms} suffix="ms" tone="amber" /></div>
              <div className="chunk-observer">
                <div className="observer-head"><div><h3>Chunk Observer</h3><span>点击片段检查来源、长度和向量</span></div><div className="legend"><i className="dot mint" /> 基础密码 <i className="dot blue" /> 公钥/隐私计算</div></div>
                <div className="chunk-map">
                  {kb.chunks?.map((chunk: Dict, index: number) => <button
                    key={chunk.id}
                    className="chunk-cell"
                    onClick={() => setActiveChunk(chunk)}
                    style={{ "--chunk-color": chunk.accent } as React.CSSProperties}
                    title={`${chunk.document_title} · ${chunk.section}`}
                    aria-label={`查看片段 ${index + 1}：${chunk.document_title}，${chunk.section}`}
                  >
                    <span className="chunk-cell-head"><b>片段 {String(index + 1).padStart(2, "0")}</b><small>{chunk.chars} 字</small></span>
                    <strong>{chunk.document_title}</strong>
                    <em>{chunk.section}</em>
                  </button>)}
                </div>
                <div className="observer-note"><Sparkles size={15} /><span>每张卡片代表一个高维向量。颜色表示来源文档；卡片右上角直接标注 Chunk 字符数。当前平均长度 {avgChunkWidth} 字符。</span></div>
              </div>
            </> : <EmptyState title="尚未生成索引">选择资料并调整右侧参数，然后运行构建。你可以故意使用极端参数比较 Chunk 质量。</EmptyState>}
          </section>

          <section className="panel search-panel">
            <div className="panel-head"><div><span className="step-label">STEP 06</span><h2>向量检索实验</h2><p>知识库只负责寻找知识，不负责回答问题。</p></div><Pill tone="neutral"><Database size={13} /> VECTOR SEARCH</Pill></div>
            <div className="query-composer"><Search size={19} /><textarea aria-label="向量检索问题" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="btn primary" disabled={!kb || searching} onClick={runSearch}>{searching ? "检索中…" : "运行检索"}<ArrowRight size={16} /></button></div>
            <div className="examples">示例：{exampleQueries.map((item) => <button key={item} onClick={() => setQuery(item)}>{item}</button>)}</div>
            {searchResult && <div className="retrieval-results">
              <div className="embedding-line"><span>QUERY EMBEDDING</span><strong>{searchResult.embedding.dimension}D</strong><code>[{searchResult.embedding.preview.slice(0, 5).join(", ")}, …]</code><small>{searchResult.latency_ms} ms</small></div>
              <div className="diagnosis"><Sparkles size={15} /><span>{searchResult.explanation}</span></div>
              <div className="result-table"><div className="result-row table-head"><span>RANK</span><span>SOURCE / CHUNK</span><span>CONTENT PREVIEW</span><span>SIMILARITY</span></div>
                {searchResult.results.map((row: Dict, index: number) => <div className="result-row" key={row.id}><span className="rank">{String(index + 1).padStart(2, "0")}</span><span><strong>{row.document_title}</strong><small>{row.section} · {row.id}</small></span><p>{row.text}</p><span className="score"><i style={{ width: `${Math.max(5, row.score * 100)}%` }} /><b>{row.score.toFixed(3)}</b></span></div>)}
                {!searchResult.results.length && <EmptyState title="零个检索结果">当前阈值过滤了全部片段，这是有效的“破坏实验”结果。</EmptyState>}
              </div>
            </div>}
          </section>
        </div>

        <aside className="parameter-panel">
          <div className="parameter-title"><SlidersHorizontal size={18} /><div><strong>实验参数</strong><small>修改后重新构建</small></div></div>
          <label>Chunk Size <b>{chunkSize}</b><input type="range" min="128" max="1024" step="128" value={chunkSize} onChange={(event) => setChunkSize(Number(event.target.value))} /><span className="range-ends"><small>128</small><small>1024</small></span></label>
          <label>Chunk Overlap <b>{overlap}</b><input type="range" min="0" max="128" step="32" value={overlap} onChange={(event) => setOverlap(Number(event.target.value))} /><span className="range-ends"><small>0</small><small>128</small></span></label>
          <label>Embedding Model<select value={bootstrap?.providers.embedding || ""} disabled><option>{bootstrap?.providers.embedding}</option></select><small className="field-help">确定性离线教学向量，便于零配置运行。</small></label>
          <div className="parameter-divider" />
          <label>Search Top-K <b>{topK}</b><input type="range" min="1" max="20" value={topK} onChange={(event) => setTopK(Number(event.target.value))} /></label>
          <label>Similarity Threshold <b>{threshold.toFixed(2)}</b><input type="range" min="-0.1" max="0.8" step="0.02" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /><span className="range-ends"><small>噪声更多</small><small>过滤严格</small></span></label>
          <div className="teaching-tip"><Box size={18} /><strong>试着故意做错</strong><p>将 Top-K 设为 20 或阈值调高到 0.8，观察噪声和零结果。</p></div>
        </aside>
      </div>

      {preview && <div className="drawer-backdrop" onMouseDown={() => setPreview(null)}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}><button className="drawer-close" onClick={() => setPreview(null)}><X /></button><Pill tone="blue">PARSED {preview.parsed.format?.toUpperCase()}</Pill><h2>{preview.title}</h2><div className="parse-meta"><span>{preview.filename}</span><span>{preview.parsed.chars} chars</span>{preview.parsed.pages && <span>{preview.parsed.pages} pages</span>}{preview.parsed.language && <span>{preview.parsed.language}</span>}<span>{preview.parsed.headings.length} sections</span></div>{preview.source_type && <div className="evidence-source-note"><strong>{preview.source_type}</strong><span>{preview.source_title}</span><small>{preview.source_date || "未标日期"}{preview.source_url ? " · 可在线核验" : ""}</small></div>}{(preview.local_original || preview.local_excerpt) && <div className="local-evidence-actions">{preview.local_original && <a className="btn ghost compact" href={`/api/evidence/${preview.id}/original`} target="_blank" rel="noreferrer"><ExternalLink size={14} />{preview.local_original.toLowerCase().endsWith(".pdf") ? "本地原始 PDF" : "本地官方资料"}</a>}{preview.local_excerpt && <a className="btn ghost compact" href={`/api/evidence/${preview.id}/excerpt`} target="_blank" rel="noreferrer"><Download size={14} />本地教学摘编</a>}<small>无需访问互联网；在线来源仍用于版本核验。</small></div>}<pre>{preview.content}</pre></aside></div>}
      {activeChunk && <div className="drawer-backdrop" onMouseDown={() => setActiveChunk(null)}><aside className="drawer compact-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="drawer-close" onClick={() => setActiveChunk(null)}><X /></button><Pill tone="mint">{activeChunk.id}</Pill><h2>{activeChunk.section}</h2><div className="parse-meta"><span>{activeChunk.document_title}</span><span>{activeChunk.chars} chars</span><span>{activeChunk.tokens} tokens</span></div><p className="chunk-full-text">{activeChunk.text}</p><h3>Embedding Preview</h3><code className="vector-code">[{activeChunk.embedding_preview.join(", ")}, …]</code><p className="dim-note">只展示前 8 维；完整向量为 {kb?.dimension} 维。二维/预览均是高维语义的近似观察。</p></aside></div>}
    </div>
  );
}

function ProjectGate() {
  const navigate = useNavigate();
  return <div className="gate"><Database size={38} /><h1>先创建一个实验项目</h1><p>项目用于串联知识库、RAG、Agent 和报告。</p><button className="btn primary" onClick={() => navigate("/")}>返回总览创建项目</button></div>;
}
