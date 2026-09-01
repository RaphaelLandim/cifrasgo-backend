import type { FavoriteMode, Folder, FolderPlaylistDisplayMode, Playlist } from '../types/models';
import { sortStarredItems } from './starredItems';

export type FolderPlaylistDisplayItem =
  | { type: 'folder'; folder: Folder; name: string; isStarred?: boolean }
  | { type: 'playlist'; playlist: Playlist; name: string; isStarred?: boolean };

export const DEFAULT_FOLDER_PLAYLIST_DISPLAY_MODE: FolderPlaylistDisplayMode = 'folders_first';

export const normalizeFolderPlaylistDisplayMode = (value: unknown): FolderPlaylistDisplayMode =>
  value === 'playlists_first' || value === 'mixed' || value === 'folders_first' ? value : DEFAULT_FOLDER_PLAYLIST_DISPLAY_MODE;

export const sortFolderPlaylistDisplayItems = (
  folders: Folder[],
  playlists: Playlist[],
  favoriteMode: FavoriteMode,
  displayMode: FolderPlaylistDisplayMode
): FolderPlaylistDisplayItem[] => {
  const folderItems = sortStarredItems(folders, favoriteMode).map((folder) => ({
    type: 'folder' as const,
    folder,
    name: folder.name,
    isStarred: folder.isStarred,
  }));
  const playlistItems = sortStarredItems(playlists, favoriteMode).map((playlist) => ({
    type: 'playlist' as const,
    playlist,
    name: playlist.name,
    isStarred: playlist.isStarred,
  }));

  if (displayMode === 'playlists_first') return [...playlistItems, ...folderItems];
  if (displayMode === 'mixed') return sortStarredItems([...folderItems, ...playlistItems], favoriteMode);
  return [...folderItems, ...playlistItems];
};
