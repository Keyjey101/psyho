import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import VoiceInput from "./VoiceInput";
import ActionPanel from "./ActionPanel";

interface InputBarProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  sessionId?: string;
}

const MAX_LENGTH = 4000;
const COUNTER_THRESHOLD = 2000;

export default function InputBar({ onSend, disabled, sessionId }: InputBarProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= MAX_LENGTH) {
      setContent(e.target.value);
    }
  };

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

  const charCount = content.length;
  const hasContent = content.trim().length > 0;
  const isNearLimit = charCount > 3800;
  const showCounter = charCount >= COUNTER_THRESHOLD;

  return (
    <div
      className="border-t border-[#E8DDD0] bg-white px-4 pt-3 lg:px-6"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2">
          <ActionPanel sessionId={sessionId} disabled={disabled} />
          <div className="flex flex-1 items-center gap-2 rounded-[24px] border border-[#D8CDC0] bg-white px-4 py-2">
            <VoiceInput
              onTranscript={(text) => setContent((prev) => {
                const next = prev ? prev + " " + text : text;
                return next.slice(0, MAX_LENGTH);
              })}
              disabled={disabled}
            />
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Напиши что угодно..."
              disabled={disabled}
              rows={1}
              className="flex-1 resize-none border-0 bg-transparent py-1 text-sm text-[#5A5048] placeholder:italic placeholder:text-[#B8A898] focus:outline-none focus:ring-0 max-h-40"
            />
            <div className="flex shrink-0 flex-col items-end gap-1">
              {showCounter && (
                <span className={`text-[11px] tabular-nums ${isNearLimit ? "text-red-500" : "text-[#B8A898]"}`}>
                  {charCount} / {MAX_LENGTH}
                </span>
              )}
              <button
                onClick={handleSubmit}
                disabled={disabled || !hasContent}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#B8785A] text-white transition-all duration-200 hover:bg-[#9E6349] active:scale-[0.96] disabled:opacity-0 disabled:pointer-events-none"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
