import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Download, Filter, Gauge, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { EmptyState, LoadingBlock, Pill } from "../components/UI";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

interface RubricItem { id?: string; description: string; points: number }

const STATUS_LABEL: Record<string, string> = {
  graded: "已评分", pending: "待处理", failed: "评分失败", ungraded: "未评分",
};
const STATUS_TONE: Record<string, "mint" | "amber" | "red" | "neutral"> = {
  graded: "mint", pending: "amber", failed: "red", ungraded: "neutral",
};

function OverrideEditor({ submission, onClose, onSaved }: { submission: Dict; onClose: () => void; onSaved: () => void }) {
  const [rubric, setRubric] = useState<Dict | null>(null);
  const [grading, setGrading] = useState<Dict | null>(null);
  const [items, setItems] = useState<Array<{ rubric_item_id: string; description: string; score: number; max: number; comment: string }>>([]);
  const [overall, setOverall] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.adminRubric(submission.exp_id), api.experimentReport(submission.project_id, submission.exp_id)])
      .then(([r, report]) => {
        setRubric(r);
        const g = (report.grading as Dict) || null;
        setGrading(g);
        const gradedById: Record<string, Dict> = {};
        for (const it of (g?.items || [])) gradedById[String(it.rubric_item_id)] = it;
        setItems((r.items || []).map((it: Dict) => {
          const graded = gradedById[String(it.id)] || {};
          return { rubric_item_id: String(it.id), description: it.description, score: Number(graded.score ?? 0), max: Number(it.points), comment: String(graded.comment ?? "") };
        }));
        setOverall(String(g?.overall_comment ?? ""));
      });
  }, [submission.project_id, submission.exp_id]);

  const total = useMemo(() => items.reduce((sum, it) => sum + (Number(it.score) || 0), 0), [items]);
  const updateItem = (index: number, patch: Partial<{ score: number; comment: string }>) => setItems((prev) => prev.map((it, i) => i === index ? { ...it, ...patch } : it));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.overrideGrading(submission.project_id, submission.exp_id, {
        items: items.map((it) => ({ rubric_item_id: it.rubric_item_id, score: Math.max(0, Math.min(Number(it.score) || 0, it.max)), comment: it.comment })),
        overall_comment: overall,
      });
      onSaved();
      onClose();
    } catch (e) { setMsg((e as Error).message); }
    finally { setSaving(false); }
  };

  const regrade = async () => {
    setSaving(true); setMsg(null);
    try { await api.gradeSubmission(submission.project_id, submission.exp_id); onSaved(); onClose(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setSaving(false); }
  };

  if (!rubric) return <div className="grading-override"><LoadingBlock label="正在加载评分详情…" /></div>;

  return <div className="grading-override">
    <div className="grading-override-head">
      <div><strong>{submission.student_name || submission.owner_id || "未知学生"} · 实验 {submission.exp_id}</strong><small>{submission.filename}</small></div>
      <div className="grading-override-actions">
        <a className="btn ghost compact" href={api.experimentReportPdfUrl(submission.project_id, submission.exp_id)} target="_blank" rel="noreferrer"><Download size={14} /> 下载 PDF</a>
        <button className="btn ghost compact" type="button" onClick={regrade} disabled={saving}><RefreshCw size={14} /> 重新评分</button>
        <button className="btn ghost compact" type="button" onClick={onClose}>关闭</button>
      </div>
    </div>
    {grading?.error && <div className="provider-msg err">评分状态：{STATUS_LABEL[grading.status] || grading.status} · {grading.error}</div>}
    <div className="grading-override-items">
      {items.map((it, i) => <div className="grading-override-row" key={it.rubric_item_id}>
        <div className="grading-override-top">
          <div className="grading-override-desc"><span>{i + 1}. {it.description}</span><small>满分 {it.max} 分</small></div>
          <div className="grading-override-score"><input type="number" min={0} max={it.max} value={it.score} onChange={(e) => updateItem(i, { score: Number(e.target.value) })} /><small>/ {it.max}</small></div>
        </div>
        <textarea className="grading-override-comment" rows={2} value={it.comment} placeholder="点评（可选）" maxLength={2000} onChange={(e) => updateItem(i, { comment: e.target.value })} />
      </div>)}
    </div>
    <div className="grading-override-total">最终总分 <strong>{total}</strong> / {items.reduce((s, it) => s + it.max, 0)}</div>
    <label className="rubric-prompt"><span>总体点评</span><textarea value={overall} maxLength={4000} onChange={(e) => setOverall(e.target.value)} /></label>
    {msg && <div className="provider-msg err">{msg}</div>}
    <div className="provider-form-foot">
      <button className={`btn primary ${saving ? "is-running" : ""}`} onClick={save} disabled={saving} aria-busy={saving}>{saving ? "正在保存…" : <>保存人工复核结果<Save size={16} /></>}</button>
    </div>
  </div>;
}

function SubmissionQueue() {
  const [rows, setRows] = useState<Dict[] | null>(null);
  const [active, setActive] = useState<Dict | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [expFilter, setExpFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");

  const load = useCallback(() => { api.adminSubmissions().then(setRows); }, []);
  useEffect(() => { load(); }, [load]);

  const regrade = async (row: Dict) => {
    const key = `${row.project_id}:${row.exp_id}`;
    setBusy(key);
    try { await api.gradeSubmission(row.project_id, row.exp_id); load(); }
    finally { setBusy(null); }
  };

  const expOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows || []) map.set(String(r.exp_id), `实验 ${r.exp_id}${r.label ? ` · ${r.label}` : ""}`);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);
  const studentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows || []) { const n = String(r.student_name || r.owner_id || "").trim(); if (n) set.add(n); }
    return [...set].sort();
  }, [rows]);
  const filtered = useMemo(() => (rows || []).filter((r) => {
    if (expFilter && String(r.exp_id) !== expFilter) return false;
    if (studentFilter && String(r.student_name || r.owner_id || "") !== studentFilter) return false;
    return true;
  }), [rows, expFilter, studentFilter]);

  const stats = useMemo(() => {
    const list = rows || [];
    const graded = list.filter((r) => r.status === "graded");
    const pending = list.filter((r) => r.status === "pending" || r.status === "ungraded");
    const failed = list.filter((r) => r.status === "failed");
    const scored = graded.filter((r) => r.total != null && r.max_total);
    const avg = scored.length ? Math.round((scored.reduce((s, r) => s + (Number(r.total) / Number(r.max_total)) * 100, 0) / scored.length)) : null;
    return { total: list.length, graded: graded.length, pending: pending.length, failed: failed.length, avg };
  }, [rows]);

  if (!rows) return <section className="panel"><LoadingBlock label="正在加载提交队列…" /></section>;

  return <>
    <section className="grading-stats">
      <div className="grading-stat"><i className="grading-stat-icon total"><ClipboardCheck size={18} /></i><div><strong>{stats.total}</strong><small>报告提交</small></div></div>
      <div className="grading-stat"><i className="grading-stat-icon graded"><CheckCircle2 size={18} /></i><div><strong>{stats.graded}</strong><small>已评分</small></div></div>
      <div className="grading-stat"><i className="grading-stat-icon pending"><Clock size={18} /></i><div><strong>{stats.pending}</strong><small>待处理</small></div></div>
      <div className="grading-stat"><i className="grading-stat-icon failed"><AlertTriangle size={18} /></i><div><strong>{stats.failed}</strong><small>评分失败</small></div></div>
      <div className="grading-stat"><i className="grading-stat-icon avg"><Gauge size={18} /></i><div><strong>{stats.avg != null ? `${stats.avg}%` : "—"}</strong><small>平均得分率</small></div></div>
    </section>
    <section className="panel grading-queue">
    <div className="panel-head"><div><h2><ClipboardCheck size={18} /> 提交与评分队列</h2><p>所有学生的实验报告提交。可重新触发自动评分或人工复核每一项分数。</p></div>
      <button className="btn ghost compact" type="button" onClick={load}><RefreshCw size={14} /> 刷新</button></div>
    <div className="grading-filters">
      <label><Filter size={13} /> 实验
        <select value={expFilter} onChange={(e) => setExpFilter(e.target.value)}>
          <option value="">全部实验</option>
          {expOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <label><Filter size={13} /> 学生
        <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
          <option value="">全部学生</option>
          {studentOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {(expFilter || studentFilter) && <button className="btn ghost compact" type="button" onClick={() => { setExpFilter(""); setStudentFilter(""); }}>清除筛选</button>}
      <span className="grading-filter-count">共 {filtered.length} / {rows.length} 条</span>
    </div>
    {filtered.length === 0 ? <EmptyState title={rows.length === 0 ? "暂无提交" : "没有匹配的提交"}>{rows.length === 0 ? "学生在实验页上传实验报告 PDF 后，会自动进入此队列并触发阅卷模型评分。" : "没有符合当前筛选条件的提交，试试调整实验或学生筛选。"}</EmptyState> : <div className="grading-table">
      <div className="grading-table-head"><span>学生</span><span>实验</span><span>报告</span><span>状态</span><span>总分</span><span>操作</span></div>
      {filtered.map((row) => {
        const key = `${row.project_id}:${row.exp_id}`;
        return <div className="grading-table-row" key={key}>
          <span className="grading-cell-student">{row.student_name || row.owner_id || "—"}</span>
          <span>实验 {row.exp_id}<small>{row.label}</small></span>
          <span className="grading-cell-file" title={row.filename}>{row.filename}</span>
          <span><Pill tone={STATUS_TONE[row.status] || "neutral"}>{STATUS_LABEL[row.status] || row.status}{row.overridden ? " · 已复核" : ""}</Pill></span>
          <span className="grading-cell-total">{row.total != null ? `${row.total} / ${row.max_total ?? "—"}` : "—"}</span>
          <span className="grading-cell-actions">
            <a className="btn ghost compact" href={api.experimentReportPdfUrl(row.project_id, row.exp_id)} target="_blank" rel="noreferrer"><Download size={13} /></a>
            <button className="btn ghost compact" type="button" disabled={busy === key} onClick={() => regrade(row)}><RefreshCw size={13} /> 重新评分</button>
            <button className="btn ghost compact" type="button" onClick={() => setActive(row)}>复核</button>
          </span>
        </div>;
      })}
    </div>}
    {active && <OverrideEditor submission={active} onClose={() => setActive(null)} onSaved={load} />}
  </section>
  </>;
}

export function GradingConsole() {
  const { user } = useApp();
  const navigate = useNavigate();
  if (user?.role !== "admin") return <div className="gate"><ShieldCheck size={38} /><h1>需要管理员权限</h1><p>成绩管理仅对管理员开放。</p><button className="btn primary" onClick={() => navigate("/")}>返回总览</button></div>;

  return <div className="lab-page grading-console">
    <div className="page-title">
      <div><Pill tone="blue">管理员 · 成绩管理</Pill><h1>实验报告<span>阅卷与评分</span></h1><p>对学生提交的报告进行自动评分与人工复核。每个实验的评分细则在对应实验页配置，阅卷视觉大模型在 Provider 配置页设置。</p></div>
      <div className="page-title-badges"><Pill tone="amber"><ClipboardCheck size={13} /> 阅卷控制台</Pill></div>
    </div>
    <SubmissionQueue />
  </div>;
}
