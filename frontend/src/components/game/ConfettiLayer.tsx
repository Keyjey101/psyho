import { useEffect } from 'react';

// @ts-ignore
import confetti from 'canvas-confetti';

export function ConfettiLayer({ trigger }: { trigger: boolean }) {
  useEffect(() => {
    if (!trigger) return;
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8B5CF6', '#F59E0B', '#FFFFFF'],
    });
  }, [trigger]);
  return null;
}
