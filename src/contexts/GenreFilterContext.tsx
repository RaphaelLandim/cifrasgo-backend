import React from 'react';
import { STORAGE_KEYS } from '../services/storage';
import type { GlobalFilter } from '../types/models';
import { uniqueGenres } from '../utils/genres';

export interface GenreFilterContextValue {
  globalFilters: GlobalFilter;
  updateGlobalFilters: (genres: string[]) => void;
}

const GenreFilterContext = React.createContext<GenreFilterContextValue | null>(null);

interface GenreFilterProviderProps {
  children: React.ReactNode;
}

const loadGlobalFilters = (): GlobalFilter => {
  const raw = window.localStorage.getItem(STORAGE_KEYS.globalFilters);
  if (!raw) return { selectedGenres: [] };
  try {
    const parsed = JSON.parse(raw) as GlobalFilter;
    return { selectedGenres: uniqueGenres(parsed.selectedGenres || []) };
  } catch {
    return { selectedGenres: [] };
  }
};

export function GenreFilterProvider({ children }: GenreFilterProviderProps) {
  const [globalFilters, setGlobalFilters] = React.useState<GlobalFilter>(loadGlobalFilters);

  const updateGlobalFilters = React.useCallback((genres: string[]) => {
    const newFilter: GlobalFilter = { selectedGenres: uniqueGenres(genres) };
    setGlobalFilters(newFilter);
    window.localStorage.setItem(STORAGE_KEYS.globalFilters, JSON.stringify(newFilter));
  }, []);

  const value = React.useMemo(
    () => ({
      globalFilters,
      updateGlobalFilters,
    }),
    [globalFilters, updateGlobalFilters]
  );

  return <GenreFilterContext.Provider value={value}>{children}</GenreFilterContext.Provider>;
}

export function useGenreFilter() {
  const context = React.useContext(GenreFilterContext);
  if (!context) {
    throw new Error('GenreFilterContext not available');
  }
  return context;
}

export { GenreFilterContext };
