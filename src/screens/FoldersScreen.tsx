import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ChevronRight, Copy, Folder as FolderIcon, FolderInput, FolderPlus, ListMusic, Pencil, Plus, Search, Share2, Star, Trash2 } from 'lucide-react';
import { useConfirmDestructiveAction } from '../components/ConfirmDialog';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { AppModal } from '../components/AppModal';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTopBarControls } from '../contexts/TopBarContext';
import { db } from '../services/storage';
import { buildCifrasGoFolderBackupZip } from '../services/backup';
import { buildPlaylistZip, sanitizeFileName, shareBlobFile } from '../services/share';
import type { Folder, Playlist, Song } from '../types/models';
import { sortFolderPlaylistDisplayItems, type FolderPlaylistDisplayItem } from '../utils/folderPlaylistDisplay';
import { getDescendantFolderIds, matchesGenreFilter, playlistMatchesGenreFilter } from '../utils/genres';
import { createDuplicatedPlaylist, insertPlaylistAfterSource } from '../utils/playlistDuplication';
import { toggleStarredFolder, toggleStarredPlaylist } from '../utils/starredItems';
import { useDevScreenPerformance } from '../utils/devPerformance';

interface FoldersScreenProps {
  styles: any;
  sessionState: {
    query: string;
    searchOn: boolean;
    viewFilter: 'all' | 'playlists' | 'folders';
    scrollOffset: number;
  };
}

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

const getFolderPath = (folderId: string | null | undefined, folders: Folder[]) => {
  if (!folderId) return [];
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const visited = new Set<string>();
  const path: Folder[] = [];
  let current = byId.get(folderId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return path;
};

const formatDirectStats = (stats: { songs: number; subfolders: number; lists: number }) => {
  const parts: string[] = [];
  if (stats.subfolders) parts.push(`${stats.subfolders} ${stats.subfolders === 1 ? 'subpasta' : 'subpastas'}`);
  if (stats.songs) parts.push(`${stats.songs} ${stats.songs === 1 ? 'música' : 'músicas'}`);
  if (stats.lists) parts.push(`${stats.lists} ${stats.lists === 1 ? 'lista' : 'listas'}`);
  return parts.length ? parts.join(' · ') : 'Pasta vazia';
};

const renderFolderHierarchyIcon = (depth: number, size = 16) => {
  if (depth <= 1) return <FolderIcon size={size} color="#a855f7" />;

  return (
    <View style={{ width: size + 7, height: size + 4, position: 'relative', marginLeft: depth >= 3 ? 2 : 0 }}>
      <FolderIcon
        size={size - 3}
        color="#7e22ce"
        style={{ position: 'absolute', left: depth >= 3 ? 0 : 1, top: 0, opacity: 0.75 } as any}
      />
      {depth >= 3 ? (
        <FolderPlus
          size={size - 4}
          color="#c084fc"
          style={{ position: 'absolute', left: 4, top: 3, opacity: 0.7 } as any}
        />
      ) : null}
      <FolderIcon
        size={size}
        color="#a855f7"
        style={{ position: 'absolute', left: depth >= 3 ? 7 : 5, top: depth >= 3 ? 5 : 4 } as any}
      />
    </View>
  );
};

const renderFolderListIconTile = (icon: React.ReactNode, isFolder = false) => (
  <View style={[localStyles.listIconTile, isFolder && localStyles.folderListIconTile]}>
    {icon}
  </View>
);

export function FoldersScreen({
  styles,
  sessionState,
}: FoldersScreenProps) {
  useDevScreenPerformance('Folders');
  const nav = useManualNavigation();
  const { setTopBarControls, clearTopBarControls } = useTopBarControls();
  const { globalFilters } = useGenreFilter();
  const { favoriteMode, folderPlaylistDisplayMode } = useSettings();
  const confirmDestructiveAction = useConfirmDestructiveAction();
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [folderSongMap, setFolderSongMap] = useState<Record<string, string[]>>({});
  const [listReady, setListReady] = useState(false);
  const [viewFilter, setViewFilter] = useState<'all' | 'playlists' | 'folders'>(() => sessionState.viewFilter);
  const [openCreateType, setOpenCreateType] = useState(false);
  const [openCreateFolder, setOpenCreateFolder] = useState(false);
  const [openCreatePlaylist, setOpenCreatePlaylist] = useState(false);
  const [openFolderActions, setOpenFolderActions] = useState(false);
  const [openRenameFolder, setOpenRenameFolder] = useState(false);
  const [openMoveFolder, setOpenMoveFolder] = useState(false);
  const [openPlaylistActions, setOpenPlaylistActions] = useState(false);
  const [openRenamePlaylist, setOpenRenamePlaylist] = useState(false);
  const [openMovePlaylist, setOpenMovePlaylist] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [name, setName] = useState('');
  const [folderRenameName, setFolderRenameName] = useState('');
  const [playlistRenameName, setPlaylistRenameName] = useState('');
  const [q, setQ] = useState(() => sessionState.query);
  const [searchOn, setSearchOn] = useState(() => sessionState.searchOn);
  const userScrolledListRef = React.useRef(false);
  const load = async () => {
    const [allFolders, allPlaylists, songs, storedFolderSongMap] = await Promise.all([
      db.getFolders(),
      db.getPlaylists(),
      db.getSongs(),
      db.getFolderSongMap(),
    ]);
    const nextFolderSongMap = Object.fromEntries(
      allFolders.map((folder) => [folder.id, storedFolderSongMap[folder.id] || []])
    );

    setAllFolders(allFolders);
    setAllPlaylists(allPlaylists);
    setAllSongs(songs);
    setFolderSongMap(nextFolderSongMap);
    setListReady(true);
  };
  useEffect(() => { load(); }, []);
  const createFolder = async () => {
    if (!name.trim()) return;
    const created = await db.addFolder(name, null);
    setName('');
    setOpenCreateFolder(false);
    await load();
    nav.navigate('FolderDetail', { folderId: created.id, folderName: created.name, openAddOnEnter: true });
  };
  const createPlaylist = async () => {
    if (!name.trim()) return;
    const created = await db.addPlaylist(null, name);
    setName('');
    setOpenCreatePlaylist(false);
    await load();
    nav.navigate('PlaylistDetail', { playlistId: created.id, playlistName: created.name, openAddOnEnter: true });
  };
  const songsById = React.useMemo(() => new Map(allSongs.map((song) => [song.id, song])), [allSongs]);
  const folderMatchesGenreFilter = (folderId: string): boolean => {
    if (globalFilters.selectedGenres.length === 0) return true;
    const directSongIds = folderSongMap[folderId] || [];
    const directPlaylists = allPlaylists.filter((playlist) => playlist.folderId === folderId);
    const directSubfolders = allFolders.filter((folder) => folder.parentId === folderId);
    if (directSongIds.length === 0 && directPlaylists.length === 0 && directSubfolders.length === 0) return true;
    const directSongsMatch = (folderSongMap[folderId] || []).some((songId) =>
      matchesGenreFilter(songsById.get(songId) || null, globalFilters.selectedGenres)
    );
    if (directSongsMatch) return true;
    const directPlaylistsMatch = directPlaylists.some((playlist) =>
      playlistMatchesGenreFilter(playlist, globalFilters.selectedGenres, songsById)
    );
    if (directPlaylistsMatch) return true;
    return directSubfolders.some((folder) => folderMatchesGenreFilter(folder.id));
  };
  const getFolderDirectStats = (folderId: string) => ({
    songs: folderSongMap[folderId]?.length || 0,
    subfolders: allFolders.filter((folder) => folder.parentId === folderId).length,
    lists: allPlaylists.filter((playlist) => playlist.folderId === folderId).length,
  });
  const getFolderSubtitle = (folder: Folder) => {
    const depth = getFolderDepth(folder.id, allFolders);
    const parent = folder.parentId ? allFolders.find((item) => item.id === folder.parentId) : null;
    const stats = formatDirectStats(getFolderDirectStats(folder.id));
    if (depth === 1) return stats;
    const kind = depth === 2 ? 'Subpasta' : 'Sub-subpasta';
    return `${kind} de ${parent?.name || 'Pasta'} — ${stats}`;
  };
  const getPlaylistSubtitle = (playlist: Playlist) => {
    const count = `${playlist.songIds.length} ${playlist.songIds.length === 1 ? 'música' : 'músicas'}`;
    const path = getFolderPath(playlist.folderId, allFolders).map((folder) => folder.name).join(' / ');
    return path ? `Lista em ${path} — ${count}` : count;
  };
  const query = q.trim().toLowerCase();
  const folderSearchText = (folder: Folder) =>
    [folder.name, ...getFolderPath(folder.parentId, allFolders).map((item) => item.name)].join(' ').toLowerCase();
  const playlistSearchText = (playlist: Playlist) =>
    [playlist.name, ...getFolderPath(playlist.folderId, allFolders).map((item) => item.name)].join(' ').toLowerCase();
  const visibleFolders = allFolders.filter((f) => {
    if (query && !folderSearchText(f).includes(query)) return false;
    return folderMatchesGenreFilter(f.id);
  });
  const visiblePlaylists = allPlaylists.filter((p) => {
    if (query && !playlistSearchText(p).includes(query)) return false;
    return playlistMatchesGenreFilter(p, globalFilters.selectedGenres, songsById);
  });
  const visibleItems: FolderPlaylistDisplayItem[] = sortFolderPlaylistDisplayItems(
    viewFilter === 'all' || viewFilter === 'folders' ? visibleFolders : [],
    viewFilter === 'all' || viewFilter === 'playlists' ? visiblePlaylists : [],
    favoriteMode,
    folderPlaylistDisplayMode
  );
  const viewFilterOptions: Array<{ value: typeof viewFilter; label: string }> = [
    { value: 'all', label: 'Tudo' },
    { value: 'playlists', label: 'Listas' },
    { value: 'folders', label: 'Pastas' },
  ];
  const openActionsForPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setOpenPlaylistActions(true);
  };
  const openActionsForFolder = (folder: Folder) => {
    setSelectedFolder(folder);
    setOpenFolderActions(true);
  };
  const toggleFolderStar = async (folderId: string) => {
    const next = toggleStarredFolder(allFolders, folderId, favoriteMode);
    if (next === allFolders) return;
    setAllFolders(next);
    await db.saveFolders(next);
  };
  const togglePlaylistStar = async (playlistId: string) => {
    const next = toggleStarredPlaylist(allPlaylists, playlistId, favoriteMode);
    if (next === allPlaylists) return;
    setAllPlaylists(next);
    await db.savePlaylists(next);
  };
  const folderTargetIdsToSkip = React.useMemo(() => {
    if (!selectedFolder) return new Set<string>();
    return new Set([selectedFolder.id, ...getDescendantFolderIds(allFolders, selectedFolder.id)]);
  }, [allFolders, selectedFolder]);
  const availableFolderTargets = allFolders.filter((folder) => !folderTargetIdsToSkip.has(folder.id));
  const renameSelectedFolder = async () => {
    if (!selectedFolder || !folderRenameName.trim()) return;
    const rows = await db.getFolders();
    await db.saveFolders(
      rows.map((folder) =>
        folder.id === selectedFolder.id ? { ...folder, name: folderRenameName } : folder
      )
    );
    setOpenRenameFolder(false);
    setSelectedFolder(null);
    setFolderRenameName('');
    load();
  };
  const deleteSelectedFolder = async () => {
    if (!selectedFolder) return;
    const rows = await db.getFolders();
    const idsToDelete = new Set([selectedFolder.id, ...getDescendantFolderIds(rows, selectedFolder.id)]);
    const playlists = await db.getPlaylists();
    const playlistCount = playlists.filter((playlist) => playlist.folderId && idsToDelete.has(playlist.folderId)).length;
    const subfolderCount = idsToDelete.size - 1;
    setOpenFolderActions(false);
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja excluir a pasta "${selectedFolder.name}"?` +
        `${subfolderCount ? ` Também serão excluídas ${subfolderCount} subpastas.` : ''}` +
        `${playlistCount ? ` Listas dentro dela: ${playlistCount}.` : ''}` +
        ' As músicas continuarão na biblioteca, mas os vínculos com a pasta serão removidos.'
    );
    if (!confirmed) {
      setSelectedFolder(null);
      return;
    }

    await db.saveFolders(rows.filter((folder) => !idsToDelete.has(folder.id)));
    await db.savePlaylists(
      playlists.filter((playlist) => !playlist.folderId || !idsToDelete.has(playlist.folderId))
    );
    await db.removeFolderSongLinks(Array.from(idsToDelete));
    setOpenFolderActions(false);
    setSelectedFolder(null);
    load();
  };
  const renameSelectedPlaylist = async () => {
    if (!selectedPlaylist || !playlistRenameName.trim()) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((pl) => (pl.id === selectedPlaylist.id ? { ...pl, name: playlistRenameName } : pl))
    );
    setOpenRenamePlaylist(false);
    setSelectedPlaylist(null);
    setPlaylistRenameName('');
    load();
  };
  const deleteSelectedPlaylist = async () => {
    if (!selectedPlaylist) return;
    setOpenPlaylistActions(false);
    const confirmed = await confirmDestructiveAction(`Tem certeza que deseja excluir a lista "${selectedPlaylist.name}"?`);
    if (!confirmed) {
      setSelectedPlaylist(null);
      return;
    }
    const rows = await db.getPlaylists();
    await db.savePlaylists(rows.filter((pl) => pl.id !== selectedPlaylist.id));
    setOpenPlaylistActions(false);
    setSelectedPlaylist(null);
    load();
  };
  const shareSelectedPlaylist = async () => {
    if (!selectedPlaylist) return;
    const playlistToShare = selectedPlaylist;
    const songsById = new Map(allSongs.map((song) => [song.id, song]));
    setOpenPlaylistActions(false);
    setSelectedPlaylist(null);
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
  const duplicateSelectedPlaylist = async () => {
    if (!selectedPlaylist) return;
    const rows = await db.getPlaylists();
    const source = rows.find((playlist) => playlist.id === selectedPlaylist.id) || selectedPlaylist;
    const duplicate = createDuplicatedPlaylist(source, rows);
    await db.savePlaylists(insertPlaylistAfterSource(rows, source.id, duplicate));
    setOpenPlaylistActions(false);
    setSelectedPlaylist(null);
    await load();
    nav.navigate('PlaylistDetail', {
      playlistId: duplicate.id,
      playlistName: duplicate.name,
      folderId: duplicate.folderId ?? null,
    });
  };
  const shareSelectedFolder = async () => {
    if (!selectedFolder) return;
    const folderToShare = selectedFolder;
    setOpenFolderActions(false);
    setSelectedFolder(null);
    const blob = await buildCifrasGoFolderBackupZip(folderToShare.id);
    const fileName = `${sanitizeFileName(folderToShare.name || 'pasta')}.zip`;
    await shareBlobFile({
      blob,
      fileName,
      title: folderToShare.name || 'Pasta',
      text: `Pasta "${folderToShare.name || 'Pasta'}" exportada pelo CifrasGo.`,
      fallbackMessage: 'Não foi possível abrir o compartilhamento nativo. O ZIP da pasta foi baixado como alternativa.',
    });
  };
  const moveSelectedFolder = async (targetFolderId: string | null) => {
    if (!selectedFolder) return;
    if (targetFolderId && folderTargetIdsToSkip.has(targetFolderId)) return;
    const rows = await db.getFolders();
    await db.saveFolders(
      rows.map((folder) =>
        folder.id === selectedFolder.id ? { ...folder, parentId: targetFolderId } : folder
      )
    );
    setOpenMoveFolder(false);
    setSelectedFolder(null);
    load();
  };
  const moveSelectedPlaylist = async (targetFolderId: string | null) => {
    if (!selectedPlaylist) return;
    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((pl) => (pl.id === selectedPlaylist.id ? { ...pl, folderId: targetFolderId } : pl))
    );
    setOpenMovePlaylist(false);
    setSelectedPlaylist(null);
    load();
  };
  useEffect(() => {
    setTopBarControls({
      showSearch: true,
      searchActive: searchOn,
      onSearchPress: () => {
        const next = !searchOn;
        setSearchOn(next);
        sessionState.searchOn = next;
        if (!next) {
          setQ('');
          sessionState.query = '';
        }
      },
      showAdd: true,
      onAddPress: () => setOpenCreateType(true),
    });
    return clearTopBarControls;
  }, [clearTopBarControls, searchOn, sessionState, setTopBarControls]);

  const handleSearchChange = (value: string) => {
    sessionState.query = value;
    setQ(value);
  };

  const handleViewFilterChange = (value: typeof viewFilter) => {
    sessionState.viewFilter = value;
    setViewFilter(value);
  };

  const openPlaylistDetail = (playlist: Playlist) => {
    sessionState.query = q;
    sessionState.searchOn = searchOn;
    sessionState.viewFilter = viewFilter;
    nav.navigate('PlaylistDetail', {
      playlistId: playlist.id,
      playlistName: playlist.name,
    });
  };

  return (
    <View style={styles.container}>
      {searchOn ? (
        <View style={styles.search}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar pastas e listas..."
            placeholderTextColor="#666"
            value={q}
            onChangeText={handleSearchChange}
            autoFocus
          />
        </View>
      ) : null}
      <View
        style={[
          styles.filterRow,
          {
            gap: 0,
            paddingHorizontal: 0,
            paddingBottom: 0,
            marginHorizontal: 0,
            borderWidth: 1,
            borderColor: 'var(--app-border-soft)',
            borderRadius: 0,
            overflow: 'hidden',
            backgroundColor: 'var(--app-surface-alt)',
          },
        ]}
      >
        {viewFilterOptions.map((option, index) => {
          const active = viewFilter === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterBtn,
                active && styles.filterBtnActive,
                {
                  flex: 1,
                  marginHorizontal: 0,
                  borderRadius: 0,
                  borderWidth: 0,
                  borderLeftWidth: index === 0 ? 0 : 1,
                  borderLeftColor: 'var(--app-border-soft)',
                },
              ]}
              onPress={() => handleViewFilterChange(option.value)}
            >
              <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {listReady ? <FlatList
        data={visibleItems}
        keyExtractor={(item: FolderPlaylistDisplayItem) => (item.type === 'folder' ? `folder-${item.folder.id}` : `playlist-${item.playlist.id}`)}
        contentOffset={{ x: 0, y: sessionState.scrollOffset }}
        scrollEventThrottle={100}
        onScrollBeginDrag={() => {
          userScrolledListRef.current = true;
        }}
        onScroll={(event: { nativeEvent: { contentOffset: { y: number } } }) => {
          const receivedOffset = Math.max(0, event.nativeEvent.contentOffset.y || 0);
          if (!userScrolledListRef.current) return;
          sessionState.scrollOffset = receivedOffset;
        }}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }: { item: FolderPlaylistDisplayItem }) => (
          item.type === 'folder' ? (
            <View style={styles.listRow}>
              <TouchableOpacity
                style={styles.cardMainPress}
                onPress={() => nav.navigate('FolderDetail', { folderId: item.folder.id, folderName: item.folder.name })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {renderFolderListIconTile(renderFolderHierarchyIcon(getFolderDepth(item.folder.id, allFolders), 18), true)}
                  <View style={styles.listRowText}>
                    <Text style={styles.title}>{item.folder.name}</Text>
                    <Text style={styles.subtitle}>{getFolderSubtitle(item.folder)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {favoriteMode !== 'disabled' ? (
                <TouchableOpacity style={styles.listActionBtn} onPress={() => toggleFolderStar(item.folder.id)}>
                  <Star
                    size={18}
                    color={item.folder.isStarred ? '#ffd166' : '#777'}
                    fill={item.folder.isStarred ? '#ffd166' : 'transparent'}
                  />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.listActionBtn} onPress={() => openActionsForFolder(item.folder)}>
                <ChevronRight size={18} color="#4FC3F7" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listRow}>
              <TouchableOpacity
                style={styles.cardMainPress}
                onPress={() => openPlaylistDetail(item.playlist)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {renderFolderListIconTile(<ListMusic size={19} color="#ffd166" />)}
                  <View style={styles.listRowText}>
                    <Text style={styles.title}>{item.playlist.name}</Text>
                    <Text style={styles.subtitle}>{getPlaylistSubtitle(item.playlist)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {favoriteMode !== 'disabled' ? (
                <TouchableOpacity style={styles.listActionBtn} onPress={() => togglePlaylistStar(item.playlist.id)}>
                  <Star
                    size={18}
                    color={item.playlist.isStarred ? '#ffd166' : '#777'}
                    fill={item.playlist.isStarred ? '#ffd166' : 'transparent'}
                  />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.listActionBtn} onPress={() => openActionsForPlaylist(item.playlist)}>
                <ChevronRight size={18} color="#4FC3F7" />
              </TouchableOpacity>
            </View>
          )
        )}
      /> : null}

      <AppModal
        visible={openCreateType}
        title="Criar novo"
        onClose={() => setOpenCreateType(false)}
        icon={<Plus size={16} color="var(--app-accent)" />}
        maxWidth={520}
        footer={
          <TouchableOpacity onPress={() => setOpenCreateType(false)}>
            <Text style={{ color: 'var(--app-muted-text)', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>Escolha o que deseja criar agora.</Text>
        <TouchableOpacity
          style={styles.createOptionCard}
          onPress={() => {
            setOpenCreateType(false);
            setName('');
            setOpenCreateFolder(true);
          }}
        >
          <View style={styles.createOptionLeft}>
            <FolderIcon size={18} color="#a855f7" />
            <View>
              <Text style={styles.title}>Pasta</Text>
              <Text style={styles.subtitle}>Dentro da pasta você pode criar listas</Text>
            </View>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.createOptionCard}
          onPress={() => {
            setOpenCreateType(false);
            setName('');
            setOpenCreatePlaylist(true);
          }}
        >
          <View style={styles.createOptionLeft}>
            <ListMusic size={18} color="#4FC3F7" />
            <View>
              <Text style={styles.title}>Lista</Text>
              <Text style={styles.subtitle}>Na lista você só adiciona músicas</Text>
            </View>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
      </AppModal>

      <AppModal
        visible={openCreateFolder}
        title="Nova pasta"
        onClose={() => setOpenCreateFolder(false)}
        icon={<FolderIcon size={16} color="#a855f7" />}
        footer={
          <>
            <TouchableOpacity onPress={() => setOpenCreateFolder(false)}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={createFolder}>
              <Text style={{ color: '#4FC3F7', fontWeight: '900' }}>Criar</Text>
            </TouchableOpacity>
          </>
        }
      >
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Sertanejo" placeholderTextColor="#666" autoFocus />
      </AppModal>

      <AppModal
        visible={openCreatePlaylist}
        title="Nova lista"
        onClose={() => setOpenCreatePlaylist(false)}
        icon={<ListMusic size={16} color="#ffd166" />}
        footer={
          <>
            <TouchableOpacity onPress={() => setOpenCreatePlaylist(false)}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={createPlaylist}>
              <Text style={{ color: '#4FC3F7', fontWeight: '900' }}>Criar</Text>
            </TouchableOpacity>
          </>
        }
      >
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Modão para tocar" placeholderTextColor="#666" autoFocus />
        <Text style={styles.createHint}>Essa lista aceita somente músicas.</Text>
      </AppModal>

      <AppModal
        visible={openFolderActions}
        title="Opções da pasta"
        onClose={() => {
          setOpenFolderActions(false);
          setSelectedFolder(null);
        }}
        icon={<FolderIcon size={16} color="#a855f7" />}
        footer={
          <TouchableOpacity
            onPress={() => {
              setOpenFolderActions(false);
              setSelectedFolder(null);
            }}
          >
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>{selectedFolder?.name || ''}</Text>
        <TouchableOpacity
          style={[styles.modalActionBtn, styles.songActionOptionBtn]}
          onPress={() => {
            setOpenFolderActions(false);
            setFolderRenameName(selectedFolder?.name || '');
            setOpenRenameFolder(true);
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
            setOpenFolderActions(false);
            setOpenMoveFolder(true);
          }}
        >
          <View style={styles.createOptionLeft}>
            <FolderInput size={17} color="#a855f7" />
            <Text style={styles.modalActionText}>Enviar para pasta...</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalActionBtn, styles.songActionOptionBtn]}
          onPress={shareSelectedFolder}
        >
          <View style={styles.createOptionLeft}>
            <Share2 size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Compartilhar pasta</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalActionBtn, styles.songActionOptionBtn, styles.modalDangerBtn]}
          onPress={deleteSelectedFolder}
        >
          <View style={styles.createOptionLeft}>
            <Trash2 size={17} color="#ff7a7a" />
            <Text style={styles.modalDangerText}>Excluir pasta</Text>
          </View>
        </TouchableOpacity>
      </AppModal>

      <AppModal
        visible={openRenameFolder}
        title="Editar nome da pasta"
        onClose={() => setOpenRenameFolder(false)}
        icon={<FolderIcon size={16} color="#a855f7" />}
        footer={
          <>
            <TouchableOpacity onPress={() => setOpenRenameFolder(false)}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={renameSelectedFolder}>
              <Text style={{ color: '#4FC3F7', fontWeight: '900' }}>Salvar</Text>
            </TouchableOpacity>
          </>
        }
      >
        <TextInput
          style={styles.input}
          value={folderRenameName}
          onChangeText={setFolderRenameName}
          placeholder="Novo nome"
          placeholderTextColor="#666"
          autoFocus
        />
      </AppModal>

      <AppModal
        visible={openMoveFolder}
        title="Enviar para pasta"
        onClose={() => setOpenMoveFolder(false)}
        icon={<FolderIcon size={16} color="#a855f7" />}
        footer={
          <TouchableOpacity onPress={() => setOpenMoveFolder(false)}>
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>Escolha o destino da pasta.</Text>
        <ScrollView style={{ marginTop: 4, maxHeight: 420 }}>
          <TouchableOpacity
            style={styles.modalActionBtn}
            onPress={() => moveSelectedFolder(null)}
          >
            <Text style={styles.modalActionText}>Raiz (Pastas/Listas)</Text>
          </TouchableOpacity>
          {availableFolderTargets.length ? (
            availableFolderTargets.map((folder) => (
              <TouchableOpacity
                key={folder.id}
                style={styles.modalActionBtn}
                onPress={() => moveSelectedFolder(folder.id)}
              >
                <Text style={styles.modalActionText}>{folder.name}</Text>
                <Text style={styles.subtitle}>{folder.parentId ? 'Subpasta' : 'Pasta'}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[styles.subtitle, { marginTop: 6 }]}>Nenhuma pasta disponível.</Text>
          )}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={openPlaylistActions}
        title="Opções da lista"
        onClose={() => {
          setOpenPlaylistActions(false);
          setSelectedPlaylist(null);
        }}
        icon={<ListMusic size={16} color="#ffd166" />}
        footer={
          <TouchableOpacity
            onPress={() => {
              setOpenPlaylistActions(false);
              setSelectedPlaylist(null);
            }}
          >
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>{selectedPlaylist?.name || ''}</Text>
        <TouchableOpacity
          style={[styles.modalActionBtn, styles.songActionOptionBtn]}
          onPress={() => {
            setOpenPlaylistActions(false);
            setPlaylistRenameName(selectedPlaylist?.name || '');
            setOpenRenamePlaylist(true);
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
            setOpenPlaylistActions(false);
            setOpenMovePlaylist(true);
          }}
        >
          <View style={styles.createOptionLeft}>
            <FolderIcon size={17} color="#a855f7" />
            <Text style={styles.modalActionText}>Enviar para pasta</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={shareSelectedPlaylist}>
          <View style={styles.createOptionLeft}>
            <Share2 size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Compartilhar lista</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={duplicateSelectedPlaylist}>
          <View style={styles.createOptionLeft}>
            <Copy size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Duplicar lista</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalActionBtn, styles.songActionOptionBtn, styles.modalDangerBtn]}
          onPress={deleteSelectedPlaylist}
        >
          <View style={styles.createOptionLeft}>
            <Trash2 size={17} color="#ff7a7a" />
            <Text style={styles.modalDangerText}>Excluir lista</Text>
          </View>
        </TouchableOpacity>
      </AppModal>

      <AppModal
        visible={openRenamePlaylist}
        title="Editar nome da lista"
        onClose={() => setOpenRenamePlaylist(false)}
        icon={<ListMusic size={16} color="#ffd166" />}
        footer={
          <>
            <TouchableOpacity onPress={() => setOpenRenamePlaylist(false)}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={renameSelectedPlaylist}>
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
        visible={openMovePlaylist}
        title="Enviar para pasta"
        onClose={() => setOpenMovePlaylist(false)}
        icon={<FolderIcon size={16} color="#a855f7" />}
        footer={
          <TouchableOpacity onPress={() => setOpenMovePlaylist(false)}>
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>Escolha o destino da lista.</Text>
        <ScrollView style={{ marginTop: 4, maxHeight: 420 }}>
          <TouchableOpacity
            style={styles.modalActionBtn}
            onPress={() => moveSelectedPlaylist(null)}
          >
            <Text style={styles.modalActionText}>Raiz (Pastas/Listas)</Text>
          </TouchableOpacity>
          {allFolders.length ? (
            allFolders.map((folder) => (
              <TouchableOpacity
                key={folder.id}
                style={styles.modalActionBtn}
                onPress={() => moveSelectedPlaylist(folder.id)}
              >
                <Text style={styles.modalActionText}>{folder.name}</Text>
                <Text style={styles.subtitle}>{folder.parentId ? 'Subpasta' : 'Pasta'}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={[styles.subtitle, { marginTop: 6 }]}>Nenhuma pasta disponível.</Text>
          )}
        </ScrollView>
      </AppModal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  listIconTile: {
    width: 34,
    height: 34,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.22)',
    boxShadow: '0 10px 20px rgba(14, 165, 233, 0.10)',
    flexShrink: 0,
  },
  folderListIconTile: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.24)',
    boxShadow: '0 10px 20px rgba(168, 85, 247, 0.10)',
  },
});
