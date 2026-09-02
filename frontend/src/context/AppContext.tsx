import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import type { AuthUser, BootstrapData, Dict, ProjectStatus } from "../types";

interface AppContextValue {
  user: AuthUser | null;
  bootstrap: BootstrapData | null;
  projects: ProjectStatus[];
  project: ProjectStatus | null;
  kb: Dict | null;
  ragRun: Dict | null;
  agentRun: Dict | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  setKb: (value: Dict | null) => void;
  setRagRun: (value: Dict | null) => void;
  setAgentRun: (value: Dict | null) => void;
  createProject: (name: string) => Promise<ProjectStatus>;
  updateProject: (projectId: string, payload: { name?: string; ended?: boolean }) => Promise<ProjectStatus>;
  refreshProjects: () => Promise<ProjectStatus[]>;
  refreshProject: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [projects, setProjects] = useState<ProjectStatus[]>([]);
  const [project, setProject] = useState<ProjectStatus | null>(null);
  const [kb, setKb] = useState<Dict | null>(null);
  const [ragRun, setRagRun] = useState<Dict | null>(null);
  const [agentRun, setAgentRun] = useState<Dict | null>(null);
  const [loading, setLoading] = useState(true);

  const clearWorkspace = () => {
    setBootstrap(null); setProjects([]); setProject(null);
    setKb(null); setRagRun(null); setAgentRun(null);
  };

  const loadWorkspace = async (currentUser: AuthUser) => {
    const [data, availableProjects] = await Promise.all([api.bootstrap(), api.projects()]);
    // 项目对学生透明：没有则自动创建一个默认工作区，登录后即可直接做实验。
    let workspace = availableProjects;
    let selected = workspace[0] || null;
    if (!selected) {
      selected = (await api.createProject("我的实验记录")) as ProjectStatus;
      workspace = await api.projects();
    } else {
      const savedId = localStorage.getItem(`cryptolab_project_id:${currentUser.id}`);
      selected = workspace.find((item) => item.id === savedId) || workspace[0];
    }
    setBootstrap(data as BootstrapData);
    setProjects(workspace);
    setProject(selected);
    if (selected) localStorage.setItem(`cryptolab_project_id:${currentUser.id}`, selected.id);
  };

  useEffect(() => {
    let active = true;
    api.me()
      .then(async ({ user: currentUser }) => {
        if (!active) return;
        setUser(currentUser);
        await loadWorkspace(currentUser);
      })
      .catch(() => { if (active) { setUser(null); clearWorkspace(); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = async (username: string, password: string) => {
    const { user: authenticatedUser } = await api.login(username, password);
    await loadWorkspace(authenticatedUser);
    setUser(authenticatedUser);
  };

  const register = async (username: string, password: string) => {
    const { user: registeredUser } = await api.register(username, password);
    await loadWorkspace(registeredUser);
    setUser(registeredUser);
  };

  const logout = async () => {
    try { await api.logout(); }
    finally { setUser(null); clearWorkspace(); }
  };

  const selectProject = async (projectId: string) => {
    if (!user || project?.id === projectId) return;
    const selected = (await api.project(projectId)) as ProjectStatus;
    localStorage.setItem(`cryptolab_project_id:${user.id}`, selected.id);
    setProject(selected);
    setKb(null); setRagRun(null); setAgentRun(null);
  };

  const createProject = async (name: string) => {
    const created = (await api.createProject(name)) as ProjectStatus;
    if (user) localStorage.setItem(`cryptolab_project_id:${user.id}`, created.id);
    const activeProjects = await api.projects();
    setProjects(activeProjects);
    setProject(created);
    setKb(null); setRagRun(null); setAgentRun(null);
    return created;
  };

  const refreshBootstrap = async () => {
    const data = await api.bootstrap();
    setBootstrap(data as BootstrapData);
  };

  const refreshProjects = async () => {
    const activeProjects = await api.projects();
    setProjects(activeProjects);
    if (project) {
      const refreshedCurrent = activeProjects.find((item) => item.id === project.id);
      if (refreshedCurrent) setProject(refreshedCurrent);
    }
    return activeProjects;
  };

  const updateProject = async (projectId: string, payload: { name?: string; ended?: boolean }) => {
    const updated = await api.updateProject(projectId, payload);
    const activeProjects = await api.projects();
    setProjects(activeProjects);
    if (!updated.is_ended) {
      if (user) localStorage.setItem(`cryptolab_project_id:${user.id}`, updated.id);
      setProject(updated);
      setKb(null); setRagRun(null); setAgentRun(null);
    } else if (project?.id === projectId) {
      const replacement = activeProjects[0] || null;
      setProject(replacement);
      if (user) {
        if (replacement) localStorage.setItem(`cryptolab_project_id:${user.id}`, replacement.id);
        else localStorage.removeItem(`cryptolab_project_id:${user.id}`);
      }
      setKb(null); setRagRun(null); setAgentRun(null);
    }
    return updated;
  };

  const refreshProject = async () => {
    if (!project) return;
    const refreshed = (await api.project(project.id)) as ProjectStatus;
    setProject(refreshed);
    setProjects((current) => current.map((item) => item.id === refreshed.id ? refreshed : item));
  };

  const value = useMemo(
    () => ({ user, bootstrap, projects, project, kb, ragRun, agentRun, loading, login, register, logout, selectProject, setKb, setRagRun, setAgentRun, createProject, updateProject, refreshProjects, refreshProject, refreshBootstrap }),
    [user, bootstrap, projects, project, kb, ragRun, agentRun, loading],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp 必须在 AppProvider 内使用");
  return value;
}
