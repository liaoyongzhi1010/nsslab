import { ExperimentHeader } from "../components/ExperimentShell";

export function SftLab() {
  return <div className="lab-page tool-page">
    <ExperimentHeader
      tag="实验 03 · 模型训练与对齐"
      title={<>监督微调 <span>SFT</span></>}
      intro="预训练只让模型“会续写”，监督微调用大量指令-回答对教会模型“听懂并遵循指令”。同一条指令，对比未对齐模型与 SFT 对齐模型的回答。"
      flowSteps={["用户指令", "未对齐模型", "SFT 对齐模型", "对比遵循度"]}
      flowActive={0}
    />
  </div>;
}
