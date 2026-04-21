import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, LogOut, MessageSquare } from "lucide-react";
import type { Session } from "@/types";

interface SidebarProps {
  sessions: Session[];
  activeSessionId?: string;
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
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onLogout,
  userName,
  isOpen,
  onClose,
}: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const sidebar = (
    <div className="flex h-full flex-col bg-surface-900">
      <div className="flex items-center justify-between border-b border-surface-700 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white">
            P
          </div>
          <span className="font-bold text-white">
            Psy<span className="text-primary-400">Ho</span>
          </span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 lg:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-surface-600 px-4 py-3 text-sm font-medium text-surface-300 transition-colors hover:border-primary-500 hover:bg-surface-800 hover:text-primary-400"
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
              className={`group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                activeSessionId === session.id
                  ? "bg-surface-800 text-white"
                  : "text-surface-400 hover:bg-surface-800 hover:text-surface-200"
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
                  className="shrink-0 rounded-md p-1 text-surface-500 hover:bg-red-900/30 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-surface-700 p-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
            {(userName || "U")[0].toUpperCase()}
          </div>
          <span className="truncate text-sm font-medium text-surface-300">{userName}</span>
        </div>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-surface-400 transition-colors hover:bg-surface-800 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
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
