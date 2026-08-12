import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot, ShieldCheck } from "lucide-react";
import api from "@/api/client";

interface Props {
  open: boolean;
  onAccepted: () => void;
}

/**
 * Shown once, before the first dialog turn (ТЗ §6).
 *
 * Covers two obligations in one screen because they are both about the same
 * thing — the person knowing what they are entering:
 *
 * 1. **AI disclosure at first contact.** The top of the card states plainly
 *    that the other side is a program, not a specialist. Not a footnote.
 * 2. **152-ФЗ consent** to personal-data processing, taken *before* the
 *    conversation starts rather than buried in a signup checkbox, with links to
 *    the policy and the consent text.
 *
 * Acceptance is recorded server-side (`POST /user/me/consent`) so there is an
 * actual timestamped record rather than a localStorage flag.
 */
export default function ConsentGate({ open, onAccepted }: Props) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const accept = async () => {
    setSending(true);
    setError("");
    try {
      await api.post("/user/me/consent");
      onAccepted();
    } catch {
      setError("Не получилось сохранить согласие. Попробуй ещё раз.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 shadow-xl dark:bg-[#3A302A]">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FAF0E8] dark:bg-[#4A4038]">
            <Bot className="h-5 w-5 text-[#B8785A]" />
          </span>
          <h2 className="font-serif text-[21px] font-bold leading-tight text-[#4A4038] dark:text-[#E8DDD0]">
            Ты общаешься с ИИ
          </h2>
        </div>

        <p className="mb-4 text-[14px] leading-relaxed text-[#5A5048] dark:text-[#C8B8A8]">
          Ника — это программа на основе искусственного интеллекта, а не живой
          специалист. Она помогает разобраться в себе и посмотреть на ситуацию
          со стороны. Это поддержка и самоанализ — не медицинская помощь.
        </p>

        <div className="mb-4 rounded-2xl border border-[#E8DDD0] bg-[#FAF6F1] p-4 dark:border-[#4A4038] dark:bg-[#2A2420]">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#B8785A]" />
            <span className="text-[13px] font-semibold text-[#4A4038] dark:text-[#E8DDD0]">
              Что происходит с твоими данными
            </span>
          </div>
          <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-[#5A5048] dark:text-[#C8B8A8]">
            <li>· Переписка хранится, чтобы Ника помнила контекст разговора.</li>
            <li>· Тексты сообщений не попадают в аналитику и не передаются рекламодателям.</li>
            <li>· Историю можно удалить в любой момент в профиле.</li>
          </ul>
        </div>

        <p className="mb-5 text-[12px] leading-relaxed text-[#8A7A6A] dark:text-[#B8A898]">
          Нажимая «Начать разговор», ты соглашаешься на обработку персональных
          данных в соответствии с{" "}
          <Link to="/legal/privacy" className="underline underline-offset-2" target="_blank">
            политикой обработки
          </Link>{" "}
          и{" "}
          <Link to="/legal/consent" className="underline underline-offset-2" target="_blank">
            согласием на обработку
          </Link>
          .
        </p>

        {error && <p className="mb-3 text-[12px] text-[#C2554A]">{error}</p>}

        <button
          onClick={accept}
          disabled={sending}
          className="w-full rounded-[16px] bg-[#B8785A] px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#9E6349] disabled:opacity-50"
        >
          {sending ? "Секунду..." : "Понятно, начать разговор"}
        </button>

        <p className="mt-3 text-center text-[11.5px] leading-relaxed text-[#B8A898] dark:text-[#8A7A6A]">
          Если сейчас тяжело и нужна срочная помощь — телефон доверия{" "}
          <a href="tel:88003334434" className="font-semibold underline underline-offset-2">
            8-800-333-44-34
          </a>
          , круглосуточно и бесплатно.
        </p>
      </div>
    </div>
  );
}
