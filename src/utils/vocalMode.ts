import { getRenderableChordMatches, isChordToken, parseChordLikeSegments, type ChordLikeSegment } from '../lib/chords';

const stripInlineChordTokens = (value: string) => {
  let changed = false;
  const next = value.replace(/\[([^\]]+)\]/g, (match, token: string) => {
    if (!isChordToken(token.trim())) return match;
    changed = true;
    return '';
  });
  return { text: next, changed };
};

const removeChordSegments = (value: string, chords: ChordLikeSegment[]) => {
  let last = 0;
  const parts: string[] = [];
  chords.forEach((chord) => {
    if (chord.index > last) parts.push(value.slice(last, chord.index));
    last = chord.end;
  });
  if (last < value.length) parts.push(value.slice(last));
  return parts.join('');
};

const cleanVocalLyrics = (value: string) =>
  value.replace(/[ \t]+/g, ' ').trim();

export const getVocalModeText = (value: string): string | null => {
  if (value.length === 0) return '';

  const inlineResult = stripInlineChordTokens(value);
  const chords = getRenderableChordMatches(inlineResult.text);
  const segments = parseChordLikeSegments(inlineResult.text);
  const hasRenderedChords = chords.length > 0;
  const hasLyrics = segments.some((segment) => segment.kind === 'text');

  if (hasRenderedChords && !hasLyrics) return null;
  if (hasRenderedChords) {
    return cleanVocalLyrics(removeChordSegments(inlineResult.text, chords));
  }
  if (inlineResult.changed) {
    const cleaned = cleanVocalLyrics(inlineResult.text);
    return cleaned.length > 0 ? cleaned : null;
  }

  return value;
};
