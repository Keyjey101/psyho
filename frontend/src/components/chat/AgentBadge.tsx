import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentInfo } from "@/types";

interface AgentBadgeProps {
  agent: AgentInfo;
}

export default function AgentBadge({ agent }: AgentBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onTouchStart={() => setShowTooltip((p) => !p)}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${agent.bgColor} ${agent.color}`}
      >
        <span>{agent.emoji}</span>
        {agent.name}
      </span>
      <AnimatePresence>
        {showTooltip && agent.tooltip && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#5A5048] px-2.5 py-1.5 text-[11px] leading-tight text-white shadow-lg"
          >
            {agent.tooltip}
            <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#5A5048]" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
