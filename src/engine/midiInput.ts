import type { MidiDevice } from '../types';

export async function initMidi(): Promise<MidiDevice[]> {
  if (!navigator.requestMIDIAccess) {
    throw new Error('WebMIDI is not supported in this browser');
  }

  const access = await navigator.requestMIDIAccess({ sysex: false });
  const devices: MidiDevice[] = [];

  access.inputs.forEach((input) => {
    devices.push({
      id: input.id,
      name: input.name ?? 'Unknown Device',
      manufacturer: input.manufacturer ?? 'Unknown',
    });
  });

  return devices;
}

export function listenToDevice(
  deviceId: string,
  onNoteOn: (note: number, velocity: number) => void,
  onNoteOff: (note: number) => void
): () => void {
  let input: MIDIInput | null = null;

  const setup = async () => {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    input = access.inputs.get(deviceId) ?? null;

    if (!input) {
      throw new Error(`MIDI device not found: ${deviceId}`);
    }

    input.onmidimessage = (event: MIDIMessageEvent) => {
      if (!event.data) return;
      const data = Array.from(event.data);
      const [status, note, velocity] = data;
      const command = status & 0xf0;

      if (command === 0x90 && velocity > 0) {
        onNoteOn(note, velocity);
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        onNoteOff(note);
      }
    };
  };

  setup();

  return () => {
    if (input) {
      input.onmidimessage = null;
    }
  };
}

const KEY_TO_MIDI: Record<string, number> = {
  z: 48,           // C3
  s: 49,           // C#3
  x: 50,           // D3
  d: 51,           // D#3
  c: 52,           // E3
  v: 53,           // F3
  g: 54,           // F#3
  b: 55,           // G3
  h: 56,           // G#3
  n: 57,           // A3
  j: 58,           // A#3
  m: 59,           // B3
  ',': 60,         // C4
  l: 61,           // C#4
  '.': 62,         // D4
  ';': 63,         // D#4
  '/': 64,         // E4
  q: 60,           // C4
  '2': 61,         // C#4
  w: 62,           // D4
  '3': 63,         // D#4
  e: 64,           // E4
  r: 65,           // F4
  '5': 66,         // F#4
  t: 67,           // G4
  '6': 68,         // G#4
  y: 69,           // A4
  '7': 70,         // A#4
  u: 71,           // B4
  i: 72,           // C5
};

export function getKeyboardFallback(
  onNoteOn: (note: number, velocity: number) => void,
  onNoteOff: (note: number) => void
): () => void {
  const activeKeys = new Set<string>();

  const handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (activeKeys.has(key)) return;

    const midi = KEY_TO_MIDI[key];
    if (midi !== undefined) {
      event.preventDefault();
      activeKeys.add(key);
      onNoteOn(midi, 100);
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    activeKeys.delete(key);

    const midi = KEY_TO_MIDI[key];
    if (midi !== undefined) {
      event.preventDefault();
      onNoteOff(midi);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    activeKeys.clear();
  };
}
