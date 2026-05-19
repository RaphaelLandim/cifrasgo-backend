import type { ChordSpellingMode } from '../types/models';

export const NOTES_SHARP = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B"
];

export const NOTES_FLAT = [
  "C", "Db", "D", "Eb", "E", "F",
  "Gb", "G", "Ab", "A", "Bb", "B"
];

export const ENHARMONIC_MAP: Record<string, string> = 
{ 
  "B#": "C", 
  "E#": "F", 
  "Cb": "B", 
  "Fb": "E", 
};

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  'E#': 5,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
  'B#': 0,
};

export const CHORD_SPELLING_SCALES: Record<ChordSpellingMode, readonly string[]> = {
  sharp: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'],
  flat: ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab'],
  mixed: ['A', 'Bb', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'],
};

const CHORD_SPELLING_BY_SEMITONE: Record<ChordSpellingMode, readonly string[]> = {
  sharp: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  flat: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  mixed: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
};

export const normalizeChordSpellingMode = (value?: ChordSpellingMode): ChordSpellingMode =>
  value === 'sharp' || value === 'flat' || value === 'mixed' ? value : 'mixed';

export const VALID_SUFFIX =
  /^(?:(?:maj|min|dim|aug|sus|add|m|M|[0-9°º()+\-\/#b]+))*$/;

/**
 * Detecta acordes completos dentro do texto
 * Ex:
 * C
 * Cm7
 * F#11
 * Bb13
 * Dsus4
 * A/C#
 * F7M
 */
export const CHORD_REGEX =
  /(?<![^\s|])([A-G](?:#|b)?)((?:(?:maj|min|dim|aug|sus|add|m|M|[0-9°º()+\-\/#b]+))*?)(?:\/([A-G](?:#|b)?))?(?![^\s|])/g;

/**
 * Detecta token individual de acorde
 */
export const CHORD_TOKEN_REGEX =
  /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add|m|M|[0-9°º()+\-\/#b]+))*(?:\/[A-G](?:#|b)?)?$/;

export const cleanChordToken = (
  token: string
): string =>
  token
    .trim()
    .replace(
      /^[^A-G]+|[^a-zA-Z0-9°º()+\-\/#]+$/gi,
      ''
    );

export const isChordToken = (
  token: string
): boolean =>
  CHORD_TOKEN_REGEX.test(
    cleanChordToken(token)
  );

export type ChordLikeSegment = {
  text: string;
  index: number;
  end: number;
  kind: 'chord' | 'annotation' | 'text';
  root?: string;
  suffix?: string;
  bass?: string;
};

const MUSICAL_ANNOTATION_WORDS = new Set([
  'bis',
  'repete',
  'intro',
  'solo',
  'ponte',
  'refrão',
  'refrao',
]);

const normalizeAnnotationToken = (token: string) =>
  token
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[([{]+|[)\]}.,;:!]+$/g, '');

export const isMusicalAnnotationToken = (token: string): boolean => {
  const trimmed = token.trim();
  if (!trimmed) return false;
  const normalized = normalizeAnnotationToken(trimmed);
  if (/^\d+x$/.test(normalized)) return true;
  if (MUSICAL_ANNOTATION_WORDS.has(normalized)) return true;

  if (/^\(.+\)$/.test(trimmed)) {
    const innerTokens = trimmed.slice(1, -1).split(/\s+/).filter(Boolean);
    return innerTokens.length > 0 && innerTokens.every(isMusicalAnnotationToken);
  }

  return false;
};

const parseChordTokenParts = (token: string) => {
  const cleaned = cleanChordToken(token);
  const match = cleaned.match(/^([A-G](?:#|b)?)((?:(?:maj|min|dim|aug|sus|add|m|M|[0-9Â°Âº()+\-#b]+))*)(?:\/([A-G](?:#|b)?))?$/);
  if (!match || !VALID_SUFFIX.test(match[2] ?? '')) return null;
  return {
    text: cleaned,
    root: match[1],
    suffix: match[2] ?? '',
    bass: match[3],
  };
};

export const parseChordLikeSegments = (line: string): ChordLikeSegment[] => {
  const segments: ChordLikeSegment[] = [];
  const tokenRegex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    const text = match[0];
    const chord = parseChordTokenParts(text);
    const kind = chord
      ? 'chord'
      : isMusicalAnnotationToken(text)
        ? 'annotation'
        : 'text';

    segments.push({
      text,
      index: match.index,
      end: match.index + text.length,
      kind,
      root: chord?.root,
      suffix: chord?.suffix,
      bass: chord?.bass,
    });
  }

  return segments;
};

const hasTypicalSpacingAround = (line: string, segment: ChordLikeSegment) => {
  const before = line.slice(0, segment.index);
  const after = line.slice(segment.end);
  return /\s{2,}$/.test(before) || /^\s{2,}/.test(after);
};

const hasTextImmediatelyAfterChord = (line: string, segment: ChordLikeSegment, next?: ChordLikeSegment) =>
  !!next &&
  next.kind === 'text' &&
  line.slice(segment.end, next.index).length === 1;

export const getRenderableChordMatches = (line: string): ChordLikeSegment[] => {
  const segments = parseChordLikeSegments(line);
  const chordSegments = segments.filter((segment) => segment.kind === 'chord');
  if (chordSegments.length === 0) return [];

  if (segments.length === 1 && chordSegments.length === 1) return chordSegments;

  const nonChordSegments = segments.filter((segment) => segment.kind !== 'chord');
  if (nonChordSegments.length === 0) return chordSegments;

  if (nonChordSegments.length > 0 && nonChordSegments.every((segment) => segment.kind === 'annotation')) {
    return chordSegments;
  }

  const accepted = chordSegments.filter((segment) => {
    const index = segments.indexOf(segment);
    const next = segments[index + 1];

    if (hasTextImmediatelyAfterChord(line, segment, next)) {
      return false;
    }

    if (chordSegments.length >= 2) {
      return hasTypicalSpacingAround(line, segment) || !!next && next.kind === 'chord';
    }

    return hasTypicalSpacingAround(line, segment);
  });

  if (accepted.length >= 2) return accepted;

  const hasText = segments.some((segment) => segment.kind === 'text');
  return hasText ? [] : accepted;
};

const getPreviousToken = (
  content: string,
  index: number
): { token: string; spacing: number } => {
  const before =
    content.slice(0, index);
  const spacing =
    before.match(/\s*$/)?.[0] ?? '';
  const tokenEnd =
    before.length - spacing.length;
  const token =
    before.slice(0, tokenEnd).match(/\S+$/)?.[0] ?? '';

  return {
    token: cleanChordToken(token),
    spacing: spacing.length,
  };
};

const getNextToken = (
  content: string,
  index: number
): { token: string; spacing: number } => {
  const after =
    content.slice(index);
  const match =
    after.match(/^(\s*)(\S+)?/);

  return {
    token: cleanChordToken(match?.[2] ?? ''),
    spacing: match?.[1]?.length ?? 0,
  };
};

export const isChordMatchInContext = (
  content: string,
  chord: string,
  index: number
): boolean => {
  if (!isChordToken(chord)) {
    return false;
  }

  if (!/^[A-G]$/.test(chord)) {
    return true;
  }

  const previous =
    getPreviousToken(content, index);
  const next =
    getNextToken(content, index + chord.length);

  if (previous.spacing === 1 && previous.token && !isChordToken(previous.token)) {
    return false;
  }

  if (next.spacing === 1 && next.token && !isChordToken(next.token)) {
    return false;
  }

  return true;
};

export const normalize = (
  note: string
): string => {
  return ENHARMONIC_MAP[note] ?? note;
};

export const transposeNote = (
  note: string,
  semitones: number,
  spellingMode: ChordSpellingMode = 'mixed'
): string => {

  const normalized = normalize(note);
  const idx = NOTE_TO_SEMITONE[normalized];

  if (idx === undefined) {
    return note;
  }

  const next =
    (idx + semitones + 12) % 12;

  return CHORD_SPELLING_BY_SEMITONE[normalizeChordSpellingMode(spellingMode)][next];
};

export const transposeContent = (
  content: string,
  semitones: number,
  spellingMode: ChordSpellingMode = 'mixed'
): string => {

  if (!semitones) {
    return content;
  }

  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const chords = getRenderableChordMatches(line);
      if (chords.length === 0) return line;

      const chordByIndex = new Map(chords.map((segment) => [segment.index, segment]));
      const parts: string[] = [];
      let last = 0;

      parseChordLikeSegments(line).forEach((segment) => {
        if (segment.index > last) parts.push(line.slice(last, segment.index));

        const chord = chordByIndex.get(segment.index);
        if (!chord || !chord.root) {
          parts.push(segment.text);
          last = segment.end;
          return;
        }

        const newRoot = transposeNote(chord.root, semitones, spellingMode);
        const newBass = chord.bass ? transposeNote(chord.bass, semitones, spellingMode) : undefined;
        parts.push(newBass ? `${newRoot}${chord.suffix ?? ''}/${newBass}` : `${newRoot}${chord.suffix ?? ''}`);
        last = segment.end;
      });

      if (last < line.length) parts.push(line.slice(last));
      return parts.join('');
    })
    .join('\n');
};

