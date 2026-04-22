import { useState, useRef, useCallback, useEffect } from "react";
import type { WSMessage, Message } from "@/types";

interface UseChatOptions {
  sessionId: string;
  onMessageComplete?: (message: Message) => void;
}

export function useChat({ sessionId, onMessageComplete }: UseChatOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [agentsUsed, setAgentsUsed] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentsUsedRef = useRef<string[]>([]);
  const streamingContentRef = useRef("");
  const onMessageCompleteRef = useRef(onMessageComplete);

  useEffect(() => {
    onMessageCompleteRef.current = onMessageComplete;
  }, [onMessageComplete]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!sessionId) return;

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
      reconnectTimeoutRef.current = setTimeout(() => {
        if (sessionId) connect();
      }, 3000);
    };

    ws.onerror = () => ws.close();

    // Permanent handler — catches both auto-greetings and responses to user messages
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
          setStreamingContent((prev) => prev + "\n\n[Ошибка: " + data.message + "]");
          break;
        case "context_compressed":
          break;
      }
    };
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

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { isConnected, streamingContent, agentsUsed, isStreaming, sendMessage, disconnect };
}
