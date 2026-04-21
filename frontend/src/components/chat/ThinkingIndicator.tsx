import { motion } from "framer-motion";
import { getAgentInfo } from "@/types";
import { Bot } from "lucide-react";

interface ThinkingIndicatorProps {
  agents: string[];
}

export default function ThinkingIndicator({ agents }: ThinkingIndicatorProps) {
  if (agents.length === 0) {
    return (
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100">
          <div className="flex gap-1">
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400" style={{ animationDelay: "0ms" }} />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400" style={{ animationDelay: "150ms" }} />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary-400" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
        <div className="rounded-2xl rounded-tl-md bg-surface-100 px-4 py-3 text-sm text-surface-500">
          Думаю...
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100">
        <Bot className="h-4 w-4 text-primary-600" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-2xl rounded-tl-md bg-surface-100 px-4 py-3 text-sm text-surface-500">
          Подключаю специалистов...
        </div>
        <div className="flex flex-wrap gap-1.5">
          {agents.map((agentId) => {
            const info = getAgentInfo(agentId);
            return (
              <motion.span
                key={agentId}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${info.bgColor} ${info.color}`}
              >
                <span>{info.emoji}</span>
                {info.name}
                <div className="ml-1 flex gap-0.5">
                  <div className="h-1 w-1 animate-pulse rounded-full bg-current" style={{ animationDelay: "0ms" }} />
                  <div className="h-1 w-1 animate-pulse rounded-full bg-current" style={{ animationDelay: "200ms" }} />
                  <div className="h-1 w-1 animate-pulse rounded-full bg-current" style={{ animationDelay: "400ms" }} />
                </div>
              </motion.span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
