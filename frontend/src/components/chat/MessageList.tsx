import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowDown } from "lucide-react";
import type { Message, Session } from "@/types";
import MessageItem from "./MessageItem";
import ThinkingIndicator from "./ThinkingIndicator";
import PendingTaskCard from "./PendingTaskCard";
import api from "@/api/client";

// Vertical distance (px) within which we consider the user "at the bottom"
// of the chat. Bigger than 0 because mobile keyboards and momentum scroll
// rarely land us exactly on 0.
const STICKY_BOTTOM_THRESHOLD = 80;

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  agentsUsed: string[];
  isStreaming: boolean;
  previousSession?: Session | null;
  onContinueSession?: () => void;
  isContinuing?: boolean;
  /** When defined and the last message is an assistant reply, that message
   *  shows a "Regenerate" affordance. Disabled while streaming. */
  onRegenerate?: () => void;
}

interface PendingTask {
  id: string;
  session_id: string;
  text: string;
  completed: boolean;
  created_at: string;
}

function makeWelcomeMessage(): Message {
  return {
    id: "welcome",
    session_id: "",
    role: "assistant",
    content:
      "Привет. Я Ника — твой компаньон в заботе о себе.\n\nЗдесь можно говорить обо всём: тревоге, усталости, отношениях или просто о том, как прошёл день.\n\nЯ здесь. С чего начнём?",
    agents_used: null,
    created_at: new Date().toISOString(),
  };
}

export default function MessageList({
  messages,
  streamingContent,
  agentsUsed,
  isStreaming,
  previousSession,
  onContinueSession,
  isContinuing,
  onRegenerate,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  // True while the user's viewport is parked near the bottom — controls
  // whether incoming tokens auto-scroll or surface a "jump to latest" pill.
  const [atBottom, setAtBottom] = useState(true);
  // Distinguish "new content arrived while scrolled up" so the pill can
  // optionally show a different label / dot. We just use a counter.
  const [unseenCount, setUnseenCount] = useState(0);
  // Track the previous message count so we know when something is genuinely
  // new vs. a re-render of the same list.
  const prevMsgCountRef = useRef(0);

  useEffect(() => {
    if (messages.length === 0 && !isStreaming) {
      api.get("/tasks/pending").then(({ data }) => setPendingTasks(data)).catch(() => {});
    }
  }, [messages.length, isStreaming]);

  const checkAtBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distance < STICKY_BOTTOM_THRESHOLD;
    setAtBottom(isNearBottom);
    if (isNearBottom) setUnseenCount(0);
  }, []);

  // When new content arrives, only auto-scroll if we were already at the
  // bottom. Otherwise increment the unseen counter so the pill appears.
  useEffect(() => {
    if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (messages.length !== prevMsgCountRef.current || streamingContent) {
      setUnseenCount((n) => n + 1);
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, streamingContent, atBottom]);

  const jumpToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setUnseenCount(0);
  }, []);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div
        ref={scrollContainerRef}
        onScroll={checkAtBottom}
        className="flex-1 overflow-y-auto bg-[#FAF6F1] px-4 py-6 dark:bg-[#2A2420]"
      >
        <div className="mx-auto max-w-3xl space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex justify-center"
          >
            <img
              src="/illustrations/opt/chat_welcome.webp"
              alt=""
              className="h-auto w-[200px] object-contain sm:w-[240px]"
              loading="eager"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.retried) {
                  img.dataset.retried = "1";
                  setTimeout(() => { img.src = "/illustrations/opt/chat_welcome.webp?" + Date.now(); }, 800);
                } else {
                  img.src = "/illustrations/chat_welcome.png";
                }
              }}
            />
          </motion.div>
          <MessageItem message={makeWelcomeMessage()} />
          {pendingTasks.length > 0 && (
            <PendingTaskCard
              tasks={pendingTasks}
              onDismiss={() => setPendingTasks([])}
            />
          )}
          {previousSession && onContinueSession && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex justify-center"
            >
              <button
                onClick={onContinueSession}
                disabled={isContinuing}
                className="btn-secondary gap-2 px-5 py-2.5 text-sm"
              >
                {isContinuing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#B8A898] border-t-[#B8785A]" />
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Продолжить сессию
                  </>
                )}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollContainerRef}
        onScroll={checkAtBottom}
        className="h-full overflow-y-auto bg-[#FAF6F1] px-4 py-6 lg:px-6 dark:bg-[#2A2420]"
      >
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          const canRegenerate =
            isLast && !isStreaming && msg.role === "assistant" && !!onRegenerate;
          return (
            <MessageItem
              key={msg.id}
              message={msg}
              onRegenerate={canRegenerate ? onRegenerate : undefined}
            />
          );
        })}

        {isStreaming && streamingContent && (
          <MessageItem
            message={{
              id: "streaming",
              session_id: "",
              role: "assistant",
              content: streamingContent,
              agents_used: agentsUsed.length > 0 ? JSON.stringify(agentsUsed) : null,
              created_at: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {isStreaming && !streamingContent && <ThinkingIndicator agents={agentsUsed} />}
        <div ref={bottomRef} />
      </div>
      </div>

      <AnimatePresence>
        {!atBottom && (
          <motion.button
            key="jump-to-latest"
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.92 }}
            transition={{ duration: 0.18 }}
            onClick={jumpToBottom}
            aria-label="К новым сообщениям"
            className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-pill border border-[#E8DDD0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5A5048] shadow-md hover:bg-[#FAF6F1] dark:border-[#4A4038] dark:bg-[#352E2A] dark:text-[#F5EDE4] dark:hover:bg-[#4A4038]"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {unseenCount > 0 ? "Новые сообщения" : "К концу"}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
