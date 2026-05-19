import React from 'react';
import { Platform, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { getRenderableChordMatches } from '../lib/chords';
import type { DisplaySettings } from '../types/models';

interface ChordLineProps {
  text: string;
  fontSize: number;
  settings: DisplaySettings;
}

export function ChordLine({ text, fontSize, settings }: ChordLineProps) {
  const chords = getRenderableChordMatches(text);

  if (chords.length === 0) {
    return (
      <View style={lineStyle(fontSize)}>
        <Text style={lyricsStyle(fontSize, settings)}>
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
      <Text key={`c-${chord.index}`} style={chordStyle(fontSize, settings)}>
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
      <Text key="empty-line" style={lyricsStyle(fontSize, settings)}>
        {'\u00A0'}
      </Text>
    );
  }

  return <View style={lineStyle(fontSize)}>{parts}</View>;
}

const baseFont = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const preserveVisualSpaces = (value: string) =>
  value.replace(/ /g, '\u00A0').replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0');

const preserveLyricsText = (value: string) => {
  if (/^\s+$/.test(value)) return preserveVisualSpaces(value);
  return value.replace(/\t/g, '    ');
};

const lineStyle = (fontSize: number): ViewStyle => ({
  flexDirection: 'row',
  flexWrap: 'wrap',
  minHeight: Math.ceil(fontSize * 1.35),
});

const chordStyle = (fontSize: number, settings: DisplaySettings): TextStyle => ({
  color: settings.chordColor,
  fontSize,
  fontWeight: settings.chordBold ? '800' : '400',
  fontFamily: baseFont,
});

const lyricsStyle = (fontSize: number, settings: DisplaySettings): TextStyle => ({
  color: settings.lyricsColor,
  fontSize,
  lineHeight: Math.ceil(fontSize * 1.35),
  fontWeight: settings.lyricsBold ? '700' : '400',
  fontFamily: baseFont,
  maxWidth: '100%',
  flexShrink: 1,
  flexWrap: 'wrap',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  wordBreak: 'break-word',
} as TextStyle);
