import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type FC,
} from 'react';

import type {
  Lesson,
  MidiNote,
  SessionResult,
  GameState,
} from '../types';

import { FallingNotesRenderer } from '../engine/renderer';
import { checkHit, calculateStars } from '../engine/scoring';
import { listenToDevice, getKeyboardFallback } from '../engine/midiInput';
import { initAudio, playNote, stopAll } from '../engine/audioPlayer';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GameCanvasProps {
  lesson: Lesson;
  mode: 'practice' | 'performance';
  midiDeviceId: string | null;
  onComplete: (result: SessionResult) => void;
  onBack: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** How close (in seconds) a played note must be to an expected note to count. */
const HIT_WINDOW_S = 0.15;

/** Seconds after the last note before the session auto-completes. */
const END_GRACE_S = 2;

/** Countdown ticks before the game starts. */
const COUNTDOWN_TICKS = ['3', '2', '1', 'Vai!'];
const COUNTDOWN_TICK_MS = 800;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive the MIDI range to display from the lesson notes, with padding. */
function deriveRange(notes: MidiNote[]): [number, number] {
  if (notes.length === 0) return [48, 84];
  let lo = 127;
  let hi = 0;
  for (const n of notes) {
    if (n.midi < lo) lo = n.midi;
    if (n.midi > hi) hi = n.midi;
  }
  // Pad to nearest C below and C above (+ extra octave each side for context)
  lo = Math.max(0, Math.floor(lo / 12) * 12 - 12);
  hi = Math.min(127, Math.ceil((hi + 1) / 12) * 12 + 12);
  return [lo, hi];
}

// ─── Component ────────────────────────────────────────────────────────────────

const GameCanvas: FC<GameCanvasProps> = ({
  lesson,
  mode,
  midiDeviceId,
  onComplete,
  onBack,
}) => {
  // ── Refs (mutable during game loop — never trigger re-renders) ───────────

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FallingNotesRenderer | null>(null);
  const rafIdRef = useRef<number>(0);

  /** Wall-clock timestamp of the previous frame (ms). */
  const prevFrameRef = useRef<number>(0);

  /** The mutable game state — only the ref is touched during the game loop. */
  const stateRef = useRef<GameState>({
    isPlaying: false,
    isPaused: false,
    mode,
    currentTime: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: [],
  });

  /** Set of MIDI note numbers currently pressed by the player. */
  const activeNotesRef = useRef<Set<number>>(new Set());

  /**
   * Index of the next note the player is expected to hit.
   * In practice mode this also controls time-pausing behaviour.
   */
  const nextExpectedIdxRef = useRef<number>(0);

  /** Cleanup function for MIDI / keyboard listener. */
  const inputCleanupRef = useRef<(() => void) | null>(null);

  /** Whether audio context has been initialised (requires user gesture). */
  const audioReadyRef = useRef(false);

  /** Whether the session has already been submitted (guard against double-fire). */
  const completedRef = useRef(false);

  /** Time the game loop actually started (after countdown). */
  const gameStartWallRef = useRef<number>(0);

  // ── React state (UI overlays only — changes here ARE allowed to re-render) ─

  const [phase, setPhase] = useState<
    'idle' | 'countdown' | 'playing' | 'paused' | 'done'
  >('idle');
  const [countdownText, setCountdownText] = useState('');

  // ── Build result and fire onComplete ─────────────────────────────────────

  const finishGame = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    cancelAnimationFrame(rafIdRef.current);
    stopAll();
    setPhase('done');

    const s = stateRef.current;
    let perfect = 0;
    let good = 0;
    let ok = 0;
    let miss = 0;

    for (const h of s.hits) {
      switch (h.rating) {
        case 'perfect': perfect++; break;
        case 'good':    good++;    break;
        case 'ok':      ok++;      break;
        case 'miss':    miss++;    break;
      }
    }

    // Count notes that were never attempted as misses
    const unjudged = lesson.notes.length - s.hits.length;
    miss += unjudged;

    const totalNotes = lesson.notes.length;
    const stars = calculateStars({ perfect, good, ok, miss, totalNotes });
    const duration = s.currentTime;

    const result: SessionResult = {
      lessonId: lesson.id,
      mode,
      totalNotes,
      perfect,
      good,
      ok,
      miss,
      maxCombo: s.maxCombo,
      score: s.score,
      stars,
      duration,
      completedAt: new Date().toISOString(),
    };

    onComplete(result);
  }, [lesson, mode, onComplete]);

  // ── Note-on handler (MIDI or keyboard) ───────────────────────────────────

  const handleNoteOn = useCallback(
    (midiNote: number, velocity: number) => {
      activeNotesRef.current.add(midiNote);

      const gs = stateRef.current;
      if (!gs.isPlaying || gs.isPaused) return;

      // Play the sound
      playNote(midiNote, 0.4, velocity);

      // Find nearest expected note within the hit window
      const notes = lesson.notes;
      let bestIdx = -1;
      let bestDelta = Infinity;

      for (let i = nextExpectedIdxRef.current; i < notes.length; i++) {
        const delta = Math.abs(notes[i].time - gs.currentTime);
        // Stop scanning once notes are far in the future
        if (notes[i].time - gs.currentTime > HIT_WINDOW_S) break;
        if (delta < bestDelta && delta <= HIT_WINDOW_S) {
          // Only match if this note hasn't already been judged
          const alreadyHit = gs.hits.some((h) => h.expected === notes[i]);
          if (!alreadyHit && notes[i].midi === midiNote) {
            bestDelta = delta;
            bestIdx = i;
          }
        }
      }

      if (bestIdx === -1) {
        // Wrong note or out of window — no penalty beyond breaking combo
        // (optional: could add a "wrong note" flash here)
        return;
      }

      const hit = checkHit(notes[bestIdx], midiNote, gs.currentTime);
      gs.hits.push(hit);

      // Update score & combo
      if (hit.rating === 'miss') {
        gs.combo = 0;
      } else {
        gs.combo++;
        if (gs.combo > gs.maxCombo) gs.maxCombo = gs.combo;

        const pointsMap = { perfect: 100, good: 75, ok: 50, miss: 0 } as const;
        const comboMultiplier = 1 + Math.floor(gs.combo / 10) * 0.25;
        gs.score += Math.round(pointsMap[hit.rating] * comboMultiplier);
      }

      // Advance expected index past all judged notes
      while (
        nextExpectedIdxRef.current < notes.length &&
        gs.hits.some((h) => h.expected === notes[nextExpectedIdxRef.current])
      ) {
        nextExpectedIdxRef.current++;
      }

      // Visual feedback on the renderer
      rendererRef.current?.showHitEffect(midiNote, hit.rating);
    },
    [lesson.notes],
  );

  const handleNoteOff = useCallback((midiNote: number) => {
    activeNotesRef.current.delete(midiNote);
  }, []);

  // ── Game loop ────────────────────────────────────────────────────────────

  const gameLoop = useCallback(
    (timestamp: number) => {
      const gs = stateRef.current;
      if (!gs.isPlaying || gs.isPaused) {
        prevFrameRef.current = timestamp;
        rafIdRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Elapsed seconds since last frame
      const dtMs = timestamp - prevFrameRef.current;
      prevFrameRef.current = timestamp;
      const dt = dtMs / 1000;

      // In practice mode, pause time if the next expected note hasn't been played
      let shouldAdvance = true;
      if (mode === 'practice') {
        const idx = nextExpectedIdxRef.current;
        if (idx < lesson.notes.length) {
          const expected = lesson.notes[idx];
          // If we have reached (or passed) the note's time but it hasn't been hit, wait
          if (gs.currentTime >= expected.time - 0.05) {
            shouldAdvance = false;
          }
        }
      }

      if (shouldAdvance) {
        gs.currentTime += dt;
      }

      // Mark notes that scrolled past the hit window as misses (performance mode)
      if (mode === 'performance') {
        const notes = lesson.notes;
        while (nextExpectedIdxRef.current < notes.length) {
          const n = notes[nextExpectedIdxRef.current];
          if (n.time + HIT_WINDOW_S < gs.currentTime) {
            const alreadyHit = gs.hits.some((h) => h.expected === n);
            if (!alreadyHit) {
              gs.hits.push({
                expected: n,
                played: null,
                timeDelta: (gs.currentTime - n.time) * 1000,
                rating: 'miss',
              });
              gs.combo = 0;
              rendererRef.current?.showHitEffect(n.midi, 'miss');
            }
            nextExpectedIdxRef.current++;
          } else {
            break;
          }
        }
      }

      // Render
      rendererRef.current?.render(gs, activeNotesRef.current);

      // Check for end of song
      const lastNote = lesson.notes[lesson.notes.length - 1];
      if (lastNote && gs.currentTime > lastNote.time + lastNote.duration + END_GRACE_S) {
        finishGame();
        return;
      }

      rafIdRef.current = requestAnimationFrame(gameLoop);
    },
    [lesson.notes, mode, finishGame],
  );

  // ── Start flow (user clicks Start -> countdown -> game loop) ─────────────

  const startGame = useCallback(async () => {
    // Initialise audio on first user gesture
    if (!audioReadyRef.current) {
      await initAudio();
      audioReadyRef.current = true;
    }

    // Countdown phase
    setPhase('countdown');

    for (let i = 0; i < COUNTDOWN_TICKS.length; i++) {
      setCountdownText(COUNTDOWN_TICKS[i]);
      await new Promise((r) => setTimeout(r, COUNTDOWN_TICK_MS));
    }

    // Reset game state
    const gs = stateRef.current;
    gs.isPlaying = true;
    gs.isPaused = false;
    gs.currentTime = 0;
    gs.score = 0;
    gs.combo = 0;
    gs.maxCombo = 0;
    gs.hits = [];
    nextExpectedIdxRef.current = 0;
    completedRef.current = false;

    setPhase('playing');
    gameStartWallRef.current = performance.now();
    prevFrameRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop]);

  // ── Pause / resume ───────────────────────────────────────────────────────

  const pauseGame = useCallback(() => {
    stateRef.current.isPaused = true;
    setPhase('paused');
  }, []);

  const resumeGame = useCallback(() => {
    stateRef.current.isPaused = false;
    prevFrameRef.current = performance.now();
    setPhase('playing');
  }, []);

  const quitGame = useCallback(() => {
    cancelAnimationFrame(rafIdRef.current);
    stopAll();
    stateRef.current.isPlaying = false;
    stateRef.current.isPaused = false;
    setPhase('idle');
    onBack();
  }, [onBack]);

  // ── Setup renderer + input on mount ──────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create renderer
    const renderer = new FallingNotesRenderer(canvas);
    const [lo, hi] = deriveRange(lesson.notes);
    renderer.setRange(lo, hi);
    renderer.setNotes(lesson.notes);
    rendererRef.current = renderer;

    // Draw initial idle frame
    const idleState: GameState = {
      isPlaying: false,
      isPaused: false,
      mode,
      currentTime: -1,
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: [],
    };
    renderer.render(idleState, new Set());

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [lesson, mode]);

  // ── Setup MIDI / keyboard input ──────────────────────────────────────────

  useEffect(() => {
    // Clean up previous listener
    inputCleanupRef.current?.();

    if (midiDeviceId) {
      inputCleanupRef.current = listenToDevice(
        midiDeviceId,
        handleNoteOn,
        handleNoteOff,
      );
    } else {
      inputCleanupRef.current = getKeyboardFallback(handleNoteOn, handleNoteOff);
    }

    return () => {
      inputCleanupRef.current?.();
      inputCleanupRef.current = null;
    };
  }, [midiDeviceId, handleNoteOn, handleNoteOff]);

  // ── Cleanup animation frame on unmount ───────────────────────────────────

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      stopAll();
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Canvas — fills the entire viewport */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Back button — always visible, top-left */}
      <button
        onClick={phase === 'playing' ? pauseGame : quitGame}
        className="absolute top-4 left-4 z-20 flex items-center justify-center
                   w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                   transition-colors backdrop-blur-sm"
        aria-label="Back"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Pause button — top-right, only during gameplay */}
      {phase === 'playing' && (
        <button
          onClick={pauseGame}
          className="absolute top-4 right-4 z-20 flex items-center justify-center
                     w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                     transition-colors backdrop-blur-sm"
          aria-label="Pause"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
          </svg>
        </button>
      )}

      {/* ── Idle overlay: Start button ──────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center
                        bg-black/60 backdrop-blur-sm">
          {/* Voltar button — top-left, inside overlay so it's always clickable */}
          <button
            onClick={quitGame}
            className="absolute top-4 left-4 flex items-center gap-2
                       bg-white/10 hover:bg-white/20 border border-white/20
                       text-white rounded-xl px-4 py-2 font-semibold
                       transition-all duration-300"
          >
            ← Voltar
          </button>
          <h2 className="text-white text-2xl font-bold mb-2">{lesson.title}</h2>
          <p className="text-white/60 text-sm mb-1">
            {lesson.notes.length} notas &middot; {mode === 'practice' ? 'Praticar' : 'Desafio'}
          </p>

          {midiDeviceId ? (
            <p className="text-green-400 text-sm mb-6 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
              MIDI conectado
            </p>
          ) : (
            <div className="text-center mb-6 max-w-md">
              <p className="text-amber-400 text-sm mb-3 flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                Sem MIDI &mdash; usando teclado do computador
              </p>
              <div className="bg-white/10 rounded-xl px-5 py-3 backdrop-blur-sm">
                <p className="text-white/80 text-xs leading-relaxed">
                  Use as teclas <span className="font-mono font-bold text-indigo-300">Q W E R T Y U I</span> (notas altas)
                </p>
                <p className="text-white/80 text-xs leading-relaxed">
                  e <span className="font-mono font-bold text-indigo-300">Z X C V B N M</span> (notas baixas) no teclado
                </p>
                <p className="text-white/50 text-[10px] mt-1">
                  Teclas pretas: <span className="font-mono">2 3 5 6 7</span> (altas) &middot; <span className="font-mono">S D G H J</span> (baixas)
                </p>
              </div>
            </div>
          )}

          <button
            onClick={startGame}
            className="px-16 py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500
                       text-white text-2xl font-bold transition-colors
                       shadow-lg shadow-indigo-600/40 active:scale-95
                       animate-pulse hover:animate-none"
          >
            Iniciar
          </button>
        </div>
      )}

      {/* ── Countdown overlay ───────────────────────────────────────────── */}
      {phase === 'countdown' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center
                        bg-black/50 backdrop-blur-sm">
          <span
            className="text-white text-8xl font-black animate-ping"
            style={{ animationDuration: `${COUNTDOWN_TICK_MS}ms` }}
          >
            {countdownText}
          </span>
        </div>
      )}

      {/* ── Paused overlay ──────────────────────────────────────────────── */}
      {phase === 'paused' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center
                        bg-black/70 backdrop-blur-sm gap-4">
          <h2 className="text-white text-4xl font-bold mb-6">Pausado</h2>
          <button
            onClick={resumeGame}
            className="px-10 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500
                       text-white text-lg font-semibold transition-colors
                       shadow-lg shadow-indigo-600/30"
          >
            Continuar
          </button>
          <button
            onClick={quitGame}
            className="px-10 py-3 rounded-xl bg-white/10 hover:bg-white/20
                       text-white text-lg font-medium transition-colors"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
