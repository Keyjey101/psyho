export interface User {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  profile?: UserProfile | null;
}

export interface UserProfile {
  user_id: string;
  therapy_goals: string | null;
  preferred_style: string;
  crisis_plan: string | null;
  memory_enabled: boolean;
  long_term_memory: string | null;
  pop_score?: number;
  address_form: string;
  gender: string | null;
  updated_at: string;
}

export interface Session {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  summary: string | null;
  continuation_context?: string | null;
}

export interface SessionDetail extends Session {
  messages: Message[];
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  agents_used: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface WSTokenMessage {
  type: "token";
  content: string;
}

export interface WS_agents_used {
  type: "agents_used";
  agents: string[];
}

export interface WSDoneMessage {
  type: "done";
  message_id: string;
}

export interface WSErrorMessage {
  type: "error";
  message: string;
}

export interface WSContextCompressed {
  type: "context_compressed";
}

export type WSMessage =
  | WSTokenMessage
  | WS_agents_used
  | WSDoneMessage
  | WSErrorMessage
  | WSContextCompressed;

export interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
}

export const AGENTS: AgentInfo[] = [
  {
    id: "cbt",
    name: "КПТ",
    emoji: "🧠",
    color: "text-chalk-800",
    bgColor: "bg-chalk-50",
  },
  {
    id: "jungian",
    name: "Юнг",
    emoji: "🌙",
    color: "text-warm-800",
    bgColor: "bg-warm-50",
  },
  {
    id: "act",
    name: "ACT",
    emoji: "🧭",
    color: "text-primary-800",
    bgColor: "bg-primary-50",
  },
  {
    id: "ifs",
    name: "IFS",
    emoji: "🎭",
    color: "text-chalk-700",
    bgColor: "bg-chalk-50",
  },
  {
    id: "narrative",
    name: "Нарратив",
    emoji: "📖",
    color: "text-warm-700",
    bgColor: "bg-warm-50",
  },
  {
    id: "somatic",
    name: "Соматика",
    emoji: "🌿",
    color: "text-surface-700",
    bgColor: "bg-surface-50",
  },
  {
    id: "orchestrator",
    name: "Ника",
    emoji: "🌸",
    color: "text-[#B8785A]",
    bgColor: "bg-[#FAF6F1]",
  },
  {
    id: "crisis",
    name: "Кризисная поддержка",
    emoji: "🆘",
    color: "text-[#C4786A]",
    bgColor: "bg-[#FDF5F3]",
  },
];

export function getAgentInfo(agentId: string): AgentInfo {
  return AGENTS.find((a) => a.id === agentId) || AGENTS[AGENTS.length - 2];
}
