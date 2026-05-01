import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, LogOut, MessageSquare, Settings, Download, Smile, BarChart2, Moon, Sun, Shield, Lightbulb, Home, ClipboardList } from "lucide-react";
import type { Session } from "@/types";
import { useNavigate } from "react-router-dom";
import { useThemeStore } from "@/store/theme";
import { useRenameSession } from "@/hooks/useSessions";

const PAGE_SIZE = 20;

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`(.*?)`/g, '$1');
}

interface SidebarProps {
  sessions: Session[];
  activeSessionId?: string;
  activeSessionSummary?: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onLogout: () => void;
  userName?: string;
  isAdmin?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  return (
    <button
      onClick={toggleTheme}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A]"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
    </button>
  );
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
  isAdmin,
  isOpen,
  onClose,
}: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const renameSession = useRenameSession();

  const visibleSessions = sessions.slice(0, visibleCount);
  const hasMore = visibleCount < sessions.length;

  const sidebar = (
    <div className="flex h-full flex-col bg-white dark:bg-[#352E2A]">
      <div className="flex items-center justify-between border-b border-[#E8DDD0] bg-[#FAF6F1] px-4 py-4 dark:border-[#4A4038] dark:bg-[#2A2420]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 overflow-hidden rounded-full">
            <img src="/illustrations/opt/ai_avatar.webp" alt="Ника" className="h-full w-full object-cover" />
          </div>
          <span className="font-serif text-xl font-bold text-[#5A5048] dark:text-[#F5EDE4]">Ника</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-[#8A7A6A] hover:bg-[#FAF6F1] dark:text-[#B8A898] dark:hover:bg-[#2A2420] lg:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-pill border border-dashed border-[#D8CDC0] px-4 py-3 text-sm font-medium text-[#8A7A6A] transition-colors hover:border-[#B8785A] hover:bg-[#FAF6F1] hover:text-[#B8785A] dark:border-[#4A4038] dark:text-[#B8A898] dark:hover:border-[#C08B68] dark:hover:bg-[#2A2420] dark:hover:text-[#C08B68]"
        >
          <Plus className="h-4 w-4" />
          Новый разговор
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <div className="space-y-1">
          {visibleSessions.map((session) => (
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
                    ? "bg-[#F5EDE4] text-[#B8785A] dark:bg-[#4A4038] dark:text-[#C08B68]"
                    : "text-[#5A5048] hover:bg-[#FAF6F1] dark:text-[#F5EDE4] dark:hover:bg-[#2A2420]"
                }`}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                {editingId === session.id ? (
                  <input
                    ref={editInputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => {
                      if (editTitle.trim() && editTitle.trim() !== (session.title || "")) {
                        renameSession.mutate({ id: session.id, title: editTitle.trim() });
                      }
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 truncate rounded border border-[#B8785A] bg-transparent px-1 text-sm text-[#5A5048] outline-none dark:text-[#F5EDE4]"
                    autoFocus
                  />
                ) : (
                  <span
                    className="flex-1 truncate"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingId(session.id);
                      setEditTitle(session.title || "");
                      setTimeout(() => editInputRef.current?.select(), 0);
                    }}
                  >
                    {session.title || "Новый разговор"}
                  </span>
                )}
                <div className="flex shrink-0 items-center gap-0.5">
                  {activeSessionId === session.id && (
                    <a
                      href={`/api/sessions/${session.id}/messages?limit=999&offset=0`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-md p-1 text-[#B8A898] hover:bg-[#F5EDE4] hover:text-[#B8785A]"
                      title="Экспорт"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {hoveredId === session.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="rounded-md p-1 text-[#B8A898] hover:bg-[#FDF5F3] hover:text-[#C4786A]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {hoveredId === session.id && session.summary && (
                <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-[#E8DDD0] dark:border-[#4A4038] bg-white dark:bg-[#352E2A] p-3 text-xs leading-relaxed text-[#8A7A6A] dark:text-[#B8A898] shadow-lg">
                  {stripMarkdown(session.summary.slice(0, 200))}
                  {session.summary.length > 200 ? "..." : ""}
                </div>
              )}
            </div>
          ))}
          {hasMore && (
            <button
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              className="w-full rounded-xl px-3 py-2 text-xs text-[#B8A898] transition-colors hover:bg-[#FAF6F1] hover:text-[#8A7A6A]"
            >
              Загрузить ещё ({sessions.length - visibleCount} осталось)
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-[#E8DDD0] p-4 dark:border-[#4A4038]">
        <div className="mb-3 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#B8785A] text-xs font-bold text-white">
            {(userName || "U")[0].toUpperCase()}
          </div>
          <span className="truncate text-sm font-medium text-[#5A5048] dark:text-[#F5EDE4]">{userName}</span>
        </div>
        <div className="space-y-1">
          <button
            onClick={() => navigate("/")}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A]"
          >
            <Home className="h-4 w-4" />
            Главная
          </button>
          <button
            onClick={() => navigate("/tests")}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A]"
          >
            <ClipboardList className="h-4 w-4" />
            Тесты
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A]"
          >
            <Settings className="h-4 w-4" />
            Профиль
          </button>
          <button
            onClick={() => navigate("/mood")}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A]"
          >
            <Smile className="h-4 w-4" />
            Настроение
          </button>
          <button
            onClick={() => navigate("/personality")}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A]"
          >
            <BarChart2 className="h-4 w-4" />
            Психопортрет
          </button>
          <button
            onClick={() => { window.location.href = "/#insights"; }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A]"
          >
            <Lightbulb className="h-4 w-4" />
            Поделиться мыслью
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A] transition-colors hover:bg-[#FAF6F1] hover:text-[#B8785A]"
            >
              <Shield className="h-4 w-4" />
              Админ
            </button>
          )}
          <ThemeToggle />
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
