import { create } from 'zustand';

export type GameStatus = 'idle' | 'landing' | 'active' | 'finished_a' | 'finished_b' | 'crisis_interrupted';

export interface GameQuestion {
  text: string;
  choices: string[];
  move: number;
}

export interface GameResult {
  scenario: 'A' | 'B';
  confidence: number;
  topic: string;
  topic_label: string;
  moves: number;
  time_seconds: number;
}

export interface LeaderboardEntryData {
  rank: number;
  pseudonym: string;
  moves: number;
  score: number;
  scenario: string;
  time_seconds: number;
}

interface GameState {
  sessionId: string | null;
  status: GameStatus;
  moveCount: number;
  maxMoves: number;
  currentQuestion: GameQuestion | null;
  result: GameResult | null;
  pseudonym: string | null;
  pseudonymId: string | null;
  isThinking: boolean;
  selectedIdx: number | null;
  leaderboard: LeaderboardEntryData[];
  myRank: number | null;
  showCurtain: boolean;
  showConfetti: boolean;
  showPseudonymModal: boolean;
  gameStartTime: number | null;
  landingAnswerCount: number;
  landingStartTime: number | null;

  // Actions
  setSession: (id: string, status: GameStatus, moveCount: number, maxMoves: number) => void;
  setQuestion: (q: GameQuestion) => void;
  setResult: (r: GameResult) => void;
  setThinking: (v: boolean) => void;
  setSelectedIdx: (idx: number | null) => void;
  setPseudonym: (name: string, id: string) => void;
  setLeaderboard: (entries: LeaderboardEntryData[], myRank: number | null) => void;
  setShowCurtain: (v: boolean) => void;
  setShowConfetti: (v: boolean) => void;
  setShowPseudonymModal: (v: boolean) => void;
  incrementLandingAnswer: () => void;
  startLandingTimer: () => void;
  startGameTimer: () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  sessionId: null,
  status: 'idle',
  moveCount: 0,
  maxMoves: 12,
  currentQuestion: null,
  result: null,
  pseudonym: null,
  pseudonymId: null,
  isThinking: false,
  selectedIdx: null,
  leaderboard: [],
  myRank: null,
  showCurtain: false,
  showConfetti: false,
  showPseudonymModal: false,
  gameStartTime: null,
  landingAnswerCount: 0,
  landingStartTime: null,

  setSession: (id, status, moveCount, maxMoves) => set({ sessionId: id, status, moveCount, maxMoves }),
  setQuestion: (q) => set({ currentQuestion: q }),
  setResult: (r) => set({ result: r }),
  setThinking: (v) => set({ isThinking: v }),
  setSelectedIdx: (idx) => set({ selectedIdx: idx }),
  setPseudonym: (name, id) => set({ pseudonym: name, pseudonymId: id }),
  setLeaderboard: (entries, myRank) => set({ leaderboard: entries, myRank }),
  setShowCurtain: (v) => set({ showCurtain: v }),
  setShowConfetti: (v) => set({ showConfetti: v }),
  setShowPseudonymModal: (v) => set({ showPseudonymModal: v }),
  incrementLandingAnswer: () => set((s) => ({ landingAnswerCount: s.landingAnswerCount + 1 })),
  startLandingTimer: () => set((s) => ({ landingStartTime: s.landingStartTime ?? Date.now() })),
  startGameTimer: () => set({ gameStartTime: Date.now() }),
  reset: () => set({
    status: 'idle',
    moveCount: 0,
    currentQuestion: null,
    result: null,
    isThinking: false,
    selectedIdx: null,
    showCurtain: false,
    showConfetti: false,
    showPseudonymModal: false,
    gameStartTime: null,
  }),
}));
