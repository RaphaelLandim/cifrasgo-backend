import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
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
import { useDevScreenPerformance } from '../utils/devPerformance';

interface SongsScreenProps {
  styles: any;
  sessionState: {
    query: string;
    searchOn: boolean;
    scrollOffset: number;
  };
}

export function SongsScreen({
  styles,
  sessionState,
}: SongsScreenProps) {
  useDevScreenPerformance('Songs');
  const nav = useManualNavigation();
  const { setTopBarControls, clearTopBarControls } = useTopBarControls();
  const { globalFilters } = useGenreFilter();
  const songReturnTo: ManualRoute = React.useMemo(() => ({ name: 'Songs' }), []);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedActionSong, setSelectedActionSong] = useState<Song | null>(null);
  const [q, setQ] = useState(() => sessionState.query);
  const [searchOn, setSearchOn] = useState(() => sessionState.searchOn);

  const loadSongs = React.useCallback(() => {
    db.getSongs().then(setSongs);
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const list = React.useMemo(
    () => songs
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
      ),
    [globalFilters.selectedGenres, q, songs]
  );

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
      onAddPress: () => nav.navigate('SongEditor', { id: 'new', returnTo: songReturnTo }),
    });
    return clearTopBarControls;
  }, [clearTopBarControls, nav, searchOn, sessionState, setTopBarControls, songReturnTo]);

  const handleSearchChange = React.useCallback((value: string) => {
    sessionState.query = value;
    setQ(value);
  }, [sessionState]);

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
            onChangeText={handleSearchChange}
            autoFocus
          />
        </View>
      ) : null}
      <FlatList
        data={list}
        keyExtractor={(item: Song) => item.id}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews={false}
        contentOffset={{ x: 0, y: sessionState.scrollOffset }}
        scrollEventThrottle={100}
        onScroll={(event: { nativeEvent: { contentOffset: { y: number } } }) => {
          sessionState.scrollOffset = Math.max(0, event.nativeEvent.contentOffset.y || 0);
        }}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }: { item: Song }) => (
          <View style={styles.listRow}>
            <TouchableOpacity
              style={styles.cardMainPress}
              onPress={() => nav.navigate('SongDetail', { id: item.id, returnTo: songReturnTo })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={localStyles.listIconTile}>
                  <Music size={19} color="#38bdf8" />
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
});
