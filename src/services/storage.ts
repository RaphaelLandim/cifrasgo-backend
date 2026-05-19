import { DEFAULT_THEME_SETTINGS, resolveDisplaySettings } from '../theme/theme';
import type { DisplaySettings, Folder, Genre, GlobalFilter, Playlist, PlaylistSection, PlaylistViewMode, Song, SongInput, ThemeSettings } from '../types/models';
import { DEFAULT_GENRE_NAMES, getGenreDisplayName, getSongGenreKeys, normalizeGenreName, uniqueGenres } from '../utils/genres';

export const STORAGE_KEYS = {
  songs: '@songs',
  folders: '@folders',
  playlists: '@playlists',
  folderSongs: '@folder_songs',
  displaySettings: '@display_settings',
  globalFilters: '@global_filters',
  genres: '@genres',
  themeSettings: '@theme_settings',
  showHomeDashboardOnStart: '@show_home_dashboard_on_start',
  homeDashboardUserName: '@home_dashboard_user_name',
  defaultGenresSeeded: '@default_genres_seeded',
} as const;

export const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
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

const normalizePlaylistSections = (sections: unknown): PlaylistSection[] | undefined => {
  if (!Array.isArray(sections)) return undefined;
  const normalized = sections
    .filter((section): section is Record<string, unknown> => !!section && typeof section === 'object')
    .map((section) => {
      const title = typeof section.title === 'string' ? section.title : '';
      const color = typeof section.color === 'string' && section.color.trim() ? section.color : undefined;
      return {
        id: typeof section.id === 'string' && section.id.trim() ? section.id : uid(),
        title,
        songIds: safeStringArray(section.songIds),
        ...(color ? { color } : {}),
      };
    })
    .filter((section) => section.title.trim() || section.songIds.length > 0);
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
  const sections = normalizePlaylistSections(row.sections);

  return {
    ...(row as Partial<Playlist>),
    id,
    folderId,
    name,
    songIds: safeStringArray(row.songIds),
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
          : { ...playlist, songIds: playlist.songIds.filter((id) => id !== songId) }
      )
    );
  },

  async getFolders(): Promise<Folder[]> {
    const rows = parseJson<Folder[]>(await AsyncStorage.getItem(STORAGE_KEYS.folders), []);
    return Array.isArray(rows) ? rows.map((folder) => ({ ...folder, parentId: folder.parentId ?? null })) : [];
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
