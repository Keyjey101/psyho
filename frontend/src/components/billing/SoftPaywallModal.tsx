import { useNavigate } from "react-router-dom";
import { X, Sparkles, Package } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  reason?: string;
  freeSessionsLeft?: number;
  paidSessionsLeft?: number;
}

export default function SoftPaywallModal({
  open,
  onClose,
  reason,
  freeSessionsLeft,
  paidSessionsLeft,
}: Props) {
  const navigate = useNavigate();
  if (!open) return null;

  const isAction = reason === "daily_action_limit";
  const isProFeature = reason === "pro_feature";
  const title = isAction ? "Сегодня достаточно" : isProFeature ? "Функция Pro" : "Время продолжить";
  const subtitle = isAction
    ? "Бесплатно — одно действие в день. Открой Pro, чтобы пользоваться без лимитов, или возвращайся завтра."
    : isProFeature
    ? "Продолжение сессии доступно с подпиской Pro. Выбери удобный вариант ниже."
    : "Ты прошёл бесплатные сессии. Чтобы продолжить — выбери удобный вариант ниже.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-xl dark:bg-[#3A302A]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-serif text-[22px] font-bold text-[#4A4038] dark:text-[#E8DDD0]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[#8A7A6A] hover:bg-[#FAF6F1] dark:hover:bg-[#4A4038]"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-5 text-[14px] leading-relaxed text-[#5A5048] dark:text-[#C8B8A8]">
          {subtitle}
          {(freeSessionsLeft !== undefined || paidSessionsLeft !== undefined) && (
            <span className="mt-2 block text-[12px] text-[#8A7A6A]">
              Свободных сессий: {freeSessionsLeft ?? 0} ·
              Оплаченных: {paidSessionsLeft ?? 0}
            </span>
          )}
        </p>

        <div className="space-y-2">
          <button
            onClick={() => navigate("/pricing")}
            className="flex w-full items-center justify-between rounded-[16px] bg-gradient-to-r from-[#B8785A] to-[#9E6349] px-4 py-3 text-left text-white hover:opacity-95"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>
                <span className="block font-semibold">Pro — 390 ₽/мес</span>
                <span className="block text-[12px] opacity-90">
                  Безлимит сессий, память, продолжения
                </span>
              </span>
            </span>
            <span aria-hidden>→</span>
          </button>

          {!isAction && (
            <button
              onClick={() => navigate("/pricing#packs")}
              className="flex w-full items-center justify-between rounded-[16px] border border-[#E8DDD0] bg-[#FAF6F1] px-4 py-3 text-left text-[#5A5048] hover:bg-[#F5EDE4] dark:border-[#4A4038] dark:bg-[#2A2420] dark:text-[#E8DDD0]"
            >
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[#B8785A]" />
                <span>
                  <span className="block font-semibold">Пакет 5 сессий — 290 ₽</span>
                  <span className="block text-[12px] text-[#8A7A6A]">
                    Без подписки, 6 месяцев
                  </span>
                </span>
              </span>
              <span aria-hidden>→</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full rounded-[16px] px-4 py-2 text-[13px] text-[#8A7A6A] hover:text-[#5A5048]"
          >
            Может позже
          </button>
        </div>
      </div>
    </div>
  );
}
