import { Sparkles } from "lucide-react";

interface Props {
  className?: string;
  compact?: boolean;
}

export default function ProBadge({ className = "", compact = false }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#B8785A] to-[#9E6349] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ${className}`}
      title="Pro-подписка активна"
    >
      <Sparkles className="h-3 w-3" />
      {compact ? "Pro" : "Ника Pro"}
    </span>
  );
}
