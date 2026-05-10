import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-surface-100 px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-6">
          <div className="flex w-full flex-col items-center justify-between gap-6 sm:flex-row">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full">
                <img src="/illustrations/opt/ai_avatar.webp" alt="Ника" className="h-full w-full object-cover" />
              </div>
              <span className="font-serif text-lg font-bold text-surface-900">Ника</span>
            </Link>

            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-surface-500">
              <Link to="/pricing" className="hover:text-primary-600">Цены</Link>
              <Link to="/legal/offer" className="hover:text-primary-600">Оферта</Link>
              <Link to="/legal/refund" className="hover:text-primary-600">Возврат</Link>
              <Link to="/legal/privacy" className="hover:text-primary-600">Конфиденциальность</Link>
              <Link to="/legal/consent" className="hover:text-primary-600">Регулярные платежи</Link>
            </nav>

            <p className="text-sm text-surface-400">
              &copy; {new Date().getFullYear()} Ника
            </p>
          </div>

          <p className="max-w-2xl text-center text-[13px] leading-relaxed text-surface-500">
            Ника — заботливый собеседник, а не врач. В острых состояниях, при мыслях о самоповреждении или
            кризисе — пожалуйста, обратись к специалисту или на телефон доверия. А в остальное время — я рядом и
            помогу, насколько хватит сил, в любой час, без осуждения.
          </p>

          <div className="flex flex-col items-center gap-1 text-[12px] text-surface-400">
            <p>nika-talk.online</p>
            <p>
              <a href="mailto:keyjey.danilov@gmail.com" className="hover:text-primary-600">keyjey.danilov@gmail.com</a>
              {" · "}
              <a href="https://t.me/keyjey101" target="_blank" rel="noopener noreferrer" className="hover:text-primary-600">Telegram</a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
