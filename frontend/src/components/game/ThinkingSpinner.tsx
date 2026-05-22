import { useState, useEffect } from 'react';

const PHRASES = [
  'Ника думает...',
  'Анализирую ответ...',
  'Подбираю вопрос...',
  'Ищу паттерн...',
];

export function ThinkingSpinner() {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="relative w-16 h-16">
        <svg
          viewBox="0 0 100 100"
          style={{ animation: 'spin-slow 3s linear infinite' }}
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="spinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#B8785A" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="url(#spinnerGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="220 60"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          🌸
        </div>
      </div>
      <p className="text-sm text-[#8A7A6A] dark:text-[#B8A898] transition-all duration-300">
        {PHRASES[phraseIdx]}
      </p>
    </div>
  );
}
