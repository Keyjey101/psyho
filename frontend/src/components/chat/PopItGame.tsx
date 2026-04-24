import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import api from "@/api/client";

const ROWS = 6;
const COLS = 5;
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

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx || _audioCtx.state === "closed") {
      _audioCtx = new AudioContext();
    }
    return _audioCtx;
  } catch {
    return null;
  }
}

function playPop(muted: boolean) {
  if (muted) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const duration = 0.12 + Math.random() * 0.04;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < buf.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / buf.length, 3);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500 + Math.random() * 200;

    const gainVal = 0.14 + Math.random() * 0.08;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch {
    // Web Audio not supported
  }
}

export default function PopItGame() {
  const [bubbles, setBubbles] = useState(makeGrid);
  const [sessionScore, setSessionScore] = useState(0);
  const [muted, setMuted] = useState(false);
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
    playPop(muted);
    setBubbles((prev) => prev.map((b, idx) => (idx === i ? { ...b, popped: true } : b)));
    setSessionScore((s) => s + 1);
    pendingRef.current += 1;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flushScore, 2000);
  };

  return (
    <div className="flex flex-col items-center gap-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#8A7A6A]">Очки этой сессии:</span>
        <span className="text-lg font-semibold text-[#B8785A]">{sessionScore}</span>
        <button
          onClick={() => setMuted((m) => !m)}
          className="ml-2 rounded-full p-1.5 text-[#8A7A6A] hover:bg-[#F5EDE4] transition-colors"
          title={muted ? "Включить звук" : "Выключить звук"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      <div
        className="grid w-full max-w-[300px] gap-3"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {bubbles.map((b, i) => (
          <motion.button
            key={i}
            onClick={() => pop(i)}
            animate={
              b.popped
                ? { scale: [1, 1.22, 0.82], opacity: [1, 1, 0.45] }
                : { scale: 1, opacity: 1 }
            }
            transition={{ duration: 0.22, times: [0, 0.28, 1], ease: "easeOut" }}
            className="rounded-full"
            style={{
              width: 52,
              height: 52,
              background: b.popped ? "rgba(0,0,0,0.08)" : b.color,
              boxShadow: b.popped
                ? "inset 0 3px 6px rgba(0,0,0,0.18)"
                : "0 5px 10px rgba(0,0,0,0.14), inset 0 -2px 5px rgba(255,255,255,0.45)",
            }}
          />
        ))}
      </div>

      <p className="text-xs text-[#B8A898]">Нажимай на пузыри — они лопаются!</p>
    </div>
  );
}
