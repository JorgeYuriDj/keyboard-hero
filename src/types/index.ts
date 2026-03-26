// ============================================================
// Tipos centrais do app — KeyBoard Hero
// ============================================================

/** Uma nota MIDI individual dentro de uma licao */
export interface MidiNote {
  /** Numero MIDI da nota (0-127). Ex: 60 = Do central (C4) */
  midi: number;
  /** Tempo em segundos desde o inicio da musica */
  time: number;
  /** Duracao em segundos */
  duration: number;
  /** Velocity (0-127) */
  velocity: number;
  /** Nome da nota. Ex: "C4", "D#5" */
  name: string;
}

/** Resultado de uma nota tocada pelo usuario */
export interface NoteHit {
  /** A nota esperada */
  expected: MidiNote;
  /** A nota que o usuario tocou (null se nao tocou) */
  played: number | null;
  /** Diferenca de tempo em ms (positivo = atrasado, negativo = adiantado) */
  timeDelta: number;
  /** Classificacao do acerto */
  rating: 'perfect' | 'good' | 'ok' | 'miss';
}

/** Resultado de uma sessao de exercicio */
export interface SessionResult {
  lessonId: string;
  mode: 'practice' | 'performance';
  totalNotes: number;
  perfect: number;
  good: number;
  ok: number;
  miss: number;
  maxCombo: number;
  score: number;
  /** 0-3 estrelas */
  stars: number;
  /** Duracao em segundos */
  duration: number;
  /** Timestamp ISO */
  completedAt: string;
  /** Feedback do LLM (preenchido async) */
  aiFeedback?: string;
}

/** Definicao de uma licao */
export interface Lesson {
  id: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  bpm: number;
  /** Notas da licao */
  notes: MidiNote[];
  /** Licao desbloqueada? */
  unlocked: boolean;
}

/** Progresso salvo do usuario */
export interface UserProgress {
  name: string;
  level: number;
  xp: number;
  /** Melhor resultado por licao */
  bestScores: Record<string, SessionResult>;
  /** Estrelas por licao */
  stars: Record<string, number>;
  /** Dias de pratica (ISO dates) */
  practiceDays: string[];
  /** Badges conquistados */
  badges: string[];
}

/** Estado do jogo em tempo real */
export interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  mode: 'practice' | 'performance';
  currentTime: number;
  score: number;
  combo: number;
  maxCombo: number;
  hits: NoteHit[];
}

/** Dispositivo MIDI detectado */
export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
}
