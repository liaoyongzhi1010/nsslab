import { useEffect, useState } from "react";
import { Check, FileText, GitCompareArrows } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { LoadingBlock, Pill } from "../components/UI";
import { useApp } from "../context/AppContext";
import type { Dict, ProjectStatus } from "../types";

const catAccent: Dict = { data: "mint", training: "blue", knowledge: "purple", harness: "amber" };

export function ReportPage() {
  const { project: activeProject, bootstrap } = useApp();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [experimentSummary, setExperimentSummary] = useState<Dict[] | null>(null);
  const [historicalProject, setHistoricalProject] = useState<ProjectStatus | null>(null);
  const resolvedProjectId = projectId || activeProject?.id;
  const project = projectId ? historicalProject : activeProject;

  useEffect(() => {
    setExperimentSummary(null);
    setHistoricalProject(null);
    if (!resolvedProjectId) return;
    void Promise.all([
      api.experimentReports(resolvedProjectId).catch(() => [] as Dict[]),
      projectId ? api.project(resolvedProjectId) : Promise.resolve(activeProject),
    ]).then(([summary, projectData]) => {
      setExperimentSummary(summary as Dict[]);
      if (projectId) setHistoricalProject(projectData as ProjectStatus);
    });
  }, [resolvedProjectId]);

  if (!resolvedProjectId) return <div className="gate"><FileText size={38} /><h1>还没有实验报告</h1><p>创建项目并进入实验后，报告会在这里汇总。</p><button className="btn primary" onClick={() => navigate("/")}>返回总览</button></div>;
  if (!experimentSummary || !project) return <LoadingBlock label="正在汇总实验报告…" />;

  const summaryById: Record<string, Dict> = {};
  for (const item of experimentSummary) summaryById[item.exp_id] = item;
  const categories: Dict[] = bootstrap?.experiment_categories || [];
  const submittedCount = experimentSummary.filter((e) => e.has_report_pdf).length;

  return <div className="report-page">
    <div className="page-title"><div><Pill tone="blue">报告中心</Pill><h1>实验报告<span>中心</span></h1><p>下面 10 个实验各自成卡，点击进入该实验的报告页查看实验要点、撰写 LaTeX 报告并上传 PDF。</p></div></div>

    <section className="report-hero panel"><div><span className="report-hero-eyebrow">MY REPORTS</span><h2>{project.name}</h2><p>已提交 {submittedCount} / 10 篇实验报告{project.is_ended ? " · 历史实验（只读）" : ""}</p></div><div className="overall-score"><FileText size={26} /><strong>{submittedCount}<small>/10</small></strong><span>已交报告</span></div></section>

    {categories.map((cat) => { const tone = catAccent[cat.id] || "mint"; return <section className={`report-cat-block cat-panel cat-panel-${tone}`} key={cat.id}>
      <div className="category-label"><span className={`cat-dot cat-${tone}`} /><h3>{cat.name}</h3><span className="cat-count">{(cat.experiments as Dict[]).length} 个实验</span><i /></div>
      <div className="report-exp-grid">
        {(cat.experiments as Dict[]).map((exp) => {
          const expId = String(exp.index).padStart(2, "0");
          const s = summaryById[expId];
          const submitted = s?.has_report_pdf;
          return <button className={`report-exp-card ${submitted ? "ran" : ""}`} key={expId} onClick={() => navigate(`/report/experiment/${expId}`)}>
            <div className="report-exp-top"><span className="exp-index">实验 {expId}</span><Pill tone={exp.mode === "真实" ? "mint" : exp.mode === "仿真" ? "neutral" : "blue"}>{exp.mode}</Pill></div>
            <strong>{exp.title}</strong>
            <div className="report-exp-ab"><span className="ab-off">{exp.off}</span><GitCompareArrows size={13} /><span className="ab-on">{exp.on}</span></div>
            <div className="report-exp-foot">
              <span className={submitted ? "status ok" : "status idle"}>{submitted ? <><Check size={12} /> 已提交报告</> : "未提交报告"}</span>
            </div>
          </button>;
        })}
      </div>
    </section>; })}
  </div>;
}
