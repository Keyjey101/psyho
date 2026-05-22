import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/api/client';
import { useGameStore } from '@/store/game';
import { useGame } from '@/hooks/useGame';
import { useAuthStore } from '@/store/auth';
import { ThinkingSpinner } from '@/components/game/ThinkingSpinner';
import { AnswerOptions } from '@/components/game/AnswerOptions';
import { GameProgress } from '@/components/game/GameProgress';
import { CurtainOverlay } from '@/components/game/CurtainOverlay';
import { ConfettiLayer } from '@/components/game/ConfettiLayer';
import { Leaderboard } from '@/components/game/Leaderboard';
import { PseudonymModal } from '@/components/game/PseudonymModal';

// ─── useTypewriter ────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 30) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const prevTextRef = useRef('');

  useEffect(() => {
    if (text === prevTextRef.current) return;
    prevTextRef.current = text;
    setDisplayed('');
    setDone(false);
    if (!text) { setDone(true); return; }

    let i = 0;
    const tick = () => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) {
        timerId = window.setTimeout(tick, speed);
      } else {
        setDone(true);
      }
    };
    let timerId = window.setTimeout(tick, speed);
    return () => clearTimeout(timerId);
  }, [text, speed]);

  return { displayed, done };
}

// ─── Progressive move hints ───────────────────────────────────────────────────
function getMoveHint(move: number): string | null {
  if (move === 5) return '🔍 Ника начинает видеть картину...';
  if (move === 9) return '💡 Почти разгадано...';
  if (move === 11) return '⏳ Последний шанс скрыться!';
  return null;
}

// ─── GamePage ─────────────────────────────────────────────────────────────────
export default function GamePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const store = useGameStore();
  const { connect, sendAnswer, disconnect } = useGame();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [surrenderConfirm, setSurrenderConfirm] = useState(false);
  const [loadError, setLoadError] = useState('');
  const connectedRef = useRef(false);

  const {
    sessionId, status, moveCount, maxMoves, currentQuestion,
    result, isThinking, selectedIdx, showCurtain, showConfetti,
    showPseudonymModal, pseudonymId,
    setSelectedIdx, setShowCurtain, setShowConfetti, setShowPseudonymModal,
    setPseudonym,
  } = store;

  // ── Init session ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const res = await api.get<{
          session_id: string;
          status: string;
          move_count: number;
          max_moves: number;
        }>('/game/session');
        if (cancelled) return;
        store.setSession(res.data.session_id, 'active', res.data.move_count, res.data.max_moves);
        if (!connectedRef.current) {
          connectedRef.current = true;
          connect(res.data.session_id);
        }
      } catch {
        if (!cancelled) setLoadError('Не удалось загрузить игру. Попробуй обновить страницу.');
      }
    };

    init();
    return () => {
      cancelled = true;
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { displayed: typewriterText, done: typewriterDone } = useTypewriter(
    currentQuestion?.text ?? ''
  );

  // ── Answer handler ──────────────────────────────────────────────────────────
  const handleAnswer = useCallback((idx: number) => {
    if (selectedIdx !== null || isThinking) return;
    setSelectedIdx(idx);
    sendAnswer(idx);
  }, [selectedIdx, isThinking, setSelectedIdx, sendAnswer]);

  // ── Surrender ───────────────────────────────────────────────────────────────
  const handleSurrender = () => {
    if (surrenderConfirm) {
      // Confirm: just go home
      disconnect();
      store.reset();
      navigate('/');
    } else {
      setSurrenderConfirm(true);
      setTimeout(() => setSurrenderConfirm(false), 4000);
    }
  };

  // ── Pseudonym saved ─────────────────────────────────────────────────────────
  const handlePseudonymClose = (name: string, id: string) => {
    setPseudonym(name, id);
    setShowPseudonymModal(false);
  };

  // ── Curtain close → show leaderboard ────────────────────────────────────────
  const handleCurtainClose = () => {
    setShowCurtain(false);
    setShowLeaderboard(true);
  };

  const moveHint = currentQuestion ? getMoveHint(currentQuestion.move) : null;

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6F1] dark:bg-[#2A2420] px-4">
        <div className="text-center">
          <p className="text-[#5A5048] dark:text-[#D8C8B8] mb-4">{loadError}</p>
          <button onClick={() => window.location.reload()} className="btn-primary px-6 py-3 rounded-2xl">
            Обновить
          </button>
        </div>
      </div>
    );
  }

  // Crisis interrupted
  if (status === 'crisis_interrupted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6F1] dark:bg-[#2A2420] px-4">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🆘</div>
          <h2 className="text-xl font-bold text-[#5A5048] dark:text-[#D8C8B8] mb-3">
            Ника заметила, что тебе сейчас непросто
          </h2>
          <p className="text-[#8A7A6A] dark:text-[#B8A898] mb-6">
            Если тебе нужна помощь, позвони на телефон доверия: <strong>8-800-2000-122</strong> (бесплатно).
          </p>
          <Link to="/" className="btn-primary px-6 py-3 rounded-2xl">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  // Finished scenario A
  if (status === 'finished_a' && result && !showPseudonymModal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6F1] dark:bg-[#2A2420] px-4">
        <ConfettiLayer trigger={showConfetti} />
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">🌸</div>
          <h2 className="text-xl font-bold text-[#5A5048] dark:text-[#D8C8B8] mb-2">
            Ника угадала!
          </h2>
          <p className="text-[#8A7A6A] dark:text-[#B8A898] mb-1">
            Тема: <strong>{result.topic_label}</strong>
          </p>
          <p className="text-sm text-[#8A7A6A] dark:text-[#B8A898] mb-6">
            {result.moves} ходов · {result.time_seconds}с
          </p>

          {store.pseudonym && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl px-4 py-3 mb-6 text-sm text-[#5A5048] dark:text-[#D8C8B8]">
              Псевдоним: <strong>{store.pseudonym}</strong>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/chat')}
                className="btn-primary py-3 rounded-2xl"
              >
                Да, это про меня! Поговорить с Никой
              </button>
            ) : (
              <button
                onClick={() => navigate('/auth?next=/chat')}
                className="btn-primary py-3 rounded-2xl"
              >
                Да, это про меня! Войти и поговорить
              </button>
            )}
            <button
              onClick={() => { store.reset(); setShowConfetti(false); window.location.reload(); }}
              className="rounded-2xl border-2 border-[#E8DDD0] dark:border-[#4A4038] py-3 text-[#8A7A6A] dark:text-[#B8A898] hover:border-[#B8785A] transition-colors"
            >
              Нет, сыграем снова!
            </button>
          </div>

          {showLeaderboard && (
            <div className="mt-8">
              <Leaderboard pseudonymId={pseudonymId} visible />
            </div>
          )}
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="mt-4 text-sm text-[#B8785A] hover:underline"
          >
            {showLeaderboard ? 'Скрыть рейтинг' : 'Посмотреть рейтинг'}
          </button>
        </div>
      </div>
    );
  }

  // Main game layout
  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-[#2A2420] flex flex-col">
      {/* Overlays */}
      <CurtainOverlay
        visible={showCurtain}
        moves={result?.moves ?? moveCount}
        timeSeconds={result?.time_seconds ?? 0}
        onClose={handleCurtainClose}
      />
      <ConfettiLayer trigger={showConfetti} />
      <PseudonymModal
        visible={showPseudonymModal}
        onClose={handlePseudonymClose}
        sessionId={sessionId}
      />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-[#2A2420]/90 backdrop-blur border-b border-[#E8DDD0] dark:border-[#4A4038]">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-[#8A7A6A] dark:text-[#B8A898] hover:text-[#B8785A] text-sm">
              ← Главная
            </Link>
            <span className="text-[#E8DDD0] dark:text-[#4A4038]">|</span>
            <span className="text-sm font-bold text-[#5A5048] dark:text-[#D8C8B8]">🌸 Победи Нику</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#8A7A6A] dark:text-[#B8A898] bg-[#FAF6F1] dark:bg-[#3A3028] px-3 py-1 rounded-full border border-[#E8DDD0] dark:border-[#4A4038]">
              Ход {moveCount}/{maxMoves}
            </span>
            <button
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className="text-xs text-[#B8785A] hover:underline"
            >
              Рейтинг
            </button>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="w-full px-0">
        <GameProgress moveCount={moveCount} maxMoves={maxMoves} />
      </div>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-8 flex flex-col gap-6">
        {/* Leaderboard panel */}
        {showLeaderboard && (
          <div className="bg-white dark:bg-[#2A2420] rounded-3xl border border-[#E8DDD0] dark:border-[#4A4038] p-6">
            <Leaderboard pseudonymId={pseudonymId} visible={showLeaderboard} />
          </div>
        )}

        {/* Move hint */}
        {moveHint && !isThinking && (
          <div className="text-center text-sm text-[#B8785A] font-medium animate-pulse">
            {moveHint}
          </div>
        )}

        {/* Question / Thinking area */}
        <div className="bg-white dark:bg-[#2A2420] rounded-3xl border border-[#E8DDD0] dark:border-[#4A4038] p-6 md:p-8 min-h-[180px] flex flex-col justify-center">
          {isThinking || !currentQuestion ? (
            <ThinkingSpinner />
          ) : (
            <p className="text-[#5A5048] dark:text-[#D8C8B8] text-base md:text-lg font-medium text-center leading-relaxed">
              {typewriterText}
              {!typewriterDone && <span className="inline-block w-0.5 h-5 bg-[#B8785A] ml-0.5 animate-pulse" />}
            </p>
          )}
        </div>

        {/* Answer options */}
        {currentQuestion && typewriterDone && !isThinking && (
          <AnswerOptions
            choices={currentQuestion.choices}
            selectedIdx={selectedIdx}
            disabled={selectedIdx !== null || isThinking}
            onSelect={handleAnswer}
          />
        )}

        {/* Footer: pseudonym + surrender */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#E8DDD0] dark:border-[#4A4038]">
          <div className="text-xs text-[#8A7A6A] dark:text-[#B8A898]">
            {store.pseudonym ? `👤 ${store.pseudonym}` : 'Анонимный игрок'}
          </div>
          <button
            onClick={handleSurrender}
            className={[
              'text-sm px-4 py-2 rounded-xl transition-colors',
              surrenderConfirm
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                : 'text-[#8A7A6A] dark:text-[#B8A898] hover:text-[#B8785A]',
            ].join(' ')}
          >
            {surrenderConfirm ? 'Точно сдаться? (нажми ещё раз)' : 'Сдаться'}
          </button>
        </div>
      </main>
    </div>
  );
}
