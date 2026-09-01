export const CHORD_TUNING = ['E', 'A', 'D', 'G', 'B', 'e'] as const;

export type ChordString = (typeof CHORD_TUNING)[number];

export type ChordShape = {
  chord: string;
  name: string;
  tuning: typeof CHORD_TUNING;
  frets: Array<number | 'x'>;
  fingers?: Array<0 | 1 | 2 | 3 | 4 | 'x'>;
  rootString?: ChordString;
  baseFret?: number;
  barres?: Array<{
    fret: number;
    fromString: number;
    toString: number;
    finger?: 1 | 2 | 3 | 4;
  }>;
};

const createShape = (shape: Omit<ChordShape, 'tuning'>): ChordShape => ({
  ...shape,
  tuning: CHORD_TUNING,
});

const eMajorShape = (chord: string, name: string, baseFret: number): ChordShape =>
  createShape({
    chord,
    name,
    frets: [baseFret, baseFret + 2, baseFret + 2, baseFret + 1, baseFret, baseFret],
    fingers: [1, 3, 4, 2, 1, 1],
    rootString: 'E',
    baseFret,
    barres: [{ fret: baseFret, fromString: 0, toString: 5, finger: 1 }],
  });

const aMajorShape = (chord: string, name: string, baseFret: number): ChordShape =>
  createShape({
    chord,
    name,
    frets: ['x', baseFret, baseFret + 2, baseFret + 2, baseFret + 2, baseFret],
    fingers: ['x', 1, 3, 3, 3, 1],
    rootString: 'A',
    baseFret,
    barres: [{ fret: baseFret, fromString: 1, toString: 5, finger: 1 }],
  });

const eMinorShape = (chord: string, name: string, baseFret: number): ChordShape =>
  createShape({
    chord,
    name,
    frets: [baseFret, baseFret + 2, baseFret + 2, baseFret, baseFret, baseFret],
    fingers: [1, 3, 4, 1, 1, 1],
    rootString: 'E',
    baseFret,
    barres: [{ fret: baseFret, fromString: 0, toString: 5, finger: 1 }],
  });

const aMinorShape = (chord: string, name: string, baseFret: number): ChordShape =>
  createShape({
    chord,
    name,
    frets: ['x', baseFret, baseFret + 2, baseFret + 2, baseFret + 1, baseFret],
    fingers: ['x', 1, 3, 4, 2, 1],
    rootString: 'A',
    baseFret,
    barres: [{ fret: baseFret, fromString: 1, toString: 5, finger: 1 }],
  });

const eSevenShape = (chord: string, name: string, baseFret: number): ChordShape =>
  createShape({
    chord,
    name,
    frets: [baseFret, baseFret + 2, baseFret, baseFret + 1, baseFret, baseFret],
    fingers: [1, 3, 1, 2, 1, 1],
    rootString: 'E',
    baseFret,
    barres: [{ fret: baseFret, fromString: 0, toString: 5, finger: 1 }],
  });

const aSevenShape = (chord: string, name: string, baseFret: number): ChordShape =>
  createShape({
    chord,
    name,
    frets: ['x', baseFret, baseFret + 2, baseFret, baseFret + 2, baseFret],
    fingers: ['x', 1, 3, 1, 4, 1],
    rootString: 'A',
    baseFret,
    barres: [{ fret: baseFret, fromString: 1, toString: 5, finger: 1 }],
  });

const eMinorSevenShape = (chord: string, name: string, baseFret: number): ChordShape =>
  createShape({
    chord,
    name,
    frets: [baseFret, baseFret + 2, baseFret, baseFret, baseFret, baseFret],
    fingers: [1, 3, 1, 1, 1, 1],
    rootString: 'E',
    baseFret,
    barres: [{ fret: baseFret, fromString: 0, toString: 5, finger: 1 }],
  });

const aMinorSevenShape = (chord: string, name: string, baseFret: number): ChordShape =>
  createShape({
    chord,
    name,
    frets: ['x', baseFret, baseFret + 2, baseFret, baseFret + 1, baseFret],
    fingers: ['x', 1, 3, 1, 2, 1],
    rootString: 'A',
    baseFret,
    barres: [{ fret: baseFret, fromString: 1, toString: 5, finger: 1 }],
  });

export const CHORD_SHAPE_REGISTRY: Record<string, ChordShape> = {
  C: createShape({
    chord: 'C',
    name: 'Do Maior',
    frets: ['x', 3, 2, 0, 1, 0],
    fingers: ['x', 3, 2, 0, 1, 0],
    rootString: 'A',
    baseFret: 1,
  }),
  'C#': aMajorShape('C#', 'Do sustenido Maior', 4),
  Db: aMajorShape('Db', 'Re bemol Maior', 4),
  D: createShape({
    chord: 'D',
    name: 'Re Maior',
    frets: ['x', 'x', 0, 2, 3, 2],
    fingers: ['x', 'x', 0, 1, 3, 2],
    rootString: 'D',
    baseFret: 1,
  }),
  'D#': aMajorShape('D#', 'Re sustenido Maior', 6),
  Eb: aMajorShape('Eb', 'Mi bemol Maior', 6),
  E: createShape({
    chord: 'E',
    name: 'Mi Maior',
    frets: [0, 2, 2, 1, 0, 0],
    fingers: [0, 2, 3, 1, 0, 0],
    rootString: 'E',
    baseFret: 1,
  }),
  F: eMajorShape('F', 'Fa Maior', 1),
  'F#': eMajorShape('F#', 'Fa sustenido Maior', 2),
  Gb: eMajorShape('Gb', 'Sol bemol Maior', 2),
  G: createShape({
    chord: 'G',
    name: 'Sol Maior',
    frets: [3, 2, 0, 0, 0, 3],
    fingers: [2, 1, 0, 0, 0, 3],
    rootString: 'E',
    baseFret: 1,
  }),
  'G#': eMajorShape('G#', 'Sol sustenido Maior', 4),
  Ab: eMajorShape('Ab', 'La bemol Maior', 4),
  A: createShape({
    chord: 'A',
    name: 'La Maior',
    frets: ['x', 0, 2, 2, 2, 0],
    fingers: ['x', 0, 1, 2, 3, 0],
    rootString: 'A',
    baseFret: 1,
  }),
  'A#': aMajorShape('A#', 'La sustenido Maior', 1),
  Bb: aMajorShape('Bb', 'Si bemol Maior', 1),
  B: aMajorShape('B', 'Si Maior', 2),

  Cm: aMinorShape('Cm', 'Do Menor', 3),
  'C#m': aMinorShape('C#m', 'Do sustenido Menor', 4),
  Dbm: aMinorShape('Dbm', 'Re bemol Menor', 4),
  Dm: createShape({
    chord: 'Dm',
    name: 'Re Menor',
    frets: ['x', 'x', 0, 2, 3, 1],
    fingers: ['x', 'x', 0, 2, 3, 1],
    rootString: 'D',
    baseFret: 1,
  }),
  'D#m': aMinorShape('D#m', 'Re sustenido Menor', 6),
  Ebm: aMinorShape('Ebm', 'Mi bemol Menor', 6),
  Em: createShape({
    chord: 'Em',
    name: 'Mi Menor',
    frets: [0, 2, 2, 0, 0, 0],
    fingers: [0, 2, 3, 0, 0, 0],
    rootString: 'E',
    baseFret: 1,
  }),
  Fm: eMinorShape('Fm', 'Fa Menor', 1),
  'F#m': eMinorShape('F#m', 'Fa sustenido Menor', 2),
  Gbm: eMinorShape('Gbm', 'Sol bemol Menor', 2),
  Gm: eMinorShape('Gm', 'Sol Menor', 3),
  'G#m': eMinorShape('G#m', 'Sol sustenido Menor', 4),
  Abm: eMinorShape('Abm', 'La bemol Menor', 4),
  Am: createShape({
    chord: 'Am',
    name: 'La Menor',
    frets: ['x', 0, 2, 2, 1, 0],
    fingers: ['x', 0, 2, 3, 1, 0],
    rootString: 'A',
    baseFret: 1,
  }),
  'A#m': aMinorShape('A#m', 'La sustenido Menor', 1),
  Bbm: aMinorShape('Bbm', 'Si bemol Menor', 1),
  Bm: aMinorShape('Bm', 'Si Menor', 2),

  C7: createShape({
    chord: 'C7',
    name: 'Do com setima',
    frets: ['x', 3, 2, 3, 1, 0],
    fingers: ['x', 3, 2, 4, 1, 0],
    rootString: 'A',
    baseFret: 1,
  }),
  'C#7': aSevenShape('C#7', 'Do sustenido com setima', 4),
  Db7: aSevenShape('Db7', 'Re bemol com setima', 4),
  D7: createShape({
    chord: 'D7',
    name: 'Re com setima',
    frets: ['x', 'x', 0, 2, 1, 2],
    fingers: ['x', 'x', 0, 2, 1, 3],
    rootString: 'D',
    baseFret: 1,
  }),
  'D#7': aSevenShape('D#7', 'Re sustenido com setima', 6),
  Eb7: aSevenShape('Eb7', 'Mi bemol com setima', 6),
  E7: createShape({
    chord: 'E7',
    name: 'Mi com setima',
    frets: [0, 2, 0, 1, 0, 0],
    fingers: [0, 2, 0, 1, 0, 0],
    rootString: 'E',
    baseFret: 1,
  }),
  F7: eSevenShape('F7', 'Fa com setima', 1),
  'F#7': eSevenShape('F#7', 'Fa sustenido com setima', 2),
  Gb7: eSevenShape('Gb7', 'Sol bemol com setima', 2),
  G7: createShape({
    chord: 'G7',
    name: 'Sol com setima',
    frets: [3, 2, 0, 0, 0, 1],
    fingers: [3, 2, 0, 0, 0, 1],
    rootString: 'E',
    baseFret: 1,
  }),
  'G#7': eSevenShape('G#7', 'Sol sustenido com setima', 4),
  Ab7: eSevenShape('Ab7', 'La bemol com setima', 4),
  A7: createShape({
    chord: 'A7',
    name: 'La com setima',
    frets: ['x', 0, 2, 0, 2, 0],
    fingers: ['x', 0, 1, 0, 2, 0],
    rootString: 'A',
    baseFret: 1,
  }),
  'A#7': aSevenShape('A#7', 'La sustenido com setima', 1),
  Bb7: aSevenShape('Bb7', 'Si bemol com setima', 1),
  B7: createShape({
    chord: 'B7',
    name: 'Si com setima',
    frets: ['x', 2, 1, 2, 0, 2],
    fingers: ['x', 2, 1, 3, 0, 4],
    rootString: 'A',
    baseFret: 1,
  }),

  Cm7: aMinorSevenShape('Cm7', 'Do menor com setima', 3),
  'C#m7': aMinorSevenShape('C#m7', 'Do sustenido menor com setima', 4),
  Dbm7: aMinorSevenShape('Dbm7', 'Re bemol menor com setima', 4),
  Dm7: createShape({
    chord: 'Dm7',
    name: 'Re menor com setima',
    frets: ['x', 'x', 0, 2, 1, 1],
    fingers: ['x', 'x', 0, 2, 1, 1],
    rootString: 'D',
    baseFret: 1,
    barres: [{ fret: 1, fromString: 4, toString: 5, finger: 1 }],
  }),
  'D#m7': aMinorSevenShape('D#m7', 'Re sustenido menor com setima', 6),
  Ebm7: aMinorSevenShape('Ebm7', 'Mi bemol menor com setima', 6),
  Em7: createShape({
    chord: 'Em7',
    name: 'Mi menor com setima',
    frets: [0, 2, 0, 0, 0, 0],
    fingers: [0, 2, 0, 0, 0, 0],
    rootString: 'E',
    baseFret: 1,
  }),
  Fm7: eMinorSevenShape('Fm7', 'Fa menor com setima', 1),
  'F#m7': eMinorSevenShape('F#m7', 'Fa sustenido menor com setima', 2),
  Gbm7: eMinorSevenShape('Gbm7', 'Sol bemol menor com setima', 2),
  Gm7: eMinorSevenShape('Gm7', 'Sol menor com setima', 3),
  'G#m7': eMinorSevenShape('G#m7', 'Sol sustenido menor com setima', 4),
  Abm7: eMinorSevenShape('Abm7', 'La bemol menor com setima', 4),
  Am7: createShape({
    chord: 'Am7',
    name: 'La menor com setima',
    frets: ['x', 0, 2, 0, 1, 0],
    fingers: ['x', 0, 2, 0, 1, 0],
    rootString: 'A',
    baseFret: 1,
  }),
  'A#m7': aMinorSevenShape('A#m7', 'La sustenido menor com setima', 1),
  Bbm7: aMinorSevenShape('Bbm7', 'Si bemol menor com setima', 1),
  Bm7: aMinorSevenShape('Bm7', 'Si menor com setima', 2),
};

export const normalizeChordForShapeLookup = (chordText: string): string | null => {
  const normalized = chordText.trim().replace(/\s+/g, '');
  if (!normalized || normalized.includes('/')) return null;
  return CHORD_SHAPE_REGISTRY[normalized] ? normalized : null;
};

export const getChordShape = (chordText: string): ChordShape | null => {
  const normalized = normalizeChordForShapeLookup(chordText);
  return normalized ? CHORD_SHAPE_REGISTRY[normalized] : null;
};
