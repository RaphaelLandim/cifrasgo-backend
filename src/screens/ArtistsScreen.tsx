import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ChevronRight, Mic2, Search } from 'lucide-react';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useTopBarControls } from '../contexts/TopBarContext';
import { db } from '../services/storage';
import type { Song } from '../types/models';
import { matchesGenreFilter } from '../utils/genres';

interface ArtistsScreenProps {
  styles: any;
  sessionState: {
    query: string;
    searchOn: boolean;
    scrollOffset: number;
  };
}

export function ArtistsScreen({
  styles,
  sessionState,
}: ArtistsScreenProps) {
  const nav = useManualNavigation();
  const { setTopBarControls, clearTopBarControls } = useTopBarControls();
  const { globalFilters } = useGenreFilter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [q, setQ] = useState(() => sessionState.query);
  const [searchOn, setSearchOn] = useState(() => sessionState.searchOn);

  useEffect(() => {
    db.getSongs().then(setSongs);
  }, []);

  const artistName = (song: Song) => (song.artist || '').trim() || 'Sem artista';
  const filteredSongs = songs.filter((song) => matchesGenreFilter(song, globalFilters.selectedGenres));
  const counts = filteredSongs.reduce<Record<string, number>>((acc, song) => {
    const artist = artistName(song);
    acc[artist] = (acc[artist] || 0) + 1;
    return acc;
  }, {});

  const artists = Object.keys(counts)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .filter((artist) => (!q.trim() ? true : artist.toLowerCase().includes(q.toLowerCase())));

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
      showAdd: false,
    });
    return clearTopBarControls;
  }, [clearTopBarControls, searchOn, sessionState, setTopBarControls]);

  const handleSearchChange = (value: string) => {
    sessionState.query = value;
    setQ(value);
  };

  return (
    <View style={{ flex: 1 }}>
      {searchOn ? (
        <View style={styles.search}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar artista..."
            placeholderTextColor="#666"
            value={q}
            onChangeText={handleSearchChange}
            autoFocus
          />
        </View>
      ) : null}
      <FlatList
        data={artists}
        keyExtractor={(artist: string) => artist}
        contentOffset={{ x: 0, y: sessionState.scrollOffset }}
        scrollEventThrottle={100}
        onScroll={(event: { nativeEvent: { contentOffset: { y: number } } }) => {
          sessionState.scrollOffset = Math.max(0, event.nativeEvent.contentOffset.y || 0);
        }}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item: artist }: { item: string }) => (
          <TouchableOpacity style={styles.listRow} onPress={() => nav.navigate('ArtistDetail', { artist })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={localStyles.artistIconTile}>
                <Mic2 size={19} color="#22c55e" />
              </View>

              <View style={styles.listRowText}>
                <Text style={styles.title}>{artist}</Text>
                <Text style={styles.subtitle}>{counts[artist]} músicas</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#4FC3F7" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  artistIconTile: {
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
});
