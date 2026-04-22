import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSessions, useSession, useCreateSession, useDeleteSession, useContinueSession } from "@/hooks/useSessions";
import { useChat } from "@/hooks/useChat";
import Sidebar from "@/components/chat/Sidebar";
import MessageList from "@/components/chat/MessageList";
import InputBar from "@/components/chat/InputBar";
import ActionPanel from "@/components/chat/ActionPanel";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/types";
import { Menu, Brain } from "lucide-react";
import api from "@/api/client";

export default function Chat() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: sessions } = useSessions();
  const { data: currentSession, isError } = useSession(sessionId);
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const continueSession = useContinueSession();
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const memoryEnabled = (user as any)?.profile?.memory_enabled ?? true;

  const toggleMemory = async () => {
    try {
      await api.patch("/user/me", { memory_enabled: !memoryEnabled });
      refreshUser();
    } catch {
      // ignore
    }
  };

  const handleMessageComplete = useCallback(
    (msg: Message) => {
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    [sessionId, queryClient],
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

  const handleAction = (action: string) => {
    const actionMessages: Record<string, string> = {
      insight: "Хочу получить инсайт о себе",
      breathe: "Помоги мне подышать",
      write: "Хочу записать одну мысль",
      exercise: "Дай мне упражнение",
    };
    const msg = actionMessages[action];
    if (msg) handleSend(msg);
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

  const previousSession =
    !sessionId && sessions && sessions.length > 0 ? sessions[0] : null;

  const handleContinueSession = async () => {
    if (!previousSession) return;
    const result = await continueSession.mutateAsync(previousSession.id);
    navigate(`/chat/${result.new_session_id}`);
  };

  return (
    <div className="flex h-screen bg-[#FAF6F1]">
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
        <header className="flex items-center gap-3 bg-[#FAF6F1]/90 px-4 py-3 backdrop-blur-sm border-b border-[#E8DDD0]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-[#8A7A6A] hover:bg-[#F5EDE4] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full">
            <img src="/illustrations/ai_avatar.png" alt="Ника" className="h-full w-full object-cover" />
          </div>

          <div>
            <p className="text-[15px] font-semibold leading-none text-[#5A5048]">Ника</p>
            {isConnected && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[12px] text-[#8A7A6A]">Онлайн</span>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleMemory}
              title={memoryEnabled ? "Память включена" : "Память выключена"}
              className="rounded-full p-2 transition-colors hover:bg-[#F5EDE4]"
            >
              <Brain
                className={`h-4 w-4 ${memoryEnabled ? "text-[#B8785A]" : "text-[#B8A898]"}`}
              />
            </button>
          </div>
        </header>

        <MessageList
          messages={localMessages}
          streamingContent={streamingContent}
          agentsUsed={agentsUsed}
          isStreaming={isStreaming}
          previousSession={previousSession}
          onContinueSession={handleContinueSession}
          isContinuing={continueSession.isPending}
        />

        <ActionPanel onAction={handleAction} disabled={isStreaming} />
        <InputBar onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
