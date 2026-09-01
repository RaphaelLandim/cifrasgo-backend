import React from 'react';
import { useGenreFilter } from './GenreFilterContext';
import { db } from '../services/storage';
import type { LastOpenedPlaylist } from '../types/models';
import { matchesGenreFilter, playlistMatchesGenreFilter } from '../utils/genres';

interface DrawerStats {
  songs: number;
  playlists: number;
  artists: number;
  folders: number;
  lastOpenedPlaylist: LastOpenedPlaylist | null;
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
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerStats, setDrawerStats] = React.useState<DrawerStats>({
    songs: 0,
    playlists: 0,
    artists: 0,
    folders: 0,
    lastOpenedPlaylist: null,
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
      });
    });

    return () => {
      isActive = false;
    };
  }, [drawerOpen, globalFilters.selectedGenres]);

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
