import type { Message } from "@/types";
import MessageItem from "./MessageItem";
import ThinkingIndicator from "./ThinkingIndicator";
import { Bot } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  agentsUsed: string[];
  isStreaming: boolean;
}

export default function MessageList({
  messages,
  streamingContent,
  agentsUsed,
  isStreaming,
}: MessageListProps) {
  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-100 to-primary-200">
            <Bot className="h-10 w-10 text-primary-600" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-surface-900">
            Привет! Я PsyHo
          </h2>
          <p className="max-w-sm text-surface-500">
            Расскажи, что тебя беспокоит, и я подберу подходящий терапевтический подход именно для тебя.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
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

        {isStreaming && !streamingContent && (
          <ThinkingIndicator agents={agentsUsed} />
        )}
      </div>
    </div>
  );
}
