import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, LogOut, MessageSquare, Settings } from "lucide-react";
import type { Session } from "@/types";
import { useNavigate } from "react-router-dom";

interface SidebarProps {
  sessions: Session[];
  activeSessionId?: string;
  activeSessionSummary?: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onLogout: () => void;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  activeSessionSummary,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onLogout,
  userName,
  isOpen,
  onClose,
}: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const navigate = useNavigate();

  const sidebar = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-[#E8DDD0] bg-[#FAF6F1] px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 overflow-hidden rounded-full">
            <img src="/illustrations/opt/ai_avatar.webp" alt="Ника" className="h-full w-full object-cover" />
          </div>
          <span className="font-serif text-xl font-bold text-[#5A5048]">Ника</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-[#8A7A6A] hover:bg-[#FAF6F1] lg:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-pill border border-dashed border-[#D8CDC0] px-4 py-3 text-sm font-medium text-[#8A7A6A] transition-colors hover:border-[#B8785A] hover:bg-[#FAF6F1] hover:text-[#B8785A]"
        >
          <Plus className="h-4 w-4" />
          Новый разговор
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <div className="space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelectSession(session.id)}
              className="group relative cursor-pointer"
            >
              <div
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  activeSessionId === session.id
                    ? "bg-[#F5EDE4] text-[#B8785A]"
                    : "text-[#5A5048] hover:bg-[#FAF6F1]"
                }`}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{session.title || "Новый разговор"}</span>
                {hoveredId === session.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="shrink-0 rounded-md p-1 text-[#B8A898] hover:bg-[#FDF5F3] hover:text-[#C4786A]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {hoveredId === session.id && session.summary && (
                <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-[#E8DDD0] bg-white p-3 text-xs leading-relaxed text-[#8A7A6A] shadow-lg">
                  {session.summary.slice(0, 200)}
                  {session.summary.length > 200 ? "..." : ""}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#E8DDD0] p-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#B8785A] text-xs font-bold text-white">
            {(userName || "U")[0].toUpperCase()}
          </div>
          <span className="truncate text-sm font-medium text-[#5A5048]">{userName}</span>
        </div>
        <div className="space-y-1">
          <button
            onClick={() => navigate("/profile")}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A]"
          >
            <Settings className="h-4 w-4" />
            Профиль
          </button>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A] transition-colors hover:bg-[#FDF5F3] hover:text-[#C4786A]"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden w-72 shrink-0 lg:block">{sidebar}</div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            <motion.div
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden"
            >
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
