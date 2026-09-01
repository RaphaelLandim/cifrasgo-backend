import React from 'react';
import { ChordLine } from '../../../components/ChordLine';
import type { DisplaySettings } from '../../../types/models';

interface SongLyricsBlockProps {
  text: string;
  fontSize: number;
  settings: DisplaySettings;
}

export const SongLyricsBlock = React.memo(function SongLyricsBlock({ text, fontSize, settings }: SongLyricsBlockProps) {
  return (
    <>
      {text.split('\n').map((line, index) => (
        <ChordLine key={index} text={line} fontSize={fontSize} settings={settings} />
      ))}
    </>
  );
});
