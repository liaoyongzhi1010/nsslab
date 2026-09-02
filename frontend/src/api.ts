import type { AuthUser, Dict, ProjectStatus } from "./types";

const jsonHeaders = { "Content-Type": "application/json" };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `请求失败：${response.status}`);
  return body as T;
}

async function requestBlob(url: string, options?: RequestInit): Promise<Blob> {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `请求失败：${response.status}`);
  }
  return response.blob();
}

export const api = {
  me: () => request<{ user: AuthUser }>("/api/auth/me"),
  login: (username: string, password: string) => request<{ user: AuthUser }>("/api/auth/login", {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ username, password }),
  }),
  register: (username: string, password: string) => request<{ user: AuthUser }>("/api/auth/register", {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ username, password }),
  }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  bootstrap: () => request<Dict>("/api/bootstrap"),
  projects: (includeEnded = false) => request<ProjectStatus[]>(`/api/projects${includeEnded ? "?include_ended=true" : ""}`),
  createProject: (name: string) => request<Dict>("/api/projects", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name }) }),
  project: (id: string) => request<Dict>(`/api/projects/${id}`),
  updateProject: (id: string, payload: { name?: string; ended?: boolean }) => request<ProjectStatus>(`/api/projects/${id}`, {
    method: "PATCH", headers: jsonHeaders, body: JSON.stringify(payload),
  }),
  document: (id: string, projectId?: string) => request<Dict>(`/api/documents/${id}${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`),
  projectDocuments: (id: string) => request<Dict[]>(`/api/projects/${id}/documents`),
  uploadDocument: async (projectId: string, file: File) => {
    const form = new FormData();
    form.append("project_id", projectId);
    form.append("file", file);
    return request<Dict>("/api/documents/upload", { method: "POST", body: form });
  },
  buildKb: (payload: Dict) => request<Dict>("/api/kb/build", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  kbParse: (payload: Dict) => request<Dict>("/api/kb/parse", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  kbChunk: (payload: Dict) => request<Dict>("/api/kb/chunk", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  kbEmbed: (payload: Dict) => request<Dict>("/api/kb/embed", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  kbStats: (id: string) => request<Dict>(`/api/kb/${id}/stats`),
  search: (payload: Dict) => request<Dict>("/api/kb/search", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  ragCompare: (payload: Dict) => request<Dict>("/api/rag/compare", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  ragEmbedQuery: (payload: Dict) => request<Dict>("/api/rag/embed-query", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  ragRerank: (payload: Dict) => request<Dict>("/api/rag/rerank", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  ragContext: (payload: Dict) => request<Dict>("/api/rag/context", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  skills: () => request<Dict[]>("/api/skills"),
  tools: () => request<Dict[]>("/api/tools"),
  updateSkill: (id: string, payload: Dict) => request<Dict>(`/api/skills/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }),
  agentRun: (payload: Dict) => request<Dict>("/api/agents/run", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  runToolExperiment: (payload: Dict) => request<Dict>("/api/experiments/tools/run", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  runDataExperiment: (payload: Dict) => request<Dict>("/api/experiments/data/run", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  runCptExperiment: (payload: Dict) => request<Dict>("/api/experiments/cpt/run", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  runSftExperiment: (payload: Dict) => request<Dict>("/api/experiments/sft/run", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  runRlhfExperiment: (payload: Dict) => request<Dict>("/api/experiments/rlhf/run", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  runMultiAgentExperiment: (payload: Dict) => request<Dict>("/api/experiments/multi-agent/run", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  runSkillExperiment: (payload: Dict) => request<Dict>("/api/experiments/skills/run", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  runAgentLoopExperiment: (payload: Dict) => request<Dict>("/api/experiments/agent-loop/run", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  updateProvider: (payload: Dict) => request<Dict>("/api/provider/llm", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }),
  report: (id: string) => request<Dict>(`/api/reports/${id}`),
  saveReportObservation: (id: string, html: string) => request<Dict>(`/api/reports/${id}/observation`, {
    method: "PUT", headers: jsonHeaders, body: JSON.stringify({ html }),
  }),
  exportReport: (id: string, format: "pdf" | "docx") => requestBlob(`/api/reports/${id}/export`, {
    method: "POST", headers: jsonHeaders, body: JSON.stringify({ format }),
  }),
  experimentReports: (id: string) => request<Dict[]>(`/api/reports/${id}/experiments`),
  experimentReport: (id: string, expId: string) => request<Dict>(`/api/reports/${id}/experiments/${expId}`),
  saveExperimentObservation: (id: string, expId: string, html: string) => request<Dict>(`/api/reports/${id}/experiments/${expId}/observation`, {
    method: "PUT", headers: jsonHeaders, body: JSON.stringify({ html }),
  }),
  uploadExperimentReportPdf: async (id: string, expId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Dict>(`/api/reports/${id}/experiments/${expId}/pdf`, { method: "POST", body: form });
  },
  experimentReportPdfUrl: (id: string, expId: string) => `/api/reports/${id}/experiments/${expId}/pdf?t=${Date.now()}`,
  deleteExperimentReportPdf: (id: string, expId: string) => request<Dict>(`/api/reports/${id}/experiments/${expId}/pdf`, { method: "DELETE" }),
};
