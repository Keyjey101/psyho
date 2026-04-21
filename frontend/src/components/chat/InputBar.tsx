import { useState, useRef, useEffect } from "react";
import { Send, CornerDownLeft } from "lucide-react";
import VoiceInput from "./VoiceInput";

interface InputBarProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export default function InputBar({ onSend, disabled }: InputBarProps) {
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

  return (
    <div className="border-t border-surface-100 bg-white px-4 py-4 lg:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-3">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напиши, что тебя беспокоит..."
              disabled={disabled}
              rows={1}
              className="input-field resize-none pr-10 py-3 max-h-40"
            />
            <div className="absolute right-3 bottom-2.5 flex items-center gap-1 text-xs text-surface-400">
              <CornerDownLeft className="h-3 w-3" />
            </div>
          </div>
          <VoiceInput onTranscript={(text) => setContent((prev) => prev ? prev + " " + text : text)} disabled={disabled} />
          <button
            onClick={handleSubmit}
            disabled={disabled || !content.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
