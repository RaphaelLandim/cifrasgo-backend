export type SongCompasso = '2/4' | '3/4' | '4/4' | '6/8';
export type PerformanceNoteSize = 'small' | 'medium' | 'large';
export type PerformanceNoteColor = 'yellow' | 'green' | 'pink' | 'purple' | 'blue' | 'gray';

export interface PerformanceNotePosition {
  x: number;
  y: number;
}

export interface PerformanceNoteBoxSize {
  width: number;
  height: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  genres?: string[];
  observation?: string;
  performanceNote?: string;
  performanceNoteSize?: PerformanceNoteSize;
  performanceNotePosition?: PerformanceNotePosition;
  performanceNoteBoxSize?: PerformanceNoteBoxSize;
  performanceNoteColor?: PerformanceNoteColor;
  performanceNoteVisible?: boolean;
  content: string;
  sourceUrl?: string;
  updatedAt: number;
  preferredFontSize?: number;
  bpm?: number;
  compasso?: SongCompasso;
  beepVisualEnabled?: boolean;
  beepSoundEnabled?: boolean;
  audioNoteBase64?: string;
  audioNoteMimeType?: string;
  audioNoteUpdatedAt?: number;
}

export interface SongInput {
  title: string;
  artist: string;
  genre?: string;
  genres?: string[];
  observation?: string;
  performanceNote?: string;
  performanceNoteSize?: PerformanceNoteSize;
  performanceNotePosition?: PerformanceNotePosition;
  performanceNoteBoxSize?: PerformanceNoteBoxSize;
  performanceNoteColor?: PerformanceNoteColor;
  performanceNoteVisible?: boolean;
  content: string;
  sourceUrl?: string;
  preferredFontSize?: number;
  bpm?: number;
  compasso?: SongCompasso;
  beepVisualEnabled?: boolean;
  beepSoundEnabled?: boolean;
  audioNoteBase64?: string;
  audioNoteMimeType?: string;
  audioNoteUpdatedAt?: number;
  updatedAt?: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string | null;
}

export type PlaylistViewMode = 'default' | 'script';

export interface PlaylistSection {
  id: string;
  title: string;
  songIds: string[];
  color?: string;
}

export interface Playlist {
  id: string;
  folderId: string | null;
  name: string;
  songIds: string[];
  genres?: string[];
  viewMode?: PlaylistViewMode;
  sections?: PlaylistSection[];
}

export interface Genre {
  id: string;
  name: string;
  updatedAt: number;
}

export interface GlobalFilter {
  selectedGenres: string[];
}

export type ChordSpellingMode = 'sharp' | 'flat' | 'mixed';

export interface DisplaySettings {
  chordColor: string;
  lyricsColor: string;
  chordBold: boolean;
  lyricsBold: boolean;
  staffLineColor: string;
  chordSpellingMode?: ChordSpellingMode;
}

export type ThemeMode = 'dark' | 'light' | 'custom';

export interface ThemePalette {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceSoft: string;
  header: string;
  border: string;
  borderSoft: string;
  text: string;
  mutedText: string;
  subtleText: string;
  accent: string;
  accentSoft: string;
  danger: string;
  overlay: string;
}

export interface ThemeSettings {
  mode: ThemeMode;
  custom: ThemePalette;
}
