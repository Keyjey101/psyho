import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20">
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, #FAF6F1, #F3EBE3)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 mx-auto max-w-[480px] text-center"
      >
        <div className="mx-auto mb-8 flex h-[200px] w-[200px] items-center justify-center sm:h-[280px] sm:w-[280px]">
          <img
            src="/illustrations/opt/landing_hero.webp"
            alt=""
            className="h-full w-full object-contain"
            onError={(e) => { e.currentTarget.src = "/illustrations/landing_hero.png" }}
          />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#4A4038] sm:text-[28px]">
          Поговорим?
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-[1.6] text-[#8A7A6A]">
          Безопасное пространство, где тебя выслушают и поймут
        </p>

        <div className="mt-8">
          <Link
            to="/auth"
            className="btn-primary inline-block w-full max-w-[320px]"
          >
            Начать разговор
          </Link>
        </div>

        <p className="mt-8 text-xs text-[#B8A898]">
          Бесплатно · Без карты · Без обязательств
        </p>
      </motion.div>
    </section>
  );
}
