import { CHORD_SPELLING_SCALES, getRenderableChordMatches, normalizeChordSpellingMode } from '../lib/chords';
import type { ChordSpellingMode } from '../types/models';

export const KEY_OPTIONS = CHORD_SPELLING_SCALES.sharp;

export type MusicKey =
  | (typeof CHORD_SPELLING_SCALES.sharp)[number]
  | (typeof CHORD_SPELLING_SCALES.flat)[number]
  | (typeof CHORD_SPELLING_SCALES.mixed)[number];

const KEY_TO_SEMITONE: Record<string, number> = {
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
};

export const getKeyOptionsForSpellingMode = (mode?: ChordSpellingMode): readonly MusicKey[] =>
  CHORD_SPELLING_SCALES[normalizeChordSpellingMode(mode)] as readonly MusicKey[];

const getSemitoneForKey = (key: string): number | null => {
  const semitone = KEY_TO_SEMITONE[key];
  return semitone === undefined ? null : semitone;
};

export const formatKeyForSpellingMode = (key: string, mode?: ChordSpellingMode): MusicKey => {
  const semitone = getSemitoneForKey(key);
  if (semitone === null) return 'C';
  return getKeyOptionsForSpellingMode(mode).find((option) => KEY_TO_SEMITONE[option] === semitone) ?? 'C';
};

export const detectTomFromContent = (content: string, spellingMode: ChordSpellingMode = 'mixed'): MusicKey => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  for (const line of lines) {
    for (const chord of getRenderableChordMatches(line)) {
      if (!chord.root) continue;
      const semitone = getSemitoneForKey(chord.root);
      if (semitone !== null) return formatKeyForSpellingMode(chord.root, spellingMode);
    }
  }

  return 'C';
};

export const getTransposeBetweenKeys = (from: MusicKey, to: MusicKey): number => {
  const raw = (getSemitoneForKey(to) ?? 0) - (getSemitoneForKey(from) ?? 0);
  if (raw > 6) return raw - 12;
  if (raw < -6) return raw + 12;
  return raw;
};
