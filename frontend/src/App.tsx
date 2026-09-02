import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AppProvider, useApp } from "./context/AppContext";
import { AgentLab } from "./pages/AgentLab";
import { AgentLoopLab } from "./pages/AgentLoopLab";
import { CptLab } from "./pages/CptLab";
import { Dashboard } from "./pages/Dashboard";
import { DataLab } from "./pages/DataLab";
import { ExperimentReportPage } from "./pages/ExperimentReportPage";
import { GradingConsole } from "./pages/GradingConsole";
import { KnowledgeLab } from "./pages/KnowledgeLab";
import { LoginPage } from "./pages/LoginPage";
import { MultiAgentLab } from "./pages/MultiAgentLab";
import { ProjectManager } from "./pages/ProjectManager";
import { ProviderConfig } from "./pages/ProviderConfig";
import { RagLab } from "./pages/RagLab";
import { ReportPage } from "./pages/ReportPage";
import { RlhfLab } from "./pages/RlhfLab";
import { SftLab } from "./pages/SftLab";
import { SkillLab } from "./pages/SkillLab";
import { ToolLab } from "./pages/ToolLab";

function AuthenticatedApp() {
  const { loading, user } = useApp();
  if (loading) return <div className="app-loading"><i /><strong>CryptoLLMLab</strong><span>正在建立安全会话…</span></div>;
  if (!user) return <LoginPage />;
  return <Routes><Route element={<Layout />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/projects" element={<ProjectManager />} />
    <Route path="/lab/data" element={<DataLab />} />
    <Route path="/lab/cpt" element={<CptLab />} />
    <Route path="/lab/sft" element={<SftLab />} />
    <Route path="/lab/rlhf" element={<RlhfLab />} />
    <Route path="/lab/knowledge" element={<KnowledgeLab />} />
    <Route path="/lab/rag" element={<RagLab />} />
    <Route path="/lab/skills" element={<SkillLab />} />
    <Route path="/lab/tools" element={<ToolLab />} />
    <Route path="/lab/agent" element={<AgentLoopLab />} />
    <Route path="/lab/multi-agent" element={<MultiAgentLab />} />
    <Route path="/lab/agent-legacy" element={<AgentLab />} />
    <Route path="/provider" element={<ProviderConfig />} />
    <Route path="/admin/grading" element={<GradingConsole />} />
    <Route path="/report/experiment/:expId" element={<ExperimentReportPage />} />
    <Route path="/report/:projectId?" element={<ReportPage />} />
  </Route></Routes>;
}

export default function App() {
  return <BrowserRouter><AppProvider><AuthenticatedApp /></AppProvider></BrowserRouter>;
}
