import { useEffect, useState } from "react";
import { Bot, ArrowRight, BrainCircuit, Calculator, Check, ChevronDown, Code2, Database, History, LoaderCircle, MemoryStick, Network, Pencil, Play, Route, Search, ShieldCheck, Sparkles, Wrench, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { MarkdownAnswer } from "../components/MarkdownAnswer";
import { EmptyState, Flow, LoadingBlock, Metric, Pill } from "../components/UI";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const tasks = ["我需要在云服务器上处理敏感数据，但希望云平台看不到原始明文。请比较 HE、MPC、TEE 并给出选型建议。", "AES 与 SM4 在结构和应用上有什么区别？", "解释 RSA 为什么需要大整数分解困难性。", "为移动端上传敏感文件到云端存储给出密码保护方案。"];

export function AgentLab() {
  const { user, bootstrap, project, agentRun, setAgentRun, refreshProject } = useApp();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Dict[]>([]);
  const [tools, setTools] = useState<Dict[]>([]);
  const [query, setQuery] = useState(tasks[0]);
  const [memory, setMemory] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeSkill, setActiveSkill] = useState<Dict | null>(null);
  const [expandedTool, setExpandedTool] = useState<number | null>(0);
  const [error, setError] = useState("");

  useEffect(() => { Promise.all([api.skills(), api.tools()]).then(([skillData, toolData]) => { setSkills(skillData); setTools(toolData); }); }, []);
  if (!project?.stats.knowledge_base) return <AgentGate />;

  const run = async () => {
    setRunning(true); setError("");
    try { const result = await api.agentRun({ project_id: project.id, query, memory_enabled: memory }); setAgentRun(result); await refreshProject(); }
    catch (err) { setError((err as Error).message); } finally { setRunning(false); }
  };

  return (
    <div className="lab-page agent-page">
      <div className="page-title"><div><Pill tone="blue">EXPERIMENT 03</Pill><h1>从密码学模型到<span>智能体</span></h1><p>组合 Knowledge、Skills、Tools、Planning 与 Memory，让系统从“会回答”扩展到“会完成任务”。</p></div><div className="page-title-badges"><Pill tone="blue">QWEN · 最终答案生成</Pill><Pill tone="mint"><ShieldCheck size={13} /> SINGLE AGENT · SAFE TOOLS</Pill></div></div>
      <Flow steps={["User Request", "Classification", "Plan", "Skill", "Tool", "Observation", "Final"]} active={running ? 4 : agentRun ? 6 : 0} />

      <section className="panel agent-builder">
        <div className="panel-head"><div><span className="step-label">AGENT BUILDER</span><h2>Mini Crypto Agent</h2><p>实验二的知识库成为 Agent 的长期领域知识。</p></div><Pill tone="mint">CONFIGURED</Pill></div>
        <div className="builder-flow">
          {[{ icon: BrainCircuit, label: "LLM", value: bootstrap?.providers.llm_status?.model || "CryptoTutor", state: bootstrap?.providers.llm_status?.configured ? "CLOUD" : "LOCAL" }, { icon: Database, label: "Knowledge", value: `${project.stats.chunks} Chunks`, state: "LINKED" }, { icon: Sparkles, label: "Skills", value: `${skills.length} Skills`, state: user?.role === "admin" ? "EDITABLE" : "READ ONLY" }, { icon: Wrench, label: "Tools", value: `${tools.length} Tools`, state: "SAFE" }, { icon: MemoryStick, label: "Memory", value: memory ? "Short-term" : "Disabled", state: memory ? "ON" : "OFF" }].map(({ icon: Icon, label, value, state }, index, all) => <div className="builder-node-wrap" key={label}><div className="builder-node"><Icon /><span>{label}</span><strong>{value}</strong><small>{state}</small></div>{index < all.length - 1 && <i className="builder-link"><ArrowRight size={16} /></i>}</div>)}
          <div className="builder-equals">=</div><div className="builder-agent"><Bot /><strong>Mini Crypto<br />Agent</strong><small>READY TO RUN</small></div>
        </div>
        <div className="builder-columns">
          <div><div className="subsection-head"><span>CRYPTO SKILLS</span><small>{user?.role === "admin" ? "点击查看 / 编辑全局教学配置" : "点击查看教学配置（只读）"}</small></div><div className="skill-cards">{skills.map((skill) => <button className="skill-card" key={skill.id} onClick={() => setActiveSkill(skill)} style={{ "--skill-color": skill.color } as React.CSSProperties}><i><Sparkles size={17} /></i><span><strong>{skill.name}</strong><small>{skill.description}</small></span>{user?.role === "admin" ? <Pencil size={14} /> : <ShieldCheck size={14} />}</button>)}</div></div>
          <div><div className="subsection-head"><span>SAFE TOOLS</span><small>不开放系统命令和任意文件访问</small></div><div className="tool-cards">{tools.map((tool) => <div className="tool-card" key={tool.id}><i>{tool.id === "knowledge_search" ? <Search /> : tool.id === "calculator" ? <Calculator /> : <Code2 />}</i><span><strong>{tool.name}</strong><small>{tool.description}</small></span><Pill tone="neutral">{tool.permission}</Pill></div>)}</div></div>
        </div>
      </section>

      <section className="panel task-console">
        <div className="console-grid">
          <div className="task-input"><div className="panel-head"><div><span className="step-label">USER REQUEST</span><h2>给 Agent 一个密码学任务</h2></div><div className="switch-row compact"><span>短期记忆</span><button className={`switch ${memory ? "on" : ""}`} aria-label="短期记忆" onClick={() => setMemory(!memory)} disabled={running}><i /></button></div></div><textarea aria-label="Agent 密码学任务" value={query} disabled={running} onChange={(event) => setQuery(event.target.value)} /><div className="task-examples">{tasks.map((task, index) => <button onClick={() => setQuery(task)} disabled={running} key={task}>TASK {String.fromCharCode(65 + index)}</button>)}</div><button className={`btn primary wide ${running ? "is-running" : ""}`} onClick={run} disabled={running} aria-busy={running}>{running ? <><LoaderCircle className="spin" size={16} />Agent 正在执行…</> : <>运行 Mini Crypto Agent<Play size={16} /></>}</button>{error && <div className="error-banner">{error}</div>}</div>
          <div className="agent-ready-visual"><div className="agent-pulse"><Network size={34} /></div><span>ORCHESTRATOR</span><strong>{running ? "正在路由任务" : agentRun ? "最近任务已完成" : "等待任务"}</strong><p>Task Classification → Skill Router → Tool Registry → Answer Assembly</p></div>
        </div>
      </section>

      {running && <LoadingBlock label="Mini Crypto Agent 正在执行任务" detail="系统正在进行任务分类、规划、技能路由和安全工具调用。" phases={["任务分类", "生成计划", "选择 Skill", "调用 Tool", "组装回答"]} />}
      {agentRun && !running && <div className="agent-results">
        <section className="panel trace-viewer agent-trace">
          <div className="panel-head"><div><span className="step-label">RUN TRACE</span><h2>Agent 工作过程观察器</h2><p>仅显示可公开的结构化计划、路由和工具结果。</p></div><Pill tone="mint">COMPLETED</Pill></div>
          <div className="agent-summary"><div><span>TASK CLASSIFICATION</span><strong>{agentRun.classification}</strong></div><ArrowRight /><div><span>SELECTED SKILL</span><strong>{agentRun.selected_skill.name}</strong></div><ArrowRight /><div><span>TOOL ROUTE</span><strong>{agentRun.tool_calls.map((call: Dict) => call.tool).join(" + ")}</strong></div></div>
          <div className="trace-timeline">
            {agentRun.trace_steps.map((step: Dict, index: number) => <div className="timeline-row" key={step.type}><div className="timeline-marker"><span>{index + 1}</span>{index < agentRun.trace_steps.length - 1 && <i />}</div><div><small>{step.type.toUpperCase()}</small><strong>{step.title}</strong><p>{step.detail}</p></div><Check size={16} /></div>)}
          </div>
          <div className="plan-tool-grid"><div className="plan-card"><div className="subsection-head"><span><Route size={15} /> STRUCTURED PLAN</span><small>不是私有思维链</small></div>{agentRun.plan.map((item: string, index: number) => <div className="plan-step" key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p><Check size={14} /></div>)}</div><div className="tool-call-card"><div className="subsection-head"><span><Wrench size={15} /> TOOL CALLS</span><small>{agentRun.tool_calls.length} call</small></div>{agentRun.tool_calls.map((call: Dict, index: number) => <div className="tool-call" key={call.tool}><button onClick={() => setExpandedTool(expandedTool === index ? null : index)}><i><Search size={16} /></i><span><strong>{call.tool}</strong><small>{call.summary} · {call.duration_ms} ms</small></span><Pill tone="mint">SUCCESS</Pill><ChevronDown size={15} /></button>{expandedTool === index && <div className="tool-output">{call.output.map((row: Dict) => <p key={row.id}><b>{row.document_title}</b><span>{row.section} · {row.score.toFixed(3)}</span></p>)}</div>}</div>)}</div></div>
        </section>
        <section className="panel final-agent-answer"><div className="panel-head"><div><span className="step-label">FINAL ANSWER</span><h2>智能体输出</h2><p>{agentRun.answer_provider}</p></div><div className="answer-stats"><span>{agentRun.metrics.steps} STEPS</span><span>{agentRun.metrics.citations} SOURCES</span><span>{Math.round(agentRun.metrics.tool_success_rate * 100)}% TOOL SUCCESS</span></div></div><div className="answer-body"><MarkdownAnswer>{agentRun.answer}</MarkdownAnswer></div><div className="memory-note"><History size={15} />{agentRun.memory.enabled ? "本次任务摘要已写入实验级短期记忆。" : "短期记忆已关闭，本次任务不会被后续运行引用。"}</div></section>
      </div>}

      {activeSkill && <div className="drawer-backdrop" onMouseDown={() => setActiveSkill(null)}><aside className="drawer compact-drawer" onMouseDown={(event) => event.stopPropagation()}><button className="drawer-close" onClick={() => setActiveSkill(null)}><X /></button><Pill tone="blue">{user?.role === "admin" ? "SKILL CONFIG" : "SKILL READ ONLY"}</Pill><h2>{activeSkill.name}</h2><label>Description<textarea readOnly={user?.role !== "admin"} value={activeSkill.description} onChange={(event) => setActiveSkill({ ...activeSkill, description: event.target.value })} /></label><label>Inputs<code className="vector-code">{activeSkill.inputs.join(" · ")}</code></label><label>Steps<div className="editable-steps">{activeSkill.steps.map((step: string, index: number) => <span key={step}><b>{index + 1}</b>{step}</span>)}</div></label>{user?.role === "admin" ? <button className="btn primary wide" onClick={async () => { const updated = await api.updateSkill(activeSkill.id, { description: activeSkill.description, steps: activeSkill.steps, enabled: true }); setSkills(skills.map((skill) => skill.id === updated.id ? updated : skill)); setActiveSkill(null); }}>保存 Skill 配置</button> : <div className="readonly-note"><ShieldCheck size={15} />学生账号可使用 Skill，只有管理员能修改全局配置。</div>}</aside></div>}
    </div>
  );
}

function AgentGate() { const navigate = useNavigate(); return <div className="gate"><Bot size={38} /><h1>Agent 还缺少领域知识</h1><p>请先构建知识库；建议再完成一次 RAG 对比后进入。</p><button className="btn primary" onClick={() => navigate("/lab/knowledge")}>前往实验一</button></div>; }
