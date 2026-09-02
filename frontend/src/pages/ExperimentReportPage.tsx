import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, ExternalLink, FileText, FlaskConical, ListChecks, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { LoadingBlock, Pill } from "../components/UI";
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

export function ExperimentReportPage() {
  const { project } = useApp();
  const { expId = "01" } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<Dict | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(() => {
    if (!project) return;
    api.experimentReport(project.id, expId).then(setReport);
  }, [project?.id, expId]);

  useEffect(() => { setReport(null); load(); }, [load]);

  if (!project) return <div className="gate"><FlaskConical size={38} /><h1>请先选择实验项目</h1><button className="btn primary" onClick={() => navigate("/")}>返回总览</button></div>;
  if (!report) return <LoadingBlock label="正在加载实验报告…" />;

  const tone = EXP_TONE[expId] || "mint";
  const objectives = (report.objectives || []) as string[];
  const ab = (report.ab || {}) as Dict;
  const pdf = report.report_pdf as Dict | null;

  const downloadTemplate = () => {
    const tpl = `\\documentclass[11pt]{article}\n\\usepackage{ctex}\n\\usepackage{geometry}\n\\geometry{margin=2.5cm}\n\\usepackage{graphicx}\n\\usepackage{amsmath,amssymb}\n\\usepackage{booktabs}\n\\usepackage{hyperref}\n\n\\title{实验${expId}·${report.title || report.label}\\\\实验报告}\n\\author{姓名 \\quad 学号}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\section{实验目的}\n简述本实验的对照假设（有该能力 vs 没该能力），以及你希望验证的问题。\n\n\\section{实验方法与设置}\n描述对照组(OFF：${ab.off || ""})与实验组(ON：${ab.on || ""})的配置、数据与参数。\n\n\\section{实验过程与结果}\n记录你在平台上的操作、运行得到的对照结果与关键指标，可配图表。\n\n\\section{结果分析}\n分析指标变化的原因，该能力带来的真实增益与边界。\n\n\\section{结论与思考}\n总结你的发现、疑问与改进方向。\n\n\\end{document}\n`;
    const blob = new Blob([tpl], { type: "text/x-tex;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `实验${expId}_${report.title || report.label}_报告模板.tex`;
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
        <h1>{report.title || report.label}<span> 实验报告</span></h1>
        <p>先看清本实验要掌握的要点，据此在 Overleaf / TeXpage 撰写 LaTeX 报告，导出 PDF 后上传提交。</p>
      </div>
      <div className="page-title-badges">
        <button className="btn ghost compact" onClick={() => navigate(EXP_ROUTE[expId] || "/")}><FlaskConical size={15} /> 前往实验页</button>
      </div>
    </div>

    <section className="panel exp-objectives">
      <div className="panel-head"><div><h2><ListChecks size={18} /> 本次实验要点</h2><p>这些是本实验希望你掌握的核心点，请围绕它们撰写实验报告；老师也将据此评分。</p></div></div>
      <ol className="objective-list">
        {objectives.map((o, i) => <li key={i}><span className="obj-num">{i + 1}</span><p>{o}</p></li>)}
      </ol>
    </section>

    <section className="panel exp-report-writing">
      <div className="panel-head"><div><h2>撰写并提交报告（LaTeX）</h2><p>推荐在 Overleaf 或 TeXpage 在线撰写，写好后导出 PDF 上传到这里提交。</p></div></div>
      <div className="writing-actions">
        <a className="write-btn overleaf" href="https://www.overleaf.com/project" target="_blank" rel="noreferrer"><ExternalLink size={16} /> 打开 Overleaf</a>
        <a className="write-btn texpage" href="https://www.texpage.com" target="_blank" rel="noreferrer"><ExternalLink size={16} /> 打开 TeXpage</a>
        <button className="write-btn template" onClick={downloadTemplate}><Download size={16} /> 下载 .tex 报告模板</button>
      </div>

      <div className="pdf-zone">
        {pdf ? <>
          <div className="pdf-meta">
            <FileText size={18} />
            <div><strong>{pdf.filename}</strong><small>{(pdf.size_bytes / 1024).toFixed(0)} KB · 提交于 {new Date(pdf.uploaded_at).toLocaleString("zh-CN")}</small></div>
            <a className="btn ghost compact" href={api.experimentReportPdfUrl(project.id, expId)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> 新窗口打开</a>
            <button className="btn ghost compact" onClick={() => fileRef.current?.click()}><UploadCloud size={14} /> 替换</button>
            <button className="btn ghost compact danger" onClick={removePdf}><Trash2 size={14} /> 删除</button>
          </div>
          <iframe className="pdf-preview" title="报告预览" src={api.experimentReportPdfUrl(project.id, expId)} />
        </> : <button className="pdf-dropzone" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <><LoaderCircle className="spin" size={22} /><strong>正在上传…</strong></> : <><UploadCloud size={26} /><strong>点击上传报告 PDF</strong><span>在 Overleaf/TeXpage 导出的 PDF · 单文件不超过 10 MB</span></>}
        </button>}
        {uploadError && <div className="error-banner">{uploadError}</div>}
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => onPickFile(e.target.files?.[0])} />
      </div>
    </section>
  </div>;
}
