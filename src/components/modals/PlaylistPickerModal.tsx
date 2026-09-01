import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ListMusic, Search, Star } from 'lucide-react';
import { AppModal } from '../AppModal';
import type { Playlist } from '../../types/models';

interface PlaylistPickerModalProps {
  visible: boolean;
  title: string;
  contextText?: string;
  query: string;
  playlists: Playlist[];
  addingToPlaylistId?: string | null;
  removingFromPlaylistId?: string | null;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onBack?: () => void;
  playlistAlreadyHasSong: (playlist: Playlist) => boolean;
  getPlaylistSubtitle: (playlist: Playlist) => string;
  onSelectPlaylist: (playlist: Playlist) => void;
  onRemoveFromPlaylist?: (playlist: Playlist) => void;
  showStars?: boolean;
  onToggleStarredPlaylist?: (playlist: Playlist) => void;
  actionLabel?: string;
  busyLabel?: string;
  alreadyAddedLabel?: string;
  removeLabel?: string;
  removingLabel?: string;
  emptyLabel?: string;
}

export function PlaylistPickerModal({
  visible,
  title,
  contextText,
  query,
  playlists,
  addingToPlaylistId = null,
  removingFromPlaylistId = null,
  onQueryChange,
  onClose,
  onBack,
  playlistAlreadyHasSong,
  getPlaylistSubtitle,
  onSelectPlaylist,
  onRemoveFromPlaylist,
  showStars = false,
  onToggleStarredPlaylist,
  actionLabel = 'Adicionar',
  busyLabel = 'Adicionando...',
  alreadyAddedLabel = 'Já está nesta lista',
  removeLabel = 'Retirar',
  removingLabel = 'Retirando...',
  emptyLabel = 'Nenhuma lista encontrada.',
}: PlaylistPickerModalProps) {
  return (
    <AppModal
      visible={visible}
      title={title}
      onClose={onClose}
      icon={<ListMusic size={16} color="#ffd166" />}
      maxWidth={520}
      footer={
        <>
          {onBack ? (
            <TouchableOpacity onPress={onBack}>
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </>
      }
    >
      {contextText ? <Text style={styles.contextText}>{contextText}</Text> : null}
      <View style={styles.search}>
        <Search size={18} color="#999" />
        <TextInput
          style={styles.inputSearch}
          placeholder="Buscar lista..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={onQueryChange}
          autoFocus
        />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {playlists.length ? (
          playlists.map((playlist) => {
            const alreadyAdded = playlistAlreadyHasSong(playlist);
            const isAdding = addingToPlaylistId === playlist.id;
            const isRemoving = removingFromPlaylistId === playlist.id;
            const hasRemoveAction = alreadyAdded && !!onRemoveFromPlaylist;
            return (
              <TouchableOpacity
                key={playlist.id}
                style={[
                  styles.row,
                  alreadyAdded && styles.rowDisabled,
                ]}
                disabled={!!addingToPlaylistId || !!removingFromPlaylistId}
                onPress={() => onSelectPlaylist(playlist)}
              >
                <View style={styles.featureIcon}>
                  <ListMusic size={17} color={alreadyAdded ? 'var(--app-muted-text)' : '#ffd166'} />
                </View>
                <View style={styles.textBlock}>
                  <Text
                    style={[
                      styles.title,
                      alreadyAdded && styles.textMuted,
                    ]}
                    numberOfLines={1}
                  >
                    {playlist.name}
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {getPlaylistSubtitle(playlist)}
                  </Text>
                </View>
                {showStars ? (
                  <TouchableOpacity
                    style={styles.starButton}
                    onPress={(event: any) => {
                      event?.stopPropagation?.();
                      onToggleStarredPlaylist?.(playlist);
                    }}
                  >
                    <Star
                      size={17}
                      color={playlist.isStarred ? '#ffd166' : '#777'}
                      fill={playlist.isStarred ? '#ffd166' : 'transparent'}
                    />
                  </TouchableOpacity>
                ) : null}
                <View style={styles.status}>
                  <Text
                    style={[
                      styles.statusText,
                      alreadyAdded && styles.statusDone,
                    ]}
                  >
                    {alreadyAdded ? alreadyAddedLabel : isAdding ? busyLabel : actionLabel}
                  </Text>
                  {hasRemoveAction ? (
                    <TouchableOpacity
                      style={styles.removeButton}
                      disabled={isRemoving}
                      onPress={(event: any) => {
                        event?.stopPropagation?.();
                        onRemoveFromPlaylist?.(playlist);
                      }}
                    >
                      <Text style={styles.removeText}>
                        {isRemoving ? removingLabel : removeLabel}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <ListMusic size={20} color="#ffd166" />
            </View>
            <Text style={styles.emptyTitle}>{emptyLabel}</Text>
            <Text style={styles.emptySubtitle}>Tente outro termo de busca ou crie uma lista primeiro.</Text>
          </View>
        )}
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  closeText: {
    color: 'var(--app-muted-text)',
    fontWeight: '800',
  },
  backText: {
    color: '#aaa',
    fontWeight: '800',
  },
  contextText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  search: {
    marginHorizontal: 0,
    marginBottom: 10,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputSearch: {
    flex: 1,
    color: 'var(--app-text)',
    fontSize: 14,
    outlineStyle: 'none',
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  row: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowDisabled: {
    opacity: 0.72,
    backgroundColor: 'var(--app-header)',
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-header)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  textMuted: {
    color: 'var(--app-muted-text)',
  },
  subtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  starButton: {
    width: 26,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  status: {
    minWidth: 96,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 2,
  },
  statusText: {
    color: 'var(--app-accent)',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  statusDone: {
    color: 'var(--app-muted-text)',
  },
  removeButton: {
    minHeight: 20,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  removeText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '900',
  },
  emptyText: {
    color: 'var(--app-muted-text)',
    marginTop: 6,
    fontSize: 13,
  },
  emptyState: {
    minHeight: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 6,
  },
  emptyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-header)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    marginBottom: 2,
  },
  emptyTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'center',
  },
});
