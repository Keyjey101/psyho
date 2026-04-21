import type { AgentInfo } from "@/types";

interface AgentBadgeProps {
  agent: AgentInfo;
}

export default function AgentBadge({ agent }: AgentBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${agent.bgColor} ${agent.color}`}
    >
      <span>{agent.emoji}</span>
      {agent.name}
    </span>
  );
}
