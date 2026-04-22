import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Hero from "@/components/landing/Hero";
import Techniques from "@/components/landing/Techniques";

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 z-50 w-full border-b border-[#E8DDD0] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-serif text-xl font-bold text-[#5A5048]">
            Ника
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
                  Начать разговор
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        <Hero />
        <Techniques />
      </main>
    </div>
  );
}
