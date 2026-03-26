import * as Tone from 'tone';

let synth: Tone.PolySynth | null = null;

export async function initAudio(): Promise<void> {
  await Tone.start();

  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: 'triangle8',
    },
    envelope: {
      attack: 0.005,
      decay: 0.3,
      sustain: 0.2,
      release: 1.2,
    },
  }).toDestination();
  synth.maxPolyphony = 32;
}

export function playNote(midi: number, duration: number, velocity: number): void {
  if (!synth) return;

  const freq = Tone.Frequency(midi, 'midi').toFrequency();
  const normalizedVelocity = Math.max(0, Math.min(1, velocity / 127));

  synth.triggerAttackRelease(freq, duration, Tone.now(), normalizedVelocity);
}

export function stopAll(): void {
  if (!synth) return;
  synth.releaseAll();
}

export function setVolume(vol: number): void {
  if (!synth) return;

  const clamped = Math.max(0, Math.min(100, vol));

  if (clamped === 0) {
    synth.volume.value = -Infinity;
  } else {
    synth.volume.value = Tone.gainToDb(clamped / 100);
  }
}
