import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ChevronRight, ListMusic, Music, Pencil, Search, Share2, Trash2 } from 'lucide-react';
import type { Playlist, Song } from '../types/models';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import { buildCifrasGoSongTextFile, sanitizeFileName, shareBlobFile } from '../services/share';
import { AppModal } from './AppModal';
import { ConfirmDialogContext } from './ConfirmDialog';

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
  const confirm = React.useContext(ConfirmDialogContext);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistSearchOpen, setPlaylistSearchOpen] = useState(false);
  const [playlistQuery, setPlaylistQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setPlaylistModalOpen(false);
      setPlaylistSearchOpen(false);
      setPlaylistQuery('');
    }
  }, [visible]);

  useEffect(() => {
    if (playlistModalOpen) return;
    setPlaylistSearchOpen(false);
    setPlaylistQuery('');
  }, [playlistModalOpen]);

  useEffect(() => {
    if (!playlistModalOpen) return;
    db.getPlaylists().then((rows) => {
      setPlaylists([...rows].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    });
  }, [playlistModalOpen]);

  const closeAll = () => {
    setPlaylistModalOpen(false);
    setPlaylistSearchOpen(false);
    setPlaylistQuery('');
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

  const addToPlaylist = async (playlistId: string) => {
    if (!song) return;
    await db.addSongToPlaylist(playlistId, song.id);
    closeAll();
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
  const filteredPlaylists = playlists.filter((playlist) =>
    !playlistSearchText ? true : playlist.name.toLowerCase().includes(playlistSearchText)
  );

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

      <AppModal
        visible={visible && !!song && playlistModalOpen}
        title="Enviar a uma lista"
        onClose={closeAll}
        icon={<ListMusic size={16} color="#4FC3F7" />}
        footer={
          <>
            <TouchableOpacity onPress={() => setPlaylistModalOpen(false)}>
              <Text style={{ color: '#aaa', fontWeight: '800' }}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeAll}>
              <Text style={{ color: '#4FC3F7', fontWeight: '800' }}>Fechar</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={styles.playlistPickerHeader}>
          <View style={styles.listRowText}>
            <Text style={styles.createHint}>{song ? song.title : ''}</Text>
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, playlistSearchOpen && styles.statusPillActive]}
            onPress={() => {
              const next = !playlistSearchOpen;
              setPlaylistSearchOpen(next);
              if (!next) setPlaylistQuery('');
            }}
          >
            <Search size={19} color={playlistSearchOpen ? '#4FC3F7' : '#bbb'} />
          </TouchableOpacity>
        </View>
        {playlistSearchOpen ? (
          <View style={[styles.search, styles.playlistPickerSearch]}>
            <Search size={18} color="#999" />
            <TextInput
              style={styles.inputSearch}
              placeholder="Buscar lista..."
              placeholderTextColor="#666"
              value={playlistQuery}
              onChangeText={setPlaylistQuery}
              autoFocus
            />
          </View>
        ) : null}
        <ScrollView style={{ marginTop: 4, maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 10 }}>
          {filteredPlaylists.length ? (
            filteredPlaylists.map((playlist) => {
              const alreadyAdded = song ? playlist.songIds.includes(song.id) : false;
              return (
                <TouchableOpacity
                  key={playlist.id}
                  style={styles.modalActionBtn}
                  onPress={() => addToPlaylist(playlist.id)}
                >
                  <Text style={styles.modalActionText}>{playlist.name}</Text>
                  <Text style={styles.subtitle}>
                    {alreadyAdded ? 'Já está nesta lista' : `${playlist.songIds.length} música${playlist.songIds.length === 1 ? '' : 's'}`}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={[styles.subtitle, { marginTop: 6 }]}>
              {playlists.length ? 'Nenhuma lista encontrada.' : 'Nenhuma lista cadastrada.'}
            </Text>
          )}
        </ScrollView>
      </AppModal>
    </>
  );
}



