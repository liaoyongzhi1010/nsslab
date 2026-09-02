import { useState } from "react";
import { CheckCircle2, Cpu, Radio, Save, Server, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { Pill } from "../components/UI";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

export function ProviderConfig() {
  const { bootstrap, refreshBootstrap } = useApp();
  const providers: Dict = bootstrap?.providers || {};
  const llm: Dict = providers.llm_status || {};
  const configured = Boolean(llm.configured);

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(llm.endpoint_host ? `https://${llm.endpoint_host}/v1` : "https://api.deepseek.com/v1");
  const [model, setModel] = useState(llm.model || "deepseek-chat");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    if (!apiKey.trim() || !baseUrl.trim() || !model.trim()) { setMsg({ ok: false, text: "请完整填写 Base URL、模型名称和 API Key" }); return; }
    setSaving(true); setMsg(null);
    try {
      await api.updateProvider({ api_key: apiKey.trim(), base_url: baseUrl.trim(), model: model.trim() });
      await refreshBootstrap();
      setApiKey("");
      setMsg({ ok: true, text: "已保存并切换到新的模型服务，所有实验将使用新配置。" });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setSaving(false); }
  };

  return <div className="lab-page">
    <div className="page-title">
      <div><Pill tone="blue">Provider 配置</Pill><h1>模型<span>接入配置</span></h1><p>平台通过 OpenAI 兼容协议接入云端大模型，作为 RAG / Skills / Tools / Agent 等实验的真实推理引擎。可在此在线切换。</p></div>
      <div className="page-title-badges"><Pill tone={configured ? "mint" : "amber"}><Radio size={13} /> {configured ? "云端已连接" : "未配置模型"}</Pill></div>
    </div>

    <section className="panel provider-card">
      <div className="provider-current">
        <div className="provider-current-item"><i><Server size={16} /></i><div><small>Provider</small><strong>{llm.provider || providers.llm || "Local"}</strong></div></div>
        <div className="provider-current-item"><i><Cpu size={16} /></i><div><small>模型</small><strong>{llm.model || "离线教学模型"}</strong></div></div>
        <div className="provider-current-item"><i><Radio size={16} /></i><div><small>接入点</small><strong>{llm.endpoint_host || "本地"}</strong></div></div>
      </div>

      <div className={`provider-health ${configured ? "ok" : "warn"}`}>
        {configured ? <><CheckCircle2 size={16} /> 连接正常，实验将使用真实模型推理。</> : <><ShieldCheck size={16} /> 当前使用本地离线模型，回答质量有限，仅用于教学演示。填写下方配置后可获得真实模型能力。</>}
        {llm.last_error && <span className="provider-error">最近错误：{llm.last_error}</span>}
      </div>

      <div className="provider-divider" />

      <div className="provider-form-head"><h2>切换模型服务</h2><p>填写任意 OpenAI 兼容服务的 Base URL、模型名称与 API Key，保存后立即热切换生效。API Key 仅用于后台调用，不会回显。</p></div>
      <div className="provider-form">
        <label><span>Base URL</span><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" maxLength={512} /></label>
        <label><span>模型名称</span><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" maxLength={128} /></label>
        <label className="provider-form-full"><span>API Key</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={configured ? "留空则不修改（已配置）· 输入新 Key 覆盖" : "sk-..."} autoComplete="off" maxLength={512} /></label>
      </div>
      {msg && <div className={`provider-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
      <div className="provider-form-foot">
        <button className={`btn primary ${saving ? "is-running" : ""}`} onClick={save} disabled={saving} aria-busy={saving}>{saving ? "正在保存并切换…" : <>保存并切换<Save size={16} /></>}</button>
        <small>在线配置在服务运行期间生效；后端重启后回到环境变量 <code>LLM_BASE_URL</code> / <code>LLM_MODEL</code> / <code>LLM_API_KEY</code> 的默认配置。</small>
      </div>
    </section>
  </div>;
}
