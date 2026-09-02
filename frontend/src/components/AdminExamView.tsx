import { useMemo, type ReactNode } from "react";
import { Target } from "lucide-react";
import { RubricPanel } from "./RubricPanel";
import { Pill } from "./UI";
import { useApp } from "../context/AppContext";
import type { Dict } from "../types";

export function AdminExamView({ expId, tag, title, intro }: { expId: string; tag: string; title: ReactNode; intro: string }) {
  const { bootstrap } = useApp();

  const objectives = useMemo(() => {
    const wanted = Number(expId);
    for (const cat of (bootstrap?.experiment_categories || []) as Dict[]) {
      for (const e of (cat.experiments || []) as Dict[]) {
        if (Number(e.index) === wanted) return (e.objectives || []) as string[];
      }
    }
    return [] as string[];
  }, [bootstrap, expId]);

  return <div className="lab-page">
    <div className="page-title">
      <div>
        <Pill tone="blue">{tag}</Pill>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      <div className="page-title-badges"><Pill tone="amber">管理员 · 评分配置</Pill></div>
    </div>

    {objectives.length > 0 && <section className="panel objectives-panel">
      <div className="objectives-head"><Target size={18} /><div><h2>本次实验要点</h2><p>这些是本实验希望学生掌握的核心点，学生将围绕它们撰写实验报告；老师也据此评分。</p></div></div>
      <ol className="objectives-list">
        {objectives.map((item, index) => <li key={index}><span>{index + 1}</span><p>{item}</p></li>)}
      </ol>
    </section>}

    <RubricPanel expId={expId} defaultOpen />
  </div>;
}
