import type { Genre, Song } from '../types/models';

export const DEFAULT_GENRE_NAMES = ['Forró', 'Funk', 'Gospel', 'MPB', 'Pop', 'Rock', 'Samba', 'Sertanejo'];
export const NO_GENRE_KEY = 'sem-genero';
export const NO_GENRE_LABEL = 'Sem gênero';

export const normalizeGenreName = (name: string): string => name.trim().toLowerCase();

export const splitGenreText = (value?: string): string[] =>
  (value || '')
    .split(/[,;|]/)
    .map(normalizeGenreName)
    .filter(Boolean);

export const uniqueGenres = (genres: string[]): string[] =>
  Array.from(new Set(genres.map(normalizeGenreName).filter(Boolean)));

export const getSongGenreKeys = (song: Pick<Song, 'genre' | 'genres'> | null): string[] => {
  if (!song) return [];
  return uniqueGenres([...(song.genres || []), ...splitGenreText(song.genre)]);
};

export const getGenreDisplayName = (genre: string, registeredGenres: Genre[] = []): string => {
  const key = normalizeGenreName(genre);
  const registered = registeredGenres.find((item) => normalizeGenreName(item.name) === key);
  if (registered) return registered.name;
  return key.charAt(0).toUpperCase() + key.slice(1);
};

export const getSongGenreDisplay = (
  song: Pick<Song, 'genre' | 'genres'>,
  registeredGenres: Genre[] = []
): string => getSongGenreKeys(song).map((genre) => getGenreDisplayName(genre, registeredGenres)).join(', ');

export const matchesGenreFilter = (song: Song | null, selectedGenres: string[]): boolean => {
  if (!song || selectedGenres.length === 0) return true;
  const songGenres = getSongGenreKeys(song);
  const hasMatchingGenre = songGenres.length > 0 && songGenres.some((genre) => selectedGenres.includes(genre));
  const hasNoGenre = songGenres.length === 0;
  const matchesNoGenre = selectedGenres.includes(NO_GENRE_KEY) && hasNoGenre;
  return hasMatchingGenre || matchesNoGenre;
};

export const playlistMatchesGenreFilter = (
  playlist: { songIds: string[]; genres?: string[] } | null,
  selectedGenres: string[],
  songsById?: Map<string, Song>
): boolean => {
  if (!playlist || selectedGenres.length === 0) return true;
  if (playlist.songIds.length === 0) return true;
  if (songsById) {
    return playlist.songIds.some((songId) => matchesGenreFilter(songsById.get(songId) || null, selectedGenres));
  }
  const hasMatchingGenre =
    playlist.genres &&
    playlist.genres.length > 0 &&
    playlist.genres.some((genre) => selectedGenres.includes(normalizeGenreName(genre)));
  const hasNoGenre = !playlist.genres || playlist.genres.length === 0;
  const matchesNoGenre = selectedGenres.includes(NO_GENRE_KEY) && hasNoGenre;
  return !!hasMatchingGenre || matchesNoGenre;
};

export const getDescendantFolderIds = <T extends { id: string; parentId?: string | null }>(
  folders: T[],
  folderId: string
): string[] => {
  const children = folders.filter((folder) => folder.parentId === folderId);
  return children.flatMap((folder) => [folder.id, ...getDescendantFolderIds(folders, folder.id)]);
};
