import { useState, useCallback, useEffect, useRef } from "react";
import api from "@/api/client";

const ROWS = 5;
const COLS = 6;
const TOTAL = ROWS * COLS;

const COLORS = [
  "#E8B4A0", "#B8D4A0", "#A0B8D4", "#D4A0B8", "#D4C8A0", "#A0D4C8",
];

function makeGrid() {
  return Array.from({ length: TOTAL }, (_, i) => ({
    popped: false,
    color: COLORS[i % COLORS.length],
  }));
}

export default function PopItGame() {
  const [bubbles, setBubbles] = useState(makeGrid);
  const [sessionScore, setSessionScore] = useState(0);
  const pendingRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushScore = useCallback(() => {
    if (pendingRef.current <= 0) return;
    const toSend = pendingRef.current;
    pendingRef.current = 0;
    api.post("/user/me/pop", { count: toSend }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      flushScore();
    };
  }, [flushScore]);

  const allPopped = bubbles.every((b) => b.popped);

  useEffect(() => {
    if (!allPopped) return;
    const t = setTimeout(() => setBubbles(makeGrid()), 600);
    return () => clearTimeout(t);
  }, [allPopped]);

  const pop = (i: number) => {
    if (bubbles[i].popped) return;
    setBubbles((prev) => prev.map((b, idx) => (idx === i ? { ...b, popped: true } : b)));
    setSessionScore((s) => s + 1);
    pendingRef.current += 1;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushScore, 2000);
  };

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#8A7A6A]">Очки этой сессии:</span>
        <span className="text-lg font-semibold text-[#B8785A]">{sessionScore}</span>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {bubbles.map((b, i) => (
          <button
            key={i}
            onClick={() => pop(i)}
            className="rounded-full transition-all duration-150 active:scale-95"
            style={{
              width: 44,
              height: 44,
              background: b.popped
                ? "rgba(0,0,0,0.08)"
                : b.color,
              boxShadow: b.popped
                ? "inset 0 3px 6px rgba(0,0,0,0.18)"
                : "0 4px 8px rgba(0,0,0,0.12), inset 0 -2px 4px rgba(255,255,255,0.4)",
              transform: b.popped ? "scale(0.88)" : "scale(1)",
            }}
          />
        ))}
      </div>

      <p className="text-xs text-[#B8A898]">Нажимай на пузыри — они лопаются!</p>
    </div>
  );
}
