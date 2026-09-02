import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowRight, CalendarDays, Clock3, FileClock, FileText, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Pill } from "../components/UI";
import { useApp } from "../context/AppContext";
import type { ProjectStatus } from "../types";

type ProjectAction = "create" | "rename" | "end" | "restore" | null;

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
  : "—";

const nextRoute = (project: ProjectStatus) => {
  if (!project.stats.knowledge_base) return "/lab/knowledge";
  if (!project.stats.rag) return "/lab/rag";
  if (!project.stats.agent) return "/lab/agent";
  return "/report";
};

export function ProjectManager() {
  const { user, project: currentProject, createProject, updateProject, selectProject } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"current" | "history">("current");
  const [action, setAction] = useState<ProjectAction>(null);
  const [target, setTarget] = useState<ProjectStatus | null>(null);
  const [name, setName] = useState("我的 Mini Crypto Agent");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await api.projects(true));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "实验项目加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => items.filter((item) => {
    const inTab = tab === "history" ? item.is_ended : !item.is_ended;
    return inTab && item.name.toLowerCase().includes(query.trim().toLowerCase());
  }), [items, query, tab]);
  const currentCount = items.filter((item) => !item.is_ended).length;
  const historyCount = items.length - currentCount;

  const openCreate = () => {
    setTarget(null); setName("我的 Mini Crypto Agent"); setAction("create"); setError("");
  };
  const openRename = (item: ProjectStatus) => {
    setTarget(item); setName(item.name); setAction("rename"); setError("");
  };
  const closeModal = () => { if (!saving) { setAction(null); setTarget(null); } };

  const submit = async () => {
    if ((action === "create" || action === "rename") && name.trim().length < 2) return;
    setSaving(true); setError("");
    try {
      if (action === "create") {
        await createProject(name.trim());
        setTab("current");
      } else if (action === "rename" && target) {
        await updateProject(target.id, { name: name.trim() });
      } else if (action === "end" && target) {
        await updateProject(target.id, { ended: true });
        setTab("history");
      } else if (action === "restore" && target) {
        await updateProject(target.id, { ended: false });
        setTab("current");
      }
      setItems(await api.projects(true));
      setAction(null); setTarget(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const continueProject = async (item: ProjectStatus) => {
    await selectProject(item.id);
    navigate(nextRoute(item));
  };

  return <div className="project-manager">
    <div className="page-title project-manager-title">
      <div><Pill tone="mint">EXPERIMENT WORKSPACE</Pill><h1>我的<span>实验项目</span></h1><p>{user?.role === "admin" ? "查看平台内的当前与历史实验；所有结束操作均可恢复。" : "当前实验用于继续操作；结束后的全部数据会进入历史实验，不会被删除。"}</p></div>
      <button className="btn primary" onClick={openCreate}><Plus size={16} />{currentCount ? "重新开始新实验" : "开始新实验"}</button>
    </div>

    <section className="project-lifecycle-note">
      <RotateCcw size={19} /><div><strong>重新开始会发生什么？</strong><span>当前实验会标记为“已结束”并完整存入历史，新实验将成为唯一的当前实验。知识库、Chunk、运行 Trace 和报告都保留。</span></div>
    </section>

    <div className="project-toolbar">
      <div className="project-tabs" role="tablist" aria-label="实验状态">
        <button className={tab === "current" ? "active" : ""} onClick={() => setTab("current")}><Clock3 size={15} />当前实验 <b>{currentCount}</b></button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><Archive size={15} />历史实验 <b>{historyCount}</b></button>
      </div>
      <label className="project-search"><Search size={15} /><input aria-label="搜索实验项目" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索实验名称" /></label>
    </div>

    {error && <div className="error-banner" role="alert">{error}</div>}
    {loading ? <div className="project-list-loading"><i />正在读取实验档案…</div> : visible.length ? <div className="project-list">
      {visible.map((item) => <article className={`project-record ${item.id === currentProject?.id ? "selected" : ""}`} key={item.id}>
        <div className="project-record-icon">{item.is_ended ? <Archive /> : <FileClock />}</div>
        <div className="project-record-main">
          <div className="project-record-title"><h2>{item.name}</h2><Pill tone={item.is_ended ? "neutral" : "mint"}>{item.is_ended ? "已结束" : "当前实验"}</Pill></div>
          <div className="project-record-meta"><span><CalendarDays size={13} />开始于 {formatDate(item.created_at)}</span><span><Clock3 size={13} />最近活动 {formatDate(item.last_activity_at)}</span>{item.ended_at && <span><Archive size={13} />结束于 {formatDate(item.ended_at)}</span>}</div>
          <div className="project-progress"><i><span style={{ width: `${Math.min(item.current_stage, 4) * 25}%` }} /></i><b>Stage {item.current_stage} / 4</b></div>
          <div className="project-stats"><span><strong>{item.stats.documents}</strong> 资料</span><span><strong>{item.stats.chunks}</strong> Chunks</span><span><strong>{item.stats.runs}</strong> Runs</span><span><strong>{item.stats.rag ? "已构建" : "未构建"}</strong> RAG</span><span><strong>{item.stats.agent ? "已激活" : "未激活"}</strong> Agent</span></div>
        </div>
        <div className="project-record-actions">
          {!item.is_ended ? <button className="btn primary compact" onClick={() => continueProject(item)}>继续实验 <ArrowRight size={14} /></button> : <button className="btn primary compact" onClick={() => { setTarget(item); setAction("restore"); }}>恢复为当前</button>}
          <button className="btn ghost compact" onClick={() => navigate(`/report/${item.id}`)}><FileText size={14} />查看报告</button>
          <button className="btn ghost compact" onClick={() => openRename(item)}><Pencil size={14} />重命名</button>
          {!item.is_ended && <button className="project-end-button" onClick={() => { setTarget(item); setAction("end"); }}><Archive size={14} />结束实验</button>}
        </div>
      </article>)}
    </div> : <div className="project-empty"><Archive size={30} /><strong>{tab === "history" ? "还没有历史实验" : "还没有当前实验"}</strong><p>{query ? "没有匹配的实验项目，请更换关键词。" : tab === "history" ? "重新开始新实验后，原来的当前实验会出现在这里。" : "开始一个新实验，逐步构建知识库、RAG 与密码学智能体。"}</p>{tab === "current" && !query && <button className="btn primary compact" onClick={openCreate}>开始新实验</button>}</div>}

    {action && <div className="modal-backdrop" onMouseDown={closeModal}><div className="modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-icon">{action === "end" ? <Archive /> : <RotateCcw />}</div>
      <span>{action === "create" ? "NEW EXPERIMENT" : action === "rename" ? "RENAME EXPERIMENT" : action === "end" ? "COMPLETE EXPERIMENT" : "RESTORE EXPERIMENT"}</span>
      <h2>{action === "create" ? (currentCount ? "重新开始新实验" : "开始新实验") : action === "rename" ? "重命名实验" : action === "end" ? "结束当前实验" : "恢复历史实验"}</h2>
      {action === "create" && <p>{currentCount ? "创建后，当前实验会结束并进入历史；已有实验数据不会删除。" : "三个实验将共享同一项目、知识库和运行记录。"}</p>}
      {action === "rename" && <p>仅修改显示名称，不影响已有资料、运行记录和报告。</p>}
      {action === "end" && <p>“{target?.name}”将进入历史实验并停止写入，之后仍可查看报告或恢复。</p>}
      {action === "restore" && <p>“{target?.name}”将恢复为当前实验；现有当前实验会同时结束并进入历史。</p>}
      {(action === "create" || action === "rename") && <label>实验名称<input aria-label="实验名称" value={name} onChange={(event) => setName(event.target.value)} autoFocus maxLength={80} /></label>}
      <div className="modal-actions"><button className="btn ghost" onClick={closeModal}>取消</button><button className="btn primary" disabled={saving || ((action === "create" || action === "rename") && name.trim().length < 2)} onClick={submit}>{saving ? "正在保存…" : action === "create" ? "确认并开始" : action === "rename" ? "保存名称" : action === "end" ? "确认结束" : "确认恢复"}</button></div>
    </div></div>}
  </div>;
}
