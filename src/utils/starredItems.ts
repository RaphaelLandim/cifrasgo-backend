import type { FavoriteMode, Folder, Playlist } from '../types/models';

type StarredItem = {
  name: string;
  isStarred?: boolean;
};

const compareByName = <T extends StarredItem>(a: T, b: T) =>
  a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true });

export const sortStarredItems = <T extends StarredItem>(items: T[], favoriteMode: FavoriteMode): T[] =>
  [...items].sort((a, b) => {
    if (favoriteMode !== 'disabled') {
      const aStarred = a.isStarred === true;
      const bStarred = b.isStarred === true;
      if (aStarred !== bStarred) return aStarred ? -1 : 1;
    }

    return compareByName(a, b);
  });

export const toggleStarredFolder = (
  folders: Folder[],
  targetId: string,
  favoriteMode: FavoriteMode
): Folder[] => {
  if (favoriteMode === 'disabled') return folders;
  const target = folders.find((folder) => folder.id === targetId);
  if (!target) return folders;
  const nextStarred = target.isStarred !== true;

  return folders.map((folder) => {
    if (folder.id === targetId) return { ...folder, isStarred: nextStarred };
    if (favoriteMode === 'single' && nextStarred) return { ...folder, isStarred: false };
    return folder;
  });
};

export const toggleStarredPlaylist = (
  playlists: Playlist[],
  targetId: string,
  favoriteMode: FavoriteMode
): Playlist[] => {
  if (favoriteMode === 'disabled') return playlists;
  const target = playlists.find((playlist) => playlist.id === targetId);
  if (!target) return playlists;
  const nextStarred = target.isStarred !== true;

  return playlists.map((playlist) => {
    if (playlist.id === targetId) return { ...playlist, isStarred: nextStarred };
    if (favoriteMode === 'single' && nextStarred) return { ...playlist, isStarred: false };
    return playlist;
  });
};
