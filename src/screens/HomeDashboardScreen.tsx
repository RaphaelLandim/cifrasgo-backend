import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import {
  ArrowDownToLine,
  Folder,
  Guitar,
  Globe2,
  ListMusic,
  Mic2,
  Music,
  Play,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { GenreFilterModal } from '../components/GenreFilterModal';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import { appTheme } from '../theme/theme';
import type { Genre, Playlist, Song } from '../types/models';
import {
  NO_GENRE_KEY,
  NO_GENRE_LABEL,
  getGenreDisplayName,
  getSongGenreDisplay,
  matchesGenreFilter,
  playlistMatchesGenreFilter,
} from '../utils/genres';

interface DashboardStat {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
}

interface DashboardShortcut {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}

const songsReturnTo: ManualRoute = { name: 'Songs' };

const dashboardPhrases = [
  'A música expressa o que palavras não alcançam.',
  'Quem canta reza duas vezes.',
  'Toda canção começa com um coração disposto.',
  'Ensaiar é preparar o coração.',
  'A música aproxima pessoas e momentos.',
  'Onde há música, há memória viva.',
  'Um bom ensaio começa com presença.',
];

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 390, height: 700 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

export function HomeDashboardScreen() {
  const nav = useManualNavigation();
  const { globalFilters } = useGenreFilter();
  const [{ width, height }, setViewportSize] = React.useState(getViewportSize);
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [playlists, setPlaylists] = React.useState<Playlist[]>([]);
  const [registeredGenres, setRegisteredGenres] = React.useState<Genre[]>([]);
  const [userName, setUserName] = React.useState('');
  const [genreFilterOpen, setGenreFilterOpen] = React.useState(false);
  const [createPlaylistOpen, setCreatePlaylistOpen] = React.useState(false);
  const [newPlaylistName, setNewPlaylistName] = React.useState('');
  const [creatingPlaylist, setCreatingPlaylist] = React.useState(false);
  const isTallScreen = height >= 760;
  const isTabletWidth = width >= 700;
  const useRoomierLayout = isTallScreen || isTabletWidth;
  const contentStyle = React.useMemo(
    () => [
      styles.content,
      useRoomierLayout ? styles.contentRoomy : null,
      isTabletWidth ? styles.contentTablet : null,
      isTallScreen ? { minHeight: Math.max(height - 8, 0) } : null,
    ],
    [height, isTallScreen, isTabletWidth, useRoomierLayout]
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setViewportSize(getViewportSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const load = React.useCallback(() => {
    void Promise.all([
      db.getSongs(),
      db.getPlaylists(),
      db.ensureDefaultGenres(),
      db.getHomeDashboardUserName(),
    ]).then(([nextSongs, nextPlaylists, nextGenres, nextUserName]) => {
      setSongs(nextSongs);
      setPlaylists(nextPlaylists);
      setRegisteredGenres(nextGenres);
      setUserName(nextUserName);
    });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filteredSongs = React.useMemo(
    () => songs.filter((song) => matchesGenreFilter(song, globalFilters.selectedGenres)),
    [globalFilters.selectedGenres, songs]
  );

  const songsById = React.useMemo(
    () => new Map(songs.map((song) => [song.id, song])),
    [songs]
  );

  const filteredPlaylists = React.useMemo(
    () => playlists.filter((playlist) => playlistMatchesGenreFilter(playlist, globalFilters.selectedGenres, songsById)),
    [globalFilters.selectedGenres, playlists, songsById]
  );

  const artistsCount = React.useMemo(() => {
    const artists = new Set(
      filteredSongs.map((song) => (song.artist || '').trim() || 'Sem artista')
    );
    return artists.size;
  }, [filteredSongs]);

  const recommendedSongs = React.useMemo(
    () =>
      [...filteredSongs]
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 8),
    [filteredSongs]
  );

  const dailyPhrase = React.useMemo(() => {
    const dayIndex = new Date().getDay();
    return dashboardPhrases[dayIndex % dashboardPhrases.length];
  }, []);

  const openSong = React.useCallback((song: Song) => {
    nav.navigate('SongDetail', { id: song.id, returnTo: songsReturnTo });
  }, [nav]);

  const createPlaylist = React.useCallback(async () => {
    const cleanName = newPlaylistName.trim();
    if (!cleanName) {
      Alert.alert('Informe o nome da lista');
      return;
    }
    setCreatingPlaylist(true);
    try {
      const created = await db.addPlaylist(null, cleanName);
      setCreatePlaylistOpen(false);
      setNewPlaylistName('');
      load();
      nav.navigate('PlaylistDetail', {
        playlistId: created.id,
        playlistName: created.name,
        folderId: null,
      });
    } finally {
      setCreatingPlaylist(false);
    }
  }, [load, nav, newPlaylistName]);

  const selectedGenres = globalFilters.selectedGenres;
  const filterLabel =
    selectedGenres.length === 0
      ? 'Todos os gêneros'
      : selectedGenres.length === 1
        ? selectedGenres[0] === NO_GENRE_KEY
          ? NO_GENRE_LABEL
          : getGenreDisplayName(selectedGenres[0], registeredGenres)
        : `${selectedGenres.length} gêneros selecionados`;
  const filterHint =
    selectedGenres.length === 0
      ? 'Repertório completo'
      : `${filteredSongs.length} músicas no filtro`;

  const selectedGenreSummary =
    selectedGenres.length === 1
      ? selectedGenres[0] === NO_GENRE_KEY
        ? NO_GENRE_LABEL
        : getGenreDisplayName(selectedGenres[0], registeredGenres)
      : `${selectedGenres.length} gêneros`;

  const greetingName = userName.trim() || 'meu amigo';

  const stats: DashboardStat[] = [
    {
      label: 'Músicas',
      value: filteredSongs.length,
      hint: selectedGenres.length === 0 ? 'no repertório' : 'no filtro',
      icon: <Music size={18} color={appTheme.colors.chord} />,
    },
    {
      label: 'Listas',
      value: filteredPlaylists.length,
      hint: selectedGenres.length === 0 ? 'para tocar' : 'com músicas do filtro',
      icon: <ListMusic size={18} color={appTheme.colors.accent} />,
    },
    {
      label: 'Artistas',
      value: artistsCount,
      hint: 'catalogados',
      icon: <Users size={18} color="#22c55e" />,
    },
  ];

  const shortcuts: DashboardShortcut[] = [
    {
      label: 'Músicas',
      icon: <Music size={30} color={appTheme.colors.accent} />,
      onPress: () => nav.navigate('Songs'),
    },
    {
      label: 'Artistas',
      icon: <Mic2 size={30} color={appTheme.colors.accent} />,
      onPress: () => nav.navigate('Artists'),
    },
    {
      label: 'Listas',
      icon: <Folder size={30} color={appTheme.colors.accent} />,
      onPress: () => nav.navigate('Folders'),
    },
    {
      label: 'Importar',
      icon: <Globe2 size={30} color={appTheme.colors.accent} />,
      onPress: () => nav.navigate('Import'),
    },
    {
      label: 'Backup',
      icon: <ArrowDownToLine size={30} color={appTheme.colors.accent} />,
      onPress: () => nav.navigate('Backup'),
    },
    {
      label: 'Config.',
      icon: <Settings size={30} color={appTheme.colors.accent} />,
      onPress: () => nav.navigate('Settings'),
    },
  ];

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={contentStyle}>
      <View style={[styles.hero, useRoomierLayout && styles.heroRoomy]}>
        <View style={styles.logoWrap}>
          <img src="/CifrasGo.png" alt="CifrasGo" style={styles.logo as React.CSSProperties} />
        </View>
        <View style={styles.heroText}>
          <View style={styles.heroTopRow}>
            <View style={styles.kickerRow}>
              <Sparkles size={15} color={appTheme.colors.chord} />
              <Text style={styles.kicker}>Pronto para ensaiar</Text>
            </View>
          </View>
          <View style={styles.greetingRow}>
            <Text style={styles.greetingAccent}>Olá, {greetingName}</Text>
            <Guitar size={20} color="var(--app-accent)" />
          </View>
          <Text style={styles.heroTitle}>o que vamos tocar hoje?</Text>
          {selectedGenres.length > 0 ? (
            <View style={styles.filteredHeroLine}>
              <Music size={15} color="var(--app-accent)" />
              <Text style={styles.heroSubtitle}>
                <Text style={styles.filteredGenreName}>{selectedGenreSummary}</Text>
                {' no filtro, repertório pronto e violão na mão.'}
              </Text>
            </View>
          ) : (
            <Text style={styles.heroSubtitle}>Abra cifras, listas e atalhos de ensaio sem perder o ritmo.</Text>
          )}
        </View>
      </View>

      <View style={[styles.statsGrid, useRoomierLayout && styles.statsGridRoomy]}>
        {stats.map((item) => (
          <View key={item.label} style={[styles.statCard, useRoomierLayout && styles.statCardRoomy]}>
            <View style={styles.statIcon}>{item.icon}</View>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
            <Text style={styles.statHint}>{item.hint}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Recentes para hoje</Text>
          <Text style={styles.sectionSubtitle}>Cifras atualizadas ou prontas para retomar</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendations}>
        {recommendedSongs.length > 0 ? (
          recommendedSongs.map((song, index) => (
            <TouchableOpacity
              key={song.id}
              style={[
                styles.songCard,
                useRoomierLayout && styles.songCardRoomy,
                index % 3 === 1 ? styles.songCardAlt : index % 3 === 2 ? styles.songCardWarm : null,
              ]}
              onPress={() => openSong(song)}
            >
              <View style={styles.songCardTop}>
                <View style={styles.songBadge}>
                  <Music size={15} color={appTheme.colors.chord} />
                </View>
                <View style={styles.playPill}>
                  <Play size={11} color="#04151e" />
                  <Text style={styles.playPillText}>Abrir</Text>
                </View>
              </View>
              <View style={styles.songCardBottom}>
                <Text style={styles.songTitle} numberOfLines={2}>{song.title || 'Sem título'}</Text>
                <Text style={styles.songArtist} numberOfLines={1}>{(song.artist || '').trim() || 'Sem artista'}</Text>
                {getSongGenreDisplay(song) ? (
                  <Text style={styles.songGenre} numberOfLines={1}>{getSongGenreDisplay(song)}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma música encontrada</Text>
            <Text style={styles.emptyText}>Cadastre uma cifra ou ajuste os filtros globais para montar o ensaio.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.sectionDivider} />

      <View style={[styles.shortcutsGrid, useRoomierLayout && styles.shortcutsGridRoomy]}>
        {shortcuts.map((item) => (
          <TouchableOpacity key={item.label} style={[styles.shortcutCard, useRoomierLayout && styles.shortcutCardRoomy]} onPress={item.onPress}>
            <View style={styles.shortcutIcon}>{item.icon}</View>
            <Text style={styles.shortcutLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.phraseBlock}>
        <Text style={styles.dailyPhrase}>"{dailyPhrase}"</Text>
      </View>

      <View style={styles.sectionDivider} />

      <View style={[styles.ctaGrid, useRoomierLayout && styles.ctaGridRoomy]}>
        <TouchableOpacity style={[styles.ctaCard, useRoomierLayout && styles.ctaCardRoomy]} onPress={() => setGenreFilterOpen(true)}>
          <View style={styles.ctaIcon}>
            <Music size={20} color={appTheme.colors.chord} />
          </View>
          <View style={styles.ctaTextBlock}>
            <Text style={styles.ctaTitle}>Selecione seu gênero preferido</Text>
            <Text style={styles.ctaSubtitle}>Escolha um filtro e bons treinos.</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaCard, useRoomierLayout && styles.ctaCardRoomy]}
          onPress={() => {
            setNewPlaylistName('');
            setCreatePlaylistOpen(true);
          }}
        >
          <View style={styles.ctaIcon}>
            <ListMusic size={20} color={appTheme.colors.chord} />
          </View>
          <View style={styles.ctaTextBlock}>
            <Text style={styles.ctaTitle}>Crie aqui sua lista</Text>
            <Text style={styles.ctaSubtitle}>Monte uma sequência para tocar.</Text>
          </View>
        </TouchableOpacity>
      </View>
      <View style={[styles.filterBadge, useRoomierLayout && styles.filterBadgeRoomy]}>
        <Music size={14} color={appTheme.colors.chord} />
        <View style={styles.filterBadgeText}>
          <Text style={styles.filterBadgeTitle} numberOfLines={1}>{filterLabel}</Text>
          <Text style={styles.filterBadgeHint} numberOfLines={1}>{filterHint}</Text>
        </View>
      </View>
    </ScrollView>
    <GenreFilterModal visible={genreFilterOpen} onClose={() => setGenreFilterOpen(false)} />
    <AppModal
      visible={createPlaylistOpen}
      title="Nova lista"
      onClose={() => {
        if (!creatingPlaylist) setCreatePlaylistOpen(false);
      }}
      icon={<ListMusic size={16} color="var(--app-accent)" />}
      maxWidth={460}
      footer={
        <>
          <TouchableOpacity
            style={styles.modalGhostButton}
            disabled={creatingPlaylist}
            onPress={() => setCreatePlaylistOpen(false)}
          >
            <Text style={styles.modalGhostText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalPrimaryButton, creatingPlaylist && styles.modalButtonDisabled]}
            disabled={creatingPlaylist}
            onPress={createPlaylist}
          >
            <Text style={styles.modalPrimaryText}>{creatingPlaylist ? 'Criando...' : 'Criar lista'}</Text>
          </TouchableOpacity>
        </>
      }
    >
      <View style={styles.createPlaylistBody}>
        <Text style={styles.createPlaylistHint}>Monte uma sequÃªncia para tocar.</Text>
        <TextInput
          style={styles.createPlaylistInput}
          value={newPlaylistName}
          onChangeText={setNewPlaylistName}
          placeholder="Nome da lista"
          placeholderTextColor="var(--app-subtle-text)"
          autoFocus
          onSubmitEditing={createPlaylist}
        />
      </View>
    </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'var(--app-bg)',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 130,
    gap: 14,
  },
  contentRoomy: {
    gap: 18,
    paddingTop: 24,
    paddingBottom: 72,
  },
  contentTablet: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
  },
  hero: {
    minHeight: 164,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.22)',
    backgroundColor: 'var(--app-surface)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroRoomy: {
    minHeight: 184,
    padding: 18,
    gap: 18,
  },
  logoWrap: {
    width: 92,
    height: 92,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'var(--app-surface-alt)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  logo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  kicker: {
    color: appTheme.colors.chord,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  filterBadge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.28)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  filterBadgeRoomy: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterBadgeText: {
    flexShrink: 1,
    minWidth: 0,
  },
  filterBadgeTitle: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '900',
  },
  filterBadgeHint: {
    color: 'var(--app-subtle-text)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  heroTitle: {
    color: 'var(--app-text)',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  filteredHeroLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
  },
  filteredGenreName: {
    color: 'var(--app-accent)',
    fontWeight: '900',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  greetingAccent: {
    color: 'var(--app-accent)',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 2,
  },
  statsGridRoomy: {
    gap: 12,
    marginBottom: 4,
  },
  statCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
  },
  statCardRoomy: {
    minHeight: 128,
    padding: 14,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  statValue: {
    color: 'var(--app-text)',
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  statHint: {
    color: 'var(--app-subtle-text)',
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'var(--app-border-soft)',
    opacity: 0.72,
    marginTop: 2,
    marginBottom: 2,
  },
  sectionTitle: {
    color: 'var(--app-text)',
    fontSize: 16,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    marginTop: 4,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 2,
  },
  shortcutsGridRoomy: {
    gap: 10,
    paddingVertical: 4,
  },
  shortcutCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  shortcutCardRoomy: {
    minHeight: 84,
    paddingVertical: 8,
  },
  shortcutIcon: {
    width: 54,
    height: 54,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-surface-alt)',
    marginBottom: 7,
  },
  shortcutLabel: {
    color: 'var(--app-text)',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  phraseBlock: {
    borderTopWidth: 1,
    borderTopColor: 'var(--app-border-soft)',
    paddingTop: 12,
    marginTop: 4,
  },
  dailyPhrase: {
    color: 'var(--app-subtle-text)',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 12,
    marginTop: -2,
  },
  recommendations: {
    gap: 12,
    paddingRight: 16,
  },
  songCard: {
    width: 172,
    height: 210,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#14212b',
    padding: 12,
    justifyContent: 'space-between',
  },
  songCardRoomy: {
    width: 190,
    height: 228,
    padding: 14,
  },
  songCardAlt: {
    backgroundColor: '#241f32',
  },
  songCardWarm: {
    backgroundColor: '#2a2418',
  },
  songCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  songBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  playPill: {
    minHeight: 26,
    borderRadius: 8,
    backgroundColor: appTheme.colors.chord,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playPillText: {
    color: '#04151e',
    fontSize: 11,
    fontWeight: '900',
  },
  songCardBottom: {
    minHeight: 86,
  },
  songTitle: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  songArtist: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 6,
  },
  songGenre: {
    color: appTheme.colors.chord,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
  },
  emptyCard: {
    width: 280,
    minHeight: 150,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    padding: 16,
    justifyContent: 'center',
  },
  emptyTitle: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  ctaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 0,
  },
  ctaGridRoomy: {
    gap: 12,
    marginTop: 2,
  },
  ctaCard: {
    flex: 1,
    minHeight: 116,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.22)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(79,195,247,0.16) 0%, rgba(255,209,102,0.12) 48%, rgba(255,255,255,0.04) 100%)',
    padding: 14,
    justifyContent: 'space-between',
  },
  ctaCardRoomy: {
    minHeight: 142,
    padding: 16,
  },
  ctaIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79,195,247,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.22)',
  },
  ctaTextBlock: {
    marginTop: 10,
  },
  ctaTitle: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  ctaSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  createPlaylistBody: {
    gap: 12,
  },
  createPlaylistHint: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 19,
  },
  createPlaylistInput: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    color: 'var(--app-text)',
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '800',
  },
  modalGhostButton: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalGhostText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  modalPrimaryButton: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: 'var(--app-accent)',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: '#04151e',
    fontSize: 13,
    fontWeight: '900',
  },
  modalButtonDisabled: {
    opacity: 0.55,
  },
});
