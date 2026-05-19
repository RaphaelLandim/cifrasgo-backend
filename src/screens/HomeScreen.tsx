import React from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Music, Plus, Settings } from 'lucide-react';
import { AppButton } from '../components/AppButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SearchBar } from '../components/SearchBar';
import type { RootStackScreenProps } from '../navigation/types';
import { db } from '../services/storage';
import { appTheme } from '../theme/theme';
import type { Song } from '../types/models';
import { getSongGenreDisplay } from '../utils/genres';

export function HomeScreen({ navigation }: RootStackScreenProps<'Home'>) {
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [query, setQuery] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [artist, setArtist] = React.useState('');
  const [content, setContent] = React.useState('');

  const loadSongs = React.useCallback(() => {
    void db.getSongs().then(setSongs);
  }, []);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadSongs);
    loadSongs();
    return unsubscribe;
  }, [loadSongs, navigation]);

  const filteredSongs = React.useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return songs;
    return songs.filter((song) => {
      const genre = getSongGenreDisplay(song).toLowerCase();
      return (
        song.title.toLowerCase().includes(search) ||
        song.artist.toLowerCase().includes(search) ||
        genre.includes(search)
      );
    });
  }, [query, songs]);

  const resetCreateForm = () => {
    setTitle('');
    setArtist('');
    setContent('');
  };

  const saveSong = async () => {
    if (!title.trim()) {
      Alert.alert('Informe o titulo da musica');
      return;
    }

    const created = await db.addSong({
      title,
      artist,
      content,
      observation: '',
    });
    resetCreateForm();
    setCreateOpen(false);
    navigation.navigate('ChordView', { songId: created.id });
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Musicas"
        right={
          <>
            <TouchableOpacity style={styles.headerButton} onPress={() => setCreateOpen(true)}>
              <Plus size={20} color={appTheme.colors.chord} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Settings')}>
              <Settings size={20} color={appTheme.colors.chord} />
            </TouchableOpacity>
          </>
        }
      />

      <SearchBar value={query} placeholder="Buscar por musica, artista ou genero..." onChangeText={setQuery} />

      <FlatList
        data={filteredSongs}
        keyExtractor={(item: Song) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }: { item: Song }) => (
          <TouchableOpacity style={styles.songRow} onPress={() => navigation.navigate('ChordView', { songId: item.id })}>
            <View style={styles.songIcon}>
              <Music size={18} color={appTheme.colors.chord} />
            </View>
            <View style={styles.songText}>
              <Text style={styles.songTitle} numberOfLines={1}>
                {item.title || 'Sem titulo'}
              </Text>
              <Text style={styles.songSubtitle} numberOfLines={1}>
                {(item.artist || '').trim() || 'Sem artista'}
              </Text>
              {getSongGenreDisplay(item) ? (
                <Text style={styles.genreText} numberOfLines={1}>
                  {getSongGenreDisplay(item)}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nenhuma musica encontrada</Text>
            <Text style={styles.emptyText}>Use o botao + para cadastrar uma cifra de teste.</Text>
          </View>
        }
      />

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova musica</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Titulo"
              placeholderTextColor={appTheme.colors.subtleText}
              autoFocus
            />
            <TextInput
              style={styles.input}
              value={artist}
              onChangeText={setArtist}
              placeholder="Artista"
              placeholderTextColor={appTheme.colors.subtleText}
            />
            <TextInput
              style={[styles.input, styles.contentInput]}
              value={content}
              onChangeText={setContent}
              placeholder="Cole a cifra/letra"
              placeholderTextColor={appTheme.colors.subtleText}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <AppButton
                label="Cancelar"
                variant="ghost"
                onPress={() => {
                  resetCreateForm();
                  setCreateOpen(false);
                }}
              />
              <AppButton label="Salvar" onPress={() => void saveSong()} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: appTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appTheme.colors.surface,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
  },
  listContent: {
    paddingHorizontal: appTheme.spacing.md,
    paddingBottom: 120,
    gap: appTheme.spacing.sm,
  },
  songRow: {
    minHeight: 78,
    borderRadius: appTheme.radius.md,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
    padding: appTheme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: appTheme.spacing.md,
  },
  songIcon: {
    width: 40,
    height: 40,
    borderRadius: appTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appTheme.colors.surfaceAlt,
  },
  songText: {
    flex: 1,
    minWidth: 0,
  },
  songTitle: {
    color: appTheme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  songSubtitle: {
    color: appTheme.colors.mutedText,
    marginTop: 3,
  },
  genreText: {
    color: appTheme.colors.chord,
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: appTheme.spacing.xl,
  },
  emptyTitle: {
    color: appTheme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    color: appTheme.colors.mutedText,
    textAlign: 'center',
    marginTop: appTheme.spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: appTheme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: appTheme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: appTheme.radius.lg,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
    padding: appTheme.spacing.lg,
  },
  modalTitle: {
    color: appTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: appTheme.spacing.md,
  },
  input: {
    minHeight: 44,
    borderRadius: appTheme.radius.md,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.background,
    color: appTheme.colors.text,
    paddingHorizontal: appTheme.spacing.md,
    marginBottom: appTheme.spacing.sm,
  },
  contentInput: {
    minHeight: 150,
    paddingTop: appTheme.spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: appTheme.spacing.sm,
    marginTop: appTheme.spacing.sm,
  },
});
