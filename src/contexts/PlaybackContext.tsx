import React from 'react';

interface PlaybackContextValue {
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  startPlaying: () => void;
  stopPlaying: () => void;
}

const PlaybackContext = React.createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = React.useState(false);

  const startPlaying = React.useCallback(() => {
    setIsPlaying(true);
  }, []);

  const stopPlaying = React.useCallback(() => {
    setIsPlaying(false);
  }, []);

  const value = React.useMemo(
    () => ({
      isPlaying,
      setIsPlaying,
      startPlaying,
      stopPlaying,
    }),
    [isPlaying, startPlaying, stopPlaying]
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback() {
  const context = React.useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlayback must be used inside PlaybackProvider');
  }
  return context;
}
