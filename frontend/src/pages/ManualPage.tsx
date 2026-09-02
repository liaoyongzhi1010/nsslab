import { useState } from "react";
import { BookOpen, FileText, X } from "lucide-react";
import { api } from "../api";
import { MarkdownAnswer } from "../components/MarkdownAnswer";
import { Pill } from "../components/UI";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

export function ManualPage() {
  const { bootstrap } = useApp();
  const docs: Dict[] = (bootstrap?.documents || []).filter((d: Dict) => d.source !== "upload");
  const [active, setActive] = useState<Dict | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const categories = Array.from(new Set(docs.map((d) => d.category)));

  const open = async (doc: Dict) => {
    setActive(doc); setLoading(true); setContent("");
    try { const full = await api.document(doc.id); setContent(full.content || "（暂无正文）"); }
    catch { setContent("加载失败，请稍后重试。"); }
    finally { setLoading(false); }
  };

  return <div className="lab-page">
    <div className="page-title">
      <div><Pill tone="blue">知识手册</Pill><h1>密码学<span>知识手册</span></h1><p>平台预置的密码学基础文档，是知识库、RAG 与智能体实验的领域知识来源。点击任意卡片阅读全文。</p></div>
      <div className="page-title-badges"><Pill tone="mint"><BookOpen size={13} /> {docs.length} 篇预置文档</Pill></div>
    </div>

    {categories.map((cat) => <section className="manual-section" key={cat}>
      <div className="section-heading"><div><span>CATEGORY</span><h2>{cat}</h2></div></div>
      <div className="manual-grid">
        {docs.filter((d) => d.category === cat).map((doc) => <button className="manual-card" key={doc.id} onClick={() => open(doc)} style={{ ["--doc-accent" as string]: doc.accent }}>
          <i><FileText size={20} /></i>
          <div><strong>{doc.title}</strong><small>{doc.filename} · {doc.level} · {doc.chars} 字</small></div>
        </button>)}
      </div>
    </section>)}

    {active && <div className="drawer-backdrop" onMouseDown={() => setActive(null)}><aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
      <button className="drawer-close" onClick={() => setActive(null)}><X /></button>
      <Pill tone="blue">{active.category} · {active.level}</Pill>
      <h2>{active.title}</h2>
      <div className="parse-meta"><span>{active.filename}</span><span>{active.chars} 字</span></div>
      {loading ? <div className="project-list-loading"><i />正在加载正文…</div> : <div className="chunk-full-text"><MarkdownAnswer>{content}</MarkdownAnswer></div>}
    </aside></div>}
  </div>;
}
