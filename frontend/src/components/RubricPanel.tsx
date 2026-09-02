import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Plus, Save, Trash2 } from "lucide-react";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

interface RubricItem { id?: string; description: string; points: number }

export function RubricPanel({ expId, defaultOpen = false }: { expId: string; defaultOpen?: boolean }) {
  const { user } = useApp();
  const [items, setItems] = useState<RubricItem[]>([]);
  const [scoringPrompt, setScoringPrompt] = useState("");
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = useCallback((data: Dict) => {
    setItems((data.items || []).map((it: Dict) => ({ id: it.id, description: it.description, points: Number(it.points) })));
    setScoringPrompt(data.scoring_prompt || "");
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return;
    api.adminRubric(expId).then(apply).catch(() => setLoaded(true));
  }, [user?.role, expId, apply]);

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
      apply(saved);
      setMsg({ ok: true, text: "评分细则已保存。" });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setSaving(false); }
  };

  if (user?.role !== "admin") return null;

  return <section className="panel rubric-panel">
    <button className="rubric-panel-head" type="button" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
      <span className="rubric-panel-title"><ClipboardCheck size={17} /> <strong>评分细则与打分指令</strong><small>管理员 · 实验 {expId}</small></span>
      <span className={`rubric-panel-total ${total === 100 ? "ok" : "warn"}`}>{loaded ? `${total} / 100` : "…"}</span>
    </button>
    {!collapsed && <div className="rubric-panel-body">
      <p className="rubric-panel-hint">为本实验定义评分项（描述 + 分值，合计应为 100 分）与发送给阅卷模型的打分指令。学生上传报告后将据此自动评分。</p>
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
    </div>}
  </section>;
}
