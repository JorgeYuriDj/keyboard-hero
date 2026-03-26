import type { MidiNote, Lesson } from '../types';

const NOTE_MAP: Record<string, number> = {
  'C3': 48, 'D3': 50, 'E3': 52, 'F3': 53, 'G3': 55, 'A3': 57, 'B3': 59,
  'C4': 60, 'D4': 62, 'E4': 64, 'F4': 65, 'G4': 67, 'A4': 69, 'B4': 71,
  'C5': 72, 'D5': 74, 'E5': 76, 'F5': 77, 'G5': 79,
};

export function noteToMidi(name: string): number {
  const midi = NOTE_MAP[name];
  if (midi === undefined) throw new Error(`Unknown note: ${name}`);
  return midi;
}

export function generateNoteSequence(
  noteNames: string[],
  bpm: number,
  durations?: number[]
): MidiNote[] {
  const quarterDuration = 60 / bpm;
  let currentTime = 0;
  return noteNames.map((name, i) => {
    const durationMultiplier = durations?.[i] ?? 1;
    const duration = quarterDuration * durationMultiplier;
    const note: MidiNote = {
      midi: noteToMidi(name),
      time: currentTime,
      duration,
      velocity: 80,
      name,
    };
    currentTime += duration;
    return note;
  });
}

function chordAt(names: string[], time: number, duration: number, velocity = 80): MidiNote[] {
  return names.map(name => ({
    midi: noteToMidi(name),
    time,
    duration,
    velocity,
    name,
  }));
}

// Lesson 1: Do Re Mi (ascending + descending, repeated 2x = ~12 notes)
function lesson1(): MidiNote[] {
  return generateNoteSequence(
    [
      'C4', 'D4', 'E4', 'E4', 'D4', 'C4',
      'C4', 'D4', 'E4', 'E4', 'D4', 'C4',
    ],
    60
  );
}

// Lesson 2: Escala de Do Maior (ascending + descending = 15 notes)
function lesson2(): MidiNote[] {
  return generateNoteSequence(
    ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
     'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'],
    70
  );
}

// Lesson 3: Ritmo Basico (mixed durations, pattern repeated for 12 notes)
function lesson3(): MidiNote[] {
  return generateNoteSequence(
    ['C4', 'E4', 'G4', 'C5', 'G4', 'E4',
     'C4', 'E4', 'G4', 'C5', 'G4', 'C4'],
    80,
    [2, 1, 1, 2, 1, 1,
     2, 1, 1, 2, 1, 2]
  );
}

// Lesson 4: Mao Esquerda (pattern repeated to reach 12 notes)
function lesson4(): MidiNote[] {
  return generateNoteSequence(
    ['C3', 'E3', 'G3', 'C3', 'G3', 'E3',
     'C3', 'E3', 'G3', 'C3', 'G3', 'E3'],
    60
  );
}

// Lesson 5: Parabens pra Voce (Happy Birthday in C major, white keys only)
function lesson5(): MidiNote[] {
  return generateNoteSequence(
    [
      // Linha 1: "Parabens pra voce"
      'C4', 'C4', 'D4', 'C4', 'F4', 'E4',
      // Linha 2: "Parabens pra voce"
      'C4', 'C4', 'D4', 'C4', 'G4', 'F4',
      // Linha 3: "Parabens querido(a)..."
      'C4', 'C4', 'C5', 'A4', 'F4', 'E4', 'D4',
      // Linha 4: "Parabens pra voce" (final, white keys only — A4 instead of Bb4)
      'A4', 'A4', 'A4', 'F4', 'G4', 'F4',
    ],
    100,
    [
      // Linha 1
      0.75, 0.25, 1, 1, 1, 2,
      // Linha 2
      0.75, 0.25, 1, 1, 1, 2,
      // Linha 3
      0.75, 0.25, 1, 1, 1, 1, 2,
      // Linha 4
      0.75, 0.25, 1, 1, 1, 2,
    ]
  );
}

// Lesson 6: Brilha Brilha Estrelinha (Twinkle Twinkle Little Star)
function lesson6(): MidiNote[] {
  return generateNoteSequence(
    [
      'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4',
      'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4',
      'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4',
      'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4',
      'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4',
      'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4',
    ],
    90,
    [
      1, 1, 1, 1, 1, 1, 2,
      1, 1, 1, 1, 1, 1, 2,
      1, 1, 1, 1, 1, 1, 2,
      1, 1, 1, 1, 1, 1, 2,
      1, 1, 1, 1, 1, 1, 2,
      1, 1, 1, 1, 1, 1, 2,
    ]
  );
}

// Lesson 7: Duas Maos (right hand melody + left hand bass simultaneously)
function lesson7(): MidiNote[] {
  const q = 60 / 70;
  const notes: MidiNote[] = [];

  const rightHand = ['C4', 'E4', 'G4', 'C4', 'E4', 'G4'];
  const leftHand  = ['C3', 'C3', 'C3', 'C3', 'C3', 'C3'];

  for (let i = 0; i < rightHand.length; i++) {
    const time = i * q;
    notes.push({
      midi: noteToMidi(rightHand[i]),
      time,
      duration: q,
      velocity: 80,
      name: rightHand[i],
    });
    notes.push({
      midi: noteToMidi(leftHand[i]),
      time,
      duration: q,
      velocity: 70,
      name: leftHand[i],
    });
  }

  return notes;
}

// Lesson 8: Ode a Alegria (simplified Ode to Joy)
function lesson8(): MidiNote[] {
  return generateNoteSequence(
    [
      'E4', 'E4', 'F4', 'G4',
      'G4', 'F4', 'E4', 'D4',
      'C4', 'C4', 'D4', 'E4',
      'E4', 'D4', 'D4',

      'E4', 'E4', 'F4', 'G4',
      'G4', 'F4', 'E4', 'D4',
      'C4', 'C4', 'D4', 'E4',
      'D4', 'C4', 'C4',
    ],
    100,
    [
      1, 1, 1, 1,
      1, 1, 1, 1,
      1, 1, 1, 1,
      1.5, 0.5, 2,

      1, 1, 1, 1,
      1, 1, 1, 1,
      1, 1, 1, 1,
      1.5, 0.5, 2,
    ]
  );
}

// Lesson 9: Acordes Basicos (C, F, G major chords as half notes)
function lesson9(): MidiNote[] {
  const q = 60 / 70;
  const halfDuration = q * 2;
  const notes: MidiNote[] = [];
  let time = 0;

  const chords: string[][] = [
    ['C4', 'E4', 'G4'],
    ['F4', 'A4', 'C5'],
    ['G4', 'B4', 'D5'],
    ['C4', 'E4', 'G4'],
    ['F4', 'A4', 'C5'],
    ['G4', 'B4', 'D5'],
    ['C4', 'E4', 'G4'],
  ];

  for (const chord of chords) {
    notes.push(...chordAt(chord, time, halfDuration, 100));
    time += halfDuration;
  }

  return notes;
}

// Lesson 10: Melodia com Acordes (melody right hand + chord roots left hand)
function lesson10(): MidiNote[] {
  const q = 60 / 80;
  const notes: MidiNote[] = [];

  const melody: Array<[string, number]> = [
    ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1],
    ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
    ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1],
    ['E4', 1.5], ['D4', 0.5], ['D4', 2],
  ];

  const bassPattern: Array<[string, number, number]> = [
    ['C3', 0, 4],
    ['G3', 4, 4],
    ['C3', 8, 4],
    ['G3', 12, 2],
    ['C3', 14, 2],
  ];

  let time = 0;
  for (const [name, dur] of melody) {
    const duration = q * dur;
    notes.push({
      midi: noteToMidi(name),
      time,
      duration,
      velocity: 80,
      name,
    });
    time += duration;
  }

  for (const [name, startBeat, dur] of bassPattern) {
    notes.push({
      midi: noteToMidi(name),
      time: startBeat * q,
      duration: dur * q,
      velocity: 70,
      name,
    });
  }

  return notes;
}

export const LESSONS: Lesson[] = [
  {
    id: 'lesson-01',
    title: 'Do Re Mi',
    description: 'Suas primeiras tres notas: Do, Re, Mi. Toque devagar e com calma.',
    difficulty: 1,
    bpm: 60,
    notes: lesson1(),
    unlocked: true,
  },
  {
    id: 'lesson-02',
    title: 'Escala de Do Maior',
    description: 'A escala completa de Do maior, de C4 ate C5.',
    difficulty: 1,
    bpm: 70,
    notes: lesson2(),
    unlocked: false,
  },
  {
    id: 'lesson-03',
    title: 'Ritmo Basico',
    description: 'Pratique ritmos mistos com notas de duracao diferente.',
    difficulty: 2,
    bpm: 80,
    notes: lesson3(),
    unlocked: false,
  },
  {
    id: 'lesson-04',
    title: 'Mao Esquerda',
    description: 'Introducao a mao esquerda com notas graves.',
    difficulty: 2,
    bpm: 60,
    notes: lesson4(),
    unlocked: false,
  },
  {
    id: 'lesson-05',
    title: 'Parabens pra Voce',
    description: 'Toque a melodia de Parabens pra Voce! Uma musica que todo mundo conhece.',
    difficulty: 2,
    bpm: 100,
    notes: lesson5(),
    unlocked: false,
  },
  {
    id: 'lesson-06',
    title: 'Brilha Brilha Estrelinha',
    description: 'A classica melodia infantil. Otima para praticar repeticoes.',
    difficulty: 2,
    bpm: 90,
    notes: lesson6(),
    unlocked: false,
  },
  {
    id: 'lesson-07',
    title: 'Duas Maos',
    description: 'Seu primeiro desafio com as duas maos tocando ao mesmo tempo!',
    difficulty: 3,
    bpm: 70,
    notes: lesson7(),
    unlocked: false,
  },
  {
    id: 'lesson-08',
    title: 'Ode a Alegria',
    description: 'A famosa melodia de Beethoven simplificada para iniciantes.',
    difficulty: 3,
    bpm: 100,
    notes: lesson8(),
    unlocked: false,
  },
  {
    id: 'lesson-09',
    title: 'Acordes Basicos',
    description: 'Aprenda os acordes de Do, Fa e Sol maior. Toque todas as notas juntas!',
    difficulty: 4,
    bpm: 70,
    notes: lesson9(),
    unlocked: false,
  },
  {
    id: 'lesson-10',
    title: 'Melodia com Acordes',
    description: 'O desafio final: melodia na mao direita com baixo na mao esquerda.',
    difficulty: 5,
    bpm: 80,
    notes: lesson10(),
    unlocked: false,
  },
];
