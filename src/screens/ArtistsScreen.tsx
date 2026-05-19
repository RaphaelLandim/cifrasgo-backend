import { useEffect, useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ChevronRight, Mic2, Search } from 'lucide-react';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useTopBarControls } from '../contexts/TopBarContext';
import { db } from '../services/storage';
import type { Song } from '../types/models';
import { matchesGenreFilter } from '../utils/genres';

interface ArtistsScreenProps {
  styles: any;
}

export function ArtistsScreen({
  styles,
}: ArtistsScreenProps) {
  const nav = useManualNavigation();
  const { setTopBarControls, clearTopBarControls } = useTopBarControls();
  const { globalFilters } = useGenreFilter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [q, setQ] = useState('');
  const [searchOn, setSearchOn] = useState(false);

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
        if (!next) setQ('');
      },
      showAdd: false,
    });
    return clearTopBarControls;
  }, [clearTopBarControls, searchOn, setTopBarControls]);

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
            onChangeText={setQ}
            autoFocus
          />
        </View>
      ) : null}
      <FlatList
        data={artists}
        keyExtractor={(artist: string) => artist}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item: artist }: { item: string }) => (
          <TouchableOpacity style={styles.listRow} onPress={() => nav.navigate('ArtistDetail', { artist })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Mic2 size={15} color="#4FC3F7" />
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
