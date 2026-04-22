import { useState } from "react";
import { Download, FileText, X } from "lucide-react";
import type { Message } from "@/types";

interface ExportChatProps {
  messages: Message[];
  sessionTitle?: string | null;
}

export default function ExportChat({ messages, sessionTitle }: ExportChatProps) {
  const [isOpen, setIsOpen] = useState(false);

  const exportTXT = () => {
    const lines = messages.map((m) => {
      const role = m.role === "user" ? "Вы" : "Ника";
      return `[${new Date(m.created_at).toLocaleString("ru-RU")}] ${role}:\n${m.content}\n`;
    });
    const text = `${sessionTitle || "Чат с Никой"}\n${"=".repeat(40)}\n\n${lines.join("\n")}`;
    downloadFile(text, "chat.txt", "text/plain");
    setIsOpen(false);
  };

  const exportJSON = () => {
    const data = JSON.stringify({ title: sessionTitle, messages }, null, 2);
    downloadFile(data, "chat.json", "application/json");
    setIsOpen(false);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
        title="Экспорт истории"
      >
        <Download className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-surface-900">Экспорт чата</h3>
              <button onClick={() => setIsOpen(false)} className="rounded-lg p-1 text-surface-400 hover:bg-surface-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <button onClick={exportTXT} className="btn-secondary w-full">
                <FileText className="h-4 w-4" />
                Скачать как TXT
              </button>
              <button onClick={exportJSON} className="btn-secondary w-full">
                <Download className="h-4 w-4" />
                Скачать как JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
