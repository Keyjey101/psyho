import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { Message } from "@/types";
import { getAgentInfo } from "@/types";
import AgentBadge from "./AgentBadge";

interface SessionEndCardProps {
  exchangeCount: number;
  messages: Message[];
  onContinue: () => void;
  onFinish: (moodValue: number | null, exerciseCompleted?: boolean | null) => void;
  isContinuing: boolean;
  completedSessions?: number;
  pendingTaskId?: string | null;
  pendingTaskText?: string | null;
  onCompleteTask?: (taskId: string) => void;
}

const MOOD_EMOJIS = [
  { emoji: "😊", icon: "/illustrations/icons/icon_face_happy.webp", value: 5, label: "Хорошо" },
  { emoji: "😐", icon: "/illustrations/icons/icon_face_neutral.webp", value: 3, label: "Нормально" },
  { emoji: "😔", icon: "/illustrations/icons/icon_face_worried.webp", value: 2, label: "Грустно" },
];

export default function SessionEndCard({
  exchangeCount,
  messages,
  onContinue,
  onFinish,
  isContinuing,
  completedSessions,
  pendingTaskId,
  pendingTaskText,
  onCompleteTask,
}: SessionEndCardProps) {
  const [moodValue, setMoodValue] = useState<number | null>(null);
  const [exerciseCompleted, setExerciseCompleted] = useState<boolean | null>(null);
  const navigate = useNavigate();

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

  const sessionsUntilPortrait = Math.max(0, 3 - (completedSessions ?? 0));
  const portraitUnlocked = (completedSessions ?? 0) >= 3;

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
          <img src="/illustrations/icons/icon_speech.webp" alt="" className="h-4 w-4 object-contain" /> {exchangeCount} обменов
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

      {/* Pending exercise from previous session */}
      {pendingTaskId && pendingTaskText && (
        <div className="mt-4 rounded-xl border border-[#E8DDD0] bg-[#FAF6F1] p-4">
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[#B8A898]">
            Упражнение из прошлой сессии
          </p>
          <p className="mb-3 text-[13px] leading-[1.5] text-[#5A5048]">
            {pendingTaskText.length > 100 ? pendingTaskText.slice(0, 100) + "…" : pendingTaskText}
          </p>
          <p className="mb-2 text-[12px] text-[#8A7A6A]">Ты выполнил(а) его?</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setExerciseCompleted(true);
                onCompleteTask?.(pendingTaskId);
              }}
              className={`flex-1 rounded-lg py-1.5 text-[13px] font-medium transition-all ${
                exerciseCompleted === true
                  ? "bg-emerald-500 text-white"
                  : "border border-[#E8DDD0] text-[#5A5048] hover:bg-[#F5EDE4]"
              }`}
            >
              ✅ Да
            </button>
            <button
              onClick={() => setExerciseCompleted(false)}
              className={`flex-1 rounded-lg py-1.5 text-[13px] font-medium transition-all ${
                exerciseCompleted === false
                  ? "bg-red-100 text-red-600 border border-red-200"
                  : "border border-[#E8DDD0] text-[#5A5048] hover:bg-[#F5EDE4]"
              }`}
            >
              ❌ Нет
            </button>
          </div>
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
              <span className="text-2xl">
                {m.icon ? (
                  <img src={m.icon} alt={m.label} className="h-6 w-6 object-contain" />
                ) : (
                  m.emoji
                )}
              </span>
              <span className="text-[11px] text-[#8A7A6A]">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Psycho-portrait hint */}
      <div className="mt-4 rounded-xl bg-[#FAF6F1] px-4 py-3 text-center">
        {portraitUnlocked ? (
          <button
            onClick={() => navigate("/personality")}
            className="text-[13px] text-[#B8785A] hover:underline"
          >
            🧠 Посмотри, изменился ли твой психопортрет →
          </button>
        ) : (
          <p className="text-[12px] text-[#B8A898]">
            🧠 Ещё{" "}
            <span className="font-semibold text-[#8A7A6A]">
              {sessionsUntilPortrait} {sessionsUntilPortrait === 1 ? "сессия" : "сессии"}
            </span>{" "}
            до твоего психопортрета
          </p>
        )}
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={() => onFinish(moodValue, exerciseCompleted)}
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
