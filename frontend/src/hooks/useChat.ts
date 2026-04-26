import { useState, useRef, useCallback, useEffect } from "react";
import type { WSMessage, Message } from "@/types";
import { useToast } from "@/components/Toast";

interface UseChatOptions {
  sessionId: string;
  onMessageComplete?: (message: Message) => void;
  onSessionLimitReached?: () => void;
}

export function useChat({ sessionId, onMessageComplete, onSessionLimitReached }: UseChatOptions) {
  const { showToast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [agentsUsed, setAgentsUsed] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [maxExchanges, setMaxExchanges] = useState(20);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentsUsedRef = useRef<string[]>([]);
  const streamingContentRef = useRef("");
  const onMessageCompleteRef = useRef(onMessageComplete);
  const onSessionLimitReachedRef = useRef(onSessionLimitReached);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    onMessageCompleteRef.current = onMessageComplete;
  }, [onMessageComplete]);

  useEffect(() => {
    onSessionLimitReachedRef.current = onSessionLimitReached;
  }, [onSessionLimitReached]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsStreaming(false);
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    cleanup();

    const wsBase =
      import.meta.env.VITE_WS_URL ||
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
    const wsUrl = `${wsBase}/api/sessions/${sessionId}/chat`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onclose = () => {
      setIsConnected(false);
      setIsStreaming(false);
      if (sessionIdRef.current === sessionId) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (sessionIdRef.current === sessionId) connect();
        }, 3000);
      }
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      const data: WSMessage = JSON.parse(event.data);
      switch (data.type) {
        case "token":
          setIsStreaming(true);
          setStreamingContent((prev) => {
            const next = prev + data.content;
            streamingContentRef.current = next;
            return next;
          });
          break;
        case "agents_used":
          agentsUsedRef.current = data.agents;
          setAgentsUsed(data.agents);
          break;
        case "done":
          setIsStreaming(false);
          if (data.exchange_count !== undefined) {
            setExchangeCount(data.exchange_count);
          }
          if (data.max_exchanges !== undefined) {
            setMaxExchanges(data.max_exchanges);
          }
          if (document.hidden && Notification.permission === "granted") {
            try {
              new Notification("Ника ответила", { icon: "/icons/pwa-192.svg" });
            } catch {}
          }
          onMessageCompleteRef.current?.({
            id: data.message_id,
            session_id: sessionId,
            role: "assistant",
            content: streamingContentRef.current,
            agents_used:
              agentsUsedRef.current.length > 0
                ? JSON.stringify(agentsUsedRef.current)
                : null,
            created_at: new Date().toISOString(),
          });
          break;
        case "error":
          setIsStreaming(false);
          showToast(data.message || "Произошла ошибка");
          break;
        case "context_compressed":
          showToast("Контекст оптимизирован");
          break;
        case "session_limit_reached":
          onSessionLimitReachedRef.current?.();
          break;
      }
    };
  }, [sessionId, cleanup, showToast]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      streamingContentRef.current = "";
      setStreamingContent("");
      setAgentsUsed([]);
      agentsUsedRef.current = [];
      setIsStreaming(true);
      wsRef.current.send(JSON.stringify({ type: "message", content }));
    },
    [],
  );

  useEffect(() => {
    connect();
    return () => cleanup();
  }, [connect, cleanup]);

  return { isConnected, streamingContent, agentsUsed, isStreaming, sendMessage, exchangeCount, maxExchanges };
}
