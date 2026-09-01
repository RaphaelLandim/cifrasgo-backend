import React from 'react';
import { Platform, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { getRenderableChordMatches } from '../lib/chords';
import type { ChordFontFamily, DisplaySettings } from '../types/models';
import { getVocalModeText } from '../utils/vocalMode';

interface ChordLineProps {
  text: string;
  fontSize: number;
  settings: DisplaySettings;
}

export const ChordLine = React.memo(function ChordLine({ text, fontSize, settings }: ChordLineProps) {
  if (settings.isVocalModeEnabled) {
    const vocalText = getVocalModeText(text);
    if (vocalText === null) return null;

    return (
      <View style={lineStyle(fontSize)}>
        <Text style={vocalText.length > 0 ? lyricsStyle(fontSize, settings) : emptyLineStyle(fontSize, settings)}>
          {vocalText.length > 0 ? preserveLyricsText(vocalText) : '\u00A0'}
        </Text>
      </View>
    );
  }

  const chords = getRenderableChordMatches(text);

  if (chords.length === 0) {
    return (
      <View style={lineStyle(fontSize)}>
        <Text style={text.length > 0 ? lyricsStyle(fontSize, settings) : emptyLineStyle(fontSize, settings)}>
          {text.length > 0 ? preserveLyricsText(text) : '\u00A0'}
        </Text>
      </View>
    );
  }

  const parts: React.ReactNode[] = [];
  let last = 0;

  chords.forEach((chord) => {
    if (chord.index > last) {
      const textPart = text.slice(last, chord.index);
      parts.push(
        <Text key={`t-${last}`} style={lyricsStyle(fontSize, settings)}>
          {preserveLyricsText(textPart)}
        </Text>
      );
    }

    parts.push(
      <Text
        key={`c-${chord.index}`}
        style={chordStyle(fontSize, settings)}
      >
        {chord.text}
      </Text>
    );
    last = chord.end;
  });

  if (last < text.length) {
    const textPart = text.slice(last);
    parts.push(
      <Text key={`t-end-${last}`} style={lyricsStyle(fontSize, settings)}>
        {preserveLyricsText(textPart)}
      </Text>
    );
  }

  if (parts.length === 0) {
    parts.push(
      <Text key="empty-line" style={emptyLineStyle(fontSize, settings)}>
        {'\u00A0'}
      </Text>
    );
  }

  return <View style={lineStyle(fontSize)}>{parts}</View>;
});

const defaultFont = Platform.OS === 'ios' ? 'Courier' : 'monospace';
const LINE_HEIGHT_RATIO = 1.24;
const EMPTY_LINE_HEIGHT_RATIO = 0.92;

const resolveChordFontFamily = (fontFamily?: ChordFontFamily) => {
  if (fontFamily === 'system') return 'monospace';
  if (fontFamily === 'courier') return '"Courier New", Courier, monospace';
  if (fontFamily === 'robotoMono') return '"Roboto Mono", monospace';
  if (fontFamily === 'droidSansMono') return '"Droid Sans Mono", monospace';
  return defaultFont;
};

const preserveVisualSpaces = (value: string) =>
  value.replace(/ /g, '\u00A0').replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0');

const preserveLyricsText = (value: string) => {
  if (/^\s+$/.test(value)) return preserveVisualSpaces(value);
  return value.replace(/\t/g, '    ');
};

const lineHeightFor = (fontSize: number) => Math.round(fontSize * LINE_HEIGHT_RATIO);
const emptyLineHeightFor = (fontSize: number) => Math.round(fontSize * EMPTY_LINE_HEIGHT_RATIO);

const lineStyle = (fontSize: number): ViewStyle => ({
  flexDirection: 'row',
  flexWrap: 'wrap',
  minHeight: lineHeightFor(fontSize),
});

const chordStyle = (fontSize: number, settings: DisplaySettings): TextStyle => ({
  color: settings.chordColor,
  fontSize,
  lineHeight: lineHeightFor(fontSize),
  fontWeight: settings.chordBold ? '700' : '400',
  fontFamily: resolveChordFontFamily(settings.chordFontFamily),
  includeFontPadding: false,
});

const lyricsStyle = (fontSize: number, settings: DisplaySettings): TextStyle => ({
  color: settings.lyricsColor,
  fontSize,
  lineHeight: lineHeightFor(fontSize),
  fontWeight: settings.lyricsBold ? '600' : '400',
  fontFamily: resolveChordFontFamily(settings.chordFontFamily),
  includeFontPadding: false,
  maxWidth: '100%',
  flexShrink: 1,
  flexWrap: 'wrap',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  wordBreak: 'break-word',
} as TextStyle);

const emptyLineStyle = (fontSize: number, settings: DisplaySettings): TextStyle => ({
  ...lyricsStyle(fontSize, settings),
  lineHeight: emptyLineHeightFor(fontSize),
});
