import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-surface-100 px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-bold text-white">
              P
            </div>
            <span className="text-lg font-bold text-surface-900">
              Psy<span className="text-primary-600">Ho</span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-surface-500">
            <Link to="/pricing" className="hover:text-primary-600">Цены</Link>
            <Link to="/legal/offer" className="hover:text-primary-600">Оферта</Link>
            <Link to="/legal/refund" className="hover:text-primary-600">Возврат</Link>
            <Link to="/legal/privacy" className="hover:text-primary-600">Конфиденциальность</Link>
            <Link to="/legal/consent" className="hover:text-primary-600">Регулярные платежи</Link>
          </nav>

          <p className="text-sm text-surface-400">
            &copy; {new Date().getFullYear()} PsyHo. Не заменяет профессиональную помощь.
          </p>
        </div>
      </div>
    </footer>
  );
}
