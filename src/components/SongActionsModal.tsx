import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native-web';
import { ChevronRight, ListMusic, Music, Pencil, Share2, Trash2 } from 'lucide-react';
import type { Playlist, Song } from '../types/models';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useSettings } from '../contexts/SettingsContext';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import { buildCifrasGoSongTextFile, sanitizeFileName, shareBlobFile } from '../services/share';
import { AppModal } from './AppModal';
import { ConfirmDialogContext } from './ConfirmDialog';
import { PlaylistPickerModal } from './modals/PlaylistPickerModal';
import { sortStarredItems, toggleStarredPlaylist } from '../utils/starredItems';

export function SongActionsModal({
  visible,
  song,
  returnTo,
  onClose,
  onAfterDelete,
  styles,
}: {
  visible: boolean;
  song: Song | null;
  returnTo: ManualRoute;
  onClose: () => void;
  onAfterDelete: () => void;
  styles: any;
}) {
  const nav = useManualNavigation();
  const { favoriteMode } = useSettings();
  const confirm = React.useContext(ConfirmDialogContext);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistQuery, setPlaylistQuery] = useState('');
  const [addingToPlaylistId, setAddingToPlaylistId] = useState<string | null>(null);
  const [removingFromPlaylistId, setRemovingFromPlaylistId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setPlaylistModalOpen(false);
      setPlaylistQuery('');
      setAddingToPlaylistId(null);
      setRemovingFromPlaylistId(null);
    }
  }, [visible]);

  useEffect(() => {
    if (playlistModalOpen) return;
    setPlaylistQuery('');
  }, [playlistModalOpen]);

  useEffect(() => {
    if (!playlistModalOpen) return;
    db.getPlaylists().then((rows) => {
      setPlaylists(rows);
    });
  }, [playlistModalOpen]);

  const closeAll = () => {
    setPlaylistModalOpen(false);
    setPlaylistQuery('');
    setAddingToPlaylistId(null);
    setRemovingFromPlaylistId(null);
    onClose();
  };

  const openSong = () => {
    if (!song) return;
    closeAll();
    nav.navigate('SongDetail', { id: song.id, returnTo });
  };

  const editSong = () => {
    if (!song) return;
    closeAll();
    nav.navigate('SongEditor', { id: song.id, returnTo });
  };

  const playlistAlreadyHasSong = (playlist: Playlist) => (song ? playlist.songIds.includes(song.id) : false);

  const addToPlaylist = async (playlist: Playlist) => {
    if (!song || playlistAlreadyHasSong(playlist) || addingToPlaylistId || removingFromPlaylistId) return;
    setAddingToPlaylistId(playlist.id);
    await db.addSongToPlaylist(playlist.id, song.id);
    setPlaylists((current) =>
      current.map((item) =>
        item.id === playlist.id
          ? {
              ...item,
              songIds: item.songIds.includes(song.id) ? item.songIds : [...item.songIds, song.id],
            }
          : item
      )
    );
    setAddingToPlaylistId(null);
  };

  const removeFromPlaylist = async (playlist: Playlist) => {
    if (!song || !playlistAlreadyHasSong(playlist) || addingToPlaylistId || removingFromPlaylistId) return;
    setRemovingFromPlaylistId(playlist.id);
    await db.removeSongFromPlaylist(playlist.id, song.id);
    setPlaylists((current) =>
      current.map((item) =>
        item.id === playlist.id
          ? { ...item, songIds: item.songIds.filter((songId) => songId !== song.id) }
          : item
      )
    );
    setRemovingFromPlaylistId(null);
  };
  const togglePlaylistStar = (playlist: Playlist) => {
    setPlaylists((current) => {
      const next = toggleStarredPlaylist(current, playlist.id, favoriteMode);
      if (next !== current) void db.savePlaylists(next);
      return next;
    });
  };

  const shareSongFile = async () => {
    if (!song) return;
    const targetSong = song;
    const fileBaseName = sanitizeFileName(
      `${targetSong.title || 'musica'}${targetSong.artist ? ` - ${targetSong.artist}` : ''}`
    );
    const fileName = `${fileBaseName}.txt`;
    const fileText = buildCifrasGoSongTextFile(targetSong);
    const blob = new Blob([fileText], { type: 'text/plain;charset=utf-8' });
    const shareTitle = targetSong.title || 'Música';
    const shareSummary = `${targetSong.title || 'Música'}${targetSong.artist ? ` - ${targetSong.artist}` : ''}`;
    const shared = await shareBlobFile({
      blob,
      fileName,
      title: shareTitle,
      text: shareSummary,
      fallbackMessage:
        'Este dispositivo não abriu o compartilhamento nativo, então o arquivo TXT da música foi baixado.',
    });
    if (shared) {
      closeAll();
    }
  };

  const deleteSong = async () => {
    if (!song || !confirm) return;
    const targetSong = song;
    closeAll();
    const confirmed = await confirm({
      title: 'Excluir música definitivamente?',
      message: `Você está prestes a excluir "${targetSong.title}".`,
      detail: 'Esta ação remove a música do acervo e também a retira de listas e pastas. Depois da confirmação, ela não poderá ser recuperada pelo aplicativo.',
      confirmLabel: 'Excluir definitivamente',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    await db.deleteSong(targetSong.id);
    onAfterDelete();
  };

  const playlistSearchText = playlistQuery.trim().toLowerCase();
  const filteredPlaylists = sortStarredItems(playlists, favoriteMode).filter((playlist) =>
    !playlistSearchText ? true : playlist.name.toLowerCase().includes(playlistSearchText)
  );
  const getPlaylistSubtitle = (playlist: Playlist) =>
    playlistAlreadyHasSong(playlist)
      ? 'Já está nesta lista'
      : `${playlist.songIds.length} música${playlist.songIds.length === 1 ? '' : 's'}`;

  return (
    <>
      <AppModal
        visible={visible && !!song && !playlistModalOpen}
        title="Opções da música"
        onClose={closeAll}
        icon={<Music size={16} color="#4FC3F7" />}
        footer={
          <TouchableOpacity onPress={closeAll}>
            <Text style={{ color: '#aaa', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={styles.createHint}>{song ? `${song.title} - ${song.artist || 'Sem artista'}` : ''}</Text>
        <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={openSong}>
          <View style={styles.createOptionLeft}>
            <Music size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Abrir música</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={editSong}>
          <View style={styles.createOptionLeft}>
            <Pencil size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Editar música</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={() => setPlaylistModalOpen(true)}>
          <View style={styles.createOptionLeft}>
            <ListMusic size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Enviar a uma lista</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn]} onPress={shareSongFile}>
          <View style={styles.createOptionLeft}>
            <Share2 size={17} color="#4FC3F7" />
            <Text style={styles.modalActionText}>Compartilhar música</Text>
          </View>
          <ChevronRight size={18} color="#777" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modalActionBtn, styles.songActionOptionBtn, styles.modalDangerBtn]} onPress={deleteSong}>
          <View style={styles.createOptionLeft}>
            <Trash2 size={17} color="#ff7a7a" />
            <Text style={styles.modalDangerText}>Deletar a música</Text>
          </View>
        </TouchableOpacity>
      </AppModal>

      <PlaylistPickerModal
        visible={visible && !!song && playlistModalOpen}
        title="Enviar a uma lista"
        contextText={song ? song.title : ''}
        query={playlistQuery}
        playlists={filteredPlaylists}
        addingToPlaylistId={addingToPlaylistId}
        removingFromPlaylistId={removingFromPlaylistId}
        onQueryChange={setPlaylistQuery}
        onBack={() => setPlaylistModalOpen(false)}
        onClose={closeAll}
        playlistAlreadyHasSong={playlistAlreadyHasSong}
        getPlaylistSubtitle={getPlaylistSubtitle}
        onSelectPlaylist={(playlist) => void addToPlaylist(playlist)}
        onRemoveFromPlaylist={(playlist) => void removeFromPlaylist(playlist)}
        showStars={favoriteMode !== 'disabled'}
        onToggleStarredPlaylist={togglePlaylistStar}
        actionLabel="Enviar"
        busyLabel="Enviando..."
        alreadyAddedLabel="Já está nesta lista"
        emptyLabel={playlists.length ? 'Nenhuma lista encontrada.' : 'Nenhuma lista cadastrada.'}
      />
    </>
  );
}



