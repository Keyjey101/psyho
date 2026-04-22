import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSessions, useSession, useCreateSession, useDeleteSession } from "@/hooks/useSessions";
import { useChat } from "@/hooks/useChat";
import Sidebar from "@/components/chat/Sidebar";
import MessageList from "@/components/chat/MessageList";
import InputBar from "@/components/chat/InputBar";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/types";
import { Menu, AlertCircle } from "lucide-react";

export default function Chat() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: sessions } = useSessions();
  const { data: currentSession, isError } = useSession(sessionId);
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMessageComplete = useCallback(
    (msg: Message) => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    [sessionId, queryClient]
  );

  const { streamingContent, agentsUsed, isStreaming, sendMessage, isConnected } = useChat({
    sessionId: sessionId || "",
    onMessageComplete: handleMessageComplete,
  });

  useEffect(() => {
    if (currentSession?.messages) {
      setLocalMessages(currentSession.messages);
    }
  }, [currentSession]);

  useEffect(() => {
    if (isError && sessionId) {
      navigate("/chat", { replace: true });
    }
  }, [isError, sessionId, navigate]);

  useEffect(() => {
    if (!isConnected || !pendingMessage || !sessionId) return;
    const msg = pendingMessage;
    setPendingMessage(null);
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      content: msg,
      agents_used: null,
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);
    sendMessage(msg);
  }, [isConnected, pendingMessage, sessionId, sendMessage]);

  const handleSend = async (content: string) => {
    if (!sessionId) {
      setPendingMessage(content);
      const newSession = await createSession.mutateAsync(undefined);
      navigate(`/chat/${newSession.id}`);
      return;
    }

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      content,
      agents_used: null,
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);
    sendMessage(content);
  };

  const handleNewChat = async () => {
    navigate("/chat");
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession.mutateAsync(id);
    if (sessionId === id) {
      navigate("/chat");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex h-screen bg-surface-50">
      <Sidebar
        sessions={sessions || []}
        activeSessionId={sessionId}
        activeSessionSummary={currentSession?.summary}
        onNewChat={handleNewChat}
        onSelectSession={(id) => navigate(`/chat/${id}`)}
        onDeleteSession={handleDeleteSession}
        onLogout={handleLogout}
        userName={user?.name}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-surface-100 bg-white px-4 py-3 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold text-surface-900">
            {currentSession?.title || "Новый разговор"}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {isConnected && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                Онлайн
              </div>
            )}
          </div>
        </header>

        <MessageList
          messages={localMessages}
          streamingContent={streamingContent}
          agentsUsed={agentsUsed}
          isStreaming={isStreaming}
        />

        <InputBar onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
