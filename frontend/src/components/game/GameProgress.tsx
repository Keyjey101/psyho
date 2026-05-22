interface GameProgressProps {
  moveCount: number;
  maxMoves: number;
}

export function GameProgress({ moveCount, maxMoves }: GameProgressProps) {
  const pct = maxMoves > 0 ? Math.min((moveCount / maxMoves) * 100, 100) : 0;
  const isNearEnd = moveCount >= 10;

  return (
    <div className="w-full h-1 bg-[#E8DDD0] dark:bg-[#3A3028] rounded-full overflow-hidden">
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: isNearEnd ? '#F59E0B' : '#B8785A',
          transition: 'width 0.4s ease, background 0.4s ease',
          borderRadius: '9999px',
        }}
      />
    </div>
  );
}
