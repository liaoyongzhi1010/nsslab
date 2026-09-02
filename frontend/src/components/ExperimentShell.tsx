import type { ReactNode } from "react";
import { GitCompareArrows, LoaderCircle } from "lucide-react";
import { EmptyState, Flow, Pill } from "./UI";

interface ExperimentShellProps {
  tag: string;
  mode?: string;
  title: ReactNode;
  intro: string;
  badges?: ReactNode;
  flowSteps: string[];
  flowActive: number;
  children?: ReactNode;
}

export function ExperimentHeader({ tag, title, intro, badges, flowSteps, flowActive }: ExperimentShellProps) {
  return <>
    <div className="page-title">
      <div>
        <Pill tone="blue">{tag}</Pill>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      {badges && <div className="page-title-badges">{badges}</div>}
    </div>
    <Flow steps={flowSteps} active={flowActive} />
  </>;
}

interface RunBarProps {
  running: boolean;
  onRun: () => void;
  label?: string;
  runningLabel?: string;
  children?: ReactNode;
}

export function RunBar({ running, onRun, label = "运行 A/B 对比", runningLabel = "正在运行双路对比…", children }: RunBarProps) {
  return <div className="tool-task-panel panel">
    {children}
    <button className={`btn primary ${running ? "is-running" : ""}`} onClick={onRun} disabled={running} aria-busy={running}>
      {running ? <><LoaderCircle className="spin" size={17} />{runningLabel}</> : <>{label}<GitCompareArrows size={17} /></>}
    </button>
  </div>;
}

interface ComparePanelProps {
  offLabel: string;
  onLabel: string;
  offTone?: "neutral" | "red" | "amber";
  offHead: ReactNode;
  onHead: ReactNode;
  offBody: ReactNode;
  onBody: ReactNode;
}

export function ComparePanel({ offLabel, onLabel, offTone = "neutral", offHead, onHead, offBody, onBody }: ComparePanelProps) {
  return <div className="compare-grid">
    <article className="answer-card base-answer">
      <div className="answer-head"><div className="path-badge">OFF</div><div><span>没有该能力</span><h2>{offLabel}</h2></div><Pill tone={offTone}>BASELINE</Pill></div>
      <div className="answer-provenance">{offHead}</div>
      <div className="answer-body">{offBody}</div>
    </article>
    <article className="answer-card rag-answer">
      <div className="answer-head"><div className="path-badge">ON</div><div><span>启用该能力</span><h2>{onLabel}</h2></div><Pill tone="mint">ENHANCED</Pill></div>
      <div className="answer-provenance">{onHead}</div>
      <div className="answer-body">{onBody}</div>
    </article>
  </div>;
}

export function WaitState({ children }: { children: ReactNode }) {
  return <EmptyState title="等待运行">{children}</EmptyState>;
}
