import React, { useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native-web';
import { ChevronRight } from 'lucide-react';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { SongActionsModal } from '../components/SongActionsModal';
import { SongMetaLine } from '../components/SongMetaLine';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import type { Song } from '../types/models';
import { matchesGenreFilter } from '../utils/genres';

interface ArtistDetailScreenProps {
  artist: string;
  styles: any;
}

export function ArtistDetailScreen({
  artist,
  styles,
}: ArtistDetailScreenProps) {
  const nav = useManualNavigation();
  const { globalFilters } = useGenreFilter();
  const songReturnTo: ManualRoute = React.useMemo(
    () => ({ name: 'ArtistDetail', params: { artist } }),
    [artist]
  );
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedActionSong, setSelectedActionSong] = useState<Song | null>(null);

  const loadSongs = React.useCallback(() => {
    db.getSongs().then(setSongs);
  }, []);

  useEffect(() => {
    loadSongs();
  }, [artist, loadSongs]);

  const normalizedArtist = (artist || '').trim() || 'Sem artista';
  const songsByArtist = songs.filter(
    (song) => ((song.artist || '').trim() || 'Sem artista') === normalizedArtist
      && matchesGenreFilter(song, globalFilters.selectedGenres)
  );

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>{normalizedArtist}</Text>
      <FlatList
        data={songsByArtist}
        keyExtractor={(item: Song) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }: { item: Song }) => (
          <View style={styles.listRow}>
            <TouchableOpacity
              style={styles.cardMainPress}
              onPress={() => nav.navigate('SongDetail', { id: item.id, returnTo: songReturnTo })}
            >
              <Text style={[styles.title, styles.listTitle]} numberOfLines={1}>{item.title}</Text>
              <SongMetaLine song={item} styles={styles} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.listActionBtn} onPress={() => setSelectedActionSong(item)}>
              <ChevronRight size={18} color="#4FC3F7" />
            </TouchableOpacity>
          </View>
        )}
      />
      <SongActionsModal
        visible={!!selectedActionSong}
        song={selectedActionSong}
        returnTo={songReturnTo}
        onClose={() => setSelectedActionSong(null)}
        onAfterDelete={loadSongs}
        styles={styles}
      />
    </View>
  );
}
