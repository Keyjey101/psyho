import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Check, AlertCircle } from "lucide-react";
import {
  formatRub,
  useCancelAutorenew,
  usePaymentHistory,
  useSubscriptionMe,
} from "@/hooks/useSubscription";
import TelegramLinkBanner from "@/components/billing/TelegramLinkBanner";
import ProBadge from "@/components/billing/ProBadge";

const PURPOSE_LABEL: Record<string, string> = {
  pro_month: "Pro · 1 месяц",
  pro_3m: "Pro · 3 месяца",
  pro_year: "Pro · 1 год",
  pro_renewal: "Pro · продление",
  pack_5: "Пакет 5 сессий",
  pack_15: "Пакет 15 сессий",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  succeeded: { label: "Оплачен", color: "text-emerald-700 bg-emerald-50" },
  pending: { label: "Ожидание", color: "text-amber-700 bg-amber-50" },
  canceled: { label: "Отменён", color: "text-rose-700 bg-rose-50" },
  refunded: { label: "Возвращён", color: "text-rose-700 bg-rose-50" },
};

export default function Subscription() {
  const me = useSubscriptionMe();
  const history = usePaymentHistory();
  const cancel = useCancelAutorenew();

  const tier = me.data?.tier ?? "free";
  const isPro = tier === "pro";
  const expiresAt = me.data?.expires_at ? new Date(me.data.expires_at) : null;
  const autorenew = !!me.data?.autorenew;
  const linkedTg = !!me.data?.notify_telegram_linked;

  return (
    <div className="min-h-dvh bg-[#FAF6F1] py-10 px-4 dark:bg-[#2A2420]">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/profile"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898]"
        >
          <ArrowLeft className="h-4 w-4" />
          Профиль
        </Link>

        <h1 className="mb-6 font-serif text-[28px] font-bold text-[#4A4038] dark:text-[#E8DDD0]">
          Подписка
        </h1>

        <section className="mb-6 rounded-[20px] bg-white p-6 dark:bg-[#3A302A]">
          <div className="mb-3 flex items-center gap-3">
            {isPro ? (
              <>
                <ProBadge />
                <span className="text-[14px] text-[#8A7A6A]">
                  {expiresAt
                    ? `до ${expiresAt.toLocaleDateString("ru-RU")}`
                    : "—"}
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full bg-[#FAF6F1] px-3 py-0.5 text-[11px] font-semibold uppercase text-[#8A7A6A] dark:bg-[#2A2420]">
                  Free
                </span>
                <span className="text-[14px] text-[#8A7A6A]">
                  Свободных сессий: {me.data?.free_sessions_left ?? 0}
                </span>
              </>
            )}
          </div>

          {isPro && (
            <div className="mb-4 space-y-1 text-[13px] text-[#5A5048] dark:text-[#C8B8A8]">
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Безлимит сессий и обменов
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Долгосрочная память между сессиями
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Все упражнения и инсайты
              </div>
            </div>
          )}

          {(me.data?.paid_sessions_left ?? 0) > 0 && (
            <p className="mb-3 text-[13px] text-[#5A5048] dark:text-[#C8B8A8]">
              Оплаченных сессий из пакета: <b>{me.data?.paid_sessions_left}</b>
            </p>
          )}

          {isPro ? (
            <div className="flex flex-wrap items-center gap-3">
              {autorenew ? (
                <button
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  className="rounded-[12px] border border-[#E8DDD0] px-4 py-2 text-[13px] text-[#5A5048] hover:bg-[#FAF6F1] disabled:opacity-50 dark:border-[#4A4038] dark:text-[#C8B8A8]"
                >
                  Отключить автопродление
                </button>
              ) : (
                <span className="text-[13px] text-[#8A7A6A]">
                  Автопродление отключено. Доступ до{" "}
                  {expiresAt?.toLocaleDateString("ru-RU")}.
                </span>
              )}
              <Link
                to="/pricing"
                className="text-[13px] text-[#B8785A] hover:underline"
              >
                Сменить план
              </Link>
            </div>
          ) : (
            <Link
              to="/pricing"
              className="inline-flex items-center gap-1.5 rounded-[12px] bg-gradient-to-r from-[#B8785A] to-[#9E6349] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-95"
            >
              <Sparkles className="h-4 w-4" />
              Открыть Pro
            </Link>
          )}
        </section>

        {!linkedTg && (
          <section className="mb-6">
            <TelegramLinkBanner />
          </section>
        )}

        <section>
          <h2 className="mb-3 font-serif text-[18px] font-semibold text-[#4A4038] dark:text-[#E8DDD0]">
            История платежей
          </h2>
          {history.isLoading ? (
            <p className="text-[13px] text-[#8A7A6A]">Загружаем...</p>
          ) : (history.data?.length ?? 0) === 0 ? (
            <p className="text-[13px] text-[#8A7A6A]">Платежей пока нет.</p>
          ) : (
            <div className="overflow-hidden rounded-[16px] bg-white dark:bg-[#3A302A]">
              <table className="w-full text-[13px]">
                <thead className="bg-[#FAF6F1] text-[12px] uppercase text-[#8A7A6A] dark:bg-[#2A2420]">
                  <tr>
                    <th className="px-4 py-2 text-left">Дата</th>
                    <th className="px-4 py-2 text-left">Что</th>
                    <th className="px-4 py-2 text-right">Сумма</th>
                    <th className="px-4 py-2 text-left">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data?.map((p) => {
                    const status = STATUS_LABEL[p.status] ?? {
                      label: p.status,
                      color: "text-[#8A7A6A] bg-[#FAF6F1]",
                    };
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-[#F5EDE4] dark:border-[#2A2420]"
                      >
                        <td className="px-4 py-2 text-[#8A7A6A]">
                          {new Date(p.created_at).toLocaleDateString("ru-RU")}
                        </td>
                        <td className="px-4 py-2 text-[#5A5048] dark:text-[#C8B8A8]">
                          {PURPOSE_LABEL[p.purpose] ?? p.purpose}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#5A5048] dark:text-[#C8B8A8]">
                          {formatRub(p.amount_kopecks)}
                          {p.discount_kopecks > 0 && (
                            <span className="ml-1 text-[11px] text-emerald-600">
                              −{formatRub(p.discount_kopecks)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[16px] bg-[#FAF6F1] p-4 dark:bg-[#3A302A]">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#8A7A6A]" />
            <p className="text-[12px] leading-relaxed text-[#8A7A6A] dark:text-[#B8A898]">
              По вопросам подписки и возврата — см.{" "}
              <Link to="/legal/refund" className="underline">
                Политику возврата
              </Link>
              . Уведомления о списаниях и продлении приходят через
              Telegram-бота.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
