import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import VoiceInput from "./VoiceInput";
import ActionPanel from "./ActionPanel";

interface InputBarProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  sessionId?: string;
}

export default function InputBar({ onSend, disabled, sessionId }: InputBarProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [content]);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasContent = content.trim().length > 0;

  return (
    <div
      className="border-t border-[#E8DDD0] bg-white px-4 pt-3 lg:px-6"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2">
          <ActionPanel sessionId={sessionId} disabled={disabled} />
          <div className="flex flex-1 items-end gap-2 rounded-[24px] border border-[#D8CDC0] bg-white px-4 py-2">
            <VoiceInput
              onTranscript={(text) => setContent((prev) => (prev ? prev + " " + text : text))}
              disabled={disabled}
            />
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напиши что угодно..."
              disabled={disabled}
              rows={1}
              className="flex-1 resize-none border-0 bg-transparent py-1 text-sm text-[#5A5048] placeholder:italic placeholder:text-[#B8A898] focus:outline-none focus:ring-0 max-h-40"
            />
            <button
              onClick={handleSubmit}
              disabled={disabled || !hasContent}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#B8785A] text-white transition-all duration-200 hover:bg-[#9E6349] active:scale-[0.96] disabled:opacity-0 disabled:pointer-events-none"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
