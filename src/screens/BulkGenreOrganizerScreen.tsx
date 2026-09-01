import React from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { AlertTriangle, Check, Filter, ListChecks, Plus, RotateCcw, Search, Tags, Trash2, User } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../services/storage';
import type { Genre, Song } from '../types/models';
import {
  getGenreDisplayName,
  getSongGenreKeys,
  normalizeGenreName,
  uniqueGenres,
} from '../utils/genres';

type BulkGenreAction = 'add' | 'remove' | 'replace';

const ALL_GENRES = '__all_genres__';

const actionCopy: Record<BulkGenreAction, { title: string; button: string; tone: string; description: string }> = {
  add: {
    title: 'Adicionar generos',
    button: 'Adicionar',
    tone: '#38bdf8',
    description: 'Une os generos escolhidos aos generos atuais das musicas selecionadas.',
  },
  remove: {
    title: 'Remover generos',
    button: 'Remover',
    tone: '#f59e0b',
    description: 'Remove apenas os generos escolhidos das musicas selecionadas.',
  },
  replace: {
    title: 'Substituir generos',
    button: 'Substituir',
    tone: '#ef4444',
    description: 'Remove todos os generos atuais e aplica somente os generos escolhidos.',
  },
};

const getArtistName = (song: Song) => song.artist?.trim() || 'Sem artista';

const areGenreListsEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

const getNextGenreKeys = (currentKeys: string[], selectedKeys: string[], action: BulkGenreAction): string[] => {
  if (action === 'add') return uniqueGenres([...currentKeys, ...selectedKeys]);
  if (action === 'remove') return currentKeys.filter((genre) => !selectedKeys.includes(genre));
  return uniqueGenres(selectedKeys);
};

export function BulkGenreOrganizerScreen() {
  const { themeSettings } = useSettings();
  const isLightTheme = themeSettings.mode === 'light';
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [registeredGenres, setRegisteredGenres] = React.useState<Genre[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [applying, setApplying] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [titleQuery, setTitleQuery] = React.useState('');
  const [artistQuery, setArtistQuery] = React.useState('');
  const [genreFilter, setGenreFilter] = React.useState(ALL_GENRES);
  const [noGenreOnly, setNoGenreOnly] = React.useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = React.useState(false);
  const [selectedSongIds, setSelectedSongIds] = React.useState<Set<string>>(new Set());
  const [actionType, setActionType] = React.useState<BulkGenreAction | null>(null);
  const [actionGenreSelection, setActionGenreSelection] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(async () => {
    setLoading(true);
    const [nextGenres, nextSongs] = await Promise.all([db.ensureDefaultGenres(), db.getSongs()]);
    setRegisteredGenres(nextGenres);
    setSongs(nextSongs);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const allGenreKeys = React.useMemo(() => {
    const keys = new Set<string>();
    registeredGenres.forEach((genre) => {
      const key = normalizeGenreName(genre.name);
      if (key) keys.add(key);
    });
    songs.forEach((song) => {
      getSongGenreKeys(song).forEach((genre) => keys.add(genre));
    });
    return Array.from(keys).sort((a, b) =>
      getGenreDisplayName(a, registeredGenres).localeCompare(getGenreDisplayName(b, registeredGenres), 'pt-BR')
    );
  }, [registeredGenres, songs]);

  const artistOptions = React.useMemo(
    () => Array.from(new Set(songs.map(getArtistName))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [songs]
  );

  const selectedCount = selectedSongIds.size;
  const songsWithoutGenreCount = React.useMemo(
    () => songs.filter((song) => getSongGenreKeys(song).length === 0).length,
    [songs]
  );

  const filteredSongs = React.useMemo(() => {
    const titleSearch = titleQuery.trim().toLowerCase();
    const artistSearch = artistQuery.trim().toLowerCase();
    return songs.filter((song) => {
      const genreKeys = getSongGenreKeys(song);
      if (showSelectedOnly && !selectedSongIds.has(song.id)) return false;
      if (noGenreOnly && genreKeys.length > 0) return false;
      if (genreFilter !== ALL_GENRES && !genreKeys.includes(genreFilter)) return false;
      if (titleSearch && !song.title.toLowerCase().includes(titleSearch)) return false;
      if (artistSearch && !getArtistName(song).toLowerCase().includes(artistSearch)) return false;
      return true;
    });
  }, [artistQuery, genreFilter, noGenreOnly, selectedSongIds, showSelectedOnly, songs, titleQuery]);

  const selectedActionGenreKeys = React.useMemo(
    () => allGenreKeys.filter((genre) => actionGenreSelection.has(genre)),
    [actionGenreSelection, allGenreKeys]
  );

  const selectedSongs = React.useMemo(
    () => songs.filter((song) => selectedSongIds.has(song.id)),
    [selectedSongIds, songs]
  );

  const affectedCount = React.useMemo(() => {
    if (!actionType || selectedActionGenreKeys.length === 0) return 0;
    return selectedSongs.filter((song) => {
      const currentKeys = getSongGenreKeys(song);
      const nextKeys = getNextGenreKeys(currentKeys, selectedActionGenreKeys, actionType);
      return !areGenreListsEqual(currentKeys, nextKeys);
    }).length;
  }, [actionType, selectedActionGenreKeys, selectedSongs]);

  const toggleSongSelection = (songId: string) => {
    setSelectedSongIds((current) => {
      const next = new Set(current);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedSongIds((current) => {
      const next = new Set(current);
      filteredSongs.forEach((song) => next.add(song.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedSongIds(new Set());
    setShowSelectedOnly(false);
  };

  const clearFilters = () => {
    setTitleQuery('');
    setArtistQuery('');
    setGenreFilter(ALL_GENRES);
    setNoGenreOnly(false);
    setShowSelectedOnly(false);
  };

  const openAction = (action: BulkGenreAction) => {
    setActionType(action);
    setActionGenreSelection(new Set());
  };

  const toggleActionGenre = (genre: string) => {
    setActionGenreSelection((current) => {
      const next = new Set(current);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  };

  const closeActionModal = () => {
    if (applying) return;
    setActionType(null);
    setActionGenreSelection(new Set());
  };

  const applyBulkAction = async () => {
    if (!actionType || selectedCount === 0 || selectedActionGenreKeys.length === 0) return;
    setApplying(true);
    const selectedIds = new Set(selectedSongIds);
    const now = Date.now();
    let changedCount = 0;
    const nextSongs = songs.map((song) => {
      if (!selectedIds.has(song.id)) return song;
      const currentKeys = getSongGenreKeys(song);
      const nextKeys = getNextGenreKeys(currentKeys, selectedActionGenreKeys, actionType);
      if (areGenreListsEqual(currentKeys, nextKeys)) return song;
      changedCount += 1;
      return {
        ...song,
        genres: nextKeys.length ? nextKeys : undefined,
        genre: nextKeys.length ? nextKeys.map((genre) => getGenreDisplayName(genre, registeredGenres)).join(', ') : undefined,
        updatedAt: now,
      };
    });

    await db.saveSongs(nextSongs);
    setSongs(nextSongs);
    setSelectedSongIds(new Set());
    setShowSelectedOnly(false);
    setStatusMessage(`${changedCount} ${changedCount === 1 ? 'musica atualizada' : 'musicas atualizadas'}.`);
    setApplying(false);
    closeActionModal();
  };

  const renderGenreChips = (song: Song) => {
    const genreKeys = getSongGenreKeys(song);
    if (!genreKeys.length) {
      return <Text style={localStyles.noGenreText}>Sem genero</Text>;
    }
    return (
      <View style={localStyles.genreChipRow}>
        {genreKeys.slice(0, 4).map((genre) => (
          <View key={genre} style={[localStyles.songGenreChip, isLightTheme && localStyles.songGenreChipLight]}>
            <Text style={localStyles.songGenreChipText} numberOfLines={1}>
              {getGenreDisplayName(genre, registeredGenres)}
            </Text>
          </View>
        ))}
        {genreKeys.length > 4 ? <Text style={localStyles.moreGenresText}>+{genreKeys.length - 4}</Text> : null}
      </View>
    );
  };

  const renderSongRow = ({ item }: { item: Song }) => {
    const selected = selectedSongIds.has(item.id);
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${selected ? 'Desmarcar' : 'Selecionar'} ${item.title}`}
        activeOpacity={0.84}
        style={[localStyles.songRow, isLightTheme && localStyles.songRowLight, selected && localStyles.songRowSelected]}
        onPress={() => toggleSongSelection(item.id)}
      >
        <View style={[localStyles.checkBox, selected && localStyles.checkBoxSelected]}>
          {selected ? <Check size={14} color="#061016" /> : null}
        </View>
        <View style={localStyles.songTextBlock}>
          <Text style={localStyles.songTitle} numberOfLines={1}>{item.title || 'Sem titulo'}</Text>
          <Text style={localStyles.songArtist} numberOfLines={1}>{getArtistName(item)}</Text>
          {renderGenreChips(item)}
        </View>
      </TouchableOpacity>
    );
  };

  const actionInfo = actionType ? actionCopy[actionType] : null;
  const canApply = !!actionType && selectedCount > 0 && selectedActionGenreKeys.length > 0 && !applying;

  return (
    <View style={localStyles.container}>
      <View style={localStyles.content}>
        <View style={[localStyles.hero, isLightTheme && localStyles.heroLight]}>
          <View style={localStyles.heroIcon}>
            <ListChecks size={28} color="#38bdf8" />
          </View>
          <View style={localStyles.heroText}>
            <Text style={localStyles.heroEyebrow}>Central de classificacao</Text>
            <Text style={localStyles.heroTitle}>Organize generos em massa</Text>
            <Text style={localStyles.heroSubtitle}>
              Classifique varias musicas sem abrir uma por uma. Voce decide; o app apenas acelera.
            </Text>
          </View>
        </View>

        <View style={localStyles.statsRow}>
          <View style={[localStyles.statCard, isLightTheme && localStyles.statCardLight]}>
            <Text style={localStyles.statValue}>{songs.length}</Text>
            <Text style={localStyles.statLabel}>musicas</Text>
          </View>
          <View style={[localStyles.statCard, isLightTheme && localStyles.statCardLight]}>
            <Text style={localStyles.statValue}>{songsWithoutGenreCount}</Text>
            <Text style={localStyles.statLabel}>sem genero</Text>
          </View>
          <View style={[localStyles.statCard, isLightTheme && localStyles.statCardLight]}>
            <Text style={localStyles.statValue}>{allGenreKeys.length}</Text>
            <Text style={localStyles.statLabel}>generos</Text>
          </View>
        </View>

        <View style={[localStyles.filtersCard, isLightTheme && localStyles.filtersCardLight]}>
          <View style={localStyles.filterHeader}>
            <Filter size={17} color="#38bdf8" />
            <Text style={localStyles.sectionTitle}>Filtros</Text>
            <TouchableOpacity style={localStyles.clearFiltersButton} onPress={clearFilters}>
              <RotateCcw size={13} color="var(--app-muted-text)" />
              <Text style={localStyles.clearFiltersText}>Limpar</Text>
            </TouchableOpacity>
          </View>

          <View style={localStyles.inputGrid}>
            <View style={localStyles.inputShell}>
              <Search size={15} color="var(--app-muted-text)" />
              <TextInput
                style={localStyles.input}
                value={titleQuery}
                onChangeText={setTitleQuery}
                placeholder="Buscar titulo..."
                placeholderTextColor="var(--app-subtle-text)"
              />
            </View>
            <View style={localStyles.inputShell}>
              <User size={15} color="var(--app-muted-text)" />
              <TextInput
                style={localStyles.input}
                value={artistQuery}
                onChangeText={setArtistQuery}
                placeholder={`Artista (${artistOptions.length})...`}
                placeholderTextColor="var(--app-subtle-text)"
              />
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.genreFilterRow}>
            <TouchableOpacity
              style={[localStyles.filterChip, genreFilter === ALL_GENRES && localStyles.filterChipActive]}
              onPress={() => setGenreFilter(ALL_GENRES)}
            >
              <Text style={[localStyles.filterChipText, genreFilter === ALL_GENRES && localStyles.filterChipTextActive]}>
                Todos
              </Text>
            </TouchableOpacity>
            {allGenreKeys.map((genre) => {
              const active = genreFilter === genre;
              return (
                <TouchableOpacity
                  key={genre}
                  style={[localStyles.filterChip, active && localStyles.filterChipActive]}
                  onPress={() => setGenreFilter(active ? ALL_GENRES : genre)}
                >
                  <Text style={[localStyles.filterChipText, active && localStyles.filterChipTextActive]} numberOfLines={1}>
                    {getGenreDisplayName(genre, registeredGenres)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={localStyles.toggleRow}>
            <TouchableOpacity
              style={[localStyles.togglePill, noGenreOnly && localStyles.togglePillActive]}
              onPress={() => setNoGenreOnly((current) => !current)}
            >
              <Text style={[localStyles.toggleText, noGenreOnly && localStyles.toggleTextActive]}>Sem genero</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[localStyles.togglePill, showSelectedOnly && localStyles.togglePillActive]}
              onPress={() => setShowSelectedOnly((current) => !current)}
              disabled={selectedCount === 0}
            >
              <Text style={[localStyles.toggleText, showSelectedOnly && localStyles.toggleTextActive]}>
                Apenas selecionadas
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {statusMessage ? <Text style={localStyles.statusMessage}>{statusMessage}</Text> : null}

        <View style={localStyles.selectionRow}>
          <Text style={localStyles.selectionText}>
            {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'} • {filteredSongs.length} no filtro
          </Text>
          <View style={localStyles.selectionActions}>
            <TouchableOpacity style={localStyles.selectionButton} onPress={selectAllFiltered} disabled={!filteredSongs.length}>
              <Text style={localStyles.selectionButtonText}>Selecionar filtradas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={localStyles.selectionButton} onPress={clearSelection} disabled={selectedCount === 0}>
              <Text style={localStyles.selectionButtonText}>Limpar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={filteredSongs}
          keyExtractor={(song: Song) => song.id}
          renderItem={renderSongRow}
          initialNumToRender={18}
          maxToRenderPerBatch={24}
          windowSize={9}
          removeClippedSubviews={false}
          style={localStyles.list}
          contentContainerStyle={localStyles.listContent}
          ListEmptyComponent={
            <View style={localStyles.emptyState}>
              {loading ? (
                <ActivityIndicator color="#38bdf8" />
              ) : (
                <>
                  <Text style={localStyles.emptyTitle}>Nada encontrado</Text>
                  <Text style={localStyles.emptyText}>Ajuste os filtros para encontrar musicas.</Text>
                </>
              )}
            </View>
          }
        />

        {selectedCount > 0 ? (
          <View style={[localStyles.bulkBar, isLightTheme && localStyles.bulkBarLight]}>
            <View style={localStyles.bulkBarText}>
              <Text style={localStyles.bulkBarTitle}>{selectedCount} musicas selecionadas</Text>
              <Text style={localStyles.bulkBarHint}>Escolha como deseja aplicar os generos.</Text>
            </View>
            <View style={localStyles.bulkButtons}>
              <TouchableOpacity style={localStyles.bulkButton} onPress={() => openAction('add')}>
                <Plus size={15} color="#061016" />
                <Text style={localStyles.bulkButtonText}>Adicionar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[localStyles.bulkButton, localStyles.bulkButtonWarn]} onPress={() => openAction('remove')}>
                <Trash2 size={15} color="#201300" />
                <Text style={localStyles.bulkButtonText}>Remover</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[localStyles.bulkButton, localStyles.bulkButtonDanger]} onPress={() => openAction('replace')}>
                <Tags size={15} color="#fff" />
                <Text style={[localStyles.bulkButtonText, localStyles.bulkButtonTextLight]}>Substituir</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>

      <AppModal
        visible={!!actionType}
        title={actionInfo?.title || 'Aplicar generos'}
        onClose={closeActionModal}
        icon={actionType === 'replace' ? <AlertTriangle size={16} color="#ef4444" /> : <Tags size={16} color="var(--app-accent)" />}
        maxWidth={640}
        footer={(
          <>
            <TouchableOpacity style={localStyles.modalGhostButton} onPress={closeActionModal} disabled={applying}>
              <Text style={localStyles.modalGhostText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[localStyles.modalPrimaryButton, actionType === 'replace' && localStyles.modalDangerButton, !canApply && localStyles.modalDisabledButton]}
              onPress={() => void applyBulkAction()}
              disabled={!canApply}
            >
              {applying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[localStyles.modalPrimaryText, actionType === 'replace' && localStyles.modalPrimaryTextDanger]}>
                  {actionInfo?.button || 'Aplicar'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      >
        <Text style={localStyles.modalHint}>{actionInfo?.description}</Text>
        {actionType === 'replace' ? (
          <View style={localStyles.warningBox}>
            <AlertTriangle size={16} color="#ef4444" />
            <Text style={localStyles.warningText}>
              Esta acao remove todos os generos atuais das musicas selecionadas antes de aplicar os novos.
            </Text>
          </View>
        ) : null}

        <Text style={localStyles.modalSubhead}>Escolha os generos</Text>
        <ScrollView style={localStyles.modalGenreScroll} contentContainerStyle={localStyles.modalGenreGrid}>
          {allGenreKeys.length ? (
            allGenreKeys.map((genre) => {
              const selected = actionGenreSelection.has(genre);
              return (
                <TouchableOpacity
                  key={genre}
                  style={[localStyles.modalGenreCell, selected && localStyles.modalGenreCellActive]}
                  onPress={() => toggleActionGenre(genre)}
                >
                  <View style={[localStyles.smallCheckBox, selected && localStyles.checkBoxSelected]}>
                    {selected ? <Check size={12} color="#061016" /> : null}
                  </View>
                  <Text style={[localStyles.modalGenreText, selected && localStyles.modalGenreTextActive]} numberOfLines={1}>
                    {getGenreDisplayName(genre, registeredGenres)}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={localStyles.emptyText}>Nenhum genero disponivel. Cadastre generos em Configuracoes.</Text>
          )}
        </ScrollView>

        <View style={localStyles.previewBox}>
          <Text style={localStyles.previewTitle}>Preview</Text>
          <Text style={localStyles.previewText}>{selectedCount} musicas selecionadas.</Text>
          <Text style={localStyles.previewText}>
            {affectedCount} {affectedCount === 1 ? 'tera alteracao' : 'terao alteracao'}.
          </Text>
          {selectedActionGenreKeys.length ? (
            <View style={localStyles.previewGenreList}>
              {selectedActionGenreKeys.map((genre) => (
                <Text key={genre} style={localStyles.previewGenreText}>
                  - {getGenreDisplayName(genre, registeredGenres)}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={localStyles.previewMuted}>Nenhuma alteracao ainda realizada.</Text>
          )}
        </View>
      </AppModal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'var(--app-bg)',
  },
  content: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  hero: {
    minHeight: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.24)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(14,165,233,0.16) 0%, rgba(15,23,42,0.10) 100%)',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    boxShadow: '0 16px 30px rgba(0,0,0,0.14)',
  },
  heroLight: {
    borderColor: 'rgba(15,131,201,0.16)',
    backgroundColor: '#fffdf8',
    backgroundImage: 'linear-gradient(135deg, rgba(15,131,201,0.08) 0%, rgba(255,253,248,0.96) 100%)',
    boxShadow: '0 14px 26px rgba(31,41,55,0.07)',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.30)',
    flexShrink: 0,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: 'var(--app-text)',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    marginTop: 3,
  },
  heroSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minHeight: 64,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'var(--app-surface)',
    padding: 11,
    justifyContent: 'center',
  },
  statCardLight: {
    backgroundColor: '#fffdf8',
    borderColor: 'rgba(15,131,201,0.12)',
    boxShadow: '0 10px 20px rgba(31,41,55,0.06)',
  },
  statValue: {
    color: 'var(--app-text)',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },
  statLabel: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    marginTop: 2,
  },
  filtersCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'var(--app-surface)',
    padding: 12,
    gap: 10,
  },
  filtersCardLight: {
    backgroundColor: '#fffdf8',
    borderColor: 'rgba(15,131,201,0.12)',
    boxShadow: '0 10px 20px rgba(31,41,55,0.055)',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  clearFiltersText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '800',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inputShell: {
    flex: 1,
    minWidth: 220,
    minHeight: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: 'var(--app-text)',
    fontSize: 14,
    outlineStyle: 'none' as any,
  },
  genreFilterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  filterChipActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  filterChipText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: 'var(--app-text)',
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  togglePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  togglePillActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(14,165,233,0.14)',
  },
  toggleText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '800',
  },
  toggleTextActive: {
    color: 'var(--app-text)',
  },
  statusMessage: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '800',
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  selectionText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  selectionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  selectionButtonText: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    gap: 8,
    paddingBottom: 10,
  },
  songRow: {
    minHeight: 76,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'var(--app-surface)',
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  songRowLight: {
    backgroundColor: '#fffdf8',
    borderColor: 'rgba(15,131,201,0.10)',
  },
  songRowSelected: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  smallCheckBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkBoxSelected: {
    borderColor: '#38bdf8',
    backgroundColor: '#38bdf8',
  },
  songTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  songTitle: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '900',
  },
  songArtist: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    marginTop: 3,
  },
  genreChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  songGenreChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.20)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  songGenreChipLight: {
    backgroundColor: 'rgba(15,131,201,0.08)',
    borderColor: 'rgba(15,131,201,0.14)',
  },
  songGenreChipText: {
    color: 'var(--app-text)',
    fontSize: 11,
    fontWeight: '800',
  },
  noGenreText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 7,
  },
  moreGenresText: {
    color: 'var(--app-muted-text)',
    fontSize: 11,
    fontWeight: '800',
    alignSelf: 'center',
  },
  emptyState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 19,
  },
  bulkBar: {
    flexShrink: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.26)',
    backgroundColor: 'var(--app-header)',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bulkBarLight: {
    backgroundColor: '#fffdf8',
    borderColor: 'rgba(15,131,201,0.16)',
    boxShadow: '0 12px 24px rgba(31,41,55,0.09)',
  },
  bulkBarText: {
    flex: 1,
    minWidth: 170,
  },
  bulkBarTitle: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
  },
  bulkBarHint: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    marginTop: 2,
  },
  bulkButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bulkButton: {
    minHeight: 36,
    borderRadius: 9,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bulkButtonWarn: {
    backgroundColor: '#facc15',
  },
  bulkButtonDanger: {
    backgroundColor: '#ef4444',
  },
  bulkButtonText: {
    color: '#061016',
    fontSize: 12,
    fontWeight: '900',
  },
  bulkButtonTextLight: {
    color: '#fff',
  },
  modalHint: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 19,
  },
  warningBox: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
    backgroundColor: 'rgba(239,68,68,0.10)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: 'var(--app-text)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  modalSubhead: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 14,
    marginBottom: 8,
  },
  modalGenreScroll: {
    maxHeight: 250,
  },
  modalGenreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  modalGenreCell: {
    width: '48%',
    minWidth: 160,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  modalGenreCellActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(14,165,233,0.14)',
  },
  modalGenreText: {
    flex: 1,
    minWidth: 0,
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  modalGenreTextActive: {
    color: 'var(--app-text)',
  },
  previewBox: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 11,
  },
  previewTitle: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
  },
  previewText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    marginTop: 4,
  },
  previewMuted: {
    color: 'var(--app-subtle-text)',
    fontSize: 12,
    marginTop: 8,
  },
  previewGenreList: {
    marginTop: 8,
    gap: 3,
  },
  previewGenreText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  modalGhostButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalGhostText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  modalPrimaryButton: {
    minWidth: 96,
    borderRadius: 999,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalDangerButton: {
    backgroundColor: '#ef4444',
  },
  modalDisabledButton: {
    opacity: 0.45,
  },
  modalPrimaryText: {
    color: '#061016',
    fontSize: 13,
    fontWeight: '900',
  },
  modalPrimaryTextDanger: {
    color: '#fff',
  },
});
