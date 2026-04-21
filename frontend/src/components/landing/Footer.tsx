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

          <p className="text-sm text-surface-400">
            &copy; {new Date().getFullYear()} PsyHo. Не заменяет профессиональную помощь.
          </p>
        </div>
      </div>
    </footer>
  );
}
