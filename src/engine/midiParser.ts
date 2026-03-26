import { Midi } from '@tonejs/midi';
import type { MidiNote } from '../types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const NOTE_COLORS: Record<string, string> = {
  C: '#FF4136',
  D: '#FF851B',
  E: '#FFDC00',
  F: '#2ECC40',
  G: '#0074D9',
  A: '#B10DC9',
  B: '#FF69B4',
};

export function noteNumberToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function parseMidiFile(arrayBuffer: ArrayBuffer): MidiNote[] {
  const midi = new Midi(arrayBuffer);
  const notes: MidiNote[] = [];

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      notes.push({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
        name: noteNumberToName(note.midi),
      });
    }
  }

  notes.sort((a, b) => a.time - b.time);
  return notes;
}
