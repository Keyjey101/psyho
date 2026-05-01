import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Sparkles } from "lucide-react";
import api from "@/api/client";

const ROWS = 6;
const COLS = 5;
const TOTAL = ROWS * COLS;

const COLORS = [
  "#E8B4A0", "#B8D4A0", "#A0B8D4", "#D4A0B8", "#D4C8A0", "#A0D4C8",
];
const SPECIAL_COLOR = "#F5C84A"; // gold
const SPECIAL_CHANCE = 0.06;     // ~6% of newly spawned bubbles are golden

interface Bubble {
  popped: boolean;
  color: string;
  special: boolean;
  // monotonically-increasing key so React doesn't reuse stale animations when
  // a slot is repopulated with a fresh bubble.
  spawnId: number;
}

let _spawnCounter = 0;
function makeBubble(): Bubble {
  const special = Math.random() < SPECIAL_CHANCE;
  return {
    popped: false,
    color: special ? SPECIAL_COLOR : COLORS[Math.floor(Math.random() * COLORS.length)],
    special,
    spawnId: ++_spawnCounter,
  };
}

function makeGrid(): Bubble[] {
  return Array.from({ length: TOTAL }, () => makeBubble());
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

// More variation per pop: pitch, length, filter centre, gain are all randomised
// across a wider envelope. Combos and special bubbles get their own timbre.
function playPop(muted: boolean, opts: { combo?: number; special?: boolean } = {}) {
  if (muted) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const { combo = 0, special = false } = opts;

    const duration = 0.08 + Math.random() * 0.18 + Math.min(combo, 4) * 0.02;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < buf.length; i++) {
      const decay = Math.pow(1 - i / buf.length, 2 + Math.random() * 1.2);
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = special ? "bandpass" : "lowpass";
    // Wide spread: 250-1400 Hz base, +200Hz per combo step, +400Hz for golden bubble
    const baseFreq = 250 + Math.random() * 1150 + combo * 200 + (special ? 400 : 0);
    filter.frequency.value = baseFreq;
    filter.Q.value = 0.6 + Math.random() * 1.6;

    const gainVal = 0.10 + Math.random() * 0.16 + (special ? 0.08 : 0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    // Special bubble gets a sparkle ping on top
    if (special) {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200 + Math.random() * 400, ctx.currentTime);
      oscGain.gain.setValueAtTime(0.08, ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Web Audio not supported
  }
}

interface FloatingScore {
  id: number;
  index: number;
  text: string;
  color: string;
}

let _floatId = 0;

// Find all same-color non-popped bubbles connected (4-neighbour) to `start`.
function findConnectedGroup(grid: Bubble[], start: number): number[] {
  const target = grid[start];
  if (target.popped) return [];
  const visited = new Set<number>();
  const stack = [start];
  const out: number[] = [];
  while (stack.length) {
    const i = stack.pop()!;
    if (visited.has(i)) continue;
    visited.add(i);
    const b = grid[i];
    if (b.popped) continue;
    if (b.color !== target.color) continue;
    out.push(i);
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    if (col > 0) stack.push(i - 1);
    if (col < COLS - 1) stack.push(i + 1);
    if (row > 0) stack.push(i - COLS);
    if (row < ROWS - 1) stack.push(i + COLS);
  }
  return out;
}

export default function PopItGame() {
  const [bubbles, setBubbles] = useState<Bubble[]>(makeGrid);
  const [sessionScore, setSessionScore] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [muted, setMuted] = useState(false);
  const [floats, setFloats] = useState<FloatingScore[]>([]);
  const pendingRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushScore = useCallback(() => {
    if (pendingRef.current <= 0) return;
    const toSend = pendingRef.current;
    pendingRef.current = 0;
    api.post("/user/me/pop", { count: toSend }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (refillTimerRef.current) clearTimeout(refillTimerRef.current);
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      flushScore();
    };
  }, [flushScore]);

  // When the grid is fully popped, refill it (instead of waiting for a clean reset)
  // so the experience flows continuously.
  useEffect(() => {
    if (!bubbles.every((b) => b.popped)) return;
    refillTimerRef.current = setTimeout(() => setBubbles(makeGrid()), 700);
    return () => {
      if (refillTimerRef.current) clearTimeout(refillTimerRef.current);
    };
  }, [bubbles]);

  // Slowly trickle new bubbles into popped slots — keeps things alive even if
  // the player pops slowly.
  useEffect(() => {
    const interval = setInterval(() => {
      setBubbles((prev) => {
        const popped = prev
          .map((b, i) => (b.popped ? i : -1))
          .filter((i) => i !== -1);
        if (popped.length === 0) return prev;
        // Refill 1-3 bubbles at random
        const refillCount = Math.min(popped.length, 1 + Math.floor(Math.random() * 3));
        const next = [...prev];
        for (let n = 0; n < refillCount; n++) {
          const idx = popped[Math.floor(Math.random() * popped.length)];
          next[idx] = makeBubble();
        }
        return next;
      });
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const addFloat = useCallback((index: number, text: string, color: string) => {
    const id = ++_floatId;
    setFloats((f) => [...f, { id, index, text, color }]);
    setTimeout(() => {
      setFloats((f) => f.filter((x) => x.id !== id));
    }, 900);
  }, []);

  const pop = (i: number) => {
    setBubbles((prev) => {
      if (prev[i].popped) return prev;
      const group = findConnectedGroup(prev, i);
      if (group.length === 0) return prev;

      const isSpecial = prev[i].special;
      const groupSize = group.length;

      // Scoring: 1 point per bubble; +bonus for groups of 3+
      // Group bonus: 3 → ×1.5, 4 → ×2, 5+ → ×3
      // Special bubble pop: ×3 (regardless of group)
      let bonusMult = 1;
      if (groupSize >= 5) bonusMult = 3;
      else if (groupSize === 4) bonusMult = 2;
      else if (groupSize === 3) bonusMult = 1.5;
      if (isSpecial) bonusMult = Math.max(bonusMult * 3, 3);

      const earned = Math.round(groupSize * bonusMult);

      pendingRef.current += earned;
      setSessionScore((s) => s + earned);

      // Combo (chain pops within 1.5s of each other)
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      setComboCount((c) => c + 1);
      comboTimerRef.current = setTimeout(() => setComboCount(0), 1500);

      // Audio per bubble in the group, slightly staggered
      group.forEach((idx, n) => {
        setTimeout(() => playPop(muted, { combo: n, special: isSpecial }), n * 28);
      });

      // Floating score on the tapped bubble (the source)
      const floatColor = isSpecial ? "#B8785A" : groupSize >= 3 ? "#6B9E7A" : "#8A7A6A";
      addFloat(
        i,
        groupSize >= 3 || isSpecial ? `+${earned} ✨` : `+${earned}`,
        floatColor,
      );

      // Haptic feedback for combos
      if ((groupSize >= 3 || isSpecial) && navigator.vibrate) navigator.vibrate(15);

      // Mark the group as popped
      const next = prev.map((b, idx) => (group.includes(idx) ? { ...b, popped: true } : b));
      return next;
    });

    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flushScore, 2000);
  };

  return (
    <div className="flex flex-col items-center gap-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#8A7A6A] dark:text-[#B8A898]">Очки этой сессии:</span>
        <span className="text-lg font-semibold text-[#B8785A] dark:text-[#C08B68] tabular-nums">{sessionScore}</span>
        <AnimatePresence>
          {comboCount >= 2 && (
            <motion.span
              key={comboCount}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#FFEFD0] px-2 py-0.5 text-[11px] font-semibold text-[#B8785A] dark:bg-[#3E342B] dark:text-[#E8B47A]"
            >
              <Sparkles className="h-3 w-3" />
              x{comboCount}
            </motion.span>
          )}
        </AnimatePresence>
        <button
          onClick={() => setMuted((m) => !m)}
          className="ml-2 rounded-full p-1.5 text-[#8A7A6A] transition-colors hover:bg-[#F5EDE4] dark:text-[#B8A898] dark:hover:bg-[#4A4038]"
          title={muted ? "Включить звук" : "Выключить звук"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      <div
        className="relative grid w-full max-w-[300px] gap-3"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {bubbles.map((b, i) => (
          <div key={i} className="relative">
            <motion.button
              key={b.spawnId}
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
                  : b.special
                    ? `0 0 12px ${b.color}, 0 5px 10px rgba(0,0,0,0.18), inset 0 -2px 5px rgba(255,255,255,0.55)`
                    : "0 5px 10px rgba(0,0,0,0.14), inset 0 -2px 5px rgba(255,255,255,0.45)",
              }}
            >
              {b.special && !b.popped && (
                <Sparkles className="mx-auto h-4 w-4 text-white/80" />
              )}
            </motion.button>
            <AnimatePresence>
              {floats
                .filter((f) => f.index === i)
                .map((f) => (
                  <motion.span
                    key={f.id}
                    initial={{ opacity: 0, y: 0, scale: 0.8 }}
                    animate={{ opacity: 1, y: -32, scale: 1.1 }}
                    exit={{ opacity: 0, y: -50, scale: 0.9 }}
                    transition={{ duration: 0.85, ease: "easeOut" }}
                    className="pointer-events-none absolute inset-x-0 top-0 text-center text-[13px] font-semibold tabular-nums"
                    style={{ color: f.color }}
                  >
                    {f.text}
                  </motion.span>
                ))}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <p className="text-xs text-[#B8A898] dark:text-[#8A7A6A]">
        Лопай рядом стоящие одного цвета — за серии больше очков. Золотые — особые.
      </p>
    </div>
  );
}
