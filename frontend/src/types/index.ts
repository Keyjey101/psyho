export interface User {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  summary: string | null;
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

export type WSMessage =
  | WSTokenMessage
  | WS_agents_used
  | WSDoneMessage
  | WSErrorMessage;

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
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    id: "jungian",
    name: "Юнгианский",
    emoji: "🌙",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    id: "act",
    name: "ACT",
    emoji: "🧭",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    id: "ifs",
    name: "IFS",
    emoji: "🎭",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    id: "narrative",
    name: "Нарративный",
    emoji: "📖",
    color: "text-rose-600",
    bgColor: "bg-rose-50",
  },
  {
    id: "somatic",
    name: "Соматический",
    emoji: "🌿",
    color: "text-teal-600",
    bgColor: "bg-teal-50",
  },
  {
    id: "orchestrator",
    name: "Терапевт",
    emoji: "💚",
    color: "text-primary-600",
    bgColor: "bg-primary-50",
  },
  {
    id: "crisis",
    name: "Кризисная поддержка",
    emoji: "🆘",
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
];

export function getAgentInfo(agentId: string): AgentInfo {
  return AGENTS.find((a) => a.id === agentId) || AGENTS[AGENTS.length - 2];
}
