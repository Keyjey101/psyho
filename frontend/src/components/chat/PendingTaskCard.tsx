import { useState } from "react";
import { motion } from "framer-motion";
import { Check, SkipForward, MapPin } from "lucide-react";
import api from "@/api/client";

interface PendingTask {
  id: string;
  session_id: string;
  text: string;
  completed: boolean;
  created_at: string;
}

interface PendingTaskCardProps {
  tasks: PendingTask[];
  onDismiss: () => void;
}

export default function PendingTaskCard({ tasks, onDismiss }: PendingTaskCardProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<string | null>(null);

  const visibleTasks = tasks.filter((t) => !dismissed.has(t.id));
  if (visibleTasks.length === 0) return null;

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId);
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      setDismissed((prev) => new Set(prev).add(taskId));
      if (visibleTasks.length <= 1) {
        onDismiss();
      }
    } catch {
    } finally {
      setCompleting(null);
    }
  };

  const handleSkip = (taskId: string) => {
    setDismissed((prev) => new Set(prev).add(taskId));
    if (visibleTasks.length <= 1) {
      onDismiss();
    }
  };

  return (
    <>
      {visibleTasks.map((task) => (
        <motion.div
          key={task.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#E8DDD0] bg-white p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#B8785A]" />
            <span className="text-sm font-semibold text-[#B8785A]">Маяк с прошлой сессии</span>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-[#5A5048]">«{task.text}»</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleComplete(task.id)}
              disabled={completing === task.id}
              className="flex items-center gap-1.5 rounded-pill bg-[#B8785A] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#9E6349] disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {completing === task.id ? "..." : "Выполнено"}
            </button>
            <button
              onClick={() => handleSkip(task.id)}
              className="flex items-center gap-1.5 rounded-pill bg-[#F5EDE4] px-4 py-2 text-xs font-medium text-[#8A7A6A] transition-colors hover:bg-[#E8DDD0]"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Пропустить
            </button>
          </div>
        </motion.div>
      ))}
    </>
  );
}
