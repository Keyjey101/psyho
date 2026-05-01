import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { motion } from "framer-motion";
import { Copy, Check, RefreshCw } from "lucide-react";
import type { Message } from "@/types";
import { getAgentInfo } from "@/types";
import AgentBadge from "./AgentBadge";

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  /** Show a "Regenerate" button on this message (only meaningful for the
   *  last assistant message; parent decides). */
  onRegenerate?: () => void;
}

export default function MessageItem({ message, isStreaming, onRegenerate }: MessageItemProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const agents: string[] = message.agents_used
    ? (() => {
        try {
          return JSON.parse(message.agents_used);
        } catch {
          return [];
        }
      })()
    : [];

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex justify-end"
      >
        <div className="max-w-[80%] rounded-[18px] rounded-br-[4px] bg-[#B8785A] dark:bg-[#7A5040] px-[18px] py-[14px] shadow-sm">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white">
            {message.content}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full">
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
            }
          }}
        />
      </div>
        <div className="max-w-[85%] min-w-0">
          <div className="group relative rounded-[18px] rounded-bl-[4px] border border-[#D8CDC0] dark:border-[#4A4038] bg-white dark:bg-[#352E2A] px-[18px] py-[14px] shadow-[0_1px_4px_rgba(90,80,72,0.06)]">
          <div className="absolute right-2 top-2 flex gap-0.5">
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                title="Перегенерировать ответ"
                aria-label="Перегенерировать ответ"
                className="rounded-md p-1.5 text-[#B8A898] opacity-0 transition-opacity hover:bg-[#F5EDE4] dark:hover:bg-[#4A4038] hover:text-[#8A7A6A] group-hover:opacity-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(message.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              title="Скопировать"
              aria-label="Скопировать сообщение"
              className="rounded-md p-1.5 text-[#B8A898] opacity-0 transition-opacity hover:bg-[#F5EDE4] dark:hover:bg-[#4A4038] hover:text-[#8A7A6A] group-hover:opacity-100"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="markdown-content text-[15px] leading-[1.6] text-[#5A5048] dark:text-[#F5EDE4]">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{message.content}</ReactMarkdown>
          </div>
          {isStreaming && (
            <span className="inline-block h-4 w-0.5 animate-pulse bg-[#B8785A]" />
          )}
        </div>
        <p className="mt-1 text-[11px] text-[#B8A898]">
          {(() => {
            const ts = message.created_at.endsWith("Z") ? message.created_at : message.created_at + "Z";
            return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
          })()}
        </p>
        {agents.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {agents.map((agentId) => {
              const info = getAgentInfo(agentId);
              return <AgentBadge key={agentId} agent={info} />;
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
