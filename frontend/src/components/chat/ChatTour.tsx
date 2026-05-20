import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Plus,
  MessageSquare,
  Settings,
  BarChart2,
  Home,
  Smile,
  Lightbulb,
} from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  description: string;
  needsSidebar?: boolean;
}

const STEPS: TourStep[] = [
  {
    target: "session-progress",
    title: "Счётчик сессии",
    description:
      "У каждой сессии лимит обменов — это помогает разговору оставаться сфокусированным. Прогресс отображается здесь. Когда лимит достигнут, можно начать новую сессию.",
  },
  {
    target: "actions-toggle",
    title: "Панель действий",
    description:
      "Нажми, чтобы открыть: 💡 инсайт о разговоре, 📝 практическое упражнение, 🧘 дыхательная практика, 🎮 отвлечься. Доступно в любой момент диалога.",
  },
  {
    target: "burger-menu",
    title: "Меню",
    description:
      "Здесь история твоих диалогов и навигация. На большом экране меню всегда открыто слева.",
  },
  {
    target: "new-chat",
    title: "Новый разговор",
    description:
      "Каждая тема — отдельная сессия. Ника помнит контекст каждого разговора, и к любому можно вернуться.",
    needsSidebar: true,
  },
  {
    target: "profile-btn",
    title: "Профиль",
    description:
      "Настрой стиль общения Ники: мягкий, прямой или сбалансированный. Также здесь хранятся твои цели и предпочтения.",
    needsSidebar: true,
  },
  {
    target: "personality-btn",
    title: "Психопортрет",
    description:
      "Ника анализирует разговоры и строит модель твоей личности: самосознание, эмоциональная регуляция, ценности и другие параметры. Обновляется с каждой сессией.",
    needsSidebar: true,
  },
];

const PADDING = 10;
const LOCAL_STORAGE_KEY = "nika_tour_done";

const MOCK_SESSIONS = ["Тревога на работе", "Отношения с близкими"];

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ChatTourProps {
  onComplete: () => void;
  onRequestSidebarOpen: () => void;
  onRequestSidebarClose: () => void;
}

function MockSidebar() {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#352E2A]">
      <div className="flex items-center gap-2 border-b border-[#E8DDD0] bg-[#FAF6F1] px-4 py-4 dark:border-[#4A4038] dark:bg-[#2A2420]">
        <div className="flex h-8 w-8 overflow-hidden rounded-full">
          <img
            src="/illustrations/opt/ai_avatar.webp"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <span className="font-serif text-xl font-bold text-[#5A5048] dark:text-[#F5EDE4]">
          Ника
        </span>
      </div>

      <div className="p-3">
        <button
          data-tour="new-chat"
          className="flex w-full items-center gap-2 rounded-[24px] border border-dashed border-[#D8CDC0] px-4 py-3 text-sm font-medium text-[#8A7A6A] dark:border-[#4A4038] dark:text-[#B8A898]"
        >
          <Plus className="h-4 w-4" />
          Новый разговор
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <div className="space-y-1">
          {MOCK_SESSIONS.map((title) => (
            <div
              key={title}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#5A5048] dark:text-[#F5EDE4]"
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="truncate">{title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#E8DDD0] p-4 dark:border-[#4A4038]">
        <div className="mb-3 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#B8785A] text-xs font-bold text-white">
            Н
          </div>
          <span className="truncate text-sm font-medium text-[#5A5048] dark:text-[#F5EDE4]">
            Пользователь
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A]">
            <Home className="h-4 w-4" />
            Главная
          </div>
          <div className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A]">
            <Smile className="h-4 w-4" />
            Настроение
          </div>
          <button
            data-tour="profile-btn"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A]"
          >
            <Settings className="h-4 w-4" />
            Профиль
          </button>
          <button
            data-tour="personality-btn"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A]"
          >
            <BarChart2 className="h-4 w-4" />
            Психопортрет
          </button>
          <div className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-[#8A7A6A]">
            <Lightbulb className="h-4 w-4" />
            Поделиться мыслью
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatTour({
  onComplete,
  onRequestSidebarOpen,
  onRequestSidebarClose,
}: ChatTourProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const measureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  const measureTarget = useCallback((target: string) => {
    if (measureTimer.current) clearTimeout(measureTimer.current);
    measureTimer.current = setTimeout(() => {
      const el = document.querySelector(
        `[data-tour="${target}"]`
      ) as HTMLElement | null;
      if (!el || el.offsetParent === null) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) {
        setRect(null);
        return;
      }
      setRect({ x: r.x, y: r.y, width: r.width, height: r.height });
    }, 350);
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(delay);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    if (current.needsSidebar && !isMobile) {
      onRequestSidebarOpen();
    }
    measureTarget(current.target);
  }, [step, visible, measureTarget, onRequestSidebarOpen, isMobile]);

  useEffect(() => {
    const handleResize = () => measureTarget(STEPS[step].target);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [step, measureTarget]);

  useEffect(() => {
    return () => {
      if (measureTimer.current) clearTimeout(measureTimer.current);
    };
  }, []);

  const complete = useCallback(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, "1");
    onRequestSidebarClose();
    onComplete();
  }, [onComplete, onRequestSidebarClose]);

  const goNext = () => {
    if (step < STEPS.length - 1) {
      const next = step + 1;
      setRect(null);
      if (STEPS[step].needsSidebar && !STEPS[next].needsSidebar && !isMobile) {
        onRequestSidebarClose();
      }
      setStep(next);
    } else {
      complete();
    }
  };

  const goPrev = () => {
    if (step > 0) {
      const prev = step - 1;
      setRect(null);
      if (STEPS[step].needsSidebar && !STEPS[prev].needsSidebar && !isMobile) {
        onRequestSidebarClose();
      }
      setStep(prev);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") complete();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft" && step > 0) goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, complete]);

  if (!visible) return null;

  const current = STEPS[step];
  const hasRect = rect !== null;
  const showMockSidebar = isMobile && current.needsSidebar;

  const ox = hasRect ? rect.x - PADDING : 0;
  const oy = hasRect ? rect.y - PADDING : 0;
  const ow = hasRect ? rect.width + PADDING * 2 : 0;
  const oh = hasRect ? rect.height + PADDING * 2 : 0;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0"
        style={{ zIndex: 200 }}
        aria-modal="true"
        role="dialog"
      >
        {showMockSidebar ? (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(2px)",
              }}
            />
            <motion.div
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-72"
              style={{ zIndex: 206 }}
            >
              <MockSidebar />
            </motion.div>
            {hasRect && (
              <motion.div
                key={`ring-${step}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                style={{
                  position: "fixed",
                  top: oy - 2,
                  left: ox - 2,
                  width: ow + 4,
                  height: oh + 4,
                  borderRadius: 14,
                  border: "2px solid #B8785A",
                  boxShadow:
                    "0 0 0 4px rgba(184,120,90,0.2), 0 0 20px rgba(184,120,90,0.15)",
                  pointerEvents: "none",
                  zIndex: 208,
                }}
              />
            )}
          </>
        ) : hasRect ? (
          <>
            <div
              className="absolute left-0 right-0 top-0"
              style={{
                height: Math.max(0, oy),
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(3px)",
                pointerEvents: "all",
              }}
            />
            <div
              className="absolute left-0 right-0 bottom-0"
              style={{
                top: oy + oh,
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(3px)",
                pointerEvents: "all",
              }}
            />
            <div
              className="absolute left-0"
              style={{
                top: oy,
                width: Math.max(0, ox),
                height: oh,
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(3px)",
                pointerEvents: "all",
              }}
            />
            <div
              className="absolute right-0"
              style={{
                top: oy,
                left: ox + ow,
                height: oh,
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(3px)",
                pointerEvents: "all",
              }}
            />
            <motion.div
              key={`ring-${step}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              style={{
                position: "fixed",
                top: oy - 2,
                left: ox - 2,
                width: ow + 4,
                height: oh + 4,
                borderRadius: 14,
                border: "2px solid #B8785A",
                boxShadow:
                  "0 0 0 4px rgba(184,120,90,0.2), 0 0 20px rgba(184,120,90,0.15)",
                pointerEvents: "none",
                zIndex: 205,
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(3px)",
              pointerEvents: "all",
            }}
          />
        )}

        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 210, pointerEvents: "none" }}
        >
          <motion.div
            key={`card-${step}`}
            initial={{ opacity: 0, scale: 0.93, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#352E2A]"
            style={{
              pointerEvents: "all",
              marginLeft: showMockSidebar ? 288 : 0,
              maxWidth: showMockSidebar
                ? "calc(100vw - 288px - 2rem)"
                : undefined,
            }}
          >
            <button
              onClick={complete}
              className="absolute right-4 top-4 rounded-lg p-1 text-[#B8A898] transition-colors hover:bg-[#F5EDE4] hover:text-[#5A5048] dark:hover:bg-[#4A4038] dark:hover:text-[#F5EDE4]"
              aria-label="Пропустить"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="mb-2 pr-6 text-[17px] font-semibold leading-snug text-[#5A5048] dark:text-[#F5EDE4]">
              {current.title}
            </h2>

            <p className="text-[14px] leading-[1.65] text-[#8A7A6A] dark:text-[#B8A898]">
              {current.description}
            </p>

            <div className="mt-5 flex items-center justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-200 ${
                    i === step
                      ? "h-2 w-6 bg-[#B8785A]"
                      : i < step
                      ? "h-2 w-2 bg-[#D8CDC0] dark:bg-[#6A5A4A]"
                      : "h-2 w-2 bg-[#E8DDD0] dark:bg-[#4A4038]"
                  }`}
                />
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={complete}
                className="shrink-0 rounded-xl px-3 py-2 text-[13px] text-[#B8A898] transition-colors hover:bg-[#F5EDE4] hover:text-[#8A7A6A] dark:hover:bg-[#4A4038]"
              >
                Пропустить
              </button>
              <div className="flex flex-1 justify-end gap-2">
                {step > 0 && (
                  <button
                    onClick={goPrev}
                    className="flex items-center gap-1 rounded-xl border border-[#E8DDD0] px-4 py-2 text-[13px] font-medium text-[#8A7A6A] transition-colors hover:bg-[#F5EDE4] dark:border-[#4A4038] dark:hover:bg-[#4A4038]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Назад
                  </button>
                )}
                <button
                  onClick={goNext}
                  className="flex items-center gap-1.5 rounded-xl bg-[#B8785A] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#9E6349] active:scale-[0.97]"
                >
                  {step < STEPS.length - 1 ? (
                    <>
                      Далее
                      <ChevronRight className="h-4 w-4" />
                    </>
                  ) : (
                    "Готово!"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
