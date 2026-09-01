import { useEffect, useMemo, useState } from 'react';
import { db } from '../../../services/storage';
import type { Song } from '../../../types/models';

interface UseCurrentPlaylistDataParams {
  id: string;
  allSongs: Song[];
  filteredSongs: Song[];
  sourcePlaylistId?: string;
  sourcePlaylistName?: string;
}

export function useCurrentPlaylistData({
  id,
  allSongs,
  filteredSongs,
  sourcePlaylistId,
  sourcePlaylistName,
}: UseCurrentPlaylistDataParams) {
  const [sourcePlaylistSongs, setSourcePlaylistSongs] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);

  useEffect(() => {
    if (sourcePlaylistId) {
      db.byPlaylist(sourcePlaylistId).then((playlist) => {
        if (!playlist) {
          setSourcePlaylistSongs([]);
          return;
        }
        const byId = new Map(allSongs.map((item) => [item.id, item]));
        setSourcePlaylistSongs(
          playlist.songIds
            .map((songId) => byId.get(songId))
            .filter((item): item is Song => !!item)
        );
      });
    } else {
      setSourcePlaylistSongs([]);
    }
  }, [sourcePlaylistId, allSongs]);

  const currentSongList = useMemo(
    () => (sourcePlaylistId && sourcePlaylistSongs.length > 0 ? sourcePlaylistSongs : filteredSongs),
    [filteredSongs, sourcePlaylistId, sourcePlaylistSongs]
  );

  useEffect(() => {
    const index = currentSongList.findIndex((item) => item.id === id);
    setCurrentSongIndex(index >= 0 ? index : 0);
  }, [currentSongList, id]);

  const currentListName = sourcePlaylistId && sourcePlaylistName ? sourcePlaylistName : 'Lista Atual';
  const previousPlaylistIndex = currentSongIndex - 1;
  const nextPlaylistIndex = currentSongIndex + 1;
  const previousPlaylistSong = sourcePlaylistId ? currentSongList[previousPlaylistIndex] : undefined;
  const nextPlaylistSong = sourcePlaylistId ? currentSongList[nextPlaylistIndex] : undefined;
  const previousDisabled = currentSongIndex <= 0;
  const nextDisabled = currentSongIndex >= currentSongList.length - 1;

  return {
    currentSongList,
    currentListName,
    currentSongIndex,
    previousPlaylistIndex,
    nextPlaylistIndex,
    previousPlaylistSong,
    nextPlaylistSong,
    previousDisabled,
    nextDisabled,
  };
}
