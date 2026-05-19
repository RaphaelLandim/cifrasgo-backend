import React from 'react';
import type { SongEditorHeaderControls, TopBarControls } from '../navigation/manualTypes';

interface TopBarContextValue {
  topBarControls: TopBarControls | null;
  songEditorHeaderControls: SongEditorHeaderControls | null;
  setTopBarControls: (controls: TopBarControls | null) => void;
  clearTopBarControls: () => void;
  setSongEditorHeaderControls: (controls: SongEditorHeaderControls | null) => void;
  clearSongEditorHeaderControls: () => void;
}

const TopBarContext = React.createContext<TopBarContextValue | null>(null);

export function TopBarProvider({ children }: { children: React.ReactNode }) {
  const [topBarControls, setTopBarControlsState] = React.useState<TopBarControls | null>(null);
  const [songEditorHeaderControls, setSongEditorHeaderControlsState] =
    React.useState<SongEditorHeaderControls | null>(null);

  const setTopBarControls = React.useCallback((controls: TopBarControls | null) => {
    setTopBarControlsState(controls);
  }, []);

  const clearTopBarControls = React.useCallback(() => {
    setTopBarControlsState(null);
  }, []);

  const setSongEditorHeaderControls = React.useCallback((controls: SongEditorHeaderControls | null) => {
    setSongEditorHeaderControlsState(controls);
  }, []);

  const clearSongEditorHeaderControls = React.useCallback(() => {
    setSongEditorHeaderControlsState(null);
  }, []);

  const value = React.useMemo(
    () => ({
      topBarControls,
      songEditorHeaderControls,
      setTopBarControls,
      clearTopBarControls,
      setSongEditorHeaderControls,
      clearSongEditorHeaderControls,
    }),
    [
      topBarControls,
      songEditorHeaderControls,
      setTopBarControls,
      clearTopBarControls,
      setSongEditorHeaderControls,
      clearSongEditorHeaderControls,
    ]
  );

  return <TopBarContext.Provider value={value}>{children}</TopBarContext.Provider>;
}

function useTopBarContext() {
  const context = React.useContext(TopBarContext);
  if (!context) {
    throw new Error('useTopBarContext must be used inside TopBarProvider');
  }
  return context;
}

export function useTopBarState() {
  const { topBarControls, songEditorHeaderControls } = useTopBarContext();
  return { topBarControls, songEditorHeaderControls };
}

export function useTopBarControls() {
  const { setTopBarControls, clearTopBarControls } = useTopBarContext();
  return { setTopBarControls, clearTopBarControls };
}

export function useSongEditorHeaderControls() {
  const { setSongEditorHeaderControls, clearSongEditorHeaderControls } = useTopBarContext();
  return { setSongEditorHeaderControls, clearSongEditorHeaderControls };
}
