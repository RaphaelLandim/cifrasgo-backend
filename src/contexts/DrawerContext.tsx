import React from 'react';
import { useGenreFilter } from './GenreFilterContext';
import { db } from '../services/storage';
import { matchesGenreFilter, playlistMatchesGenreFilter } from '../utils/genres';

interface DrawerStats {
  songs: number;
  playlists: number;
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
  const [drawerStats, setDrawerStats] = React.useState<DrawerStats>({ songs: 0, playlists: 0 });

  const openDrawer = React.useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
  }, []);

  React.useEffect(() => {
    if (!drawerOpen) return;
    let isActive = true;

    Promise.all([db.getSongs(), db.getPlaylists()]).then(([songs, playlists]) => {
      if (!isActive) return;
      const songsById = new Map(songs.map((song) => [song.id, song]));
      const selectedGenres = globalFilters.selectedGenres;
      setDrawerStats({
        songs: songs.filter((song) => matchesGenreFilter(song, selectedGenres)).length,
        playlists: playlists.filter((playlist) => playlistMatchesGenreFilter(playlist, selectedGenres, songsById)).length,
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
