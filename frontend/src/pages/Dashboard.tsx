import { ArrowRight, BrainCircuit, ChevronRight, Database, GitCompareArrows, Network, Sparkles, WandSparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Pill } from "../components/UI";
import type { Dict } from "../types";

const fallbackCategories: Dict[] = [
  { id: "data", name: "数据工程", experiments: [{ id: "data_engineering", index: 1, title: "密码语料构建与治理", route: "/lab/data", mode: "仿真", off: "原始杂乱语料", on: "高质量数据集" }] },
  { id: "training", name: "模型训练与对齐", experiments: [
    { id: "cpt", index: 2, title: "继续预训练 CPT", route: "/lab/cpt", mode: "仿真", off: "通用基座", on: "注入密码知识" },
    { id: "sft", index: 3, title: "监督微调 SFT", route: "/lab/sft", mode: "仿真+真实", off: "仅预训练", on: "指令微调后" },
    { id: "rlhf", index: 4, title: "偏好对齐 RLHF/DPO", route: "/lab/rlhf", mode: "仿真", off: "SFT 后", on: "偏好对齐后" },
  ] },
  { id: "knowledge", name: "知识工程", experiments: [
    { id: "knowledge", index: 5, title: "向量知识库构建", route: "/lab/knowledge", mode: "真实", off: "无知识库", on: "向量库" },
    { id: "rag", index: 6, title: "RAG 检索增强", route: "/lab/rag", mode: "真实", off: "Base LLM", on: "Crypto-RAG" },
  ] },
  { id: "harness", name: "Harness", experiments: [
    { id: "skills", index: 7, title: "Skills 技能封装", route: "/lab/skills", mode: "真实", off: "纯 prompt", on: "挂载 Skill" },
    { id: "tools", index: 8, title: "Tools 工具调用", route: "/lab/tools", mode: "真实", off: "无工具", on: "安全工具" },
    { id: "agent", index: 9, title: "Agent 闭环", route: "/lab/agent", mode: "真实", off: "单步无状态", on: "规划+记忆" },
    { id: "multi_agent", index: 10, title: "多智能体协同", route: "/lab/multi-agent", mode: "真实", off: "单 Agent", on: "多 Agent" },
  ] },
];

const catAccent: Dict = { data: "mint", training: "blue", knowledge: "purple", harness: "amber" };

export function Dashboard() {
  const { project, bootstrap } = useApp();
  const navigate = useNavigate();
  const categories: Dict[] = bootstrap?.experiment_categories?.length ? bootstrap.experiment_categories : fallbackCategories;
  const totalRuns = project?.stats.runs || 0;

  return (
    <div className="dashboard">
      <section className="hero">
        <div className="hero-copy">
          <Pill tone="mint"><Sparkles size={13} /> 10 个独立实验 · 密码学垂域</Pill>
          <h1>构建你的专属<br /><em><span>“mini”</span>密码学智能体</em></h1>
          <p>沿数据工程 → 模型训练与对齐 → 知识工程 → Harness 主线，每个实验都用一次对照运行，让你直观看到每一层能力带来的真实增益。</p>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => navigate("/lab/data")}>从第一个实验开始<ArrowRight size={17} /></button>
            <button className="btn ghost" onClick={() => navigate("/report")}>查看实验报告<GitCompareArrows size={16} /></button>
          </div>
          <div className="hero-meta"><span><Database size={15} /> 密码学垂域</span><span><GitCompareArrows size={15} /> 10 个对照实验</span><span><Network size={15} /> 全链路可观察</span></div>
        </div>
        <div className="model-orbit" aria-label="CryptoLLMLab 能力组成">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="core-orb"><WandSparkles size={26} /><strong>CryptoLLMLab</strong><small>{totalRuns > 0 ? "BUILDING" : "READY"}</small></div>
          <div className="sat sat-a"><Database /><span>DATA</span></div>
          <div className="sat sat-b"><BrainCircuit /><span>TRAIN</span></div>
          <div className="sat sat-c"><GitCompareArrows /><span>RAG</span></div>
          <div className="sat sat-d"><Network /><span>AGENT</span></div>
        </div>
      </section>

      <section className="journey-section">
        <div className="section-heading"><div><span>LEARNING PATH</span><h2>一条完整的垂域大模型构建链路</h2></div></div>
        {categories.map((cat) => (
          <div className={`category-block cat-panel cat-panel-${catAccent[cat.id] || "mint"}`} key={cat.id}>
            <div className="category-label"><span className={`cat-dot cat-${catAccent[cat.id] || "mint"}`} /><h3>{cat.name}</h3><span className="cat-count">{cat.experiments.length} 个实验</span><i /></div>
            <div className="lab-grid">
              {cat.experiments.map((exp: Dict) => (
                <article className={`lab-card card-${catAccent[cat.id] || "mint"}`} key={exp.id} onClick={() => navigate(exp.route)}>
                  <div className="lab-card-head"><span className="lab-number">{String(exp.index).padStart(2, "0")}</span><span className="lab-card-dot" /></div>
                  <h3>{exp.title}</h3>
                  <div className="lab-card-ab"><span className="ab-from">{exp.off}</span><ArrowRight size={13} /><span className="ab-to">{exp.on}</span></div>
                  <div className="card-go">进入实验 <ChevronRight size={17} /></div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
