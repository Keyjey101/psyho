import { useState } from 'react';
import api from '@/api/client';

interface PseudonymModalProps {
  visible: boolean;
  onClose: (name: string, id: string) => void;
  sessionId: string | null;
}

type PseudonymType = 'generated' | 'ironic' | 'custom';

const TYPE_LABELS: Record<PseudonymType, string> = {
  generated: 'Загадочный',
  ironic: 'Ироничный',
  custom: 'Свой',
};

export function PseudonymModal({ visible, onClose, sessionId }: PseudonymModalProps) {
  const [type, setType] = useState<PseudonymType>('generated');
  const [customName, setCustomName] = useState('');
  const [showInLeaderboard, setShowInLeaderboard] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!visible) return null;

  const handleSubmit = async () => {
    if (type === 'custom' && !customName.trim()) {
      setError('Введи псевдоним');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ pseudonym: string; id: string }>('/game/pseudonym', {
        session_id: sessionId,
        type,
        custom_name: type === 'custom' ? customName.trim() : undefined,
        show_in_leaderboard: showInLeaderboard,
      });
      onClose(res.data.pseudonym, res.data.id);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Ошибка. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      className="bg-black/50 px-4"
    >
      <div className="bg-white dark:bg-[#2A2420] rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        <div className="text-center">
          <div className="text-3xl mb-2">🌸</div>
          <h2 className="text-lg font-bold text-[#5A5048] dark:text-[#D8C8B8]">
            Выбери псевдоним
          </h2>
          <p className="text-sm text-[#8A7A6A] dark:text-[#B8A898] mt-1">
            Под каким именем попасть в рейтинг?
          </p>
        </div>

        {/* Type selector */}
        <div className="flex gap-2">
          {(Object.keys(TYPE_LABELS) as PseudonymType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={[
                'flex-1 rounded-xl py-2 text-sm font-medium transition-colors border-2',
                type === t
                  ? 'border-[#B8785A] bg-[#B8785A] text-white'
                  : 'border-[#E8DDD0] dark:border-[#4A4038] text-[#8A7A6A] dark:text-[#B8A898] hover:border-[#B8785A]',
              ].join(' ')}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Custom input */}
        {type === 'custom' && (
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Твой псевдоним..."
            maxLength={40}
            className="w-full rounded-xl border-2 border-[#E8DDD0] dark:border-[#4A4038] bg-white dark:bg-[#2A2420] px-4 py-3 text-sm text-[#5A5048] dark:text-[#D8C8B8] focus:outline-none focus:border-[#B8785A]"
          />
        )}

        {/* Leaderboard toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showInLeaderboard}
            onChange={(e) => setShowInLeaderboard(e.target.checked)}
            className="w-4 h-4 accent-[#B8785A]"
          />
          <span className="text-sm text-[#5A5048] dark:text-[#D8C8B8]">
            Показывать в рейтинге
          </span>
        </label>

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full btn-primary flex items-center justify-center gap-2 py-3 rounded-2xl"
          style={{ minHeight: '48px' }}
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            'Сохранить псевдоним'
          )}
        </button>

        <button
          onClick={() => onClose('Аноним', '')}
          className="text-sm text-[#8A7A6A] dark:text-[#B8A898] hover:text-[#B8785A] text-center transition-colors"
        >
          Пропустить
        </button>
      </div>
    </div>
  );
}
