import React from 'react';
import { useGenreFilter } from './GenreFilterContext';
import { useSettings } from './SettingsContext';
import { db } from '../services/storage';
import type { LastOpenedPlaylist } from '../types/models';
import { sortFolderPlaylistDisplayItems } from '../utils/folderPlaylistDisplay';
import { matchesGenreFilter, playlistMatchesGenreFilter } from '../utils/genres';

export type DrawerFavoriteShortcut =
  | { type: 'playlist'; id: string; name: string; folderId: string | null }
  | { type: 'folder'; id: string; name: string };

interface DrawerStats {
  songs: number;
  playlists: number;
  artists: number;
  folders: number;
  lastOpenedPlaylist: LastOpenedPlaylist | null;
  favoriteShortcuts: DrawerFavoriteShortcut[];
}

interface DrawerContextValue {
  drawerOpen: boolean;
  drawerStats: DrawerStats;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const { globalFilters } = useGenreFilter();
  const { favoriteMode, folderPlaylistDisplayMode } = useSettings();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerStats, setDrawerStats] = React.useState<DrawerStats>({
    songs: 0,
    playlists: 0,
    artists: 0,
    folders: 0,
    lastOpenedPlaylist: null,
    favoriteShortcuts: [],
  });

  const openDrawer = React.useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
  }, []);

  React.useEffect(() => {
    if (!drawerOpen) return;
    let isActive = true;

    Promise.all([
      db.getSongs(),
      db.getPlaylists(),
      db.getFolders(),
      db.getLastOpenedPlaylist(),
    ]).then(([songs, playlists, folders, lastOpened]) => {
      if (!isActive) return;
      const songsById = new Map(songs.map((song) => [song.id, song]));
      const selectedGenres = globalFilters.selectedGenres;
      const visibleSongs = songs.filter((song) => matchesGenreFilter(song, selectedGenres));
      const currentPlaylist = lastOpened
        ? playlists.find((playlist) => playlist.id === lastOpened.playlistId)
        : null;
      const favoriteShortcuts: DrawerFavoriteShortcut[] = sortFolderPlaylistDisplayItems(
        folders.filter((folder) => folder.isStarred === true),
        playlists.filter((playlist) => playlist.isStarred === true),
        favoriteMode,
        folderPlaylistDisplayMode,
      ).map((item) => item.type === 'folder'
        ? { type: 'folder', id: item.folder.id, name: item.folder.name }
        : {
            type: 'playlist',
            id: item.playlist.id,
            name: item.playlist.name,
            folderId: item.playlist.folderId ?? null,
          });

      if (lastOpened && !currentPlaylist) {
        void db.clearLastOpenedPlaylist();
      }

      setDrawerStats({
        songs: visibleSongs.length,
        playlists: playlists.filter((playlist) => playlistMatchesGenreFilter(playlist, selectedGenres, songsById)).length,
        artists: new Set(visibleSongs.map((song) => song.artist?.trim() || 'Sem artista')).size,
        folders: folders.length,
        lastOpenedPlaylist: currentPlaylist
          ? {
              playlistId: currentPlaylist.id,
              playlistName: currentPlaylist.name,
              folderId: currentPlaylist.folderId ?? null,
              updatedAt: lastOpened?.updatedAt ?? Date.now(),
            }
          : null,
        favoriteShortcuts,
      });
    });

    return () => {
      isActive = false;
    };
  }, [
    drawerOpen,
    favoriteMode,
    folderPlaylistDisplayMode,
    globalFilters.selectedGenres,
  ]);

  const value = React.useMemo(
    () => ({
      drawerOpen,
      drawerStats,
      openDrawer,
      closeDrawer,
    }),
    [drawerOpen, drawerStats, openDrawer, closeDrawer]
  );

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer() {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used inside DrawerProvider');
  }
  return context;
}
