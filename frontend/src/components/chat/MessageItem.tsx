import ReactMarkdown from "react-markdown";
import type { Message } from "@/types";
import { getAgentInfo } from "@/types";
import AgentBadge from "./AgentBadge";
import { User, Bot } from "lucide-react";

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
}

export default function MessageItem({ message, isStreaming }: MessageItemProps) {
  const isUser = message.role === "user";
  const agents: string[] = message.agents_used
    ? (() => {
        try {
          return JSON.parse(message.agents_used);
        } catch {
          return [];
        }
      })()
    : [];

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary-600 px-5 py-3 text-white shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100">
        <Bot className="h-4 w-4 text-primary-600" />
      </div>
      <div className="max-w-[85%] min-w-0">
        <div className="rounded-2xl rounded-tl-md bg-white px-5 py-3 shadow-sm ring-1 ring-surface-100">
          <div className="markdown-content text-sm leading-relaxed text-surface-800">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
          {isStreaming && (
            <span className="inline-block h-4 w-0.5 animate-pulse bg-primary-500" />
          )}
        </div>
        {agents.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {agents.map((agentId) => {
              const info = getAgentInfo(agentId);
              return <AgentBadge key={agentId} agent={info} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
