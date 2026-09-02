import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clipboard, Download, FileJson, FileText, Gauge, GitCompareArrows, LoaderCircle, Sparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { EmptyState, LoadingBlock, Pill } from "../components/UI";
import { RichTextEditor } from "../components/RichTextEditor";
import { useApp } from "../context/AppContext";
import type { Dict, ProjectStatus } from "../types";

const catAccent: Dict = { data: "mint", training: "blue", knowledge: "purple", harness: "amber" };

export function ReportPage() {
  const { project: activeProject, bootstrap } = useApp();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<Dict | null>(null);
  const [experimentSummary, setExperimentSummary] = useState<Dict[]>([]);
  const [historicalProject, setHistoricalProject] = useState<ProjectStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [observationHtml, setObservationHtml] = useState("");
  const observationRef = useRef("");
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [exportError, setExportError] = useState("");
  const resolvedProjectId = projectId || activeProject?.id;
  const project = projectId ? historicalProject : activeProject;
  useEffect(() => {
    setReport(null);
    setHistoricalProject(null);
    setExperimentSummary([]);
    if (!resolvedProjectId) return;
    void Promise.all([
      api.report(resolvedProjectId),
      api.experimentReports(resolvedProjectId).catch(() => []),
      projectId ? api.project(resolvedProjectId) : Promise.resolve(activeProject),
    ]).then(([reportData, summary, projectData]) => {
      setReport(reportData);
      setExperimentSummary(summary as Dict[]);
      observationRef.current = reportData.observation?.html || "";
      setObservationHtml(observationRef.current);
      setSaveState("saved");
      if (projectId) setHistoricalProject(projectData as ProjectStatus);
    });
  }, [resolvedProjectId]);

  const persistObservation = useCallback(async () => {
    if (!resolvedProjectId) throw new Error("实验项目不存在");
    const html = observationRef.current;
    setSaveState("saving");
    try {
      const updated = await api.saveReportObservation(resolvedProjectId, html);
      if (observationRef.current === html) {
        setReport(updated);
        setSaveState("saved");
      }
      return updated;
    } catch (error) {
      setSaveState("error");
      throw error;
    }
  }, [resolvedProjectId]);

  useEffect(() => {
    if (!report || observationHtml === (report.observation?.html || "")) return;
    const timer = window.setTimeout(() => { void persistObservation().catch(() => undefined); }, 800);
    return () => window.clearTimeout(timer);
  }, [observationHtml, persistObservation, report?.observation?.html]);
  if (!resolvedProjectId) return <div className="gate"><FileText size={38} /><h1>还没有实验报告</h1><p>创建项目并运行实验后，报告会自动沉淀。</p><button className="btn primary" onClick={() => navigate("/")}>返回总览</button></div>;
  if (!report) return <LoadingBlock label="正在汇总实验参数、Trace 与能力指标…" />;
  if (!project) return null;

  const reportMarkdown = report.markdown;
  const safeName = project.name.replace(/[\\/:*?"<>|]/g, "_");
  const summaryById: Record<string, Dict> = {};
  for (const item of experimentSummary) summaryById[item.exp_id] = item;
  const categories: Dict[] = bootstrap?.experiment_categories || [];
  const completedCount = experimentSummary.filter((e) => e.run_count > 0).length;
  const observedCount = experimentSummary.filter((e) => e.has_observation).length;

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const download = async (format: "md" | "json") => {
    setExportError("");
    try {
      const ready = await persistObservation();
      const content = format === "md" ? ready.markdown : JSON.stringify(ready, null, 2);
      const blob = new Blob([content], { type: format === "md" ? "text/markdown" : "application/json" });
      saveBlob(blob, `${safeName}-实验报告.${format}`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "报告保存失败，请稍后重试");
    }
  };
  const downloadDocument = async (format: "pdf" | "docx") => {
    setExporting(format);
    setExportError("");
    try {
      await persistObservation();
      const blob = await api.exportReport(project.id, format);
      saveBlob(blob, `${safeName}-实验报告.${format}`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "报告生成失败，请稍后重试");
    } finally {
      setExporting(null);
    }
  };

  return <div className="report-page"><div className="page-title"><div><Pill tone="mint">REPORT CENTER</Pill><h1>实验报告<span>中心</span></h1><p>顶部是本项目总记录；下面 10 个实验各自成卡，点击进入该实验的报告页查看 A/B 摘要、撰写 LaTeX 报告并上传 PDF。</p></div><div><div className="report-actions"><button className="btn ghost compact" onClick={() => void download("json")}><FileJson size={15} /> JSON</button><button className="btn ghost compact" onClick={() => void download("md")}><Download size={15} /> Markdown</button><button className="btn ghost compact" disabled={exporting !== null} onClick={() => void downloadDocument("pdf")}><FileText size={15} /> {exporting === "pdf" ? "正在生成…" : "导出 PDF"}</button><button className="btn primary compact" disabled={exporting !== null} onClick={() => void downloadDocument("docx")}><FileText size={15} /> {exporting === "docx" ? "正在生成…" : "导出 Word (.docx)"}</button></div>{exportError && <p className="export-error" role="alert">{exportError}</p>}</div></div>

    <section className="report-hero panel"><div><span>CRYPTO LAB PROGRESS</span><h2>{project.name}</h2><p>{completedCount} / 10 个实验已运行 · {observedCount} 篇实验观察{project.is_ended ? " · 历史实验（只读）" : ""}</p></div><div className="overall-score"><Gauge /><strong>{Math.round(completedCount / 10 * 100)}<small>%</small></strong><span>实验完成度</span></div></section>

    {categories.map((cat) => { const tone = catAccent[cat.id] || "mint"; return <section className={`report-cat-block cat-panel cat-panel-${tone}`} key={cat.id}>
      <div className="category-label"><span className={`cat-dot cat-${tone}`} /><h3>{cat.name}</h3><span className="cat-count">{(cat.experiments as Dict[]).length} 个实验</span><i /></div>
      <div className="report-exp-grid">
        {(cat.experiments as Dict[]).map((exp) => {
          const expId = String(exp.index).padStart(2, "0");
          const s = summaryById[expId];
          const ran = s && s.run_count > 0;
          return <button className={`report-exp-card ${ran ? "ran" : ""}`} key={expId} onClick={() => navigate(`/report/experiment/${expId}`)}>
            <div className="report-exp-top"><span className="exp-index">实验 {expId}</span><Pill tone={exp.mode === "真实" ? "mint" : exp.mode === "仿真" ? "neutral" : "blue"}>{exp.mode}</Pill></div>
            <strong>{exp.title}</strong>
            <div className="report-exp-ab"><span className="ab-off">{exp.off}</span><GitCompareArrows size={13} /><span className="ab-on">{exp.on}</span></div>
            <div className="report-exp-foot">
              <span className={ran ? "status ok" : "status idle"}>{ran ? <><Check size={12} /> 已运行 {s.run_count} 次</> : "尚未运行"}</span>
              <span className={s?.has_report_pdf ? "status ok" : "status idle"}>{s?.has_report_pdf ? <><FileText size={12} /> 已交报告</> : "未交报告"}</span>
            </div>
          </button>;
        })}
      </div>
    </section>; })}

    <div className="report-grid"><section className="panel run-history"><div className="panel-head"><div><span className="step-label">RUN HISTORY</span><h2>全部运行记录</h2></div><Pill tone="blue">{report.runs.length} RUNS</Pill></div>{report.runs.length ? report.runs.slice().reverse().map((run: Dict) => <div className="history-row" key={run.id}><i><Check size={13} /></i><div><strong>{runLabel(run.type)}</strong><p>{run.input?.query || run.input?.task_id || (run.input?.documents ? `${run.input.documents.length} 份密码学资料` : "A/B 对比实验")}</p><small>{new Date(run.created_at).toLocaleString("zh-CN")} · {run.id}</small></div><Pill tone="mint">SUCCESS</Pill></div>) : <EmptyState title="暂无运行记录">进入任意实验运行后会自动写入。</EmptyState>}</section>
      <section className="panel markdown-report"><div className="panel-head"><div><span className="step-label">MARKDOWN PREVIEW</span><h2>可移交实验报告</h2></div><button className="icon-btn" aria-label="复制报告" onClick={() => { void persistObservation().then((ready) => navigator.clipboard.writeText(ready.markdown)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }).catch((error) => setExportError(error instanceof Error ? error.message : "报告保存失败")); }}>{copied ? <Check /> : <Clipboard />}</button></div><pre>{reportMarkdown}</pre></section></div>
    <section className="panel conclusion"><Sparkles /><div><span>OVERALL REFLECTION</span><h2>整体总结与感想</h2><p>这里是覆盖全部实验的总体总结；每个实验的具体观察请在对应实验页内填写。自动保存并合并到导出报告。</p><small className={`editor-save-status ${saveState}`}>{saveState === "saving" ? <><LoaderCircle className="spin" size={12} />正在保存…</> : saveState === "unsaved" ? "等待自动保存" : saveState === "error" ? "保存失败，请检查内容或网络" : <><Check size={12} />已保存到当前实验</>}</small></div><RichTextEditor value={observationHtml} onChange={(html) => { observationRef.current = html; setObservationHtml(html); setSaveState("unsaved"); }} onBlur={() => { if (observationRef.current !== (report.observation?.html || "")) void persistObservation().catch(() => undefined); }} /></section>
  </div>;
}

function runLabel(type: string): string {
  const map: Record<string, string> = {
    data_engineering: "实验 01 · 密码语料构建",
    cpt: "实验 02 · 继续预训练 CPT",
    sft: "实验 03 · 监督微调 SFT",
    rlhf: "实验 04 · 偏好对齐 RLHF",
    knowledge_base: "实验 05 · 向量知识库",
    rag: "实验 06 · RAG A/B 对比",
    skills: "实验 07 · Skills 技能封装",
    tool_experiment: "实验 08 · Tools 工具调用",
    agent_loop: "实验 09 · Agent 闭环",
    multi_agent: "实验 10 · 多智能体协同",
    agent: "Agent 任务",
  };
  return map[type] || type;
}
