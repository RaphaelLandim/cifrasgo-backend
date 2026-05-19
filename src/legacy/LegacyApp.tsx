/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/exhaustive-deps,react-hooks/set-state-in-effect */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native-web';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  Pencil,
  Folder as FolderIcon,
  Globe,
  GripHorizontal,
  ListMusic,
  Maximize2,
  Menu,
  Minimize2,
  Music,
  Link2,
  Palette,
  Play,
  Plus,
  Save,
  Search,
  Settings as SettingsIcon,
  Share2,
  Square,
  Trash2,
  User,
} from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { App as CapacitorApp } from '@capacitor/app';
import { CHORD_REGEX, isChordMatchInContext, transposeContent } from './lib/chords';
import JSZip from 'jszip';
import pako from 'pako';

type RouteName =
  | 'Songs'
  | 'Artists'
  | 'ArtistDetail'
  | 'Settings'
  | 'Folders'
  | 'Import'
  | 'Backup'
  | 'SongDetail'
  | 'SongEditor'
  | 'FolderDetail'
  | 'PlaylistDetail';

type Route = { name: RouteName; params?: any };

interface Song {
  id: string;
  title: string;
  artist: string;
  /** Categoria, gênero ou estilo (ex.: Liturgia, Sertanejo) — opcional */
  genre?: string;
  genres?: string[];
  observation?: string;
  content: string;
  sourceUrl?: string;
  updatedAt: number;
  preferredFontSize?: number;
}
interface Folder {
  id: string;
  name: string;
  parentId?: string | null;
}
interface Playlist {
  id: string;
  folderId: string | null;
  name: string;
  songIds: string[];
  genres?: string[];
}
interface GlobalFilter {
  selectedGenres: string[];
}
interface Genre {
  id: string;
  name: string;
  updatedAt: number;
}
interface SongEditorHeaderControls {
  onCancel: () => void;
  onOpenSource: () => void;
  onSave: () => void;
  canOpenSource: boolean;
}
interface TopBarControls {
  showSearch?: boolean;
  searchActive?: boolean;
  onSearchPress?: () => void;
  showAdd?: boolean;
  onAddPress?: () => void;
}

const SONGS_KEY = '@songs';
const FOLDERS_KEY = '@folders';
const PLAYLISTS_KEY = '@playlists';
const FOLDER_SONGS_KEY = '@folder_songs';
const DISPLAY_SETTINGS_KEY = '@display_settings';
const GLOBAL_FILTERS_KEY = '@global_filters';
const GENRES_KEY = '@genres';
const THEME_SETTINGS_KEY = '@theme_settings';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();

interface DisplaySettings {
  chordColor: string;
  lyricsColor: string;
  chordBold: boolean;
  lyricsBold: boolean;
  staffLineColor: string;
}

type ThemeMode = 'dark' | 'light' | 'custom';

interface ThemePalette {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceSoft: string;
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

interface ThemeSettings {
  mode: ThemeMode;
  custom: ThemePalette;
}

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  chordColor: '#4FC3F7',
  lyricsColor: '#ddd',
  chordBold: true,
  lyricsBold: false,
  staffLineColor: 'rgba(255,255,255,0.28)',
};

const DARK_THEME: ThemePalette = {
  background: '#121212',
  surface: '#1e1e1e',
  surfaceAlt: '#171a20',
  surfaceSoft: '#111820',
  border: '#333333',
  borderSoft: '#2f3946',
  text: '#ffffff',
  mutedText: '#aaaaaa',
  subtleText: '#9ca3af',
  accent: '#4FC3F7',
  accentSoft: 'rgba(79,195,247,0.10)',
  danger: '#ff6b6b',
  overlay: 'rgba(0,0,0,0.70)',
};

const LIGHT_THEME: ThemePalette = {
  background: '#f5f7fb',
  surface: '#ffffff',
  surfaceAlt: '#eef3f8',
  surfaceSoft: '#e7eef7',
  border: '#d8e1ec',
  borderSoft: '#c5d2e0',
  text: '#101828',
  mutedText: '#475467',
  subtleText: '#667085',
  accent: '#2563eb',
  accentSoft: 'rgba(37,99,235,0.12)',
  danger: '#dc2626',
  overlay: 'rgba(15,23,42,0.42)',
};

const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mode: 'dark',
  custom: DARK_THEME,
};

const THEME_CSS_VARIABLES: Record<keyof ThemePalette, string> = {
  background: '--app-bg',
  surface: '--app-surface',
  surfaceAlt: '--app-surface-alt',
  surfaceSoft: '--app-surface-soft',
  border: '--app-border',
  borderSoft: '--app-border-soft',
  text: '--app-text',
  mutedText: '--app-muted-text',
  subtleText: '--app-subtle-text',
  accent: '--app-accent',
  accentSoft: '--app-accent-soft',
  danger: '--app-danger',
  overlay: '--app-overlay',
};

const THEME_COLOR_INPUTS: Array<{ key: keyof ThemePalette; label: string }> = [
  { key: 'background', label: 'Fundo' },
  { key: 'surface', label: 'Cartões' },
  { key: 'text', label: 'Texto' },
  { key: 'accent', label: 'Destaque' },
  { key: 'borderSoft', label: 'Bordas' },
];

const resolveThemePalette = (settings: ThemeSettings): ThemePalette =>
  settings.mode === 'light' ? LIGHT_THEME : settings.mode === 'custom' ? settings.custom : DARK_THEME;


const COLOR_OPTIONS = [
  '#4FC3F7', // azul claro
  '#22c55e', // verde
  '#f59e0b', // amarelo
  '#f97316', // laranja
  '#e879f9', // rosa
  '#f43f5e', // vermelho
  '#ffffff', // branco

  '#a78bfa', // roxo
  '#38bdf8', // azul céu
  '#14b8a6', // teal
  '#84cc16', // lime
  '#fde047', // amarelo vivo
  '#fb7185', // pink suave
  '#000000', // Preto
  '#d1d5db', // cinza claro
] as const;

const STAFF_LINE_COLOR_OPTIONS = [
  'rgba(255,255,255,0.18)',
  'rgba(255,255,255,0.24)',
  'rgba(255,255,255,0.32)',
  'rgba(79,195,247,0.30)',
  'rgba(34,197,94,0.30)',
  'rgba(245,158,11,0.30)',
] as const;

const NO_GENRE_KEY = 'sem-genero';
const NO_GENRE_LABEL = 'Sem gênero';

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
};

const uid = () => Math.random().toString(36).slice(2, 11);
const KEY_OPTIONS = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'] as const;
const KEY_TO_SEMITONE: Record<(typeof KEY_OPTIONS)[number], number> = {
  A: 9,
  'A#': 10,
  B: 11,
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
};

const normalizeKeyName = (raw: string): (typeof KEY_OPTIONS)[number] | null => {
  const normalized = raw
    .replace('Db', 'C#')
    .replace('Eb', 'D#')
    .replace('Gb', 'F#')
    .replace('Ab', 'G#')
    .replace('Bb', 'A#') as (typeof KEY_OPTIONS)[number];
  return KEY_OPTIONS.includes(normalized) ? normalized : null;
};


const detectTomFromContent = (
  content: string
): (typeof KEY_OPTIONS)[number] => {
  const lines =
    content.replace(/\r\n/g, '\n').split('\n');

  for (const line of lines) {
    const re =
      new RegExp(CHORD_REGEX.source, CHORD_REGEX.flags);
    let match: RegExpExecArray | null;

    while ((match = re.exec(line)) !== null) {
      if (!isChordMatchInContext(line, match[0], match.index)) {
        continue;
      }

      const root =
        match[1];

      if (!root) continue;

      const normalized =
        normalizeKeyName(root);

      if (normalized) {
        return normalized;
      }
    }
  }

  return 'C';
};


const getTransposeBetweenKeys = (
  from: (typeof KEY_OPTIONS)[number],
  to: (typeof KEY_OPTIONS)[number]
): number => {
  const raw = KEY_TO_SEMITONE[to] - KEY_TO_SEMITONE[from];
  if (raw > 6) return raw - 12;
  if (raw < -6) return raw + 12;
  return raw;
};

const extractUrlFromSharedText = (value?: string | null): string | null => {
  const text = (value || '').trim();
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  const raw = (match?.[0] || text).trim().replace(/[)\].,;!?]+$/g, '');
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    return new URL(raw).toString();
  } catch {
    return raw;
  }
};

const sanitizeFileName = (value: string): string => {
  const safeName = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return safeName || 'musica';
};

const buildSongTextFile = (song: Song): string => {
  const lines = [
    (song.title || '').trim() || 'Sem titulo',
    (song.artist || '').trim() ? `Artista: ${song.artist.trim()}` : 'Artista: Sem artista',
    getSongGenreDisplay(song) ? `Genero: ${getSongGenreDisplay(song)}` : '',
    song.observation?.trim() ? `Observacao: ${song.observation.trim()}` : '',
    '',
    song.content || '',
  ];
  return lines.filter((line, index) => index >= 4 || !!line).join('\n');
};

const downloadBlobFile = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};

const shareBlobFile = async ({
  blob,
  fileName,
  title,
  text,
  fallbackMessage,
}: {
  blob: Blob;
  fileName: string;
  title: string;
  text: string;
  fallbackMessage: string;
}): Promise<void> => {
  const shareApi = window.navigator as Navigator & {
    canShare?: (data: ShareData & { files?: File[] }) => boolean;
    share?: (data: ShareData & { files?: File[] }) => Promise<void>;
  };

  try {
    if (shareApi.share && typeof File !== 'undefined') {
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const shareData = { title, text, files: [file] };
      const hasCanShare = typeof shareApi.canShare === 'function';

      if (!hasCanShare || shareApi.canShare?.(shareData)) {
        await shareApi.share(shareData);
        return;
      }
    }

    downloadBlobFile(blob, fileName);
    Alert.alert('Arquivo gerado', fallbackMessage);
  } catch (error: any) {
    if (error?.name === 'AbortError') return;
    downloadBlobFile(blob, fileName);
    Alert.alert('Compartilhamento indisponível', fallbackMessage);
  }
};

const buildPlaylistZip = async (playlist: Playlist, songsById: Map<string, Song>): Promise<Blob> => {
  const zip = new JSZip();
  const playlistName = playlist.name.trim() || 'Lista';
  const songs = playlist.songIds
    .map((songId) => songsById.get(songId))
    .filter((song): song is Song => !!song);

  zip.file(
    'lista.txt',
    [
      `Lista: ${playlistName}`,
      `Total de musicas: ${songs.length}`,
      '',
      ...songs.map((song, index) => `${index + 1}. ${song.title || 'Sem titulo'} - ${song.artist || 'Sem artista'}`),
    ].join('\n')
  );

  const songsFolder = zip.folder('musicas') || zip;
  songs.forEach((song, index) => {
    const prefix = String(index + 1).padStart(2, '0');
    const fileName = sanitizeFileName(`${prefix} - ${song.title || 'musica'}${song.artist ? ` - ${song.artist}` : ''}`);
    songsFolder.file(`${fileName}.txt`, buildSongTextFile(song));
  });

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

interface GenreFilterContextValue {
  globalFilters: GlobalFilter;
  updateGlobalFilters: (genres: string[]) => void;
}

const GenreFilterContext = React.createContext<GenreFilterContextValue | null>(null);

interface ConfirmDialogOptions {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ActiveConfirmDialog extends Required<Pick<ConfirmDialogOptions, 'title' | 'message' | 'confirmLabel' | 'cancelLabel'>> {
  detail?: string;
}

const ConfirmDialogContext = React.createContext<((options: ConfirmDialogOptions) => Promise<boolean>) | null>(null);

const useGenreFilter = () => {
  const ctx = React.useContext(GenreFilterContext);
  if (!ctx) throw new Error('GenreFilterContext not available');
  return ctx;
};

const useConfirmDestructiveAction = () => {
  const confirm = React.useContext(ConfirmDialogContext);
  if (!confirm) throw new Error('ConfirmDialogContext not available');
  return (message: string, title = 'Confirmar exclusão', confirmLabel = 'Excluir') =>
    confirm({
      title,
      message,
      detail: 'Essa ação não poderá ser desfeita.',
      confirmLabel,
      cancelLabel: 'Cancelar',
    });
};

const normalizeGenreName = (name: string): string => name.trim().toLowerCase();

const splitGenreText = (value?: string): string[] =>
  (value || '')
    .split(/[,;|]/)
    .map(normalizeGenreName)
    .filter(Boolean);

const uniqueGenres = (genres: string[]): string[] => Array.from(new Set(genres.map(normalizeGenreName).filter(Boolean)));

const getSongGenreKeys = (song: Pick<Song, 'genre' | 'genres'> | null): string[] => {
  if (!song) return [];
  return uniqueGenres([...(song.genres || []), ...splitGenreText(song.genre)]);
};

const getGenreDisplayName = (genre: string, registeredGenres: Genre[] = []): string => {
  const key = normalizeGenreName(genre);
  const registered = registeredGenres.find((g) => normalizeGenreName(g.name) === key);
  if (registered) return registered.name;
  return key.charAt(0).toUpperCase() + key.slice(1);
};

const getSongGenreDisplay = (song: Pick<Song, 'genre' | 'genres'>, registeredGenres: Genre[] = []): string =>
  getSongGenreKeys(song).map((genre) => getGenreDisplayName(genre, registeredGenres)).join(', ');

const matchesGenreFilter = (song: Song | null, selectedGenres: string[]): boolean => {
  if (!song || selectedGenres.length === 0) return true;
  const songGenres = getSongGenreKeys(song);
  const hasMatchingGenre = songGenres.length > 0 && songGenres.some((genre) => selectedGenres.includes(genre));
  const hasNoGenre = songGenres.length === 0;
  const matchesNoGenre = selectedGenres.includes(NO_GENRE_KEY) && hasNoGenre;
  return hasMatchingGenre || matchesNoGenre;
};

const playlistMatchesGenreFilter = (
  playlist: Playlist | null,
  selectedGenres: string[],
  songsById?: Map<string, Song>
): boolean => {
  if (!playlist || selectedGenres.length === 0) return true;
  if (songsById) {
    return playlist.songIds.some((songId) => matchesGenreFilter(songsById.get(songId) || null, selectedGenres));
  }
  const hasMatchingGenre = playlist.genres && playlist.genres.length > 0 && playlist.genres.some((g) => selectedGenres.includes(normalizeGenreName(g)));
  const hasNoGenre = !playlist.genres || playlist.genres.length === 0;
  const matchesNoGenre = selectedGenres.includes(NO_GENRE_KEY) && hasNoGenre;
  return hasMatchingGenre || matchesNoGenre;
};

const getDescendantFolderIds = (folders: Folder[], folderId: string): string[] => {
  const children = folders.filter((folder) => folder.parentId === folderId);
  return children.flatMap((folder) => [folder.id, ...getDescendantFolderIds(folders, folder.id)]);
};

type FolderListItem =
  | { type: 'folder'; folder: Folder }
  | { type: 'playlist'; playlist: Playlist };

const db = {
  getSongs: async (): Promise<Song[]> =>
    JSON.parse((await AsyncStorage.getItem(SONGS_KEY)) || '[]'),
  saveSongs: async (rows: Song[]) =>
    AsyncStorage.setItem(SONGS_KEY, JSON.stringify(rows)),
  getGenres: async (): Promise<Genre[]> => {
    const rows = JSON.parse((await AsyncStorage.getItem(GENRES_KEY)) || '[]') as Genre[];
    return Array.isArray(rows) ? rows : [];
  },
  saveGenres: async (rows: Genre[]) =>
    AsyncStorage.setItem(GENRES_KEY, JSON.stringify(rows)),
  addGenre: async (name: string): Promise<Genre | null> => {
    const cleanName = name.trim();
    if (!cleanName) return null;
    const rows = await db.getGenres();
    if (rows.some((genre) => normalizeGenreName(genre.name) === normalizeGenreName(cleanName))) return null;
    const genre: Genre = { id: uid(), name: cleanName, updatedAt: Date.now() };
    await db.saveGenres([...rows, genre].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    return genre;
  },
  updateGenre: async (id: string, name: string): Promise<Genre | null> => {
    const cleanName = name.trim();
    if (!cleanName) return null;
    const rows = await db.getGenres();
    const current = rows.find((genre) => genre.id === id);
    if (!current) return null;
    const oldKey = normalizeGenreName(current.name);
    const newKey = normalizeGenreName(cleanName);
    if (rows.some((genre) => genre.id !== id && normalizeGenreName(genre.name) === newKey)) return null;
    const nextGenres = rows
      .map((genre) => genre.id === id ? { ...genre, name: cleanName, updatedAt: Date.now() } : genre)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const songs = await db.getSongs();
    const nextSongs = songs.map((song) => {
      const keys = getSongGenreKeys(song).map((genre) => genre === oldKey ? newKey : genre);
      const nextKeys = uniqueGenres(keys);
      return {
        ...song,
        genres: nextKeys.length ? nextKeys : undefined,
        genre: nextKeys.length ? nextKeys.map((genre) => getGenreDisplayName(genre, nextGenres)).join(', ') : undefined,
      };
    });
    await db.saveGenres(nextGenres);
    await db.saveSongs(nextSongs);
    return nextGenres.find((genre) => genre.id === id) || null;
  },
  deleteGenre: async (id: string): Promise<void> => {
    const rows = await db.getGenres();
    const current = rows.find((genre) => genre.id === id);
    if (!current) return;
    const deletedKey = normalizeGenreName(current.name);
    const nextGenres = rows.filter((genre) => genre.id !== id);
    const songs = await db.getSongs();
    const nextSongs = songs.map((song) => {
      const nextKeys = getSongGenreKeys(song).filter((genre) => genre !== deletedKey);
      return {
        ...song,
        genres: nextKeys.length ? nextKeys : undefined,
        genre: nextKeys.length ? nextKeys.map((genre) => getGenreDisplayName(genre, nextGenres)).join(', ') : undefined,
      };
    });
    await db.saveGenres(nextGenres);
    await db.saveSongs(nextSongs);
  },
  addSong: async (row: Omit<Song, 'id'>): Promise<Song> => {
    const rows = await db.getSongs();
    const n: Song = { ...row, id: uid() };
    await db.saveSongs([n, ...rows]);
    return n;
  },
  updateSong: async (id: string, updates: Partial<Song>) => {
    const rows = await db.getSongs();
    await db.saveSongs(rows.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  },
  deleteSong: async (id: string): Promise<void> => {
    const songs = await db.getSongs();
    await db.saveSongs(songs.filter((song) => song.id !== id));

    const playlists = await db.getPlaylists();
    await db.savePlaylists(
      playlists.map((playlist) => ({
        ...playlist,
        songIds: playlist.songIds.filter((songId) => songId !== id),
      }))
    );

    const folderSongMap = JSON.parse((await AsyncStorage.getItem(FOLDER_SONGS_KEY)) || '{}') as Record<string, string[]>;
    Object.keys(folderSongMap).forEach((folderId) => {
      const nextSongIds = folderSongMap[folderId].filter((songId) => songId !== id);
      if (nextSongIds.length) {
        folderSongMap[folderId] = nextSongIds;
      } else {
        delete folderSongMap[folderId];
      }
    });
    await AsyncStorage.setItem(FOLDER_SONGS_KEY, JSON.stringify(folderSongMap));
  },
  getFolders: async (): Promise<Folder[]> => {
    const rows: Folder[] = JSON.parse((await AsyncStorage.getItem(FOLDERS_KEY)) || '[]');
    return rows.map((f) => ({ ...f, parentId: f.parentId ?? null }));
  },
  saveFolders: async (rows: Folder[]) =>
    AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(rows)),
  addFolder: async (name: string, parentId: string | null = null): Promise<Folder> => {
    const rows = await db.getFolders();
    const n: Folder = { id: uid(), name, parentId };
    await db.saveFolders([n, ...rows]);
    return n;
  },
  getSubfolders: async (parentId: string | null): Promise<Folder[]> => {
    const rows = await db.getFolders();
    return rows.filter((f) => (f.parentId ?? null) === parentId);
  },
  getPlaylists: async (): Promise<Playlist[]> =>
    JSON.parse((await AsyncStorage.getItem(PLAYLISTS_KEY)) || '[]'),
  savePlaylists: async (rows: Playlist[]) =>
    AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(rows)),
  addPlaylist: async (folderId: string | null, name: string): Promise<Playlist> => {
    const rows = await db.getPlaylists();
    const n: Playlist = { id: uid(), folderId, name, songIds: [] };
    await db.savePlaylists([n, ...rows]);
    return n;
  },
  byFolder: async (folderId: string | null): Promise<Playlist[]> =>
    (await db.getPlaylists()).filter((p) => p.folderId === folderId),
  byPlaylist: async (playlistId: string): Promise<Playlist | null> =>
    (await db.getPlaylists()).find((p) => p.id === playlistId) || null,
  addSongToPlaylist: async (playlistId: string, songId: string) => {
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((p) =>
        p.id !== playlistId
          ? p
          : {
              ...p,
              songIds: p.songIds.includes(songId) ? p.songIds : [...p.songIds, songId],
            }
      )
    );
  },
  removeSongFromPlaylist: async (playlistId: string, songId: string) => {
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((p) =>
        p.id !== playlistId ? p : { ...p, songIds: p.songIds.filter((id) => id !== songId) }
      )
    );
  },
  getFolderSongIds: async (folderId: string): Promise<string[]> => {
    const map = JSON.parse((await AsyncStorage.getItem(FOLDER_SONGS_KEY)) || '{}') as Record<
      string,
      string[]
    >;
    return map[folderId] || [];
  },
  addSongToFolder: async (folderId: string, songId: string) => {
    const map = JSON.parse((await AsyncStorage.getItem(FOLDER_SONGS_KEY)) || '{}') as Record<
      string,
      string[]
    >;
    const list = map[folderId] || [];
    map[folderId] = list.includes(songId) ? list : [...list, songId];
    await AsyncStorage.setItem(FOLDER_SONGS_KEY, JSON.stringify(map));
  },
  removeSongFromFolder: async (folderId: string, songId: string) => {
    const map = JSON.parse((await AsyncStorage.getItem(FOLDER_SONGS_KEY)) || '{}') as Record<
      string,
      string[]
    >;
    const list = map[folderId] || [];
    map[folderId] = list.filter((id) => id !== songId);
    await AsyncStorage.setItem(FOLDER_SONGS_KEY, JSON.stringify(map));
  },
};

const ChordLine = ({
  text,
  fontSize,
  settings,
}: {
  text: string;
  fontSize: number;
  settings: DisplaySettings;
}) => {
  const re = new RegExp(CHORD_REGEX.source, CHORD_REGEX.flags);
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (!isChordMatchInContext(text, m[0], m.index)) {
      continue;
    }

    if (m.index > last) {
      parts.push(
        <Text
          key={`t-${last}`}
          style={{
            color: settings.lyricsColor,
            fontSize,
            fontWeight: settings.lyricsBold ? '700' : '400',
            fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
          }}
        >
          {text.slice(last, m.index)}
        </Text>
      );
    }
    parts.push(
      <Text
        key={`c-${m.index}`}
        style={{
          color: settings.chordColor,
          fontSize,
          fontWeight: settings.chordBold ? '700' : '400',
          fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        }}
      >
        {m[0]}
      </Text>
    );
    last = re.lastIndex;
  }
  if (last < text.length) {
    parts.push(
      <Text
        key={`t-end-${last}`}
        style={{
          color: settings.lyricsColor,
          fontSize,
          fontWeight: settings.lyricsBold ? '700' : '400',
          fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        }}
      >
        {text.slice(last)}
      </Text>
    );
  }
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{parts}</View>;
};

function SongMetaLine({ song }: { song: Song }) {
  const genreDisplay = getSongGenreDisplay(song);
  return (
    <View style={styles.songMetaLine}>
      <Text style={[styles.subtitle, styles.songArtistText]} numberOfLines={1}>
        {(song.artist || '').trim() || 'Sem artista'}
      </Text>
      {genreDisplay ? (
        <>
          <Text style={styles.songMetaSeparator}>•</Text>
          <Text style={styles.songGenreInline} numberOfLines={1}>
            {genreDisplay}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function SongActionsModal({
  visible,
  song,
  nav,
  returnTo,
  onClose,
  onAfterDelete,
}: {
  visible: boolean;
  song: Song | null;
  nav: any;
  returnTo: Route;
  onClose: () => void;
  onAfterDelete: () => void;
}) {
  const confirm = React.useContext(ConfirmDialogContext);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistSearchOpen, setPlaylistSearchOpen] = useState(false);
  const [playlistQuery, setPlaylistQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setPlaylistModalOpen(false);
      setPlaylistSearchOpen(false);
      setPlaylistQuery('');
    }
  }, [visible]);

  useEffect(() => {
    if (playlistModalOpen) return;
    setPlaylistSearchOpen(false);
    setPlaylistQuery('');
  }, [playlistModalOpen]);

  useEffect(() => {
    if (!playlistModalOpen) return;
    db.getPlaylists().then((rows) => {
      setPlaylists([...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    });
  }, [playlistModalOpen]);

  const closeAll = () => {
    setPlaylistModalOpen(false);
    setPlaylistSearchOpen(false);
    setPlaylistQuery('');
    onClose();
  };

  const openSong = () => {
    if (!song) return;
    closeAll();
    nav.navigate('SongDetail', { id: song.id, returnTo });
  };

  const editSong = () => {
    if (!song) return;
    closeAll();
    nav.navigate('SongEditor', { id: song.id, returnTo });
  };

  const addToPlaylist = async (playlistId: string) => {
    if (!song) return;
    await db.addSongToPlaylist(playlistId, song.id);
    closeAll();
  };

  const downloadSongTextFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const shareSongFile = async () => {
    if (!song) return;
    const targetSong = song;
    const fileBaseName = sanitizeFileName(
      `${targetSong.title || 'musica'}${targetSong.artist ? ` - ${targetSong.artist}` : ''}`
    );
    const fileName = `${fileBaseName}.txt`;
    const fileText = buildSongTextFile(targetSong);
    const blob = new Blob([fileText], { type: 'text/plain;charset=utf-8' });
    const file = new File([blob], fileName, { type: 'text/plain' });
    const shareTitle = targetSong.title || 'Música';
    const shareSummary = `${targetSong.title || 'Música'}${targetSong.artist ? ` - ${targetSong.artist}` : ''}`;
    const shareApi = window.navigator as Navigator & {
      canShare?: (data: ShareData & { files?: File[] }) => boolean;
      share?: (data: ShareData & { files?: File[] }) => Promise<void>;
    };

    try {
      if (shareApi.share) {
        const fileShareData = { title: shareTitle, text: shareSummary, files: [file] };
        const hasCanShare = typeof shareApi.canShare === 'function';

        if (!hasCanShare || shareApi.canShare?.(fileShareData)) {
          try {
            await shareApi.share(fileShareData);
            closeAll();
            return;
          } catch (error: any) {
            if (error?.name === 'AbortError') return;
            if (hasCanShare) throw error;
          }
        }

        await shareApi.share({ title: shareTitle, text: fileText });
        closeAll();
        return;
      }

      downloadSongTextFile(blob, fileName);
      closeAll();
      Alert.alert('Arquivo TXT gerado', 'Este dispositivo não abriu o compartilhamento nativo, então o arquivo da música foi baixado.');
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      downloadSongTextFile(blob, fileName);
      closeAll();
      Alert.alert('Compartilhamento indisponível', 'Não foi possível abrir o compartilhamento nativo. O arquivo TXT da música foi baixado como alternativa.');
    }
  };

  const deleteSong = async () => {
    if (!song || !confirm) return;
    const targetSong = song;
    closeAll();
    const confirmed = await confirm({
      title: 'Excluir música definitivamente?',
      message: `Você está prestes a excluir "${targetSong.title}".`,
      detail: 'Esta ação remove a música do acervo e também a retira de listas e pastas. Depois da confirmação, ela não poderá ser recuperada pelo aplicativo.',
      confirmLabel: 'Excluir definitivamente',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    await db.deleteSong(targetSong.id);
    onAfterDelete();
  };

  const playlistSearchText = playlistQuery.trim().toLowerCase();
  const filteredPlaylists = playlists.filter((playlist) =>
    !playlistSearchText ? true : playlist.name.toLowerCase().includes(playlistSearchText)
  );

  return (
    <>
      <Modal visible={visible && !!song && !playlistModalOpen} transparent animationType="fade" onRequestClose={closeAll}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Opções da música</Text>
            <Text style={styles.createHint}>{song ? `${song.title} - ${song.artist || 'Sem artista'}` : ''}</Text>
            <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={openSong}>
              <View style={styles.createOptionLeft}>
                <Music size={17} color="#4FC3F7" />
                <Text style={styles.modalActionText}>Abrir música</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={editSong}>
              <View style={styles.createOptionLeft}>
                <Pencil size={17} color="#4FC3F7" />
                <Text style={styles.modalActionText}>Editar música</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={() => setPlaylistModalOpen(true)}>
              <View style={styles.createOptionLeft}>
                <ListMusic size={17} color="#4FC3F7" />
                <Text style={styles.modalActionText}>Enviar a uma lista</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={shareSongFile}>
              <View style={styles.createOptionLeft}>
                <Share2 size={17} color="#4FC3F7" />
                <Text style={styles.modalActionText}>Compartilhar música</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn, styles.modalDangerBtn]} onPress={deleteSong}>
              <View style={styles.createOptionLeft}>
                <Trash2 size={17} color="#ff7a7a" />
                <Text style={styles.modalDangerText}>Deletar a música</Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity onPress={closeAll}>
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={visible && !!song && playlistModalOpen} transparent animationType="fade" onRequestClose={closeAll}>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: '80%' as any }]}>
            <View style={styles.playlistPickerHeader}>
              <View style={styles.listRowText}>
                <Text style={styles.title}>Enviar a uma lista</Text>
                <Text style={styles.createHint}>{song ? song.title : ''}</Text>
              </View>
              <TouchableOpacity
                style={[styles.iconBtn, playlistSearchOpen && styles.statusPillActive]}
                onPress={() => {
                  const next = !playlistSearchOpen;
                  setPlaylistSearchOpen(next);
                  if (!next) setPlaylistQuery('');
                }}
              >
                <Search size={19} color={playlistSearchOpen ? '#4FC3F7' : '#bbb'} />
              </TouchableOpacity>
            </View>
            {playlistSearchOpen ? (
              <View style={[styles.search, styles.playlistPickerSearch]}>
                <Search size={18} color="#999" />
                <TextInput
                  style={styles.inputSearch}
                  placeholder="Buscar lista..."
                  placeholderTextColor="#666"
                  value={playlistQuery}
                  onChangeText={setPlaylistQuery}
                  autoFocus
                />
              </View>
            ) : null}
            <ScrollView style={{ marginTop: 4 }} contentContainerStyle={{ paddingBottom: 10 }}>
              {filteredPlaylists.length ? (
                filteredPlaylists.map((playlist) => {
                  const alreadyAdded = song ? playlist.songIds.includes(song.id) : false;
                  return (
                    <TouchableOpacity
                      key={playlist.id}
                      style={styles.modalActionBtn}
                      onPress={() => addToPlaylist(playlist.id)}
                    >
                      <Text style={styles.modalActionText}>{playlist.name}</Text>
                      <Text style={styles.subtitle}>
                        {alreadyAdded ? 'Já está nesta lista' : `${playlist.songIds.length} música${playlist.songIds.length === 1 ? '' : 's'}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={[styles.subtitle, { marginTop: 6 }]}>
                  {playlists.length ? 'Nenhuma lista encontrada.' : 'Nenhuma lista cadastrada.'}
                </Text>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 10 }}>
              <TouchableOpacity onPress={() => setPlaylistModalOpen(false)}>
                <Text style={{ color: '#aaa' }}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeAll}>
                <Text style={{ color: '#4FC3F7', fontWeight: '800' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'Songs' });
  const nav = { navigate: (name: RouteName, params?: any) => setRoute({ name, params }) };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerStats, setDrawerStats] = useState({ songs: 0, playlists: 0 });
  const [songEditorHeaderControls, setSongEditorHeaderControls] = useState<SongEditorHeaderControls | null>(null);
  const [topBarControls, setTopBarControls] = useState<TopBarControls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ActiveConfirmDialog | null>(null);
  const confirmResolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  const lastImportRequestRef = useRef<{ url: string; requestedAt: number } | null>(null);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(() => {
    const raw = window.localStorage.getItem(DISPLAY_SETTINGS_KEY);
    if (!raw) return DEFAULT_DISPLAY_SETTINGS;
    try {
      return { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_DISPLAY_SETTINGS;
    }
  });
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    const raw = window.localStorage.getItem(THEME_SETTINGS_KEY);
    if (!raw) return DEFAULT_THEME_SETTINGS;
    try {
      const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
      return {
        mode: parsed.mode === 'light' || parsed.mode === 'custom' ? parsed.mode : 'dark',
        custom: { ...DARK_THEME, ...(parsed.custom || {}) },
      };
    } catch {
      return DEFAULT_THEME_SETTINGS;
    }
  });

  const [globalFilters, setGlobalFilters] = useState<GlobalFilter>(() => {
    const raw = window.localStorage.getItem(GLOBAL_FILTERS_KEY);
    if (!raw) return { selectedGenres: [] };
    try {
      const parsed = JSON.parse(raw) as GlobalFilter;
      return { selectedGenres: uniqueGenres(parsed.selectedGenres || []) };
    } catch {
      return { selectedGenres: [] };
    }
  });

  const updateDisplaySettings = (next: Partial<DisplaySettings>) => {
    setDisplaySettings((prev) => {
      const merged = { ...prev, ...next };
      window.localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  const updateGlobalFilters = (genres: string[]) => {
    const newFilter: GlobalFilter = { selectedGenres: uniqueGenres(genres) };
    setGlobalFilters(newFilter);
    window.localStorage.setItem(GLOBAL_FILTERS_KEY, JSON.stringify(newFilter));
  };

  const updateThemeSettings = (next: Partial<ThemeSettings>) => {
    setThemeSettings((prev) => {
      const merged: ThemeSettings = {
        mode: next.mode ?? prev.mode,
        custom: { ...prev.custom, ...(next.custom || {}) },
      };
      window.localStorage.setItem(THEME_SETTINGS_KEY, JSON.stringify(merged));
      return merged;
    });
  };

  const requestConfirmation = React.useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current?.(false);
      confirmResolveRef.current = resolve;
      setConfirmDialog({
        title: options.title,
        message: options.message,
        detail: options.detail,
        confirmLabel: options.confirmLabel || 'Confirmar',
        cancelLabel: options.cancelLabel || 'Cancelar',
      });
    });
  }, []);

  const closeConfirmation = React.useCallback((confirmed: boolean) => {
    const resolve = confirmResolveRef.current;
    confirmResolveRef.current = null;
    setConfirmDialog(null);
    resolve?.(confirmed);
  }, []);

  const handleIncomingImportUrl = React.useCallback((value?: string | null) => {
    const importUrl = extractUrlFromSharedText(value);
    if (!importUrl) return;

    const requestedAt = Date.now();
    const lastRequest = lastImportRequestRef.current;
    if (lastRequest?.url === importUrl && requestedAt - lastRequest.requestedAt < 1500) return;

    lastImportRequestRef.current = { url: importUrl, requestedAt };
    setDrawerOpen(false);
    setRoute({
      name: 'Import',
      params: {
        initialUrl: importUrl,
        autoImportKey: requestedAt,
      },
    });
  }, []);

  useEffect(() => {
    const palette = resolveThemePalette(themeSettings);
    Object.entries(THEME_CSS_VARIABLES).forEach(([key, cssVariable]) => {
      document.documentElement.style.setProperty(cssVariable, palette[key as keyof ThemePalette]);
    });
    document.body.style.background = palette.background;
    document.body.style.color = palette.text;
  }, [themeSettings]);

  useEffect(() => {
    if (!drawerOpen) return;
    Promise.all([db.getSongs(), db.getPlaylists()]).then(([songs, playlists]) => {
      setDrawerStats({ songs: songs.length, playlists: playlists.length });
    });
  }, [drawerOpen]);

  useEffect(() => {
    let isActive = true;
    let removeListener: (() => void) | null = null;

    void CapacitorApp.getLaunchUrl()
      .then((launchUrl) => {
        if (isActive) handleIncomingImportUrl(launchUrl?.url);
      })
      .catch(() => {});

    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      handleIncomingImportUrl(url);
    }).then((handle) => {
      if (!isActive) {
        void handle.remove();
        return;
      }
      removeListener = () => {
        void handle.remove();
      };
    });

    return () => {
      isActive = false;
      removeListener?.();
    };
  }, [handleIncomingImportUrl]);

  const title =
    route.name === 'Songs'
      ? 'Músicas'
      : route.name === 'Artists'
        ? 'Artistas'
      : route.name === 'ArtistDetail'
        ? 'Músicas do artista'
      : route.name === 'Settings'
        ? 'Configurações'
      : route.name === 'Folders'
        ? 'Pastas/Listas'
        : route.name === 'Import'
          ? 'Importar'
          : route.name === 'Backup'
            ? 'Backup/Restauração'
            : route.name === 'FolderDetail'
              ? route.params?.folderName
                ? `Pasta - ${route.params.folderName}`
                : 'Pasta'
              : route.name === 'PlaylistDetail'
                ? route.params?.playlistName
                  ? `Lista - ${route.params.playlistName}`
                  : 'Lista'
                : route.name === 'SongDetail'
                  ? 'Música'
                  : route.name === 'SongEditor'
                    ? 'Editor'
                    : 'App';

  const backTarget: Route | null = React.useMemo(
    () =>
      route.name === 'ArtistDetail'
        ? { name: 'Artists' }
        : route.name === 'FolderDetail'
          ? { name: 'Folders' }
          : route.name === 'PlaylistDetail'
            ? route.params?.folderId
              ? { name: 'FolderDetail', params: { folderId: route.params.folderId, folderName: route.params?.folderName } }
              : { name: 'Folders' }
            : route.name === 'SongDetail'
              ? (route.params?.returnTo as Route | undefined) ?? { name: 'Songs' }
              : null,
    [route.name, route.params]
  );

  useEffect(() => {
    let isActive = true;
    let removeListener: (() => void) | null = null;

    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (confirmDialog) {
        closeConfirmation(false);
        return;
      }

      if (drawerOpen) {
        setDrawerOpen(false);
        return;
      }

      if (isPlaying) {
        setIsPlaying(false);
        return;
      }

      if (backTarget) {
        setRoute(backTarget);
        return;
      }

      if (canGoBack || window.history.length > 1) {
        window.history.back();
        return;
      }

      void CapacitorApp.exitApp();
    }).then((handle) => {
      if (!isActive) {
        void handle.remove();
        return;
      }
      removeListener = () => {
        void handle.remove();
      };
    });

    return () => {
      isActive = false;
      removeListener?.();
    };
  }, [backTarget, closeConfirmation, confirmDialog, drawerOpen, isPlaying]);

  useEffect(() => {
    if (route.name !== 'SongDetail' && isPlaying) {
      setIsPlaying(false);
    }
  }, [route.name, isPlaying]);

  return (
    <ConfirmDialogContext.Provider value={requestConfirmation}>
    <GenreFilterContext.Provider value={{ globalFilters, updateGlobalFilters }}>
    <SafeAreaView style={styles.container}>
      {!isPlaying && (
        <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerOpen(true)}>
          <Menu size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {route.name === 'SongEditor' ? (
          <View style={styles.headerActionGroup}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => songEditorHeaderControls?.onCancel()}>
              <Text style={styles.editorActionLabel}>X</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, !songEditorHeaderControls?.canOpenSource ? { opacity: 0.45 } : null]}
              onPress={() => songEditorHeaderControls?.onOpenSource()}
              disabled={!songEditorHeaderControls?.canOpenSource}
            >
              <Link2 size={17} color="#4FC3F7" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => songEditorHeaderControls?.onSave()}>
              <Save size={17} color="#4FC3F7" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerActionGroup}>
            {backTarget ? (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setRoute(backTarget)}
              >
                <ArrowLeft size={20} color="#4FC3F7" />
              </TouchableOpacity>
            ) : null}
            {topBarControls?.showSearch ? (
              <TouchableOpacity style={styles.iconBtn} onPress={topBarControls.onSearchPress}>
                <Search size={20} color={topBarControls.searchActive ? '#4FC3F7' : '#bbb'} />
              </TouchableOpacity>
            ) : null}
            {topBarControls?.showAdd ? (
              <TouchableOpacity style={styles.iconBtn} onPress={topBarControls.onAddPress}>
                <Plus size={22} color="#4FC3F7" />
              </TouchableOpacity>
            ) : null}
            {!backTarget && !topBarControls?.showSearch && !topBarControls?.showAdd ? (
              <View style={{ width: 40 }} />
            ) : null}
          </View>
        )}
      </View>
      )}

      <Modal visible={drawerOpen} transparent animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
        <TouchableOpacity style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)} activeOpacity={1}>
          <View />
        </TouchableOpacity>
        <View style={styles.drawer}>
          <View style={styles.drawerBrand}>
            <img src="/CifrasGo.png" alt="CifrasGo" style={styles.drawerLogo as React.CSSProperties} />
            <View style={styles.drawerStatsRow}>
              <View style={styles.drawerStatPill}>
                <Text style={styles.drawerStatNumber}>{drawerStats.songs}</Text>
                <Text style={styles.drawerStatLabel}>{drawerStats.songs === 1 ? 'música' : 'músicas'}</Text>
              </View>
              <View style={styles.drawerStatPill}>
                <Text style={styles.drawerStatNumber}>{drawerStats.playlists}</Text>
                <Text style={styles.drawerStatLabel}>{drawerStats.playlists === 1 ? 'lista' : 'listas'}</Text>
              </View>
            </View>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 22 }}>
            <DrawerItem
              label="Músicas"
              icon={<Music size={18} color="#4FC3F7" />}
              onPress={() => { setRoute({ name: 'Songs' }); setDrawerOpen(false); }}
            />
            <DrawerItem
              label="Artistas"
              icon={<User size={18} color="#4FC3F7" />}
              onPress={() => { setRoute({ name: 'Artists' }); setDrawerOpen(false); }}
            />
            <DrawerItem
              label="Pastas/Listas"
              icon={<FolderIcon size={18} color="#4FC3F7" />}
              onPress={() => { setRoute({ name: 'Folders' }); setDrawerOpen(false); }}
            />
            <DrawerItem
              label="Importar"
              icon={<Globe size={18} color="#4FC3F7" />}
              onPress={() => { setRoute({ name: 'Import' }); setDrawerOpen(false); }}
            />
            <DrawerItem
              label="Backup/Restauração"
              icon={<ArrowDownToLine size={18} color="#4FC3F7" />}
              onPress={() => { setRoute({ name: 'Backup' }); setDrawerOpen(false); }}
            />
          </ScrollView>
          <View style={styles.drawerBottom}>
            <DrawerItem
              label="Configurações"
              icon={<SettingsIcon size={18} color="#4FC3F7" />}
              onPress={() => { setRoute({ name: 'Settings' }); setDrawerOpen(false); }}
            />
          </View>
        </View>
      </Modal>

      {route.name === 'Songs' && (
        <SongsScreen
          nav={nav}
          onTopBarControlsChange={setTopBarControls}
          songReturnTo={{ name: 'Songs' }}
        />
      )}
      {route.name === 'Artists' && <ArtistsScreen nav={nav} onTopBarControlsChange={setTopBarControls} />}
      {route.name === 'ArtistDetail' && (
        <ArtistDetailScreen
          nav={nav}
          artist={route.params.artist}
          songReturnTo={{ name: 'ArtistDetail', params: { artist: route.params.artist } }}
        />
      )}
      {route.name === 'Settings' && (
        <SettingsScreen
          settings={displaySettings}
          onChange={updateDisplaySettings}
          themeSettings={themeSettings}
          onThemeChange={updateThemeSettings}
          songs={[]}
        />
      )}
      {route.name === 'Folders' && <FoldersScreen nav={nav} onTopBarControlsChange={setTopBarControls} />}
      {route.name === 'Import' && (
        <ImportScreen
          nav={nav}
          songReturnTo={{ name: 'Import' }}
          initialUrl={route.params?.initialUrl}
          autoImportKey={route.params?.autoImportKey}
        />
      )}
      {route.name === 'Backup' && <BackupScreen />}
      {route.name === 'SongDetail' && (
        <SongDetailScreen
          nav={nav}
          id={route.params.id}
          settings={displaySettings}
          returnTo={route.params?.returnTo as Route | undefined}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          sourcePlaylistId={route.params?.sourcePlaylistId}
          sourcePlaylistName={route.params?.sourcePlaylistName}
        />
      )}
      {route.name === 'SongEditor' && (
        <SongEditorScreen
          nav={nav}
          id={route.params?.id || 'new'}
          settings={displaySettings}
          onHeaderControlsChange={setSongEditorHeaderControls}
          returnTo={route.params?.returnTo as Route | undefined}
        />
      )}
      {route.name === 'FolderDetail' && (
        <FolderDetailScreen
          nav={nav}
          folderId={route.params.folderId}
          songReturnTo={{
            name: 'FolderDetail',
            params: { folderId: route.params.folderId, folderName: route.params.folderName },
          }}
          onTopBarControlsChange={setTopBarControls}
        />
      )}
      {route.name === 'PlaylistDetail' && (
        <PlaylistDetailScreen
          nav={nav}
          playlistId={route.params.playlistId}
          songReturnTo={{
            name: 'PlaylistDetail',
            params: {
              playlistId: route.params.playlistId,
              playlistName: route.params.playlistName,
              folderId: route.params.folderId,
              folderName: route.params.folderName,
            },
          }}
          onTopBarControlsChange={setTopBarControls}
        />
      )}
      <Modal
        visible={!!confirmDialog}
        transparent
        animationType="fade"
        onRequestClose={() => closeConfirmation(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Trash2 size={24} color="#ff7a7a" />
            </View>
            <Text style={styles.confirmTitle}>{confirmDialog?.title}</Text>
            <Text style={styles.confirmMessage}>{confirmDialog?.message}</Text>
            {confirmDialog?.detail ? (
              <Text style={styles.confirmDetail}>{confirmDialog.detail}</Text>
            ) : null}
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => closeConfirmation(false)}>
                <Text style={styles.confirmCancelText}>{confirmDialog?.cancelLabel || 'Cancelar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={() => closeConfirmation(true)}>
                <Text style={styles.confirmDeleteText}>{confirmDialog?.confirmLabel || 'Excluir'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </GenreFilterContext.Provider>
    </ConfirmDialogContext.Provider>
  );
}

function SongsScreen({ nav, onTopBarControlsChange, songReturnTo }: any) {
  const { globalFilters } = useGenreFilter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedActionSong, setSelectedActionSong] = useState<Song | null>(null);
  const [q, setQ] = useState('');
  const [searchOn, setSearchOn] = useState(false);
  const loadSongs = React.useCallback(() => {
    db.getSongs().then(setSongs);
  }, []);
  useEffect(() => { loadSongs(); }, [loadSongs]);
  
  const list = songs.filter((s) => {
    // Aplicar filtro global de gêneros
    if (!matchesGenreFilter(s, globalFilters.selectedGenres)) return false;
    
    // Aplicar busca por texto
    if (!q.trim()) return true;
    const qq = q.toLowerCase();
    return (
      s.title.toLowerCase().includes(qq) ||
      s.artist.toLowerCase().includes(qq) ||
      getSongGenreDisplay(s).toLowerCase().includes(qq)
    );
  });
  
  useEffect(() => {
    onTopBarControlsChange({
      showSearch: true,
      searchActive: searchOn,
      onSearchPress: () => {
        const next = !searchOn;
        setSearchOn(next);
        if (!next) setQ('');
      },
      showAdd: true,
      onAddPress: () => nav.navigate('SongEditor', { id: 'new', returnTo: songReturnTo }),
    });
    return () => onTopBarControlsChange(null);
  }, [nav, onTopBarControlsChange, searchOn, songReturnTo]);

  return (
    <View style={{ flex: 1 }}>
      {searchOn ? (
        <View style={styles.search}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar músicas..."
            placeholderTextColor="#666"
            value={q}
            onChangeText={setQ}
            autoFocus
          />
        </View>
      ) : null}
      <FlatList
        data={list}
        keyExtractor={(i: Song) => i.id}
        initialNumToRender={Math.max(10, list.length)}
        maxToRenderPerBatch={Math.max(10, list.length)}
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }: { item: Song }) => (
          <View style={styles.listRow}>
            <TouchableOpacity
              style={styles.cardMainPress}
              onPress={() => nav.navigate('SongDetail', { id: item.id, returnTo: songReturnTo })}
            >
              <Text style={[styles.title, styles.listTitle]} numberOfLines={1}>{item.title}</Text>
              <SongMetaLine song={item} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.listActionBtn} onPress={() => setSelectedActionSong(item)}>
              <ChevronRight size={18} color="#4FC3F7" />
            </TouchableOpacity>
          </View>
        )}
      />
      <SongActionsModal
        visible={!!selectedActionSong}
        song={selectedActionSong}
        nav={nav}
        returnTo={songReturnTo}
        onClose={() => setSelectedActionSong(null)}
        onAfterDelete={loadSongs}
      />
    </View>
  );
}

function ArtistsScreen({ nav, onTopBarControlsChange }: any) {
  const { globalFilters } = useGenreFilter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [q, setQ] = useState('');
  const [searchOn, setSearchOn] = useState(false);
  useEffect(() => { db.getSongs().then(setSongs); }, []);

  const artistName = (song: Song) => (song.artist || '').trim() || 'Sem artista';
  const filteredSongs = songs.filter((song) => matchesGenreFilter(song, globalFilters.selectedGenres));
  const counts = filteredSongs.reduce<Record<string, number>>((acc, song) => {
    const artist = artistName(song);
    acc[artist] = (acc[artist] || 0) + 1;
    return acc;
  }, {});

  const artists = Object.keys(counts)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .filter((artist) => (!q.trim() ? true : artist.toLowerCase().includes(q.toLowerCase())));
  useEffect(() => {
    onTopBarControlsChange({
      showSearch: true,
      searchActive: searchOn,
      onSearchPress: () => {
        const next = !searchOn;
        setSearchOn(next);
        if (!next) setQ('');
      },
      showAdd: false,
    });
    return () => onTopBarControlsChange(null);
  }, [onTopBarControlsChange, searchOn]);

  return (
    <View style={{ flex: 1 }}>
      {searchOn ? (
        <View style={styles.search}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar artista..."
            placeholderTextColor="#666"
            value={q}
            onChangeText={setQ}
            autoFocus
          />
        </View>
      ) : null}
      <FlatList
        data={artists}
        keyExtractor={(artist: string) => artist}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item: artist }: { item: string }) => (
          <TouchableOpacity style={styles.listRow} onPress={() => nav.navigate('ArtistDetail', { artist })}>
            <View style={styles.listRowText}>
              <Text style={styles.title}>{artist}</Text>
              <Text style={styles.subtitle}>{counts[artist]} músicas</Text>
            </View>
            <ChevronRight size={18} color="#4FC3F7" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function ArtistDetailScreen({ nav, artist, songReturnTo }: any) {
  const { globalFilters } = useGenreFilter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedActionSong, setSelectedActionSong] = useState<Song | null>(null);
  const loadSongs = React.useCallback(() => {
    db.getSongs().then(setSongs);
  }, []);
  useEffect(() => { loadSongs(); }, [artist, loadSongs]);

  const normalizedArtist = (artist || '').trim() || 'Sem artista';
  const songsByArtist = songs.filter(
    (song) => ((song.artist || '').trim() || 'Sem artista') === normalizedArtist
      && matchesGenreFilter(song, globalFilters.selectedGenres)
  );

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>{normalizedArtist}</Text>
      <FlatList
        data={songsByArtist}
        keyExtractor={(item: Song) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }: { item: Song }) => (
          <View style={styles.listRow}>
            <TouchableOpacity
              style={styles.cardMainPress}
              onPress={() => nav.navigate('SongDetail', { id: item.id, returnTo: songReturnTo })}
            >
              <Text style={[styles.title, styles.listTitle]} numberOfLines={1}>{item.title}</Text>
              <SongMetaLine song={item} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.listActionBtn} onPress={() => setSelectedActionSong(item)}>
              <ChevronRight size={18} color="#4FC3F7" />
            </TouchableOpacity>
          </View>
        )}
      />
      <SongActionsModal
        visible={!!selectedActionSong}
        song={selectedActionSong}
        nav={nav}
        returnTo={songReturnTo}
        onClose={() => setSelectedActionSong(null)}
        onAfterDelete={loadSongs}
      />
    </View>
  );
}

function FoldersScreen({ nav, onTopBarControlsChange }: any) {
  const { globalFilters } = useGenreFilter();
  const confirmDestructiveAction = useConfirmDestructiveAction();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [folderSongMap, setFolderSongMap] = useState<Record<string, string[]>>({});
  const [folderStats, setFolderStats] = useState<Record<string, { songs: number; subfolders: number; lists: number }>>({});
  const [viewFilter, setViewFilter] = useState<'all' | 'playlists' | 'folders'>('all');
  const [openCreateType, setOpenCreateType] = useState(false);
  const [openCreateFolder, setOpenCreateFolder] = useState(false);
  const [openCreatePlaylist, setOpenCreatePlaylist] = useState(false);
  const [openFolderActions, setOpenFolderActions] = useState(false);
  const [openRenameFolder, setOpenRenameFolder] = useState(false);
  const [openMoveFolder, setOpenMoveFolder] = useState(false);
  const [openPlaylistActions, setOpenPlaylistActions] = useState(false);
  const [openRenamePlaylist, setOpenRenamePlaylist] = useState(false);
  const [openMovePlaylist, setOpenMovePlaylist] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [name, setName] = useState('');
  const [folderRenameName, setFolderRenameName] = useState('');
  const [playlistRenameName, setPlaylistRenameName] = useState('');
  const [q, setQ] = useState('');
  const [searchOn, setSearchOn] = useState(false);
  const load = async () => {
    const allFolders = await db.getFolders();
    const allPlaylists = await db.getPlaylists();
    const songs = await db.getSongs();
    const folderSongEntries = await Promise.all(
      allFolders.map(async (folder) => [folder.id, await db.getFolderSongIds(folder.id)] as const)
    );
    const nextFolderSongMap = Object.fromEntries(folderSongEntries);
    const rootFolders = allFolders.filter((f) => (f.parentId ?? null) === null);
    const rootPlaylists = allPlaylists.filter((p) => p.folderId === null);
    const statsEntries = await Promise.all(
      rootFolders.map(async (folder) => [
        folder.id,
        {
          songs: nextFolderSongMap[folder.id]?.length || 0,
          subfolders: allFolders.filter((f) => f.parentId === folder.id).length,
          lists: allPlaylists.filter((p) => p.folderId === folder.id).length,
        },
      ] as const)
    );

    setAllFolders(allFolders);
    setFolders(rootFolders);
    setPlaylists(rootPlaylists);
    setAllPlaylists(allPlaylists);
    setAllSongs(songs);
    setFolderSongMap(nextFolderSongMap);
    setFolderStats(Object.fromEntries(statsEntries));
  };
  useEffect(() => { load(); }, []);
  const createFolder = async () => {
    if (!name.trim()) return;
    await db.addFolder(name, null);
    setName('');
    setOpenCreateFolder(false);
    load();
  };
  const createPlaylist = async () => {
    if (!name.trim()) return;
    await db.addPlaylist(null, name);
    setName('');
    setOpenCreatePlaylist(false);
    load();
  };
  const songsById = React.useMemo(() => new Map(allSongs.map((song) => [song.id, song])), [allSongs]);
  const folderMatchesGenreFilter = (folderId: string): boolean => {
    if (globalFilters.selectedGenres.length === 0) return true;
    const directSongsMatch = (folderSongMap[folderId] || []).some((songId) =>
      matchesGenreFilter(songsById.get(songId) || null, globalFilters.selectedGenres)
    );
    if (directSongsMatch) return true;
    const directPlaylistsMatch = allPlaylists
      .filter((playlist) => playlist.folderId === folderId)
      .some((playlist) => playlistMatchesGenreFilter(playlist, globalFilters.selectedGenres, songsById));
    if (directPlaylistsMatch) return true;
    return allFolders
      .filter((folder) => folder.parentId === folderId)
      .some((folder) => folderMatchesGenreFilter(folder.id));
  };
  const visibleFolders = folders.filter((f) => {
    if (q.trim() && !f.name.toLowerCase().includes(q.toLowerCase())) return false;
    return folderMatchesGenreFilter(f.id);
  });
  const visiblePlaylists = playlists.filter((p) => {
    // Aplicar busca por texto
    if (q.trim() && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    // Aplicar filtro global de gêneros
    return playlistMatchesGenreFilter(p, globalFilters.selectedGenres, songsById);
  });
  const visibleItems: FolderListItem[] = [
    ...(viewFilter === 'all' || viewFilter === 'folders'
      ? visibleFolders.map((folder) => ({ type: 'folder' as const, folder }))
      : []),
    ...(viewFilter === 'all' || viewFilter === 'playlists'
      ? visiblePlaylists.map((playlist) => ({ type: 'playlist' as const, playlist }))
      : []),
  ].sort((a, b) => {
    const aName = a.type === 'folder' ? a.folder.name : a.playlist.name;
    const bName = b.type === 'folder' ? b.folder.name : b.playlist.name;
    return aName.localeCompare(bName, 'pt-BR');
  });
  const folderSummary = (folderId: string) => {
    const stats = folderStats[folderId];
    if (!stats) return 'Sem dados';
    const parts: string[] = [];
    if (stats.songs) parts.push(`${stats.songs} ${stats.songs === 1 ? 'música' : 'músicas'}`);
    if (stats.subfolders) parts.push(`${stats.subfolders} ${stats.subfolders === 1 ? 'pasta' : 'pastas'}`);
    if (stats.lists) parts.push(`${stats.lists} ${stats.lists === 1 ? 'lista' : 'listas'}`);
    return parts.length ? parts.join(' • ') : 'Pasta vazia';
  };
  const openActionsForPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setOpenPlaylistActions(true);
  };
  const openActionsForFolder = (folder: Folder) => {
    setSelectedFolder(folder);
    setOpenFolderActions(true);
  };
  const folderTargetIdsToSkip = React.useMemo(() => {
    if (!selectedFolder) return new Set<string>();
    return new Set([selectedFolder.id, ...getDescendantFolderIds(allFolders, selectedFolder.id)]);
  }, [allFolders, selectedFolder]);
  const availableFolderTargets = allFolders.filter((folder) => !folderTargetIdsToSkip.has(folder.id));
  const renameSelectedFolder = async () => {
    if (!selectedFolder || !folderRenameName.trim()) return;
    const rows = await db.getFolders();
    await db.saveFolders(
      rows.map((folder) =>
        folder.id === selectedFolder.id ? { ...folder, name: folderRenameName.trim() } : folder
      )
    );
    setOpenRenameFolder(false);
    setSelectedFolder(null);
    setFolderRenameName('');
    load();
  };
  const deleteSelectedFolder = async () => {
    if (!selectedFolder) return;
    const rows = await db.getFolders();
    const idsToDelete = new Set([selectedFolder.id, ...getDescendantFolderIds(rows, selectedFolder.id)]);
    const playlists = await db.getPlaylists();
    const playlistCount = playlists.filter((playlist) => playlist.folderId && idsToDelete.has(playlist.folderId)).length;
    const subfolderCount = idsToDelete.size - 1;
    setOpenFolderActions(false);
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja excluir a pasta "${selectedFolder.name}"?` +
        `${subfolderCount ? ` Também serão excluídas ${subfolderCount} subpastas.` : ''}` +
        `${playlistCount ? ` Listas dentro dela: ${playlistCount}.` : ''}` +
        ' As músicas continuarão na biblioteca, mas os vínculos com a pasta serão removidos.'
    );
    if (!confirmed) {
      setSelectedFolder(null);
      return;
    }

    const folderSongMap = JSON.parse((await AsyncStorage.getItem(FOLDER_SONGS_KEY)) || '{}') as Record<string, string[]>;
    idsToDelete.forEach((folderId) => delete folderSongMap[folderId]);
    await db.saveFolders(rows.filter((folder) => !idsToDelete.has(folder.id)));
    await db.savePlaylists(
      playlists.filter((playlist) => !playlist.folderId || !idsToDelete.has(playlist.folderId))
    );
    await AsyncStorage.setItem(FOLDER_SONGS_KEY, JSON.stringify(folderSongMap));
    setOpenFolderActions(false);
    setSelectedFolder(null);
    load();
  };
  const renameSelectedPlaylist = async () => {
    if (!selectedPlaylist || !playlistRenameName.trim()) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((pl) => (pl.id === selectedPlaylist.id ? { ...pl, name: playlistRenameName.trim() } : pl))
    );
    setOpenRenamePlaylist(false);
    setSelectedPlaylist(null);
    setPlaylistRenameName('');
    load();
  };
  const deleteSelectedPlaylist = async () => {
    if (!selectedPlaylist) return;
    setOpenPlaylistActions(false);
    const confirmed = await confirmDestructiveAction(`Tem certeza que deseja excluir a lista "${selectedPlaylist.name}"?`);
    if (!confirmed) {
      setSelectedPlaylist(null);
      return;
    }
    const rows = await db.getPlaylists();
    await db.savePlaylists(rows.filter((pl) => pl.id !== selectedPlaylist.id));
    setOpenPlaylistActions(false);
    setSelectedPlaylist(null);
    load();
  };
  const shareSelectedPlaylist = async () => {
    if (!selectedPlaylist) return;
    const playlistToShare = selectedPlaylist;
    const songsById = new Map(allSongs.map((song) => [song.id, song]));
    setOpenPlaylistActions(false);
    setSelectedPlaylist(null);
    const blob = await buildPlaylistZip(playlistToShare, songsById);
    const fileName = `${sanitizeFileName(playlistToShare.name)}.zip`;
    await shareBlobFile({
      blob,
      fileName,
      title: playlistToShare.name,
      text: `Lista "${playlistToShare.name}" com ${playlistToShare.songIds.length} música${playlistToShare.songIds.length === 1 ? '' : 's'}.`,
      fallbackMessage: 'Não foi possível abrir o compartilhamento nativo. O ZIP da lista foi baixado como alternativa.',
    });
  };
  const moveSelectedFolder = async (targetFolderId: string | null) => {
    if (!selectedFolder) return;
    if (targetFolderId && folderTargetIdsToSkip.has(targetFolderId)) return;
    const rows = await db.getFolders();
    await db.saveFolders(
      rows.map((folder) =>
        folder.id === selectedFolder.id ? { ...folder, parentId: targetFolderId } : folder
      )
    );
    setOpenMoveFolder(false);
    setSelectedFolder(null);
    load();
  };
  const moveSelectedPlaylist = async (targetFolderId: string | null) => {
    if (!selectedPlaylist) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((pl) => (pl.id === selectedPlaylist.id ? { ...pl, folderId: targetFolderId } : pl))
    );
    setOpenMovePlaylist(false);
    setSelectedPlaylist(null);
    load();
  };
  useEffect(() => {
    onTopBarControlsChange({
      showSearch: true,
      searchActive: searchOn,
      onSearchPress: () => {
        const next = !searchOn;
        setSearchOn(next);
        if (!next) setQ('');
      },
      showAdd: true,
      onAddPress: () => setOpenCreateType(true),
    });
    return () => onTopBarControlsChange(null);
  }, [onTopBarControlsChange, searchOn]);

  return (
    <View style={styles.container}>
      {searchOn ? (
        <View style={styles.search}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar pastas e listas..."
            placeholderTextColor="#666"
            value={q}
            onChangeText={setQ}
            autoFocus
          />
        </View>
      ) : null}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, viewFilter === 'all' && styles.filterBtnActive]}
          onPress={() => setViewFilter('all')}
        >
          <Text style={[styles.filterBtnText, viewFilter === 'all' && styles.filterBtnTextActive]}>Tudo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, viewFilter === 'playlists' && styles.filterBtnActive]}
          onPress={() => setViewFilter('playlists')}
        >
          <Text style={[styles.filterBtnText, viewFilter === 'playlists' && styles.filterBtnTextActive]}>Listas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, viewFilter === 'folders' && styles.filterBtnActive]}
          onPress={() => setViewFilter('folders')}
        >
          <Text style={[styles.filterBtnText, viewFilter === 'folders' && styles.filterBtnTextActive]}>Pastas</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={visibleItems}
        keyExtractor={(item: FolderListItem) => (item.type === 'folder' ? `folder-${item.folder.id}` : `playlist-${item.playlist.id}`)}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }: { item: FolderListItem }) => (
          item.type === 'folder' ? (
            <View style={styles.listRow}>
              <TouchableOpacity
                style={styles.cardMainPress}
                onPress={() => nav.navigate('FolderDetail', { folderId: item.folder.id, folderName: item.folder.name })}
              >
                <Text style={styles.title}>{item.folder.name}</Text>
                <Text style={styles.subtitle}>{folderSummary(item.folder.id)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listActionBtn} onPress={() => openActionsForFolder(item.folder)}>
                <ChevronRight size={18} color="#4FC3F7" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listRow}>
              <TouchableOpacity
                style={styles.cardMainPress}
                onPress={() =>
                  nav.navigate('PlaylistDetail', {
                    playlistId: item.playlist.id,
                    playlistName: item.playlist.name,
                  })
                }
              >
                <Text style={styles.title}>{item.playlist.name}</Text>
                <Text style={styles.subtitle}>{item.playlist.songIds.length} músicas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listActionBtn} onPress={() => openActionsForPlaylist(item.playlist)}>
                <ChevronRight size={18} color="#4FC3F7" />
              </TouchableOpacity>
            </View>
          )
        )}
      />

      <Modal visible={openCreateType} transparent animationType="fade" onRequestClose={() => setOpenCreateType(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Criar novo</Text>
            <Text style={styles.createHint}>Escolha o que deseja criar agora.</Text>
            <TouchableOpacity
              style={styles.createOptionCard}
              onPress={() => {
                setOpenCreateType(false);
                setName('');
                setOpenCreateFolder(true);
              }}
            >
              <View style={styles.createOptionLeft}>
                <FolderIcon size={18} color="#4FC3F7" />
                <View>
                  <Text style={styles.title}>Pasta</Text>
                  <Text style={styles.subtitle}>Dentro da pasta você pode criar listas</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createOptionCard}
              onPress={() => {
                setOpenCreateType(false);
                setName('');
                setOpenCreatePlaylist(true);
              }}
            >
              <View style={styles.createOptionLeft}>
                <ListMusic size={18} color="#4FC3F7" />
                <View>
                  <Text style={styles.title}>Lista</Text>
                  <Text style={styles.subtitle}>Na lista você só adiciona músicas</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity onPress={() => setOpenCreateType(false)}>
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openCreateFolder} transparent animationType="fade" onRequestClose={() => setOpenCreateFolder(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Nova pasta</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Sertanejo" placeholderTextColor="#666" autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setOpenCreateFolder(false)}><Text style={{ color: '#aaa' }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={createFolder}><Text style={{ color: '#4FC3F7', fontWeight: '700' }}>Criar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openCreatePlaylist} transparent animationType="fade" onRequestClose={() => setOpenCreatePlaylist(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Nova lista</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Modão para tocar" placeholderTextColor="#666" autoFocus />
            <Text style={styles.createHint}>Essa lista aceita somente músicas.</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setOpenCreatePlaylist(false)}><Text style={{ color: '#aaa' }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={createPlaylist}><Text style={{ color: '#4FC3F7', fontWeight: '700' }}>Criar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={openFolderActions}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOpenFolderActions(false);
          setSelectedFolder(null);
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Opções da pasta</Text>
            <Text style={styles.createHint}>{selectedFolder?.name || ''}</Text>
            <TouchableOpacity
              style={styles.modalActionBtn}
              onPress={() => {
                setOpenFolderActions(false);
                setFolderRenameName(selectedFolder?.name || '');
                setOpenRenameFolder(true);
              }}
            >
              <Text style={styles.modalActionText}>Editar nome</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalActionBtn}
              onPress={() => {
                setOpenFolderActions(false);
                setOpenMoveFolder(true);
              }}
            >
              <Text style={styles.modalActionText}>Enviar para pasta...</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, styles.modalDangerBtn]}
              onPress={deleteSelectedFolder}
            >
              <Text style={styles.modalDangerText}>Excluir pasta</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setOpenFolderActions(false);
                  setSelectedFolder(null);
                }}
              >
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openRenameFolder} transparent animationType="fade" onRequestClose={() => setOpenRenameFolder(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Editar nome da pasta</Text>
            <TextInput
              style={styles.input}
              value={folderRenameName}
              onChangeText={setFolderRenameName}
              placeholder="Novo nome"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setOpenRenameFolder(false)}><Text style={{ color: '#aaa' }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={renameSelectedFolder}><Text style={{ color: '#4FC3F7', fontWeight: '700' }}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openMoveFolder} transparent animationType="fade" onRequestClose={() => setOpenMoveFolder(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: '80%' as any }]}>
            <Text style={styles.title}>Enviar para pasta</Text>
            <Text style={styles.createHint}>Escolha o destino da pasta.</Text>
            <ScrollView style={{ marginTop: 4 }}>
              <TouchableOpacity
                style={styles.modalActionBtn}
                onPress={() => moveSelectedFolder(null)}
              >
                <Text style={styles.modalActionText}>Raiz (Pastas/Listas)</Text>
              </TouchableOpacity>
              {availableFolderTargets.length ? (
                availableFolderTargets.map((folder) => (
                  <TouchableOpacity
                    key={folder.id}
                    style={styles.modalActionBtn}
                    onPress={() => moveSelectedFolder(folder.id)}
                  >
                    <Text style={styles.modalActionText}>{folder.name}</Text>
                    <Text style={styles.subtitle}>{folder.parentId ? 'Subpasta' : 'Pasta'}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.subtitle, { marginTop: 6 }]}>Nenhuma pasta disponível.</Text>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity onPress={() => setOpenMoveFolder(false)}>
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={openPlaylistActions}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOpenPlaylistActions(false);
          setSelectedPlaylist(null);
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Opções da lista</Text>
            <Text style={styles.createHint}>{selectedPlaylist?.name || ''}</Text>
            <TouchableOpacity
              style={[styles.modalActionBtn, styles.songActionOptionBtn]}
              onPress={() => {
                setOpenPlaylistActions(false);
                setPlaylistRenameName(selectedPlaylist?.name || '');
                setOpenRenamePlaylist(true);
              }}
            >
              <View style={styles.createOptionLeft}>
                <Pencil size={17} color="#4FC3F7" />
                <Text style={styles.modalActionText}>Editar nome</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, styles.songActionOptionBtn]}
              onPress={() => {
                setOpenPlaylistActions(false);
                setOpenMovePlaylist(true);
              }}
            >
              <View style={styles.createOptionLeft}>
                <FolderIcon size={17} color="#4FC3F7" />
                <Text style={styles.modalActionText}>Enviar para pasta</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={shareSelectedPlaylist}>
              <View style={styles.createOptionLeft}>
                <Share2 size={17} color="#4FC3F7" />
                <Text style={styles.modalActionText}>Compartilhar lista</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, styles.songActionOptionBtn, styles.modalDangerBtn]}
              onPress={deleteSelectedPlaylist}
            >
              <View style={styles.createOptionLeft}>
                <Trash2 size={17} color="#ff7a7a" />
                <Text style={styles.modalDangerText}>Excluir lista</Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setOpenPlaylistActions(false);
                  setSelectedPlaylist(null);
                }}
              >
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openRenamePlaylist} transparent animationType="fade" onRequestClose={() => setOpenRenamePlaylist(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Editar nome da lista</Text>
            <TextInput
              style={styles.input}
              value={playlistRenameName}
              onChangeText={setPlaylistRenameName}
              placeholder="Novo nome"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setOpenRenamePlaylist(false)}><Text style={{ color: '#aaa' }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={renameSelectedPlaylist}><Text style={{ color: '#4FC3F7', fontWeight: '700' }}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openMovePlaylist} transparent animationType="fade" onRequestClose={() => setOpenMovePlaylist(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: '80%' as any }]}>
            <Text style={styles.title}>Enviar para pasta</Text>
            <Text style={styles.createHint}>Escolha o destino da lista.</Text>
            <ScrollView style={{ marginTop: 4 }}>
              <TouchableOpacity
                style={styles.modalActionBtn}
                onPress={() => moveSelectedPlaylist(null)}
              >
                <Text style={styles.modalActionText}>Raiz (Pastas/Listas)</Text>
              </TouchableOpacity>
              {allFolders.length ? (
                allFolders.map((folder) => (
                  <TouchableOpacity
                    key={folder.id}
                    style={styles.modalActionBtn}
                    onPress={() => moveSelectedPlaylist(folder.id)}
                  >
                    <Text style={styles.modalActionText}>{folder.name}</Text>
                    <Text style={styles.subtitle}>{folder.parentId ? 'Subpasta' : 'Pasta'}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.subtitle, { marginTop: 6 }]}>Nenhuma pasta disponível.</Text>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity onPress={() => setOpenMovePlaylist(false)}>
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FolderDetailScreen({ nav, folderId, songReturnTo, onTopBarControlsChange }: any) {
  const { globalFilters } = useGenreFilter();
  const confirmDestructiveAction = useConfirmDestructiveAction();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [subfolders, setSubfolders] = useState<Folder[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [folderSongIds, setFolderSongIds] = useState<string[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);

  const [openActions, setOpenActions] = useState(false);
  const [openPlaylist, setOpenPlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState('');

  const [openFolder, setOpenFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const [openAddSong, setOpenAddSong] = useState(false);
  const [songQ, setSongQ] = useState('');
  const [openFolderItemActions, setOpenFolderItemActions] = useState(false);
  const [openRenameFolderItem, setOpenRenameFolderItem] = useState(false);
  const [openMoveFolderItem, setOpenMoveFolderItem] = useState(false);
  const [selectedFolderItem, setSelectedFolderItem] = useState<Folder | null>(null);
  const [folderItemRenameName, setFolderItemRenameName] = useState('');
  const [openPlaylistItemActions, setOpenPlaylistItemActions] = useState(false);
  const [openRenamePlaylistItem, setOpenRenamePlaylistItem] = useState(false);
  const [selectedPlaylistItem, setSelectedPlaylistItem] = useState<Playlist | null>(null);
  const [playlistItemRenameName, setPlaylistItemRenameName] = useState('');

  const load = async () => {
    const allFolders = await db.getFolders();
    setAllFolders(allFolders);
    setFolder(allFolders.find((f) => f.id === folderId) || null);
    setSubfolders(await db.getSubfolders(folderId));
    setPlaylists(await db.byFolder(folderId));
    setFolderSongIds(await db.getFolderSongIds(folderId));
    setAllSongs(await db.getSongs());
  };
  useEffect(() => { load(); }, [folderId]);
  const createPlaylist = async () => {
    if (!playlistName.trim()) return;
    await db.addPlaylist(folderId, playlistName);
    setPlaylistName('');
    setOpenPlaylist(false);
    load();
  };
  const createSubfolder = async () => {
    if (!folderName.trim()) return;
    await db.addFolder(folderName, folderId);
    setFolderName('');
    setOpenFolder(false);
    load();
  };
  const openActionsForFolderItem = (folder: Folder) => {
    setSelectedFolderItem(folder);
    setOpenFolderItemActions(true);
  };
  const openActionsForPlaylistItem = (playlist: Playlist) => {
    setSelectedPlaylistItem(playlist);
    setOpenPlaylistItemActions(true);
  };
  const folderItemTargetIdsToSkip = React.useMemo(() => {
    if (!selectedFolderItem) return new Set<string>();
    return new Set([selectedFolderItem.id, ...getDescendantFolderIds(allFolders, selectedFolderItem.id)]);
  }, [allFolders, selectedFolderItem]);
  const availableFolderItemTargets = allFolders.filter((folder) => !folderItemTargetIdsToSkip.has(folder.id));
  const renameSelectedFolderItem = async () => {
    if (!selectedFolderItem || !folderItemRenameName.trim()) return;
    const rows = await db.getFolders();
    await db.saveFolders(
      rows.map((folder) =>
        folder.id === selectedFolderItem.id ? { ...folder, name: folderItemRenameName.trim() } : folder
      )
    );
    setOpenRenameFolderItem(false);
    setSelectedFolderItem(null);
    setFolderItemRenameName('');
    load();
  };
  const moveSelectedFolderItem = async (targetFolderId: string | null) => {
    if (!selectedFolderItem) return;
    if (targetFolderId && folderItemTargetIdsToSkip.has(targetFolderId)) return;
    const rows = await db.getFolders();
    await db.saveFolders(
      rows.map((folder) =>
        folder.id === selectedFolderItem.id ? { ...folder, parentId: targetFolderId } : folder
      )
    );
    setOpenMoveFolderItem(false);
    setSelectedFolderItem(null);
    load();
  };
  const deleteSelectedFolderItem = async () => {
    if (!selectedFolderItem) return;
    const rows = await db.getFolders();
    const idsToDelete = new Set([selectedFolderItem.id, ...getDescendantFolderIds(rows, selectedFolderItem.id)]);
    const allPlaylists = await db.getPlaylists();
    const playlistCount = allPlaylists.filter((playlist) => playlist.folderId && idsToDelete.has(playlist.folderId)).length;
    const subfolderCount = idsToDelete.size - 1;
    setOpenFolderItemActions(false);
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja excluir a pasta "${selectedFolderItem.name}"?` +
        `${subfolderCount ? ` Também serão excluídas ${subfolderCount} subpastas.` : ''}` +
        `${playlistCount ? ` Listas dentro dela: ${playlistCount}.` : ''}` +
        ' As músicas continuarão na biblioteca, mas os vínculos com a pasta serão removidos.'
    );
    if (!confirmed) {
      setSelectedFolderItem(null);
      return;
    }

    const folderSongMap = JSON.parse((await AsyncStorage.getItem(FOLDER_SONGS_KEY)) || '{}') as Record<string, string[]>;
    idsToDelete.forEach((deletedFolderId) => delete folderSongMap[deletedFolderId]);
    await db.saveFolders(rows.filter((folder) => !idsToDelete.has(folder.id)));
    await db.savePlaylists(
      allPlaylists.filter((playlist) => !playlist.folderId || !idsToDelete.has(playlist.folderId))
    );
    await AsyncStorage.setItem(FOLDER_SONGS_KEY, JSON.stringify(folderSongMap));
    setOpenFolderItemActions(false);
    setSelectedFolderItem(null);
    load();
  };
  const renameSelectedPlaylistItem = async () => {
    if (!selectedPlaylistItem || !playlistItemRenameName.trim()) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((playlist) =>
        playlist.id === selectedPlaylistItem.id ? { ...playlist, name: playlistItemRenameName.trim() } : playlist
      )
    );
    setOpenRenamePlaylistItem(false);
    setSelectedPlaylistItem(null);
    setPlaylistItemRenameName('');
    load();
  };
  const removeSelectedPlaylistFromFolder = async () => {
    if (!selectedPlaylistItem) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((playlist) =>
        playlist.id === selectedPlaylistItem.id ? { ...playlist, folderId: null } : playlist
      )
    );
    setOpenPlaylistItemActions(false);
    setSelectedPlaylistItem(null);
    load();
  };
  const deleteSelectedPlaylistItem = async () => {
    if (!selectedPlaylistItem) return;
    setOpenPlaylistItemActions(false);
    const confirmed = await confirmDestructiveAction(`Tem certeza que deseja excluir a lista "${selectedPlaylistItem.name}"?`);
    if (!confirmed) {
      setSelectedPlaylistItem(null);
      return;
    }
    const rows = await db.getPlaylists();
    await db.savePlaylists(rows.filter((playlist) => playlist.id !== selectedPlaylistItem.id));
    setOpenPlaylistItemActions(false);
    setSelectedPlaylistItem(null);
    load();
  };
  const shareSelectedPlaylistItem = async () => {
    if (!selectedPlaylistItem) return;
    const playlistToShare = selectedPlaylistItem;
    const songsById = new Map(allSongs.map((song) => [song.id, song]));
    setOpenPlaylistItemActions(false);
    setSelectedPlaylistItem(null);
    const blob = await buildPlaylistZip(playlistToShare, songsById);
    const fileName = `${sanitizeFileName(playlistToShare.name)}.zip`;
    await shareBlobFile({
      blob,
      fileName,
      title: playlistToShare.name,
      text: `Lista "${playlistToShare.name}" com ${playlistToShare.songIds.length} música${playlistToShare.songIds.length === 1 ? '' : 's'}.`,
      fallbackMessage: 'Não foi possível abrir o compartilhamento nativo. O ZIP da lista foi baixado como alternativa.',
    });
  };

  const songsById = React.useMemo(() => new Map(allSongs.map((song) => [song.id, song])), [allSongs]);
  const folderSongs = allSongs
    .filter((s) => folderSongIds.includes(s.id))
    .filter((s) => matchesGenreFilter(s, globalFilters.selectedGenres));
  const visiblePlaylists = playlists.filter((playlist) =>
    playlistMatchesGenreFilter(playlist, globalFilters.selectedGenres, songsById)
  );
  const hasSubfolders = subfolders.length > 0;
  const hasPlaylists = visiblePlaylists.length > 0;
  const hasFolderSongs = folderSongs.length > 0;
  const isEmptyFolder = !hasSubfolders && !hasPlaylists && !hasFolderSongs;
  const availableSongs = allSongs
    .filter((s) => !folderSongIds.includes(s.id))
    .filter((s) => matchesGenreFilter(s, globalFilters.selectedGenres))
    .filter((s) =>
      !songQ.trim()
        ? true
        : s.title.toLowerCase().includes(songQ.toLowerCase()) ||
          s.artist.toLowerCase().includes(songQ.toLowerCase())
    );
  const removeSongFromCurrentFolder = async (song: Song) => {
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja remover "${song.title}" desta pasta?`,
      'Remover música',
      'Remover'
    );
    if (!confirmed) return;
    await db.removeSongFromFolder(folderId, song.id);
    load();
  };
  useEffect(() => {
    onTopBarControlsChange({
      showAdd: true,
      onAddPress: () => setOpenActions(true),
    });
    return () => onTopBarControlsChange(null);
  }, [onTopBarControlsChange]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {hasSubfolders ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Subpastas</Text>
            {subfolders.map((sf) => (
              <View key={sf.id} style={styles.listRow}>
                <TouchableOpacity
                  style={styles.cardMainPress}
                  onPress={() => nav.navigate('FolderDetail', { folderId: sf.id, folderName: sf.name })}
                >
                  <Text style={styles.title}>{sf.name}</Text>
                  <Text style={styles.subtitle}>Abrir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.listActionBtn} onPress={() => openActionsForFolderItem(sf)}>
                  <ChevronRight size={18} color="#4FC3F7" />
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : isEmptyFolder ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Subpastas</Text>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Nenhuma subpasta.</Text>
          </>
        ) : null}

        {hasPlaylists ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8, marginTop: 10 }]}>Listas</Text>
            {visiblePlaylists.map((pl) => (
              <View key={pl.id} style={styles.listRow}>
                <TouchableOpacity
                  style={styles.cardMainPress}
                  onPress={() =>
                    nav.navigate('PlaylistDetail', {
                      playlistId: pl.id,
                      playlistName: pl.name,
                      folderId,
                      folderName: folder?.name,
                    })
                  }
                >
                <View style={styles.listRowText}>
                  <Text style={styles.title}>{pl.name}</Text>
                  <Text style={styles.subtitle}>{pl.songIds.length} músicas</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listActionBtn} onPress={() => openActionsForPlaylistItem(pl)}>
                <ChevronRight size={18} color="#4FC3F7" />
              </TouchableOpacity>
            </View>
            ))}
          </>
        ) : isEmptyFolder ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8, marginTop: 10 }]}>Listas</Text>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Nenhuma lista.</Text>
          </>
        ) : null}

        {hasFolderSongs ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8, marginTop: 10 }]}>Músicas na pasta</Text>
            {folderSongs.map((s) => (
              <View key={s.id} style={styles.listRow}>
                <TouchableOpacity
                  style={styles.cardMainPress}
                  onPress={() => nav.navigate('SongDetail', { id: s.id, returnTo: songReturnTo })}
                >
                  <Text style={styles.title}>{s.title}</Text>
                  <Text style={styles.subtitle}>{s.artist}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeSongFromCurrentFolder(s)}>
                  <Trash2 size={18} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : isEmptyFolder ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8, marginTop: 10 }]}>Músicas na pasta</Text>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Nenhuma música nesta pasta.</Text>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={openActions} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Criar / Adicionar</Text>
            <TouchableOpacity style={[styles.card, { marginHorizontal: 0 }]} onPress={() => { setOpenActions(false); setOpenFolder(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.title}>Pasta</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.card, { marginHorizontal: 0 }]} onPress={() => { setOpenActions(false); setOpenPlaylist(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.title}>Lista</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.card, { marginHorizontal: 0 }]} onPress={() => { setOpenActions(false); setSongQ(''); setOpenAddSong(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.title}>Adicionar música</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity onPress={() => setOpenActions(false)}>
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openPlaylist} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Nova lista</Text>
            <TextInput style={styles.input} value={playlistName} onChangeText={setPlaylistName} placeholder="Ex: Leandro e Leonardo" placeholderTextColor="#666" autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setOpenPlaylist(false)}><Text style={{ color: '#aaa' }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={createPlaylist}><Text style={{ color: '#4FC3F7', fontWeight: '700' }}>Criar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openFolder} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Nova subpasta</Text>
            <TextInput style={styles.input} value={folderName} onChangeText={setFolderName} placeholder="Ex: Modão antigo" placeholderTextColor="#666" autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setOpenFolder(false)}><Text style={{ color: '#aaa' }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={createSubfolder}><Text style={{ color: '#4FC3F7', fontWeight: '700' }}>Criar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openAddSong} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: '80%' as any }]}>
            <Text style={styles.title}>Adicionar músicas</Text>
            <View style={[styles.search, { marginHorizontal: 0, marginBottom: 10 }]}>
              <Search size={18} color="#999" />
              <TextInput
                style={styles.inputSearch}
                placeholder="Buscar música..."
                placeholderTextColor="#666"
                value={songQ}
                onChangeText={setSongQ}
                autoFocus
              />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 14 }}>
              {availableSongs.length ? (
                availableSongs.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.card, { marginHorizontal: 0 }]}
                    onPress={async () => { await db.addSongToFolder(folderId, s.id); load(); }}
                  >
                    <View>
                      <Text style={styles.title}>{s.title}</Text>
                      <Text style={styles.subtitle}>{s.artist}</Text>
                    </View>
                    <Plus size={18} color="#4FC3F7" />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.subtitle, { marginTop: 6 }]}>Nada encontrado.</Text>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity onPress={() => setOpenAddSong(false)}>
                <Text style={{ color: '#4FC3F7', fontWeight: '800' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={openFolderItemActions}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOpenFolderItemActions(false);
          setSelectedFolderItem(null);
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Opções da pasta</Text>
            <Text style={styles.createHint}>{selectedFolderItem?.name || ''}</Text>
            <TouchableOpacity
              style={styles.modalActionBtn}
              onPress={() => {
                setOpenFolderItemActions(false);
                setFolderItemRenameName(selectedFolderItem?.name || '');
                setOpenRenameFolderItem(true);
              }}
            >
              <Text style={styles.modalActionText}>Editar nome</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalActionBtn}
              onPress={() => {
                setOpenFolderItemActions(false);
                setOpenMoveFolderItem(true);
              }}
            >
              <Text style={styles.modalActionText}>Enviar para pasta...</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, styles.modalDangerBtn]}
              onPress={deleteSelectedFolderItem}
            >
              <Text style={styles.modalDangerText}>Excluir pasta</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setOpenFolderItemActions(false);
                  setSelectedFolderItem(null);
                }}
              >
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openRenameFolderItem} transparent animationType="fade" onRequestClose={() => setOpenRenameFolderItem(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Editar nome da pasta</Text>
            <TextInput
              style={styles.input}
              value={folderItemRenameName}
              onChangeText={setFolderItemRenameName}
              placeholder="Novo nome"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setOpenRenameFolderItem(false)}><Text style={{ color: '#aaa' }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={renameSelectedFolderItem}><Text style={{ color: '#4FC3F7', fontWeight: '700' }}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openMoveFolderItem} transparent animationType="fade" onRequestClose={() => setOpenMoveFolderItem(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: '80%' as any }]}>
            <Text style={styles.title}>Enviar para pasta</Text>
            <Text style={styles.createHint}>Escolha o destino da pasta.</Text>
            <ScrollView style={{ marginTop: 4 }}>
              <TouchableOpacity style={styles.modalActionBtn} onPress={() => moveSelectedFolderItem(null)}>
                <Text style={styles.modalActionText}>Raiz (Pastas/Listas)</Text>
              </TouchableOpacity>
              {availableFolderItemTargets.length ? (
                availableFolderItemTargets.map((folderOption) => (
                  <TouchableOpacity
                    key={folderOption.id}
                    style={styles.modalActionBtn}
                    onPress={() => moveSelectedFolderItem(folderOption.id)}
                  >
                    <Text style={styles.modalActionText}>{folderOption.name}</Text>
                    <Text style={styles.subtitle}>{folderOption.parentId ? 'Subpasta' : 'Pasta'}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.subtitle, { marginTop: 6 }]}>Nenhuma pasta disponível.</Text>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity onPress={() => setOpenMoveFolderItem(false)}>
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={openPlaylistItemActions}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOpenPlaylistItemActions(false);
          setSelectedPlaylistItem(null);
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Opções da lista</Text>
            <Text style={styles.createHint}>{selectedPlaylistItem?.name || ''}</Text>
            <TouchableOpacity
              style={[styles.modalActionBtn, styles.songActionOptionBtn]}
              onPress={() => {
                setOpenPlaylistItemActions(false);
                setPlaylistItemRenameName(selectedPlaylistItem?.name || '');
                setOpenRenamePlaylistItem(true);
              }}
            >
              <View style={styles.createOptionLeft}>
                <Pencil size={17} color="#4FC3F7" />
                <Text style={styles.modalActionText}>Editar nome</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={removeSelectedPlaylistFromFolder}>
              <View style={styles.createOptionLeft}>
                <FolderIcon size={17} color="#4FC3F7" />
                <Text style={styles.modalActionText}>Sair da pasta</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={shareSelectedPlaylistItem}>
              <View style={styles.createOptionLeft}>
                <Share2 size={17} color="#4FC3F7" />
                <Text style={styles.modalActionText}>Compartilhar lista</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionBtn, styles.songActionOptionBtn, styles.modalDangerBtn]}
              onPress={deleteSelectedPlaylistItem}
            >
              <View style={styles.createOptionLeft}>
                <Trash2 size={17} color="#ff7a7a" />
                <Text style={styles.modalDangerText}>Excluir lista</Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setOpenPlaylistItemActions(false);
                  setSelectedPlaylistItem(null);
                }}
              >
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openRenamePlaylistItem} transparent animationType="fade" onRequestClose={() => setOpenRenamePlaylistItem(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Editar nome da lista</Text>
            <TextInput
              style={styles.input}
              value={playlistItemRenameName}
              onChangeText={setPlaylistItemRenameName}
              placeholder="Novo nome"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setOpenRenamePlaylistItem(false)}><Text style={{ color: '#aaa' }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={renameSelectedPlaylistItem}><Text style={{ color: '#4FC3F7', fontWeight: '700' }}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PlaylistDetailScreen({ nav, playlistId, songReturnTo, onTopBarControlsChange }: any) {
  const { globalFilters } = useGenreFilter();
  const confirmDestructiveAction = useConfirmDestructiveAction();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [openPlaylistActions, setOpenPlaylistActions] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [openOrder, setOpenOrder] = useState(false);
  const [draftOrderIds, setDraftOrderIds] = useState<string[]>([]);
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const load = async () => {
    const p = await db.byPlaylist(playlistId);
    const all = await db.getSongs();
    const byId = new Map(all.map((song) => [song.id, song]));
    const orderedSongs = p
      ? p.songIds
          .map((songId) => byId.get(songId))
          .filter((song): song is Song => !!song && matchesGenreFilter(song, globalFilters.selectedGenres))
      : [];
    setPlaylist(p);
    setAllSongs(all);
    setSongs(orderedSongs);
  };
  useEffect(() => { load(); }, [playlistId, globalFilters.selectedGenres]);
  const allSongsById = React.useMemo(() => new Map(allSongs.map((song) => [song.id, song])), [allSongs]);
  const orderedDraftSongs = draftOrderIds
    .map((songId) => allSongsById.get(songId))
    .filter((song): song is Song => !!song);
  const playlistSongCount = playlist?.songIds.length || 0;
  const available = allSongs
    .filter((s) => !playlist?.songIds.includes(s.id))
    .filter((s) => matchesGenreFilter(s, globalFilters.selectedGenres))
    .filter((s) =>
      !q.trim()
        ? true
        : s.title.toLowerCase().includes(q.toLowerCase()) ||
          s.artist.toLowerCase().includes(q.toLowerCase())
    );
  const removeSongFromCurrentPlaylist = async (song: Song) => {
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja remover "${song.title}" desta lista?`,
      'Remover música',
      'Remover'
    );
    if (!confirmed) return;
    await db.removeSongFromPlaylist(playlistId, song.id);
    load();
  };
  const openAddMusic = () => {
    setOpenPlaylistActions(false);
    setQ('');
    setOpenAdd(true);
  };
  const openOrderList = () => {
    const currentOrder = (playlist?.songIds || []).filter((songId) => allSongsById.has(songId));
    setDraftOrderIds(currentOrder);
    setDraggedSongId(null);
    setOpenPlaylistActions(false);
    setOpenOrder(true);
  };
  const moveDraftSong = (fromIndex: number, toIndex: number) => {
    setDraftOrderIds((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };
  const moveDraftSongById = (songId: string, delta: number) => {
    const fromIndex = draftOrderIds.indexOf(songId);
    moveDraftSong(fromIndex, fromIndex + delta);
  };
  const savePlaylistOrder = async () => {
    if (!playlist) return;
    const orderedSet = new Set(draftOrderIds);
    const hiddenOrMissingSongIds = playlist.songIds.filter((songId) => !orderedSet.has(songId));
    const nextSongIds = [...draftOrderIds, ...hiddenOrMissingSongIds];
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((pl) => (pl.id === playlistId ? { ...pl, songIds: nextSongIds } : pl))
    );
    setOpenOrder(false);
    setDraggedSongId(null);
    load();
  };
  useEffect(() => {
    onTopBarControlsChange({
      showAdd: true,
      onAddPress: () => setOpenPlaylistActions(true),
    });
    return () => onTopBarControlsChange(null);
  }, [onTopBarControlsChange]);

  return (
    <View style={styles.container}>
      <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Músicas na lista</Text>
      <FlatList
        data={songs}
        keyExtractor={(i: Song) => i.id}
        initialNumToRender={Math.max(10, songs.length)}
        maxToRenderPerBatch={Math.max(10, songs.length)}
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        renderItem={({ item }: { item: Song }) => (
          <View style={styles.listRow}>
            <TouchableOpacity
              style={styles.cardMainPress}
              onPress={() => nav.navigate('SongDetail', {
                id: item.id,
                returnTo: songReturnTo,
                sourcePlaylistId: playlistId,
                sourcePlaylistName: playlist?.name,
              })}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.artist}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeSongFromCurrentPlaylist(item)}>
              <Trash2 size={18} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal
        visible={openPlaylistActions}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenPlaylistActions(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.settingsModalCard}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Opções da lista</Text>
              <TouchableOpacity onPress={() => setOpenPlaylistActions(false)}>
                <Text style={styles.settingsCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.settingsControlHint}>
              {playlistSongCount} {playlistSongCount === 1 ? 'música nesta lista' : 'músicas nesta lista'}
            </Text>
            <TouchableOpacity style={[styles.settingsInlineAction, { marginTop: 12 }]} onPress={openAddMusic}>
              <View>
                <Text style={styles.settingsControlTitle}>Adicionar música</Text>
                <Text style={styles.settingsControlHint}>Escolha músicas para incluir na lista.</Text>
              </View>
              <Plus size={19} color="#4FC3F7" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsInlineAction} onPress={openOrderList}>
              <View>
                <Text style={styles.settingsControlTitle}>Ordenar lista</Text>
                <Text style={styles.settingsControlHint}>Use setas ou arraste para reorganizar.</Text>
              </View>
              <GripHorizontal size={19} color="#4FC3F7" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={openAdd} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={[styles.modal, { maxHeight: '80%' as any }]}>
            <Text style={styles.title}>Adicionar músicas</Text>
            <View style={[styles.search, { marginHorizontal: 0, marginBottom: 10 }]}>
              <Search size={18} color="#999" />
              <TextInput
                style={styles.inputSearch}
                placeholder="Buscar música..."
                placeholderTextColor="#666"
                value={q}
                onChangeText={setQ}
                autoFocus
              />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 14 }}>
              {available.length ? (
                available.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.card, { marginHorizontal: 0 }]}
                    onPress={async () => { await db.addSongToPlaylist(playlistId, s.id); load(); }}
                  >
                    <View>
                      <Text style={styles.title}>{s.title}</Text>
                      <Text style={styles.subtitle}>{s.artist}</Text>
                    </View>
                    <Plus size={18} color="#4FC3F7" />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.subtitle, { marginTop: 6 }]}>Nada encontrado.</Text>
              )}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity onPress={() => setOpenAdd(false)}>
                <Text style={{ color: '#4FC3F7', fontWeight: '800' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openOrder} transparent animationType="fade" onRequestClose={() => setOpenOrder(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.orderModal, styles.settingsModalLarge]}>
            <View style={styles.settingsModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsModalTitle}>Ordenar lista</Text>
                <Text style={styles.settingsControlHint} numberOfLines={1}>
                  {playlist?.name || 'Lista'} • {playlistSongCount} {playlistSongCount === 1 ? 'música' : 'músicas'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setOpenOrder(false)}>
                <Text style={styles.settingsCloseText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.orderHintBox}>
              <GripHorizontal size={16} color="#4FC3F7" />
              <Text style={styles.orderHintText}>Arraste as músicas ou use as setas para mudar a ordem.</Text>
            </View>
            <ScrollView style={styles.orderScroll} contentContainerStyle={{ paddingBottom: 12 }}>
              {orderedDraftSongs.length ? (
                orderedDraftSongs.map((song, index) => {
                  const isFirst = index === 0;
                  const isLast = index === orderedDraftSongs.length - 1;
                  return (
                    <div
                      key={song.id}
                      style={{
                        ...(styles.orderRow as React.CSSProperties),
                        opacity: draggedSongId === song.id ? 0.55 : 1,
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const draggedId = draggedSongId || event.dataTransfer.getData('text/plain');
                        if (!draggedId || draggedId === song.id) return;
                        moveDraftSong(draftOrderIds.indexOf(draggedId), draftOrderIds.indexOf(song.id));
                        setDraggedSongId(null);
                      }}
                    >
                      <Text style={styles.orderIndex}>{index + 1}</Text>
                      <View style={styles.orderSongInfo}>
                        <Text style={styles.orderSongTitle} numberOfLines={1}>{song.title}</Text>
                        <Text style={styles.orderSongArtist} numberOfLines={1}>
                          {(song.artist || '').trim() || 'Sem artista'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.orderIconButton, isFirst && styles.orderIconButtonDisabled]}
                        onPress={() => moveDraftSongById(song.id, -1)}
                        disabled={isFirst}
                      >
                        <ArrowUp size={15} color={isFirst ? '#4b5563' : '#4FC3F7'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.orderIconButton, isLast && styles.orderIconButtonDisabled]}
                        onPress={() => moveDraftSongById(song.id, 1)}
                        disabled={isLast}
                      >
                        <ArrowDown size={15} color={isLast ? '#4b5563' : '#4FC3F7'} />
                      </TouchableOpacity>
                      <div
                        draggable
                        style={styles.orderDragHandle as React.CSSProperties}
                        onDragStart={(event) => {
                          setDraggedSongId(song.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', song.id);
                        }}
                        onDragEnd={() => setDraggedSongId(null)}
                      >
                        <GripHorizontal size={18} color="#4FC3F7" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <Text style={styles.settingsEmptyText}>Adicione músicas antes de ordenar a lista.</Text>
              )}
            </ScrollView>
            <View style={styles.settingsModalActions}>
              <TouchableOpacity
                style={styles.modalGhostBtn}
                onPress={() => {
                  setOpenOrder(false);
                  setDraggedSongId(null);
                }}
              >
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={savePlaylistOrder}>
                <Text style={styles.modalPrimaryText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SongDetailScreen({
  nav,
  id,
  settings,
  returnTo,
  isPlaying,
  setIsPlaying,
  sourcePlaylistId,
  sourcePlaylistName,
}: {
  nav: any;
  id: string;
  settings: DisplaySettings;
  returnTo?: Route;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  sourcePlaylistId?: string;
  sourcePlaylistName?: string;
}) {
  const { globalFilters } = useGenreFilter();
  const [song, setSong] = useState<Song | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [sourcePlaylistSongs, setSourcePlaylistSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [controlsModalOpen, setControlsModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [autoScrollModalOpen, setAutoScrollModalOpen] = useState(false);
  const [auto, setAuto] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<0 | 1 | 2 | 3>(2);
  const [fontSize, setFontSize] = useState(17);
  const [tomOpen, setTomOpen] = useState(false);
  const [baseTom, setBaseTom] = useState<(typeof KEY_OPTIONS)[number]>('C');
  const [selectedTom, setSelectedTom] = useState<(typeof KEY_OPTIONS)[number]>('C');
  const scrollRef = useRef<any>(null);
  const scrollPosRef = useRef(0);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollLastTimeRef = useRef<number | null>(null);

  const getScrollNode = () =>
    scrollRef.current?.getScrollableNode?.() ?? scrollRef.current;

  const getCurrentScrollTop = () => {
    const node = getScrollNode();
    return typeof node?.scrollTop === 'number' ? node.scrollTop : scrollPosRef.current;
  };

  const scrollToPosition = (y: number) => {
    const nextY = Math.max(0, y);
    scrollPosRef.current = nextY;
    const target = scrollRef.current;
    const node = getScrollNode();

    if (typeof target?.getScrollableNode === 'function' && typeof target?.scrollTo === 'function') {
      target.scrollTo({ x: 0, y: nextY, animated: false });
      return;
    }

    if (typeof node?.scrollTo === 'function') {
      node.scrollTo({ left: 0, top: nextY, behavior: 'auto' });
      return;
    }

    if (node) {
      node.scrollTop = nextY;
    }
  };

  const syncScrollPosition = (event: any) => {
    const y =
      event?.nativeEvent?.contentOffset?.y ??
      event?.currentTarget?.scrollTop ??
      event?.target?.scrollTop ??
      0;
    scrollPosRef.current = y;
  };

  const scrollSpeedLabel = autoScrollSpeed === 1 ? 'Lenta' : autoScrollSpeed === 2 ? 'Média' : autoScrollSpeed === 3 ? 'Rápida' : 'Sem rolagem';

  useEffect(() => {
    db.getSongs().then((all) => {
      setAllSongs(all);
      setSong(all.find((s) => s.id === id) || null);
      scrollPosRef.current = 0;
    });
  }, [id]);

  useEffect(() => {
    const list = allSongs.filter((s) => matchesGenreFilter(s, globalFilters.selectedGenres));
    setFilteredSongs(list);
  }, [allSongs, globalFilters]);

  useEffect(() => {
    if (sourcePlaylistId) {
      db.byPlaylist(sourcePlaylistId).then((playlist) => {
        if (!playlist) {
          setSourcePlaylistSongs([]);
          return;
        }
        const byId = new Map(allSongs.map((s) => [s.id, s]));
        setSourcePlaylistSongs(
          playlist.songIds
            .map((songId) => byId.get(songId))
            .filter((s): s is Song => !!s)
        );
      });
    } else {
      setSourcePlaylistSongs([]);
    }
  }, [sourcePlaylistId, allSongs]);

  useEffect(() => {
    const list = sourcePlaylistId && sourcePlaylistSongs.length > 0 ? sourcePlaylistSongs : filteredSongs;
    const index = list.findIndex((s) => s.id === id);
    setCurrentSongIndex(index >= 0 ? index : 0);
  }, [filteredSongs, sourcePlaylistSongs, sourcePlaylistId, id]);
  useEffect(() => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    autoScrollLastTimeRef.current = null;

    if (!auto || autoScrollSpeed === 0) return;

    scrollPosRef.current = getCurrentScrollTop();
    const pixelsPerSecond =
      autoScrollSpeed === 1 ? 95 : autoScrollSpeed === 2 ? 180 : 360;

    const tick = (time: number) => {
      const lastTime = autoScrollLastTimeRef.current ?? time;
      const elapsedSeconds = Math.min((time - lastTime) / 1000, 0.08);
      autoScrollLastTimeRef.current = time;

      const node = getScrollNode();
      const maxScroll =
        node && typeof node.scrollHeight === 'number' && typeof node.clientHeight === 'number'
          ? Math.max(0, node.scrollHeight - node.clientHeight)
          : Number.POSITIVE_INFINITY;
      const currentY = getCurrentScrollTop();
      const nextY = Math.min(currentY + pixelsPerSecond * elapsedSeconds, maxScroll);
      scrollToPosition(nextY);

      autoScrollFrameRef.current = window.requestAnimationFrame(tick);
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
      autoScrollLastTimeRef.current = null;
    };
  }, [auto, autoScrollSpeed, song?.id]);

  useEffect(() => {
    if (!song) return;
    setFontSize(song.preferredFontSize ?? 17);
  }, [song?.id, song?.preferredFontSize]);
  useEffect(() => {
    if (!song) return;
    window.requestAnimationFrame(() => scrollToPosition(0));
  }, [song?.id]);
  useEffect(() => {
    if (!song?.content) return;
    const detected = detectTomFromContent(song.content);
    setBaseTom(detected);
    setSelectedTom(detected);
  }, [song?.id, song?.content]);
  if (!song) return null;
  const transpose = getTransposeBetweenKeys(baseTom, selectedTom);
  const text = transposeContent(song.content, transpose);
  const currentSongList = sourcePlaylistId && sourcePlaylistSongs.length > 0 ? sourcePlaylistSongs : filteredSongs;
  const currentListName = sourcePlaylistId && sourcePlaylistName ? sourcePlaylistName : 'Lista Atual';

  const navigateToIndex = (index: number) => {
    if (index < 0 || index >= currentSongList.length) return;
    const nextSong = currentSongList[index];
    setControlsModalOpen(false);
    setListModalOpen(false);
    nav.navigate('SongDetail', {
      id: nextSong.id,
      returnTo,
      sourcePlaylistId,
      sourcePlaylistName,
    });
  };

  const changeFontSize = async (delta: number) => {
    const next = Math.max(12, Math.min(28, fontSize + delta));
    setFontSize(next);
    await db.updateSong(song.id, { preferredFontSize: next });
  };

  return (
    <View style={[styles.container, styles.songDetailContainer]}>
      {isPlaying && (
        <View style={styles.fullscreenActionRow}>
          <TouchableOpacity style={styles.fullscreenActionBtn} onPress={() => setControlsModalOpen(true)}>
            <Menu size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fullscreenActionBtn}
            onPress={() => {
              setIsPlaying(false);
              setAuto(false);
            }}
          >
            <Text style={styles.fullscreenActionText}>X</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={[styles.screenTitle, { marginTop: 12 }]} numberOfLines={1}>{song.title}</Text>
      <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: getSongGenreDisplay(song) ? 4 : 8 }]}>{song.artist}</Text>
      {getSongGenreDisplay(song) ? (
        <Text style={[styles.songGenreBadge, { marginHorizontal: 12, marginBottom: 8 }]}>{getSongGenreDisplay(song)}</Text>
      ) : null}
      {song.observation?.trim() ? (
        <Text style={styles.songObservation}>{song.observation.trim()}</Text>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={styles.songDetailScroll}
        contentContainerStyle={{ paddingBottom: isPlaying ? 40 : 110 }}
        onScroll={syncScrollPosition}
        scrollEventThrottle={16}
      >
        {text.split('\n').map((l, i) => (
          <ChordLine key={i} text={l} fontSize={fontSize} settings={settings} />
        ))}
      </ScrollView>
      {!isPlaying && (
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => {
            const nextAuto = !auto;
            setAuto(nextAuto);
            setIsPlaying(nextAuto);
          }} style={styles.panelBtn}>
            {auto ? <Square size={18} color="#4FC3F7" /> : <Play size={18} color="#bbb" />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeFontSize(-1)} style={styles.panelBtn}>
            <Text style={{ color: '#bbb', fontWeight: '700' }}>A-</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeFontSize(1)} style={styles.panelBtn}>
            <Text style={{ color: '#bbb', fontWeight: '700' }}>A+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTomOpen(true)} style={styles.panelBtn}>
            <Text style={{ color: '#4FC3F7', fontWeight: '800' }}>Tom</Text>
          </TouchableOpacity>
          <Text style={styles.transpose}>{selectedTom}</Text>
          <TouchableOpacity
            onPress={() => nav.navigate('SongEditor', { id: song.id, returnTo })}
            style={styles.panelBtn}
          >
            <Pencil size={17} color="#4FC3F7" />
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={controlsModalOpen} transparent animationType="fade" onRequestClose={() => setControlsModalOpen(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.settingsModalCard, styles.settingsModalLarge]}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Controles Rápidos</Text>
              <TouchableOpacity onPress={() => setControlsModalOpen(false)}>
                <Text style={styles.settingsCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 12, paddingBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, currentSongIndex <= 0 && { opacity: 0.45 }]}
                  disabled={currentSongIndex <= 0}
                  onPress={() => navigateToIndex(currentSongIndex - 1)}
                >
                  <Text style={styles.modalPrimaryText}>Anterior</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, currentSongIndex >= filteredSongs.length - 1 && { opacity: 0.45 }]}
                  disabled={currentSongIndex >= filteredSongs.length - 1}
                  onPress={() => navigateToIndex(currentSongIndex + 1)}
                >
                  <Text style={styles.modalPrimaryText}>Próxima</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.modalGhostBtn}
                onPress={() => {
                  setControlsModalOpen(false);
                  setListModalOpen(true);
                }}
              >
                <Text style={styles.modalGhostText}>Ver Lista Atual</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalGhostBtn, { marginTop: 10 }]}
                onPress={() => {
                  setControlsModalOpen(false);
                  setAutoScrollModalOpen(true);
                }}
              >
                <Text style={styles.modalGhostText}>
                  Auto-Rolagem: {auto ? scrollSpeedLabel : 'Desativada'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={listModalOpen} transparent animationType="fade" onRequestClose={() => setListModalOpen(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.settingsModalCard, styles.settingsModalLarge]}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>{currentListName}</Text>
              <TouchableOpacity onPress={() => setListModalOpen(false)}>
                <Text style={styles.settingsCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <FlatList<Song>
              data={currentSongList}
              keyExtractor={(item: Song) => item.id}
              style={{ maxHeight: 320, paddingHorizontal: 12 }}
              renderItem={({ item, index }: { item: Song; index: number }) => (
                <TouchableOpacity
                  style={[
                    styles.listRow,
                    index === currentSongIndex ? styles.listRowActive : null,
                    { justifyContent: 'space-between', paddingVertical: 12 },
                  ]}
                  onPress={() => navigateToIndex(index)}
                >
                  <Text style={{ color: index === currentSongIndex ? '#4FC3F7' : '#fff' }}>{item.title}</Text>
                  <Text style={{ color: '#aaa' }}>{item.artist}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.settingsEmptyText}>Nenhuma música na lista atual.</Text>}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={autoScrollModalOpen} transparent animationType="fade" onRequestClose={() => setAutoScrollModalOpen(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.settingsModalCard, styles.settingsModalLarge]}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Auto-Rolagem</Text>
              <TouchableOpacity onPress={() => setAutoScrollModalOpen(false)}>
                <Text style={styles.settingsCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.settingsControlTitle, { marginBottom: 10 }]}>Escolha uma velocidade</Text>
            <View style={{ gap: 10 }}>
              {[
                { value: 0, label: 'Sem rolagem' },
                { value: 1, label: 'Lenta' },
                { value: 2, label: 'Média' },
                { value: 3, label: 'Rápida' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalOptionBtn,
                    autoScrollSpeed === option.value && styles.modalOptionBtnActive,
                  ]}
                  onPress={() => {
                    setAutoScrollSpeed(option.value as 0 | 1 | 2 | 3);
                    setAuto(option.value > 0);
                    setIsPlaying(option.value > 0);
                  }}
                >
                  <Text style={[styles.modalOptionText, autoScrollSpeed === option.value && { color: '#fff' }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.settingsModalActions}>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => setAutoScrollModalOpen(false)}>
                <Text style={styles.modalPrimaryText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={tomOpen} transparent animationType="fade" onRequestClose={() => setTomOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.title}>Selecionar tom</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {KEY_OPTIONS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={{
                    borderWidth: 1,
                    borderColor: selectedTom === key ? '#4FC3F7' : '#333',
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    backgroundColor: selectedTom === key ? '#1f2937' : '#121212',
                  }}
                  onPress={() => {
                    setSelectedTom(key);
                    setTomOpen(false);
                  }}
                >
                  <Text style={{ color: selectedTom === key ? '#4FC3F7' : '#ddd', fontWeight: '700' }}>{key}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 }}>
              <TouchableOpacity onPress={() => setTomOpen(false)}>
                <Text style={{ color: '#aaa' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SongEditorScreen({ nav, id, settings, onHeaderControlsChange, returnTo }: any) {
  const isNew = id === 'new';
  const webEditorHeight = 'calc(100dvh - 250px)';
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [observation, setObservation] = useState('');
  const [registeredGenres, setRegisteredGenres] = useState<Genre[]>([]);
  const [selectedGenreKeys, setSelectedGenreKeys] = useState<Set<string>>(new Set());
  const [openGenres, setOpenGenres] = useState(false);
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [editorFontSize, setEditorFontSize] = useState(17);
  const [editorExpanded, setEditorExpanded] = useState(false);
  useEffect(() => { db.getGenres().then(setRegisteredGenres); }, []);
  useEffect(() => {
    if (!isNew) {
      db.getSongs().then((all) => {
        const s = all.find((x) => x.id === id);
        if (s) {
          setTitle(s.title);
          setArtist(s.artist);
          setObservation(s.observation || '');
          setSelectedGenreKeys(new Set(getSongGenreKeys(s)));
          setContent(s.content);
          setSourceUrl(s.sourceUrl || '');
          setEditorFontSize(s.preferredFontSize ?? 17);
        }
      });
    }
  }, [id, isNew]);

  const save = async () => {
    if (!title.trim()) return Alert.alert('Informe o título');
    const nextGenreKeys = Array.from(selectedGenreKeys);
    const genreDisplay = nextGenreKeys.map((genre) => getGenreDisplayName(genre, registeredGenres)).join(', ');
    if (isNew) {
      const created = await db.addSong({
        title,
        artist,
        genre: genreDisplay || undefined,
        genres: nextGenreKeys.length ? nextGenreKeys : undefined,
        observation,
        content,
        sourceUrl,
        updatedAt: Date.now(),
      });
      nav.navigate('SongDetail', { id: created.id, returnTo });
      return;
    }
    await db.updateSong(id, {
      title,
      artist,
      genre: genreDisplay || undefined,
      genres: nextGenreKeys.length ? nextGenreKeys : undefined,
      observation,
      content,
      sourceUrl,
      updatedAt: Date.now(),
    });
    nav.navigate('SongDetail', { id, returnTo });
  };

  const cancel = () => {
    if (isNew) {
      if (returnTo?.name) {
        nav.navigate(returnTo.name, returnTo.params);
        return;
      }
      nav.navigate('Songs');
      return;
    }
    nav.navigate('SongDetail', { id, returnTo });
  };

  const openSource = () => {
    if (!sourceUrl) return;
    window.open(sourceUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    onHeaderControlsChange({
      onCancel: cancel,
      onOpenSource: openSource,
      onSave: save,
      canOpenSource: !!sourceUrl,
    });
    return () => onHeaderControlsChange(null);
  }, [cancel, onHeaderControlsChange, openSource, returnTo, save, sourceUrl]);

  const editorLineHeight = Math.max(24, Math.round(editorFontSize * 1.85));
  const editorTextareaStyle = (expanded = false): React.CSSProperties => {
    const paddingTop = expanded ? 14 : 10;
    return {
    width: '100%',
    height: '100%',
    minHeight: 0,
    display: 'block',
    flex: '1 1 auto',
    margin: 0,
    padding: expanded ? `${paddingTop}px 12px 24px` : `${paddingTop}px 10px 10px`,
    border: 'none',
    outline: 'none',
    resize: 'none',
    backgroundColor: 'transparent',
    color: '#fff',
    lineHeight: `${editorLineHeight}px`,
    fontSize: `${editorFontSize}px`,
    fontFamily: 'monospace',
    boxSizing: 'border-box',
    backgroundImage: `linear-gradient(to bottom, transparent ${Math.max(0, editorLineHeight - 1)}px, ${settings.staffLineColor} ${editorLineHeight}px)`,
    backgroundSize: `100% ${editorLineHeight}px`,
    backgroundPosition: `0 ${paddingTop}px`,
    backgroundAttachment: 'local',
    };
  };
  const selectedGenreLabel = Array.from(selectedGenreKeys)
    .map((genre) => getGenreDisplayName(genre, registeredGenres))
    .join(', ');
  const toggleEditorGenre = (genreName: string) => {
    const key = normalizeGenreName(genreName);
    const next = new Set(selectedGenreKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedGenreKeys(next);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>{isNew ? 'Nova música' : 'Editar música'}</Text>
      <View style={styles.editorForm}>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Nome da música" placeholderTextColor="#666" />
        <TextInput style={styles.input} value={artist} onChangeText={setArtist} placeholder="Nome do artista" placeholderTextColor="#666" />
        <TouchableOpacity style={[styles.input, styles.genrePicker]} onPress={() => setOpenGenres(true)}>
          <Text style={{ color: selectedGenreLabel ? '#fff' : '#666' }}>
            {selectedGenreLabel || 'Selecionar gêneros'}
          </Text>
          <ChevronRight size={18} color="#4FC3F7" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={observation}
          onChangeText={setObservation}
          placeholder="Observação (ex: Meu tom é A)"
          placeholderTextColor="#666"
        />
        <View style={styles.editorSectionHeader}>
          <Text style={styles.editorSectionTitle}>Texto da cifra</Text>
          <TouchableOpacity style={styles.editorExpandBtn} onPress={() => setEditorExpanded(true)}>
            <Maximize2 size={18} color="#4FC3F7" />
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.editorContentWrap,
            Platform.OS === 'web' ? ({ height: webEditorHeight, minHeight: webEditorHeight } as any) : null,
          ]}
        >
          {Platform.OS === 'web' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Cole os acordes/letra"
              style={editorTextareaStyle()}
            />
          ) : (
            <TextInput
              style={[styles.editorContentInput, { fontSize: editorFontSize, lineHeight: editorLineHeight }]}
              multiline
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
              placeholder="Cole os acordes/letra"
              placeholderTextColor="#666"
            />
          )}
        </View>
      </View>
      <Modal visible={editorExpanded} transparent={false} animationType="slide" onRequestClose={() => setEditorExpanded(false)}>
        <SafeAreaView style={styles.expandedEditorModal}>
          <View style={styles.expandedEditorHeader}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setEditorExpanded(false)}>
              <Minimize2 size={18} color="#4FC3F7" />
            </TouchableOpacity>
            <Text style={styles.expandedEditorTitle} numberOfLines={1}>
              Texto da cifra
            </Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setEditorExpanded(false)}>
              <Text style={styles.editorActionLabel}>OK</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.expandedEditorBody}>
            {Platform.OS === 'web' ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Cole os acordes/letra"
                autoFocus
                style={editorTextareaStyle(true)}
              />
            ) : (
              <TextInput
                style={[
                  styles.editorContentInput,
                  styles.expandedEditorInput,
                  { fontSize: editorFontSize, lineHeight: editorLineHeight },
                ]}
                multiline
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
                placeholder="Cole os acordes/letra"
                placeholderTextColor="#666"
                autoFocus
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
      <Modal visible={openGenres} transparent animationType="fade" onRequestClose={() => setOpenGenres(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.settingsModalCard, styles.settingsModalLarge]}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Gêneros da música</Text>
              <TouchableOpacity onPress={() => setOpenGenres(false)}>
                <Text style={styles.settingsCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.settingsControlHint}>Selecione um ou mais gêneros cadastrados.</Text>
            <ScrollView style={styles.settingsModalScroll} contentContainerStyle={{ paddingVertical: 12 }}>
              {registeredGenres.length ? (
                <View style={styles.genreFilterGrid}>
                  {registeredGenres.map((genre) => {
                    const key = normalizeGenreName(genre.name);
                    const isSelected = selectedGenreKeys.has(key);
                    return (
                      <TouchableOpacity
                        key={genre.id}
                        style={styles.genreFilterCell}
                        onPress={() => toggleEditorGenre(genre.name)}
                      >
                        <View style={[styles.genreFilterBox, isSelected && styles.genreFilterBoxActive]}>
                          {isSelected ? <Text style={styles.genreFilterCheck}>✓</Text> : null}
                        </View>
                        <Text
                          style={[styles.genreFilterLabel, isSelected && styles.genreFilterLabelActive]}
                          numberOfLines={1}
                        >
                          {genre.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.settingsEmptyText}>Cadastre gêneros em Configurações antes de selecionar.</Text>
              )}
            </ScrollView>
            <View style={styles.settingsModalActions}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setSelectedGenreKeys(new Set())}>
                <Text style={styles.modalGhostText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => setOpenGenres(false)}>
                <Text style={styles.modalPrimaryText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ImportScreen({ nav, songReturnTo, initialUrl, autoImportKey }: any) {
  const [url, setUrl] = useState(() => extractUrlFromSharedText(initialUrl) || '');
  const [loading, setLoading] = useState(false);
  const lastAutoImportKeyRef = useRef<any>(null);

  const run = React.useCallback(async (nextUrl?: string) => {
    const importUrl = (nextUrl ?? url).trim();
    if (!importUrl || loading) return;
    setUrl(importUrl);
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/scrape?url=${encodeURIComponent(importUrl)}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const s = await db.addSong({
        title: data.title,
        artist: data.artist,
        observation: '',
        content: data.content,
        sourceUrl: importUrl,
        updatedAt: Date.now(),
      });
      nav.navigate('SongDetail', { id: s.id, returnTo: songReturnTo });
    } catch {
      Alert.alert('Erro', 'Não foi possível importar esta URL.');
    } finally {
      setLoading(false);
    }
  }, [loading, nav, songReturnTo, url]);

  useEffect(() => {
    const importUrl = extractUrlFromSharedText(initialUrl);
    if (importUrl) setUrl(importUrl);
  }, [initialUrl]);

  useEffect(() => {
    const importUrl = extractUrlFromSharedText(initialUrl);
    if (!importUrl || autoImportKey == null || lastAutoImportKeyRef.current === autoImportKey) return;
    lastAutoImportKeyRef.current = autoImportKey;
    setUrl(importUrl);
    void run(importUrl);
  }, [autoImportKey, initialUrl, run]);

  return (
    <View style={[styles.container, { padding: 16 }]}>
      <View style={styles.importBanner}>
        <Globe size={44} color="#4FC3F7" />
        <Text style={styles.importTitle}>Importação</Text>
        <Text style={styles.importDesc}>Cole a URL do Cifra Club.</Text>
      </View>
      <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="https://..." placeholderTextColor="#666" autoCapitalize="none" />
      <TouchableOpacity style={styles.primaryBtn} onPress={() => void run()} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '700' }}>Importar</Text>}
      </TouchableOpacity>
    </View>
  );
}

function BackupScreen() {
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parseCfs = (text: string) => {
    const norm = text.replace(/\r\n/g, '\n');
    const [first, ...rest] = norm.split('\n');
    const header = (first || '').trim();
    let artist = '';
    let title = header || 'Sem título';
    const m = header.match(/^(.*?)\s+-\s+(?:\([^)]*\)\s*)?(.*)$/);
    if (m) {
      artist = (m[1] || '').trim();
      title = (m[2] || '').trim() || title;
    }
    const body = rest.join('\n');
    const idx = body.indexOf('\n\n');
    const content = (idx >= 0 ? body.slice(idx + 2) : body).trim();
    return { artist, title, content };
  };
  const parseListCfs = (text: string, fallbackName: string) => {
    const norm = text.replace(/\r\n/g, '\n');
    const lines = norm
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const listName = (lines[0] || fallbackName).trim();
    const items = lines.slice(1).map((line) => {
      const [artist = '', title = ''] = line.split('|').map((part) => part.trim());
      return { artist, title };
    });
    return {
      name: listName,
      items: items.filter((item) => item.title),
    };
  };

  const restoreZip = async (file: File) => {
    setRestoreMsg(null);
    setRestoreProgress(null);
    setRestoreLoading(true);
    try {
      const ab = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(ab);
      const names = Object.keys(zip.files).filter((n) => n.toLowerCase().endsWith('.cfs'));
      if (!names.length) throw new Error('Nenhum arquivo .cfs encontrado no .zip.');
      const songFileNames = names.filter((n) => !n.toLowerCase().startsWith('[list]-'));
      const listFileNames = names.filter((n) => n.toLowerCase().startsWith('[list]-'));

      setRestoreProgress({ done: 0, total: names.length });
      const existing = await db.getSongs();
      const existingPlaylists = await db.getPlaylists();
      const key = (a: string, t: string) => `${a.trim().toLowerCase()}::${t.trim().toLowerCase()}`;
      const seen = new Set(existing.map((s) => key(s.artist, s.title)));
      const songIdByKey = new Map(existing.map((s) => [key(s.artist, s.title), s.id]));

      const imported: Song[] = [];
      const decoder = new TextDecoder('utf-8');
      let done = 0;

      for (let i = 0; i < songFileNames.length; i++) {
        const n = songFileNames[i];
        const u8 = await zip.file(n)?.async('uint8array');
        if (!u8) {
          done += 1;
          setRestoreProgress({ done, total: names.length });
          continue;
        }
        let plain: string;
        try {
          const inflated = pako.inflate(u8);
          plain = decoder.decode(inflated);
        } catch {
          plain = decoder.decode(u8);
        }
        const parsed = parseCfs(plain);
        const k = key(parsed.artist, parsed.title);
        if (!seen.has(k)) {
          const createdSong: Song = {
            id: uid(),
            artist: parsed.artist,
            title: parsed.title,
            observation: '',
            content: parsed.content || plain,
            updatedAt: Date.now(),
          };
          imported.push(createdSong);
          seen.add(k);
          songIdByKey.set(k, createdSong.id);
        }
        done += 1;
        setRestoreProgress({ done, total: names.length });
      }

      if (imported.length) await db.saveSongs([...imported, ...existing]);

      const normalizePlaylistName = (name: string) => name.trim().toLowerCase();
      const playlists = [...existingPlaylists];
      const rootPlaylistByName = new Map<string, Playlist>();
      playlists
        .filter((pl) => pl.folderId === null)
        .forEach((pl) => rootPlaylistByName.set(normalizePlaylistName(pl.name), pl));

      let listsCreated = 0;
      let listsUpdated = 0;

      for (let i = 0; i < listFileNames.length; i++) {
        const fileName = listFileNames[i];
        const u8 = await zip.file(fileName)?.async('uint8array');
        if (!u8) {
          done += 1;
          setRestoreProgress({ done, total: names.length });
          continue;
        }

        let plain: string;
        try {
          const inflated = pako.inflate(u8);
          plain = decoder.decode(inflated);
        } catch {
          plain = decoder.decode(u8);
        }

        const fallbackName = fileName.replace(/^\[list\]-/i, '').replace(/\.cfs$/i, '').trim();
        const parsedList = parseListCfs(plain, fallbackName);
        if (!parsedList.name) {
          done += 1;
          setRestoreProgress({ done, total: names.length });
          continue;
        }

        const resolvedSongIds: string[] = [];
        for (const item of parsedList.items) {
          const id = songIdByKey.get(key(item.artist, item.title));
          if (id && !resolvedSongIds.includes(id)) resolvedSongIds.push(id);
        }

        const playlistKey = normalizePlaylistName(parsedList.name);
        const existingPlaylist = rootPlaylistByName.get(playlistKey);
        if (existingPlaylist) {
          const mergedSongIds = Array.from(new Set([...existingPlaylist.songIds, ...resolvedSongIds]));
          if (mergedSongIds.length !== existingPlaylist.songIds.length) {
            existingPlaylist.songIds = mergedSongIds;
            listsUpdated += 1;
          }
        } else {
          const createdPlaylist: Playlist = {
            id: uid(),
            folderId: null,
            name: parsedList.name,
            songIds: resolvedSongIds,
          };
          playlists.unshift(createdPlaylist);
          rootPlaylistByName.set(playlistKey, createdPlaylist);
          listsCreated += 1;
        }

        done += 1;
        setRestoreProgress({ done, total: names.length });
      }

      if (listsCreated || listsUpdated) await db.savePlaylists(playlists);
      setRestoreMsg(
        `Restore concluído. Importadas ${imported.length} músicas (${songFileNames.length - imported.length} já existiam). ` +
          `Listas: ${listsCreated} criadas, ${listsUpdated} atualizadas.`
      );
    } catch (e: any) {
      setRestoreMsg(e?.message ? `Erro: ${e.message}` : 'Erro ao restaurar o backup.');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <View style={[styles.container, { padding: 16 }]}>
      <View style={styles.importBanner}>
        <ListMusic size={44} color="#4FC3F7" />
        <Text style={styles.importTitle}>ackup/Restauração</Text>
        <Text style={styles.importDesc}>Aqui você vai restaurar suas músicas a partir de um `.zip`.</Text>
      </View>

      {Platform.OS === 'web' ? (
        <View style={{ marginHorizontal: 12 }}>
          <TouchableOpacity
            style={[styles.primaryBtn, { marginHorizontal: 0 }]}
            onPress={() => fileInputRef.current?.click()}
            disabled={restoreLoading}
          >
            {restoreLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ color: '#000', fontWeight: '700' }}>Selecionar backup (.zip) e restaurar</Text>
            )}
          </TouchableOpacity>
          <input
            ref={(el) => { fileInputRef.current = el; }}
            type="file"
            accept=".zip,application/zip"
            disabled={restoreLoading}
            onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) restoreZip(f);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            style={{ display: 'none' }}
          />
          {restoreProgress ? (
            <Text style={[styles.subtitle, { marginTop: 8 }]}>
              Processando {restoreProgress.done}/{restoreProgress.total}...
            </Text>
          ) : null}
          {restoreMsg ? <Text style={[styles.subtitle, { marginTop: 8 }]}>{restoreMsg}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function SettingsScreen({
  settings,
  onChange,
  themeSettings,
  onThemeChange,
  songs: songsProp,
}: {
  settings: DisplaySettings;
  onChange: (next: Partial<DisplaySettings>) => void;
  themeSettings: ThemeSettings;
  onThemeChange: (next: Partial<ThemeSettings>) => void;
  songs: Song[];
}) {
  const { globalFilters, updateGlobalFilters } = useGenreFilter();
  const confirmDestructiveAction = useConfirmDestructiveAction();
  const [songs, setSongs] = useState<Song[]>(songsProp);
  const [registeredGenres, setRegisteredGenres] = useState<Genre[]>([]);
  const [openGenreFilter, setOpenGenreFilter] = useState(false);
  const [openCreateGenre, setOpenCreateGenre] = useState(false);
  const [openEditGenre, setOpenEditGenre] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [genreName, setGenreName] = useState('');
  const [localGenreSelection, setLocalGenreSelection] = useState<Set<string>>(
    new Set(globalFilters.selectedGenres)
  );
  const [openSettingsSection, setOpenSettingsSection] = useState<
    'genres' | 'chords' | 'lyrics' | 'editor' | 'theme' | null
  >(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showColorPickerLyrics, setShowColorPickerLyrics] = useState(false);
  const [showColorPickerStaff, setShowColorPickerStaff] = useState(false);

  const loadGenres = async () => {
    setRegisteredGenres(await db.getGenres());
  };

  useEffect(() => {
    if (songsProp.length === 0) {
      db.getSongs().then(setSongs);
    } else {
      setSongs(songsProp);
    }
  }, [songsProp]);
  useEffect(() => { loadGenres(); }, []);

  const allGenres = React.useMemo(() => {
    const set = new Set<string>();
    registeredGenres.forEach((genre) => {
      const g = normalizeGenreName(genre.name);
      if (g) set.add(g);
    });
    songs.forEach((s) => {
      getSongGenreKeys(s).forEach((g) => set.add(g));
    });
    return Array.from(set).sort();
  }, [registeredGenres, songs]);

  const genreCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    songs.forEach((s) => {
      getSongGenreKeys(s).forEach((g) => map.set(g, (map.get(g) || 0) + 1));
    });
    return map;
  }, [songs]);

  const handleOpenGenreFilter = () => {
    setLocalGenreSelection(new Set(globalFilters.selectedGenres));
    setOpenGenreFilter(true);
  };

  const handleToggleGenre = (genre: string) => {
    const next = new Set(localGenreSelection);
    if (next.has(genre)) {
      next.delete(genre);
    } else {
      next.add(genre);
    }
    setLocalGenreSelection(next);
  };

  const handleSelectAllGenres = () => {
    setLocalGenreSelection(new Set([...allGenres, NO_GENRE_KEY]));
  };

  const handleClearAllGenres = () => {
    setLocalGenreSelection(new Set());
  };

  const handleConfirmGenreFilter = () => {
    const nextSelection = Array.from(localGenreSelection);
    updateGlobalFilters(nextSelection.length === allGenres.length ? [] : nextSelection);
    setOpenGenreFilter(false);
  };

  const handleCreateGenre = async () => {
    const created = await db.addGenre(genreName);
    if (!created) return;
    setGenreName('');
    setOpenCreateGenre(false);
    await loadGenres();
  };

  const handleOpenEditGenre = (genre: Genre) => {
    setSelectedGenre(genre);
    setGenreName(genre.name);
    setOpenEditGenre(true);
  };

  const handleUpdateGenre = async () => {
    if (!selectedGenre) return;
    await db.updateGenre(selectedGenre.id, genreName);
    setOpenEditGenre(false);
    setSelectedGenre(null);
    setGenreName('');
    await loadGenres();
    setSongs(await db.getSongs());
  };

  const handleDeleteGenre = async () => {
    if (!selectedGenre) return;
    setOpenEditGenre(false);
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja excluir o gênero "${selectedGenre.name}"? Ele será removido das músicas.`
    );
    if (!confirmed) {
      setSelectedGenre(null);
      setGenreName('');
      return;
    }
    await db.deleteGenre(selectedGenre.id);
    const deletedKey = normalizeGenreName(selectedGenre.name);
    updateGlobalFilters(globalFilters.selectedGenres.filter((genre) => genre !== deletedKey));
    setOpenEditGenre(false);
    setSelectedGenre(null);
    setGenreName('');
    await loadGenres();
    setSongs(await db.getSongs());
  };

  const activeGenreCount = globalFilters.selectedGenres.length;
  const totalGenreCount = allGenres.length;
  const genreFilterSummary = activeGenreCount > 0
    ? `${activeGenreCount} de ${totalGenreCount} selecionados`
    : `Mostrando todos os ${totalGenreCount} gêneros`;
  const themeModeLabel =
    themeSettings.mode === 'light' ? 'Claro' : themeSettings.mode === 'custom' ? 'Personalizado' : 'Escuro';
  const updateCustomThemeColor = (key: keyof ThemePalette, value: string) => {
    const nextCustom = { ...themeSettings.custom, [key]: value };
    if (key === 'surface') {
      nextCustom.surfaceAlt = value;
      nextCustom.surfaceSoft = value;
    }
    if (key === 'borderSoft') {
      nextCustom.border = value;
    }
    if (key === 'accent') {
      nextCustom.accentSoft = value.length === 7 ? `${value}22` : themeSettings.custom.accentSoft;
    }
    onThemeChange({ mode: 'custom', custom: nextCustom });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.settingsContent}>
      <TouchableOpacity style={styles.settingsCategoryCard} onPress={() => setOpenSettingsSection('genres')}>
        <View style={styles.settingsCategoryIcon}>
          <Music size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Gêneros</Text>
          <Text style={styles.settingsCategorySubtitle}>
            {registeredGenres.length} cadastrados • {genreFilterSummary}
          </Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsCategoryCard} onPress={() => setOpenSettingsSection('chords')}>
        <View style={styles.settingsCategoryIcon}>
          <ListMusic size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Acordes</Text>
          <Text style={styles.settingsCategorySubtitle}>
            Cor do acorde • Negrito {settings.chordBold ? 'ativado' : 'desativado'}
          </Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsCategoryCard} onPress={() => setOpenSettingsSection('lyrics')}>
        <View style={styles.settingsCategoryIcon}>
          <Pencil size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Letra</Text>
          <Text style={styles.settingsCategorySubtitle}>
            Cor da letra • Negrito {settings.lyricsBold ? 'ativado' : 'desativado'}
          </Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsCategoryCard} onPress={() => setOpenSettingsSection('editor')}>
        <View style={styles.settingsCategoryIcon}>
          <SettingsIcon size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Editor</Text>
          <Text style={styles.settingsCategorySubtitle}>Cor da pauta do editor</Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsCategoryCard} onPress={() => setOpenSettingsSection('theme')}>
        <View style={styles.settingsCategoryIcon}>
          <Palette size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Tema</Text>
          <Text style={styles.settingsCategorySubtitle}>
            {themeModeLabel} • escolha as cores do app
          </Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <Modal
        visible={openSettingsSection !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenSettingsSection(null)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.settingsModalCard, styles.settingsModalLarge]}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>
                {openSettingsSection === 'genres'
                  ? 'Gêneros'
                  : openSettingsSection === 'chords'
                    ? 'Acordes'
                    : openSettingsSection === 'lyrics'
                      ? 'Letra'
                      : openSettingsSection === 'editor'
                        ? 'Editor'
                        : 'Tema'}
              </Text>
              <TouchableOpacity onPress={() => setOpenSettingsSection(null)}>
                <Text style={styles.settingsCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsModalScroll} contentContainerStyle={{ paddingBottom: 4 }}>
              {openSettingsSection === 'genres' ? (
                <>
                  <TouchableOpacity
                    style={styles.settingsInlineAction}
                    onPress={() => {
                      setGenreName('');
                      setOpenCreateGenre(true);
                    }}
                  >
                    <View>
                      <Text style={styles.settingsControlTitle}>Cadastrar gênero</Text>
                      <Text style={styles.settingsControlHint}>{registeredGenres.length} cadastrados</Text>
                    </View>
                    <Plus size={19} color="#4FC3F7" />
                  </TouchableOpacity>

                  <Text style={styles.settingsModalSubhead}>Gêneros cadastrados</Text>
                  {registeredGenres.length ? (
                    <View style={styles.registeredGenreGrid}>
                      {registeredGenres.map((genre) => {
                        const count = genreCountMap.get(normalizeGenreName(genre.name)) || 0;
                        return (
                          <TouchableOpacity
                            key={genre.id}
                            style={styles.registeredGenreChip}
                            onPress={() => handleOpenEditGenre(genre)}
                          >
                            <View style={styles.registeredGenreChipText}>
                              <Text style={styles.registeredGenreName} numberOfLines={1}>{genre.name}</Text>
                              <Text style={styles.registeredGenreCount}>
                                {count} {count === 1 ? 'música' : 'músicas'}
                              </Text>
                            </View>
                            <Pencil size={13} color="#4FC3F7" />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.settingsEmptyText}>Nenhum gênero cadastrado.</Text>
                  )}

                  <TouchableOpacity style={styles.settingsInlineAction} onPress={handleOpenGenreFilter}>
                    <View>
                      <Text style={styles.settingsControlTitle}>Filtrar gêneros</Text>
                      <Text style={styles.settingsControlHint}>{genreFilterSummary}</Text>
                    </View>
                    <ChevronRight size={19} color="#4FC3F7" />
                  </TouchableOpacity>
                </>
              ) : null}

              {openSettingsSection === 'chords' ? (
                <>
                  <View style={styles.settingsControlBlock}>
                    <Text style={styles.settingsControlTitle}>Cor do acorde</Text>
                    <View style={styles.colorSwatchRow}>
                      {COLOR_OPTIONS.map((color) => (
                        <TouchableOpacity
                          key={color}
                          onPress={() => onChange({ chordColor: color })}
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: color },
                            settings.chordColor === color && styles.colorSwatchActive,
                          ]}
                        />
                      ))}
                      <TouchableOpacity
                        onPress={() => setShowColorPicker(!showColorPicker)}
                        style={[styles.colorSwatch, styles.customColorButton]}
                      >
                        <Text style={styles.customColorButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {showColorPicker && (
                      <View style={styles.colorPickerContainer}>
                        <HexColorPicker
                          color={settings.chordColor}
                          onChange={(color) => onChange({ chordColor: color })}
                        />
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.settingsControlRow}
                    onPress={() => onChange({ chordBold: !settings.chordBold })}
                  >
                    <Text style={styles.settingsControlTitle}>Acorde em negrito</Text>
                    <View style={[styles.statusPill, settings.chordBold && styles.statusPillActive]}>
                      <Text style={[styles.statusPillText, settings.chordBold && styles.statusPillTextActive]}>
                        {settings.chordBold ? 'Ativado' : 'Desativado'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : null}

              {openSettingsSection === 'lyrics' ? (
                <>
                  <View style={styles.settingsControlBlock}>
                    <Text style={styles.settingsControlTitle}>Cor da letra</Text>
                    <View style={styles.colorSwatchRow}>
                      {COLOR_OPTIONS.map((color) => (
                        <TouchableOpacity
                          key={`ly-${color}`}
                          onPress={() => onChange({ lyricsColor: color })}
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: color },
                            settings.lyricsColor === color && styles.colorSwatchActive,
                          ]}
                        />
                      ))}
                      <TouchableOpacity
                        onPress={() => setShowColorPickerLyrics(!showColorPickerLyrics)}
                        style={[styles.colorSwatch, styles.customColorButton]}
                      >
                        <Text style={styles.customColorButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {showColorPickerLyrics && (
                      <View style={styles.colorPickerContainer}>
                        <HexColorPicker
                          color={settings.lyricsColor}
                          onChange={(color) => onChange({ lyricsColor: color })}
                        />
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.settingsControlRow}
                    onPress={() => onChange({ lyricsBold: !settings.lyricsBold })}
                  >
                    <Text style={styles.settingsControlTitle}>Letra em negrito</Text>
                    <View style={[styles.statusPill, settings.lyricsBold && styles.statusPillActive]}>
                      <Text style={[styles.statusPillText, settings.lyricsBold && styles.statusPillTextActive]}>
                        {settings.lyricsBold ? 'Ativado' : 'Desativado'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : null}

              {openSettingsSection === 'editor' ? (
                <View style={styles.settingsControlBlock}>
                  <Text style={styles.settingsControlTitle}>Cor da pauta</Text>
                  <View style={styles.colorSwatchRow}>
                    {STAFF_LINE_COLOR_OPTIONS.map((color) => (
                      <TouchableOpacity
                        key={`staff-${color}`}
                        onPress={() => onChange({ staffLineColor: color })}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: color },
                          settings.staffLineColor === color && styles.colorSwatchActive,
                        ]}
                      />
                    ))}
                    <TouchableOpacity
                      onPress={() => setShowColorPickerStaff(!showColorPickerStaff)}
                      style={[styles.colorSwatch, styles.customColorButton]}
                    >
                      <Text style={styles.customColorButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  {showColorPickerStaff && (
                    <View style={styles.colorPickerContainer}>
                      <HexColorPicker
                        color={settings.staffLineColor}
                        onChange={(color) => onChange({ staffLineColor: color })}
                      />
                    </View>
                  )}
                </View>
              ) : null}

              {openSettingsSection === 'theme' ? (
                <>
                  <View style={styles.themeModeGrid}>
                    {[
                      { mode: 'dark' as const, title: 'Escuro', hint: 'Tema atual' },
                      { mode: 'light' as const, title: 'Claro', hint: 'Fundo claro' },
                      { mode: 'custom' as const, title: 'Personalizado', hint: 'Suas cores' },
                    ].map((option) => {
                      const isActive = themeSettings.mode === option.mode;
                      return (
                        <TouchableOpacity
                          key={option.mode}
                          style={[styles.themeModeCard, isActive && styles.themeModeCardActive]}
                          onPress={() => onThemeChange({ mode: option.mode })}
                        >
                          <View style={[styles.themeModeDot, option.mode === 'light' && styles.themeModeDotLight, option.mode === 'custom' && styles.themeModeDotCustom]} />
                          <Text style={[styles.themeModeTitle, isActive && styles.themeModeTitleActive]}>{option.title}</Text>
                          <Text style={styles.themeModeHint}>{option.hint}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {themeSettings.mode === 'custom' ? (
                    <View style={styles.settingsControlBlock}>
                      <Text style={styles.settingsControlTitle}>Cores personalizadas</Text>
                      <Text style={styles.settingsControlHint}>
                        Ao alterar uma cor, o tema personalizado será aplicado.
                      </Text>
                      <View style={styles.themeCustomGrid}>
                        {THEME_COLOR_INPUTS.map((item) => (
                          <View key={item.key} style={styles.themeColorRow}>
                            <View>
                              <Text style={styles.themeColorLabel}>{item.label}</Text>
                              <Text style={styles.themeColorValue}>{themeSettings.custom[item.key]}</Text>
                            </View>
                            <input
                              type="color"
                              value={themeSettings.custom[item.key]}
                              onChange={(event) =>
                                updateCustomThemeColor(item.key, event.target.value)
                              }
                              style={styles.themeColorInput as React.CSSProperties}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={openCreateGenre} transparent animationType="fade" onRequestClose={() => setOpenCreateGenre(false)}>
        <View style={styles.modalBg}>
          <View style={styles.settingsModalCard}>
            <Text style={styles.settingsModalTitle}>Novo gênero</Text>
            <TextInput
              style={styles.settingsInput}
              value={genreName}
              onChangeText={setGenreName}
              placeholder="Ex: Católica"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={styles.settingsModalActions}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setOpenCreateGenre(false)}>
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleCreateGenre}>
                <Text style={styles.modalPrimaryText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={openEditGenre} transparent animationType="fade" onRequestClose={() => setOpenEditGenre(false)}>
        <View style={styles.modalBg}>
          <View style={styles.settingsModalCard}>
            <Text style={styles.settingsModalTitle}>Editar gênero</Text>
            <TextInput
              style={styles.settingsInput}
              value={genreName}
              onChangeText={setGenreName}
              placeholder="Nome do gênero"
              placeholderTextColor="#666"
              autoFocus
            />
            <TouchableOpacity style={[styles.modalActionBtn, styles.modalDangerBtn]} onPress={handleDeleteGenre}>
              <Text style={styles.modalDangerText}>Excluir gênero</Text>
            </TouchableOpacity>
            <View style={styles.settingsModalActions}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setOpenEditGenre(false)}>
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleUpdateGenre}>
                <Text style={styles.modalPrimaryText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={openGenreFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenGenreFilter(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.settingsModalCard, styles.settingsModalLarge]}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Filtrar gêneros</Text>
              <TouchableOpacity onPress={() => setOpenGenreFilter(false)}>
                <Text style={styles.settingsCloseText}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.settingsControlHint}>Selecione os gêneros que deseja visualizar no app.</Text>

            <ScrollView style={styles.settingsModalScroll} contentContainerStyle={{ paddingVertical: 12 }}>
              <View style={styles.genreFilterGrid}>
                {allGenres.map((genre) => {
                  const isSelected = localGenreSelection.has(genre);
                  return (
                    <TouchableOpacity
                      key={genre}
                      style={styles.genreFilterCell}
                      onPress={() => handleToggleGenre(genre)}
                    >
                      <View style={[styles.genreFilterBox, isSelected && styles.genreFilterBoxActive]}>
                        {isSelected ? <Text style={styles.genreFilterCheck}>✓</Text> : null}
                      </View>
                      <Text
                        style={[styles.genreFilterLabel, isSelected && styles.genreFilterLabelActive]}
                        numberOfLines={1}
                      >
                        {getGenreDisplayName(genre, registeredGenres)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  key={NO_GENRE_KEY}
                  style={styles.genreFilterCell}
                  onPress={() => handleToggleGenre(NO_GENRE_KEY)}
                >
                  <View style={[styles.genreFilterBox, localGenreSelection.has(NO_GENRE_KEY) && styles.genreFilterBoxActive]}>
                    {localGenreSelection.has(NO_GENRE_KEY) ? <Text style={styles.genreFilterCheck}>✓</Text> : null}
                  </View>
                  <Text
                    style={[styles.genreFilterLabel, localGenreSelection.has(NO_GENRE_KEY) && styles.genreFilterLabelActive]}
                    numberOfLines={1}
                  >
                    {NO_GENRE_LABEL}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.settingsModalActions}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={handleClearAllGenres}>
                <Text style={styles.modalGhostText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={handleSelectAllGenres}>
                <Text style={styles.modalGhostText}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleConfirmGenreFilter}>
                <Text style={styles.modalPrimaryText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function DrawerItem({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.drawerItem} onPress={onPress}>
      <View style={{ width: 24, alignItems: 'center' }}>{icon}</View>
      <Text style={styles.drawerItemText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'var(--app-bg)' },
  songDetailContainer: { minHeight: 0, overflow: 'hidden' as any },
  songDetailScroll: { flex: 1, minHeight: 0, paddingHorizontal: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'var(--app-border)', backgroundColor: 'var(--app-bg)' },
  headerTitle: { flex: 1, color: 'var(--app-text)', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerActionGroup: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--app-surface)', borderWidth: 1, borderColor: 'var(--app-border)' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  foldersTopControls: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  filterBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  filterBtnText: { color: 'var(--app-subtle-text)', fontSize: 13, fontWeight: '700' },
  filterBtnTextActive: { color: 'var(--app-accent)' },
  genreChipRow: { maxHeight: 44, marginBottom: 6 },
  genreChipScroll: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  genreChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    marginRight: 8,
  },
  genreChipActive: { borderColor: 'var(--app-accent)', backgroundColor: 'var(--app-accent-soft)' },
  genreChipText: { color: 'var(--app-subtle-text)', fontSize: 12, fontWeight: '700' },
  genreChipTextActive: { color: 'var(--app-accent)' },
  songGenreBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden' as any,
    fontSize: 12,
    fontWeight: '600',
    color: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  search: { margin: 12, borderColor: 'var(--app-border)', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'var(--app-surface)' },
  playlistPickerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  playlistPickerSearch: { marginHorizontal: 0, marginTop: 0, marginBottom: 10 },
  inputSearch: { color: 'var(--app-text)', flex: 1, height: 42 },
  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listRow: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-bg)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listRowActive: {
    backgroundColor: 'rgba(79, 195, 247, 0.08)',
  },
  fullscreenActionRow: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    gap: 10,
  },
  fullscreenActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  fullscreenActionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  listRowText: { flex: 1, paddingRight: 10, minWidth: 0 },
  listTitle: { marginBottom: 2 },
  songMetaLine: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  songArtistText: { flexShrink: 1, minWidth: 0 },
  songMetaSeparator: { color: 'var(--app-subtle-text)', fontSize: 13, marginHorizontal: 5, flexShrink: 0 },
  songGenreInline: { color: 'var(--app-accent)', fontSize: 13, flexShrink: 1, minWidth: 0 },
  listActionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  cardMainPress: { flex: 1, paddingRight: 10 },
  cardActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: 'var(--app-text)', fontSize: 16, fontWeight: '600' },
  subtitle: { color: 'var(--app-muted-text)', fontSize: 13 },
  settingsContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 120 },
  settingsCategoryCard: {
    minHeight: 70,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsCategoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingsCategoryText: { flex: 1, minWidth: 0 },
  settingsCategoryTitle: { color: 'var(--app-text)', fontSize: 17, fontWeight: '800' },
  settingsCategorySubtitle: { color: 'var(--app-subtle-text)', fontSize: 12, marginTop: 3 },
  settingsModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '86%',
    alignSelf: 'center',
    backgroundColor: 'var(--app-surface)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    padding: 16,
  },
  settingsModalLarge: { minHeight: 240 },
  orderModal: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: 'var(--app-bg)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    padding: 14,
  },
  orderHintBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderHintText: { color: 'var(--app-muted-text)', fontSize: 12, flex: 1 },
  orderScroll: { maxHeight: 430 },
  orderRow: {
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    userSelect: 'none',
  },
  orderIndex: { color: 'var(--app-accent)', fontSize: 13, fontWeight: '900', width: 24, textAlign: 'center' },
  orderSongInfo: { flex: 1, minWidth: 0 },
  orderSongTitle: { color: 'var(--app-text)', fontSize: 14, fontWeight: '800' },
  orderSongArtist: { color: 'var(--app-subtle-text)', fontSize: 12, marginTop: 2 },
  orderIconButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIconButtonDisabled: { opacity: 0.45 },
  orderDragHandle: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'var(--app-surface-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    flexShrink: 0,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  settingsModalTitle: { color: 'var(--app-text)', fontSize: 19, fontWeight: '900' },
  settingsCloseText: { color: 'var(--app-accent)', fontSize: 13, fontWeight: '800' },
  settingsModalScroll: { maxHeight: 420 },
  settingsInlineAction: {
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsControlBlock: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
    marginBottom: 10,
  },
  settingsControlRow: {
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsControlTitle: { color: 'var(--app-text)', fontSize: 15, fontWeight: '800' },
  settingsControlHint: { color: 'var(--app-subtle-text)', fontSize: 12, marginTop: 3 },
  settingsModalSubhead: { color: 'var(--app-subtle-text)', fontSize: 12, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
  registeredGenreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  registeredGenreChip: {
    maxWidth: '48%',
    minWidth: 128,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  registeredGenreChipText: { flex: 1, minWidth: 0 },
  registeredGenreName: { color: 'var(--app-text)', fontSize: 13, fontWeight: '800' },
  registeredGenreCount: { color: 'var(--app-subtle-text)', fontSize: 11, marginTop: 2 },
  settingsEmptyText: { color: 'var(--app-subtle-text)', fontSize: 13, marginBottom: 12 },
  themeModeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  themeModeCard: {
    flex: 1,
    minWidth: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
  },
  themeModeCardActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  themeModeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-bg)',
    marginBottom: 8,
  },
  themeModeDotLight: { backgroundColor: '#f5f7fb', borderColor: '#c5d2e0' },
  themeModeDotCustom: { backgroundColor: 'var(--app-accent)', borderColor: '#f59e0b' },
  themeModeTitle: { color: 'var(--app-text)', fontSize: 14, fontWeight: '900' },
  themeModeTitleActive: { color: 'var(--app-accent)' },
  themeModeHint: { color: 'var(--app-subtle-text)', fontSize: 11, marginTop: 3 },
  themeCustomGrid: { marginTop: 12, gap: 8 },
  themeColorRow: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  themeColorLabel: { color: 'var(--app-text)', fontSize: 13, fontWeight: '800' },
  themeColorValue: { color: 'var(--app-subtle-text)', fontSize: 11, marginTop: 2 },
  themeColorInput: {
    width: 42,
    height: 34,
    border: 'none',
    padding: 0,
    background: 'transparent',
    cursor: 'pointer',
  },
  colorSwatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: 'var(--app-accent)',
  },
  customColorButton: {
    backgroundColor: '#2a2a2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customColorButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  colorPickerContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'var(--app-bg-secondary)',
    borderRadius: 8,
    alignItems: 'center',
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'var(--app-surface-soft)',
  },
  statusPillActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  statusPillText: { color: 'var(--app-subtle-text)', fontSize: 12, fontWeight: '800' },
  statusPillTextActive: { color: 'var(--app-accent)' },
  settingsInput: {
    backgroundColor: 'var(--app-surface-soft)',
    borderColor: 'var(--app-border-soft)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'var(--app-text)',
    marginTop: 12,
    marginBottom: 12,
  },
  settingsModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  modalGhostBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalGhostText: { color: 'var(--app-text)', fontSize: 13, fontWeight: '800' },
  modalSpeedChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'var(--app-surface-alt)',
  },
  modalOptionBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  modalOptionBtnActive: {
    borderColor: '#4FC3F7',
    backgroundColor: '#4FC3F7',
  },
  modalOptionText: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '800',
  },
  modalPrimaryBtn: {
    borderRadius: 999,
    backgroundColor: 'var(--app-accent)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalPrimaryText: { color: '#051014', fontSize: 13, fontWeight: '900' },
  genreFilterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genreFilterCell: {
    width: '47%',
    minWidth: 132,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  genreFilterBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  genreFilterBoxActive: { borderColor: 'var(--app-accent)', backgroundColor: 'var(--app-accent)' },
  genreFilterCheck: { color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 16 },
  genreFilterLabel: { color: 'var(--app-muted-text)', fontSize: 13, flex: 1, minWidth: 0 },
  genreFilterLabelActive: { color: 'var(--app-text)', fontWeight: '800' },
  songObservation: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    marginHorizontal: 12,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  screenTitle: { color: 'var(--app-text)', fontSize: 20, fontWeight: '700', marginHorizontal: 12, marginBottom: 8 },
  back: { color: 'var(--app-accent)', margin: 12 },
  input: { marginHorizontal: 12, marginVertical: 6, backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', borderWidth: 1, borderRadius: 8, padding: 10, color: 'var(--app-text)' },
  genrePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42 },
  primaryBtn: { marginHorizontal: 12, marginTop: 8, backgroundColor: 'var(--app-accent)', borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  editorForm: { flex: 1, paddingBottom: 0 },
  editorActionLabel: { color: 'var(--app-accent)', fontWeight: '800' },
  editorSectionHeader: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorSectionTitle: { color: 'var(--app-text)', fontSize: 15, fontWeight: '900' },
  editorExpandBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorContentWrap: { flex: 1, minHeight: 0, marginHorizontal: 12, marginTop: 6, marginBottom: 0 },
  editorContentInput: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 0,
    lineHeight: 32,
    borderRadius: 6,
    borderWidth: 0,
    backgroundColor: 'var(--app-bg)',
    color: 'var(--app-text)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  expandedEditorModal: { flex: 1, backgroundColor: 'var(--app-bg)' },
  expandedEditorHeader: {
    minHeight: 62,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'var(--app-border)',
    backgroundColor: 'var(--app-bg)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expandedEditorTitle: {
    flex: 1,
    color: 'var(--app-text)',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  expandedEditorBody: { flex: 1, backgroundColor: 'var(--app-bg)' },
  expandedEditorInput: { height: '100%', borderRadius: 0, paddingHorizontal: 12, paddingVertical: 14 },
  modalBg: { flex: 1, backgroundColor: 'var(--app-overlay)', justifyContent: 'center', padding: 18 },
  modal: { backgroundColor: 'var(--app-surface)', borderRadius: 12, borderWidth: 1, borderColor: 'var(--app-border)', padding: 16 },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.74)',
    justifyContent: 'center',
    padding: 18,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.32)',
    backgroundColor: 'var(--app-surface)',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.36)',
    backgroundColor: 'rgba(127,29,29,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: { color: 'var(--app-text)', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  confirmMessage: { color: 'var(--app-muted-text)', fontSize: 14, lineHeight: 21 },
  confirmDetail: {
    color: '#ffb4b4',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.22)',
    backgroundColor: 'rgba(127,29,29,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  confirmCancelBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  confirmCancelText: { color: 'var(--app-text)', fontSize: 14, fontWeight: '800' },
  confirmDeleteBtn: {
    borderRadius: 10,
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmDeleteText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  createHint: { color: 'var(--app-subtle-text)', fontSize: 12, marginTop: 4, marginBottom: 10 },
  createOptionCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  modalActionBtn: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  songActionOptionBtn: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalActionText: { color: 'var(--app-text)', fontSize: 14, fontWeight: '600' },
  modalDangerBtn: {
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(127,29,29,0.28)',
  },
  modalDangerText: { color: '#ff7a7a', fontSize: 14, fontWeight: '700' },
  chord: { color: 'var(--app-accent)', fontSize: 17, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  lyrics: { color: 'var(--app-muted-text)', fontSize: 17, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  panel: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'var(--app-border)',
    borderRadius: 18,
    padding: 10,
    backgroundColor: 'var(--app-surface)',
  },
  panelBtn: { padding: 8, borderRadius: 14 },
  transpose: { color: 'var(--app-accent)', fontWeight: '800', minWidth: 40, textAlign: 'center' },
  importBanner: { marginHorizontal: 12, marginVertical: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)', alignItems: 'center', gap: 6 },
  importTitle: { color: 'var(--app-text)', fontSize: 18, fontWeight: '700' },
  importDesc: { color: 'var(--app-muted-text)', fontSize: 13, textAlign: 'center' },
  drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--app-overlay)' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 280, backgroundColor: 'var(--app-bg)', borderRightWidth: 1, borderRightColor: 'var(--app-border)', paddingTop: 50, paddingHorizontal: 14 },
  drawerBottom: { paddingBottom: 16, borderTopWidth: 1, borderTopColor: 'var(--app-border)', paddingTop: 10 },
  drawerTitle: { color: 'var(--app-text)', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  drawerBrand: { alignItems: 'center', marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'var(--app-border)' },
  drawerLogo: { width: 176, height: 92, objectFit: 'contain', marginBottom: 10 },
  drawerStatsRow: { flexDirection: 'row', gap: 8, width: '100%' },
  drawerStatPill: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerStatNumber: { color: 'var(--app-text)', fontSize: 17, fontWeight: '900' },
  drawerStatLabel: { color: 'var(--app-subtle-text)', fontSize: 11, marginTop: 2 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'var(--app-surface)', borderWidth: 1, borderColor: 'var(--app-border)', marginBottom: 10 },
  drawerItemText: { color: 'var(--app-text)', fontSize: 15, fontWeight: '700' },
  genreCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
  },
  genreCheckItemActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  genreCheckBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-bg)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
