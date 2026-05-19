import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderPlus,
  List,
  Music2,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';

import { AppModal } from '../components/AppModal';
import { useConfirmDestructiveAction } from '../components/ConfirmDialog';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useTopBarControls } from '../contexts/TopBarContext';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import { buildPlaylistZip, sanitizeFileName, shareBlobFile } from '../services/share';
import type { Folder, Playlist, Song } from '../types/models';
import { getDescendantFolderIds, matchesGenreFilter, playlistMatchesGenreFilter } from '../utils/genres';

const getFolderDepth = (folderId: string, folders: Folder[]) => {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const visited = new Set<string>();
  let depth = 1;
  let current = byId.get(folderId);

  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    depth += 1;
    current = byId.get(current.parentId);
  }

  return depth;
};

const formatDirectStats = (stats: { songs: number; subfolders: number; lists: number }) => {
  const parts: string[] = [];
  if (stats.subfolders) parts.push(`${stats.subfolders} ${stats.subfolders === 1 ? 'subpasta' : 'subpastas'}`);
  if (stats.songs) parts.push(`${stats.songs} ${stats.songs === 1 ? 'música' : 'músicas'}`);
  if (stats.lists) parts.push(`${stats.lists} ${stats.lists === 1 ? 'lista' : 'listas'}`);
  return parts.length ? parts.join(' · ') : 'Pasta vazia';
};

const getFolderAncestryIds = (folderId: string, folders: Folder[]) => {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const visited = new Set<string>();
  const ancestry = new Set<string>();
  let current = byId.get(folderId);

  while (current?.parentId && !visited.has(current.id)) {
    visited.add(current.id);
    ancestry.add(current.parentId);
    current = byId.get(current.parentId);
  }

  return ancestry;
};

const getFolderLevelLabel = (folderId: string, folders: Folder[]) => {
  const depth = getFolderDepth(folderId, folders);
  if (depth >= 3) return 'Sub-subpasta';
  if (depth === 2) return 'Subpasta';
  return 'Pasta';
};

const getFolderSubtreeDepth = (folderId: string, folders: Folder[]) => {
  const childrenByParent = new Map<string, Folder[]>();
  folders.forEach((folder) => {
    if (!folder.parentId) return;
    childrenByParent.set(folder.parentId, [...(childrenByParent.get(folder.parentId) || []), folder]);
  });

  const visited = new Set<string>();
  const stack = [{ id: folderId, depth: 1 }];
  let maxDepth = 1;

  while (stack.length) {
    const current = stack.pop();
    if (!current) break;
    if (visited.has(current.id)) return null;
    visited.add(current.id);
    maxDepth = Math.max(maxDepth, current.depth);
    (childrenByParent.get(current.id) || []).forEach((child) => {
      stack.push({ id: child.id, depth: current.depth + 1 });
    });
  }

  return maxDepth;
};

const folderSubtreeContains = (folders: Folder[], rootId: string, targetId: string) => {
  const childrenByParent = new Map<string, Folder[]>();
  folders.forEach((folder) => {
    if (!folder.parentId) return;
    childrenByParent.set(folder.parentId, [...(childrenByParent.get(folder.parentId) || []), folder]);
  });

  const visited = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) || [])];

  while (stack.length) {
    const current = stack.pop();
    if (!current) break;
    if (visited.has(current.id)) return null;
    if (current.id === targetId) return true;
    visited.add(current.id);
    stack.push(...(childrenByParent.get(current.id) || []));
  }

  return false;
};

const normalizeSearchText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const toggleId = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];

interface FolderDetailScreenProps {
  folderId: string;
  currentFolderName?: string;
  openAddOnEnter?: boolean;
  styles: any;
}

export function FolderDetailScreen({
  folderId,
  currentFolderName,
  openAddOnEnter,
  styles,
}: FolderDetailScreenProps) {
  const nav = useManualNavigation();
  const { setTopBarControls, clearTopBarControls } = useTopBarControls();
  const { globalFilters } = useGenreFilter();
  const songReturnTo: ManualRoute = React.useMemo(
    () => ({ name: 'FolderDetail', params: { folderId, folderName: currentFolderName } }),
    [currentFolderName, folderId]
  );
  const confirmDestructiveAction = useConfirmDestructiveAction();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [subfolders, setSubfolders] = useState<Folder[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [folderSongIds, setFolderSongIds] = useState<string[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([]);
  const [folderSongMap, setFolderSongMap] = useState<Record<string, string[]>>({});

  const [openActions, setOpenActions] = useState(false);
  const [openPlaylist, setOpenPlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState('');

  const [openFolder, setOpenFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const [openAddSong, setOpenAddSong] = useState(false);
  const [openAddExistingFolder, setOpenAddExistingFolder] = useState(false);
  const [openAddExistingPlaylist, setOpenAddExistingPlaylist] = useState(false);
  const [existingFolderQuery, setExistingFolderQuery] = useState('');
  const [existingPlaylistQuery, setExistingPlaylistQuery] = useState('');
  const [multiSelectFolders, setMultiSelectFolders] = useState(false);
  const [multiSelectPlaylists, setMultiSelectPlaylists] = useState(false);
  const [multiSelectSongs, setMultiSelectSongs] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [songQ, setSongQ] = useState('');
  const [openFolderItemActions, setOpenFolderItemActions] = useState(false);
  const [openRenameFolderItem, setOpenRenameFolderItem] = useState(false);
  const [openMoveFolderItem, setOpenMoveFolderItem] = useState(false);
  const [selectedFolderItem, setSelectedFolderItem] = useState<Folder | null>(null);
  const [folderItemRenameName, setFolderItemRenameName] = useState('');
  const [openPlaylistItemActions, setOpenPlaylistItemActions] = useState(false);
  const [openRenamePlaylistItem, setOpenRenamePlaylistItem] = useState(false);
  const [selectedPlaylistItem, setSelectedPlaylistItem] = useState<Playlist | null>(null);
  const [playlistItemRenameName, setPlaylistItemRenameName] = useState('');
  const openedAddOnEnterRef = React.useRef(false);

  const load = async () => {
    const allFolders = await db.getFolders();
    const allPlaylists = await db.getPlaylists();
    const folderSongEntries = await Promise.all(
      allFolders.map(async (folder) => [folder.id, await db.getFolderSongIds(folder.id)] as const)
    );
    setAllFolders(allFolders);
    setAllPlaylists(allPlaylists);
    setFolderSongMap(Object.fromEntries(folderSongEntries));
    setFolder(allFolders.find((f) => f.id === folderId) || null);
    setSubfolders(await db.getSubfolders(folderId));
    setPlaylists(allPlaylists.filter((playlist) => playlist.folderId === folderId));
    setFolderSongIds(await db.getFolderSongIds(folderId));
    setAllSongs(await db.getSongs());
  };
  useEffect(() => { load(); }, [folderId]);
  const createPlaylist = async () => {
    if (!playlistName.trim()) return;
    await db.addPlaylist(folderId, playlistName);
    setPlaylistName('');
    setOpenPlaylist(false);
    load();
  };
  const createSubfolder = async () => {
    if (!folderName.trim()) return;
    await db.addFolder(folderName, folderId);
    setFolderName('');
    setOpenFolder(false);
    load();
  };
  const openActionsForFolderItem = (folder: Folder) => {
    setSelectedFolderItem(folder);
    setOpenFolderItemActions(true);
  };
  const openActionsForPlaylistItem = (playlist: Playlist) => {
    setSelectedPlaylistItem(playlist);
    setOpenPlaylistItemActions(true);
  };
  const folderItemTargetIdsToSkip = React.useMemo(() => {
    if (!selectedFolderItem) return new Set<string>();
    return new Set([selectedFolderItem.id, ...getDescendantFolderIds(allFolders, selectedFolderItem.id)]);
  }, [allFolders, selectedFolderItem]);
  const availableFolderItemTargets = allFolders.filter((folder) => !folderItemTargetIdsToSkip.has(folder.id));
  const renameSelectedFolderItem = async () => {
    if (!selectedFolderItem || !folderItemRenameName.trim()) return;
    const rows = await db.getFolders();
    await db.saveFolders(
      rows.map((folder) =>
        folder.id === selectedFolderItem.id ? { ...folder, name: folderItemRenameName } : folder
      )
    );
    setOpenRenameFolderItem(false);
    setSelectedFolderItem(null);
    setFolderItemRenameName('');
    load();
  };
  const moveSelectedFolderItem = async (targetFolderId: string | null) => {
    if (!selectedFolderItem) return;
    if (targetFolderId && folderItemTargetIdsToSkip.has(targetFolderId)) return;
    const rows = await db.getFolders();
    await db.saveFolders(
      rows.map((folder) =>
        folder.id === selectedFolderItem.id ? { ...folder, parentId: targetFolderId } : folder
      )
    );
    setOpenMoveFolderItem(false);
    setSelectedFolderItem(null);
    load();
  };
  const deleteSelectedFolderItem = async () => {
    if (!selectedFolderItem) return;
    const rows = await db.getFolders();
    const idsToDelete = new Set([selectedFolderItem.id, ...getDescendantFolderIds(rows, selectedFolderItem.id)]);
    const allPlaylists = await db.getPlaylists();
    const playlistCount = allPlaylists.filter((playlist) => playlist.folderId && idsToDelete.has(playlist.folderId)).length;
    const subfolderCount = idsToDelete.size - 1;
    setOpenFolderItemActions(false);
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja excluir a pasta "${selectedFolderItem.name}"?` +
        `${subfolderCount ? ` Também serão excluídas ${subfolderCount} subpastas.` : ''}` +
        `${playlistCount ? ` Listas dentro dela: ${playlistCount}.` : ''}` +
        ' As músicas continuarão na biblioteca, mas os vínculos com a pasta serão removidos.'
    );
    if (!confirmed) {
      setSelectedFolderItem(null);
      return;
    }

    await db.saveFolders(rows.filter((folder) => !idsToDelete.has(folder.id)));
    await db.savePlaylists(
      allPlaylists.filter((playlist) => !playlist.folderId || !idsToDelete.has(playlist.folderId))
    );
    await db.removeFolderSongLinks(Array.from(idsToDelete));
    setOpenFolderItemActions(false);
    setSelectedFolderItem(null);
    load();
  };
  const renameSelectedPlaylistItem = async () => {
    if (!selectedPlaylistItem || !playlistItemRenameName.trim()) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((playlist) =>
        playlist.id === selectedPlaylistItem.id ? { ...playlist, name: playlistItemRenameName } : playlist
      )
    );
    setOpenRenamePlaylistItem(false);
    setSelectedPlaylistItem(null);
    setPlaylistItemRenameName('');
    load();
  };
  const removeSelectedPlaylistFromFolder = async () => {
    if (!selectedPlaylistItem) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((playlist) =>
        playlist.id === selectedPlaylistItem.id ? { ...playlist, folderId: null } : playlist
      )
    );
    setOpenPlaylistItemActions(false);
    setSelectedPlaylistItem(null);
    load();
  };
  const deleteSelectedPlaylistItem = async () => {
    if (!selectedPlaylistItem) return;
    setOpenPlaylistItemActions(false);
    const confirmed = await confirmDestructiveAction(`Tem certeza que deseja excluir a lista "${selectedPlaylistItem.name}"?`);
    if (!confirmed) {
      setSelectedPlaylistItem(null);
      return;
    }
    const rows = await db.getPlaylists();
    await db.savePlaylists(rows.filter((playlist) => playlist.id !== selectedPlaylistItem.id));
    setOpenPlaylistItemActions(false);
    setSelectedPlaylistItem(null);
    load();
  };
  const shareSelectedPlaylistItem = async () => {
    if (!selectedPlaylistItem) return;
    const playlistToShare = selectedPlaylistItem;
    const songsById = new Map(allSongs.map((song) => [song.id, song]));
    setOpenPlaylistItemActions(false);
    setSelectedPlaylistItem(null);
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

  const songsById = React.useMemo(() => new Map(allSongs.map((song) => [song.id, song])), [allSongs]);
  const folderMatchesGenreFilter = (targetFolderId: string): boolean => {
    if (globalFilters.selectedGenres.length === 0) return true;
    const directSongIds = folderSongMap[targetFolderId] || [];
    const directPlaylists = allPlaylists.filter((playlist) => playlist.folderId === targetFolderId);
    const directSubfolders = allFolders.filter((folder) => folder.parentId === targetFolderId);
    if (directSongIds.length === 0 && directPlaylists.length === 0 && directSubfolders.length === 0) return true;
    const directSongsMatch = directSongIds.some((songId) =>
      matchesGenreFilter(songsById.get(songId) || null, globalFilters.selectedGenres)
    );
    if (directSongsMatch) return true;
    const directPlaylistsMatch = directPlaylists.some((playlist) =>
      playlistMatchesGenreFilter(playlist, globalFilters.selectedGenres, songsById)
    );
    if (directPlaylistsMatch) return true;
    return directSubfolders.some((subfolder) => folderMatchesGenreFilter(subfolder.id));
  };
  const folderSongs = allSongs
    .filter((s) => folderSongIds.includes(s.id))
    .filter((s) => matchesGenreFilter(s, globalFilters.selectedGenres));
  const visiblePlaylists = playlists.filter((playlist) =>
    playlistMatchesGenreFilter(playlist, globalFilters.selectedGenres, songsById)
  );
  const visibleSubfolders = subfolders.filter((subfolder) => folderMatchesGenreFilter(subfolder.id));
  const getFolderDirectStats = (targetFolderId: string) => ({
    songs: folderSongMap[targetFolderId]?.length || 0,
    subfolders: allFolders.filter((item) => item.parentId === targetFolderId).length,
    lists: allPlaylists.filter((playlist) => playlist.folderId === targetFolderId).length,
  });
  const getFolderSubtitle = (targetFolder: Folder) => {
    const depth = getFolderDepth(targetFolder.id, allFolders);
    const parent = targetFolder.parentId ? allFolders.find((item) => item.id === targetFolder.parentId) : null;
    const kind = depth >= 3 ? 'Sub-subpasta' : depth === 2 ? 'Subpasta' : 'Pasta';
    const stats = formatDirectStats(getFolderDirectStats(targetFolder.id));
    return parent ? `${kind} de ${parent.name} — ${stats}` : stats;
  };
  const getFolderOptionSubtitle = (targetFolder: Folder) => {
    const parent = targetFolder.parentId ? allFolders.find((item) => item.id === targetFolder.parentId) : null;
    const level = getFolderLevelLabel(targetFolder.id, allFolders);
    return parent ? `${level} de ${parent.name}` : level;
  };
  const renderFolderHierarchyIcon = (targetFolder: Folder, size = 17) => {
    const depth = getFolderDepth(targetFolder.id, allFolders);
    if (depth <= 1) return <FolderIcon size={size} color="#4FC3F7" />;

    return (
      <View style={{ width: size + 5, height: size + 3, position: 'relative' }}>
        <FolderIcon
          size={size - 3}
          color="#2f8fbd"
          style={{ position: 'absolute', left: depth >= 3 ? 0 : 1, top: 0, opacity: 0.78 } as any}
        />
        <FolderIcon
          size={size}
          color="#4FC3F7"
          style={{ position: 'absolute', left: depth >= 3 ? 5 : 4, top: depth >= 3 ? 4 : 3 } as any}
        />
      </View>
    );
  };
  const getPlaylistOptionSubtitle = (playlist: Playlist) => {
    const parent = playlist.folderId ? allFolders.find((item) => item.id === playlist.folderId) : null;
    return `${parent ? `Lista em ${parent.name}` : 'Lista na raiz'} · ${playlist.songIds.length} ${playlist.songIds.length === 1 ? 'música' : 'músicas'}`;
  };
  const currentFolderDepth = getFolderDepth(folderId, allFolders);
  const canCreateChildFolder = currentFolderDepth < 3;
  const canMoveExistingFolderIntoCurrent = (candidate: Folder) => {
    if (!folder) return false;
    if (!canCreateChildFolder) return false;
    if (candidate.id === folder.id) return false;
    if (candidate.parentId === folder.id) return false;
    const currentAncestry = getFolderAncestryIds(folder.id, allFolders);
    if (currentAncestry.has(candidate.id)) return false;
    const candidateSubtreeDepth = getFolderSubtreeDepth(candidate.id, allFolders);
    if (!candidateSubtreeDepth) return false;
    if (currentFolderDepth + candidateSubtreeDepth > 3) return false;
    const candidateContainsCurrentFolder = folderSubtreeContains(allFolders, candidate.id, folder.id);
    if (candidateContainsCurrentFolder !== false) return false;
    return true;
  };
  const availableExistingFolders = allFolders
    .filter(canMoveExistingFolderIntoCurrent)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }));
  const availableExistingPlaylists = allPlaylists
    .filter((playlist) => playlist.folderId !== folderId)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }));
  const existingFolderSearch = normalizeSearchText(existingFolderQuery);
  const existingPlaylistSearch = normalizeSearchText(existingPlaylistQuery);
  const filteredExistingFolders = availableExistingFolders.filter((folderOption) => {
    if (!existingFolderSearch) return true;
    return normalizeSearchText(`${folderOption.name} ${getFolderOptionSubtitle(folderOption)}`).includes(existingFolderSearch);
  });
  const filteredExistingPlaylists = availableExistingPlaylists.filter((playlistOption) => {
    if (!existingPlaylistSearch) return true;
    return normalizeSearchText(`${playlistOption.name} ${getPlaylistOptionSubtitle(playlistOption)}`).includes(existingPlaylistSearch);
  });
  const selectedFolderIdSet = React.useMemo(() => new Set(selectedFolderIds), [selectedFolderIds]);
  const selectedPlaylistIdSet = React.useMemo(() => new Set(selectedPlaylistIds), [selectedPlaylistIds]);
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
  const closeAddExistingFolderModal = () => {
    setOpenAddExistingFolder(false);
    setExistingFolderQuery('');
    setMultiSelectFolders(false);
    setSelectedFolderIds([]);
  };
  const closeAddExistingPlaylistModal = () => {
    setOpenAddExistingPlaylist(false);
    setExistingPlaylistQuery('');
    setMultiSelectPlaylists(false);
    setSelectedPlaylistIds([]);
  };
  const closeAddSongModal = () => {
    setOpenAddSong(false);
    setMultiSelectSongs(false);
    setSelectedSongIds([]);
  };
  const moveExistingFolderIntoCurrent = async (candidate: Folder) => {
    if (!canMoveExistingFolderIntoCurrent(candidate)) return;
    const rows = await db.getFolders();
    await db.saveFolders(
      rows.map((item) => (item.id === candidate.id ? { ...item, parentId: folderId } : item))
    );
    closeAddExistingFolderModal();
    load();
  };
  const moveExistingPlaylistIntoCurrent = async (playlist: Playlist) => {
    if (playlist.folderId === folderId) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((item) => (item.id === playlist.id ? { ...item, folderId } : item))
    );
    closeAddExistingPlaylistModal();
    load();
  };
  const moveSelectedFoldersIntoCurrent = async () => {
    const selected = availableExistingFolders.filter((candidate) => selectedFolderIdSet.has(candidate.id));
    const selectedIds = new Set(selected.map((candidate) => candidate.id));
    const topLevelSelected = selected.filter((candidate) =>
      !Array.from(getFolderAncestryIds(candidate.id, allFolders)).some((ancestorId) => selectedIds.has(ancestorId))
    );
    const validIds = new Set(topLevelSelected.filter(canMoveExistingFolderIntoCurrent).map((candidate) => candidate.id));
    if (!validIds.size) return;
    const rows = await db.getFolders();
    await db.saveFolders(
      rows.map((item) => (validIds.has(item.id) ? { ...item, parentId: folderId } : item))
    );
    closeAddExistingFolderModal();
    load();
  };
  const moveSelectedPlaylistsIntoCurrent = async () => {
    const validIds = new Set(
      availableExistingPlaylists
        .filter((playlist) => selectedPlaylistIdSet.has(playlist.id) && playlist.folderId !== folderId)
        .map((playlist) => playlist.id)
    );
    if (!validIds.size) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((item) => (validIds.has(item.id) ? { ...item, folderId } : item))
    );
    closeAddExistingPlaylistModal();
    load();
  };
  const addSelectedSongsToCurrentFolder = async () => {
    const validSongs = addableSongs.filter((song) => selectedSongIdSet.has(song.id));
    if (!validSongs.length) return;
    await Promise.all(validSongs.map((song) => db.addSongToFolder(folderId, song.id)));
    closeAddSongModal();
    load();
  };
  const hasSubfolders = visibleSubfolders.length > 0;
  const hasPlaylists = visiblePlaylists.length > 0;
  const hasFolderSongs = folderSongs.length > 0;
  const isEmptyFolder = !hasSubfolders && !hasPlaylists && !hasFolderSongs;
  const addModalTitle =
    currentFolderDepth === 1
      ? 'Adicionar à pasta'
      : currentFolderDepth === 2
        ? 'Adicionar à subpasta'
        : 'Adicionar à sub-subpasta';
  const childFolderLabel = currentFolderDepth === 1 ? 'Criar subpasta' : 'Criar sub-subpasta';
  const addableSongs = allSongs
    .filter((s) => !folderSongIds.includes(s.id))
    .filter((s) => matchesGenreFilter(s, globalFilters.selectedGenres));
  const availableSongs = addableSongs
    .filter((s) =>
      !songQ.trim()
        ? true
        : s.title.toLowerCase().includes(songQ.toLowerCase()) ||
          s.artist.toLowerCase().includes(songQ.toLowerCase())
    );
  const removeSongFromCurrentFolder = async (song: Song) => {
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja remover "${song.title}" desta pasta?`,
      'Remover música',
      'Remover'
    );
    if (!confirmed) return;
    await db.removeSongFromFolder(folderId, song.id);
    load();
  };
  useEffect(() => {
    setTopBarControls({
      showAdd: true,
      onAddPress: () => setOpenActions(true),
    });
    return clearTopBarControls;
  }, [clearTopBarControls, setTopBarControls]);
  useEffect(() => {
    if (!openAddOnEnter || openedAddOnEnterRef.current) return;
    openedAddOnEnterRef.current = true;
    setOpenActions(true);
  }, [openAddOnEnter]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {hasSubfolders ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Subpastas</Text>
            {visibleSubfolders.map((sf) => (
              <View key={sf.id} style={styles.listRow}>
                <TouchableOpacity
                  style={styles.cardMainPress}
                  onPress={() => nav.navigate('FolderDetail', {
                    folderId: sf.id,
                    folderName: sf.name,
                    returnTo: songReturnTo,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {renderFolderHierarchyIcon(sf, 16)}

                    <View style={styles.listRowText}>
                      <Text style={styles.title}>{sf.name}</Text>
                      <Text style={styles.subtitle}>{getFolderSubtitle(sf)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.listActionBtn} onPress={() => openActionsForFolderItem(sf)}>
                  <ChevronRight size={18} color="#4FC3F7" />
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : isEmptyFolder ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Subpastas</Text>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Nenhuma subpasta.</Text>
          </>
        ) : null}

        {hasPlaylists ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8, marginTop: 10 }]}>Listas</Text>
            {visiblePlaylists.map((pl) => (
              <View key={pl.id} style={styles.listRow}>
                <TouchableOpacity
                  style={styles.cardMainPress}
                  onPress={() =>
                    nav.navigate('PlaylistDetail', {
                      playlistId: pl.id,
                      playlistName: pl.name,
                      folderId,
                      folderName: folder?.name,
                    })
                  }
                >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <List size={16} color="#ffd166" />

                  <View style={styles.listRowText}>
                    <Text style={styles.title}>{pl.name}</Text>
                    <Text style={styles.subtitle}>{pl.songIds.length} músicas</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listActionBtn} onPress={() => openActionsForPlaylistItem(pl)}>
                <ChevronRight size={18} color="#4FC3F7" />
              </TouchableOpacity>
            </View>
            ))}
          </>
        ) : isEmptyFolder ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8, marginTop: 10 }]}>Listas</Text>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Nenhuma lista.</Text>
          </>
        ) : null}

        {hasFolderSongs ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8, marginTop: 10 }]}>Músicas na pasta</Text>
            {folderSongs.map((s) => (
              <View key={s.id} style={styles.listRow}>
                <TouchableOpacity
                  style={styles.cardMainPress}
                  onPress={() => nav.navigate('SongDetail', { id: s.id, returnTo: songReturnTo })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Music2 size={16} color="#4FC3F7" />
                    <View style={styles.listRowText}>
                      <Text style={styles.title}>{s.title}</Text>
                      <Text style={styles.subtitle}>{s.artist}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeSongFromCurrentFolder(s)}>
                  <Trash2 size={18} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : isEmptyFolder ? (
          <>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8, marginTop: 10 }]}>Músicas na pasta</Text>
            <Text style={[styles.subtitle, { marginHorizontal: 12, marginBottom: 8 }]}>Nenhuma música nesta pasta.</Text>
          </>
        ) : null}
      </ScrollView>

      <AppModal
        visible={openActions}
        title={addModalTitle}
        onClose={() => setOpenActions(false)}
        icon={<Plus size={16} color="var(--app-accent)" />}
        footer={
          <TouchableOpacity onPress={() => setOpenActions(false)}>
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <View style={{ gap: 8, marginBottom: 12 }}>
          <Text style={[styles.subtitle, { marginHorizontal: 2, fontWeight: '900', textTransform: 'uppercase' as any, letterSpacing: 0.4 }]}>
            Criar
          </Text>
          <View style={{ borderWidth: 1, borderColor: 'var(--app-border-soft)', borderRadius: 12, padding: 8, gap: 8, backgroundColor: 'var(--app-surface)' }}>
            {canCreateChildFolder ? (
              <TouchableOpacity style={[styles.card, { marginHorizontal: 0 }]} onPress={() => { setOpenActions(false); setOpenFolder(true); }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <FolderIcon size={17} color="#4FC3F7" />
                  <Text style={styles.title}>{childFolderLabel}</Text>
                </View>
                <ChevronRight size={18} color="#777" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.card, { marginHorizontal: 0 }]} onPress={() => { setOpenActions(false); setOpenPlaylist(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <List size={17} color="#ffd166" />
                <Text style={styles.title}>Criar lista</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[styles.subtitle, { marginHorizontal: 2, fontWeight: '900', textTransform: 'uppercase' as any, letterSpacing: 0.4 }]}>
            Adicionar existentes
          </Text>
          <View style={{ borderWidth: 1, borderColor: 'var(--app-border-soft)', borderRadius: 12, padding: 8, gap: 8, backgroundColor: 'var(--app-surface)' }}>
            {canCreateChildFolder ? (
              <TouchableOpacity
                style={[styles.card, { marginHorizontal: 0 }]}
                onPress={() => {
                  setOpenActions(false);
                  setExistingFolderQuery('');
                  setOpenAddExistingFolder(true);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <FolderPlus size={17} color="#4FC3F7" />
                  <Text style={styles.title}>Adicionar subpasta</Text>
                </View>
                <ChevronRight size={18} color="#777" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.card, { marginHorizontal: 0 }]}
              onPress={() => {
                setOpenActions(false);
                setExistingPlaylistQuery('');
                setOpenAddExistingPlaylist(true);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <List size={17} color="#ffd166" />
                <Text style={styles.title}>Adicionar lista</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.card, { marginHorizontal: 0 }]} onPress={() => { setOpenActions(false); setSongQ(''); setOpenAddSong(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Music2 size={17} color="#4FC3F7" />
                <Text style={styles.title}>Adicionar música</Text>
              </View>
              <ChevronRight size={18} color="#777" />
            </TouchableOpacity>
          </View>
        </View>
      </AppModal>

      <AppModal
        visible={openAddExistingFolder}
        title="Adicionar subpasta"
        onClose={closeAddExistingFolderModal}
        icon={<FolderPlus size={16} color="#4FC3F7" />}
        maxWidth={520}
        footer={
          <>
            <TouchableOpacity onPress={closeAddExistingFolderModal}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
            </TouchableOpacity>
            {multiSelectFolders && selectedFolderIds.length ? (
              <TouchableOpacity onPress={moveSelectedFoldersIntoCurrent}>
                <Text style={{ color: '#4FC3F7', fontWeight: '900' }}>Mover selecionados</Text>
              </TouchableOpacity>
            ) : null}
          </>
        }
      >
        <Text style={styles.createHint}>Escolha uma pasta existente para mover para dentro desta pasta.</Text>
        {renderSelectionToggle(multiSelectFolders, selectedFolderIds.length, () => {
          const next = !multiSelectFolders;
          setMultiSelectFolders(next);
          if (!next) setSelectedFolderIds([]);
        })}
        <View style={[styles.search, { marginHorizontal: 0, marginBottom: 10 }]}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar pasta..."
            placeholderTextColor="#666"
            value={existingFolderQuery}
            onChangeText={setExistingFolderQuery}
            autoFocus
          />
        </View>
        <ScrollView style={{ marginTop: 4, maxHeight: 420 }}>
          {filteredExistingFolders.length ? (
            filteredExistingFolders.map((folderOption) => {
              return (
                <TouchableOpacity
                  key={folderOption.id}
                  style={[
                    styles.modalActionBtn,
                    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
                  ]}
                  onPress={() => {
                    if (multiSelectFolders) {
                      setSelectedFolderIds((ids) => toggleId(ids, folderOption.id));
                      return;
                    }
                    moveExistingFolderIntoCurrent(folderOption);
                  }}
                >
                  <View style={[styles.createOptionLeft, { flex: 1, minWidth: 0 }]}>
                    {renderFolderHierarchyIcon(folderOption)}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.modalActionText}>{folderOption.name}</Text>
                      <Text style={styles.subtitle}>{getFolderOptionSubtitle(folderOption)}</Text>
                    </View>
                  </View>
                  {multiSelectFolders ? (
                    renderSelectionCheck(selectedFolderIdSet.has(folderOption.id))
                  ) : (
                    <View style={{ width: 22, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
                      <ChevronRight size={18} color="#777" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={[styles.subtitle, { marginTop: 6 }]}>
              {availableExistingFolders.length ? 'Nenhuma pasta encontrada.' : 'Nenhuma pasta disponível para adicionar aqui.'}
            </Text>
          )}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={openAddExistingPlaylist}
        title="Adicionar lista"
        onClose={closeAddExistingPlaylistModal}
        icon={<List size={16} color="#ffd166" />}
        maxWidth={520}
        footer={
          <>
            <TouchableOpacity onPress={closeAddExistingPlaylistModal}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
            </TouchableOpacity>
            {multiSelectPlaylists && selectedPlaylistIds.length ? (
              <TouchableOpacity onPress={moveSelectedPlaylistsIntoCurrent}>
                <Text style={{ color: '#4FC3F7', fontWeight: '900' }}>Mover selecionados</Text>
              </TouchableOpacity>
            ) : null}
          </>
        }
      >
        <Text style={styles.createHint}>Escolha uma lista existente para mover para dentro desta pasta.</Text>
        {renderSelectionToggle(multiSelectPlaylists, selectedPlaylistIds.length, () => {
          const next = !multiSelectPlaylists;
          setMultiSelectPlaylists(next);
          if (!next) setSelectedPlaylistIds([]);
        })}
        <View style={[styles.search, { marginHorizontal: 0, marginBottom: 10 }]}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar lista..."
            placeholderTextColor="#666"
            value={existingPlaylistQuery}
            onChangeText={setExistingPlaylistQuery}
            autoFocus
          />
        </View>
        <ScrollView style={{ marginTop: 4, maxHeight: 420 }}>
          {filteredExistingPlaylists.length ? (
            filteredExistingPlaylists.map((playlistOption) => {
              return (
                <TouchableOpacity
                  key={playlistOption.id}
                  style={[
                    styles.modalActionBtn,
                    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
                  ]}
                  onPress={() => {
                    if (multiSelectPlaylists) {
                      setSelectedPlaylistIds((ids) => toggleId(ids, playlistOption.id));
                      return;
                    }
                    moveExistingPlaylistIntoCurrent(playlistOption);
                  }}
                >
                  <View style={[styles.createOptionLeft, { flex: 1, minWidth: 0 }]}>
                    <List size={17} color="#ffd166" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.modalActionText}>{playlistOption.name}</Text>
                      <Text style={styles.subtitle}>{getPlaylistOptionSubtitle(playlistOption)}</Text>
                    </View>
                  </View>
                  {multiSelectPlaylists ? (
                    renderSelectionCheck(selectedPlaylistIdSet.has(playlistOption.id))
                  ) : (
                    <View style={{ width: 22, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
                      <ChevronRight size={18} color="#777" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={[styles.subtitle, { marginTop: 6 }]}>
              {availableExistingPlaylists.length ? 'Nenhuma lista encontrada.' : 'Nenhuma lista disponível para adicionar aqui.'}
            </Text>
          )}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={openPlaylist}
        title="Nova lista"
        onClose={() => setOpenPlaylist(false)}
        icon={<List size={16} color="var(--app-accent)" />}
        maxWidth={420}
        footer={
          <>
            <TouchableOpacity onPress={() => setOpenPlaylist(false)}>
              <Text style={{ color: 'var(--app-muted-text)', fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={createPlaylist}>
              <Text style={{ color: 'var(--app-accent)', fontWeight: '900' }}>Criar</Text>
            </TouchableOpacity>
          </>
        }
      >
        <TextInput
          style={styles.input}
          value={playlistName}
          onChangeText={setPlaylistName}
          placeholder="Ex: Leandro e Leonardo"
          placeholderTextColor="#666"
          autoFocus
        />
      </AppModal>

      <AppModal
        visible={openFolder}
        title="Nova pasta"
        onClose={() => setOpenFolder(false)}
        icon={<FolderPlus size={16} color="#4FC3F7" />}
        footer={
          <>
            <TouchableOpacity onPress={() => setOpenFolder(false)}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={createSubfolder}>
              <Text style={{ color: '#4FC3F7', fontWeight: '900' }}>Criar</Text>
            </TouchableOpacity>
          </>
        }
      >
        <TextInput style={styles.input} value={folderName} onChangeText={setFolderName} placeholder="Ex: Modão antigo" placeholderTextColor="#666" autoFocus />
      </AppModal>

      <AppModal
        visible={openAddSong}
        title="Adicionar músicas"
        onClose={closeAddSongModal}
        icon={<Music2 size={16} color="#4FC3F7" />}
        maxWidth={520}
        footer={
          <>
            <TouchableOpacity onPress={closeAddSongModal}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
            </TouchableOpacity>
            {multiSelectSongs && selectedSongIds.length ? (
              <TouchableOpacity onPress={addSelectedSongsToCurrentFolder}>
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
            value={songQ}
            onChangeText={setSongQ}
            autoFocus
          />
        </View>
        <ScrollView style={{ marginTop: 4, maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 10 }}>
          {availableSongs.length ? (
            availableSongs.map((s) => (
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
                  await db.addSongToFolder(folderId, s.id);
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

      <AppModal
          visible={openFolderItemActions}
          title="Opções da pasta"
          onClose={() => {
            setOpenFolderItemActions(false);
            setSelectedFolderItem(null);
          }}
          icon={<FolderIcon size={16} color="#4FC3F7" />}
          footer={
            <TouchableOpacity
              onPress={() => {
                setOpenFolderItemActions(false);
                setSelectedFolderItem(null);
              }}
            >
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
            </TouchableOpacity>
          }
        >
          <Text style={styles.createHint}>{selectedFolderItem?.name || ''}</Text>

          <TouchableOpacity
            style={[styles.modalActionBtn, styles.songActionOptionBtn]}
            onPress={() => {
              setOpenFolderItemActions(false);
              setFolderItemRenameName(selectedFolderItem?.name || '');
              setOpenRenameFolderItem(true);
            }}
          >
            <View style={styles.createOptionLeft}>
              <Pencil size={17} color="#4FC3F7" />
              <Text style={styles.modalActionText}>Editar nome</Text>
            </View>

            <ChevronRight size={18} color="#777" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modalActionBtn, styles.songActionOptionBtn]}
            onPress={() => {
              setOpenFolderItemActions(false);
              setOpenMoveFolderItem(true);
            }}
          >
            <View style={styles.createOptionLeft}>
              <FolderIcon size={17} color="#4FC3F7" />
              <Text style={styles.modalActionText}>Enviar para pasta...</Text>
            </View>

            <ChevronRight size={18} color="#777" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modalActionBtn,
              styles.songActionOptionBtn,
              styles.modalDangerBtn,
            ]}
            onPress={deleteSelectedFolderItem}
          >
            <View style={styles.createOptionLeft}>
              <Trash2 size={17} color="#ff7a7a" />
              <Text style={styles.modalDangerText}>Excluir pasta</Text>
            </View>
          </TouchableOpacity>
        </AppModal>

      <AppModal
        visible={openRenameFolderItem}
        title="Editar nome da subpasta"
        onClose={() => setOpenRenameFolderItem(false)}
        icon={<FolderPlus size={16} color="#4FC3F7" />}
        footer={
          <>
            <TouchableOpacity onPress={() => setOpenRenameFolderItem(false)}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={renameSelectedFolderItem}>
              <Text style={{ color: '#4FC3F7', fontWeight: '900' }}>Salvar</Text>
            </TouchableOpacity>
          </>
        }
      >
        <TextInput
          style={styles.input}
          value={folderItemRenameName}
          onChangeText={setFolderItemRenameName}
          placeholder="Novo nome"
          placeholderTextColor="#666"
          autoFocus
        />
      </AppModal>

      <AppModal
        visible={openMoveFolderItem}
        title="Enviar para pasta"
        onClose={() => setOpenMoveFolderItem(false)}
        icon={<FolderIcon size={16} color="#4FC3F7" />}
        footer={
          <TouchableOpacity onPress={() => setOpenMoveFolderItem(false)}>
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>Escolha o destino da pasta.</Text>
        <ScrollView style={{ marginTop: 4, maxHeight: 420 }}>
          <TouchableOpacity style={styles.modalActionBtn} onPress={() => moveSelectedFolderItem(null)}>
            <Text style={styles.modalActionText}>Raiz (Pastas/Listas)</Text>
          </TouchableOpacity>
          {availableFolderItemTargets.length ? (
            availableFolderItemTargets.map((folderOption) => (
              <TouchableOpacity
                key={folderOption.id}
                style={styles.modalActionBtn}
                onPress={() => moveSelectedFolderItem(folderOption.id)}
              >
                <Text style={styles.modalActionText}>{folderOption.name}</Text>
                <Text style={styles.subtitle}>{folderOption.parentId ? 'Subpasta' : 'Pasta'}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[styles.subtitle, { marginTop: 6 }]}>Nenhuma pasta disponível.</Text>
          )}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={openPlaylistItemActions}
        title="Opções da lista"
        onClose={() => {
          setOpenPlaylistItemActions(false);
          setSelectedPlaylistItem(null);
        }}
        icon={<List size={16} color="#ffd166" />}
        footer={
          <TouchableOpacity
            onPress={() => {
              setOpenPlaylistItemActions(false);
              setSelectedPlaylistItem(null);
            }}
          >
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>{selectedPlaylistItem?.name || ''}</Text>
        <TouchableOpacity
          style={[styles.modalActionBtn, styles.songActionOptionBtn]}
          onPress={() => {
            setOpenPlaylistItemActions(false);
            setPlaylistItemRenameName(selectedPlaylistItem?.name || '');
            setOpenRenamePlaylistItem(true);
          }}
        >
          <View style={styles.createOptionLeft}>
            <Pencil size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Editar nome</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={removeSelectedPlaylistFromFolder}>
          <View style={styles.createOptionLeft}>
            <FolderIcon size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Sair da pasta</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={shareSelectedPlaylistItem}>
          <View style={styles.createOptionLeft}>
            <Share2 size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Compartilhar lista</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalActionBtn, styles.songActionOptionBtn, styles.modalDangerBtn]}
          onPress={deleteSelectedPlaylistItem}
        >
          <View style={styles.createOptionLeft}>
            <Trash2 size={17} color="#ff7a7a" />
            <Text style={styles.modalDangerText}>Excluir lista</Text>
          </View>
        </TouchableOpacity>
      </AppModal>

      <AppModal
        visible={openRenamePlaylistItem}
        title="Editar nome da lista"
        onClose={() => setOpenRenamePlaylistItem(false)}
        icon={<List size={16} color="#ffd166" />}
        footer={
          <>
            <TouchableOpacity onPress={() => setOpenRenamePlaylistItem(false)}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={renameSelectedPlaylistItem}>
              <Text style={{ color: '#4FC3F7', fontWeight: '900' }}>Salvar</Text>
            </TouchableOpacity>
          </>
        }
      >
        <TextInput
          style={styles.input}
          value={playlistItemRenameName}
          onChangeText={setPlaylistItemRenameName}
          placeholder="Novo nome"
          placeholderTextColor="#666"
          autoFocus
        />
      </AppModal>
    </View>
  );
}
