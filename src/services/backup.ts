import JSZip from 'jszip';
import pako from 'pako';
import type { Folder, Genre, Playlist, PlaylistSection, PlaylistViewMode, Song, SongInput } from '../types/models';
import { normalizeGenreName } from '../utils/genres';
import { buildCifrasGoSongTextFile, CIFRASGO_SONG_MARKER, parseCifrasGoSongTextFile } from './songTextFormat';
import { db } from './storage';

export interface RestoreProgress {
  done: number;
  total: number;
}

export interface RestoreBackupOptions {
  onProgress?: (progress: RestoreProgress) => void;
}

export interface RestoreBackupResult {
  message: string;
}

export interface RestoreSongTextResult {
  message: string;
  songId: string;
  action: 'created' | 'updated';
}

const uid = () => Math.random().toString(36).slice(2, 11);

const CIFRASGO_PLAYLIST_MANIFEST = 'cifrasgo-playlist.json';
const CIFRASGO_FOLDER_MANIFEST = 'cifrasgo-folder.json';
const CIFRASGO_FULL_BACKUP_MANIFEST = 'cifrasgo-backup.json';

interface CifrasGoFullBackupManifest {
  app: 'CifrasGo';
  format: 'full-backup';
  version: 1;
  createdAt: number;
  contains: {
    songs: boolean;
    folders: boolean;
    playlists: boolean;
    folderSongs: boolean;
    genres: boolean;
    displaySettings: boolean;
    themeSettings: boolean;
    globalFilters: boolean;
  };
}

interface CifrasGoPlaylistManifestSong {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  genres?: string[];
  observation?: string;
  content: string;
  sourceUrl?: string;
  preferredFontSize?: number;
  updatedAt?: number;
}

interface CifrasGoPlaylistManifest {
  app: 'CifrasGo';
  format: 'playlist';
  version: 1;
  exportedAt?: number;
  playlist: {
    id?: string;
    name: string;
    songIds?: string[];
    genres?: string[];
  };
  songs: CifrasGoPlaylistManifestSong[];
}

interface CifrasGoFolderManifest {
  app: 'CifrasGo';
  format: 'folder';
  version: 1;
  exportedAt: number;
  rootFolderId: string;
  rootFolderName: string;
  contains: {
    songs: boolean;
    folders: boolean;
    playlists: boolean;
    folderSongs: boolean;
  };
}

type NormalizedImportedPlaylist = {
  id: string;
  folderId: string | null;
  name: string;
  songIds: string[];
  genres?: string[];
  viewMode?: PlaylistViewMode;
  sections?: PlaylistSection[];
};

export const parseCfs = (text: string) => {
  const norm = text.replace(/\r\n/g, '\n');
  const [first, ...rest] = norm.split('\n');
  const header = (first || '').trim();
  let artist = '';
  let title = header || 'Sem título';
  const match = header.match(/^(.*?)\s+-\s+(?:\([^)]*\)\s*)?(.*)$/);
  if (match) {
    artist = (match[1] || '').trim();
    title = (match[2] || '').trim() || title;
  }
  const body = rest.join('\n');
  const idx = body.indexOf('\n\n');
  const content = (idx >= 0 ? body.slice(idx + 2) : body).trim();
  return { artist, title, content };
};

export const parseListCfs = (text: string, fallbackName: string) => {
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

const readCfsFile = async (zip: JSZip, fileName: string, decoder: TextDecoder): Promise<string | null> => {
  const data = await zip.file(fileName)?.async('uint8array');
  if (!data) return null;

  try {
    const inflated = pako.inflate(data);
    return decoder.decode(inflated);
  } catch {
    return decoder.decode(data);
  }
};

const readZipTextFile = async (zip: JSZip, fileName: string): Promise<string | null> => {
  const file = zip.file(fileName);
  if (!file) return null;
  return file.async('text');
};

const readZipJsonFile = async <T,>(zip: JSZip, fileName: string, fallback: T): Promise<T> => {
  const text = await readZipTextFile(zip, fileName);
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Arquivo ${fileName} invalido no backup CifrasGo.`);
  }
};

const songDedupKey = (artist: string, title: string) =>
  `${artist.trim().toLowerCase()}::${title.trim().toLowerCase()}`;

const playlistNameKey = (name: string) => name.trim().toLowerCase();
const exactNameKey = (name: string) => name.toLowerCase();
const getZipBaseName = (name: string): string => name.split(/[\\/]/).pop() || name;
const isLegacyListCfsFile = (name: string): boolean =>
  getZipBaseName(name).toLowerCase().startsWith('[list]-');

const safeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const uniqueStrings = (value: string[]): string[] =>
  value.filter((item, index, rows) => rows.indexOf(item) === index);

const normalizeImportedSections = (value: unknown): PlaylistSection[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((section): section is Record<string, unknown> => !!section && typeof section === 'object')
    .map((section) => {
      const title = typeof section.title === 'string' ? section.title : '';
      const color = typeof section.color === 'string' && section.color.trim() ? section.color : undefined;
      return {
        id: typeof section.id === 'string' && section.id.trim() ? section.id : uid(),
        title,
        songIds: uniqueStrings(safeStringArray(section.songIds)),
        ...(color ? { color } : {}),
      };
    })
    .filter((section) => section.title.trim() || section.songIds.length > 0);
};

const normalizeImportedPlaylist = (value: unknown): NormalizedImportedPlaylist | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const hasId = typeof row.id === 'string' && row.id.trim().length > 0;
  const hasName = typeof row.name === 'string' && row.name.trim().length > 0;
  if (!hasId && !hasName) return null;

  const sections = normalizeImportedSections(row.sections);
  const sectionSongIds = sections.flatMap((section) => section.songIds);
  const viewMode = row.viewMode === 'script' || row.viewMode === 'default' ? row.viewMode : undefined;
  const genres = safeStringArray(row.genres);

  return {
    id: hasId ? String(row.id) : uid(),
    folderId: typeof row.folderId === 'string' && row.folderId.trim() ? row.folderId : null,
    name: hasName ? String(row.name) : 'Lista',
    songIds: uniqueStrings([...safeStringArray(row.songIds), ...sectionSongIds]),
    ...(genres.length ? { genres } : {}),
    ...(viewMode ? { viewMode } : {}),
    ...(sections.length ? { sections } : {}),
  };
};

const remapSongIds = (ids: string[], songIdByOldId: Map<string, string>): string[] =>
  uniqueStrings(ids.map((songId) => songIdByOldId.get(songId)).filter((songId): songId is string => !!songId));

const remapSections = (sections: PlaylistSection[] | undefined, songIdByOldId: Map<string, string>): PlaylistSection[] => {
  if (!sections?.length) return [];
  return sections
    .map((section) => {
      const songIds = remapSongIds(safeStringArray(section.songIds), songIdByOldId);
      return {
        ...section,
        songIds,
      };
    })
    .filter((section) => section.title.trim() || section.songIds.length > 0);
};

const sanitizeBackupFileName = (value: string): string => {
  const safeName = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return safeName || 'item';
};

const getFolderPath = (folderId: string | null | undefined, foldersById: Map<string, { name: string; parentId?: string | null }>): string => {
  if (!folderId) return 'Raiz';
  const names: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null | undefined = folderId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = foldersById.get(currentId);
    if (!folder) break;
    names.unshift(folder.name);
    currentId = folder.parentId ?? null;
  }

  return names.length ? names.join(' / ') : 'Raiz';
};

const getFolderPathParts = (
  folderId: string | null | undefined,
  foldersById: Map<string, { name: string; parentId?: string | null }>
): string[] => {
  if (!folderId) return [];
  const names: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null | undefined = folderId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = foldersById.get(currentId);
    if (!folder) break;
    names.unshift(folder.name);
    currentId = folder.parentId ?? null;
  }

  return names;
};

const folderPathKey = (parts: string[]): string => parts.map(exactNameKey).join('\u0000');

const playlistPathNameKey = (
  playlistName: string,
  folderId: string | null | undefined,
  foldersById: Map<string, { name: string; parentId?: string | null }>
): string => `${folderPathKey(getFolderPathParts(folderId, foldersById))}::${exactNameKey(playlistName)}`;

const buildReadablePlaylistText = (
  playlist: Playlist,
  songsById: Map<string, Song>,
  foldersById: Map<string, { name: string; parentId?: string | null }>
): string => {
  const songs = safeStringArray(playlist.songIds).map((songId) => songsById.get(songId)).filter((song): song is Song => !!song);
  return [
    `Lista: ${playlist.name || 'Lista'}`,
    `Pasta: ${getFolderPath(playlist.folderId, foldersById)}`,
    `Total de musicas: ${songs.length}`,
    '',
    ...songs.map((song, index) => `${index + 1}. ${song.title || 'Sem titulo'} - ${song.artist || 'Sem artista'}`),
  ].join('\n');
};

const toSongInput = (song: CifrasGoPlaylistManifestSong): SongInput => ({
  title: song.title || 'Sem titulo',
  artist: song.artist || '',
  genre: song.genre,
  genres: song.genres,
  observation: song.observation,
  content: song.content || '',
  sourceUrl: song.sourceUrl,
  preferredFontSize: song.preferredFontSize,
});

const parsePlaylistManifest = (text: string): CifrasGoPlaylistManifest => {
  let manifest: Partial<CifrasGoPlaylistManifest>;
  try {
    manifest = JSON.parse(text) as Partial<CifrasGoPlaylistManifest>;
  } catch {
    throw new Error('Manifest da lista CifrasGo invalido.');
  }

  if (
    manifest.app !== 'CifrasGo' ||
    manifest.format !== 'playlist' ||
    manifest.version !== 1 ||
    !manifest.playlist ||
    !Array.isArray(manifest.songs)
  ) {
    throw new Error('Formato de lista CifrasGo nao suportado.');
  }

  return manifest as CifrasGoPlaylistManifest;
};

const parseFullBackupManifest = (text: string): CifrasGoFullBackupManifest => {
  let manifest: Partial<CifrasGoFullBackupManifest>;
  try {
    manifest = JSON.parse(text) as Partial<CifrasGoFullBackupManifest>;
  } catch {
    throw new Error('Manifest do backup completo CifrasGo invalido.');
  }

  if (manifest.app !== 'CifrasGo' || manifest.format !== 'full-backup' || manifest.version !== 1) {
    throw new Error('Formato de backup completo CifrasGo nao suportado.');
  }

  return manifest as CifrasGoFullBackupManifest;
};

const parseFolderBackupManifest = (text: string): CifrasGoFolderManifest => {
  let manifest: Partial<CifrasGoFolderManifest>;
  try {
    manifest = JSON.parse(text) as Partial<CifrasGoFolderManifest>;
  } catch {
    throw new Error('Manifest da pasta CifrasGo invalido.');
  }

  if (manifest.app !== 'CifrasGo' || manifest.format !== 'folder' || manifest.version !== 1) {
    throw new Error('Formato de pasta CifrasGo nao suportado.');
  }

  return manifest as CifrasGoFolderManifest;
};

const getDescendantFolderIdsForBackup = (folders: Folder[], folderId: string): string[] => {
  const children = folders.filter((folder) => (folder.parentId ?? null) === folderId);
  return children.flatMap((folder) => [folder.id, ...getDescendantFolderIdsForBackup(folders, folder.id)]);
};

export const buildCifrasGoFullBackupZip = async (): Promise<Blob> => {
  const [
    songs,
    folders,
    playlists,
    folderSongs,
    genres,
    displaySettings,
    themeSettings,
    globalFilters,
  ] = await Promise.all([
    db.getSongs(),
    db.getFolders(),
    db.getPlaylists(),
    db.getFolderSongMap(),
    db.getGenres(),
    db.getDisplaySettings(),
    db.getThemeSettings(),
    db.getGlobalFilters(),
  ]);

  const zip = new JSZip();
  const manifest: CifrasGoFullBackupManifest = {
    app: 'CifrasGo',
    format: 'full-backup',
    version: 1,
    createdAt: Date.now(),
    contains: {
      songs: true,
      folders: true,
      playlists: true,
      folderSongs: true,
      genres: true,
      displaySettings: true,
      themeSettings: true,
      globalFilters: true,
    },
  };
  const settings = {
    displaySettings,
    themeSettings,
    globalFilters,
  };

  zip.file(CIFRASGO_FULL_BACKUP_MANIFEST, JSON.stringify(manifest, null, 2));
  zip.file('data/songs.json', JSON.stringify(songs, null, 2));
  zip.file('data/folders.json', JSON.stringify(folders, null, 2));
  zip.file('data/playlists.json', JSON.stringify(playlists, null, 2));
  zip.file('data/folder-songs.json', JSON.stringify(folderSongs, null, 2));
  zip.file('data/genres.json', JSON.stringify(genres, null, 2));
  zip.file('data/settings.json', JSON.stringify(settings, null, 2));

  songs.forEach((song, index) => {
    const prefix = String(index + 1).padStart(3, '0');
    const name = sanitizeBackupFileName(`${song.title || 'musica'}${song.artist ? ` - ${song.artist}` : ''}`);
    zip.file(`readable/musicas/${prefix} - ${name}.txt`, buildCifrasGoSongTextFile(song));
  });

  const songsById = new Map(songs.map((song) => [song.id, song]));
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  playlists.forEach((playlist, index) => {
    const prefix = String(index + 1).padStart(3, '0');
    const name = sanitizeBackupFileName(playlist.name || 'lista');
    zip.file(`readable/listas/${prefix} - ${name}.txt`, buildReadablePlaylistText(playlist, songsById, foldersById));
  });

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

export const buildCifrasGoFolderBackupZip = async (folderId: string): Promise<Blob> => {
  const [songs, folders, playlists, folderSongs] = await Promise.all([
    db.getSongs(),
    db.getFolders(),
    db.getPlaylists(),
    db.getFolderSongMap(),
  ]);

  const rootFolder = folders.find((folder) => folder.id === folderId);
  if (!rootFolder) throw new Error('Pasta nao encontrada para exportacao.');

  const exportedFolderIds = new Set([folderId, ...getDescendantFolderIdsForBackup(folders, folderId)]);
  const exportedFolders = folders
    .filter((folder) => exportedFolderIds.has(folder.id))
    .map((folder) => ({
      ...folder,
      parentId: folder.id === folderId || !folder.parentId || !exportedFolderIds.has(folder.parentId)
        ? null
        : folder.parentId,
    }));
  const exportedPlaylists = playlists.filter((playlist) => playlist.folderId && exportedFolderIds.has(playlist.folderId));
  const exportedFolderSongs = Object.fromEntries(
    Object.entries(folderSongs)
      .filter(([id]) => exportedFolderIds.has(id))
      .map(([id, ids]) => [id, safeStringArray(ids)])
  );
  const songIds = new Set<string>();

  Object.values(exportedFolderSongs).forEach((ids) => safeStringArray(ids).forEach((id) => songIds.add(id)));
  exportedPlaylists.forEach((playlist) => {
    safeStringArray(playlist.songIds).forEach((id) => songIds.add(id));
    normalizeImportedSections(playlist.sections).forEach((section) => {
      section.songIds.forEach((id) => songIds.add(id));
    });
  });

  const exportedSongs = songs.filter((song) => songIds.has(song.id));
  const zip = new JSZip();
  const manifest: CifrasGoFolderManifest = {
    app: 'CifrasGo',
    format: 'folder',
    version: 1,
    exportedAt: Date.now(),
    rootFolderId: folderId,
    rootFolderName: rootFolder.name || 'Pasta',
    contains: {
      songs: true,
      folders: true,
      playlists: true,
      folderSongs: true,
    },
  };

  zip.file(CIFRASGO_FOLDER_MANIFEST, JSON.stringify(manifest, null, 2));
  zip.file('data/songs.json', JSON.stringify(exportedSongs, null, 2));
  zip.file('data/folders.json', JSON.stringify(exportedFolders, null, 2));
  zip.file('data/playlists.json', JSON.stringify(exportedPlaylists, null, 2));
  zip.file('data/folder-songs.json', JSON.stringify(exportedFolderSongs, null, 2));

  exportedSongs.forEach((song, index) => {
    const prefix = String(index + 1).padStart(3, '0');
    const name = sanitizeBackupFileName(`${song.title || 'musica'}${song.artist ? ` - ${song.artist}` : ''}`);
    zip.file(`readable/musicas/${prefix} - ${name}.txt`, buildCifrasGoSongTextFile(song));
  });

  const exportedSongsById = new Map(exportedSongs.map((song) => [song.id, song]));
  const exportedFoldersById = new Map(exportedFolders.map((folder) => [folder.id, folder]));
  exportedPlaylists.forEach((playlist, index) => {
    const prefix = String(index + 1).padStart(3, '0');
    const name = sanitizeBackupFileName(playlist.name || 'lista');
    zip.file(`readable/listas/${prefix} - ${name}.txt`, buildReadablePlaylistText(playlist, exportedSongsById, exportedFoldersById));
  });

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

export const isCifrasGoSongText = (text: string): boolean =>
  text.replace(/^\uFEFF/, '').includes(CIFRASGO_SONG_MARKER);

export const restoreCifrasGoSongTextFile = async (file: File): Promise<RestoreSongTextResult> => {
  const text = await file.text();
  const parsed = parseCifrasGoSongTextFile(text);
  if (!parsed) throw new Error('Este .txt nao e uma musica exportada pelo CifrasGo.');

  const songs = await db.getSongs();
  const importedKey = songDedupKey(parsed.artist, parsed.title);
  const existing = songs.find((song) => songDedupKey(song.artist, song.title) === importedKey);

  if (existing) {
    const updated = await db.updateSong(existing.id, parsed);
    return {
      action: 'updated',
      songId: updated?.id || existing.id,
      message: `Musica "${parsed.title}" atualizada com sucesso.`,
    };
  }

  const created = await db.addSong(parsed);
  return {
    action: 'created',
    songId: created.id,
    message: `Musica "${created.title}" importada com sucesso.`,
  };
};

const restoreCifrasGoDataZip = async (
  zip: JSZip,
  options: RestoreBackupOptions = {},
  sourceLabel = 'Backup completo CifrasGo'
): Promise<RestoreBackupResult> => {
  options.onProgress?.({ done: 0, total: 5 });

  const importedSongsRaw = await readZipJsonFile<unknown>(zip, 'data/songs.json', []);
  const importedFoldersRaw = await readZipJsonFile<unknown>(zip, 'data/folders.json', []);
  const importedPlaylistsRaw = await readZipJsonFile<unknown>(zip, 'data/playlists.json', []);
  const importedFolderSongsRaw = await readZipJsonFile<unknown>(zip, 'data/folder-songs.json', {});
  const importedGenresRaw = await readZipJsonFile<unknown>(zip, 'data/genres.json', []);

  const importedSongs = Array.isArray(importedSongsRaw) ? (importedSongsRaw as Song[]) : [];
  const importedFolders = Array.isArray(importedFoldersRaw)
    ? (importedFoldersRaw as Folder[]).map((folder) => ({ ...folder, parentId: folder.parentId ?? null }))
    : [];
  const importedPlaylists = Array.isArray(importedPlaylistsRaw)
    ? importedPlaylistsRaw.map(normalizeImportedPlaylist).filter((playlist): playlist is NormalizedImportedPlaylist => !!playlist)
    : [];
  const importedFolderSongs =
    importedFolderSongsRaw && typeof importedFolderSongsRaw === 'object' && !Array.isArray(importedFolderSongsRaw)
      ? (importedFolderSongsRaw as Record<string, string[]>)
      : {};
  const importedGenres = Array.isArray(importedGenresRaw) ? (importedGenresRaw as Genre[]) : [];

  const existingSongs = await db.getSongs();
  const nextSongs = [...existingSongs];
  const createdSongs: Song[] = [];
  const songIdByOldId = new Map<string, string>();
  const songIndexByKey = new Map(nextSongs.map((song, index) => [songDedupKey(song.artist, song.title), index]));
  const songIdByKey = new Map(nextSongs.map((song) => [songDedupKey(song.artist, song.title), song.id]));
  let songsCreated = 0;
  let songsMerged = 0;

  for (const importedSong of importedSongs) {
    if (!importedSong?.id) continue;
    const title = importedSong.title || 'Sem titulo';
    const artist = importedSong.artist || '';
    const key = songDedupKey(artist, title);
    const existingId = songIdByKey.get(key);

    if (existingId) {
      songIdByOldId.set(importedSong.id, existingId);
      const existingIndex = songIndexByKey.get(key);
      if (existingIndex != null) {
        const current = nextSongs[existingIndex];
        nextSongs[existingIndex] = {
          ...current,
          ...importedSong,
          id: current.id,
          title: title.trim(),
          artist: artist.trim(),
          updatedAt: Date.now(),
        };
      }
      songsMerged += 1;
      continue;
    }

    const createdSong: Song = {
      ...importedSong,
      id: uid(),
      title: title.trim(),
      artist: artist.trim(),
      updatedAt: Date.now(),
    };
    createdSongs.push(createdSong);
    songIdByOldId.set(importedSong.id, createdSong.id);
    songIdByKey.set(key, createdSong.id);
    songsCreated += 1;
  }

  if (songsCreated || songsMerged) {
    await db.saveSongs([...createdSongs, ...nextSongs]);
  }
  options.onProgress?.({ done: 1, total: 5 });

  const existingGenres = await db.getGenres();
  const genreByName = new Map(existingGenres.map((genre) => [normalizeGenreName(genre.name), genre]));
  const genresToCreate: Genre[] = [];
  for (const importedGenre of importedGenres) {
    if (!importedGenre?.name) continue;
    const key = normalizeGenreName(importedGenre.name);
    if (!key || genreByName.has(key)) continue;
    const genre: Genre = {
      ...importedGenre,
      id: uid(),
      updatedAt: importedGenre.updatedAt || Date.now(),
    };
    genresToCreate.push(genre);
    genreByName.set(key, genre);
  }
  if (genresToCreate.length) {
    await db.saveGenres([...existingGenres, ...genresToCreate].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
  }
  options.onProgress?.({ done: 2, total: 5 });

  const existingFolders = await db.getFolders();
  const createdFolders: Folder[] = [];
  const folderIdByOldId = new Map<string, string>();
  const existingFoldersById = new Map(existingFolders.map((folder) => [folder.id, folder]));
  const importedFoldersById = new Map(importedFolders.map((folder) => [folder.id, folder]));
  const folderIdByPath = new Map<string, string>();

  existingFolders.forEach((folder) => {
    folderIdByPath.set(folderPathKey(getFolderPathParts(folder.id, existingFoldersById)), folder.id);
  });

  const foldersByDepth = [...importedFolders].sort(
    (a, b) => getFolderPathParts(a.id, importedFoldersById).length - getFolderPathParts(b.id, importedFoldersById).length
  );

  for (const importedFolder of foldersByDepth) {
    if (!importedFolder?.id) continue;
    const key = folderPathKey(getFolderPathParts(importedFolder.id, importedFoldersById));
    const existingId = folderIdByPath.get(key);
    if (existingId) {
      folderIdByOldId.set(importedFolder.id, existingId);
      continue;
    }

    const parentId = importedFolder.parentId ? folderIdByOldId.get(importedFolder.parentId) || null : null;
    const createdFolder: Folder = {
      id: uid(),
      name: importedFolder.name || 'Pasta',
      parentId,
    };
    createdFolders.push(createdFolder);
    folderIdByOldId.set(importedFolder.id, createdFolder.id);
    folderIdByPath.set(key, createdFolder.id);
  }

  if (createdFolders.length) {
    await db.saveFolders([...createdFolders, ...existingFolders]);
  }
  options.onProgress?.({ done: 3, total: 5 });

  const allFolders = [...createdFolders, ...existingFolders];
  const allFoldersById = new Map(allFolders.map((folder) => [folder.id, folder]));
  const existingPlaylists = await db.getPlaylists();
  const nextPlaylists = [...existingPlaylists];
  const createdPlaylists: Playlist[] = [];
  const playlistIndexByPathName = new Map(
    nextPlaylists.map((playlist, index) => [playlistPathNameKey(playlist.name, playlist.folderId, allFoldersById), index])
  );
  let playlistsCreated = 0;
  let playlistsMerged = 0;

  for (const importedPlaylist of importedPlaylists) {
    const localFolderId = importedPlaylist.folderId ? folderIdByOldId.get(importedPlaylist.folderId) || null : null;
    const resolvedSections = remapSections(importedPlaylist.sections, songIdByOldId);
    const sectionSongIds = resolvedSections.flatMap((section) => section.songIds);
    const resolvedSongIds = uniqueStrings([...remapSongIds(importedPlaylist.songIds, songIdByOldId), ...sectionSongIds]);
    const key = playlistPathNameKey(importedPlaylist.name || 'Lista', localFolderId, allFoldersById);
    const existingIndex = playlistIndexByPathName.get(key);
    const nextViewMode: PlaylistViewMode | undefined =
      importedPlaylist.viewMode === 'script'
        ? resolvedSections.length
          ? 'script'
          : 'default'
        : importedPlaylist.viewMode || (resolvedSections.length ? 'script' : undefined);

    if (existingIndex != null) {
      const current = nextPlaylists[existingIndex];
      const remainingSongIds = safeStringArray(current.songIds).filter((songId) => !resolvedSongIds.includes(songId));
      nextPlaylists[existingIndex] = {
        ...current,
        name: importedPlaylist.name || current.name,
        folderId: localFolderId,
        songIds: [...resolvedSongIds, ...remainingSongIds],
        genres: importedPlaylist.genres || current.genres,
        viewMode: nextViewMode || current.viewMode,
        sections: resolvedSections.length ? resolvedSections : current.sections,
      };
      playlistsMerged += 1;
      continue;
    }

    const createdPlaylist: Playlist = {
      id: uid(),
      folderId: localFolderId,
      name: importedPlaylist.name || 'Lista',
      songIds: resolvedSongIds,
      genres: importedPlaylist.genres,
      viewMode: nextViewMode,
      sections: resolvedSections.length ? resolvedSections : undefined,
    };
    createdPlaylists.push(createdPlaylist);
    playlistIndexByPathName.set(key, nextPlaylists.length + createdPlaylists.length - 1);
    playlistsCreated += 1;
  }

  if (playlistsCreated || playlistsMerged) {
    await db.savePlaylists([...createdPlaylists, ...nextPlaylists]);
  }
  options.onProgress?.({ done: 4, total: 5 });

  const existingFolderSongs = await db.getFolderSongMap();
  const nextFolderSongs: Record<string, string[]> = { ...existingFolderSongs };
  let folderSongGroupsMerged = 0;

  Object.entries(importedFolderSongs).forEach(([oldFolderId, oldSongIds]) => {
    const localFolderId = folderIdByOldId.get(oldFolderId);
    if (!localFolderId) return;

    const resolvedSongIds = remapSongIds(safeStringArray(oldSongIds), songIdByOldId);
    if (!resolvedSongIds.length) return;

    const currentSongIds = nextFolderSongs[localFolderId] || [];
    nextFolderSongs[localFolderId] = [
      ...resolvedSongIds,
      ...currentSongIds.filter((songId) => !resolvedSongIds.includes(songId)),
    ];
    folderSongGroupsMerged += 1;
  });

  if (folderSongGroupsMerged) {
    await db.saveFolderSongMap(nextFolderSongs);
  }
  options.onProgress?.({ done: 5, total: 5 });

return {
  message:
    `${sourceLabel} restaurado em modo mesclar.\n\n` +
    `- Musicas: ${songsCreated} criadas, ${songsMerged} atualizadas/reaproveitadas.\n` +
    `- Generos: ${genresToCreate.length} adicionados.\n` +
    `- Pastas: ${createdFolders.length} criadas.\n` +
    `- Listas: ${playlistsCreated} criadas, ${playlistsMerged} atualizadas.\n` +
    `- Vinculos de pastas: ${folderSongGroupsMerged} grupo${folderSongGroupsMerged === 1 ? '' : 's'} mesclado${folderSongGroupsMerged === 1 ? '' : 's'}.\n` +
    '- Configuracoes foram preservadas e nao sobrescritas.',
};
};

const restoreCifrasGoFullBackupZip = async (
  zip: JSZip,
  manifestFileName: string,
  options: RestoreBackupOptions = {}
): Promise<RestoreBackupResult> => {
  const manifestText = await readZipTextFile(zip, manifestFileName);
  if (!manifestText) throw new Error('Manifest do backup completo CifrasGo nao encontrado.');
  parseFullBackupManifest(manifestText);
  return restoreCifrasGoDataZip(zip, options, 'Backup completo CifrasGo');
};

const restoreCifrasGoFolderZip = async (
  zip: JSZip,
  manifestFileName: string,
  options: RestoreBackupOptions = {}
): Promise<RestoreBackupResult> => {
  const manifestText = await readZipTextFile(zip, manifestFileName);
  if (!manifestText) throw new Error('Manifest da pasta CifrasGo nao encontrado.');
  const manifest = parseFolderBackupManifest(manifestText);
  const label = `Pasta "${manifest.rootFolderName || 'Pasta'}"`;
  return restoreCifrasGoDataZip(zip, options, label);
};

const restoreCifrasGoPlaylistZip = async (
  zip: JSZip,
  manifestFileName: string
): Promise<RestoreBackupResult> => {
  const manifestText = await readZipTextFile(zip, manifestFileName);
  if (!manifestText) throw new Error('Manifest da lista CifrasGo nao encontrado.');

  const manifest = parsePlaylistManifest(manifestText);
  const playlistName = manifest.playlist.name?.trim() || 'Lista';
  const existingSongs = await db.getSongs();
  const nextSongs = [...existingSongs];
  const createdSongs: Song[] = [];
  const localSongIdByExportedId = new Map<string, string>();
  const existingSongIndexByKey = new Map(
    nextSongs.map((song, index) => [songDedupKey(song.artist, song.title), index])
  );
  const localSongIdByKey = new Map(nextSongs.map((song) => [songDedupKey(song.artist, song.title), song.id]));

  let songsCreated = 0;
  let songsUpdated = 0;

  for (const exportedSong of manifest.songs) {
    if (!exportedSong || typeof exportedSong !== 'object') continue;
    const input = toSongInput(exportedSong);
    const key = songDedupKey(input.artist, input.title);
    const existingIndex = existingSongIndexByKey.get(key);
    const alreadyResolvedLocalId = localSongIdByKey.get(key);

    if (alreadyResolvedLocalId && existingIndex == null) {
      if (exportedSong.id) localSongIdByExportedId.set(exportedSong.id, alreadyResolvedLocalId);
      continue;
    }

    if (existingIndex != null) {
      const current = nextSongs[existingIndex];
      nextSongs[existingIndex] = {
        ...current,
        ...input,
        id: current.id,
        title: input.title.trim(),
        artist: input.artist.trim(),
        updatedAt: Date.now(),
      };
      if (exportedSong.id) localSongIdByExportedId.set(exportedSong.id, current.id);
      localSongIdByKey.set(key, current.id);
      songsUpdated += 1;
      continue;
    }

    const createdSong: Song = {
      ...input,
      id: uid(),
      title: input.title.trim(),
      artist: input.artist.trim(),
      updatedAt: Date.now(),
    };
    createdSongs.push(createdSong);
    if (exportedSong.id) localSongIdByExportedId.set(exportedSong.id, createdSong.id);
    localSongIdByKey.set(key, createdSong.id);
    songsCreated += 1;
  }

  if (songsCreated || songsUpdated) {
    await db.saveSongs([...createdSongs, ...nextSongs]);
  }

  const resolvedSongIds: string[] = [];
  const manifestSongIds = safeStringArray(manifest.playlist.songIds);
  const orderedExportedSongIds = manifestSongIds.length
    ? manifestSongIds
    : manifest.songs.map((song) => song?.id).filter((id): id is string => typeof id === 'string' && !!id);
  for (const exportedSongId of orderedExportedSongIds) {
    const localSongId = localSongIdByExportedId.get(exportedSongId);
    if (localSongId && !resolvedSongIds.includes(localSongId)) {
      resolvedSongIds.push(localSongId);
    }
  }

  for (const exportedSong of manifest.songs) {
    if (!exportedSong?.id) continue;
    const localSongId = localSongIdByExportedId.get(exportedSong.id);
    if (localSongId && !resolvedSongIds.includes(localSongId)) {
      resolvedSongIds.push(localSongId);
    }
  }

  const playlists = await db.getPlaylists();
  const existingPlaylist = playlists.find(
    (playlist) => playlist.folderId === null && playlistNameKey(playlist.name) === playlistNameKey(playlistName)
  );
  let playlistAction: 'criada' | 'atualizada' = 'criada';

  if (existingPlaylist) {
    const remainingSongIds = safeStringArray(existingPlaylist.songIds).filter((songId) => !resolvedSongIds.includes(songId));
    await db.savePlaylists(
      playlists.map((playlist) =>
        playlist.id === existingPlaylist.id
          ? {
              ...playlist,
              name: playlistName,
              songIds: [...resolvedSongIds, ...remainingSongIds],
              genres: manifest.playlist.genres || playlist.genres,
            }
          : playlist
      )
    );
    playlistAction = 'atualizada';
  } else {
    const playlist: Playlist = {
      id: uid(),
      folderId: null,
      name: playlistName,
      songIds: resolvedSongIds,
      genres: manifest.playlist.genres,
    };
    await db.savePlaylists([playlist, ...playlists]);
  }

return {
  message:
    `Lista "${playlistName}" ${playlistAction} com ${resolvedSongIds.length} musica` +
    `${resolvedSongIds.length === 1 ? '' : 's'}.\n\n` +
    `- Musicas criadas: ${songsCreated}\n` +
    `- Musicas atualizadas/reaproveitadas: ${songsUpdated}`,
};
};

export const restoreBackupZip = async (
  file: File,
  options: RestoreBackupOptions = {}
): Promise<RestoreBackupResult> => {
  const ab = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(ab);
  const fullBackupManifestName = Object.keys(zip.files).find(
    (name) => name.toLowerCase() === CIFRASGO_FULL_BACKUP_MANIFEST
  );
  if (fullBackupManifestName) {
    return restoreCifrasGoFullBackupZip(zip, fullBackupManifestName, options);
  }

  const folderManifestName = Object.keys(zip.files).find(
    (name) => name.toLowerCase() === CIFRASGO_FOLDER_MANIFEST
  );
  if (folderManifestName) {
    return restoreCifrasGoFolderZip(zip, folderManifestName, options);
  }

  const playlistManifestName = Object.keys(zip.files).find(
    (name) => name.toLowerCase() === CIFRASGO_PLAYLIST_MANIFEST
  );
  if (playlistManifestName) {
    return restoreCifrasGoPlaylistZip(zip, playlistManifestName);
  }

  const names = Object.keys(zip.files).filter((name) => name.toLowerCase().endsWith('.cfs'));
  if (!names.length) throw new Error('Nenhum arquivo .cfs encontrado no .zip.');

  const songFileNames = names.filter((name) => !isLegacyListCfsFile(name));
  const listFileNames = names.filter(isLegacyListCfsFile);

  options.onProgress?.({ done: 0, total: names.length });
  const existing = await db.getSongs();
  const existingPlaylists = await db.getPlaylists();
  const key = (artist: string, title: string) => `${artist.trim().toLowerCase()}::${title.trim().toLowerCase()}`;
  const seen = new Set(existing.map((song) => key(song.artist, song.title)));
  const songIdByKey = new Map(existing.map((song) => [key(song.artist, song.title), song.id]));

  const imported: Song[] = [];
  const decoder = new TextDecoder('utf-8');
  let done = 0;

  for (const fileName of songFileNames) {
    const plain = await readCfsFile(zip, fileName, decoder);
    if (!plain) {
      done += 1;
      options.onProgress?.({ done, total: names.length });
      continue;
    }

    const parsed = parseCfs(plain);
    const songKey = key(parsed.artist, parsed.title);
    if (!seen.has(songKey)) {
      const createdSong: Song = {
        id: uid(),
        artist: parsed.artist,
        title: parsed.title,
        observation: '',
        content: parsed.content || plain,
        updatedAt: Date.now(),
      };
      imported.push(createdSong);
      seen.add(songKey);
      songIdByKey.set(songKey, createdSong.id);
    }

    done += 1;
    options.onProgress?.({ done, total: names.length });
  }

  if (imported.length) await db.saveSongs([...imported, ...existing]);

  const normalizePlaylistName = (name: string) => name.trim().toLowerCase();
  const playlists = [...existingPlaylists];
  const rootPlaylistByName = new Map<string, Playlist>();
  playlists
    .filter((playlist) => playlist.folderId === null)
    .forEach((playlist) => rootPlaylistByName.set(normalizePlaylistName(playlist.name), playlist));

  let listsCreated = 0;
  let listsUpdated = 0;

  for (const fileName of listFileNames) {
    const plain = await readCfsFile(zip, fileName, decoder);
    if (!plain) {
      done += 1;
      options.onProgress?.({ done, total: names.length });
      continue;
    }

    const fallbackName = getZipBaseName(fileName).replace(/^\[list\]-/i, '').replace(/\.cfs$/i, '').trim();
    const parsedList = parseListCfs(plain, fallbackName);
    if (!parsedList.name) {
      done += 1;
      options.onProgress?.({ done, total: names.length });
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
      const currentSongIds = safeStringArray(existingPlaylist.songIds);
      const mergedSongIds = Array.from(new Set([...currentSongIds, ...resolvedSongIds]));
      if (mergedSongIds.length !== currentSongIds.length) {
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
    options.onProgress?.({ done, total: names.length });
  }

  if (listsCreated || listsUpdated) await db.savePlaylists(playlists);

  return {
    message:
      `Restore concluído. Importadas ${imported.length} músicas (${songFileNames.length - imported.length} já existiam). ` +
      `Listas: ${listsCreated} criadas, ${listsUpdated} atualizadas.`,
  };
};
