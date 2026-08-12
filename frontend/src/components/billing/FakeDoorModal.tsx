import { useEffect, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import api from "@/api/client";
import { getCampaignCode, track } from "@/lib/analytics";

interface Props {
  open: boolean;
  onClose: () => void;
  priceRub?: number;
  freeSessionsLeft?: number;
  paidSessionsLeft?: number;
}

const INCLUDED = [
  "Безлимитные сессии с Никой",
  "Память между разговорами",
  "Продолжение прошлых сессий",
  "Упражнения и задания без ограничений",
];

/**
 * Fake door: a real price screen that measures demand and takes no money.
 *
 * The honesty rules are the whole point (ТЗ §4.3):
 * - The price and what it includes are real — that's what makes the signal worth
 *   anything.
 * - Pressing "Оплатить" does NOT simulate a payment. It reveals a plain-language
 *   note that billing isn't live yet and asks for a contact instead.
 * - No card fields, no fake spinner, no imitation of a checkout.
 *
 * Never rendered when the session tripped the crisis detector — the caller
 * gates on that; see `Chat.tsx`.
 */
export default function FakeDoorModal({
  open,
  onClose,
  priceRub = 390,
  freeSessionsLeft,
  paidSessionsLeft,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setRevealed(false);
      setSubmitted(false);
      setContact("");
      setError("");
      track("paywall_viewed", { price_rub: priceRub, plan: "pro_month" });
    }
  }, [open, priceRub]);

  if (!open) return null;

  const handlePayClick = () => {
    track("paywall_clicked", { price_rub: priceRub, plan: "pro_month" });
    setRevealed(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = contact.trim();
    if (value.length < 3) {
      setError("Оставь email или ник в Telegram");
      return;
    }
    const contactType = value.startsWith("@") || !value.includes("@") ? "telegram" : "email";
    setSending(true);
    setError("");
    try {
      await api.post("/waitlist", {
        contact: value,
        contact_type: contactType,
        campaign_code: getCampaignCode(),
      });
      setSubmitted(true);
    } catch {
      setError("Не получилось отправить. Попробуй ещё раз.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 shadow-xl dark:bg-[#3A302A]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-serif text-[22px] font-bold text-[#4A4038] dark:text-[#E8DDD0]">
            {submitted ? "Спасибо — записал" : "Бесплатные сессии закончились"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[#8A7A6A] hover:bg-[#FAF6F1] dark:hover:bg-[#4A4038]"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <p className="text-[14px] leading-relaxed text-[#5A5048] dark:text-[#C8B8A8]">
              Напишу, как только оплата заработает — и дам бесплатный период на старте.
              Деньги сейчас не списаны и карту мы не спрашивали.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-[16px] bg-[#B8785A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#9E6349]"
            >
              Понятно
            </button>
          </div>
        ) : revealed ? (
          <div className="space-y-4">
            {/* Honest reveal — no imitation of a payment flow. */}
            <p className="text-[14px] leading-relaxed text-[#5A5048] dark:text-[#C8B8A8]">
              Скажу честно: оплату мы ещё не запустили — это случится в ближайшее время.
              Оставь контакт, и я напишу, как только всё заработает. Тем, кто оставит
              контакт сейчас, дам бесплатный период на старте.
            </p>
            <form onSubmit={handleSubmit} className="space-y-2">
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="email или @ник в Telegram"
                autoFocus
                className="w-full rounded-[16px] border border-[#E8DDD0] bg-[#FAF6F1] px-4 py-3 text-[14px] text-[#4A4038] outline-none focus:border-[#B8785A] dark:border-[#4A4038] dark:bg-[#2A2420] dark:text-[#E8DDD0]"
              />
              {error && <p className="text-[12px] text-[#C2554A]">{error}</p>}
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-[16px] bg-[#B8785A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#9E6349] disabled:opacity-50"
              >
                {sending ? "Отправляю..." : "Сообщить мне о запуске"}
              </button>
            </form>
            <p className="text-center text-[11.5px] leading-relaxed text-[#B8A898] dark:text-[#8A7A6A]">
              Мы не просим данные карты и ничего не списываем.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[14px] leading-relaxed text-[#5A5048] dark:text-[#C8B8A8]">
              Чтобы продолжать разговоры без ограничений — вот что входит в подписку.
              {(freeSessionsLeft !== undefined || paidSessionsLeft !== undefined) && (
                <span className="mt-2 block text-[12px] text-[#8A7A6A]">
                  Свободных сессий: {freeSessionsLeft ?? 0} · Оплаченных: {paidSessionsLeft ?? 0}
                </span>
              )}
            </p>

            <div className="rounded-[16px] border border-[#E8DDD0] bg-[#FAF6F1] p-4 dark:border-[#4A4038] dark:bg-[#2A2420]">
              <div className="mb-3 flex items-baseline gap-2">
                <Sparkles className="h-4 w-4 text-[#B8785A]" />
                <span className="font-serif text-[24px] font-bold text-[#4A4038] dark:text-[#E8DDD0]">
                  {priceRub} ₽
                </span>
                <span className="text-[13px] text-[#8A7A6A]">в месяц</span>
              </div>
              <ul className="space-y-1.5">
                {INCLUDED.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-[13px] text-[#5A5048] dark:text-[#C8B8A8]"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B8785A]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={handlePayClick}
              className="w-full rounded-[16px] bg-gradient-to-r from-[#B8785A] to-[#9E6349] px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
            >
              Оплатить {priceRub} ₽
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-[16px] px-4 py-2 text-[13px] text-[#8A7A6A] hover:text-[#5A5048]"
            >
              Может позже
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
