import { Phone } from "lucide-react";

export interface CrisisContact {
  title: string;
  phone: string;
  note?: string;
}

export interface CrisisInfo {
  headline: string;
  body: string;
  contacts: CrisisContact[];
}

/**
 * Live crisis helplines, shown when a result lands in a heavy zone or the
 * self-harm item was answered above zero.
 *
 * Placement is a requirement, not a style choice (ТЗ §2.4): this block renders
 * **above** the CTA into the bot and is visually louder than it — larger type,
 * high-contrast border, tappable `tel:` links. Whenever it is visible, the
 * screen offers no purchase or credit-spend of any kind.
 *
 * The decision to render it comes from the backend (`services/test_safety.py`),
 * so a stale client can't skip it.
 */
export default function CrisisResources({ info }: { info: CrisisInfo }) {
  return (
    <section
      role="alert"
      className="mb-6 rounded-3xl border-2 border-[#C2554A] bg-[#FFF4F1] p-6 dark:border-[#E0776A] dark:bg-[#3E2A2A]"
    >
      <h2 className="mb-2 font-serif text-[22px] font-bold leading-snug text-[#9B3B30] dark:text-[#F0A79B]">
        {info.headline}
      </h2>
      <p className="mb-5 text-[15px] leading-relaxed text-[#5A5048] dark:text-[#E8DDD0]">
        {info.body}
      </p>

      <ul className="space-y-2.5">
        {info.contacts.map((contact) => (
          <li key={contact.phone}>
            <a
              href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
              className="flex items-center gap-3 rounded-2xl border border-[#E5B7B0] bg-white px-4 py-3.5 transition-colors hover:bg-[#FFF9F8] dark:border-[#6A4A44] dark:bg-[#352E2A] dark:hover:bg-[#4A4038]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C2554A] text-white">
                <Phone className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-bold tabular-nums text-[#4A4038] dark:text-[#F5EDE4]">
                  {contact.phone}
                </span>
                <span className="block text-[12.5px] text-[#8A7A6A] dark:text-[#B8A898]">
                  {contact.title}
                  {contact.note ? ` · ${contact.note}` : ""}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[12.5px] leading-relaxed text-[#8A7A6A] dark:text-[#B8A898]">
        Там отвечают живые люди — бесплатно, круглосуточно и анонимно.
        Позвонить можно, даже если кажется, что «повод недостаточно серьёзный».
      </p>
    </section>
  );
}
