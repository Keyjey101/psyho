import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  children: React.ReactNode;
  effectiveDate?: string;
}

export default function LegalLayout({ title, children, effectiveDate }: Props) {
  return (
    <div className="min-h-dvh bg-[#FAF6F1] py-10 px-4 dark:bg-[#2A2420]">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#8A7A6A] hover:text-[#5A5048] dark:text-[#B8A898] dark:hover:text-[#E8DDD0]"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>
        <h1 className="mb-2 font-serif text-[28px] font-bold text-[#4A4038] dark:text-[#E8DDD0]">
          {title}
        </h1>
        {effectiveDate && (
          <p className="mb-8 text-[12px] text-[#8A7A6A] dark:text-[#B8A898]">
            Редакция от {effectiveDate}
          </p>
        )}
        <div className="space-y-4 text-[14px] leading-relaxed text-[#5A5048] dark:text-[#C8B8A8]">
          {children}
        </div>
        <div className="mt-12 border-t border-[#E8DDD0] pt-6 text-center text-[12px] text-[#8A7A6A] dark:border-[#3A302A] dark:text-[#B8A898]">
          <Link to="/legal/offer" className="mx-2 hover:underline">Оферта</Link>·
          <Link to="/legal/refund" className="mx-2 hover:underline">Возврат</Link>·
          <Link to="/legal/privacy" className="mx-2 hover:underline">Конфиденциальность</Link>·
          <Link to="/legal/consent" className="mx-2 hover:underline">Регулярные платежи</Link>
        </div>
      </div>
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-6 font-serif text-[18px] font-semibold text-[#4A4038] dark:text-[#E8DDD0]">
      {children}
    </h2>
  );
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-[#F5EDE4] px-1 font-mono text-[12px] text-[#8A7A6A] dark:bg-[#3A302A] dark:text-[#B8A898]">
      {children}
    </span>
  );
}
