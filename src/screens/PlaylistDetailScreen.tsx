import React, { useEffect, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ArrowDown, ArrowUp, ChevronRight, GripHorizontal, ListMusic, Music, Music2, Plus, Search, Trash2 } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { useConfirmDestructiveAction } from '../components/ConfirmDialog';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useTopBarControls } from '../contexts/TopBarContext';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import type { Playlist, Song } from '../types/models';
import { matchesGenreFilter } from '../utils/genres';

interface PlaylistDetailScreenProps {
  playlistId: string;
  playlistName?: string;
  folderId?: string | null;
  folderName?: string;
  openAddOnEnter?: boolean;
  styles: any;
}

type SectionColorKey = 'blue' | 'green' | 'gold' | 'purple' | 'red' | 'gray';

const SECTION_COLOR_VALUES: Record<SectionColorKey, string> = {
  blue: '#4FC3F7',
  green: '#22c55e',
  gold: '#ffd166',
  purple: '#a78bfa',
  red: '#ff6b6b',
  gray: '#9ca3af',
};

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const normalizeHexColor = (color: string) => {
  const value = color.trim();
  if (!HEX_COLOR_RE.test(value)) return null;
  if (value.length === 4) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return value.toUpperCase();
};

const getSectionColor = (color?: string) =>
  color && color in SECTION_COLOR_VALUES
    ? SECTION_COLOR_VALUES[color as SectionColorKey]
    : color
      ? normalizeHexColor(color) || undefined
      : undefined;

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return undefined;
  const raw = normalized.slice(1);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getSectionSoftBackground = (color?: string) => {
  const resolved = getSectionColor(color);
  return resolved ? hexToRgba(resolved, 0.14) : undefined;
};

const toggleId = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];

export function PlaylistDetailScreen({
  playlistId,
  playlistName,
  folderId,
  folderName,
  openAddOnEnter,
  styles,
}: PlaylistDetailScreenProps) {
  const nav = useManualNavigation();
  const { setTopBarControls, clearTopBarControls } = useTopBarControls();
  const { globalFilters } = useGenreFilter();
  const songReturnTo: ManualRoute = React.useMemo(
    () => ({ name: 'PlaylistDetail', params: { playlistId, playlistName, folderId, folderName } }),
    [folderId, folderName, playlistId, playlistName]
  );
  const confirmDestructiveAction = useConfirmDestructiveAction();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [openPlaylistActions, setOpenPlaylistActions] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [openOrder, setOpenOrder] = useState(false);
  const [selectedPlaylistSong, setSelectedPlaylistSong] = useState<Song | null>(null);
  const [draftOrderIds, setDraftOrderIds] = useState<string[]>([]);
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [multiSelectSongs, setMultiSelectSongs] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [playlistSearchOpen, setPlaylistSearchOpen] = useState(false);
  const openedAddOnEnterRef = React.useRef(false);
  const load = async () => {
    const p = await db.byPlaylist(playlistId);
    const all = await db.getSongs();
    const byId = new Map(all.map((song) => [song.id, song]));
    const orderedSongs = p
      ? p.songIds
          .map((songId) => byId.get(songId))
          .filter((song): song is Song => !!song && matchesGenreFilter(song, globalFilters.selectedGenres))
      : [];
    setPlaylist(p);
    setAllSongs(all);
    setSongs(orderedSongs);
  };
  useEffect(() => { load(); }, [playlistId, globalFilters.selectedGenres]);
  const allSongsById = React.useMemo(() => new Map(allSongs.map((song) => [song.id, song])), [allSongs]);
  const orderedDraftSongs = draftOrderIds
    .map((songId) => allSongsById.get(songId))
    .filter((song): song is Song => !!song);
  const playlistSongCount = playlist?.songIds.length || 0;
  const playlistSongIds = React.useMemo(() => new Set(playlist?.songIds || []), [playlist?.songIds]);
  const useScriptMode = playlist?.viewMode === 'script' && (playlist.sections?.length || 0) > 0;
  const scriptSectionSongIds = React.useMemo(
    () => new Set((playlist?.sections || []).flatMap((section) => section.songIds)),
    [playlist?.sections]
  );
  const scriptSections = (playlist?.sections || []).map((section) => ({
    ...section,
    songs: section.songIds
      .map((songId) => allSongsById.get(songId))
      .filter((song): song is Song => !!song && playlistSongIds.has(song.id) && matchesGenreFilter(song, globalFilters.selectedGenres)),
  }));
  const unsectionedScriptSongs = songs.filter((song) => !scriptSectionSongIds.has(song.id));
  const playlistSearchQuery = playlistSearch.trim().toLowerCase();
  const matchesPlaylistSearch = (song: Song) => {
    if (!playlistSearchQuery) return true;
    return (
      song.title.toLowerCase().includes(playlistSearchQuery) ||
      song.artist.toLowerCase().includes(playlistSearchQuery)
    );
  };
  const visibleSongs = songs.filter(matchesPlaylistSearch);
  const visibleScriptSections = scriptSections
    .map((section) => ({
      ...section,
      songs: section.songs.filter(matchesPlaylistSearch),
    }))
    .filter((section) => !playlistSearchQuery || section.songs.length > 0);
  const visibleUnsectionedScriptSongs = unsectionedScriptSongs.filter(matchesPlaylistSearch);
  const available = allSongs
    .filter((s) => !playlist?.songIds.includes(s.id))
    .filter((s) => matchesGenreFilter(s, globalFilters.selectedGenres))
    .filter((s) =>
      !q.trim()
        ? true
        : s.title.toLowerCase().includes(q.toLowerCase()) ||
          s.artist.toLowerCase().includes(q.toLowerCase())
    );
  const addableSongs = allSongs
    .filter((s) => !playlist?.songIds.includes(s.id))
    .filter((s) => matchesGenreFilter(s, globalFilters.selectedGenres));
  const selectedSongIdSet = React.useMemo(() => new Set(selectedSongIds), [selectedSongIds]);
  const renderSelectionToggle = (active: boolean, count: number, onPress: () => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, marginBottom: 10 }}>
      <TouchableOpacity
        style={{
          borderWidth: 1,
          borderColor: active ? '#4FC3F7' : 'var(--app-border-soft)',
          backgroundColor: active ? 'rgba(79,195,247,0.14)' : 'var(--app-surface-alt)',
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 7,
        }}
        onPress={onPress}
      >
        <Text style={{ color: active ? '#4FC3F7' : 'var(--app-muted-text)', fontWeight: '800', fontSize: 12 }}>
          {active ? 'Cancelar seleção' : 'Marcar várias'}
        </Text>
      </TouchableOpacity>
      {active ? (
        <Text style={[styles.subtitle, { flexShrink: 0 }]}>
          {count} {count === 1 ? 'selecionado' : 'selecionados'}
        </Text>
      ) : null}
    </View>
  );
  const renderSelectionCheck = (selected: boolean) => (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: selected ? '#4FC3F7' : 'var(--app-border-soft)',
        backgroundColor: selected ? '#4FC3F7' : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {selected ? <Text style={{ color: '#021018', fontSize: 13, fontWeight: '900', lineHeight: 16 }}>✓</Text> : null}
    </View>
  );
  const closeAddMusicModal = () => {
    setOpenAdd(false);
    setMultiSelectSongs(false);
    setSelectedSongIds([]);
  };
  const addSelectedSongsToPlaylist = async () => {
    const validSongs = addableSongs.filter((song) => selectedSongIdSet.has(song.id));
    if (!validSongs.length) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        const existingIds = new Set(playlist.songIds);
        const idsToAdd = validSongs.map((song) => song.id).filter((songId) => !existingIds.has(songId));
        if (!idsToAdd.length) return playlist;
        return { ...playlist, songIds: [...playlist.songIds, ...idsToAdd] };
      })
    );
    closeAddMusicModal();
    load();
  };
  const selectedSongSection = selectedPlaylistSong && playlist
    ? playlist.sections?.find((section) => section.songIds.includes(selectedPlaylistSong.id))
    : undefined;
  const selectedSongIndex = selectedPlaylistSong && playlist
    ? selectedSongSection
      ? selectedSongSection.songIds.indexOf(selectedPlaylistSong.id)
      : playlist.songIds.indexOf(selectedPlaylistSong.id)
    : -1;
  const selectedSongListLength = selectedSongSection?.songIds.length ?? playlist?.songIds.length ?? 0;
  const canMoveSelectedSongUp = selectedSongIndex > 0;
  const canMoveSelectedSongDown = selectedSongIndex >= 0 && selectedSongIndex < selectedSongListLength - 1;
  const openSongFromPlaylistModal = () => {
    if (!selectedPlaylistSong) return;
    const targetSong = selectedPlaylistSong;
    setSelectedPlaylistSong(null);
    nav.navigate('SongDetail', {
      id: targetSong.id,
      returnTo: songReturnTo,
      sourcePlaylistId: playlistId,
      sourcePlaylistName: playlist?.name,
    });
  };
  const moveSongInCurrentPlaylist = async (song: Song, delta: number) => {
    if (!playlist) return;
    const currentSection = playlist.sections?.find((section) => section.songIds.includes(song.id));
    const currentIds = currentSection?.songIds ?? playlist.songIds;
    const index = currentIds.indexOf(song.id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= currentIds.length) return;
    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(index, 1);
    nextIds.splice(nextIndex, 0, moved);
    const nextPlaylist = currentSection
      ? {
          ...playlist,
          sections: playlist.sections?.map((section) =>
            section.id === currentSection.id ? { ...section, songIds: nextIds } : section
          ),
        }
      : { ...playlist, songIds: nextIds };
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((pl) => (pl.id === playlistId ? nextPlaylist : pl))
    );
    setPlaylist(nextPlaylist);
    load();
  };
  const removeSongFromCurrentPlaylist = async (song: Song) => {
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja remover "${song.title}" desta lista?`,
      'Remover música',
      'Remover'
    );
    if (!confirmed) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((pl) =>
        pl.id === playlistId
          ? {
              ...pl,
              songIds: pl.songIds.filter((songId) => songId !== song.id),
              sections: pl.sections?.map((section) => ({
                ...section,
                songIds: section.songIds.filter((songId) => songId !== song.id),
              })),
            }
          : pl
      )
    );
    setSelectedPlaylistSong(null);
    load();
  };
  const removeSelectedPlaylistSong = async () => {
    if (!selectedPlaylistSong) return;
    await removeSongFromCurrentPlaylist(selectedPlaylistSong);
  };
  const openAddMusic = () => {
    setOpenPlaylistActions(false);
    setQ('');
    setMultiSelectSongs(false);
    setSelectedSongIds([]);
    setOpenAdd(true);
  };
  useEffect(() => {
    if (!openAddOnEnter || openedAddOnEnterRef.current) return;
    openedAddOnEnterRef.current = true;
    openAddMusic();
  }, [openAddOnEnter]);
  const openStructureScreen = () => {
    setOpenPlaylistActions(false);
    nav.navigate('PlaylistStructure', {
      playlistId,
      playlistName: playlist?.name || playlistName,
      folderId,
      folderName,
    });
  };
  const moveDraftSong = (fromIndex: number, toIndex: number) => {
    setDraftOrderIds((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };
  const moveDraftSongById = (songId: string, delta: number) => {
    const fromIndex = draftOrderIds.indexOf(songId);
    moveDraftSong(fromIndex, fromIndex + delta);
  };
  const savePlaylistOrder = async () => {
    if (!playlist) return;
    const orderedSet = new Set(draftOrderIds);
    const hiddenOrMissingSongIds = playlist.songIds.filter((songId) => !orderedSet.has(songId));
    const nextSongIds = [...draftOrderIds, ...hiddenOrMissingSongIds];
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((pl) => (pl.id === playlistId ? { ...pl, songIds: nextSongIds } : pl))
    );
    setOpenOrder(false);
    setDraggedSongId(null);
    load();
  };
  useEffect(() => {
    setTopBarControls({
      showSearch: true,
      searchActive: playlistSearchOpen,
      onSearchPress: () => {
        const next = !playlistSearchOpen;
        setPlaylistSearchOpen(next);
        if (!next) setPlaylistSearch('');
      },
      showAdd: true,
      onAddPress: () => setOpenPlaylistActions(true),
    });
    return clearTopBarControls;
  }, [clearTopBarControls, playlistSearchOpen, setTopBarControls]);

  return (
    <View style={styles.container}>
      {playlistSearchOpen ? (
        <View style={styles.search}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar nesta lista..."
            placeholderTextColor="#666"
            value={playlistSearch}
            onChangeText={setPlaylistSearch}
            autoFocus
          />
        </View>
      ) : null}
      <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Músicas na lista</Text>
      {useScriptMode ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
          {visibleScriptSections.map((section) => {
            const sectionColor = getSectionColor(section.color);
            const sectionBackground = getSectionSoftBackground(section.color);
            return (
              <View
                key={section.id}
                style={[
                  localStyles.scriptSectionBlock,
                  sectionBackground
                    ? { backgroundColor: sectionBackground, borderColor: sectionColor }
                    : null,
                ]}
              >
                <View style={localStyles.scriptSectionHeader}>
                  <View
                    style={[
                      localStyles.scriptSectionMarker,
                      {
                        backgroundColor: sectionColor || 'transparent',
                        borderColor: sectionColor || 'var(--app-border-soft)',
                      },
                    ]}
                  />
                  <Text style={styles.settingsModalSubhead}>
                    {section.title || 'Sem título'}
                  </Text>
                </View>
                {section.songs.length ? (
                  section.songs.map((item) => (
                    <View key={`${section.id}-${item.id}`} style={styles.listRow}>
                      <TouchableOpacity
                        style={styles.cardMainPress}
                        onPress={() => nav.navigate('SongDetail', {
                          id: item.id,
                          returnTo: songReturnTo,
                          sourcePlaylistId: playlistId,
                          sourcePlaylistName: playlist?.name,
                        })}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Music size={16} color="#4FC3F7" />
                          <View style={styles.listRowText}>
                            <Text style={styles.title}>{item.title}</Text>
                            <Text style={styles.subtitle}>{item.artist}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.listActionBtn} onPress={() => setSelectedPlaylistSong(item)}>
                        <ChevronRight size={18} color="#4FC3F7" />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.subtitle, { marginBottom: 8 }]}>Nenhuma música nesta seção.</Text>
                )}
              </View>
            );
          })}
          {visibleUnsectionedScriptSongs.length ? (
            <View>
              <Text style={[styles.settingsModalSubhead, { marginHorizontal: 12, marginTop: 10 }]}>Sem seção</Text>
              {visibleUnsectionedScriptSongs.map((item) => (
                <View key={`unsectioned-${item.id}`} style={styles.listRow}>
                  <TouchableOpacity
                    style={styles.cardMainPress}
                    onPress={() => nav.navigate('SongDetail', {
                      id: item.id,
                      returnTo: songReturnTo,
                      sourcePlaylistId: playlistId,
                      sourcePlaylistName: playlist?.name,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Music size={16} color="#4FC3F7" />
                      <View style={styles.listRowText}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.subtitle}>{item.artist}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.listActionBtn} onPress={() => setSelectedPlaylistSong(item)}>
                    <ChevronRight size={18} color="#4FC3F7" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          {playlistSearchQuery && !visibleScriptSections.length && !visibleUnsectionedScriptSongs.length ? (
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginTop: 12 }]}>Nada encontrado nesta lista.</Text>
          ) : null}
        </ScrollView>
      ) : (
        <FlatList
          data={visibleSongs}
          keyExtractor={(i: Song) => i.id}
          initialNumToRender={Math.max(10, visibleSongs.length)}
          maxToRenderPerBatch={Math.max(10, visibleSongs.length)}
          removeClippedSubviews={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          ListEmptyComponent={<Text style={[styles.subtitle, { marginHorizontal: 12 }]}>Nada encontrado nesta lista.</Text>}
          renderItem={({ item }: { item: Song }) => (
            <View style={styles.listRow}>
              <TouchableOpacity
                style={styles.cardMainPress}
                onPress={() => nav.navigate('SongDetail', {
                  id: item.id,
                  returnTo: songReturnTo,
                  sourcePlaylistId: playlistId,
                  sourcePlaylistName: playlist?.name,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Music size={16} color="#4FC3F7" />
                  <View style={styles.listRowText}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.subtitle}>{item.artist}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listActionBtn} onPress={() => setSelectedPlaylistSong(item)}>
                <ChevronRight size={18} color="#4FC3F7" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <AppModal
        visible={!!selectedPlaylistSong}
        title="Música na lista"
        onClose={() => setSelectedPlaylistSong(null)}
        icon={<Music size={16} color="var(--app-accent)" />}
        maxWidth={520}
        footer={
          <TouchableOpacity onPress={() => setSelectedPlaylistSong(null)}>
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>
          {selectedPlaylistSong
            ? `${selectedPlaylistSong.title}${selectedPlaylistSong.artist ? ` - ${selectedPlaylistSong.artist}` : ''}`
            : ''}
        </Text>
        <TouchableOpacity
          style={[styles.modalActionBtn, !canMoveSelectedSongUp && localStyles.disabledAction]}
          disabled={!canMoveSelectedSongUp}
          onPress={() => selectedPlaylistSong && moveSongInCurrentPlaylist(selectedPlaylistSong, -1)}
        >
          <View style={styles.createOptionLeft}>
            <ArrowUp size={17} color={canMoveSelectedSongUp ? '#4FC3F7' : '#666'} />
            <Text style={[styles.modalActionText, !canMoveSelectedSongUp && localStyles.disabledActionText]}>
              Subir música
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalActionBtn, !canMoveSelectedSongDown && localStyles.disabledAction]}
          disabled={!canMoveSelectedSongDown}
          onPress={() => selectedPlaylistSong && moveSongInCurrentPlaylist(selectedPlaylistSong, 1)}
        >
          <View style={styles.createOptionLeft}>
            <ArrowDown size={17} color={canMoveSelectedSongDown ? '#4FC3F7' : '#666'} />
            <Text style={[styles.modalActionText, !canMoveSelectedSongDown && localStyles.disabledActionText]}>
              Descer música
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalActionBtn} onPress={openSongFromPlaylistModal}>
          <View style={styles.createOptionLeft}>
            <Music size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Abrir música</Text>
          </View>         
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalActionBtn, styles.modalDangerBtn]}
          onPress={removeSelectedPlaylistSong}
        >
          <View style={styles.createOptionLeft}>
            <Trash2 size={17} color="#ff7a7a" />
            <Text style={styles.modalDangerText}>Excluir da lista</Text>
          </View>
        </TouchableOpacity>
      </AppModal>

      <AppModal
        visible={openPlaylistActions}
        title="Opções da lista"
        onClose={() => setOpenPlaylistActions(false)}
        icon={<ListMusic size={16} color="var(--app-accent)" />}
        maxWidth={520}
        footer={
          <TouchableOpacity onPress={() => setOpenPlaylistActions(false)}>
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.settingsControlHint}>
          {playlistSongCount} {playlistSongCount === 1 ? 'música nesta lista' : 'músicas nesta lista'}
        </Text>
        <TouchableOpacity style={[styles.settingsInlineAction, { marginTop: 12 }]} onPress={openAddMusic}>
          <View>
            <Text style={styles.settingsControlTitle}>Adicionar música</Text>
            <Text style={styles.settingsControlHint}>Escolha músicas para incluir na lista.</Text>
          </View>
          <Plus size={19} color="#4FC3F7" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsInlineAction} onPress={openStructureScreen}>
          <View>
            <Text style={styles.settingsControlTitle}>Organizar lista</Text>
            <Text style={styles.settingsControlHint}>Escolha modo padrão ou roteiro com seções.</Text>
          </View>
          <GripHorizontal size={19} color="#4FC3F7" />
        </TouchableOpacity>
      </AppModal>

      <AppModal
        visible={openAdd}
        title="Adicionar músicas"
        onClose={closeAddMusicModal}
        icon={<Music2 size={16} color="#4FC3F7" />}
        maxWidth={520}
        footer={
          <>
            <TouchableOpacity onPress={closeAddMusicModal}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
            </TouchableOpacity>
            {multiSelectSongs && selectedSongIds.length ? (
              <TouchableOpacity onPress={addSelectedSongsToPlaylist}>
                <Text style={{ color: '#4FC3F7', fontWeight: '900' }}>Adicionar selecionados</Text>
              </TouchableOpacity>
            ) : null}
          </>
        }
      >
        {renderSelectionToggle(multiSelectSongs, selectedSongIds.length, () => {
          const next = !multiSelectSongs;
          setMultiSelectSongs(next);
          if (!next) setSelectedSongIds([]);
        })}
        <View style={[styles.search, { marginHorizontal: 0, marginBottom: 10 }]}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar música..."
            placeholderTextColor="#666"
            value={q}
            onChangeText={setQ}
            autoFocus
          />
        </View>
        <ScrollView style={{ marginTop: 4, maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 10 }}>
          {available.length ? (
            available.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.modalActionBtn,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
                ]}
                onPress={async () => {
                  if (multiSelectSongs) {
                    setSelectedSongIds((ids) => toggleId(ids, s.id));
                    return;
                  }
                  await db.addSongToPlaylist(playlistId, s.id);
                  load();
                }}
              >
                <View style={[styles.createOptionLeft, { flex: 1, minWidth: 0 }]}>
                  <Music2 size={17} color="#4FC3F7" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.modalActionText}>{s.title}</Text>
                    <Text style={styles.subtitle}>{s.artist}</Text>
                  </View>
                </View>
                {multiSelectSongs ? (
                  renderSelectionCheck(selectedSongIdSet.has(s.id))
                ) : (
                  <View style={{ width: 22, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
                    <Plus size={18} color="#4FC3F7" />
                  </View>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[styles.subtitle, { marginTop: 6 }]}>Nada encontrado.</Text>
          )}
        </ScrollView>
      </AppModal>

      <Modal visible={openOrder} transparent animationType="fade" onRequestClose={() => setOpenOrder(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.orderModal, styles.settingsModalLarge]}>
            <View style={styles.settingsModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsModalTitle}>Ordenar lista</Text>
                <Text style={styles.settingsControlHint} numberOfLines={1}>
                  {playlist?.name || 'Lista'} • {playlistSongCount} {playlistSongCount === 1 ? 'música' : 'músicas'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setOpenOrder(false)}>
                <Text style={styles.settingsCloseText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.orderHintBox}>
              <GripHorizontal size={16} color="#4FC3F7" />
              <Text style={styles.orderHintText}>Arraste as músicas ou use as setas para mudar a ordem.</Text>
            </View>
            <ScrollView style={styles.orderScroll} contentContainerStyle={{ paddingBottom: 12 }}>
              {orderedDraftSongs.length ? (
                orderedDraftSongs.map((song, index) => {
                  const isFirst = index === 0;
                  const isLast = index === orderedDraftSongs.length - 1;
                  return (
                    <div
                      key={song.id}
                      style={{
                        ...(styles.orderRow as React.CSSProperties),
                        opacity: draggedSongId === song.id ? 0.55 : 1,
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const draggedId = draggedSongId || event.dataTransfer.getData('text/plain');
                        if (!draggedId || draggedId === song.id) return;
                        moveDraftSong(draftOrderIds.indexOf(draggedId), draftOrderIds.indexOf(song.id));
                        setDraggedSongId(null);
                      }}
                    >
                      <Text style={styles.orderIndex}>{index + 1}</Text>
                      <View style={styles.orderSongInfo}>
                        <Text style={styles.orderSongTitle} numberOfLines={1}>{song.title}</Text>
                        <Text style={styles.orderSongArtist} numberOfLines={1}>
                          {(song.artist || '').trim() || 'Sem artista'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.orderIconButton, isFirst && styles.orderIconButtonDisabled]}
                        onPress={() => moveDraftSongById(song.id, -1)}
                        disabled={isFirst}
                      >
                        <ArrowUp size={15} color={isFirst ? '#4b5563' : '#4FC3F7'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.orderIconButton, isLast && styles.orderIconButtonDisabled]}
                        onPress={() => moveDraftSongById(song.id, 1)}
                        disabled={isLast}
                      >
                        <ArrowDown size={15} color={isLast ? '#4b5563' : '#4FC3F7'} />
                      </TouchableOpacity>
                      <div
                        draggable
                        style={styles.orderDragHandle as React.CSSProperties}
                        onDragStart={(event) => {
                          setDraggedSongId(song.id);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', song.id);
                        }}
                        onDragEnd={() => setDraggedSongId(null)}
                      >
                        <GripHorizontal size={18} color="#4FC3F7" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <Text style={styles.settingsEmptyText}>Adicione músicas antes de ordenar a lista.</Text>
              )}
            </ScrollView>
            <View style={styles.settingsModalActions}>
              <TouchableOpacity
                style={styles.modalGhostBtn}
                onPress={() => {
                  setOpenOrder(false);
                  setDraggedSongId(null);
                }}
              >
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={savePlaylistOrder}>
                <Text style={styles.modalPrimaryText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  scriptSectionBlock: {
    borderRadius: 1,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    marginHorizontal: 5,
    marginTop: 10,
    padding: 10,
  },
  scriptSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scriptSectionMarker: {
    width: 8,
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
  },
  disabledAction: {
    opacity: 0.48,
  },
  disabledActionText: {
    color: '#777',
  },
});
