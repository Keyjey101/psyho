import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

interface ActionResultOverlayProps {
  title: string;
  content: string | null;
  isLoading: boolean;
  onClose: () => void;
}

export default function ActionResultOverlay({
  title,
  content,
  isLoading,
  onClose,
}: ActionResultOverlayProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative w-full max-w-lg rounded-t-[28px] bg-white px-6 pb-8 pt-6 shadow-2xl sm:rounded-[28px]"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-[#B8A898] hover:bg-[#F5EDE4]"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="mb-5 text-center text-[16px] font-semibold text-[#5A5048]">{title}</h2>

          {isLoading ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E8DDD0] border-t-[#B8785A]" />
              <p className="text-sm text-[#8A7A6A]">Готовлю для тебя...</p>
              <button
                onClick={onClose}
                className="mt-2 text-sm text-[#B8A898] hover:text-[#8A7A6A]"
              >
                Отмена
              </button>
            </div>
          ) : (
            <div className="markdown-content max-h-[60vh] overflow-y-auto text-[15px] leading-relaxed text-[#5A5048]">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content || ""}</ReactMarkdown>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
