import React, { useEffect, useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ChevronRight, Music, Search } from 'lucide-react';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useTopBarControls } from '../contexts/TopBarContext';
import { SongActionsModal } from '../components/SongActionsModal';
import { SongMetaLine } from '../components/SongMetaLine';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import type { Song } from '../types/models';
import { getSongGenreDisplay, matchesGenreFilter } from '../utils/genres';

interface SongsScreenProps {
  styles: any;
}

export function SongsScreen({
  styles,
}: SongsScreenProps) {
  const nav = useManualNavigation();
  const { setTopBarControls, clearTopBarControls } = useTopBarControls();
  const { globalFilters } = useGenreFilter();
  const songReturnTo: ManualRoute = React.useMemo(() => ({ name: 'Songs' }), []);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedActionSong, setSelectedActionSong] = useState<Song | null>(null);
  const [q, setQ] = useState('');
  const [searchOn, setSearchOn] = useState(false);

  const loadSongs = React.useCallback(() => {
    db.getSongs().then(setSongs);
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

const list = songs
  .filter((song) => {
    if (!matchesGenreFilter(song, globalFilters.selectedGenres)) return false;

    if (!q.trim()) return true;
    const query = q.toLowerCase();
    return (
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query) ||
      getSongGenreDisplay(song).toLowerCase().includes(query)
    );
  })
  .sort((a, b) =>
    (a.title || '').localeCompare(b.title || '', 'pt-BR', {
      sensitivity: 'base',
      numeric: true,
    })
  );

  useEffect(() => {
    setTopBarControls({
      showSearch: true,
      searchActive: searchOn,
      onSearchPress: () => {
        const next = !searchOn;
        setSearchOn(next);
        if (!next) setQ('');
      },
      showAdd: true,
      onAddPress: () => nav.navigate('SongEditor', { id: 'new', returnTo: songReturnTo }),
    });
    return clearTopBarControls;
  }, [clearTopBarControls, nav, searchOn, setTopBarControls, songReturnTo]);

  return (
    <View style={{ flex: 1 }}>
      {searchOn ? (
        <View style={styles.search}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar músicas..."
            placeholderTextColor="#666"
            value={q}
            onChangeText={setQ}
            autoFocus
          />
        </View>
      ) : null}
      <FlatList
        data={list}
        keyExtractor={(item: Song) => item.id}
        initialNumToRender={Math.max(10, list.length)}
        maxToRenderPerBatch={Math.max(10, list.length)}
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }: { item: Song }) => (
          <View style={styles.listRow}>
            <TouchableOpacity
              style={styles.cardMainPress}
              onPress={() => nav.navigate('SongDetail', { id: item.id, returnTo: songReturnTo })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Music size={15} color="#4FC3F7" />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.title, styles.listTitle]} numberOfLines={1}>
                    {item.title}
                  </Text>

                  <SongMetaLine song={item} styles={styles} />
                </View>
              </View>
            
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
