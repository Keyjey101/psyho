import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { Message, Session } from "@/types";
import MessageItem from "./MessageItem";
import ThinkingIndicator from "./ThinkingIndicator";

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  agentsUsed: string[];
  isStreaming: boolean;
  previousSession?: Session | null;
  onContinueSession?: () => void;
  isContinuing?: boolean;
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
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#FAF6F1] px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex justify-center"
          >
            <img
              src="/illustrations/chat_welcome.png"
              alt=""
              className="h-auto w-[200px] object-contain sm:w-[240px]"
              loading="eager"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.retried) {
                  img.dataset.retried = "1";
                  setTimeout(() => { img.src = "/illustrations/chat_welcome.png?" + Date.now(); }, 800);
                }
              }}
            />
          </motion.div>
          <MessageItem message={makeWelcomeMessage()} />
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
    <div className="flex-1 overflow-y-auto bg-[#FAF6F1] px-4 py-6 lg:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}

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
  );
}
