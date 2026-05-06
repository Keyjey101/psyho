import { useState } from "react";
import { Bell, ExternalLink } from "lucide-react";
import { useStartNotifyLink } from "@/hooks/useSubscription";

interface Props {
  variant?: "card" | "compact";
  message?: string;
  className?: string;
}

export default function TelegramLinkBanner({
  variant = "card",
  message,
  className = "",
}: Props) {
  const startLink = useStartNotifyLink();
  const [opened, setOpened] = useState(false);

  const handleConnect = async () => {
    try {
      const data = await startLink.mutateAsync();
      window.open(data.bot_url, "_blank", "noopener,noreferrer");
      setOpened(true);
    } catch {
      // Server-side error already logged; nothing useful to surface here
    }
  };

  const text =
    message ??
    "Привяжи Telegram, чтобы Ника напомнила о продлении и списании, а не сюрпризы.";

  if (variant === "compact") {
    return (
      <button
        onClick={handleConnect}
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#FAF6F1] px-3 py-1 text-[12px] font-medium text-[#8A7A6A] hover:bg-[#F5EDE4] hover:text-[#5A5048] dark:bg-[#3A302A] dark:text-[#B8A898] dark:hover:bg-[#4A4038] ${className}`}
      >
        <Bell className="h-3.5 w-3.5" />
        {opened ? "Открой бота и нажми Start" : "Подключить уведомления"}
      </button>
    );
  }

  return (
    <div
      className={`rounded-[16px] border border-[#E8DDD0] bg-[#FAF6F1] p-4 dark:border-[#3A302A] dark:bg-[#3A302A] ${className}`}
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#B8785A]" />
        <div className="flex-1">
          <p className="text-[14px] text-[#4A4038] dark:text-[#E8DDD0]">{text}</p>
          {opened ? (
            <p className="mt-2 text-[12px] text-[#8A7A6A] dark:text-[#B8A898]">
              Открой бота и нажми <span className="font-semibold">Start</span> — после
              этого вернись сюда. Уведомления подключатся автоматически.
            </p>
          ) : (
            <button
              onClick={handleConnect}
              disabled={startLink.isPending}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#B8785A] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#9E6349] disabled:opacity-60"
            >
              Открыть бота
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
