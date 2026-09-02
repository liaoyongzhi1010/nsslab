import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, ExternalLink, FileText, FlaskConical, LoaderCircle, NotebookPen, Trash2, UploadCloud } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { LoadingBlock, Pill } from "../components/UI";
import { RichTextEditor } from "../components/RichTextEditor";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

const EXP_ROUTE: Record<string, string> = {
  "01": "/lab/data", "02": "/lab/cpt", "03": "/lab/sft", "04": "/lab/rlhf", "05": "/lab/knowledge",
  "06": "/lab/rag", "07": "/lab/skills", "08": "/lab/tools", "09": "/lab/agent", "10": "/lab/multi-agent",
};
const EXP_TONE: Record<string, string> = {
  "01": "mint", "02": "blue", "03": "blue", "04": "blue", "05": "purple", "06": "purple",
  "07": "amber", "08": "amber", "09": "amber", "10": "amber",
};

const METRIC_LABELS: Record<string, string> = {
  quality_gain: "质量提升", dedup_rate: "去重率", retention_rate: "保留率", raw_count: "原始样本", kept_count: "保留样本",
  final_loss_base: "基座 loss", final_loss_cpt: "CPT loss", probe_gain: "知识探针提升", perplexity_drop: "困惑度下降",
  instruction_follow_base: "对照遵循率", instruction_follow_sft: "SFT 遵循率", follow_gain: "遵循率提升",
  reward_margin: "奖励差", safety_gain: "安全提升", win_rate: "偏好胜率",
  accuracy_gain: "准确率提升", knowledge_gain: "知识增益", hit_rate: "命中率", latency_ms: "耗时(ms)",
  plan_steps: "计划步数", multi_agents: "Agent 数", completion_rate: "完成率",
};

export function ExperimentReportPage() {
  const { project } = useApp();
  const { expId = "01" } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<Dict | null>(null);
  const [observationHtml, setObservationHtml] = useState("");
  const observationRef = useRef("");
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(() => {
    if (!project) return;
    api.experimentReport(project.id, expId).then((data) => {
      setReport(data);
      observationRef.current = data.observation?.html || "";
      setObservationHtml(observationRef.current);
      setSaveState("saved");
    });
  }, [project?.id, expId]);

  useEffect(() => { setReport(null); load(); }, [load]);

  const persist = useCallback(async () => {
    if (!project) return;
    const html = observationRef.current;
    setSaveState("saving");
    try {
      await api.saveExperimentObservation(project.id, expId, html);
      if (observationRef.current === html) setSaveState("saved");
    } catch { setSaveState("error"); }
  }, [project?.id, expId]);

  useEffect(() => {
    if (!report || observationHtml === (report.observation?.html || "")) return;
    const timer = window.setTimeout(() => { void persist(); }, 800);
    return () => window.clearTimeout(timer);
  }, [observationHtml, persist, report?.observation?.html]);

  if (!project) return <div className="gate"><FlaskConical size={38} /><h1>请先选择实验项目</h1><button className="btn primary" onClick={() => navigate("/")}>返回总览</button></div>;
  if (!report) return <LoadingBlock label="正在加载实验报告…" />;

  const tone = EXP_TONE[expId] || "mint";
  const latest = report.latest_run as Dict | null;
  const output = (latest?.output || {}) as Dict;
  const metrics = (output.metrics || latest?.metrics || {}) as Dict;
  const off = output.off as Dict | undefined;
  const on = output.on as Dict | undefined;
  const pdf = report.report_pdf as Dict | null;

  const overleafUrl = "https://www.overleaf.com/project";
  const texpageUrl = "https://www.texpage.com";

  const downloadTemplate = () => {
    const tpl = `\\documentclass[11pt]{article}\n\\usepackage{ctex}\n\\usepackage{geometry}\n\\geometry{margin=2.5cm}\n\\usepackage{graphicx}\n\\usepackage{amsmath,amssymb}\n\\usepackage{booktabs}\n\\usepackage{hyperref}\n\n\\title{实验${expId}·${report.label}\\\\实验报告}\n\\author{姓名 \\quad 学号}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\section{实验目的}\n简述本实验要验证的「有该能力 vs 没该能力」对照假设。\n\n\\section{实验方法与设置}\n描述对照组(OFF)与实验组(ON)的配置、数据与参数。\n\n\\section{实验结果}\n粘贴平台运行得到的 A/B 指标与关键对比，可配图表。\n\n\\section{结果分析}\n分析指标变化的原因，能力带来的真实增益与边界。\n\n\\section{结论与思考}\n总结你的发现、疑问与改进方向。\n\n\\end{document}\n`;
    const blob = new Blob([tpl], { type: "text/x-tex;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `实验${expId}_${report.label}_报告模板.tex`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setUploadError("请上传 PDF 文件"); return; }
    setUploading(true);
    try {
      await api.uploadExperimentReportPdf(project.id, expId, file);
      load();
    } catch (e) { setUploadError(e instanceof Error ? e.message : "上传失败"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const removePdf = async () => {
    setUploadError("");
    try { await api.deleteExperimentReportPdf(project.id, expId); load(); }
    catch (e) { setUploadError(e instanceof Error ? e.message : "删除失败"); }
  };

  return <div className={`lab-page exp-report-page cat-tone-${tone}`}>
    <div className="page-title">
      <div>
        <button className="back-link" onClick={() => navigate("/report")}><ArrowLeft size={15} /> 返回报告中心</button>
        <Pill tone="blue">实验 {expId} · 报告</Pill>
        <h1>{report.label}<span> 实验报告</span></h1>
        <p>查看本实验的 A/B 结果摘要，在 Overleaf / TeXpage 撰写 LaTeX 报告后上传 PDF，并记录你的观察与思考。</p>
      </div>
      <div className="page-title-badges">
        <button className="btn ghost compact" onClick={() => navigate(EXP_ROUTE[expId] || "/")}><FlaskConical size={15} /> 前往实验页</button>
      </div>
    </div>

    <section className="panel exp-report-summary">
      <div className="panel-head"><div><h2>A/B 结果摘要</h2><p>{report.run_count > 0 ? `已运行 ${report.run_count} 次 · 取最近一次结果` : "本实验尚未运行，先到实验页点击运行生成对照结果"}</p></div>{report.run_count > 0 ? <Pill tone="mint"><Check size={13} /> 已运行</Pill> : <Pill tone="neutral">未运行</Pill>}</div>
      {report.run_count > 0 ? <>
        {(off || on) && <div className="exp-report-ab">
          <div className="ab-col off"><span className="ab-tag">对照组 OFF</span><strong>{String(off?.label || off?.answer || "基线").slice(0, 60)}</strong></div>
          <ArrowRight size={16} />
          <div className="ab-col on"><span className="ab-tag">实验组 ON</span><strong>{String(on?.label || on?.answer || "增强").slice(0, 60)}</strong></div>
        </div>}
        {Object.keys(metrics).length > 0 && <div className="exp-report-metrics">
          {Object.entries(metrics).slice(0, 6).map(([k, v]) => <div className="exp-metric" key={k}><span>{METRIC_LABELS[k] || k}</span><strong>{typeof v === "number" ? (v < 1 && v > 0 ? `${Math.round(v * 100)}%` : v) : String(v)}</strong></div>)}
        </div>}
        {output.diagnosis && <p className="exp-report-diagnosis">{output.diagnosis}</p>}
      </> : <div className="exp-report-empty"><FlaskConical size={28} /><p>还没有运行记录</p><button className="btn primary compact" onClick={() => navigate(EXP_ROUTE[expId] || "/")}>去运行实验 <ArrowRight size={15} /></button></div>}
    </section>

    <section className="panel exp-report-writing">
      <div className="panel-head"><div><h2>撰写实验报告（LaTeX）</h2><p>推荐在 Overleaf 或 TeXpage 在线编辑器撰写，写好后导出 PDF 上传到这里归档。</p></div></div>
      <div className="writing-actions">
        <a className="write-btn overleaf" href={overleafUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> 打开 Overleaf</a>
        <a className="write-btn texpage" href={texpageUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> 打开 TeXpage</a>
        <button className="write-btn template" onClick={downloadTemplate}><Download size={16} /> 下载 .tex 报告模板</button>
      </div>

      <div className="pdf-zone">
        {pdf ? <>
          <div className="pdf-meta">
            <FileText size={18} />
            <div><strong>{pdf.filename}</strong><small>{(pdf.size_bytes / 1024).toFixed(0)} KB · 上传于 {new Date(pdf.uploaded_at).toLocaleString("zh-CN")}</small></div>
            <a className="btn ghost compact" href={api.experimentReportPdfUrl(project.id, expId)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 新窗口打开</a>
            <button className="btn ghost compact danger" onClick={removePdf}><Trash2 size={14} /> 删除</button>
            <button className="btn ghost compact" onClick={() => fileRef.current?.click()}><UploadCloud size={14} /> 替换</button>
          </div>
          <iframe className="pdf-preview" title="报告预览" src={api.experimentReportPdfUrl(project.id, expId)} />
        </> : <button className="pdf-dropzone" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <><LoaderCircle className="spin" size={22} /><strong>正在上传…</strong></> : <><UploadCloud size={26} /><strong>点击上传报告 PDF</strong><span>在 Overleaf/TeXpage 导出的 PDF · 单文件不超过 10 MB</span></>}
        </button>}
        {uploadError && <div className="error-banner">{uploadError}</div>}
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => onPickFile(e.target.files?.[0])} />
      </div>
    </section>

    <section className="panel exp-report-observation">
      <div className="panel-head"><div><h2><NotebookPen size={17} /> 观察与思考</h2><p>记录你在本实验中的发现、疑问和收获，自动保存并汇入报告中心。</p></div><small className={`editor-save-status ${saveState}`}>{saveState === "saving" ? <><LoaderCircle className="spin" size={12} />保存中…</> : saveState === "unsaved" ? "待保存" : saveState === "error" ? "保存失败" : <><Check size={12} />已保存</>}</small></div>
      <RichTextEditor value={observationHtml} onChange={(html) => { observationRef.current = html; setObservationHtml(html); setSaveState("unsaved"); }} onBlur={() => { if (observationRef.current !== (report.observation?.html || "")) void persist(); }} />
    </section>
  </div>;
}
