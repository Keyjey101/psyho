interface SessionProgressProps {
  current: number;
  max: number;
}

export default function SessionProgress({ current, max }: SessionProgressProps) {
  if (max <= 0 || current <= 0) return null;

  const pct = Math.min(current / max, 1);
  const remaining = max - current;
  const isWarning = remaining <= 3 && remaining > 0;
  const isDone = remaining <= 0;

  if (isDone) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1 bg-[#FAF6F1]">
      <div className="flex-1 h-[3px] rounded-full bg-[#E8DDD0] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${isWarning ? "bg-[#B8785A]" : "bg-[#B8A898]"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className={`text-[11px] tabular-nums whitespace-nowrap ${isWarning ? "text-[#B8785A] font-medium" : "text-[#B8A898]"}`}>
        {current} / {max}
      </span>
    </div>
  );
}
