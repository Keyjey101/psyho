import { motion } from "framer-motion";
import { Lock, Heart, Globe } from "lucide-react";

const principles = [
  {
    icon: Lock,
    title: "Конфиденциальность",
    description: "Все данные защищены шифрованием. Мы не читаем твои сообщения и не передаём их третьим лицам.",
  },
  {
    icon: Heart,
    title: "Без осуждения",
    description: "Терапевтическое пространство, где ты можешь быть собой. Принятие и эмпатия — основа каждого диалога.",
  },
  {
    icon: Globe,
    title: "Доступно 24/7",
    description: "Не нужно ждать записи на приём. PsyHo здесь, когда тебе это нужно — днём, ночью, в выходные.",
  },
];

export default function Principles() {
  return (
    <section className="px-6 py-24 bg-surface-900">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            Наши принципы
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-surface-400">
            Мы серьёзно относимся к твоему опыту
          </p>
        </motion.div>

        <div className="grid gap-8 sm:grid-cols-3">
          {principles.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-primary-400">
                <p.icon className="h-8 w-8" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">{p.title}</h3>
              <p className="leading-relaxed text-surface-400">{p.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
