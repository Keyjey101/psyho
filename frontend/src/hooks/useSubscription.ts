import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import type {
  CheckoutResponse,
  PackCode,
  PaymentItem,
  PlanCode,
  PricingResponse,
  PromoCheckResponse,
  PurposeCode,
  SubscriptionMe,
} from "@/types";

export function useSubscriptionMe(enabled = true) {
  return useQuery({
    queryKey: ["billing", "me"],
    queryFn: async () => {
      const { data } = await api.get<SubscriptionMe>("/billing/me");
      return data;
    },
    staleTime: 60_000,
    enabled,
  });
}

export function usePricing() {
  return useQuery({
    queryKey: ["billing", "pricing"],
    queryFn: async () => {
      const { data } = await api.get<PricingResponse>("/billing/pricing");
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function usePromoCheck() {
  return useMutation({
    mutationFn: async (vars: { code: string; purpose: PurposeCode }) => {
      const { data } = await api.post<PromoCheckResponse>("/billing/promo/check", vars);
      return data;
    },
  });
}

export function useSubscribe() {
  return useMutation({
    mutationFn: async (vars: { plan: PlanCode; promo_code?: string | null }) => {
      const { data } = await api.post<CheckoutResponse>("/billing/subscribe", vars);
      return data;
    },
  });
}

export function useBuyPackage() {
  return useMutation({
    mutationFn: async (vars: { pack: PackCode; promo_code?: string | null }) => {
      const { data } = await api.post<CheckoutResponse>("/billing/package", vars);
      return data;
    },
  });
}

export function useCancelAutorenew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ ok: boolean; expires_at?: string | null }>(
        "/billing/cancel",
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "me"] }),
  });
}

export function useStartNotifyLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ bot_url: string }>("/billing/notify-link/start");
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "me"] }),
  });
}

export function usePaymentHistory(enabled = true) {
  return useQuery({
    queryKey: ["billing", "payments"],
    queryFn: async () => {
      const { data } = await api.get<PaymentItem[]>("/billing/payments");
      return data;
    },
    enabled,
  });
}

export function formatRub(kopecks: number): string {
  const rub = Math.round(kopecks) / 100;
  if (Number.isInteger(rub)) return `${rub.toLocaleString("ru-RU")} ₽`;
  return `${rub.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}
