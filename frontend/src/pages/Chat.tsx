import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSessions, useSession, useCreateSession, useDeleteSession, useContinueSession } from "@/hooks/useSessions";
import { useChat } from "@/hooks/useChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import Sidebar from "@/components/chat/Sidebar";
import MessageList from "@/components/chat/MessageList";
import InputBar from "@/components/chat/InputBar";
import ActionPanel from "@/components/chat/ActionPanel";
import SessionProgress from "@/components/chat/SessionProgress";
import SessionEndCard from "@/components/chat/SessionEndCard";
import MoodTracker from "@/components/chat/MoodTracker";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/types";
import { Menu, Brain, X, Download } from "lucide-react";
import api from "@/api/client";

interface PendingTask {
  id: string;
  session_id: string;
  text: string;
  completed: boolean;
}

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
  const [awaitingGreeting, setAwaitingGreeting] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showMoodTracker, setShowMoodTracker] = useState(false);
  const [initialExchangeCount, setInitialExchangeCount] = useState(0);
  const [pendingTask, setPendingTask] = useState<PendingTask | null>(null);
  const [taskDismissed, setTaskDismissed] = useState(false);

  useEffect(() => {
    if (user && user.name === "") {
      navigate("/onboarding", { replace: true });
    }
  }, [user, navigate]);

  // Fetch pending tasks from previous sessions
  useEffect(() => {
    if (!sessionId) return;
    api.get<PendingTask[]>("/tasks/pending").then(({ data }) => {
      const fromOtherSession = data.find((t) => t.session_id !== sessionId);
      if (fromOtherSession) {
        setPendingTask(fromOtherSession);
        setTaskDismissed(false);
      }
    }).catch(() => {});
  }, [sessionId]);

  const memoryEnabled = user?.profile?.memory_enabled ?? true;

  const toggleMemory = async () => {
    try {
      await api.patch("/user/me", { memory_enabled: !memoryEnabled });
      refreshUser();
    } catch {
      // ignore
    }
  };

  const handleCompleteTask = useCallback(async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      setPendingTask(null);
    } catch {}
  }, []);

  const handleMessageComplete = useCallback(
    (msg: Message) => {
      setAwaitingGreeting(false);
      setLocalMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    [sessionId, queryClient],
  );

  const handleSessionLimitReached = useCallback(() => {
    setShowLimitModal(true);
  }, []);

  const { streamingContent, agentsUsed, isStreaming, sendMessage, isConnected, exchangeCount, maxExchanges } = useChat({
    sessionId: sessionId || "",
    onMessageComplete: handleMessageComplete,
    onSessionLimitReached: handleSessionLimitReached,
  });

  useEffect(() => {
    if (!sessionId) {
      setLocalMessages([]);
      setInitialExchangeCount(0);
      return;
    }
    if (currentSession?.messages) {
      setLocalMessages(currentSession.messages);
      setInitialExchangeCount(
        currentSession.exchange_count ??
        currentSession.messages.filter((m) => m.role === "user").length
      );
    }
  }, [currentSession, sessionId]);

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

  const previousSession =
    !sessionId && sessions && sessions.length > 0 ? sessions[0] : null;

  const handleContinueSession = async () => {
    if (!previousSession) return;
    const result = await continueSession.mutateAsync(previousSession.id);
    setAwaitingGreeting(true);
    navigate(`/chat/${result.new_session_id}`);
  };

  const handleContinueFromLimit = async () => {
    if (!sessionId) return;
    setShowLimitModal(false);
    const result = await continueSession.mutateAsync(sessionId);
    setAwaitingGreeting(true);
    navigate(`/chat/${result.new_session_id}`);
  };

  const handleFinishFromLimit = (moodValue: number | null, exerciseCompleted?: boolean | null) => {
    setShowLimitModal(false);
    if (moodValue) {
      api.post("/mood", { value: moodValue, session_id: sessionId }).catch(() => {});
    }
    if (exerciseCompleted === false && pendingTask) {
      // task stays incomplete, just dismiss
      setPendingTask(null);
    }
  };

  const handleMoodSubmit = async (value: number) => {
    try {
      await api.post("/mood", { value, session_id: sessionId });
    } catch {}
    setShowMoodTracker(false);
  };

  const handleMoodSkip = () => {
    setShowMoodTracker(false);
  };

  const handleExportSession = async () => {
    if (!sessionId) return;
    try {
      const response = await api.get(`/export/session/${sessionId}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nika-session-${sessionId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore export error
    }
  };

  const displayExchangeCount = exchangeCount || initialExchangeCount;
  const displayMaxExchanges = maxExchanges || currentSession?.max_exchanges || 20;
  const isSessionCompleted = displayExchangeCount > 0 && displayExchangeCount >= displayMaxExchanges;
  const completedSessions = sessions?.length ?? 0;

  // Pending task banner (show at top of chat if task from another session)
  const showTaskBanner = !!pendingTask && !taskDismissed && !showLimitModal;

  useKeyboardShortcuts({
    onNewChat: handleNewChat,
    onCloseOverlay: () => {
      if (showLimitModal) setShowLimitModal(false);
      if (showMoodTracker) setShowMoodTracker(false);
      if (isActionsOpen) setIsActionsOpen(false);
    },
    onToggleActions: () => setIsActionsOpen((prev) => !prev),
  });

  return (
    <div className="flex h-dvh overflow-hidden bg-[#FAF6F1] dark:bg-[#2A2420]">
      <Sidebar
        sessions={sessions || []}
        activeSessionId={sessionId}
        activeSessionSummary={currentSession?.summary}
        onNewChat={handleNewChat}
        onSelectSession={(id) => navigate(`/chat/${id}`)}
        onDeleteSession={handleDeleteSession}
        onLogout={handleLogout}
        userName={user?.name}
        isAdmin={user?.is_admin}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 bg-[#FAF6F1]/90 px-4 py-3 backdrop-blur-sm border-b border-[#E8DDD0] dark:bg-[#2A2420]/90 dark:border-[#4A4038]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-[#8A7A6A] hover:bg-[#F5EDE4] dark:text-[#B8A898] dark:hover:bg-[#352E2A] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full">
            <img
              src="/illustrations/opt/ai_avatar.webp"
              alt="Ника"
              className="h-full w-full object-cover"
              loading="eager"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.retried) {
                  img.dataset.retried = "1";
                  setTimeout(() => { img.src = "/illustrations/opt/ai_avatar.webp?" + Date.now(); }, 800);
                } else {
                  img.src = "/illustrations/ai_avatar.png";
                }
              }}
            />
          </div>

          <div>
            <p className="text-[15px] font-semibold leading-none text-[#5A5048] dark:text-[#F5EDE4]">Ника</p>
            {isConnected && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[12px] text-[#8A7A6A]">Онлайн</span>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {sessionId && localMessages.length > 0 && (
              <button
                onClick={handleExportSession}
                title="Экспортировать сессию"
                className="rounded-lg p-2 text-[#8A7A6A] hover:bg-[#F5EDE4] dark:text-[#B8A898] dark:hover:bg-[#352E2A]"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={toggleMemory}
              title={
                memoryEnabled
                  ? "Память включена — Ника запоминает важные факты о тебе между сессиями"
                  : "Память выключена — Ника не сохраняет ничего между сессиями"
              }
              className="flex items-center gap-1.5 rounded-full px-2 py-1.5 transition-colors hover:bg-[#F5EDE4]"
            >
              <div className="relative">
                <Brain
                  className={`h-4 w-4 ${memoryEnabled ? "text-[#B8785A]" : "text-[#B8A898]"}`}
                />
                {!memoryEnabled && (
                  <X className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white text-red-400" />
                )}
              </div>
              <span className={`hidden text-[12px] sm:inline ${memoryEnabled ? "text-[#8A7A6A]" : "text-[#B8A898]"}`}>
                {memoryEnabled ? "Память вкл." : "Память выкл."}
              </span>
            </button>
          </div>
        </header>

        <SessionProgress current={displayExchangeCount} max={displayMaxExchanges} isSessionCompleted={isSessionCompleted} />

        {/* Pending task banner */}
        {showTaskBanner && (
          <div className="flex items-start gap-3 border-b border-[#E8DDD0] bg-[#FDF5EE] px-4 py-3 dark:border-[#4A4038] dark:bg-[#2E2620]">
            <img src="/illustrations/opt/action_exercise.webp" alt="" className="mt-0.5 h-5 w-5 object-contain" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#5A5048] dark:text-[#F5EDE4]">
                Упражнение из прошлой сессии
              </p>
              <p className="mt-0.5 truncate text-[12px] text-[#8A7A6A]">
                {pendingTask!.text.length > 80
                  ? pendingTask!.text.slice(0, 80) + "…"
                  : pendingTask!.text}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => handleCompleteTask(pendingTask!.id)}
                className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
              >
                ✅ Сделал(а)
              </button>
              <button
                onClick={() => setTaskDismissed(true)}
                className="rounded-lg bg-[#F5EDE4] px-2.5 py-1 text-[11px] font-medium text-[#8A7A6A] hover:bg-[#EEE0D4]"
              >
                Позже
              </button>
            </div>
          </div>
        )}

        <MessageList
          messages={localMessages}
          streamingContent={streamingContent}
          agentsUsed={agentsUsed}
          isStreaming={isStreaming || awaitingGreeting}
          previousSession={previousSession}
          onContinueSession={handleContinueSession}
          isContinuing={continueSession.isPending}
        />

        <ActionPanel
          sessionId={sessionId}
          disabled={isStreaming || awaitingGreeting || isSessionCompleted}
          isOpen={isActionsOpen}
          onMoodRequest={() => setShowMoodTracker(true)}
        />

        <InputBar
          onSend={handleSend}
          disabled={isStreaming || awaitingGreeting || isSessionCompleted}
          isActionsOpen={isActionsOpen}
          onToggleActions={() => setIsActionsOpen((prev) => !prev)}
        />
      </div>

      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <SessionEndCard
            exchangeCount={displayExchangeCount}
            messages={localMessages}
            onContinue={handleContinueFromLimit}
            onFinish={handleFinishFromLimit}
            isContinuing={continueSession.isPending}
            completedSessions={completedSessions}
            pendingTaskId={pendingTask?.id ?? null}
            pendingTaskText={pendingTask?.text ?? null}
            onCompleteTask={handleCompleteTask}
          />
        </div>
      )}

      {showMoodTracker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <MoodTracker
            onSubmit={handleMoodSubmit}
            onSkip={handleMoodSkip}
          />
        </div>
      )}
    </div>
  );
}
