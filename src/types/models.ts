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
  youtubeUrl?: string;
  updatedAt: number;
  preferredFontSize?: number;
  preferredKey?: string;
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
  youtubeUrl?: string;
  preferredFontSize?: number;
  preferredKey?: string;
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
  isStarred?: boolean;
}

export type PlaylistViewMode = 'default' | 'script';

export interface PlaylistSection {
  id: string;
  title: string;
  songIds: string[];
  itemIds?: string[];
  color?: string;
}

export type QuickPdfId = 'pdf1' | 'pdf2' | 'pdf3';

export type PlaylistItem =
  | { id: string; type: 'song'; songId: string; isHighlighted?: boolean }
  | { id: string; type: 'pdf'; pdfId: QuickPdfId };

export interface Playlist {
  id: string;
  folderId: string | null;
  name: string;
  songIds: string[];
  items?: PlaylistItem[];
  isStarred?: boolean;
  genres?: string[];
  viewMode?: PlaylistViewMode;
  sections?: PlaylistSection[];
}

export interface LastOpenedPlaylist {
  playlistId: string;
  playlistName: string;
  folderId?: string | null;
  updatedAt: number;
}

export type HomeShortcutDisplayMode = 'recent' | 'favorites' | 'all' | 'none';

export interface HomeShortcutSettings {
  mode: HomeShortcutDisplayMode;
}

export interface Genre {
  id: string;
  name: string;
  updatedAt: number;
}

export interface GlobalFilter {
  selectedGenres: string[];
}

export interface QuickPdfFilesystemStorage {
  kind: 'filesystem';
  path: string;
  directory: 'Data';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: number;
}

export interface QuickPdfLink {
  id: QuickPdfId;
  sourceType?: 'url' | 'file';
  name?: string;
  url?: string;
  fileName?: string;
  fileData?: string;
  fileStorage?: QuickPdfFilesystemStorage;
  fileSize?: number;
  fileMimeType?: string;
  updatedAt?: number;
}

export interface QuickPdfViewState {
  pdfId: QuickPdfId;
  pageNumber: number;
  zoom?: number;
  pageOffsetRatio?: number;
  sourceFingerprint: string;
  updatedAt: number;
}

export type ChordSpellingMode = 'sharp' | 'flat' | 'mixed';
export type ChordFontFamily = 'default' | 'system' | 'courier' | 'robotoMono' | 'droidSansMono';

export interface DisplaySettings {
  chordColor: string;
  lyricsColor: string;
  chordBold: boolean;
  lyricsBold: boolean;
  staffLineColor: string;
  chordSpellingMode?: ChordSpellingMode;
  chordFontFamily?: ChordFontFamily;
  isVocalModeEnabled?: boolean;
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

export type FavoriteMode = 'disabled' | 'single' | 'multiple';
export type FolderPlaylistDisplayMode = 'folders_first' | 'playlists_first' | 'mixed';
