import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATIC_QUESTIONS } from '@/data/gameQuestions';
import { ThinkingSpinner } from './ThinkingSpinner';
import api from '@/api/client';

const LANDING_TIMEOUT_MS = 60_000;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Shuffle so each session starts from a different question
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function LandingGameBlock() {
  const navigate = useNavigate();
  const [questions] = useState(() => shuffled(STATIC_QUESTIONS));
  const [qIdx, setQIdx] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showSpinner, setShowSpinner] = useState(false);
  const [done, setDone] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  const currentQuestion = questions[qIdx] ?? null;

  // Timer: if 60s passes → navigate to /game
  useEffect(() => {
    if (answerCount === 0) return; // wait for first answer before starting timer
    if (done) return;
    const remaining = LANDING_TIMEOUT_MS - (Date.now() - (startTimeRef.current ?? Date.now()));
    if (remaining <= 0) {
      navigate('/game');
      return;
    }
    const t = setTimeout(() => navigate('/game'), remaining);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerCount, done]);

  const handleSelect = async (idx: number) => {
    if (selectedIdx !== null || showSpinner) return;

    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    setSelectedIdx(idx);
    const newCount = answerCount + 1;
    setAnswerCount(newCount);

    // Post to backend (fire-and-forget)
    try {
      await api.post('/game/landing-answer', {
        question: currentQuestion?.text,
        choice_idx: idx,
        choice_text: currentQuestion?.choices[idx],
      });
    } catch {
      // ignore
    }

    if (newCount >= STATIC_QUESTIONS.length) {
      // All answered
      setDone(true);
      return;
    }

    // Show spinner briefly then next question
    setShowSpinner(true);
    await new Promise((r) => setTimeout(r, 900));
    setShowSpinner(false);
    setSelectedIdx(null);
    setQIdx((i) => i + 1);
  };

  return (
    <section className="py-20 px-4 bg-[#FAF6F1] dark:bg-[#2A2420]">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#5A5048] dark:text-[#D8C8B8] font-serif mb-3">
            Можем ли мы угадать, что тебя беспокоит?
          </h2>
          <p className="text-[#8A7A6A] dark:text-[#B8A898] text-sm">
            Ответь на несколько вопросов. Без регистрации.
          </p>
        </div>

        {done ? (
          /* After all questions answered */
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🌸</div>
            <p className="text-lg font-medium text-[#5A5048] dark:text-[#D8C8B8] mb-2">
              Ника уже кое-что поняла.
            </p>
            <p className="text-[#8A7A6A] dark:text-[#B8A898] text-sm mb-6">
              Продолжим?
            </p>
            <button
              onClick={() => navigate('/game')}
              className="btn-primary px-8 py-3 rounded-2xl text-base font-semibold"
              style={{ minHeight: '48px' }}
            >
              🎲 Сыграть в угадайку с Никой
            </button>
          </div>
        ) : (
          <>
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {STATIC_QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === qIdx ? '12px' : '8px',
                    height: i === qIdx ? '12px' : '8px',
                    background: i < answerCount
                      ? '#B8785A'
                      : i === qIdx
                      ? '#B8785A'
                      : '#E8DDD0',
                    opacity: i < answerCount ? 0.5 : 1,
                  }}
                />
              ))}
            </div>

            {/* Question card */}
            <div className="bg-white dark:bg-[#2A2420] rounded-3xl shadow-sm border border-[#E8DDD0] dark:border-[#4A4038] p-6 md:p-8 mb-4">
              {showSpinner ? (
                <ThinkingSpinner />
              ) : (
                <>
                  <p className="text-[#5A5048] dark:text-[#D8C8B8] text-base md:text-lg font-medium mb-6 text-center leading-relaxed">
                    {currentQuestion?.text}
                  </p>
                  <div className="flex flex-col gap-3">
                    {currentQuestion?.choices.map((choice, idx) => {
                      const isSelected = selectedIdx === idx;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelect(idx)}
                          disabled={selectedIdx !== null}
                          style={{ minHeight: '52px' }}
                          className={[
                            'w-full text-left rounded-2xl px-5 py-3 text-sm font-medium transition-all duration-200',
                            'border-2 focus:outline-none',
                            isSelected
                              ? 'bg-[#B8785A] border-[#B8785A] text-white shadow-md scale-[1.01]'
                              : 'bg-[#FAF6F1] dark:bg-[#3A3028] border-[#E8DDD0] dark:border-[#4A4038] text-[#5A5048] dark:text-[#D8C8B8] hover:border-[#B8785A] hover:bg-white dark:hover:bg-[#2A2420]',
                            selectedIdx !== null && !isSelected ? 'opacity-50 cursor-default' : 'cursor-pointer',
                          ].join(' ')}
                        >
                          {choice}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Hint */}
            <p className="text-center text-xs text-[#8A7A6A] dark:text-[#B8A898] mb-6">
              Без диагнозов. Просто разговор.
            </p>

            {/* CTA always visible */}
            <div className="text-center">
              <button
                onClick={() => navigate('/game')}
                className="btn-primary px-8 py-3 rounded-2xl text-base font-semibold"
                style={{ minHeight: '48px' }}
              >
                🎲 Ника угадывает
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
