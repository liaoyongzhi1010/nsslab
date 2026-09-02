import { useState, type FormEvent } from "react";
import { ArrowRight, BrainCircuit, FlaskConical, GraduationCap, Hexagon, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useApp } from "../context/AppContext";

type AuthMode = "login" | "register";

export function LoginPage() {
  const { login, register } = useApp();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode); setPassword(""); setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true); setError("");
    try {
      if (mode === "login") await login(username, password);
      else await register(username, password);
    } catch (reason) { setError((reason as Error).message); }
    finally { setSubmitting(false); }
  };

  return <main className="login-page">
    <section className="login-story">
      <div className="login-brand"><span><Hexagon /><b>CL</b></span><div><strong>CryptoLLMLab</strong><small>AI × CRYPTOGRAPHY</small></div></div>
      <div className="login-copy"><div className="login-kicker"><FlaskConical size={15} /> AI 赋能密码学实验平台</div><h1>构建你的专属<br /><em>“mini”密码学智能体</em></h1><p>从资料解析、向量知识库与 Crypto-RAG，到可观察、可复现的密码学智能体实验。</p></div>
      <div className="login-capabilities"><span><BrainCircuit />模型训练与对齐</span><span><ShieldCheck />知识增强检索</span><span><GraduationCap />智能体 Harness</span></div>
    </section>
    <section className="login-form-side">
      <form className="login-card" onSubmit={submit}>
        <div className="auth-tabs" role="tablist" aria-label="账号入口">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>登录</button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>学生注册</button>
        </div>
        <span className="step-label">{mode === "login" ? "ACCOUNT ACCESS" : "STUDENT ENROLLMENT"}</span>
        <h2>{mode === "login" ? "登录实验工作台" : "注册学生账号"}</h2>
        <p>{mode === "login" ? "使用平台账号登录即可开始密码学实验。" : "设置用户名和密码即可创建学生账号并进入平台。"}</p>
        <label><span>用户名</span><div className="login-input"><UserRound /><input autoFocus autoComplete="username" aria-label="用户名" placeholder="字母、数字、点、横线或下划线" pattern="[A-Za-z0-9_.-]+" minLength={2} maxLength={64} value={username} onChange={(event) => setUsername(event.target.value)} required /></div></label>
        <label><span>密码</span><div className="login-input"><KeyRound /><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} aria-label="密码" placeholder={mode === "login" ? "请输入密码" : "至少 8 个字符"} minLength={8} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} required /></div></label>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="btn primary wide login-submit" disabled={submitting}>{submitting ? (mode === "login" ? "正在验证…" : "正在创建…") : (mode === "login" ? "安全登录" : "注册并进入平台")}<ArrowRight size={16} /></button>
        {mode === "login" ? <div className="role-explainer"><span><GraduationCap />学生<small>参加密码学实验</small></span><i /><span><ShieldCheck />管理员<small>平台和全局配置权限</small></span></div> : <div className="registration-note"><ShieldCheck size={15} /><span>管理员账号不能公开注册<small>如需管理员权限，请联系现有平台管理员。</small></span></div>}
      </form>
      <p className="login-help">{mode === "login" ? "还没有账号？点击上方“学生注册”创建账号。" : "已有账号？点击上方“登录”返回账号入口。"}</p>
    </section>
  </main>;
}
