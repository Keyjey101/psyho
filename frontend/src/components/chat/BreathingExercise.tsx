import { useEffect, useState, useRef } from "react";

// Phases: inhale 4s (BL→top), exhale 8s (top→BR), pause 7s (BR→BL)
const PHASES = [
  { label: "Вдох",   duration: 4, color: "#B8785A" },
  { label: "Выдох",  duration: 8, color: "#6B9E7A" },
  { label: "Пауза",  duration: 7, color: "#6B7E9E" },
] as const;

const TOTAL = 19;

const CX = 190;
const CY = 200;
const R = 170;
const CORNER = 30;

// Clockwise from bottom-left: BL(150°) → top(-90°) → BR(30°)
function trianglePoints() {
  return [150, -90, 30].map((a) => {
    const rad = (a * Math.PI) / 180;
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  });
}

function buildPath() {
  const pts = trianglePoints();
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

    const startX = curr.x - u1.x * CORNER;
    const startY = curr.y - u1.y * CORNER;
    const endX = curr.x + u2.x * CORNER;
    const endY = curr.y + u2.y * CORNER;

    if (i === 0) d += `M ${startX} ${startY} `;
    else d += `L ${startX} ${startY} `;
    d += `Q ${curr.x} ${curr.y} ${endX} ${endY} `;
  }
  d += "Z";
  return d;
}

const PATH_D = buildPath();

// Maps elapsed time (0-19s) to path fraction (0-1) non-uniformly
function getPathFraction(t: number): number {
  const clamped = ((t % TOTAL) + TOTAL) % TOTAL;
  if (clamped < 4)        return (clamped / 4) * (1 / 3);
  else if (clamped < 12)  return 1 / 3 + ((clamped - 4) / 8) * (1 / 3);
  else                    return 2 / 3 + ((clamped - 12) / 7) * (1 / 3);
}

export default function BreathingExercise() {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const elapsedAtPauseRef = useRef(0);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, []);

  useEffect(() => {
    if (!running || pathLength === 0) return;

    startedAtRef.current = performance.now() - elapsedAtPauseRef.current * 1000;
    let raf: number;

    const tick = (now: number) => {
      const newElapsed = (now - startedAtRef.current!) / 1000;
      setElapsed(newElapsed % TOTAL);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      elapsedAtPauseRef.current = elapsed;
      cancelAnimationFrame(raf);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, pathLength]);

  // Determine current phase
  let acc = 0;
  let phaseIdx = 0;
  let phaseElapsed = 0;
  const e = ((elapsed % TOTAL) + TOTAL) % TOTAL;
  for (let i = 0; i < PHASES.length; i++) {
    if (e < acc + PHASES[i].duration) {
      phaseIdx = i;
      phaseElapsed = e - acc;
      break;
    }
    acc += PHASES[i].duration;
  }
  const phase = PHASES[phaseIdx];

  // Dot position
  const frac = getPathFraction(e);
  const dotPos = pathLength > 0 && pathRef.current
    ? (() => {
        const pt = pathRef.current.getPointAtLength(frac * pathLength);
        return { x: pt.x, y: pt.y };
      })()
    : { x: CX + R * Math.cos((150 * Math.PI) / 180), y: CY + R * Math.sin((150 * Math.PI) / 180) }; // BL

  // Progress stroke — fills as current phase progresses (resets each phase)
  const phaseStart = (phaseIdx === 0 ? 0 : phaseIdx === 1 ? 1 / 3 : 2 / 3);
  const phaseEnd = phaseIdx === 2 ? 1 : phaseStart + 1 / 3;
  const phaseFrac = phaseElapsed / phase.duration;
  const progressOffset = pathLength > 0
    ? pathLength - (phaseStart + phaseFrac * (phaseEnd - phaseStart)) * pathLength
    : pathLength;

  const handleToggle = () => {
    if (running) {
      elapsedAtPauseRef.current = elapsed;
    }
    setRunning((r) => !r);
  };

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8">
      <div className="relative">
        <svg
          width="380"
          height="380"
          viewBox="0 0 380 380"
          className="max-w-[380px] w-full"
        >
          {/* Background track */}
          <path
            d={PATH_D}
            fill="none"
            stroke="#E8DDD0"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Progress arc — current phase segment */}
          {pathLength > 0 && (
            <path
              d={PATH_D}
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
          <path ref={pathRef} d={PATH_D} fill="none" stroke="none" />

          {/* Dot */}
          <circle
            cx={dotPos.x}
            cy={dotPos.y}
            r="22"
            fill={phase.color}
            opacity="0.9"
            style={{ transition: "fill 0.6s ease" }}
          />
          <circle
            cx={dotPos.x - 6}
            cy={dotPos.y - 6}
            r="7"
            fill="white"
            opacity="0.35"
          />
        </svg>

        {/* Phase label centred inside SVG */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span
            className="text-2xl font-semibold transition-colors duration-500"
            style={{ color: phase.color }}
          >
            {phase.label}
          </span>
          <span className="text-sm text-[#B8A898]">
            {Math.max(0, Math.ceil(phase.duration - phaseElapsed))}с
          </span>
        </div>
      </div>

      <button
        onClick={handleToggle}
        className="btn-primary px-8 py-3"
      >
        {running ? "Пауза" : elapsed === 0 ? "Начать" : "Продолжить"}
      </button>

      <p className="max-w-[240px] text-center text-sm text-[#8A7A6A]">
        Следи за точкой — она ведёт тебя через дыхание
      </p>
    </div>
  );
}
