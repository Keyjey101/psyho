import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import type { Session, SessionDetail } from "@/types";

export function useSessions() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data } = await api.get<{ sessions: Session[] }>("/sessions");
      return data.sessions;
    },
  });
}

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get<SessionDetail>(`/sessions/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title?: string) => {
      const { data } = await api.post<Session>("/sessions", { title });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/sessions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useRenameSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { data } = await api.patch<Session>(`/sessions/${id}`, { title });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useContinueSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data } = await api.post<{
        new_session_id: string;
        previous_title: string;
        insights_preview: string;
      }>(`/sessions/${sessionId}/continue`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
