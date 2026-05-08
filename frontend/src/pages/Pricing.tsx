import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Sparkles, Package, Loader2 } from "lucide-react";
import {
  formatRub,
  useBuyPackage,
  usePricing,
  usePromoCheck,
  useSubscribe,
  useSubscriptionMe,
} from "@/hooks/useSubscription";
import { useAuthStore } from "@/store/auth";
import type { PackCode, PlanCode, PurposeCode } from "@/types";

type SelectablePlan = { code: PlanCode; bestSavings?: string };
type SelectablePack = { code: PackCode; size: number };

const PLANS: SelectablePlan[] = [
  { code: "pro_month" },
  { code: "pro_3m", bestSavings: "−15%" },
  { code: "pro_year", bestSavings: "−36%" },
];

const PACKS: SelectablePack[] = [
  { code: "pack_5", size: 5 },
  { code: "pack_15", size: 15 },
];

export default function Pricing() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const pricing = usePricing();
  const me = useSubscriptionMe(isAuthenticated);
  const subscribe = useSubscribe();
  const buyPack = useBuyPackage();
  const promoCheck = usePromoCheck();

  const [purpose, setPurpose] = useState<PurposeCode | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount_percent: number;
    final_amount_kopecks: number;
    purpose: PurposeCode;
  } | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedRecurring, setAcceptedRecurring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If user changes purpose, drop previously checked promo (it was tied to old purpose)
  useEffect(() => {
    if (appliedPromo && purpose && appliedPromo.purpose !== purpose) {
      setAppliedPromo(null);
    }
  }, [purpose, appliedPromo]);

  const data = pricing.data;
  const isPro = me.data?.tier === "pro";

  const isPlan = purpose === "pro_month" || purpose === "pro_3m" || purpose === "pro_year";

  const baseAmount = useMemo(() => {
    if (!purpose || !data) return 0;
    if (isPlan) return data.plans[purpose as PlanCode].amount_kopecks;
    return data.packs[purpose as PackCode].amount_kopecks;
  }, [purpose, data, isPlan]);
  const recurringRequired = isPlan;
  const finalAmount =
    appliedPromo && appliedPromo.purpose === purpose
      ? appliedPromo.final_amount_kopecks
      : baseAmount;

  const handleApplyPromo = async () => {
    if (!purpose || !promoInput.trim()) return;
    setError(null);
    try {
      const res = await promoCheck.mutateAsync({ code: promoInput.trim(), purpose });
      if (res.valid) {
        setAppliedPromo({
          code: promoInput.trim().toUpperCase(),
          discount_percent: res.discount_percent,
          final_amount_kopecks: res.final_amount_kopecks,
          purpose,
        });
      } else {
        setAppliedPromo(null);
        setError(res.error || "Промокод не подходит");
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Не удалось проверить промокод");
    }
  };

  const handleCheckout = async () => {
    if (!purpose) return;
    if (!isAuthenticated) {
      navigate("/auth?next=/pricing");
      return;
    }
    if (!acceptedTerms) {
      setError("Подтверди согласие с офертой и политикой возвратов");
      return;
    }
    if (recurringRequired && !acceptedRecurring) {
      setError("Подтверди согласие на регулярные платежи");
      return;
    }
    setError(null);
    const promo_code =
      appliedPromo && appliedPromo.purpose === purpose ? appliedPromo.code : null;
    try {
      let resp;
      if (isPlan) {
        resp = await subscribe.mutateAsync({ plan: purpose as PlanCode, promo_code });
      } else {
        resp = await buyPack.mutateAsync({ pack: purpose as PackCode, promo_code });
      }
      window.location.href = resp.confirmation_url;
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Не удалось создать платёж");
    }
  };

  return (
    <div className="min-h-dvh bg-[#FAF6F1] py-10 px-4 dark:bg-[#2A2420]">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898]"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>

        <header className="mb-8 text-center">
          <h1 className="mb-2 font-serif text-[32px] font-bold text-[#4A4038] dark:text-[#E8DDD0]">
            Цены
          </h1>
          <p className="text-[14px] text-[#8A7A6A] dark:text-[#B8A898]">
            Первые {data?.free_lifetime_sessions ?? 2} сессии — бесплатно. Без карты.
          </p>
          {isPro && me.data?.expires_at && (
            <p className="mt-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-[12px] text-emerald-700">
              ✓ Pro активна до {new Date(me.data.expires_at).toLocaleDateString("ru-RU")}
            </p>
          )}
        </header>

        {pricing.isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#B8785A]" />
          </div>
        )}

        {data && !data.monetization_enabled && (
          <div className="mb-6 rounded-[16px] border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-800">
            Платежи временно отключены. Вернёмся скоро.
          </div>
        )}

        {data && (
          <>
            <h2 className="mb-3 font-serif text-[20px] font-semibold text-[#4A4038] dark:text-[#E8DDD0]">
              Pro-подписка
            </h2>
            <div className="mb-10 grid gap-4 sm:grid-cols-3">
              {PLANS.map((p) => {
                const plan = data.plans[p.code];
                const selected = purpose === p.code;
                return (
                  <PlanCard
                    key={p.code}
                    label={plan.label}
                    amount={plan.amount_kopecks}
                    badge={p.bestSavings}
                    selected={selected}
                    onClick={() => setPurpose(p.code)}
                    perks={[
                      "Безлимит сессий",
                      "Долгосрочная память",
                      "Продолжение между сессиями",
                      "Все упражнения и инсайты",
                    ]}
                  />
                );
              })}
            </div>

            <h2 id="packs" className="mb-3 font-serif text-[20px] font-semibold text-[#4A4038] dark:text-[#E8DDD0]">
              Пакеты сессий — без подписки
            </h2>
            <div className="mb-10 grid gap-4 sm:grid-cols-2">
              {PACKS.map((p) => {
                const pack = data.packs[p.code];
                const selected = purpose === p.code;
                return (
                  <PackCard
                    key={p.code}
                    label={pack.label}
                    amount={pack.amount_kopecks}
                    size={p.size}
                    selected={selected}
                    onClick={() => setPurpose(p.code)}
                  />
                );
              })}
            </div>

            {purpose && (
              <div className="rounded-[20px] bg-white p-5 shadow-sm dark:bg-[#3A302A]">
                <h3 className="mb-4 font-serif text-[18px] font-semibold text-[#4A4038] dark:text-[#E8DDD0]">
                  К оплате
                </h3>

                <div className="mb-4 flex items-center gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="Промокод (если есть)"
                    className="flex-1 rounded-[12px] border border-[#E8DDD0] bg-[#FAF6F1] px-3 py-2 text-[14px] text-[#4A4038] placeholder-[#B8A898] outline-none focus:border-[#B8785A] dark:border-[#4A4038] dark:bg-[#2A2420] dark:text-[#E8DDD0]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={promoCheck.isPending || !promoInput.trim()}
                    className="rounded-[12px] border border-[#B8785A] px-4 py-2 text-[13px] font-medium text-[#B8785A] hover:bg-[#FDF5F0] disabled:opacity-50"
                  >
                    Применить
                  </button>
                </div>

                {appliedPromo && appliedPromo.purpose === purpose && (
                  <div className="mb-4 flex items-center gap-2 rounded-[12px] bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
                    <Check className="h-4 w-4" />
                    Промокод <span className="font-mono">{appliedPromo.code}</span> применён
                    (−{appliedPromo.discount_percent}%)
                  </div>
                )}

                <div className="mb-4 space-y-1 text-[14px]">
                  <div className="flex justify-between text-[#8A7A6A] dark:text-[#B8A898]">
                    <span>Базовая цена</span>
                    <span>{formatRub(baseAmount)}</span>
                  </div>
                  {appliedPromo && appliedPromo.purpose === purpose && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Скидка</span>
                      <span>−{formatRub(baseAmount - finalAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[#E8DDD0] pt-2 font-semibold text-[#4A4038] dark:border-[#4A4038] dark:text-[#E8DDD0]">
                    <span>Итого</span>
                    <span>{formatRub(finalAmount)}</span>
                  </div>
                </div>

                <label className="mb-2 flex items-start gap-2 text-[12px] text-[#5A5048] dark:text-[#C8B8A8]">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#B8785A]"
                  />
                  <span>
                    Я согласен с{" "}
                    <Link to="/legal/offer" className="text-[#B8785A] underline" target="_blank">
                      Офертой
                    </Link>
                    ,{" "}
                    <Link to="/legal/refund" className="text-[#B8785A] underline" target="_blank">
                      Политикой возврата
                    </Link>{" "}
                    и{" "}
                    <Link to="/legal/privacy" className="text-[#B8785A] underline" target="_blank">
                      Политикой конфиденциальности
                    </Link>
                    .
                  </span>
                </label>

                {recurringRequired && (
                  <label className="mb-3 flex items-start gap-2 text-[12px] text-[#5A5048] dark:text-[#C8B8A8]">
                    <input
                      type="checkbox"
                      checked={acceptedRecurring}
                      onChange={(e) => setAcceptedRecurring(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#B8785A]"
                    />
                    <span>
                      Я согласен на{" "}
                      <Link
                        to="/legal/consent"
                        className="text-[#B8785A] underline"
                        target="_blank"
                      >
                        регулярные платежи
                      </Link>
                      . Можно отменить в любой момент в личном кабинете.
                    </span>
                  </label>
                )}

                {error && (
                  <div className="mb-3 rounded-[12px] bg-rose-50 px-3 py-2 text-[13px] text-rose-800">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleCheckout}
                  disabled={subscribe.isPending || buyPack.isPending}
                  className="w-full rounded-[16px] bg-gradient-to-r from-[#B8785A] to-[#9E6349] py-3 text-[15px] font-semibold text-white hover:opacity-95 disabled:opacity-60"
                >
                  {subscribe.isPending || buyPack.isPending ? "Переходим к оплате..." : `Оплатить ${formatRub(finalAmount)}`}
                </button>

                <p className="mt-3 text-center text-[11px] text-[#8A7A6A]">
                  Платёж проходит через ЮKassa. Чек придёт автоматически.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PlanCard({
  label,
  amount,
  badge,
  selected,
  onClick,
  perks,
}: {
  label: string;
  amount: number;
  badge?: string;
  selected: boolean;
  onClick: () => void;
  perks: string[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-[20px] border p-5 text-left transition ${
        selected
          ? "border-[#B8785A] bg-white shadow-md dark:bg-[#3A302A]"
          : "border-[#E8DDD0] bg-white hover:border-[#B8785A] dark:border-[#3A302A] dark:bg-[#3A302A]"
      }`}
    >
      {badge && (
        <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          {badge}
        </span>
      )}
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-[#B8785A]" />
        <span className="text-[13px] font-medium text-[#8A7A6A]">{label}</span>
      </div>
      <div className="mb-3 font-serif text-[28px] font-bold text-[#4A4038] dark:text-[#E8DDD0]">
        {formatRub(amount)}
      </div>
      <ul className="space-y-1.5 text-[12.5px] text-[#5A5048] dark:text-[#C8B8A8]">
        {perks.map((p) => (
          <li key={p} className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            {p}
          </li>
        ))}
      </ul>
    </button>
  );
}

function PackCard({
  label,
  amount,
  size,
  selected,
  onClick,
}: {
  label: string;
  amount: number;
  size: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-4 rounded-[20px] border p-5 text-left transition ${
        selected
          ? "border-[#B8785A] bg-white shadow-md dark:bg-[#3A302A]"
          : "border-[#E8DDD0] bg-white hover:border-[#B8785A] dark:border-[#3A302A] dark:bg-[#3A302A]"
      }`}
    >
      <Package className="h-7 w-7 shrink-0 text-[#B8785A]" />
      <div>
        <div className="font-serif text-[18px] font-semibold text-[#4A4038] dark:text-[#E8DDD0]">
          {label} — {formatRub(amount)}
        </div>
        <div className="mt-0.5 text-[12px] text-[#8A7A6A]">
          Без подписки. {size} сессий, 6 месяцев. Без долгосрочной памяти.
        </div>
      </div>
    </button>
  );
}
