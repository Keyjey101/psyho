import { motion } from "framer-motion";
import { getAgentInfo } from "@/types";

interface ThinkingIndicatorProps {
  agents: string[];
}

export default function ThinkingIndicator({ agents }: ThinkingIndicatorProps) {
  if (agents.length === 0) {
    return (
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full">
          <img src="/illustrations/opt/ai_avatar.webp" alt="Ника" className="h-full w-full object-cover" />
        </div>
        <div className="flex items-center gap-1.5 rounded-[18px] rounded-bl-[4px] border border-[#D8CDC0] bg-white px-4 py-3">
          {[0, 160, 320].map((delay) => (
            <div
              key={delay}
              className="h-2 w-2 rounded-full bg-[#C4A882]"
              style={{
                animation: "dotPulse 1200ms ease-in-out infinite",
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#B8785A] text-sm font-semibold text-white">
        Н
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-[18px] rounded-bl-[4px] border border-[#D8CDC0] bg-white px-4 py-3 text-sm text-[#8A7A6A]">
          Подключаю подходы...
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
                  {[0, 200, 400].map((delay) => (
                    <div
                      key={delay}
                      className="h-1 w-1 animate-pulse rounded-full bg-current"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </motion.span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
