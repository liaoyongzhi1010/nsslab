export type Dict = Record<string, any>;

export interface AuthUser {
  id: string;
  username: string;
  display_name: string;
  role: "student" | "admin";
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  category: string;
  level: string;
  accent: string;
  chars: number;
  source?: "preset" | "upload";
  file_kind?: "markdown" | "text" | "pdf" | "code";
  size_bytes?: number;
  language?: string;
  source_type?: string;
  source_title?: string;
  source_date?: string;
  source_url?: string;
  scenario_notice?: string;
}

export interface BootstrapData {
  documents: DocumentItem[];
  rag_benchmarks: Dict[];
  tool_tasks: Dict[];
  experiment_categories: Dict[];
  sft_tasks: Dict[];
  multi_agent_tasks: Dict[];
  skill_tasks: Dict[];
  agent_loop_tasks: Dict[];
  skills: Dict[];
  tools: Dict[];
  providers: Dict;
}

export interface ProjectStatus {
  id: string;
  name: string;
  current_stage: number;
  created_at: string;
  ended_at: string | null;
  last_activity_at: string;
  is_ended: boolean;
  stats: {
    base_model: boolean;
    knowledge_base: boolean;
    documents: number;
    chunks: number;
    rag: boolean;
    skills: number;
    tools: number;
    agent: boolean;
    runs: number;
  };
}
