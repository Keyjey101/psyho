import { useEffect } from 'react';
import api from '@/api/client';
import { useGameStore, type LeaderboardEntryData } from '@/store/game';

interface LeaderboardProps {
  pseudonymId?: string | null;
  visible: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}м ${s}с` : `${s}с`;
}

export function Leaderboard({ pseudonymId, visible }: LeaderboardProps) {
  const { leaderboard, myRank, setLeaderboard } = useGameStore();

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get<{ entries: LeaderboardEntryData[]; my_rank: number | null }>(
        '/game/leaderboard'
      );
      setLeaderboard(res.data.entries ?? [], res.data.my_rank ?? null);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!visible) return;
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#5A5048] dark:text-[#D8C8B8]">
          🏆 Рейтинг победителей
        </h2>
        {myRank && (
          <span className="text-sm text-[#8A7A6A] dark:text-[#B8A898]">
            Ваш ранг: #{myRank}
          </span>
        )}
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-12 text-[#8A7A6A] dark:text-[#B8A898]">
          <p className="text-4xl mb-3">🌸</p>
          <p className="text-sm">Рейтинг пока пуст. Будь первым!</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E8DDD0] dark:border-[#4A4038]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAF6F1] dark:bg-[#3A3028] border-b border-[#E8DDD0] dark:border-[#4A4038]">
                <th className="px-4 py-3 text-left text-[#8A7A6A] dark:text-[#B8A898] font-medium">#</th>
                <th className="px-4 py-3 text-left text-[#8A7A6A] dark:text-[#B8A898] font-medium">Псевдоним</th>
                <th className="px-4 py-3 text-center text-[#8A7A6A] dark:text-[#B8A898] font-medium">Ходов</th>
                <th className="px-4 py-3 text-center text-[#8A7A6A] dark:text-[#B8A898] font-medium">Время</th>
                <th className="px-4 py-3 text-center text-[#8A7A6A] dark:text-[#B8A898] font-medium">Победитель?</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 20).map((entry, i) => {
                const isMe = pseudonymId != null && entry.pseudonym === pseudonymId;
                return (
                  <tr
                    key={i}
                    className={[
                      'border-b border-[#E8DDD0] dark:border-[#4A4038] last:border-0',
                      isMe
                        ? 'bg-amber-50 dark:bg-amber-900/20'
                        : 'bg-white dark:bg-[#2A2420] hover:bg-[#FAF6F1] dark:hover:bg-[#3A3028]',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 font-bold text-[#8A7A6A] dark:text-[#B8A898]">
                      {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#5A5048] dark:text-[#D8C8B8]">
                      {entry.pseudonym}
                      {isMe && <span className="ml-2 text-xs text-[#B8785A]">(ты)</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-[#5A5048] dark:text-[#D8C8B8]">
                      {entry.moves}
                    </td>
                    <td className="px-4 py-3 text-center text-[#5A5048] dark:text-[#D8C8B8]">
                      {formatTime(entry.time_seconds)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.scenario === 'B' ? '🏆' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
