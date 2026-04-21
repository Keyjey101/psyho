import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle, Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden px-6 pt-20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/80 via-white to-warm-50/50" />
      <div className="absolute -top-40 right-0 h-[600px] w-[600px] rounded-full bg-primary-100/40 blur-3xl" />
      <div className="absolute -bottom-40 -left-20 h-[400px] w-[400px] rounded-full bg-warm-100/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl lg:flex lg:items-center lg:gap-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl lg:flex-1"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700">
            <Sparkles className="h-4 w-4" />
            ИИ-психолог нового поколения
          </div>

          <h1 className="mb-6 text-5xl leading-tight font-extrabold tracking-tight text-surface-900 sm:text-6xl lg:text-7xl">
            Поговори с тем, кто{" "}
            <span className="bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
              всегда выслушает
            </span>
          </h1>

          <p className="mb-10 max-w-lg text-lg leading-relaxed text-surface-600 sm:text-xl">
            Мультиагентная ИИ-система, которая подберёт подходящий терапевтический подход под твою ситуацию.
            КПТ, юнгианский анализ, ACT, IFS и другие — в одном чате.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link to="/register" className="btn-primary text-base px-8 py-4">
              <MessageCircle className="h-5 w-5" />
              Начать бесплатно
            </Link>
            <a href="#how-it-works" className="btn-secondary text-base px-8 py-4">
              Узнать больше
            </a>
          </div>

          <div className="mt-12 flex items-center gap-8 text-sm text-surface-500">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              Доступно 24/7
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary-500" />
              6 подходов
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-warm-500" />
              Конфиденциально
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-16 hidden lg:block lg:flex-1"
        >
          <div className="relative">
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold">
                  P
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-900">PsyHo</p>
                  <p className="text-xs text-surface-400">ИИ-терапевт</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl rounded-tl-md bg-surface-100 px-4 py-3 text-sm text-surface-700 max-w-[85%]">
                  Привет! Я чувствую тревогу перед важной презентацией...
                </div>
                <div className="ml-auto max-w-[85%] space-y-2">
                  <div className="rounded-2xl rounded-tr-md bg-primary-600 px-4 py-3 text-sm text-white">
                    Я слышу тебя. Тревога перед выступлением — очень распространённое переживание, и это абсолютно нормально.
                  </div>
                  <div className="flex gap-1.5">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">🧠 КПТ</span>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-600">🌿 Соматика</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
