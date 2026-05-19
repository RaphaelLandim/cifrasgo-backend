import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { Music } from 'lucide-react';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { db } from '../services/storage';
import type { Genre, Song } from '../types/models';
import {
  NO_GENRE_KEY,
  NO_GENRE_LABEL,
  getGenreDisplayName,
  getSongGenreKeys,
  normalizeGenreName,
} from '../utils/genres';
import { AppModal } from './AppModal';

interface GenreFilterModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  hint?: string;
  selectedGenres?: string[];
  onConfirm?: (genres: string[]) => void;
}

export function GenreFilterModal({
  visible,
  onClose,
  title = 'Filtrar generos',
  hint = 'Selecione os generos que deseja visualizar no app.',
  selectedGenres,
  onConfirm,
}: GenreFilterModalProps) {
  const { globalFilters, updateGlobalFilters } = useGenreFilter();
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [registeredGenres, setRegisteredGenres] = React.useState<Genre[]>([]);
  const activeSelectedGenres = selectedGenres ?? globalFilters.selectedGenres;
  const activeSelectedGenresKey = activeSelectedGenres.join('|');
  const [localGenreSelection, setLocalGenreSelection] = React.useState<Set<string>>(
    new Set(activeSelectedGenres)
  );

  const load = React.useCallback(() => {
    void Promise.all([db.ensureDefaultGenres(), db.getSongs()]).then(([genres, nextSongs]) => {
      setRegisteredGenres(genres);
      setSongs(nextSongs);
    });
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    setLocalGenreSelection(new Set(activeSelectedGenres));
    load();
  }, [activeSelectedGenresKey, load, visible]);

  const allGenres = React.useMemo(() => {
    const set = new Set<string>();
    registeredGenres.forEach((genre) => {
      const key = normalizeGenreName(genre.name);
      if (key && key !== NO_GENRE_KEY) set.add(key);
    });
    songs.forEach((song) => {
      getSongGenreKeys(song).forEach((genre) => {
        if (genre !== NO_GENRE_KEY) set.add(genre);
      });
    });
    return Array.from(set).sort((a, b) =>
      getGenreDisplayName(a, registeredGenres).localeCompare(getGenreDisplayName(b, registeredGenres), 'pt-BR')
    );
  }, [registeredGenres, songs]);

  const toggleGenre = (genre: string) => {
    const next = new Set(localGenreSelection);
    if (next.has(genre)) {
      next.delete(genre);
    } else {
      next.add(genre);
    }
    setLocalGenreSelection(next);
  };

  const clearAllGenres = () => {
    setLocalGenreSelection(new Set());
  };

  const selectAllGenres = () => {
    setLocalGenreSelection(new Set([...allGenres, NO_GENRE_KEY]));
  };

  const confirmFilter = () => {
    const validGenres = new Set([...allGenres, NO_GENRE_KEY]);
    const nextSelection = Array.from(localGenreSelection).filter((genre) => validGenres.has(genre));
    if (onConfirm) {
      onConfirm(nextSelection);
    } else {
      updateGlobalFilters(nextSelection);
    }
    onClose();
  };

  return (
    <AppModal
      visible={visible}
      title={title}
      onClose={onClose}
      icon={<Music size={16} color="var(--app-accent)" />}
      maxWidth={620}
      footer={(
        <>
          <TouchableOpacity style={styles.ghostButton} onPress={clearAllGenres}>
            <Text style={styles.ghostButtonText}>Limpar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={selectAllGenres}>
            <Text style={styles.ghostButtonText}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={confirmFilter}>
            <Text style={styles.primaryButtonText}>OK</Text>
          </TouchableOpacity>
        </>
      )}
    >
      <Text style={styles.hint}>{hint}</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          {allGenres.map((genre) => {
            const isSelected = localGenreSelection.has(genre);
            return (
              <TouchableOpacity
                key={genre}
                style={[styles.cell, isSelected && styles.cellActive]}
                onPress={() => toggleGenre(genre)}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                  {isSelected ? <Text style={styles.check}>✓</Text> : null}
                </View>
                <Text style={[styles.label, isSelected && styles.labelActive]} numberOfLines={1}>
                  {getGenreDisplayName(genre, registeredGenres)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.fixedBlock}>
          <TouchableOpacity
            style={[styles.cell, styles.fixedCell, localGenreSelection.has(NO_GENRE_KEY) && styles.cellActive]}
            onPress={() => toggleGenre(NO_GENRE_KEY)}
          >
            <View style={[styles.checkbox, localGenreSelection.has(NO_GENRE_KEY) && styles.checkboxActive]}>
              {localGenreSelection.has(NO_GENRE_KEY) ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <View style={styles.textBlock}>
              <Text
                style={[styles.label, localGenreSelection.has(NO_GENRE_KEY) && styles.labelActive]}
                numberOfLines={1}
              >
                {NO_GENRE_LABEL}
              </Text>
              <Text style={styles.fixedHint}>Fixo, nao removivel</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: 'var(--app-subtle-text)',
    fontSize: 12,
    marginTop: 3,
  },
  scroll: {
    maxHeight: 390,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '47%',
    minWidth: 132,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cellActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent)',
  },
  check: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  label: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    flex: 1,
    minWidth: 0,
  },
  labelActive: {
    color: 'var(--app-text)',
    fontWeight: '800',
  },
  fixedBlock: {
    borderTopWidth: 1,
    borderTopColor: 'var(--app-border-soft)',
    marginTop: 12,
    paddingTop: 12,
  },
  fixedCell: {
    width: '100%',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  fixedHint: {
    color: 'var(--app-subtle-text)',
    fontSize: 11,
    marginTop: 2,
  },
  ghostButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ghostButtonText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: 'var(--app-accent)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#051014',
    fontSize: 13,
    fontWeight: '900',
  },
});
