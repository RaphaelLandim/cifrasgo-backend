import { useCallback, useMemo, useState } from 'react';
import { db } from '../../../services/storage';
import type { FavoriteMode, Folder, Playlist, Song } from '../../../types/models';
import { sortStarredItems, toggleStarredPlaylist } from '../../../utils/starredItems';

interface UseAddToPlaylistParams {
  song: Song | null;
  favoriteMode: FavoriteMode;
}

export function useAddToPlaylist({ song, favoriteMode }: UseAddToPlaylistParams) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [addingToPlaylistId, setAddingToPlaylistId] = useState<string | null>(null);
  const [removingFromPlaylistId, setRemovingFromPlaylistId] = useState<string | null>(null);

  const openModal = useCallback(async () => {
    if (!song) return;
    setQuery('');
    setOpen(true);
    const [nextPlaylists, nextFolders] = await Promise.all([db.getPlaylists(), db.getFolders()]);
    setPlaylists(nextPlaylists);
    setFolders(nextFolders);
  }, [song]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery('');
    setAddingToPlaylistId(null);
    setRemovingFromPlaylistId(null);
  }, []);

  const getPlaylistFolderPath = useCallback((folderId?: string | null) => {
    if (!folderId) return '';
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const names: string[] = [];
    const visited = new Set<string>();
    let current = byId.get(folderId);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names.join(' / ');
  }, [folders]);

  const getPlaylistSongCountLabel = useCallback((playlist: Playlist) => {
    const count = playlist.songIds?.length ?? 0;
    return `${count} ${count === 1 ? 'música' : 'músicas'}`;
  }, []);

  const getPlaylistSubtitle = useCallback((playlist: Playlist) => {
    const path = getPlaylistFolderPath(playlist.folderId);
    return `${path ? `Lista em ${path}` : 'Lista na raiz'} · ${getPlaylistSongCountLabel(playlist)}`;
  }, [getPlaylistFolderPath, getPlaylistSongCountLabel]);

  const playlistAlreadyHasSong = useCallback((playlist: Playlist) =>
    !!song && (playlist.songIds ?? []).includes(song.id), [song]);

  const addCurrentSongToPlaylist = useCallback(async (playlist: Playlist) => {
    if (!song || playlistAlreadyHasSong(playlist) || addingToPlaylistId || removingFromPlaylistId) return;
    setAddingToPlaylistId(playlist.id);
    await db.addSongToPlaylist(playlist.id, song.id);
    setPlaylists((current) =>
      current.map((item) =>
        item.id === playlist.id
          ? { ...item, songIds: (item.songIds ?? []).includes(song.id) ? item.songIds : [...(item.songIds ?? []), song.id] }
          : item
      )
    );
    setAddingToPlaylistId(null);
  }, [addingToPlaylistId, playlistAlreadyHasSong, removingFromPlaylistId, song]);

  const removeCurrentSongFromPlaylist = useCallback(async (playlist: Playlist) => {
    if (!song || !playlistAlreadyHasSong(playlist) || addingToPlaylistId || removingFromPlaylistId) return;
    setRemovingFromPlaylistId(playlist.id);
    await db.removeSongFromPlaylist(playlist.id, song.id);
    setPlaylists((current) =>
      current.map((item) =>
        item.id === playlist.id
          ? { ...item, songIds: (item.songIds ?? []).filter((songId) => songId !== song.id) }
          : item
      )
    );
    setRemovingFromPlaylistId(null);
  }, [addingToPlaylistId, playlistAlreadyHasSong, removingFromPlaylistId, song]);

  const togglePlaylistStar = useCallback((playlist: Playlist) => {
    setPlaylists((current) => {
      const next = toggleStarredPlaylist(current, playlist.id, favoriteMode);
      if (next !== current) void db.savePlaylists(next);
      return next;
    });
  }, [favoriteMode]);

  const normalizedQuery = query.trim().toLowerCase();
  const visiblePlaylists = useMemo(() => sortStarredItems(playlists, favoriteMode)
    .filter((playlist) => {
      if (!normalizedQuery) return true;
      return `${playlist.name} ${getPlaylistFolderPath(playlist.folderId)}`.toLowerCase().includes(normalizedQuery);
    }), [favoriteMode, getPlaylistFolderPath, normalizedQuery, playlists]);

  return useMemo(() => ({
    open,
    query,
    visiblePlaylists,
    addingToPlaylistId,
    removingFromPlaylistId,
    contextText: song ? song.title : '',
    showStars: favoriteMode !== 'disabled',
    setQuery,
    openModal,
    closeModal,
    playlistAlreadyHasSong,
    getPlaylistSubtitle,
    addCurrentSongToPlaylist,
    removeCurrentSongFromPlaylist,
    togglePlaylistStar,
  }), [
    addCurrentSongToPlaylist,
    addingToPlaylistId,
    closeModal,
    favoriteMode,
    getPlaylistSubtitle,
    open,
    openModal,
    playlistAlreadyHasSong,
    query,
    removeCurrentSongFromPlaylist,
    removingFromPlaylistId,
    setQuery,
    song,
    togglePlaylistStar,
    visiblePlaylists,
  ]);
}
