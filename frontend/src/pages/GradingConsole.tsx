import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Cpu, Plus, Radio, RefreshCw, Save, Server, ShieldCheck, Trash2 } from "lucide-react";
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

function VlmCard() {
  const [status, setStatus] = useState<Dict | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://dashscope.aliyuncs.com/compatible-mode/v1");
  const [model, setModel] = useState("qwen-vl-max");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => { api.vlmStatus().then(setStatus); }, []);
  useEffect(() => { load(); }, [load]);

  const configured = Boolean(status?.configured);

  const save = async () => {
    if (!apiKey.trim() || !baseUrl.trim() || !model.trim()) { setMsg({ ok: false, text: "请完整填写 Base URL、模型名称和 API Key" }); return; }
    setSaving(true); setMsg(null);
    try {
      await api.updateVlmProvider({ api_key: apiKey.trim(), base_url: baseUrl.trim(), model: model.trim() });
      setApiKey("");
      await load();
      setMsg({ ok: true, text: "已保存并切换阅卷视觉大模型，后续评分将使用新配置。" });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setSaving(false); }
  };

  return <section className="panel provider-card">
    <div className="panel-head"><div><h2><Server size={18} /> 阅卷视觉大模型（VLM）</h2><p>阅卷模型与学生侧对话模型相互独立。报告 PDF 会被逐页转为图片后送入该多模态模型评分（不做 OCR）。</p></div></div>
    <div className="provider-current">
      <div className="provider-current-item"><i><Server size={16} /></i><div><small>Provider</small><strong>{status?.provider || "未配置"}</strong></div></div>
      <div className="provider-current-item"><i><Cpu size={16} /></i><div><small>模型</small><strong>{status?.model || "未配置"}</strong></div></div>
      <div className="provider-current-item"><i><Radio size={16} /></i><div><small>接入点</small><strong>{status?.endpoint_host || "未配置"}</strong></div></div>
    </div>
    <div className={`provider-health ${configured ? "ok" : "warn"}`}>
      {configured ? <><CheckCircle2 size={16} /> 已连接，上传报告后将自动触发 VLM 评分。</> : <><ShieldCheck size={16} /> 尚未配置阅卷模型，学生报告将标记为“待处理”，可稍后重新评分。</>}
      {status?.last_error && <span className="provider-error">最近错误：{status.last_error}</span>}
    </div>
    <div className="provider-divider" />
    <div className="provider-form-head"><h2>切换阅卷模型</h2><p>填写任意 OpenAI 兼容的多模态服务，保存后立即热切换。API Key 仅用于后台调用，不会回显。</p></div>
    <div className="provider-form">
      <label><span>Base URL</span><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://.../v1" maxLength={512} /></label>
      <label><span>模型名称</span><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="qwen-vl-max" maxLength={128} /></label>
      <label className="provider-form-full"><span>API Key</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={configured ? "留空则不修改（已配置）· 输入新 Key 覆盖" : "sk-..."} autoComplete="off" maxLength={512} /></label>
    </div>
    {msg && <div className={`provider-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
    <div className="provider-form-foot">
      <button className={`btn primary ${saving ? "is-running" : ""}`} onClick={save} disabled={saving} aria-busy={saving}>{saving ? "正在保存并切换…" : <>保存并切换<Save size={16} /></>}</button>
      <small>在线配置在服务运行期间生效；后端重启后回到环境变量 <code>VLM_BASE_URL</code> / <code>VLM_MODEL</code> / <code>VLM_API_KEY</code> 的默认配置。</small>
    </div>
  </section>;
}

function RubricEditor() {
  const [rubrics, setRubrics] = useState<Dict[]>([]);
  const [expId, setExpId] = useState("01");
  const [items, setItems] = useState<RubricItem[]>([]);
  const [scoringPrompt, setScoringPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadRubrics = useCallback(() => { api.adminRubrics().then(setRubrics); }, []);
  useEffect(() => { loadRubrics(); }, [loadRubrics]);

  const applyRubric = useCallback((data: Dict) => {
    setItems((data.items || []).map((it: Dict) => ({ id: it.id, description: it.description, points: Number(it.points) })));
    setScoringPrompt(data.scoring_prompt || "");
  }, []);

  useEffect(() => {
    if (!rubrics.length) return;
    const current = rubrics.find((r) => r.exp_id === expId);
    if (current) applyRubric(current);
  }, [rubrics, expId, applyRubric]);

  const total = useMemo(() => items.reduce((sum, it) => sum + (Number(it.points) || 0), 0), [items]);

  const updateItem = (index: number, patch: Partial<RubricItem>) => setItems((prev) => prev.map((it, i) => i === index ? { ...it, ...patch } : it));
  const addItem = () => setItems((prev) => [...prev, { description: "", points: 0 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    for (const it of items) { if (!it.description.trim()) { setMsg({ ok: false, text: "每个评分项都需要填写描述" }); return; } }
    setSaving(true); setMsg(null);
    try {
      const saved = await api.updateRubric(expId, {
        items: items.map((it) => ({ id: it.id, description: it.description.trim(), points: Number(it.points) || 0 })),
        scoring_prompt: scoringPrompt,
      });
      applyRubric(saved);
      loadRubrics();
      setMsg({ ok: true, text: "评分细则已保存。" });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setSaving(false); }
  };

  return <section className="panel grading-rubric">
    <div className="panel-head"><div><h2><ClipboardCheck size={18} /> 实验评分细则</h2><p>为每个实验手动定义评分项（描述 + 分值）与评分指令。分值总和应为 100 分。</p></div></div>
    <div className="rubric-exp-tabs">
      {rubrics.map((r) => <button key={r.exp_id} type="button" className={`rubric-exp-tab ${expId === r.exp_id ? "active" : ""}`} onClick={() => setExpId(r.exp_id)}>
        <span>实验 {r.exp_id}</span>
        {r.total_points === 100 ? <i className="rubric-dot ok" /> : r.total_points > 0 ? <i className="rubric-dot warn" /> : null}
      </button>)}
    </div>
    <div className="rubric-items">
      {items.length === 0 && <p className="rubric-empty">尚未配置评分项，点击下方“添加评分项”开始。</p>}
      {items.map((it, i) => <div className="rubric-item-row" key={i}>
        <span className="rubric-item-index">{i + 1}</span>
        <input className="rubric-item-desc" value={it.description} placeholder="评分项描述，例如：实验目的与对照假设清晰" maxLength={400} onChange={(e) => updateItem(i, { description: e.target.value })} />
        <div className="rubric-item-points">
          <input type="number" min={0} max={100} value={it.points} onChange={(e) => updateItem(i, { points: Number(e.target.value) })} />
          <small>分</small>
        </div>
        <button className="rubric-item-del" type="button" title="删除该项" onClick={() => removeItem(i)}><Trash2 size={15} /></button>
      </div>)}
    </div>
    <div className="rubric-total-row">
      <button className="btn ghost compact" type="button" onClick={addItem}><Plus size={15} /> 添加评分项</button>
      <div className={`rubric-total ${total === 100 ? "ok" : "warn"}`}>
        {total === 100 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
        总分 <strong>{total}</strong> / 100 {total !== 100 && <span>（各项分值应合计 100 分）</span>}
      </div>
    </div>
    <label className="rubric-prompt">
      <span>评分指令（发送给阅卷模型的提示词）</span>
      <textarea value={scoringPrompt} maxLength={4000} placeholder="例如：请依据细则逐项打分，对未完成的要点扣分并说明原因。" onChange={(e) => setScoringPrompt(e.target.value)} />
    </label>
    {msg && <div className={`provider-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
    <div className="provider-form-foot">
      <button className={`btn primary ${saving ? "is-running" : ""}`} onClick={save} disabled={saving} aria-busy={saving}>{saving ? "正在保存…" : <>保存评分细则<Save size={16} /></>}</button>
    </div>
  </section>;
}

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
        <button className="btn ghost compact" type="button" onClick={regrade} disabled={saving}><RefreshCw size={14} /> 重新评分</button>
        <button className="btn ghost compact" type="button" onClick={onClose}>关闭</button>
      </div>
    </div>
    {grading?.error && <div className="provider-msg err">评分状态：{STATUS_LABEL[grading.status] || grading.status} · {grading.error}</div>}
    <div className="grading-override-items">
      {items.map((it, i) => <div className="grading-override-row" key={it.rubric_item_id}>
        <div className="grading-override-desc"><span>{i + 1}. {it.description}</span><small>满分 {it.max} 分</small></div>
        <div className="grading-override-score"><input type="number" min={0} max={it.max} value={it.score} onChange={(e) => updateItem(i, { score: Number(e.target.value) })} /><small>/ {it.max}</small></div>
        <input className="grading-override-comment" value={it.comment} placeholder="点评（可选）" maxLength={2000} onChange={(e) => updateItem(i, { comment: e.target.value })} />
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

  const load = useCallback(() => { api.adminSubmissions().then(setRows); }, []);
  useEffect(() => { load(); }, [load]);

  const regrade = async (row: Dict) => {
    const key = `${row.project_id}:${row.exp_id}`;
    setBusy(key);
    try { await api.gradeSubmission(row.project_id, row.exp_id); load(); }
    finally { setBusy(null); }
  };

  if (!rows) return <section className="panel"><LoadingBlock label="正在加载提交队列…" /></section>;

  return <section className="panel grading-queue">
    <div className="panel-head"><div><h2><ClipboardCheck size={18} /> 提交与评分队列</h2><p>所有学生的实验报告提交。可重新触发自动评分或人工复核每一项分数。</p></div>
      <button className="btn ghost compact" type="button" onClick={load}><RefreshCw size={14} /> 刷新</button></div>
    {rows.length === 0 ? <EmptyState title="暂无提交">学生上传实验报告 PDF 后会自动出现在这里。</EmptyState> : <div className="grading-table">
      <div className="grading-table-head"><span>学生</span><span>实验</span><span>报告</span><span>状态</span><span>总分</span><span>操作</span></div>
      {rows.map((row) => {
        const key = `${row.project_id}:${row.exp_id}`;
        return <div className="grading-table-row" key={key}>
          <span className="grading-cell-student">{row.student_name || row.owner_id || "—"}</span>
          <span>实验 {row.exp_id}<small>{row.label}</small></span>
          <span className="grading-cell-file" title={row.filename}>{row.filename}</span>
          <span><Pill tone={STATUS_TONE[row.status] || "neutral"}>{STATUS_LABEL[row.status] || row.status}{row.overridden ? " · 已复核" : ""}</Pill></span>
          <span className="grading-cell-total">{row.total != null ? `${row.total} / ${row.max_total ?? "—"}` : "—"}</span>
          <span className="grading-cell-actions">
            <button className="btn ghost compact" type="button" disabled={busy === key} onClick={() => regrade(row)}><RefreshCw size={13} /> 重新评分</button>
            <button className="btn ghost compact" type="button" onClick={() => setActive(row)}>复核</button>
          </span>
        </div>;
      })}
    </div>}
    {active && <OverrideEditor submission={active} onClose={() => setActive(null)} onSaved={load} />}
  </section>;
}

export function GradingConsole() {
  const { user } = useApp();
  const navigate = useNavigate();
  if (user?.role !== "admin") return <div className="gate"><ShieldCheck size={38} /><h1>需要管理员权限</h1><p>成绩管理仅对管理员开放。</p><button className="btn primary" onClick={() => navigate("/")}>返回总览</button></div>;

  return <div className="lab-page grading-console">
    <div className="page-title">
      <div><Pill tone="blue">管理员 · 成绩管理</Pill><h1>实验报告<span>阅卷与评分</span></h1><p>配置阅卷视觉大模型、定义每个实验的评分细则，并对学生提交的报告进行自动评分与人工复核。</p></div>
      <div className="page-title-badges"><Pill tone="amber"><ClipboardCheck size={13} /> 阅卷控制台</Pill></div>
    </div>
    <VlmCard />
    <RubricEditor />
    <SubmissionQueue />
  </div>;
}
