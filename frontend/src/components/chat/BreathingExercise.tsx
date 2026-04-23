import { useEffect, useState, useRef } from "react";

const PHASES = [
  { label: "Вдох", duration: 4, color: "#B8785A" },
  { label: "Выдох", duration: 7, color: "#6B9E7A" },
  { label: "Пауза", duration: 8, color: "#6B7E9E" },
] as const;

const TOTAL = PHASES.reduce((s, p) => s + p.duration, 0); // 19s

const CX = 140;
const CY = 148;
const R = 108;
const CORNER = 28;

function trianglePoints() {
  const angles = [-90, 150, 30];
  return angles.map((a) => {
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

export default function BreathingExercise() {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [dotPos, setDotPos] = useState({ x: CX, y: CY - R });

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, []);

  useEffect(() => {
    if (!running || pathLength === 0) return;
    const startTime = performance.now() - elapsed * 1000;
    let raf: number;
    const tick = (now: number) => {
      const newElapsed = ((now - startTime) / 1000) % TOTAL;
      setElapsed(newElapsed);
      const frac = newElapsed / TOTAL;
      const pt = pathRef.current?.getPointAtLength(frac * pathLength);
      if (pt) setDotPos({ x: pt.x, y: pt.y });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, pathLength]);

  // Current phase
  let acc = 0;
  let phaseIdx = 0;
  let phaseElapsed = 0;
  for (let i = 0; i < PHASES.length; i++) {
    if (elapsed < acc + PHASES[i].duration) {
      phaseIdx = i;
      phaseElapsed = elapsed - acc;
      break;
    }
    acc += PHASES[i].duration;
  }
  const phase = PHASES[phaseIdx];

  // Stroke showing progress (full cycle)
  const strokeOffset = pathLength > 0 ? (1 - elapsed / TOTAL) * pathLength : pathLength;

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8">
      <div className="relative">
        <svg width="280" height="280" viewBox="0 0 280 280">
          {/* Background track */}
          <path
            d={PATH_D}
            fill="none"
            stroke="#E8DDD0"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Progress arc */}
          {pathLength > 0 && (
            <path
              d={PATH_D}
              fill="none"
              stroke={phase.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={pathLength}
              strokeDashoffset={strokeOffset}
              style={{ transition: "stroke 0.6s ease" }}
            />
          )}
          {/* Invisible path for getPointAtLength */}
          <path ref={pathRef} d={PATH_D} fill="none" stroke="none" />

          {/* Dot — positioned via JS */}
          <circle
            cx={dotPos.x}
            cy={dotPos.y}
            r="22"
            fill={phase.color}
            opacity="0.9"
            style={{ transition: "fill 0.6s ease" }}
          />
          {/* Inner highlight */}
          <circle
            cx={dotPos.x - 6}
            cy={dotPos.y - 6}
            r="7"
            fill="white"
            opacity="0.35"
          />
        </svg>

        {/* Phase label centred */}
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
        onClick={() => setRunning((r) => !r)}
        className="btn-primary px-8 py-3"
      >
        {running ? "Пауза" : elapsed === 0 ? "Начать" : "Продолжить"}
      </button>

      <p className="max-w-[220px] text-center text-sm text-[#8A7A6A]">
        Следи за точкой — она ведёт тебя через дыхание
      </p>
    </div>
  );
}
