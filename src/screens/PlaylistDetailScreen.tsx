import React, { useEffect, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ArrowDown, ArrowUp, ChevronRight, Copy, FileText, GripHorizontal, ListMusic, Music, Music2, Pencil, Plus, Search, Share2, Star, StarOff, Trash2 } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { useConfirmDestructiveAction } from '../components/ConfirmDialog';
import { PlaylistPickerModal } from '../components/modals/PlaylistPickerModal';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTopBarControls } from '../contexts/TopBarContext';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import { buildPlaylistZip, sanitizeFileName, shareBlobFile } from '../services/share';
import type { Folder, Playlist, PlaylistItem, PlaylistSection, QuickPdfId, QuickPdfLink, Song } from '../types/models';
import { matchesGenreFilter } from '../utils/genres';
import { createDuplicatedPlaylist, insertPlaylistAfterSource } from '../utils/playlistDuplication';
import {
  deriveScriptPlaylistOrder,
  getPlaylistItems,
  getPlaylistSectionItemIds,
  getPlaylistSectionItems,
  makePdfPlaylistItem,
  makeSongPlaylistItem,
  QUICK_PDF_LABELS,
  reorderPlaylistItemsBySongIds,
  setPlaylistSongHighlighted,
  syncPlaylistSectionItemIds,
} from '../utils/playlistItems';
import { getQuickPdfSourceLabel, hasQuickPdfSource } from '../utils/quickPdfs';
import { sortStarredItems, toggleStarredPlaylist } from '../utils/starredItems';
import { useDevScreenPerformance } from '../utils/devPerformance';

interface PlaylistDetailScreenProps {
  playlistId: string;
  playlistName?: string;
  folderId?: string | null;
  folderName?: string;
  openAddOnEnter?: boolean;
  styles: any;
  sessionState: {
    query: string;
    searchOn: boolean;
    scrollOffset: number;
  };
}

type SectionColorKey = 'blue' | 'green' | 'gold' | 'purple' | 'red' | 'gray';

type PlaylistDisplayRow =
  | { key: string; type: 'song'; item: Extract<PlaylistItem, { type: 'song' }>; song: Song }
  | { key: string; type: 'pdf'; item: Extract<PlaylistItem, { type: 'pdf' }>; pdf?: QuickPdfLink };

type AddMusicSourceFilter = 'all' | 'outsideCurrent' | 'playlist';

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

const syncSectionWithItemIds = (
  section: PlaylistSection,
  itemIds: string[],
  playlistItems: PlaylistItem[],
): PlaylistSection => syncPlaylistSectionItemIds({ ...section, itemIds }, playlistItems, itemIds);

export function PlaylistDetailScreen({
  playlistId,
  playlistName,
  folderId,
  folderName,
  openAddOnEnter,
  styles,
  sessionState,
}: PlaylistDetailScreenProps) {
  useDevScreenPerformance('PlaylistDetail');
  const nav = useManualNavigation();
  const { setTopBarControls, clearTopBarControls } = useTopBarControls();
  const { globalFilters } = useGenreFilter();
  const { favoriteMode } = useSettings();
  const songReturnTo: ManualRoute = React.useMemo(
    () => ({ name: 'PlaylistDetail', params: { playlistId, playlistName, folderId, folderName } }),
    [folderId, folderName, playlistId, playlistName]
  );
  const confirmDestructiveAction = useConfirmDestructiveAction();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [quickPdfs, setQuickPdfs] = useState<QuickPdfLink[]>([]);
  const [openPlaylistActions, setOpenPlaylistActions] = useState(false);
  const [openRenamePlaylist, setOpenRenamePlaylist] = useState(false);
  const [playlistRenameName, setPlaylistRenameName] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [openAddPdf, setOpenAddPdf] = useState(false);
  const [openOrder, setOpenOrder] = useState(false);
  const [selectedPlaylistSong, setSelectedPlaylistSong] = useState<Song | null>(null);
  const [selectedPlaylistPdf, setSelectedPlaylistPdf] = useState<QuickPdfLink | null>(null);
  const [draftOrderIds, setDraftOrderIds] = useState<string[]>([]);
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [addMusicSourceFilter, setAddMusicSourceFilter] = useState<AddMusicSourceFilter>('all');
  const [addMusicSourcePlaylistId, setAddMusicSourcePlaylistId] = useState<string | null>(null);
  const [addMusicSourcePlaylists, setAddMusicSourcePlaylists] = useState<Playlist[]>([]);
  const [addMusicSourceFolders, setAddMusicSourceFolders] = useState<Folder[]>([]);
  const [openAddMusicSourcePicker, setOpenAddMusicSourcePicker] = useState(false);
  const [multiSelectSongs, setMultiSelectSongs] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [playlistSearch, setPlaylistSearch] = useState(() => sessionState.query);
  const [playlistSearchOpen, setPlaylistSearchOpen] = useState(() => sessionState.searchOn);
  const [sendToPlaylistSong, setSendToPlaylistSong] = useState<Song | null>(null);
  const [sendToPlaylistOpen, setSendToPlaylistOpen] = useState(false);
  const [sendToPlaylistQuery, setSendToPlaylistQuery] = useState('');
  const [sendToPlaylistPlaylists, setSendToPlaylistPlaylists] = useState<Playlist[]>([]);
  const [sendToPlaylistFolders, setSendToPlaylistFolders] = useState<Folder[]>([]);
  const [sendingToPlaylistId, setSendingToPlaylistId] = useState<string | null>(null);
  const [removingFromSendPlaylistId, setRemovingFromSendPlaylistId] = useState<string | null>(null);
  const openedAddOnEnterRef = React.useRef(false);
  const load = async () => {
    const [p, all, pdfs] = await Promise.all([db.byPlaylist(playlistId), db.getSongs(), db.getQuickPdfs()]);
    if (p) {
      void db.saveLastOpenedPlaylist({
        playlistId: p.id,
        playlistName: p.name,
        folderId: p.folderId ?? null,
        updatedAt: Date.now(),
      });
    }
    setPlaylist(p);
    setAllSongs(all);
    setQuickPdfs(pdfs);
  };
  useEffect(() => { load(); }, [playlistId]);
  const allSongsById = React.useMemo(() => new Map(allSongs.map((song) => [song.id, song])), [allSongs]);
  const quickPdfsById = React.useMemo(() => new Map(quickPdfs.map((pdf) => [pdf.id, pdf])), [quickPdfs]);
  const playlistItems = React.useMemo(() => (playlist ? getPlaylistItems(playlist) : []), [playlist]);
  const playlistPdfIds = React.useMemo(
    () => new Set(playlistItems.filter((item) => item.type === 'pdf').map((item) => item.pdfId)),
    [playlistItems]
  );
  const playlistHasPdfItems = playlistPdfIds.size > 0;
  const availableQuickPdfs = quickPdfs.filter(hasQuickPdfSource);
  const getQuickPdfTitle = (pdf?: QuickPdfLink | null) => {
    if (!pdf) return 'PDF';
    const label = QUICK_PDF_LABELS[pdf.id];
    return pdf.name?.trim() ? `${label} - ${pdf.name.trim()}` : label;
  };
  const getQuickPdfStatusLabel = (pdf?: QuickPdfLink | null) => {
    if (pdf?.fileStorage || pdf?.fileData) return 'PDF salvo no app';
    if (pdf?.url) return 'PDF por link';
    return 'PDF sem origem configurada';
  };
  const orderedDraftSongs = draftOrderIds
    .map((songId) => allSongsById.get(songId))
    .filter((song): song is Song => !!song);
  const playlistSongCount = playlist?.songIds.length || 0;
  const playlistSongIds = React.useMemo(() => new Set(playlist?.songIds || []), [playlist?.songIds]);
  const useScriptMode = playlist?.viewMode === 'script' && (playlist.sections?.length || 0) > 0;
  const playlistSearchQuery = playlistSearch.trim().toLowerCase();
  const matchesPlaylistSearch = React.useCallback((song: Song) => {
    if (!playlistSearchQuery) return true;
    return (
      song.title.toLowerCase().includes(playlistSearchQuery) ||
      song.artist.toLowerCase().includes(playlistSearchQuery)
    );
  }, [playlistSearchQuery]);
  const matchesPdfSearch = React.useCallback((pdf?: QuickPdfLink) => {
    if (!playlistSearchQuery) return true;
    if (!pdf) return false;
    return `${QUICK_PDF_LABELS[pdf.id]} ${pdf.name || ''} ${pdf.url || ''}`.toLowerCase().includes(playlistSearchQuery);
  }, [playlistSearchQuery]);
  const toPlaylistDisplayRow = React.useCallback((item: PlaylistItem): PlaylistDisplayRow | null => {
    if (item.type === 'song') {
      const song = allSongsById.get(item.songId);
      if (!song || !matchesGenreFilter(song, globalFilters.selectedGenres) || !matchesPlaylistSearch(song)) return null;
      return { key: item.id, type: 'song', item, song };
    }
    const pdf = quickPdfsById.get(item.pdfId);
    if (!matchesPdfSearch(pdf)) return null;
    return { key: item.id, type: 'pdf', item, pdf };
  }, [allSongsById, globalFilters.selectedGenres, matchesPdfSearch, matchesPlaylistSearch, quickPdfsById]);
  const visiblePlaylistRows = React.useMemo(
    () => playlistItems
      .map(toPlaylistDisplayRow)
      .filter((row): row is PlaylistDisplayRow => !!row),
    [playlistItems, toPlaylistDisplayRow]
  );
  const scriptSectionItemIds = React.useMemo(
    () => new Set((playlist?.sections || []).flatMap((section) => getPlaylistSectionItemIds(section, playlistItems))),
    [playlist?.sections, playlistItems],
  );
  const highlightedPlaylistSongIds = React.useMemo(
    () =>
      new Set(
        playlistItems
          .flatMap((item) => (item.type === 'song' && item.isHighlighted ? [item.songId] : []))
      ),
    [playlistItems]
  );
  const isPlaylistSongHighlighted = (songId: string) => highlightedPlaylistSongIds.has(songId);
  const scriptSections = React.useMemo(
    () => (playlist?.sections || []).map((section) => ({
      ...section,
      rows: getPlaylistSectionItems(section, playlistItems)
        .map(toPlaylistDisplayRow)
        .filter((row): row is PlaylistDisplayRow => !!row),
    })),
    [playlist?.sections, playlistItems, toPlaylistDisplayRow]
  );
  const visibleScriptSections = React.useMemo(
    () => scriptSections.filter((section) => !playlistSearchQuery || section.rows.length > 0),
    [playlistSearchQuery, scriptSections]
  );
  const visibleUnsectionedScriptRows = React.useMemo(
    () => playlistItems
      .filter((item) => !scriptSectionItemIds.has(item.id))
      .map(toPlaylistDisplayRow)
      .filter((row): row is PlaylistDisplayRow => !!row),
    [playlistItems, scriptSectionItemIds, toPlaylistDisplayRow]
  );
  const sourcePlaylistOptions = sortStarredItems(
    addMusicSourcePlaylists.filter((option) =>
      getPlaylistItems(option).some((item) => item.type === 'song')
    ),
    favoriteMode
  );
  const selectedSourcePlaylist = sourcePlaylistOptions.find((option) => option.id === addMusicSourcePlaylistId) || null;
  const getAddMusicSourcePlaylistSubtitle = (sourcePlaylist: Playlist) => {
    const sourceSongCount = getPlaylistItems(sourcePlaylist).filter((item) => item.type === 'song').length;
    const folder = sourcePlaylist.folderId
      ? addMusicSourceFolders.find((item) => item.id === sourcePlaylist.folderId)
      : null;
    const count = `${sourceSongCount} ${sourceSongCount === 1 ? 'música' : 'músicas'}`;
    if (sourcePlaylist.id === playlistId) return `${count} · lista atual`;
    return folder ? `${count} · ${folder.name}` : `${count} · sem pasta`;
  };
  const sourcePlaylistSongIdSet = React.useMemo(() => {
    if (addMusicSourceFilter !== 'playlist' || !selectedSourcePlaylist) return null;
    return new Set(
      getPlaylistItems(selectedSourcePlaylist)
        .filter((item) => item.type === 'song')
        .map((item) => item.songId)
    );
  }, [addMusicSourceFilter, selectedSourcePlaylist]);
  const addMusicSearchQuery = q.trim().toLowerCase();
  const matchesAddMusicSourceFilter = (song: Song) => {
    if (addMusicSourceFilter !== 'playlist') return true;
    if (!sourcePlaylistSongIdSet) return false;
    return sourcePlaylistSongIdSet.has(song.id);
  };
  const addableSongs = allSongs
    .filter((s) => !playlist?.songIds.includes(s.id))
    .filter(matchesAddMusicSourceFilter)
    .filter((s) => matchesGenreFilter(s, globalFilters.selectedGenres))
  const available = addableSongs.filter((s) =>
    !addMusicSearchQuery
      ? true
      : s.title.toLowerCase().includes(addMusicSearchQuery) ||
        s.artist.toLowerCase().includes(addMusicSearchQuery)
  );
  const addMusicEmptyLabel =
    addMusicSourceFilter === 'playlist' && !selectedSourcePlaylist
      ? 'Escolha uma lista para filtrar as músicas.'
      : addMusicSourceFilter === 'playlist' && selectedSourcePlaylist
        ? 'Nenhuma música disponível nesta lista.'
        : 'Nada encontrado.';
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
    setOpenAddMusicSourcePicker(false);
    setQ('');
    setAddMusicSourceFilter('all');
    setAddMusicSourcePlaylistId(null);
    setAddMusicSourcePlaylists([]);
    setAddMusicSourceFolders([]);
    setMultiSelectSongs(false);
    setSelectedSongIds([]);
  };
  const clearAddMusicSelection = () => {
    setMultiSelectSongs(false);
    setSelectedSongIds([]);
  };
  const changeAddMusicSourceFilter = (nextFilter: AddMusicSourceFilter) => {
    setAddMusicSourceFilter(nextFilter);
    if (nextFilter !== 'playlist') setAddMusicSourcePlaylistId(null);
    if (nextFilter === 'playlist') setOpenAddMusicSourcePicker(true);
    clearAddMusicSelection();
  };
  const selectAddMusicSourcePlaylist = (sourcePlaylistId: string) => {
    setAddMusicSourceFilter('playlist');
    setAddMusicSourcePlaylistId(sourcePlaylistId);
    setOpenAddMusicSourcePicker(false);
    clearAddMusicSelection();
  };
  const addSelectedSongsToPlaylist = async () => {
    const validSongs = available.filter((song) => selectedSongIdSet.has(song.id));
    if (!validSongs.length) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        const existingIds = new Set(playlist.songIds);
        const idsToAdd = validSongs.map((song) => song.id).filter((songId) => !existingIds.has(songId));
        if (!idsToAdd.length) return playlist;
        const nextSongIds = [...playlist.songIds, ...idsToAdd];
        const nextItems = playlist.items
          ? [...getPlaylistItems(playlist), ...idsToAdd.map((songId) => makeSongPlaylistItem(songId))]
          : undefined;
        return { ...playlist, songIds: nextSongIds, ...(nextItems ? { items: nextItems } : {}) };
      })
    );
    closeAddMusicModal();
    load();
  };
  const selectedSongItem = selectedPlaylistSong
    ? playlistItems.find((item): item is Extract<PlaylistItem, { type: 'song' }> => item.type === 'song' && item.songId === selectedPlaylistSong.id)
    : undefined;
  const selectedSongSection = selectedSongItem && playlist
    ? playlist.sections?.find((section) => getPlaylistSectionItemIds(section, playlistItems).includes(selectedSongItem.id))
    : undefined;
  const selectedSongSectionItems = selectedSongSection
    ? getPlaylistSectionItems(selectedSongSection, playlistItems)
    : [];
  const selectedSongMixedIndex = selectedSongItem && !selectedSongSection
    ? playlistItems.findIndex((item) => item.id === selectedSongItem.id)
    : -1;
  const selectedSongIndex = selectedSongItem
    ? selectedSongSection
      ? selectedSongSectionItems.findIndex((item) => item.id === selectedSongItem.id)
      : playlist?.items
        ? selectedSongMixedIndex
        : playlist?.songIds.indexOf(selectedSongItem.songId) ?? -1
    : -1;
  const selectedSongListLength = selectedSongSection
    ? selectedSongSectionItems.length
    : (playlist?.items ? playlistItems.length : playlist?.songIds.length) ?? 0;
  const canMoveSelectedSongUp = selectedSongIndex > 0;
  const canMoveSelectedSongDown = selectedSongIndex >= 0 && selectedSongIndex < selectedSongListLength - 1;
  const selectedSongHighlighted = !!selectedPlaylistSong && isPlaylistSongHighlighted(selectedPlaylistSong.id);
  const selectedPdfItem = selectedPlaylistPdf
    ? playlistItems.find((item) => item.type === 'pdf' && item.pdfId === selectedPlaylistPdf.id)
    : undefined;
  const selectedPdfSection = selectedPdfItem && playlist
    ? playlist.sections?.find((section) => getPlaylistSectionItemIds(section, playlistItems).includes(selectedPdfItem.id))
    : undefined;
  const selectedPdfSectionItems = selectedPdfSection
    ? getPlaylistSectionItems(selectedPdfSection, playlistItems)
    : [];
  const selectedPdfIndex = selectedPdfItem
    ? selectedPdfSection
      ? selectedPdfSectionItems.findIndex((item) => item.id === selectedPdfItem.id)
      : playlistItems.findIndex((item) => item.id === selectedPdfItem.id)
    : -1;
  const selectedPdfListLength = selectedPdfSection ? selectedPdfSectionItems.length : playlistItems.length;
  const canMoveSelectedPdfUp = selectedPdfIndex > 0;
  const canMoveSelectedPdfDown = selectedPdfIndex >= 0 && selectedPdfIndex < selectedPdfListLength - 1;
  const runAfterModalClose = (callback: () => void) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => callback());
      return;
    }
    window.setTimeout(callback, 0);
  };
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
  const toggleSelectedPlaylistSongHighlight = async () => {
    if (!playlist || !selectedPlaylistSong) return;
    const targetSong = selectedPlaylistSong;
    const nextHighlighted = !isPlaylistSongHighlighted(targetSong.id);
    const nextPlaylist = {
      ...playlist,
      items: setPlaylistSongHighlighted(playlist, targetSong.id, nextHighlighted),
    };
    setSelectedPlaylistSong(null);
    setPlaylist(nextPlaylist);
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((pl) =>
        pl.id === playlistId
          ? { ...pl, items: setPlaylistSongHighlighted(pl, targetSong.id, nextHighlighted) }
          : pl
      )
    );
    load();
  };
  const moveSongInCurrentPlaylist = async (song: Song, delta: number) => {
    if (!playlist) return;
    const currentItems = getPlaylistItems(playlist);
    const currentItem = currentItems.find((item) => item.type === 'song' && item.songId === song.id);
    if (!currentItem) return;

    const currentSection = playlist.sections?.find((section) =>
      getPlaylistSectionItemIds(section, currentItems).includes(currentItem.id)
    );

    if (currentSection) {
      const currentItemIds = getPlaylistSectionItemIds(currentSection, currentItems);
      const index = currentItemIds.indexOf(currentItem.id);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentItemIds.length) return;
      const nextSectionItemIds = [...currentItemIds];
      const [moved] = nextSectionItemIds.splice(index, 1);
      nextSectionItemIds.splice(nextIndex, 0, moved);
      const nextSections = playlist.sections?.map((section) =>
        section.id === currentSection.id
          ? syncSectionWithItemIds(section, nextSectionItemIds, currentItems)
          : syncPlaylistSectionItemIds(section, currentItems)
      ) ?? [];
      const scriptOrder = deriveScriptPlaylistOrder(nextSections, currentItems);
      const nextPlaylist = {
        ...playlist,
        songIds: scriptOrder.songIds,
        ...(playlist.items ? { items: scriptOrder.items } : {}),
        sections: scriptOrder.sections,
      };
      const rows = await db.getPlaylists();
      await db.savePlaylists(rows.map((pl) => (pl.id === playlistId ? nextPlaylist : pl)));
      setPlaylist(nextPlaylist);
      load();
      return;
    }

    if (playlist.items) {
      const index = currentItems.findIndex((item) => item.id === currentItem.id);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentItems.length) return;
      const nextItems = [...currentItems];
      const [moved] = nextItems.splice(index, 1);
      nextItems.splice(nextIndex, 0, moved);
      const nextSongIds = nextItems.filter((item) => item.type === 'song').map((item) => item.songId);
      const nextPlaylist = { ...playlist, songIds: nextSongIds, items: nextItems };
      const rows = await db.getPlaylists();
      await db.savePlaylists(rows.map((pl) => (pl.id === playlistId ? nextPlaylist : pl)));
      setPlaylist(nextPlaylist);
      load();
      return;
    }

    const currentIds = playlist.songIds;
    const index = currentIds.indexOf(song.id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= currentIds.length) return;
    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(index, 1);
    nextIds.splice(nextIndex, 0, moved);
    const nextPlaylist = { ...playlist, songIds: nextIds };
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
    let nextPlaylist: Playlist | null = null;
    await db.savePlaylists(
      rows.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const currentItems = getPlaylistItems(pl);
        const removedItemIds = currentItems
          .filter((item) => item.type === 'song' && item.songId === song.id)
          .map((item) => item.id);
        const nextItems = pl.items?.filter((item) => item.type !== 'song' || item.songId !== song.id);
        const sectionItems = nextItems ?? getPlaylistItems({ ...pl, songIds: pl.songIds.filter((songId) => songId !== song.id), items: undefined });
        nextPlaylist = {
          ...pl,
          songIds: pl.songIds.filter((songId) => songId !== song.id),
          items: nextItems,
          sections: pl.sections?.map((section) => {
            const itemIds = getPlaylistSectionItemIds(section, currentItems).filter((itemId) => !removedItemIds.includes(itemId));
            return syncSectionWithItemIds(section, itemIds, sectionItems);
          }),
        };
        return nextPlaylist;
      })
    );
    setSelectedPlaylistSong(null);
    if (nextPlaylist) setPlaylist(nextPlaylist);
    load();
  };
  const removeSelectedPlaylistSong = async () => {
    if (!selectedPlaylistSong) return;
    const targetSong = selectedPlaylistSong;
    setSelectedPlaylistSong(null);
    runAfterModalClose(() => {
      void removeSongFromCurrentPlaylist(targetSong);
    });
  };
  const openAddPdfModal = () => {
    setOpenPlaylistActions(false);
    setOpenAddPdf(true);
  };
  const openRenamePlaylistModal = () => {
    if (!playlist) return;
    setOpenPlaylistActions(false);
    setPlaylistRenameName(playlist.name);
    setOpenRenamePlaylist(true);
  };
  const renameCurrentPlaylist = async () => {
    if (!playlist || !playlistRenameName.trim()) return;
    const nextName = playlistRenameName.trim();
    const rows = await db.getPlaylists();
    const nextPlaylist = { ...playlist, name: nextName };
    await db.savePlaylists(
      rows.map((pl) => (pl.id === playlistId ? { ...pl, name: nextName } : pl))
    );
    setPlaylist(nextPlaylist);
    void db.saveLastOpenedPlaylist({
      playlistId: nextPlaylist.id,
      playlistName: nextPlaylist.name,
      folderId: nextPlaylist.folderId ?? null,
      updatedAt: Date.now(),
    });
    setOpenRenamePlaylist(false);
    setPlaylistRenameName('');
  };
  const shareCurrentPlaylist = async () => {
    if (!playlist) return;
    const playlistToShare = playlist;
    const songsById = new Map(allSongs.map((song) => [song.id, song]));
    setOpenPlaylistActions(false);
    const blob = await buildPlaylistZip(playlistToShare, songsById);
    const fileName = `${sanitizeFileName(playlistToShare.name)}.zip`;
    await shareBlobFile({
      blob,
      fileName,
      title: playlistToShare.name,
      text: `Lista "${playlistToShare.name}" com ${playlistToShare.songIds.length} música${playlistToShare.songIds.length === 1 ? '' : 's'}.`,
      fallbackMessage: 'Não foi possível abrir o compartilhamento nativo. O ZIP da lista foi baixado como alternativa.',
    });
  };
  const duplicateCurrentPlaylist = async () => {
    if (!playlist) return;
    const rows = await db.getPlaylists();
    const source = rows.find((row) => row.id === playlist.id) || playlist;
    const duplicate = createDuplicatedPlaylist(source, rows);
    await db.savePlaylists(insertPlaylistAfterSource(rows, source.id, duplicate));
    setOpenPlaylistActions(false);
    nav.navigate('PlaylistDetail', {
      playlistId: duplicate.id,
      playlistName: duplicate.name,
      folderId: duplicate.folderId ?? null,
      folderName,
    });
  };
  const toggleCurrentPlaylistStar = async () => {
    if (!playlist) return;
    const rows = await db.getPlaylists();
    const nextRows = toggleStarredPlaylist(rows, playlist.id, favoriteMode);
    if (nextRows === rows) return;
    const nextPlaylist = nextRows.find((pl) => pl.id === playlist.id) || playlist;
    setOpenPlaylistActions(false);
    setPlaylist(nextPlaylist);
    await db.savePlaylists(nextRows);
  };
  const addQuickPdfToPlaylist = async (pdf: QuickPdfLink) => {
    if (!playlist || !hasQuickPdfSource(pdf) || playlistPdfIds.has(pdf.id)) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const currentItems = getPlaylistItems(pl);
        if (currentItems.some((item) => item.type === 'pdf' && item.pdfId === pdf.id)) return pl;
        return { ...pl, items: [...currentItems, makePdfPlaylistItem(pdf.id)] };
      })
    );
    setOpenAddPdf(false);
    load();
  };
  const removePdfFromCurrentPlaylist = async (pdfId: QuickPdfId) => {
    const label = QUICK_PDF_LABELS[pdfId];
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja remover "${label}" desta lista?`,
      'Remover PDF',
      'Remover'
    );
    if (!confirmed) return;
    setSelectedPlaylistPdf(null);
    const buildNextPlaylistWithoutPdf = (source: Playlist): Playlist => {
      const currentItems = getPlaylistItems(source);
      const removedItemIds = currentItems
        .filter((item) => item.type === 'pdf' && item.pdfId === pdfId)
        .map((item) => item.id);
      const nextItems = currentItems.filter((item) => item.type !== 'pdf' || item.pdfId !== pdfId);
      return {
        ...source,
        items: nextItems,
        sections: source.sections?.map((section) => {
          const itemIds = getPlaylistSectionItemIds(section, currentItems).filter((itemId) => !removedItemIds.includes(itemId));
          return syncSectionWithItemIds(section, itemIds, nextItems);
        }),
      };
    };
    if (playlist) {
      setPlaylist(buildNextPlaylistWithoutPdf(playlist));
    }
    const rows = await db.getPlaylists();
    let nextPlaylist: Playlist | null = null;
    await db.savePlaylists(
      rows.map((pl) => {
        if (pl.id !== playlistId) return pl;
        nextPlaylist = buildNextPlaylistWithoutPdf(pl);
        return nextPlaylist;
      })
    );
    if (nextPlaylist) setPlaylist(nextPlaylist);
    load();
  };
  const removeSelectedPlaylistPdf = () => {
    if (!selectedPlaylistPdf) return;
    const targetPdfId = selectedPlaylistPdf.id;
    setSelectedPlaylistPdf(null);
    runAfterModalClose(() => {
      void removePdfFromCurrentPlaylist(targetPdfId);
    });
  };
  const movePdfInCurrentPlaylist = async (pdfId: QuickPdfId, delta: number) => {
    if (!playlist) return;
    const currentItems = getPlaylistItems(playlist);
    const currentItem = currentItems.find((item) => item.type === 'pdf' && item.pdfId === pdfId);
    if (!currentItem) return;
    const currentSection = playlist.sections?.find((section) =>
      getPlaylistSectionItemIds(section, currentItems).includes(currentItem.id)
    );

    if (currentSection) {
      const currentItemIds = getPlaylistSectionItemIds(currentSection, currentItems);
      const index = currentItemIds.indexOf(currentItem.id);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentItemIds.length) return;
      const nextSectionItemIds = [...currentItemIds];
      const [moved] = nextSectionItemIds.splice(index, 1);
      nextSectionItemIds.splice(nextIndex, 0, moved);
      const nextSections = playlist.sections?.map((section) =>
        section.id === currentSection.id
          ? syncSectionWithItemIds(section, nextSectionItemIds, currentItems)
          : syncPlaylistSectionItemIds(section, currentItems)
      ) ?? [];
      const scriptOrder = deriveScriptPlaylistOrder(nextSections, currentItems);
      const nextPlaylist = { ...playlist, songIds: scriptOrder.songIds, items: scriptOrder.items, sections: scriptOrder.sections };
      const rows = await db.getPlaylists();
      await db.savePlaylists(rows.map((pl) => (pl.id === playlistId ? nextPlaylist : pl)));
      setPlaylist(nextPlaylist);
      load();
      return;
    }

    const index = currentItems.findIndex((item) => item.id === currentItem.id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= currentItems.length) return;
    const nextItems = [...currentItems];
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(nextIndex, 0, moved);
    const nextSongIds = nextItems.filter((item) => item.type === 'song').map((item) => item.songId);
    const nextPlaylist = { ...playlist, songIds: nextSongIds, items: nextItems };
    const rows = await db.getPlaylists();
    await db.savePlaylists(rows.map((pl) => (pl.id === playlistId ? nextPlaylist : pl)));
    setPlaylist(nextPlaylist);
    load();
  };
  const getSendToPlaylistFolderPath = (targetFolderId?: string | null) => {
    if (!targetFolderId) return '';
    const byId = new Map(sendToPlaylistFolders.map((folder) => [folder.id, folder]));
    const names: string[] = [];
    const visited = new Set<string>();
    let current = byId.get(targetFolderId);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names.join(' / ');
  };
  const getSendToPlaylistSubtitle = (targetPlaylist: Playlist) => {
    const path = getSendToPlaylistFolderPath(targetPlaylist.folderId);
    const count = targetPlaylist.songIds.length;
    return `${path ? `Lista em ${path}` : 'Lista na raiz'} · ${count} ${count === 1 ? 'música' : 'músicas'}`;
  };
  const playlistAlreadyHasSendSong = (targetPlaylist: Playlist) =>
    !!sendToPlaylistSong && targetPlaylist.songIds.includes(sendToPlaylistSong.id);
  const sendToPlaylistSearch = sendToPlaylistQuery.trim().toLowerCase();
  const sendToPlaylistOptions = sortStarredItems(sendToPlaylistPlaylists, favoriteMode)
    .filter((targetPlaylist) => {
      if (!sendToPlaylistSearch) return true;
      return `${targetPlaylist.name} ${getSendToPlaylistFolderPath(targetPlaylist.folderId)}`
        .toLowerCase()
        .includes(sendToPlaylistSearch);
    });
  const toggleSendToPlaylistStar = (targetPlaylist: Playlist) => {
    setSendToPlaylistPlaylists((current) => {
      const next = toggleStarredPlaylist(current, targetPlaylist.id, favoriteMode);
      if (next !== current) void db.savePlaylists(next);
      return next;
    });
  };
  const closeSendToPlaylistModal = () => {
    setSendToPlaylistOpen(false);
    setSendToPlaylistSong(null);
    setSendToPlaylistQuery('');
    setSendingToPlaylistId(null);
    setRemovingFromSendPlaylistId(null);
  };
  const openSendSelectedSongToPlaylist = async () => {
    if (!selectedPlaylistSong) return;
    const targetSong = selectedPlaylistSong;
    setSelectedPlaylistSong(null);
    const [rows, folders] = await Promise.all([db.getPlaylists(), db.getFolders()]);
    setSendToPlaylistSong(targetSong);
    setSendToPlaylistPlaylists(rows);
    setSendToPlaylistFolders(folders);
    setSendToPlaylistQuery('');
    runAfterModalClose(() => setSendToPlaylistOpen(true));
  };
  const sendSelectedSongToPlaylist = async (targetPlaylist: Playlist) => {
    if (!sendToPlaylistSong || playlistAlreadyHasSendSong(targetPlaylist) || sendingToPlaylistId || removingFromSendPlaylistId) return;
    setSendingToPlaylistId(targetPlaylist.id);
    await db.addSongToPlaylist(targetPlaylist.id, sendToPlaylistSong.id);
    setSendToPlaylistPlaylists((current) =>
      current.map((item) =>
        item.id === targetPlaylist.id
          ? {
              ...item,
              songIds: item.songIds.includes(sendToPlaylistSong.id)
                ? item.songIds
                : [...item.songIds, sendToPlaylistSong.id],
              items: item.items && !item.items.some((playlistItem) => playlistItem.type === 'song' && playlistItem.songId === sendToPlaylistSong.id)
                ? [...getPlaylistItems(item), makeSongPlaylistItem(sendToPlaylistSong.id)]
                : item.items,
            }
          : item
      )
    );
    setSendingToPlaylistId(null);
  };
  const removeSendSongFromPlaylist = async (targetPlaylist: Playlist) => {
    if (!sendToPlaylistSong || !playlistAlreadyHasSendSong(targetPlaylist) || sendingToPlaylistId || removingFromSendPlaylistId) return;
    setRemovingFromSendPlaylistId(targetPlaylist.id);
    await db.removeSongFromPlaylist(targetPlaylist.id, sendToPlaylistSong.id);
    setSendToPlaylistPlaylists((current) =>
      current.map((item) =>
        item.id === targetPlaylist.id
          ? {
              ...item,
              songIds: item.songIds.filter((songId) => songId !== sendToPlaylistSong.id),
              items: item.items?.filter((playlistItem) => playlistItem.type !== 'song' || playlistItem.songId !== sendToPlaylistSong.id),
            }
          : item
      )
    );
    if (targetPlaylist.id === playlistId) {
      await load();
    }
    setRemovingFromSendPlaylistId(null);
  };
  const openAddMusic = async () => {
    setOpenPlaylistActions(false);
    setQ('');
    setAddMusicSourceFilter('all');
    setAddMusicSourcePlaylistId(null);
    setMultiSelectSongs(false);
    setSelectedSongIds([]);
    const [rows, folders] = await Promise.all([db.getPlaylists(), db.getFolders()]);
    setAddMusicSourcePlaylists(rows);
    setAddMusicSourceFolders(folders);
    setOpenAdd(true);
  };
  useEffect(() => {
    if (!openAddOnEnter || openedAddOnEnterRef.current) return;
    openedAddOnEnterRef.current = true;
    void openAddMusic();
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
      rows.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const nextItems = reorderPlaylistItemsBySongIds(pl, nextSongIds);
        return { ...pl, songIds: nextSongIds, ...(pl.items ? { items: nextItems } : {}) };
      })
    );
    setOpenOrder(false);
    setDraggedSongId(null);
    load();
  };
  const renderPlaylistDisplayRow = (row: PlaylistDisplayRow, keyPrefix = '') => {
    const rowKey = keyPrefix ? `${keyPrefix}-${row.key}` : row.key;
    if (row.type === 'pdf') {
      const pdfTitle = getQuickPdfTitle(row.pdf);
      return (
        <View key={rowKey} style={[styles.listRow, localStyles.pdfListRow]}>
          <TouchableOpacity
            style={styles.cardMainPress}
            onPress={() => nav.navigate('PdfViewer', {
              pdfId: row.item.pdfId,
              pdfTitle,
              returnTo: songReturnTo,
              sourcePlaylistId: playlistId,
              sourcePlaylistName: playlist?.name,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={localStyles.pdfBadge}>
                <FileText size={15} color="#201600" />
              </View>
              <View style={styles.listRowText}>
                <Text style={styles.title}>{pdfTitle}</Text>
                <Text style={styles.subtitle}>{getQuickPdfStatusLabel(row.pdf)}</Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.listActionBtn}
            onPress={() => setSelectedPlaylistPdf(row.pdf || { id: row.item.pdfId })}
          >
            <ChevronRight size={18} color="#ffd166" />
          </TouchableOpacity>
        </View>
      );
    }

    const highlighted = row.item.isHighlighted === true;
    return (
      <View key={rowKey} style={[styles.listRow, highlighted && localStyles.highlightedSongRow]}>
        <TouchableOpacity
          style={styles.cardMainPress}
          onPress={() => nav.navigate('SongDetail', {
            id: row.song.id,
            returnTo: songReturnTo,
            sourcePlaylistId: playlistId,
            sourcePlaylistName: playlist?.name,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={localStyles.musicIconTile}>
              <Music size={17} color="#38bdf8" />
            </View>
            <View style={styles.listRowText}>
              <View style={localStyles.songTitleRow}>
                <Text style={styles.title}>{row.song.title}</Text>
                {highlighted ? <Star size={14} color="#ffd166" fill="#ffd166" /> : null}
              </View>
              <Text style={styles.subtitle}>{row.song.artist}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.listActionBtn} onPress={() => setSelectedPlaylistSong(row.song)}>
          <ChevronRight size={18} color="#4FC3F7" />
        </TouchableOpacity>
      </View>
    );
  };
  useEffect(() => {
    setTopBarControls({
      showSearch: true,
      searchActive: playlistSearchOpen,
      onSearchPress: () => {
        const next = !playlistSearchOpen;
        setPlaylistSearchOpen(next);
        sessionState.searchOn = next;
        if (!next) {
          setPlaylistSearch('');
          sessionState.query = '';
        }
      },
      showAdd: true,
      onAddPress: () => setOpenPlaylistActions(true),
    });
    return clearTopBarControls;
  }, [clearTopBarControls, playlistSearchOpen, sessionState, setTopBarControls]);

  const handlePlaylistSearchChange = (value: string) => {
    sessionState.query = value;
    setPlaylistSearch(value);
  };

  const handlePlaylistScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
    sessionState.scrollOffset = Math.max(0, event.nativeEvent.contentOffset.y || 0);
  };

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
            onChangeText={handlePlaylistSearchChange}
            autoFocus
          />
        </View>
      ) : null}
      <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>
        {playlistHasPdfItems ? 'Itens da lista' : 'Músicas na lista'}
      </Text>
      {useScriptMode ? (
        <FlatList
          data={visibleScriptSections}
          keyExtractor={(section: PlaylistSection) => section.id}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews={false}
          contentOffset={{ x: 0, y: sessionState.scrollOffset }}
          scrollEventThrottle={100}
          onScroll={handlePlaylistScroll}
          contentContainerStyle={{ paddingBottom: 140 }}
          renderItem={({ item: section }: { item: (typeof visibleScriptSections)[number] }) => {
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
                {section.rows.length ? (
                  section.rows.map((row) => renderPlaylistDisplayRow(row, section.id))
                ) : (
                  <Text style={[styles.subtitle, { marginBottom: 8 }]}>Nenhum item nesta seção.</Text>
                )}
              </View>
            );
          }}
          ListFooterComponent={(
            <>
              {visibleUnsectionedScriptRows.length ? (
                <View>
                  <Text style={[styles.settingsModalSubhead, { marginHorizontal: 12, marginTop: 10 }]}>Sem seção</Text>
                  {visibleUnsectionedScriptRows.map((row) => renderPlaylistDisplayRow(row, 'unsectioned'))}
                </View>
              ) : null}
              {playlistSearchQuery && !visibleScriptSections.length && !visibleUnsectionedScriptRows.length ? (
                <Text style={[styles.subtitle, { marginHorizontal: 12, marginTop: 12 }]}>Nada encontrado nesta lista.</Text>
              ) : null}
            </>
          )}
        />
      ) : (
        <FlatList
          data={visiblePlaylistRows}
          keyExtractor={(row: PlaylistDisplayRow) => row.key}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews={false}
          contentOffset={{ x: 0, y: sessionState.scrollOffset }}
          scrollEventThrottle={100}
          onScroll={handlePlaylistScroll}
          contentContainerStyle={{ paddingBottom: 140 }}
          ListEmptyComponent={<Text style={[styles.subtitle, { marginHorizontal: 12 }]}>Nada encontrado nesta lista.</Text>}
          renderItem={({ item: row }: { item: PlaylistDisplayRow }) => {
            if (row.type === 'pdf') {
              const pdfTitle = getQuickPdfTitle(row.pdf);
              return (
                <View style={[styles.listRow, localStyles.pdfListRow]}>
                  <TouchableOpacity
                    style={styles.cardMainPress}
                    onPress={() => nav.navigate('PdfViewer', {
                      pdfId: row.item.pdfId,
                      pdfTitle,
                      returnTo: songReturnTo,
                      sourcePlaylistId: playlistId,
                      sourcePlaylistName: playlist?.name,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={localStyles.pdfBadge}>
                        <FileText size={15} color="#201600" />
                      </View>
                      <View style={styles.listRowText}>
                        <Text style={styles.title}>{pdfTitle}</Text>
                        <Text style={styles.subtitle}>{getQuickPdfStatusLabel(row.pdf)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.listActionBtn}
                    onPress={() => setSelectedPlaylistPdf(row.pdf || { id: row.item.pdfId })}
                  >
                    <ChevronRight size={18} color="#ffd166" />
                  </TouchableOpacity>
                </View>
              );
            }

            const item = row.song;
            const highlighted = row.item.isHighlighted === true;
            return (
              <View style={[styles.listRow, highlighted && localStyles.highlightedSongRow]}>
                <TouchableOpacity
                  style={styles.cardMainPress}
                  onPress={() => nav.navigate('SongDetail', {
                    id: item.id,
                    returnTo: songReturnTo,
                    sourcePlaylistId: playlistId,
                    sourcePlaylistName: playlist?.name,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={localStyles.musicIconTile}>
                      <Music size={17} color="#38bdf8" />
                    </View>
                    <View style={styles.listRowText}>
                      <View style={localStyles.songTitleRow}>
                        <Text style={styles.title}>{item.title}</Text>
                        {highlighted ? <Star size={14} color="#ffd166" fill="#ffd166" /> : null}
                      </View>
                      <Text style={styles.subtitle}>{item.artist}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.listActionBtn} onPress={() => setSelectedPlaylistSong(item)}>
                  <ChevronRight size={18} color="#4FC3F7" />
                </TouchableOpacity>
              </View>
            );
          }}
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
        <TouchableOpacity style={styles.modalActionBtn} onPress={toggleSelectedPlaylistSongHighlight}>
          <View style={styles.createOptionLeft}>
            <Star
              size={17}
              color="#ffd166"
              fill={selectedSongHighlighted ? '#ffd166' : 'transparent'}
            />
            <Text style={styles.modalActionText}>
              {selectedSongHighlighted ? 'Remover destaque' : 'Destacar nesta lista'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalActionBtn} onPress={openSendSelectedSongToPlaylist}>
          <View style={styles.createOptionLeft}>
            <ListMusic size={17} color="#ffd166" />
            <Text style={styles.modalActionText}>Enviar a uma lista</Text>
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
        visible={!!selectedPlaylistPdf}
        title="PDF na lista"
        onClose={() => setSelectedPlaylistPdf(null)}
        icon={<FileText size={16} color="#ffd166" />}
        maxWidth={520}
        footer={
          <TouchableOpacity onPress={() => setSelectedPlaylistPdf(null)}>
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>{getQuickPdfTitle(selectedPlaylistPdf)}</Text>
        <Text style={[styles.subtitle, { marginBottom: 10 }]}>
          Toque no item da lista para abrir o PDF. Se o link não renderizar bem no app, use Abrir externo na tela do PDF.
        </Text>
        {selectedPlaylistPdf?.url ? (
          <Text style={[styles.subtitle, { marginBottom: 10 }]} numberOfLines={2}>
            {selectedPlaylistPdf.url}
          </Text>
        ) : null}
        <TouchableOpacity
          style={[styles.modalActionBtn, !canMoveSelectedPdfUp && localStyles.disabledAction]}
          disabled={!canMoveSelectedPdfUp}
          onPress={() => selectedPlaylistPdf && movePdfInCurrentPlaylist(selectedPlaylistPdf.id, -1)}
        >
          <View style={styles.createOptionLeft}>
            <ArrowUp size={17} color={canMoveSelectedPdfUp ? '#4FC3F7' : '#666'} />
            <Text style={[styles.modalActionText, !canMoveSelectedPdfUp && localStyles.disabledActionText]}>
              Subir PDF
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalActionBtn, !canMoveSelectedPdfDown && localStyles.disabledAction]}
          disabled={!canMoveSelectedPdfDown}
          onPress={() => selectedPlaylistPdf && movePdfInCurrentPlaylist(selectedPlaylistPdf.id, 1)}
        >
          <View style={styles.createOptionLeft}>
            <ArrowDown size={17} color={canMoveSelectedPdfDown ? '#4FC3F7' : '#666'} />
            <Text style={[styles.modalActionText, !canMoveSelectedPdfDown && localStyles.disabledActionText]}>
              Descer PDF
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalActionBtn, styles.modalDangerBtn]}
          onPress={removeSelectedPlaylistPdf}
        >
          <View style={styles.createOptionLeft}>
            <Trash2 size={17} color="#ff7a7a" />
            <Text style={styles.modalDangerText}>Excluir da lista</Text>
          </View>
        </TouchableOpacity>
      </AppModal>

      <PlaylistPickerModal
        visible={sendToPlaylistOpen}
        title="Enviar a uma lista"
        contextText={
          sendToPlaylistSong
            ? `${sendToPlaylistSong.title}${sendToPlaylistSong.artist ? ` - ${sendToPlaylistSong.artist}` : ''}`
            : ''
        }
        query={sendToPlaylistQuery}
        playlists={sendToPlaylistOptions}
        addingToPlaylistId={sendingToPlaylistId}
        removingFromPlaylistId={removingFromSendPlaylistId}
        onQueryChange={setSendToPlaylistQuery}
        onClose={closeSendToPlaylistModal}
        playlistAlreadyHasSong={playlistAlreadyHasSendSong}
        getPlaylistSubtitle={getSendToPlaylistSubtitle}
        onSelectPlaylist={(targetPlaylist) => void sendSelectedSongToPlaylist(targetPlaylist)}
        onRemoveFromPlaylist={(targetPlaylist) => void removeSendSongFromPlaylist(targetPlaylist)}
        showStars={favoriteMode !== 'disabled'}
        onToggleStarredPlaylist={toggleSendToPlaylistStar}
        actionLabel="Enviar"
        busyLabel="Enviando..."
        alreadyAddedLabel="Já está nesta lista"
        emptyLabel="Nenhuma lista encontrada."
      />

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
        <TouchableOpacity style={[styles.settingsInlineAction, { marginTop: 12 }]} onPress={openRenamePlaylistModal}>
          <View>
            <Text style={styles.settingsControlTitle}>Editar nome</Text>
            <Text style={styles.settingsControlHint}>Altere o nome desta lista.</Text>
          </View>
          <Pencil size={19} color="#4FC3F7" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsInlineAction} onPress={shareCurrentPlaylist}>
          <View>
            <Text style={styles.settingsControlTitle}>Compartilhar lista</Text>
            <Text style={styles.settingsControlHint}>Compartilhe esta lista com outro dispositivo ou usuário.</Text>
          </View>
          <Share2 size={19} color="#4FC3F7" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsInlineAction} onPress={duplicateCurrentPlaylist}>
          <View>
            <Text style={styles.settingsControlTitle}>Duplicar lista</Text>
            <Text style={styles.settingsControlHint}>Crie uma cópia independente desta lista.</Text>
          </View>
          <Copy size={19} color="#4FC3F7" />
        </TouchableOpacity>
        {favoriteMode !== 'disabled' && playlist ? (
          <TouchableOpacity style={styles.settingsInlineAction} onPress={toggleCurrentPlaylistStar}>
            <View>
              <Text style={styles.settingsControlTitle}>
                {playlist.isStarred ? 'Remover dos favoritos' : 'Favoritar lista'}
              </Text>
              <Text style={styles.settingsControlHint}>
                {playlist.isStarred
                  ? 'Remova esta lista dos seus favoritos.'
                  : 'Adicione esta lista aos seus favoritos.'}
              </Text>
            </View>
            {playlist.isStarred ? (
              <StarOff size={19} color="#ffd166" />
            ) : (
              <Star size={19} color="#ffd166" />
            )}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.settingsInlineAction} onPress={() => void openAddMusic()}>
          <View>
            <Text style={styles.settingsControlTitle}>Adicionar música</Text>
            <Text style={styles.settingsControlHint}>Escolha músicas para incluir na lista.</Text>
          </View>
          <Plus size={19} color="#4FC3F7" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingsInlineAction}
          onPress={openAddPdfModal}
        >
          <View>
            <Text style={styles.settingsControlTitle}>Adicionar PDF</Text>
            <Text style={styles.settingsControlHint}>
              Escolha um dos PDFs rápidos cadastrados.
            </Text>
          </View>
          <FileText size={19} color="#ffd166" />
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
        visible={openRenamePlaylist}
        title="Editar nome da lista"
        onClose={() => setOpenRenamePlaylist(false)}
        icon={<ListMusic size={16} color="var(--app-accent)" />}
        maxWidth={520}
        footer={
          <>
            <TouchableOpacity onPress={() => setOpenRenamePlaylist(false)}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={renameCurrentPlaylist}>
              <Text style={{ color: '#4FC3F7', fontWeight: '900' }}>Salvar</Text>
            </TouchableOpacity>
          </>
        }
      >
        <TextInput
          style={styles.input}
          value={playlistRenameName}
          onChangeText={setPlaylistRenameName}
          placeholder="Novo nome"
          placeholderTextColor="#666"
          autoFocus
        />
      </AppModal>

      <AppModal
        visible={openAddPdf}
        title="Adicionar PDF"
        onClose={() => setOpenAddPdf(false)}
        icon={<FileText size={16} color="#ffd166" />}
        maxWidth={520}
        footer={
          <TouchableOpacity onPress={() => setOpenAddPdf(false)}>
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>
          Escolha um PDF rápido configurado em Ajustes. Slots sem link e sem arquivo não aparecem aqui.
        </Text>
        <ScrollView style={{ marginTop: 8, maxHeight: 360 }} contentContainerStyle={{ paddingBottom: 10 }}>
          {availableQuickPdfs.length ? (
            availableQuickPdfs.map((pdf) => {
              const alreadyAdded = playlistPdfIds.has(pdf.id);
              return (
                <TouchableOpacity
                  key={pdf.id}
                  style={[
                    styles.modalActionBtn,
                    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
                    alreadyAdded && localStyles.disabledAction,
                  ]}
                  disabled={alreadyAdded}
                  onPress={() => void addQuickPdfToPlaylist(pdf)}
                >
                  <View style={[styles.createOptionLeft, { flex: 1, minWidth: 0 }]}>
                    <FileText size={17} color="#ffd166" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.modalActionText}>{getQuickPdfTitle(pdf)}</Text>
                      <Text style={styles.subtitle} numberOfLines={1}>
                        {alreadyAdded ? 'Já está nesta lista' : getQuickPdfSourceLabel(pdf)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ width: 22, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
                    <Plus size={18} color={alreadyAdded ? '#666' : '#ffd166'} />
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={[styles.subtitle, { marginTop: 6 }]}>
              Nenhum PDF rápido com link ou arquivo cadastrado. Configure PDF1, PDF2 ou PDF3 em Ajustes.
            </Text>
          )}
        </ScrollView>
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
        <View style={localStyles.sourceFilterBlock}>
          <Text style={styles.settingsControlTitle}>Filtro de origem</Text>
          <View style={localStyles.sourceFilterChips}>
            {([
              ['all', 'Todas as músicas'],
              ['outsideCurrent', 'Fora desta lista'],
              ['playlist', 'Lista específica'],
            ] as Array<[AddMusicSourceFilter, string]>).map(([value, label]) => {
              const active = addMusicSourceFilter === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[localStyles.sourceFilterChip, active && localStyles.sourceFilterChipActive]}
                  onPress={() => changeAddMusicSourceFilter(value)}
                >
                  <Text style={[localStyles.sourceFilterChipText, active && localStyles.sourceFilterChipTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {addMusicSourceFilter === 'playlist' ? (
            <View style={localStyles.sourcePlaylistSummary}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={localStyles.sourcePlaylistTitle} numberOfLines={1}>
                  {selectedSourcePlaylist ? `Filtrando por: ${selectedSourcePlaylist.name}` : 'Nenhuma lista selecionada'}
                </Text>
                <Text style={localStyles.sourcePlaylistSubtitle} numberOfLines={1}>
                  {selectedSourcePlaylist
                    ? getAddMusicSourcePlaylistSubtitle(selectedSourcePlaylist)
                    : sourcePlaylistOptions.length
                      ? 'Escolha uma lista para filtrar as músicas.'
                      : 'Nenhuma lista com músicas disponível para filtrar.'}
                </Text>
              </View>
              <TouchableOpacity
                style={localStyles.sourcePlaylistChooseButton}
                onPress={() => setOpenAddMusicSourcePicker(true)}
              >
                <Text style={localStyles.sourcePlaylistChooseText}>
                  {selectedSourcePlaylist ? 'Trocar' : 'Escolher'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
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
            <Text style={[styles.subtitle, { marginTop: 6 }]}>{addMusicEmptyLabel}</Text>
          )}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={openAddMusicSourcePicker}
        title="Escolher lista"
        onClose={() => setOpenAddMusicSourcePicker(false)}
        icon={<ListMusic size={16} color="var(--app-accent)" />}
        maxWidth={520}
        footer={
          <TouchableOpacity onPress={() => setOpenAddMusicSourcePicker(false)}>
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>Escolha a lista de origem para filtrar as músicas disponíveis.</Text>
        <ScrollView style={{ marginTop: 8, maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 10 }}>
          {sourcePlaylistOptions.length ? (
            sourcePlaylistOptions.map((sourcePlaylist) => {
              const active = sourcePlaylist.id === addMusicSourcePlaylistId;
              const sourceSongCount = getPlaylistItems(sourcePlaylist).filter((item) => item.type === 'song').length;
              const addableFromSource = getPlaylistItems(sourcePlaylist)
                .filter((item) => item.type === 'song')
                .filter((item) => !playlistSongIds.has(item.songId))
                .length;
              return (
                <TouchableOpacity
                  key={sourcePlaylist.id}
                  style={[
                    styles.modalActionBtn,
                    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
                    active && localStyles.sourcePlaylistPickerActive,
                  ]}
                  onPress={() => selectAddMusicSourcePlaylist(sourcePlaylist.id)}
                >
                  <View style={[styles.createOptionLeft, { flex: 1, minWidth: 0 }]}>
                    <ListMusic size={17} color={active ? '#4FC3F7' : '#ffd166'} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.modalActionText} numberOfLines={1}>{sourcePlaylist.name}</Text>
                      <Text style={styles.subtitle} numberOfLines={1}>
                        {getAddMusicSourcePlaylistSubtitle(sourcePlaylist)}
                      </Text>
                      {sourcePlaylist.id === playlistId || addableFromSource === 0 ? (
                        <Text style={styles.subtitle} numberOfLines={1}>
                          {sourcePlaylist.id === playlistId
                            ? 'Lista atual: nenhuma música nova para adicionar.'
                            : 'Todas as músicas desta lista já estão aqui.'}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ width: 22, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
                    <Text style={{ color: active ? '#4FC3F7' : 'var(--app-muted-text)', fontWeight: '900' }}>
                      {sourceSongCount}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={[styles.subtitle, { marginTop: 6 }]}>Nenhuma lista com músicas disponível para filtrar.</Text>
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
  scriptPdfBlock: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,209,102,0.35)',
    backgroundColor: 'rgba(255,209,102,0.07)',
    marginHorizontal: 5,
    marginTop: 4,
    marginBottom: 4,
    padding: 10,
    gap: 8,
  },
  scriptPdfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  pdfListRow: {
    borderColor: 'rgba(255,209,102,0.45)',
    backgroundColor: 'rgba(255,209,102,0.08)',
  },
  pdfBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffd166',
  },
  pdfNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,209,102,0.35)',
    backgroundColor: 'rgba(255,209,102,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pdfNoticeText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  highlightedSongRow: {
    borderColor: 'rgba(255, 209, 102, 0.46)',
    backgroundColor: 'rgba(255, 209, 102, 0.08)',
  },
  songTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  disabledAction: {
    opacity: 0.48,
  },
  disabledActionText: {
    color: '#777',
  },
  sourceFilterBlock: {
    gap: 8,
    marginBottom: 10,
  },
  sourceFilterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceFilterChip: {
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  sourceFilterChipActive: {
    borderColor: 'rgba(79,195,247,0.55)',
    backgroundColor: 'rgba(79,195,247,0.14)',
  },
  sourceFilterChipText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '800',
  },
  sourceFilterChipTextActive: {
    color: '#4FC3F7',
  },
  sourcePlaylistScroller: {
    marginTop: 2,
  },
  sourcePlaylistScrollerContent: {
    gap: 8,
    paddingRight: 4,
  },
  sourcePlaylistSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  sourcePlaylistChip: {
    width: 174,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  sourcePlaylistChipActive: {
    borderColor: 'rgba(79,195,247,0.55)',
    backgroundColor: 'rgba(79,195,247,0.14)',
  },
  sourcePlaylistPickerActive: {
    borderColor: 'rgba(79,195,247,0.55)',
    backgroundColor: 'rgba(79,195,247,0.12)',
  },
  sourcePlaylistTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  sourcePlaylistTitleActive: {
    color: '#4FC3F7',
  },
  sourcePlaylistSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  sourcePlaylistChooseButton: {
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.45)',
    backgroundColor: 'rgba(79,195,247,0.12)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexShrink: 0,
  },
  sourcePlaylistChooseText: {
    color: '#4FC3F7',
    fontSize: 12,
    fontWeight: '900',
  },
  musicIconTile: {
    width: 34,
    height: 34,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.10)',
    borderColor: 'rgba(56, 189, 248, 0.22)',
    borderWidth: 1,
    flexShrink: 0,
  },
});
