import { useEffect, useState } from "react";
import { Bot, BrainCircuit, Boxes, Database, FileText, FlaskConical, Gauge, GitCompareArrows, Hexagon, Layers, LibraryBig, ListChecks, LogOut, Moon, Network, Radio, Route, Scale, Settings2, Sun, UserRound, Wand2, Wrench } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { useApp } from "../context/AppContext";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  eyebrow?: string;
  exact?: boolean;
}

const groups: Array<{ label: string; tone?: string; items: NavItem[] }> = [
  {
    label: "WORKSPACE",
    items: [
      { to: "/", label: "实验总览", icon: Gauge, exact: true },
    ],
  },
  {
    label: "数据工程",
    tone: "mint",
    items: [
      { to: "/lab/data", label: "密码语料构建", eyebrow: "实验 01", icon: Database },
    ],
  },
  {
    label: "模型训练与对齐",
    tone: "blue",
    items: [
      { to: "/lab/cpt", label: "继续预训练 CPT", eyebrow: "实验 02", icon: BrainCircuit },
      { to: "/lab/sft", label: "监督微调 SFT", eyebrow: "实验 03", icon: Wand2 },
      { to: "/lab/rlhf", label: "偏好对齐 RLHF", eyebrow: "实验 04", icon: Scale },
    ],
  },
  {
    label: "知识工程",
    tone: "purple",
    items: [
      { to: "/lab/knowledge", label: "向量知识库", eyebrow: "实验 05", icon: LibraryBig },
      { to: "/lab/rag", label: "RAG 检索增强", eyebrow: "实验 06", icon: GitCompareArrows },
    ],
  },
  {
    label: "Harness",
    tone: "amber",
    items: [
      { to: "/lab/skills", label: "Skills 技能封装", eyebrow: "实验 07", icon: ListChecks },
      { to: "/lab/tools", label: "Tools 工具调用", eyebrow: "实验 08", icon: Wrench },
      { to: "/lab/agent", label: "Agent 闭环", eyebrow: "实验 09", icon: Route },
      { to: "/lab/multi-agent", label: "多智能体协同", eyebrow: "实验 10", icon: Network },
    ],
  },
  {
    label: "RESOURCES",
    items: [
      { to: "/report", label: "实验报告", icon: FileText },
      { to: "/provider", label: "Provider 配置", icon: Settings2 },
    ],
  },
];

type FontSize = "compact" | "standard" | "large";

const fontSizes: Array<{ id: FontSize; label: string; sample: string }> = [
  { id: "compact", label: "紧凑字号", sample: "A−" },
  { id: "standard", label: "标准字号", sample: "A" },
  { id: "large", label: "大字号", sample: "A+" },
];

export function Layout() {
  const { user, project, bootstrap, logout } = useApp();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"dark" | "light">(() => document.documentElement.dataset.theme === "light" ? "light" : "dark");
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    const saved = document.documentElement.dataset.fontSize;
    return saved === "compact" || saved === "large" ? saved : "standard";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("cryptolab_theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#080d13" : "#f5f8f7");
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
    localStorage.setItem("cryptolab_font_size", fontSize);
  }, [fontSize]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Hexagon size={29} /><span>CL</span></div>
          <div><strong>CryptoLLMLab</strong><small>AI × CRYPTOGRAPHY</small></div>
        </div>
        <nav>
          {groups.map((group) => (
            <div className={`nav-group${group.tone ? ` tone-${group.tone}` : ""}`} key={group.label}>
              <span className="nav-section">{group.tone && <i className="nav-section-dot" />}{group.label}</span>
              {group.items.map(({ to, label, eyebrow, icon: Icon, exact }) => (
                <NavLink key={to} to={to} end={exact} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                  <Icon size={18} />
                  <span>{eyebrow && <small>{eyebrow}</small>}{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="provider-dot"><Radio size={14} /> {bootstrap?.providers.llm_status?.configured ? "云端大模型" : "本地教学模型"}</div>
          <div className="provider-name">{bootstrap?.providers.llm || "正在连接…"}</div>
          <small>{bootstrap?.providers.llm_status?.configured ? "已接入 · 异常自动回退本地" : "无需 API Key · 教学模拟"}</small>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-context">
            <i className="topbar-context-icon"><FlaskConical size={17} /></i>
            <span className="topbar-project-name" title={project?.name || "尚未开始当前实验"}>{project?.name || "尚未开始当前实验"}</span>
          </div>
          <div className="topbar-actions">
            <button
              className={`llm-status ${bootstrap?.providers.llm_status?.configured ? "ok" : "off"}`}
              type="button"
              title={bootstrap?.providers.llm_status?.configured ? "LLM 已连接，点击查看 Provider 配置" : "未配置云端 LLM，点击前往配置"}
              onClick={() => navigate("/provider")}
            >
              <i />
              <span>{bootstrap?.providers.llm_status?.configured ? (bootstrap.providers.llm_status.model || "LLM 已连接") : "LLM 未连接"}</span>
            </button>
            <div className="topbar-divider" />
            <div className="font-size-control" role="group" aria-label="调整文字大小">
              {fontSizes.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={fontSize === option.id ? "active" : ""}
                  aria-label={option.label}
                  aria-pressed={fontSize === option.id}
                  title={option.label}
                  onClick={() => setFontSize(option.id)}
                >{option.sample}</button>
              ))}
            </div>
            <button
              className="theme-toggle"
              type="button"
              aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
              title={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
              onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <div className="topbar-divider" />
            <div className="user-chip"><span className="avatar"><UserRound size={18} /></span><span><strong>{user?.display_name}</strong><small>{user?.role === "admin" ? "管理员" : "学生"}</small></span></div>
            <button className="logout-button" type="button" aria-label="退出登录" title="退出登录" onClick={logout}><LogOut size={15} /></button>
          </div>
        </header>
        <div className="page-wrap"><Outlet /></div>
      </main>
    </div>
  );
}
