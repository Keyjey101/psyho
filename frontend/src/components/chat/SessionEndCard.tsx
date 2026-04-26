import { useState } from "react";
import { motion } from "framer-motion";
import type { Message } from "@/types";
import { getAgentInfo } from "@/types";
import AgentBadge from "./AgentBadge";

interface SessionEndCardProps {
  exchangeCount: number;
  messages: Message[];
  onContinue: () => void;
  onFinish: (moodValue: number | null) => void;
  isContinuing: boolean;
}

const MOOD_EMOJIS = [
  { emoji: "😊", value: 5, label: "Хорошо" },
  { emoji: "😐", value: 3, label: "Нормально" },
  { emoji: "😔", value: 2, label: "Грустно" },
];

export default function SessionEndCard({
  exchangeCount,
  messages,
  onContinue,
  onFinish,
  isContinuing,
}: SessionEndCardProps) {
  const [moodValue, setMoodValue] = useState<number | null>(null);

  const usedAgents = new Set<string>();
  messages.forEach((m) => {
    if (m.agents_used) {
      try {
        const parsed = JSON.parse(m.agents_used);
        parsed.forEach((a: string) => usedAgents.add(a));
      } catch {}
    }
  });
  const agentList = Array.from(usedAgents).filter((a) => a !== "orchestrator" && a !== "crisis");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="mx-auto my-6 max-w-md rounded-2xl border border-[#E8DDD0] bg-white p-6 shadow-[0_2px_12px_rgba(90,80,72,0.08)]"
    >
      <h3 className="mb-1 text-center text-[17px] font-semibold text-[#5A5048]">
        Сессия завершена
      </h3>

      <div className="mt-4 flex items-center justify-center gap-4 text-sm text-[#8A7A6A]">
        <span className="flex items-center gap-1.5">
          💬 {exchangeCount} обменов
        </span>
      </div>

      {agentList.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {agentList.map((id) => {
            const info = getAgentInfo(id);
            return <AgentBadge key={id} agent={info} />;
          })}
        </div>
      )}

      <div className="mt-5 border-t border-[#F5EDE4] pt-4">
        <p className="mb-3 text-center text-sm text-[#8A7A6A]">Как ты сейчас?</p>
        <div className="flex justify-center gap-4">
          {MOOD_EMOJIS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMoodValue(m.value)}
              className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all ${
                moodValue === m.value
                  ? "bg-[#FAF0E8] ring-2 ring-[#B8785A]"
                  : "hover:bg-[#FAF6F1]"
              }`}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[11px] text-[#8A7A6A]">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={() => onFinish(moodValue)}
          className="flex-1 rounded-full border border-[#D8CDC0] px-4 py-2.5 text-sm font-medium text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1]"
        >
          Завершить
        </button>
        <button
          onClick={onContinue}
          disabled={isContinuing}
          className="flex-1 rounded-full bg-[#B8785A] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#9E6349] disabled:opacity-50"
        >
          Продолжить
        </button>
      </div>
    </motion.div>
  );
}
