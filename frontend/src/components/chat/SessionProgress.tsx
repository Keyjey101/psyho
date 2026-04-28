interface SessionProgressProps {
  current: number;
  max: number;
  isSessionCompleted?: boolean;
}

export default function SessionProgress({ current, max, isSessionCompleted }: SessionProgressProps) {
  if (max <= 0) return null;

  if (isSessionCompleted) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-[#FAF6F1] dark:bg-[#2A2420] border-b border-[#E8DDD0] dark:border-[#4A4038]">
        <span className="text-[12px] font-medium text-[#B8785A] dark:text-[#C08B68]">Сессия завершена</span>
      </div>
    );
  }

  if (current <= 0) return null;

  const pct = Math.min(current / max, 1);
  const remaining = max - current;
  const isWarning = remaining <= 3 && remaining > 0;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-[#FAF6F1] dark:bg-[#2A2420] border-b border-[#E8DDD0] dark:border-[#4A4038]">
      <div className="flex-1 h-[5px] rounded-full bg-[#E8DDD0] dark:bg-[#4A4038] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${isWarning ? "bg-[#B8785A] dark:bg-[#C08B68]" : "bg-[#B8A898] dark:bg-[#6A5A4A]"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className={`text-[11px] tabular-nums whitespace-nowrap font-medium ${isWarning ? "text-[#B8785A] dark:text-[#C08B68]" : "text-[#B8A898] dark:text-[#8A7A6A]"}`}>
        {current} / {max}
      </span>
    </div>
  );
}
