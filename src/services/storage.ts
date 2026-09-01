import { DEFAULT_THEME_SETTINGS, resolveDisplaySettings } from '../theme/theme';
import type { DisplaySettings, FavoriteMode, Folder, FolderPlaylistDisplayMode, Genre, GlobalFilter, HomeShortcutSettings, LastOpenedPlaylist, Playlist, PlaylistItem, PlaylistSection, PlaylistViewMode, QuickPdfId, QuickPdfLink, QuickPdfViewState, Song, SongInput, ThemeSettings } from '../types/models';
import { normalizeFolderPlaylistDisplayMode } from '../utils/folderPlaylistDisplay';
import { DEFAULT_GENRE_NAMES, getGenreDisplayName, getSongGenreKeys, normalizeGenreName, uniqueGenres } from '../utils/genres';
import { appendSongItemIfNeeded, derivePlaylistItemsFromSongIds, getPlaylistSectionItemIds, normalizePlaylistItems, QUICK_PDF_IDS, removeSongFromPlaylistItems } from '../utils/playlistItems';
import { recordDevStorageOperation } from '../utils/devPerformance';

export const STORAGE_KEYS = {
  songs: '@songs',
  folders: '@folders',
  playlists: '@playlists',
  folderSongs: '@folder_songs',
  displaySettings: '@display_settings',
  globalFilters: '@global_filters',
  genres: '@genres',
  themeSettings: '@theme_settings',
  favoriteMode: '@favorite_mode',
  folderPlaylistDisplayMode: '@folder_playlist_display_mode',
  quickPdfs: '@quick_pdfs',
  quickPdfViewState: '@quick_pdf_view_state',
  lastOpenedPlaylist: '@last_opened_playlist',
  homeShortcutSettings: '@home_shortcut_settings',
  showHomeDashboardOnStart: '@show_home_dashboard_on_start',
  homeDashboardUserName: '@home_dashboard_user_name',
  defaultGenresSeeded: '@default_genres_seeded',
} as const;

export const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    const startedAt = performance.now();
    const value = window.localStorage.getItem(key);
    recordDevStorageOperation('get', key, startedAt, value?.length || 0);
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const startedAt = performance.now();
    window.localStorage.setItem(key, value);
    recordDevStorageOperation('set', key, startedAt, value.length);
  },
  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const startedAt = performance.now();
    window.localStorage.removeItem(key);
    recordDevStorageOperation('remove', key, startedAt, 0);
  },
};

const parseJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const uid = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11);

const safeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

const normalizeQuickPdfFilesystemStorage = (value: unknown): QuickPdfLink['fileStorage'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const path = typeof row.path === 'string' ? row.path.trim() : '';
  const fileName = typeof row.fileName === 'string' ? row.fileName.trim() : '';
  const mimeType = typeof row.mimeType === 'string' && row.mimeType.trim() ? row.mimeType.trim() : 'application/pdf';
  const sizeBytes = typeof row.sizeBytes === 'number' && Number.isFinite(row.sizeBytes) ? row.sizeBytes : 0;
  const updatedAt = typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : Date.now();
  if (row.kind !== 'filesystem' || row.directory !== 'Data' || !path || !fileName || sizeBytes <= 0) return undefined;

  return {
    kind: 'filesystem',
    path,
    directory: 'Data',
    fileName,
    mimeType,
    sizeBytes,
    updatedAt,
  };
};

const normalizeQuickPdfs = (value: unknown): QuickPdfLink[] => {
  const rows = Array.isArray(value) ? value : [];
  return QUICK_PDF_IDS.map((id) => {
    const row = rows.find((item): item is Record<string, unknown> => {
      return !!item && typeof item === 'object' && (item as Record<string, unknown>).id === id;
    });
    const name = typeof row?.name === 'string' ? row.name.trim() : '';
    const url = typeof row?.url === 'string' ? row.url.trim() : '';
    const fileName = typeof row?.fileName === 'string' ? row.fileName.trim() : '';
    const fileData = typeof row?.fileData === 'string' ? row.fileData.trim() : '';
    const fileStorage = normalizeQuickPdfFilesystemStorage(row?.fileStorage);
    const fileSize = typeof row?.fileSize === 'number' && Number.isFinite(row.fileSize)
      ? row.fileSize
      : fileStorage?.sizeBytes;
    const fileMimeType = typeof row?.fileMimeType === 'string' && row.fileMimeType.trim()
      ? row.fileMimeType.trim()
      : fileStorage?.mimeType || '';
    const requestedSourceType = row?.sourceType === 'file' || row?.sourceType === 'url' ? row.sourceType : undefined;
    const sourceType = fileData || fileStorage ? 'file' : url ? 'url' : requestedSourceType;
    const updatedAt = typeof row?.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : undefined;
    return {
      id,
      ...(sourceType ? { sourceType } : {}),
      ...(name ? { name } : {}),
      ...(sourceType === 'url' && url ? { url } : {}),
      ...(sourceType === 'file' && (fileName || fileStorage?.fileName) ? { fileName: fileName || fileStorage?.fileName } : {}),
      ...(sourceType === 'file' && fileData ? { fileData } : {}),
      ...(sourceType === 'file' && fileStorage ? { fileStorage } : {}),
      ...(sourceType === 'file' && fileSize ? { fileSize } : {}),
      ...(sourceType === 'file' && fileMimeType ? { fileMimeType } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    };
  });
};

const normalizeQuickPdfViewState = (value: unknown): Partial<Record<QuickPdfId, QuickPdfViewState>> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const normalized: Partial<Record<QuickPdfId, QuickPdfViewState>> = {};

  QUICK_PDF_IDS.forEach((pdfId) => {
    const state = row[pdfId];
    if (!state || typeof state !== 'object') return;
    const stateRow = state as Record<string, unknown>;
    const pageNumber = typeof stateRow.pageNumber === 'number' && Number.isFinite(stateRow.pageNumber)
      ? Math.floor(stateRow.pageNumber)
      : 0;
    const sourceFingerprint = typeof stateRow.sourceFingerprint === 'string'
      ? stateRow.sourceFingerprint.trim()
      : '';
    const zoom = typeof stateRow.zoom === 'number' && Number.isFinite(stateRow.zoom)
      ? Math.min(3, Math.max(0.5, stateRow.zoom))
      : 1;
    const pageOffsetRatio = typeof stateRow.pageOffsetRatio === 'number' && Number.isFinite(stateRow.pageOffsetRatio)
      ? Math.min(1, Math.max(0, stateRow.pageOffsetRatio))
      : 0;
    const updatedAt = typeof stateRow.updatedAt === 'number' && Number.isFinite(stateRow.updatedAt)
      ? stateRow.updatedAt
      : Date.now();

    if (pageNumber < 1 || !sourceFingerprint) return;
    normalized[pdfId] = { pdfId, pageNumber, zoom, pageOffsetRatio, sourceFingerprint, updatedAt };
  });

  return normalized;
};

const normalizeLastOpenedPlaylist = (value: unknown): LastOpenedPlaylist | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const playlistId = typeof row.playlistId === 'string' ? row.playlistId.trim() : '';
  const playlistName = typeof row.playlistName === 'string' ? row.playlistName.trim() : '';
  const folderId = typeof row.folderId === 'string' ? row.folderId : row.folderId === null ? null : undefined;
  const updatedAt = typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : 0;
  if (!playlistId || !playlistName || updatedAt <= 0) return null;
  return { playlistId, playlistName, folderId, updatedAt };
};

export const normalizeHomeShortcutSettings = (value: unknown): HomeShortcutSettings => {
  if (!value || typeof value !== 'object') return { mode: 'recent' };
  const row = value as Record<string, unknown>;
  if (row.mode === 'favorite' || row.mode === 'favorites') return { mode: 'favorites' };
  if (row.mode === 'all' || row.mode === 'none') return { mode: row.mode };
  return { mode: 'recent' };
};

const normalizePlaylistSections = (sections: unknown, playlistItems: PlaylistItem[]): PlaylistSection[] | undefined => {
  if (!Array.isArray(sections)) return undefined;
  const itemById = new Map(playlistItems.map((item) => [item.id, item]));
  const normalized = sections
    .filter((section): section is Record<string, unknown> => !!section && typeof section === 'object')
    .map((section) => {
      const title = typeof section.title === 'string' ? section.title : '';
      const color = typeof section.color === 'string' && section.color.trim() ? section.color : undefined;
      const baseSection: PlaylistSection = {
        id: typeof section.id === 'string' && section.id.trim() ? section.id : uid(),
        title,
        songIds: safeStringArray(section.songIds),
        ...(color ? { color } : {}),
      };
      const itemIds = getPlaylistSectionItemIds(
        { ...baseSection, itemIds: safeStringArray(section.itemIds) },
        playlistItems,
      );
      const songIds = itemIds.flatMap((itemId) => {
        const item = itemById.get(itemId);
        return item?.type === 'song' ? [item.songId] : [];
      });

      return {
        ...baseSection,
        songIds,
        ...(itemIds.length ? { itemIds } : {}),
      };
    })
    .filter((section) => section.title.trim() || section.songIds.length > 0 || section.itemIds?.length);
  return normalized.length ? normalized : undefined;
};

const normalizePlaylistRow = (playlist: unknown): Playlist | null => {
  if (!playlist || typeof playlist !== 'object') return null;
  const row = playlist as Record<string, unknown>;
  const id = typeof row.id === 'string' && row.id.trim() ? row.id : uid();
  const name = typeof row.name === 'string' ? row.name : 'Lista';
  const folderId = typeof row.folderId === 'string' && row.folderId.trim() ? row.folderId : null;
  const genres = safeStringArray(row.genres);
  const viewMode: PlaylistViewMode | undefined = row.viewMode === 'script' || row.viewMode === 'default' ? row.viewMode : undefined;
  const songIds = safeStringArray(row.songIds);
  const items = normalizePlaylistItems(row.items, songIds);
  const sections = normalizePlaylistSections(row.sections, items ?? derivePlaylistItemsFromSongIds(songIds));

  return {
    ...(row as Partial<Playlist>),
    id,
    folderId,
    name,
    songIds,
    ...(items ? { items } : { items: undefined }),
    isStarred: row.isStarred === true,
    ...(genres.length ? { genres } : { genres: undefined }),
    ...(viewMode ? { viewMode } : { viewMode: undefined }),
    ...(sections ? { sections } : { sections: undefined }),
  };
};

const normalizeStringArrayMap = (value: unknown): Record<string, string[]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !!key)
      .map(([key, ids]) => [key, safeStringArray(ids)])
  );
};

export const db = {
  async clearAllData(): Promise<void> {
    await Promise.all(Object.values(STORAGE_KEYS).map((key) => AsyncStorage.removeItem(key)));
  },

  async getSongs(): Promise<Song[]> {
    const rows = parseJson<Song[]>(await AsyncStorage.getItem(STORAGE_KEYS.songs), []);
    return Array.isArray(rows) ? rows : [];
  },

  async saveSongs(rows: Song[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.songs, JSON.stringify(rows));
  },

  async addSong(input: SongInput): Promise<Song> {
    const rows = await db.getSongs();
    const song: Song = {
      ...input,
      id: uid(),
      title: input.title.trim(),
      artist: input.artist.trim(),
      updatedAt: input.updatedAt ?? Date.now(),
    };
    await db.saveSongs([song, ...rows]);
    return song;
  },

  async updateSong(id: string, updates: Partial<Song>): Promise<Song | null> {
    const rows = await db.getSongs();
    let updated: Song | null = null;
    const next = rows.map((song) => {
      if (song.id !== id) return song;
      updated = { ...song, ...updates, updatedAt: Date.now() };
      return updated;
    });
    await db.saveSongs(next);
    return updated;
  },

  async deleteSong(id: string): Promise<void> {
    const songs = await db.getSongs();
    await db.saveSongs(songs.filter((song) => song.id !== id));

    const playlists = await db.getPlaylists();
    await db.savePlaylists(
      playlists.map((playlist) => ({
        ...playlist,
        songIds: playlist.songIds.filter((songId) => songId !== id),
        items: removeSongFromPlaylistItems(playlist.items, id),
      }))
    );

    const folderSongMap = await db.getFolderSongMap();
    Object.keys(folderSongMap).forEach((folderId) => {
      const nextSongIds = folderSongMap[folderId].filter((songId) => songId !== id);
      if (nextSongIds.length) folderSongMap[folderId] = nextSongIds;
      else delete folderSongMap[folderId];
    });
    await db.saveFolderSongMap(folderSongMap);
  },

  async getPlaylists(): Promise<Playlist[]> {
    const rows = parseJson<Playlist[]>(await AsyncStorage.getItem(STORAGE_KEYS.playlists), []);
    return Array.isArray(rows) ? rows.map(normalizePlaylistRow).filter((playlist): playlist is Playlist => !!playlist) : [];
  },

  async savePlaylists(rows: Playlist[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.playlists, JSON.stringify(rows));
  },

  async addPlaylist(folderId: string | null, name: string): Promise<Playlist> {
    const rows = await db.getPlaylists();
    const playlist: Playlist = { id: uid(), folderId, name, songIds: [] };
    await db.savePlaylists([playlist, ...rows]);
    return playlist;
  },

  async byFolder(folderId: string | null): Promise<Playlist[]> {
    return (await db.getPlaylists()).filter((playlist) => playlist.folderId === folderId);
  },

  async byPlaylist(playlistId: string): Promise<Playlist | null> {
    return (await db.getPlaylists()).find((playlist) => playlist.id === playlistId) || null;
  },

  async addSongToPlaylist(playlistId: string, songId: string): Promise<void> {
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((playlist) =>
        playlist.id !== playlistId
          ? playlist
          : {
              ...playlist,
              songIds: playlist.songIds.includes(songId) ? playlist.songIds : [...playlist.songIds, songId],
              items: appendSongItemIfNeeded(playlist, songId),
            }
      )
    );
  },

  async removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((playlist) =>
        playlist.id !== playlistId
          ? playlist
          : {
              ...playlist,
              songIds: playlist.songIds.filter((id) => id !== songId),
              items: removeSongFromPlaylistItems(playlist.items, songId),
            }
      )
    );
  },

  async getFolders(): Promise<Folder[]> {
    const rows = parseJson<Folder[]>(await AsyncStorage.getItem(STORAGE_KEYS.folders), []);
    return Array.isArray(rows) ? rows.map((folder) => ({ ...folder, parentId: folder.parentId ?? null, isStarred: folder.isStarred === true })) : [];
  },

  async saveFolders(rows: Folder[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.folders, JSON.stringify(rows));
  },

  async addFolder(name: string, parentId: string | null = null): Promise<Folder> {
    const rows = await db.getFolders();
    const folder: Folder = { id: uid(), name, parentId };
    await db.saveFolders([folder, ...rows]);
    return folder;
  },

  async getSubfolders(parentId: string | null): Promise<Folder[]> {
    return (await db.getFolders()).filter((folder) => (folder.parentId ?? null) === parentId);
  },

  async getFolderSongMap(): Promise<Record<string, string[]>> {
    return normalizeStringArrayMap(parseJson<Record<string, unknown>>(await AsyncStorage.getItem(STORAGE_KEYS.folderSongs), {}));
  },

  async saveFolderSongMap(map: Record<string, string[]>): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.folderSongs, JSON.stringify(map));
  },

  async getFolderSongIds(folderId: string): Promise<string[]> {
    const map = await db.getFolderSongMap();
    return map[folderId] || [];
  },

  async addSongToFolder(folderId: string, songId: string): Promise<void> {
    const map = await db.getFolderSongMap();
    const list = map[folderId] || [];
    map[folderId] = list.includes(songId) ? list : [...list, songId];
    await db.saveFolderSongMap(map);
  },

  async addSongsToFolder(folderId: string, songIds: string[]): Promise<void> {
    if (!songIds.length) return;
    const map = await db.getFolderSongMap();
    map[folderId] = Array.from(new Set([...(map[folderId] || []), ...songIds]));
    await db.saveFolderSongMap(map);
  },

  async removeSongFromFolder(folderId: string, songId: string): Promise<void> {
    const map = await db.getFolderSongMap();
    const list = map[folderId] || [];
    map[folderId] = list.filter((id) => id !== songId);
    await db.saveFolderSongMap(map);
  },

  async removeFolderSongLinks(folderIds: string[]): Promise<void> {
    const ids = new Set(folderIds);
    if (ids.size === 0) return;

    const map = await db.getFolderSongMap();
    ids.forEach((folderId) => delete map[folderId]);
    await db.saveFolderSongMap(map);
  },

  async getGenres(): Promise<Genre[]> {
    const rows = parseJson<Genre[]>(await AsyncStorage.getItem(STORAGE_KEYS.genres), []);
    return Array.isArray(rows) ? rows : [];
  },

  async saveGenres(rows: Genre[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.genres, JSON.stringify(rows));
  },

  async ensureDefaultGenres(): Promise<Genre[]> {
    const rows = await db.getGenres();
    const alreadySeeded = parseJson<boolean>(await AsyncStorage.getItem(STORAGE_KEYS.defaultGenresSeeded), false) === true;
    if (alreadySeeded) return rows;

    const existingKeys = new Set(rows.map((genre) => normalizeGenreName(genre.name)));
    const missingDefaults = DEFAULT_GENRE_NAMES
      .filter((name) => !existingKeys.has(normalizeGenreName(name)))
      .map((name) => ({ id: uid(), name, updatedAt: Date.now() }));

    const nextRows = [...rows, ...missingDefaults].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    await db.saveGenres(nextRows);
    await AsyncStorage.setItem(STORAGE_KEYS.defaultGenresSeeded, JSON.stringify(true));
    return nextRows;
  },

  async addGenre(name: string): Promise<Genre | null> {
    const cleanName = name.trim();
    if (!cleanName) return null;

    const rows = await db.getGenres();
    if (rows.some((genre) => normalizeGenreName(genre.name) === normalizeGenreName(cleanName))) {
      return null;
    }

    const genre: Genre = { id: uid(), name: cleanName, updatedAt: Date.now() };
    await db.saveGenres([...rows, genre].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    return genre;
  },

  async updateGenre(id: string, name: string): Promise<Genre | null> {
    const cleanName = name.trim();
    if (!cleanName) return null;

    const rows = await db.getGenres();
    const current = rows.find((genre) => genre.id === id);
    if (!current) return null;

    const oldKey = normalizeGenreName(current.name);
    const newKey = normalizeGenreName(cleanName);
    if (rows.some((genre) => genre.id !== id && normalizeGenreName(genre.name) === newKey)) return null;

    const nextGenres = rows
      .map((genre) => (genre.id === id ? { ...genre, name: cleanName, updatedAt: Date.now() } : genre))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const songs = await db.getSongs();
    const nextSongs = songs.map((song) => {
      const keys = uniqueGenres(getSongGenreKeys(song).map((genre) => (genre === oldKey ? newKey : genre)));
      return {
        ...song,
        genres: keys.length ? keys : undefined,
        genre: keys.length ? keys.map((genre) => getGenreDisplayName(genre, nextGenres)).join(', ') : undefined,
      };
    });

    await db.saveGenres(nextGenres);
    await db.saveSongs(nextSongs);
    return nextGenres.find((genre) => genre.id === id) || null;
  },

  async deleteGenre(id: string): Promise<void> {
    const rows = await db.getGenres();
    const current = rows.find((genre) => genre.id === id);
    if (!current) return;

    const deletedKey = normalizeGenreName(current.name);
    const nextGenres = rows.filter((genre) => genre.id !== id);
    const songs = await db.getSongs();
    const nextSongs = songs.map((song) => {
      const keys = getSongGenreKeys(song).filter((genre) => genre !== deletedKey);
      return {
        ...song,
        genres: keys.length ? keys : undefined,
        genre: keys.length ? keys.map((genre) => getGenreDisplayName(genre, nextGenres)).join(', ') : undefined,
      };
    });

    await db.saveGenres(nextGenres);
    await db.saveSongs(nextSongs);
  },

  async getDisplaySettings(): Promise<DisplaySettings> {
    return resolveDisplaySettings(parseJson<Partial<DisplaySettings>>(await AsyncStorage.getItem(STORAGE_KEYS.displaySettings), {}));
  },

  async saveDisplaySettings(settings: DisplaySettings): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.displaySettings, JSON.stringify(settings));
  },

  async getGlobalFilters(): Promise<GlobalFilter> {
    const parsed = parseJson<Partial<GlobalFilter>>(await AsyncStorage.getItem(STORAGE_KEYS.globalFilters), {});
    return { selectedGenres: uniqueGenres(parsed.selectedGenres || []) };
  },

  async saveGlobalFilters(filters: GlobalFilter): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.globalFilters, JSON.stringify(filters));
  },

  async getThemeSettings(): Promise<ThemeSettings> {
    return {
      ...DEFAULT_THEME_SETTINGS,
      ...parseJson<Partial<ThemeSettings>>(await AsyncStorage.getItem(STORAGE_KEYS.themeSettings), {}),
    };
  },

  async saveThemeSettings(settings: ThemeSettings): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.themeSettings, JSON.stringify(settings));
  },

  async getFavoriteMode(): Promise<FavoriteMode> {
    const value = parseJson<FavoriteMode | null>(await AsyncStorage.getItem(STORAGE_KEYS.favoriteMode), null);
    return value === 'single' || value === 'multiple' ? value : 'disabled';
  },

  async saveFavoriteMode(mode: FavoriteMode): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.favoriteMode, JSON.stringify(mode));
  },

  async getFolderPlaylistDisplayMode(): Promise<FolderPlaylistDisplayMode> {
    return normalizeFolderPlaylistDisplayMode(
      parseJson<FolderPlaylistDisplayMode | null>(await AsyncStorage.getItem(STORAGE_KEYS.folderPlaylistDisplayMode), null)
    );
  },

  async saveFolderPlaylistDisplayMode(mode: FolderPlaylistDisplayMode): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.folderPlaylistDisplayMode, JSON.stringify(mode));
  },

  async getQuickPdfs(): Promise<QuickPdfLink[]> {
    return normalizeQuickPdfs(parseJson<unknown>(await AsyncStorage.getItem(STORAGE_KEYS.quickPdfs), []));
  },

  async saveQuickPdfs(rows: QuickPdfLink[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.quickPdfs, JSON.stringify(normalizeQuickPdfs(rows)));
  },

  async getQuickPdfViewState(): Promise<Partial<Record<QuickPdfId, QuickPdfViewState>>> {
    return normalizeQuickPdfViewState(parseJson<unknown>(await AsyncStorage.getItem(STORAGE_KEYS.quickPdfViewState), {}));
  },

  async saveQuickPdfViewState(
    pdfId: QuickPdfId,
    viewState: Pick<QuickPdfViewState, 'pageNumber' | 'sourceFingerprint'> & {
      zoom?: number;
      pageOffsetRatio?: number;
    },
  ): Promise<void> {
    const { pageNumber, sourceFingerprint } = viewState;
    const cleanPageNumber = Math.floor(pageNumber);
    const cleanFingerprint = sourceFingerprint.trim();
    const cleanZoom = typeof viewState.zoom === 'number' && Number.isFinite(viewState.zoom)
      ? Math.min(3, Math.max(0.5, viewState.zoom))
      : 1;
    const cleanPageOffsetRatio = typeof viewState.pageOffsetRatio === 'number'
      && Number.isFinite(viewState.pageOffsetRatio)
      ? Math.min(1, Math.max(0, viewState.pageOffsetRatio))
      : 0;
    if (cleanPageNumber < 1 || !cleanFingerprint) return;
    const current = await db.getQuickPdfViewState();
    const next: Partial<Record<QuickPdfId, QuickPdfViewState>> = {
      ...current,
      [pdfId]: {
        pdfId,
        pageNumber: cleanPageNumber,
        zoom: cleanZoom,
        pageOffsetRatio: cleanPageOffsetRatio,
        sourceFingerprint: cleanFingerprint,
        updatedAt: Date.now(),
      },
    };
    await AsyncStorage.setItem(STORAGE_KEYS.quickPdfViewState, JSON.stringify(next));
  },

  async saveQuickPdfPageState(pdfId: QuickPdfId, pageNumber: number, sourceFingerprint: string): Promise<void> {
    await db.saveQuickPdfViewState(pdfId, {
      pageNumber,
      sourceFingerprint,
      zoom: 1,
      pageOffsetRatio: 0,
    });
  },

  async clearQuickPdfPageState(pdfId: QuickPdfId): Promise<void> {
    const current = await db.getQuickPdfViewState();
    if (!current[pdfId]) return;
    const next = { ...current };
    delete next[pdfId];
    await AsyncStorage.setItem(STORAGE_KEYS.quickPdfViewState, JSON.stringify(next));
  },

  async getLastOpenedPlaylist(): Promise<LastOpenedPlaylist | null> {
    return normalizeLastOpenedPlaylist(parseJson<unknown>(await AsyncStorage.getItem(STORAGE_KEYS.lastOpenedPlaylist), null));
  },

  async saveLastOpenedPlaylist(value: LastOpenedPlaylist): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.lastOpenedPlaylist, JSON.stringify(normalizeLastOpenedPlaylist(value)));
  },

  async clearLastOpenedPlaylist(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.lastOpenedPlaylist);
  },

  async getHomeShortcutSettings(): Promise<HomeShortcutSettings> {
    return normalizeHomeShortcutSettings(
      parseJson<unknown>(await AsyncStorage.getItem(STORAGE_KEYS.homeShortcutSettings), null),
    );
  },

  async saveHomeShortcutSettings(settings: HomeShortcutSettings): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.homeShortcutSettings,
      JSON.stringify(normalizeHomeShortcutSettings(settings)),
    );
  },

  async getShowHomeDashboardOnStart(): Promise<boolean> {
    return parseJson<boolean>(await AsyncStorage.getItem(STORAGE_KEYS.showHomeDashboardOnStart), false) === true;
  },

  async saveShowHomeDashboardOnStart(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.showHomeDashboardOnStart, JSON.stringify(enabled));
  },

  async getHomeDashboardUserName(): Promise<string> {
    return parseJson<string>(await AsyncStorage.getItem(STORAGE_KEYS.homeDashboardUserName), '');
  },

  async saveHomeDashboardUserName(name: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.homeDashboardUserName, JSON.stringify(name));
  },
};
