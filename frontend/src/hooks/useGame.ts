import { useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '@/store/game';

const WS_BASE = window.location.protocol === 'https:'
  ? `wss://${window.location.host}/ws/game`
  : `ws://${window.location.host}/ws/game`;

export function useGame() {
  const wsRef = useRef<WebSocket | null>(null);
  const store = useGameStore();

  const connect = useCallback((sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`${WS_BASE}/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'thinking') {
        store.setThinking(true);
      } else if (msg.type === 'question') {
        store.setThinking(false);
        store.setSelectedIdx(null);
        store.setQuestion({ text: msg.text, choices: msg.choices, move: msg.move });
        store.setSession(sessionId, 'active', msg.move, store.maxMoves);
      } else if (msg.type === 'result') {
        store.setThinking(false);
        store.setResult({
          scenario: msg.scenario,
          confidence: msg.confidence,
          topic: msg.topic,
          topic_label: msg.topic_label,
          moves: msg.moves,
          time_seconds: msg.time_seconds,
        });
        if (msg.scenario === 'B') {
          store.setShowCurtain(true);
          store.setSession(sessionId, 'finished_b', msg.moves, store.maxMoves);
        } else {
          store.setShowConfetti(true);
          store.setSession(sessionId, 'finished_a', msg.moves, store.maxMoves);
          store.setShowPseudonymModal(true);
        }
      } else if (msg.type === 'crisis') {
        store.setThinking(false);
        store.setSession(sessionId, 'crisis_interrupted', store.moveCount, store.maxMoves);
      } else if (msg.type === 'error') {
        store.setThinking(false);
        console.error('Game WS error:', msg.message);
      }
    };

    ws.onerror = () => {
      store.setThinking(false);
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  }, [store]);

  const sendAnswer = useCallback((choiceIdx: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'answer', choice: choiceIdx }));
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return { connect, sendAnswer, disconnect };
}
