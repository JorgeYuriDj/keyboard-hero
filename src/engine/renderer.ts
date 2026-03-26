/**
 * FallingNotesRenderer — Canvas 2D engine for a Guitar Hero / Synthesia-style
 * piano learning app. Renders a piano keyboard, falling note blocks, hit
 * feedback effects, and a score/combo overlay.
 *
 * Performance: pre-bakes the keyboard to an offscreen canvas, avoids
 * allocations inside the render loop, and reuses typed-array buffers.
 */

import type { MidiNote, GameState } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const BG_COLOR = '#0f0d1a';
const HIT_LINE_COLOR = 'rgba(255,255,255,0.12)';
const GRID_LINE_COLOR = 'rgba(255,255,255,0.04)';

/** Boomwhacker palette indexed by pitch class (C=0 … B=11). */
const NOTE_COLORS: Record<number, string> = {
  0:  '#e63946', // C  — red
  1:  '#c1440e', // C# — dark orange
  2:  '#f4a261', // D  — orange
  3:  '#c9b800', // D# — dark yellow
  4:  '#e9c46a', // E  — yellow
  5:  '#2a9d8f', // F  — green
  6:  '#1b7a6e', // F# — dark green
  7:  '#00b4d8', // G  — cyan
  8:  '#0077b6', // G# — dark cyan
  9:  '#3a86ff', // A  — blue
  10: '#6930c3', // A# — dark purple
  11: '#9d4edd', // B  — purple
};

/** Which pitch classes are black keys */
const BLACK_KEY_CLASSES = new Set([1, 3, 6, 8, 10]);

const WHITE_KEY_WIDTH = 40;
const BLACK_KEY_WIDTH = 24;
const KEYBOARD_HEIGHT = 80;
const BLACK_KEY_HEIGHT = 50;

const DEFAULT_LOW = 48;  // C3
const DEFAULT_HIGH = 84; // C6

const DEFAULT_LOOK_AHEAD = 3; // seconds

// Hit-effect durations (ms)
const HIT_EFFECT_DURATION = 400;
const MISS_FADE_DURATION = 600;

// Rating → glow colour
const RATING_GLOW: Record<string, string> = {
  perfect: '#00ff88',
  good:    '#88ff00',
  ok:      '#ffcc00',
  miss:    '#ff2244',
};

// ─── Helpers (zero-alloc in hot path) ────────────────────────────────────────

function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

function isBlackKey(midi: number): boolean {
  return BLACK_KEY_CLASSES.has(pitchClass(midi));
}

/** Count the number of white keys in a MIDI range [lo, hi). */
function countWhiteKeys(lo: number, hi: number): number {
  let n = 0;
  for (let m = lo; m < hi; m++) {
    if (!isBlackKey(m)) n++;
  }
  return n;
}

// ─── Hit-effect record (pooled) ──────────────────────────────────────────────

interface HitEffect {
  midi: number;
  rating: string;
  startTime: number;  // performance.now()
  active: boolean;
}

// ─── Main class ──────────────────────────────────────────────────────────────

export class FallingNotesRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;


  // MIDI range
  private lowMidi = DEFAULT_LOW;
  private highMidi = DEFAULT_HIGH;

  // Pre-computed key layout: maps midi → { x, w, isBlack }
  private keyLayout: Array<{ x: number; w: number; isBlack: boolean }> = [];
  private totalWhiteKeys = 0;
  private keyboardX = 0; // left offset to centre the keyboard

  // Notes to render
  private notes: MidiNote[] = [];

  // Hit-effect pool (pre-allocated, ring buffer)
  private effects: HitEffect[] = [];
  private effectPoolSize = 64;

  // Resize observer
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    // Pre-allocate effect pool
    for (let i = 0; i < this.effectPoolSize; i++) {
      this.effects.push({ midi: 0, rating: 'miss', startTime: 0, active: false });
    }

    this.resize();
    this.buildKeyLayout();

    // Watch for container resizes
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      if (canvas.parentElement) {
        this.resizeObserver.observe(canvas.parentElement);
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setNotes(notes: MidiNote[]): void {
    this.notes = notes;
  }

  setRange(lowMidi: number, highMidi: number): void {
    this.lowMidi = lowMidi;
    this.highMidi = highMidi;
    this.buildKeyLayout();

  }

  render(
    gameState: GameState,
    activeNotes: Set<number>,
    lookAheadSeconds = DEFAULT_LOOK_AHEAD,
  ): void {
    const { canvas, ctx } = this;
    // Use CSS dimensions (the DPR transform is already applied)
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // ── 1. Background ────────────────────────────────────────────────────
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    const hitLineY = h - KEYBOARD_HEIGHT;

    // ── 2. Grid lines (every 0.5s) ───────────────────────────────────────
    this.drawGridLines(ctx, w, hitLineY, gameState.currentTime, lookAheadSeconds);

    // ── 3. Falling notes ─────────────────────────────────────────────────
    this.drawNotes(ctx, hitLineY, gameState, lookAheadSeconds);

    // ── 4. Hit line ──────────────────────────────────────────────────────
    ctx.fillStyle = HIT_LINE_COLOR;
    ctx.fillRect(0, hitLineY - 2, w, 4);

    // ── 5. Hit effects (glow on keyboard) ────────────────────────────────
    this.drawHitEffects(ctx, hitLineY);

    // ── 6. Keyboard ──────────────────────────────────────────────────────
    this.drawKeyboard(ctx, hitLineY, activeNotes);

    // ── 7. HUD overlay ───────────────────────────────────────────────────
    this.drawHud(ctx, w, gameState);
  }

  showHitEffect(midi: number, rating: 'perfect' | 'good' | 'ok' | 'miss'): void {
    // Find an inactive slot in the pool
    for (let i = 0; i < this.effects.length; i++) {
      if (!this.effects[i].active) {
        this.effects[i].midi = midi;
        this.effects[i].rating = rating;
        this.effects[i].startTime = performance.now();
        this.effects[i].active = true;
        return;
      }
    }
    // Pool full — overwrite the oldest
    let oldest = 0;
    for (let i = 1; i < this.effects.length; i++) {
      if (this.effects[i].startTime < this.effects[oldest].startTime) oldest = i;
    }
    this.effects[oldest].midi = midi;
    this.effects[oldest].rating = rating;
    this.effects[oldest].startTime = performance.now();
    this.effects[oldest].active = true;
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    // Guard against zero-size container (element not yet visible / collapsed)
    if (rect.width === 0 || rect.height === 0) return;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.buildKeyLayout();
  }

  destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.notes = [];
    this.keyLayout = [];

  }

  // ── Internal: key layout ───────────────────────────────────────────────

  private buildKeyLayout(): void {
    const parent = this.canvas.parentElement;
    const canvasW = parent ? parent.getBoundingClientRect().width : this.canvas.width;

    this.totalWhiteKeys = countWhiteKeys(this.lowMidi, this.highMidi);
    const totalKeyboardW = this.totalWhiteKeys * WHITE_KEY_WIDTH;
    this.keyboardX = Math.max(0, (canvasW - totalKeyboardW) / 2);

    // Build a layout map for every MIDI note in range
    this.keyLayout = new Array(128);

    let whiteIndex = 0;
    for (let m = this.lowMidi; m < this.highMidi; m++) {
      if (isBlackKey(m)) {
        // Black key sits between the previous and next white key
        const x = this.keyboardX + whiteIndex * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2;
        this.keyLayout[m] = { x, w: BLACK_KEY_WIDTH, isBlack: true };
      } else {
        const x = this.keyboardX + whiteIndex * WHITE_KEY_WIDTH;
        this.keyLayout[m] = { x, w: WHITE_KEY_WIDTH, isBlack: false };
        whiteIndex++;
      }
    }

  }

  // ── Internal: grid lines ───────────────────────────────────────────────

  private drawGridLines(
    ctx: CanvasRenderingContext2D,
    w: number,
    hitLineY: number,
    currentTime: number,
    lookAhead: number,
  ): void {
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = 1;

    const step = 0.5; // seconds
    const start = Math.ceil(currentTime / step) * step;
    for (let t = start; t < currentTime + lookAhead; t += step) {
      const frac = (t - currentTime) / lookAhead;
      const y = hitLineY - frac * hitLineY;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  // ── Internal: falling notes ────────────────────────────────────────────

  private drawNotes(
    ctx: CanvasRenderingContext2D,
    hitLineY: number,
    gameState: GameState,
    lookAhead: number,
  ): void {
    const { currentTime, hits } = gameState;
    const notes = this.notes;

    // Build a quick set of missed note indices for fade effect
    // (We use the hits array — a note is "hit" if it appears there.)
    // For performance we iterate only visible notes.

    const windowStart = currentTime - 1; // show 1s of past notes (fading)
    const windowEnd = currentTime + lookAhead;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const noteEnd = note.time + note.duration;

      // Skip notes outside the visible window
      if (noteEnd < windowStart || note.time > windowEnd) continue;

      // Skip notes outside MIDI range
      const key = this.keyLayout[note.midi];
      if (!key) continue;

      // Vertical position: note.time relative to currentTime
      const topFrac = (note.time - currentTime) / lookAhead;
      const botFrac = (noteEnd - currentTime) / lookAhead;

      const noteTop = hitLineY - topFrac * hitLineY;
      const noteBot = hitLineY - botFrac * hitLineY;
      const noteH = Math.max(4, noteTop - noteBot);

      // Determine colour and alpha
      const pc = pitchClass(note.midi);
      let color = NOTE_COLORS[pc] || '#ffffff';
      let alpha = 1.0;

      // Check if this note has been judged already (past the hit line)
      if (note.time < currentTime) {
        const hit = this.findHitForNote(note, hits);
        if (hit) {
          if (hit.rating === 'miss') {
            color = '#ff2244';
            // Fade out over 0.6s after passing the hit line
            const pastSec = currentTime - note.time;
            alpha = Math.max(0, 1 - pastSec / 0.6);
          } else {
            // Hit successfully — quick fade out
            const pastSec = currentTime - note.time;
            alpha = Math.max(0, 1 - pastSec / 0.3);
            color = RATING_GLOW[hit.rating] || color;
          }
        } else {
          // Not yet judged but past hit line — keep normal colour, slight dim
          const pastSec = currentTime - noteEnd;
          if (pastSec > 0) {
            alpha = Math.max(0, 1 - pastSec / 0.8);
            color = '#ff2244';
          }
        }
      }

      if (alpha <= 0) continue;

      ctx.globalAlpha = alpha;

      // Note body
      const radius = 4;
      this.roundRect(ctx, key.x + 1, noteBot, key.w - 2, noteH, radius);
      ctx.fillStyle = color;
      ctx.fill();

      // Subtle inner highlight (top edge)
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(key.x + 3, noteBot, key.w - 6, Math.min(3, noteH));

      ctx.globalAlpha = 1.0;
    }
  }

  /**
   * Find a matching NoteHit for a given MidiNote. Uses a simple linear scan
   * because the hits array is typically small (only recent hits).
   */
  private findHitForNote(note: MidiNote, hits: readonly NoteHit[]): NoteHit | null {
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (h.expected === note) return h;
      // Also match by midi + time proximity
      if (
        h.expected.midi === note.midi &&
        Math.abs(h.expected.time - note.time) < 0.01
      ) {
        return h;
      }
    }
    return null;
  }

  // ── Internal: hit effects ──────────────────────────────────────────────

  private drawHitEffects(ctx: CanvasRenderingContext2D, hitLineY: number): void {
    const now = performance.now();

    for (let i = 0; i < this.effects.length; i++) {
      const fx = this.effects[i];
      if (!fx.active) continue;

      const elapsed = now - fx.startTime;
      const duration = fx.rating === 'miss' ? MISS_FADE_DURATION : HIT_EFFECT_DURATION;
      if (elapsed > duration) {
        fx.active = false;
        continue;
      }

      const progress = elapsed / duration;
      const key = this.keyLayout[fx.midi];
      if (!key) continue;

      const glowColor = RATING_GLOW[fx.rating] || '#ffffff';
      const alpha = 1 - progress;
      const spread = 10 + progress * 30;

      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = spread;
      ctx.fillStyle = glowColor;
      ctx.fillRect(key.x, hitLineY - 6, key.w, 12);
      ctx.restore();
    }
  }

  // ── Internal: keyboard ─────────────────────────────────────────────────

  private drawKeyboard(
    ctx: CanvasRenderingContext2D,
    hitLineY: number,
    activeNotes: Set<number>,
  ): void {
    const kbY = hitLineY;

    // Draw white keys first
    for (let m = this.lowMidi; m < this.highMidi; m++) {
      const key = this.keyLayout[m];
      if (!key || key.isBlack) continue;

      const active = activeNotes.has(m);
      const pressed = active;

      // Key body
      ctx.fillStyle = pressed ? '#d0d0ff' : '#f0f0f0';
      ctx.fillRect(key.x, kbY, key.w, KEYBOARD_HEIGHT);

      // Border
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.strokeRect(key.x, kbY, key.w, KEYBOARD_HEIGHT);

      // Active glow
      if (active) {
        const pc = pitchClass(m);
        const color = NOTE_COLORS[pc] || '#ffffff';
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = color;
        ctx.fillRect(key.x + 1, kbY + 1, key.w - 2, KEYBOARD_HEIGHT - 2);
        ctx.restore();
      }

      // Note label at the bottom of each C
      if (pitchClass(m) === 0) {
        const octave = Math.floor(m / 12) - 1;
        ctx.fillStyle = '#666';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`C${octave}`, key.x + key.w / 2, kbY + KEYBOARD_HEIGHT - 6);
      }
    }

    // Draw black keys on top
    for (let m = this.lowMidi; m < this.highMidi; m++) {
      const key = this.keyLayout[m];
      if (!key || !key.isBlack) continue;

      const active = activeNotes.has(m);

      ctx.fillStyle = active ? '#444466' : '#222';
      this.roundRect(ctx, key.x, kbY, key.w, BLACK_KEY_HEIGHT, 0, 0, 3, 3);
      ctx.fill();

      // Active glow
      if (active) {
        const pc = pitchClass(m);
        const color = NOTE_COLORS[pc] || '#ffffff';
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = color;
        this.roundRect(ctx, key.x + 1, kbY + 1, key.w - 2, BLACK_KEY_HEIGHT - 2, 0, 0, 3, 3);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ── Internal: HUD ──────────────────────────────────────────────────────

  private drawHud(ctx: CanvasRenderingContext2D, w: number, gameState: GameState): void {
    // Score — top right
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`${gameState.score.toLocaleString()}`, w - 20, 16);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('PONTOS', w - 20, 42);

    // Combo — shown prominently when > 5
    if (gameState.combo > 5) {
      const comboScale = Math.min(1.4, 1 + (gameState.combo - 5) * 0.02);
      const fontSize = Math.round(28 * comboScale);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Glow behind text
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 15 + gameState.combo * 0.5;
      ctx.fillStyle = '#00ff88';
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.fillText(`${gameState.combo}x`, w / 2, 16);

      ctx.shadowBlur = 0;
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,255,136,0.6)';
      ctx.fillText('COMBO', w / 2, 20 + fontSize);
    }

    // Mode indicator — top left
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const modeLabel = gameState.mode === 'practice' ? 'PRATICAR' : 'DESAFIO';
    ctx.fillText(modeLabel, 16, 16);

    // Pause overlay
    if (gameState.isPaused) {
      ctx.fillStyle = 'rgba(15,13,26,0.7)';
      const parent = this.canvas.parentElement;
      const canvasH = parent ? parent.getBoundingClientRect().height : this.canvas.height;
      ctx.fillRect(0, 0, w, canvasH);

      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSADO', w / 2, canvasH / 2);
    }

    ctx.restore();
  }

  // ── Utility: rounded rectangle ─────────────────────────────────────────

  /**
   * Draw a rounded rectangle path. Supports either a uniform radius or
   * per-corner radii (topLeft, topRight, bottomRight, bottomLeft).
   */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    tlOrAll: number = 0,
    tr?: number,
    br?: number,
    bl?: number,
  ): void {
    const tl = tlOrAll;
    const trR = tr ?? tl;
    const brR = br ?? tl;
    const blR = bl ?? tl;

    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - trR, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + trR);
    ctx.lineTo(x + w, y + h - brR);
    ctx.quadraticCurveTo(x + w, y + h, x + w - brR, y + h);
    ctx.lineTo(x + blR, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - blR);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }
}

// Re-export NoteHit type reference used internally (avoids circular import if
// the caller import { NoteHit } from '../types')
type NoteHit = import('../types').NoteHit;
