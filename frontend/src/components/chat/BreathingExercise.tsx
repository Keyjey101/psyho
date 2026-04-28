import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Phase = { label: string; duration: number; color: string };
type ShapeType = "triangle" | "square" | "circle";

interface Exercise {
  name: string;
  desc: string;
  shape: ShapeType;
  phases: Phase[];
}

const EXERCISES: Exercise[] = [
  {
    name: "Треугольник",
    desc: "Классическое расслабляющее дыхание",
    shape: "triangle",
    phases: [
      { label: "Вдох",   duration: 4, color: "#B8785A" },
      { label: "Выдох",  duration: 8, color: "#6B9E7A" },
      { label: "Пауза",  duration: 7, color: "#6B7E9E" },
    ],
  },
  {
    name: "Квадрат",
    desc: "Баланс нервной системы 4-4-4-4",
    shape: "square",
    phases: [
      { label: "Вдох",      duration: 4, color: "#B8785A" },
      { label: "Задержка",  duration: 4, color: "#6B7E9E" },
      { label: "Выдох",     duration: 4, color: "#6B9E7A" },
      { label: "Пауза",     duration: 4, color: "#8E6BA8" },
    ],
  },
  {
    name: "4-7-8",
    desc: "Успокаивает, готовит ко сну",
    shape: "triangle",
    phases: [
      { label: "Вдох",      duration: 4,  color: "#B8785A" },
      { label: "Задержка",  duration: 7,  color: "#8E6BA8" },
      { label: "Выдох",     duration: 8,  color: "#6B9E7A" },
    ],
  },
  {
    name: "Круг",
    desc: "Сосредоточься на телесных ощущениях",
    shape: "circle",
    phases: [
      { label: "Вдох",        duration: 4, color: "#B8785A" },
      { label: "Задержка",    duration: 2, color: "#6B7E9E" },
      { label: "Выдох",       duration: 4, color: "#6B9E7A" },
      { label: "Расслабление",duration: 2, color: "#8E6BA8" },
    ],
  },
];

// ── Triangle geometry ────────────────────────────────────────────────────────

const CX = 190, CY = 200, R_TRI = 155, CORNER_TRI = 28;

function buildTrianglePath() {
  const pts = [150, -90, 30].map((a) => {
    const rad = (a * Math.PI) / 180;
    return { x: CX + R_TRI * Math.cos(rad), y: CY + R_TRI * Math.sin(rad) };
  });
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const len1 = Math.hypot(v1.x, v1.y);
    const u1 = { x: v1.x / len1, y: v1.y / len1 };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const len2 = Math.hypot(v2.x, v2.y);
    const u2 = { x: v2.x / len2, y: v2.y / len2 };
    const sx = curr.x - u1.x * CORNER_TRI, sy = curr.y - u1.y * CORNER_TRI;
    const ex = curr.x + u2.x * CORNER_TRI, ey = curr.y + u2.y * CORNER_TRI;
    if (i === 0) d += `M ${sx} ${sy} `;
    else d += `L ${sx} ${sy} `;
    d += `Q ${curr.x} ${curr.y} ${ex} ${ey} `;
  }
  return d + "Z";
}

const TRI_PATH_D = buildTrianglePath();

// ── Square geometry ──────────────────────────────────────────────────────────

const R_SQ = 135, CORNER_SQ = 22;

function buildSquarePath() {
  // BL(225°) → BR(315°=-45°) → TR(45°) → TL(135°) clockwise
  const pts = [225, 315, 45, 135].map((a) => {
    const rad = (a * Math.PI) / 180;
    return { x: CX + R_SQ * Math.cos(rad), y: CY + R_SQ * Math.sin(rad) };
  });
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const len1 = Math.hypot(v1.x, v1.y);
    const u1 = { x: v1.x / len1, y: v1.y / len1 };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const len2 = Math.hypot(v2.x, v2.y);
    const u2 = { x: v2.x / len2, y: v2.y / len2 };
    const sx = curr.x - u1.x * CORNER_SQ, sy = curr.y - u1.y * CORNER_SQ;
    const ex = curr.x + u2.x * CORNER_SQ, ey = curr.y + u2.y * CORNER_SQ;
    if (i === 0) d += `M ${sx} ${sy} `;
    else d += `L ${sx} ${sy} `;
    d += `Q ${curr.x} ${curr.y} ${ex} ${ey} `;
  }
  return d + "Z";
}

const SQ_PATH_D = buildSquarePath();

// ── Circle geometry ──────────────────────────────────────────────────────────

const R_CIRC = 140;
const CIRC_CIRCUMFERENCE = 2 * Math.PI * R_CIRC;

// ── Path fraction helpers ────────────────────────────────────────────────────

function getPathFractionUniform(elapsed: number, phases: Phase[]): number {
  const total = phases.reduce((s, p) => s + p.duration, 0);
  const e = ((elapsed % total) + total) % total;
  const n = phases.length;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    if (e < acc + phases[i].duration) {
      return (i + (e - acc) / phases[i].duration) / n;
    }
    acc += phases[i].duration;
  }
  return 0;
}

// ── Phase detection ──────────────────────────────────────────────────────────

function getCurrentPhase(elapsed: number, phases: Phase[]) {
  const total = phases.reduce((s, p) => s + p.duration, 0);
  const e = ((elapsed % total) + total) % total;
  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    if (e < acc + phases[i].duration) {
      return { phaseIdx: i, phaseElapsed: e - acc, total };
    }
    acc += phases[i].duration;
  }
  return { phaseIdx: 0, phaseElapsed: 0, total };
}

// ── Progress stroke offset ───────────────────────────────────────────────────

function getProgressOffset(phaseIdx: number, phaseElapsed: number, phases: Phase[], pathLength: number) {
  const n = phases.length;
  const phaseStart = phaseIdx / n;
  const phaseEnd = (phaseIdx + 1) / n;
  const phaseFrac = phaseElapsed / phases[phaseIdx].duration;
  return pathLength - (phaseStart + phaseFrac * (phaseEnd - phaseStart)) * pathLength;
}

// ── Single exercise renderer ─────────────────────────────────────────────────

function ExerciseView({ exercise, elapsed }: { exercise: Exercise; elapsed: number }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, [exercise.shape]);

  const { phaseIdx, phaseElapsed } = getCurrentPhase(elapsed, exercise.phases);
  const phase = exercise.phases[phaseIdx];
  const frac = getPathFractionUniform(elapsed, exercise.phases);

  // Dot position
  const dotPos = (() => {
    if (exercise.shape === "circle") {
      const angle = frac * 2 * Math.PI - Math.PI / 2;
      return { x: CX + R_CIRC * Math.cos(angle), y: CY + R_CIRC * Math.sin(angle) };
    }
    if (pathLength > 0 && pathRef.current) {
      const pt = pathRef.current.getPointAtLength(frac * pathLength);
      return { x: pt.x, y: pt.y };
    }
    const rad = (150 * Math.PI) / 180;
    return { x: CX + R_TRI * Math.cos(rad), y: CY + R_TRI * Math.sin(rad) };
  })();

  const progressOffset = exercise.shape === "circle"
    ? CIRC_CIRCUMFERENCE - frac * CIRC_CIRCUMFERENCE
    : getProgressOffset(phaseIdx, phaseElapsed, exercise.phases, pathLength);

  const pathD = exercise.shape === "square" ? SQ_PATH_D : TRI_PATH_D;

  return (
    <div className="relative">
      <svg width="380" height="380" viewBox="0 0 380 380" className="max-w-[320px] w-full">
        {exercise.shape === "circle" ? (
          <>
            {/* Background track */}
            <circle cx={CX} cy={CY} r={R_CIRC} fill="none" stroke="#E8DDD0" strokeWidth="5" />
            {/* Progress arc */}
            <circle
              cx={CX} cy={CY} r={R_CIRC}
              fill="none"
              stroke={phase.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRC_CIRCUMFERENCE}
              strokeDashoffset={progressOffset}
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{ transition: "stroke 0.6s ease" }}
            />
          </>
        ) : (
          <>
            {/* Background track */}
            <path d={pathD} fill="none" stroke="#E8DDD0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Progress arc */}
            {pathLength > 0 && (
              <path
                d={pathD}
                fill="none"
                stroke={phase.color}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={pathLength}
                strokeDashoffset={progressOffset}
                style={{ transition: "stroke 0.6s ease" }}
              />
            )}
            {/* Invisible reference path */}
            <path ref={pathRef} d={pathD} fill="none" stroke="none" />
          </>
        )}

        {/* Dot */}
        <circle cx={dotPos.x} cy={dotPos.y} r="20" fill={phase.color} opacity="0.9" style={{ transition: "fill 0.6s ease" }} />
        <circle cx={dotPos.x - 5} cy={dotPos.y - 5} r="6" fill="white" opacity="0.35" />
      </svg>

      {/* Phase label centered in SVG */}
      <div className="pointer-events-none absolute inset-0 flex max-w-[320px] flex-col items-center justify-center gap-1">
        <span className="text-2xl font-semibold transition-colors duration-500" style={{ color: phase.color }}>
          {phase.label}
        </span>
        <span className="text-sm text-[#B8A898]">
          {Math.max(0, Math.ceil(phase.duration - phaseElapsed))}с
        </span>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function BreathingExercise() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number>(performance.now());
  const rafRef = useRef<number>(0);
  const dragX = useMotionValue(0);
  const dragOpacity = useTransform(dragX, [-80, 0, 80], [0.6, 1, 0.6]);

  // Auto-start animation loop
  useEffect(() => {
    startedAtRef.current = performance.now();
    const tick = (now: number) => {
      setElapsed((now - startedAtRef.current) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [currentIdx]);

  const goTo = (idx: number) => {
    setDirection(idx > currentIdx ? 1 : -1);
    setCurrentIdx(idx);
    setElapsed(0);
  };

  const prev = () => goTo((currentIdx - 1 + EXERCISES.length) % EXERCISES.length);
  const next = () => goTo((currentIdx + 1) % EXERCISES.length);

  const exercise = EXERCISES[currentIdx];

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const { offset, velocity } = info;
    animate(dragX, 0, { duration: 0.3, ease: "easeOut" });
    if (offset.x < -50 || velocity.x < -300) {
      next();
      if (navigator.vibrate) navigator.vibrate(10);
    } else if (offset.x > 50 || velocity.x > 300) {
      prev();
      if (navigator.vibrate) navigator.vibrate(10);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 px-4 py-6">
      {/* Carousel navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={prev}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D8CDC0] bg-white text-[#8A7A6A] transition-all hover:bg-[#F5EDE4]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center min-w-[120px]">
          <p className="text-[15px] font-semibold text-[#5A5048]">{exercise.name}</p>
          <p className="text-[12px] text-[#B8A898]">{exercise.desc}</p>
        </div>
        <button
          onClick={next}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D8CDC0] bg-white text-[#8A7A6A] transition-all hover:bg-[#F5EDE4]"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Animated exercise view with swipe support */}
      <motion.div
        className="relative overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ x: dragX, opacity: dragOpacity, touchAction: "pan-y" }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentIdx}
            initial={{ x: direction * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -direction * 60, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <ExerciseView exercise={exercise} elapsed={elapsed} />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Dot indicators */}
      <div className="flex gap-2">
        {EXERCISES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: i === currentIdx ? 20 : 8,
              background: i === currentIdx ? "#B8785A" : "#D8CDC0",
            }}
          />
        ))}
      </div>

      <p className="max-w-[240px] text-center text-sm text-[#8A7A6A]">
        Следи за точкой — она ведёт тебя через дыхание
      </p>
    </div>
  );
}
