import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { ListMusic } from 'lucide-react';
import { AppModal } from '../../../components/AppModal';
import type { Song } from '../../../types/models';

interface CurrentPlaylistModalProps {
  visible: boolean;
  title: string;
  songs: Song[];
  currentSongIndex: number;
  onClose: () => void;
  onNavigateToIndex: (index: number) => void;
}

export function CurrentPlaylistModal({
  visible,
  title,
  songs,
  currentSongIndex,
  onClose,
  onNavigateToIndex,
}: CurrentPlaylistModalProps) {
  return (
    <AppModal
      visible={visible}
      title={title}
      onClose={onClose}
      icon={<ListMusic size={16} color="var(--app-accent)" />}
      maxWidth={520}
      footer={
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>Fechar</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <FlatList<Song>
          data={songs}
          keyExtractor={(item: Song) => item.id}
          style={styles.list}
          renderItem={({ item, index }: { item: Song; index: number }) => (
            <TouchableOpacity
              style={[
                styles.listSongRow,
                index === currentSongIndex && styles.listSongRowActive,
              ]}
              onPress={() => onNavigateToIndex(index)}
            >
              <Text style={[styles.listSongIndex, index === currentSongIndex && styles.listSongIndexActive]}>
                {index + 1}
              </Text>
              <View style={styles.listSongTextBlock}>
                <Text style={[styles.listSongTitle, index === currentSongIndex && styles.listSongTitleActive]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.listSongArtist} numberOfLines={1}>{item.artist || 'Sem artista'}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma música na lista atual.</Text>}
        />
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  closeText: {
    color: 'var(--app-muted-text)',
    fontWeight: '800',
  },
  scroll: {
    maxHeight: 360,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  list: {
    maxHeight: 320,
    paddingHorizontal: 12,
  },
  listSongRow: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listSongRowActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  listSongIndex: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 24,
    flexShrink: 0,
  },
  listSongIndexActive: {
    borderColor: 'var(--app-accent)',
    color: 'var(--app-accent)',
  },
  listSongTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  listSongTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  listSongTitleActive: {
    color: 'var(--app-accent)',
  },
  listSongArtist: {
    color: 'var(--app-muted-text)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyText: {
    color: 'var(--app-subtle-text)',
    fontSize: 13,
    marginBottom: 12,
  },
});
