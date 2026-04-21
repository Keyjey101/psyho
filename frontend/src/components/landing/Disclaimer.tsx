import { motion } from "framer-motion";
import { AlertTriangle, Phone } from "lucide-react";

export default function Disclaimer() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-amber-200 bg-amber-50/50 p-8"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-surface-900">
              Важная информация
            </h3>
          </div>

          <p className="mb-4 text-surface-700 leading-relaxed">
            PsyHo — это ИИ-помощник, который <strong>не заменяет</strong> профессиональную психологическую или психиатрическую помощь.
            Если ты находишься в кризисной ситуации — пожалуйста, обратись к специалистам.
          </p>

          <div className="space-y-3 rounded-xl bg-white/80 p-4">
            <p className="text-sm font-semibold text-surface-800">Экстренные контакты:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href="tel:88003334434"
                className="flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700 transition-colors hover:bg-surface-50"
              >
                <Phone className="h-4 w-4 text-primary-500" />
                8-800-333-44-34
              </a>
              <a
                href="tel:88002000122"
                className="flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700 transition-colors hover:bg-surface-50"
              >
                <Phone className="h-4 w-4 text-primary-500" />
                8-800-2000-122
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
