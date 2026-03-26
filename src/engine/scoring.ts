import type { MidiNote, NoteHit } from '../types';

const PERFECT_WINDOW_MS = 50;
const GOOD_WINDOW_MS = 100;
const OK_WINDOW_MS = 150;

const POINTS: Record<NoteHit['rating'], number> = {
  perfect: 100,
  good: 75,
  ok: 50,
  miss: 0,
};

function getRating(timeDeltaMs: number, correctNote: boolean): NoteHit['rating'] {
  if (!correctNote) return 'miss';
  if (timeDeltaMs <= PERFECT_WINDOW_MS) return 'perfect';
  if (timeDeltaMs <= GOOD_WINDOW_MS) return 'good';
  if (timeDeltaMs <= OK_WINDOW_MS) return 'ok';
  return 'miss';
}

export function checkHit(
  expectedNote: MidiNote,
  playedMidi: number,
  currentTime: number
): NoteHit {
  const timeDeltaMs = Math.abs(currentTime - expectedNote.time) * 1000;
  const correctNote = playedMidi === expectedNote.midi;
  const rating = getRating(timeDeltaMs, correctNote);

  return {
    expected: expectedNote,
    played: playedMidi,
    timeDelta: timeDeltaMs,
    rating,
  };
}

export function calculateStars(result: {
  perfect: number;
  good: number;
  ok: number;
  miss: number;
  totalNotes: number;
}): number {
  if (result.totalNotes === 0) return 0;

  const weighted =
    result.perfect * POINTS.perfect +
    result.good * POINTS.good +
    result.ok * POINTS.ok;

  const maxScore = result.totalNotes * POINTS.perfect;
  const ratio = weighted / maxScore;

  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
}

export function calculateXP(
  stars: number,
  difficulty: number,
  combo: number
): number {
  const baseXP = stars * 50;
  const difficultyMultiplier = 1 + (difficulty - 1) * 0.25;
  const comboBonus = Math.floor(combo / 10) * 10;

  return Math.round(baseXP * difficultyMultiplier + comboBonus);
}
