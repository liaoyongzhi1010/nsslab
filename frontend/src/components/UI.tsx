import type { ReactNode } from "react";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "mint" | "blue" | "amber" | "red" }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Metric({ label, value, suffix, tone = "mint" }: { label: string; value: ReactNode; suffix?: string; tone?: string }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {suffix && <small>{suffix}</small>}
    </div>
  );
}

export function Flow({ steps, active = steps.length - 1 }: { steps: string[]; active?: number }) {
  return (
    <div className="flow" aria-label="实验流程">
      {steps.map((step, index) => (
        <div className={`flow-item ${index <= active ? "is-active" : ""}`} key={step}>
          <span className="flow-index">{index < active ? <Check size={13} /> : index + 1}</span>
          <span>{step}</span>
          {index < steps.length - 1 && <i />}
        </div>
      ))}
    </div>
  );
}

export function LoadingBlock({ label = "实验正在运行…", detail = "任务已提交，完成后页面会自动展示结果。", phases = [] }: { label?: string; detail?: string; phases?: string[] }) {
  return (
    <div className="loading-block" role="status" aria-live="polite" aria-busy="true">
      <span className="loading-orbit"><LoaderCircle className="spin" size={23} /><i /></span>
      <span className="loading-copy"><strong>{label}</strong><small>{detail}</small></span>
      {phases.length > 0 && <span className="loading-phases" aria-label={`处理流程：${phases.join("、")}`}>{phases.map((phase, index) => <i key={phase} style={{ animationDelay: `${index * .28}s` }}><b />{phase}</i>)}</span>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state"><CircleAlert size={24} /><strong>{title}</strong><p>{children}</p></div>
  );
}

export function MiniBars({ values, color = "var(--mint)" }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return <div className="mini-bars">{values.map((value, index) => <i key={index} style={{ height: `${Math.max(10, (value / max) * 100)}%`, background: color }} />)}</div>;
}
