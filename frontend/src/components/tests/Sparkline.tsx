// Tiny inline SVG sparkline for test attempt history. No external chart deps —
// 4-6 data points is all we ever render in a test card.

interface SparklineProps {
  /** Sequence of attempt scores, oldest first. */
  values: number[];
  /** Score range upper bound (used to normalise the y-axis). */
  max: number;
  /** Direction of "better": green if last point is better than first. */
  lowerIsBetter: boolean;
  width?: number;
  height?: number;
}

export default function Sparkline({
  values,
  max,
  lowerIsBetter,
  width = 80,
  height = 24,
}: SparklineProps) {
  if (values.length < 2) return null;

  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const safeMax = Math.max(max, 1);

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * innerW;
    const norm = Math.max(0, Math.min(1, v / safeMax));
    const y = padding + (1 - norm) * innerH;
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  // Trend colour: compare first vs last; respect lowerIsBetter.
  const first = values[0];
  const last = values[values.length - 1];
  const improvement = lowerIsBetter ? first - last : last - first;
  const stroke =
    Math.abs(improvement) < 0.5
      ? "#B8A898" // flat / no change
      : improvement > 0
        ? "#6B9E7A" // better
        : "#C4786A"; // worse

  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.4" fill={stroke} />
    </svg>
  );
}
