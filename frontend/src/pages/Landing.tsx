import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import Specialists from "@/components/landing/Specialists";
import HowItWorks from "@/components/landing/HowItWorks";
import Principles from "@/components/landing/Principles";
import Disclaimer from "@/components/landing/Disclaimer";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-50 via-white to-surface-50">
      <nav className="fixed top-0 z-50 w-full border-b border-surface-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-lg text-white shadow-md">
              P
            </div>
            <span className="text-xl font-bold text-surface-900">
              Psy<span className="text-primary-600">Ho</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/chat" className="btn-primary">
                Открыть чат
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">
                  Войти
                </Link>
                <Link to="/register" className="btn-primary">
                  Начать бесплатно
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        <Hero />
        <HowItWorks />
        <Specialists />
        <Features />
        <Principles />
        <Disclaimer />
        <CTA />
      </main>

      <Footer />
    </div>
  );
}
