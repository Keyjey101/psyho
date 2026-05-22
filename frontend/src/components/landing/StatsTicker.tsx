const ITEMS = [
  "6 терапевтических подходов",
  "КПТ · ACT · IFS · Юнг · Нарративная · Соматика",
  "приватно и анонимно",
  "работает 24 / 7",
  "без осуждения",
  "без пароля",
  "доказательная база",
  "безопасное пространство",
];

const track = [...ITEMS, ...ITEMS];

export default function StatsTicker() {
  return (
    <div className="overflow-hidden border-y border-[#E8DDD0] bg-[#FAF6F1] py-3">
      <div
        className="flex whitespace-nowrap"
        style={{ animation: "marquee 32s linear infinite" }}
      >
        {track.map((item, i) => (
          <span
            key={i}
            className="mx-6 text-[11px] font-medium uppercase tracking-widest text-[#C4B0A0]"
          >
            {item}
            <span className="ml-6 text-[#D8CDC0]">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
