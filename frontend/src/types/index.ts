export interface User {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  profile?: UserProfile | null;
  telegram_username?: string | null;
  has_real_email?: boolean;
  is_admin?: boolean;
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
  max_exchanges?: number;
}

export interface SessionDetail extends Session {
  messages: Message[];
  exchange_count?: number;
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
  exchange_count?: number;
  max_exchanges?: number;
}

export interface WSErrorMessage {
  type: "error";
  message: string;
}

export interface WSContextCompressed {
  type: "context_compressed";
}

export interface WSSessionLimitReached {
  type: "session_limit_reached";
}

export type WSMessage =
  | WSTokenMessage
  | WS_agents_used
  | WSDoneMessage
  | WSErrorMessage
  | WSContextCompressed
  | WSSessionLimitReached;

export interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  icon?: string;
  color: string;
  bgColor: string;
  tooltip: string;
}

export const AGENTS: AgentInfo[] = [
  {
    id: "cbt",
    name: "КПТ",
    emoji: "🧠",
    icon: "/illustrations/opt/method_cbt.webp",
    color: "text-[#5B3E8A]",
    bgColor: "bg-[#EDE5F7]",
    tooltip: "мысли и паттерны",
  },
  {
    id: "jungian",
    name: "Юнг",
    emoji: "🌙",
    icon: "/illustrations/opt/method_jung.webp",
    color: "text-[#7A4A2E]",
    bgColor: "bg-[#F5EDE4]",
    tooltip: "глубинные образы и символы",
  },
  {
    id: "act",
    name: "ACT",
    emoji: "🧭",
    icon: "/illustrations/opt/method_act.webp",
    color: "text-[#6B4220]",
    bgColor: "bg-[#FDF0E6]",
    tooltip: "принятие и ценности",
  },
  {
    id: "ifs",
    name: "IFS",
    emoji: "🎭",
    icon: "/illustrations/opt/method_ifs.webp",
    color: "text-[#5B3E8A]",
    bgColor: "bg-[#EDE5F7]",
    tooltip: "внутренние части личности",
  },
  {
    id: "narrative",
    name: "Нарратив",
    emoji: "📖",
    icon: "/illustrations/opt/method_narrative.webp",
    color: "text-[#5A3825]",
    bgColor: "bg-[#F5EDE4]",
    tooltip: "истории и смыслы",
  },
  {
    id: "somatic",
    name: "Соматика",
    emoji: "🌿",
    icon: "/illustrations/opt/method_somatic.webp",
    color: "text-[#2D5A3D]",
    bgColor: "bg-[#E6F0E9]",
    tooltip: "тело и нервная система",
  },
  {
    id: "orchestrator",
    name: "Ника",
    emoji: "🌸",
    icon: "/illustrations/opt/ai_avatar.webp",
    color: "text-[#B8785A]",
    bgColor: "bg-[#FAF6F1]",
    tooltip: "",
  },
  {
    id: "crisis",
    name: "Кризисная поддержка",
    emoji: "🆘",
    color: "text-[#A03030]",
    bgColor: "bg-[#FDE8E8]",
    tooltip: "экстренная помощь",
  },
];

export function getAgentInfo(agentId: string): AgentInfo {
  return AGENTS.find((a) => a.id === agentId) || AGENTS[AGENTS.length - 2];
}
