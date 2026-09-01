import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import {
  ArrowDownToLine,
  BarChart3,
  ChevronRight,
  Folder,
  Guitar,
  Globe2,
  ListMusic,
  Mic2,
  Music,
  Play,
  Settings,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { GenreFilterModal } from '../components/GenreFilterModal';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useSettings } from '../contexts/SettingsContext';
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
import { getPlaylistItems } from '../utils/playlistItems';
import { useDevScreenPerformance } from '../utils/devPerformance';

const homeStageArt = new URL('../assets/ui/palco.png', import.meta.url).href;
const homeNotesArt = new URL('../assets/ui/notes.png', import.meta.url).href;
const recentCardArts = [
  new URL('../assets/ui/recent-cards/recent-music-1.svg', import.meta.url).href,
  new URL('../assets/ui/recent-cards/recent-music-2.svg', import.meta.url).href,
  new URL('../assets/ui/recent-cards/recent-music-3.svg', import.meta.url).href,
  new URL('../assets/ui/recent-cards/recent-music-4.svg', import.meta.url).href,
  new URL('../assets/ui/recent-cards/recent-music-5.svg', import.meta.url).href,
  new URL('../assets/ui/recent-cards/recent-music-6.svg', import.meta.url).href,
  new URL('../assets/ui/recent-cards/recent-music-7.svg', import.meta.url).href,
  new URL('../assets/ui/recent-cards/recent-music-8.svg', import.meta.url).href,
];

const getRecentCardArt = (song: Song, index: number) => {
  const key = `${song.id || ''}${song.title || ''}${song.artist || ''}`;
  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), index);
  return recentCardArts[Math.abs(hash) % recentCardArts.length];
};

interface DashboardStat {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  onPress: () => void;
  tone: string;
  glow: string;
}

interface DashboardShortcut {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  tone: string;
  glow: string;
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
  useDevScreenPerformance('HomeDashboard');
  const nav = useManualNavigation();
  const { globalFilters } = useGenreFilter();
  const { themeSettings } = useSettings();
  const [{ width, height }, setViewportSize] = React.useState(getViewportSize);
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [playlists, setPlaylists] = React.useState<Playlist[]>([]);
  const [registeredGenres, setRegisteredGenres] = React.useState<Genre[]>([]);
  const [userName, setUserName] = React.useState('');
  const [genreFilterOpen, setGenreFilterOpen] = React.useState(false);
  const [createPlaylistOpen, setCreatePlaylistOpen] = React.useState(false);
  const [favoritePlaylistsModalOpen, setFavoritePlaylistsModalOpen] = React.useState(false);
  const [newPlaylistName, setNewPlaylistName] = React.useState('');
  const [creatingPlaylist, setCreatingPlaylist] = React.useState(false);
  const isTallScreen = height >= 760;
  const isTabletWidth = width >= 700;
  const useRoomierLayout = isTallScreen || isTabletWidth;
  const isLightTheme = themeSettings.mode === 'light';
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

  const favoritePlaylists = React.useMemo(
    () =>
      playlists
        .filter((playlist) => playlist.isStarred === true)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true })),
    [playlists]
  );

  const dailyPhrase = React.useMemo(() => {
    const dayIndex = new Date().getDay();
    return dashboardPhrases[dayIndex % dashboardPhrases.length];
  }, []);

  const openSong = React.useCallback((song: Song) => {
    nav.navigate('SongDetail', { id: song.id, returnTo: songsReturnTo });
  }, [nav]);

  const getPlaylistSongCount = React.useCallback((playlist: Playlist) =>
    getPlaylistItems(playlist).filter((item) => item.type === 'song').length,
    []
  );

  const openPlaylist = React.useCallback((playlist: Playlist) => {
    nav.navigate('PlaylistDetail', {
      playlistId: playlist.id,
      playlistName: playlist.name,
      folderId: playlist.folderId ?? null,
    });
  }, [nav]);

  const openFavoritePlaylists = React.useCallback(() => {
    if (favoritePlaylists.length === 1) {
      openPlaylist(favoritePlaylists[0]);
      return;
    }
    if (favoritePlaylists.length > 1) {
      setFavoritePlaylistsModalOpen(true);
    }
  }, [favoritePlaylists, openPlaylist]);

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
  const hasFavoritePlaylists = favoritePlaylists.length > 0;
  const singleFavoritePlaylist = favoritePlaylists.length === 1 ? favoritePlaylists[0] : null;
  const favoriteCardTitle = singleFavoritePlaylist ? singleFavoritePlaylist.name : 'Listas favoritas';
  const favoriteCardHint = singleFavoritePlaylist
    ? `${getPlaylistSongCount(singleFavoritePlaylist)} músicas`
    : `${favoritePlaylists.length} listas favoritas`;

  const stats: DashboardStat[] = [
    {
      label: 'Músicas',
      value: filteredSongs.length,
      hint: selectedGenres.length === 0 ? 'no repertório' : 'no filtro',
      icon: <Music size={19} color="#facc15" />,
      onPress: () => nav.navigate('Songs'),
      tone: '#facc15',
      glow: 'rgba(250, 204, 21, 0.18)',
    },
    {
      label: 'Listas',
      value: filteredPlaylists.length,
      hint: selectedGenres.length === 0 ? 'para tocar' : 'com músicas do filtro',
      icon: <ListMusic size={19} color="#38bdf8" />,
      onPress: () => nav.navigate('Folders'),
      tone: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.18)',
    },
    {
      label: 'Artistas',
      value: artistsCount,
      hint: 'catalogados',
      icon: <Users size={19} color="#22c55e" />,
      onPress: () => nav.navigate('Artists'),
      tone: '#22c55e',
      glow: 'rgba(34, 197, 94, 0.18)',
    },
  ];

  const shortcuts: DashboardShortcut[] = [
    {
      label: 'Músicas',
      icon: <Music size={25} color="#facc15" />,
      onPress: () => nav.navigate('Songs'),
      tone: '#facc15',
      glow: 'rgba(250, 204, 21, 0.22)',
    },
    {
      label: 'Artistas',
      icon: <Mic2 size={25} color="#22c55e" />,
      onPress: () => nav.navigate('Artists'),
      tone: '#22c55e',
      glow: 'rgba(34, 197, 94, 0.2)',
    },
    {
      label: 'Listas',
      icon: <Folder size={25} color="#38bdf8" />,
      onPress: () => nav.navigate('Folders'),
      tone: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.2)',
    },
    {
      label: 'Importar',
      icon: <Globe2 size={25} color="#a855f7" />,
      onPress: () => nav.navigate('Import'),
      tone: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.2)',
    },
    {
      label: 'Backup',
      icon: <ArrowDownToLine size={25} color="#22d3ee" />,
      onPress: () => nav.navigate('Backup'),
      tone: '#22d3ee',
      glow: 'rgba(34, 211, 238, 0.2)',
    },
    {
      label: 'Estatísticas',
      icon: <BarChart3 size={25} color="#f59e0b" />,
      onPress: () => nav.navigate('RepertoireStats'),
      tone: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.2)',
    },
    {
      label: 'Config.',
      icon: <Settings size={25} color="#94a3b8" />,
      onPress: () => nav.navigate('Settings'),
      tone: '#94a3b8',
      glow: 'rgba(148, 163, 184, 0.18)',
    },
  ];

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={contentStyle}>
      <View style={[styles.hero, useRoomierLayout && styles.heroRoomy, isLightTheme && styles.heroLight]}>
        <img
          src={homeStageArt}
          alt=""
          aria-hidden="true"
          style={{
            ...(styles.heroStageArt as React.CSSProperties),
            ...(isLightTheme ? styles.heroStageArtLight as React.CSSProperties : {}),
          }}
        />
        <View style={[styles.heroStageVeil, isLightTheme && styles.heroStageVeilLight]} />
        <View style={[styles.logoWrap, isLightTheme && styles.logoWrapLight]}>
          <img src="/CifrasGo-192.png" alt="CifrasGo" style={styles.logo as React.CSSProperties} />
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
          <TouchableOpacity
            key={item.label}
            accessibilityRole="button"
            style={[
              styles.statCard,
              useRoomierLayout && styles.statCardRoomy,
              isLightTheme && styles.statCardLight,
              {
                borderColor: `${item.tone}24`,
                boxShadow: isLightTheme ? '0 14px 26px rgba(31,41,55,0.075)' : `0 12px 28px ${item.glow}`,
                backgroundImage: isLightTheme
                  ? `linear-gradient(135deg, ${item.tone}10 0%, rgba(255,253,248,0.98) 52%, rgba(241,245,247,0.92) 100%)`
                  : `linear-gradient(135deg, ${item.tone}12 0%, rgba(15,23,42,0.78) 48%, rgba(255,255,255,0.025) 100%)`,
              },
            ]}
            onPress={item.onPress}
          >
            <View
              style={[
                styles.statIcon,
                {
                  borderColor: `${item.tone}50`,
                  backgroundColor: `${item.tone}14`,
                  boxShadow: `0 0 0 1px ${item.glow}, 0 9px 22px ${item.glow}`,
                },
              ]}
            >
              {item.icon}
            </View>
            <View style={styles.statTextBlock}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
              <Text style={styles.statHint}>{item.hint}</Text>
            </View>
          </TouchableOpacity>
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
                isLightTheme && styles.songCardLight,
              ]}
              onPress={() => openSong(song)}
            >
              <img
                src={getRecentCardArt(song, index)}
                alt=""
                aria-hidden="true"
                style={{
                  ...(styles.songCardArt as React.CSSProperties),
                  ...(isLightTheme ? styles.songCardArtLight as React.CSSProperties : {}),
                }}
              />
              <View style={[styles.songCardOverlay, isLightTheme && styles.songCardOverlayLight]} />
              <View style={styles.songCardTop}>
                <View style={[styles.songBadge, isLightTheme && styles.songBadgeLight]}>
                  <Music size={15} color={isLightTheme ? '#b7791f' : appTheme.colors.chord} />
                </View>
                <View style={[styles.playPill, isLightTheme && styles.playPillLight]}>
                  <Play size={11} color="#04151e" />
                  <Text style={styles.playPillText}>Abrir</Text>
                </View>
              </View>
              <View style={[styles.songCardBottom, isLightTheme && styles.songCardBottomLight]}>
                <Text style={[styles.songTitle, isLightTheme && styles.songTitleLight]} numberOfLines={2}>{song.title || 'Sem título'}</Text>
                <Text style={[styles.songArtist, isLightTheme && styles.songArtistLight]} numberOfLines={1}>{(song.artist || '').trim() || 'Sem artista'}</Text>
                {getSongGenreDisplay(song) ? (
                  <Text style={[styles.songGenre, isLightTheme && styles.songGenreLight]} numberOfLines={1}>{getSongGenreDisplay(song)}</Text>
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
          <TouchableOpacity
            key={item.label}
            style={[
              styles.shortcutCard,
              useRoomierLayout && styles.shortcutCardRoomy,
              {
                borderColor: `${item.tone}22`,
                boxShadow: isLightTheme ? '0 12px 22px rgba(15,23,42,0.07)' : `0 12px 28px ${item.glow}`,
              },
              isLightTheme && styles.shortcutCardLight,
            ]}
            onPress={item.onPress}
          >
            <View
              style={[
                styles.shortcutIcon,
                {
                  borderColor: `${item.tone}55`,
                  backgroundColor: `${item.tone}14`,
                  boxShadow: `0 0 0 1px ${item.glow}, 0 10px 24px ${item.glow}`,
                },
              ]}
            >
              {item.icon}
            </View>
            <Text style={styles.shortcutLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.phraseBlock, isLightTheme && styles.phraseBlockLight]}>
        <img src={homeNotesArt} alt="" aria-hidden="true" style={styles.phraseNotesArt as React.CSSProperties} />
        <Text style={styles.dailyPhrase}>"{dailyPhrase}"</Text>
      </View>

      <View style={styles.sectionDivider} />


      {hasFavoritePlaylists ? (
        <View style={styles.quickAccessRow}>
          <TouchableOpacity
            accessibilityRole="button"
            style={[
              styles.filterBadge,
              styles.quickAccessCard,
              isLightTheme && styles.filterBadgeLight,
              useRoomierLayout && styles.filterBadgeRoomy,
            ]}
            onPress={() => setGenreFilterOpen(true)}
          >
            <Music size={14} color={appTheme.colors.chord} />
            <View style={styles.filterBadgeText}>
              <Text style={styles.filterBadgeTitle} numberOfLines={1}>{filterLabel}</Text>
              <Text style={styles.filterBadgeHint} numberOfLines={1}>{filterHint}</Text>
            </View>
            <ChevronRight size={18} color="var(--app-subtle-text)" />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={[
              styles.filterBadge,
              styles.quickAccessCard,
              styles.favoriteBadge,
              isLightTheme && styles.filterBadgeLight,
              isLightTheme && styles.favoriteBadgeLight,
              useRoomierLayout && styles.filterBadgeRoomy,
            ]}
            onPress={openFavoritePlaylists}
          >
            <Star size={14} color="#ffd166" fill="#ffd166" />
            <View style={styles.filterBadgeText}>
              <Text style={styles.filterBadgeTitle} numberOfLines={1}>{favoriteCardTitle}</Text>
              <Text style={styles.filterBadgeHint} numberOfLines={1}>{favoriteCardHint}</Text>
            </View>
            <ChevronRight size={18} color="var(--app-subtle-text)" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          style={[styles.filterBadge, isLightTheme && styles.filterBadgeLight, useRoomierLayout && styles.filterBadgeRoomy]}
          onPress={() => setGenreFilterOpen(true)}
        >
          <Music size={14} color={appTheme.colors.chord} />
          <View style={styles.filterBadgeText}>
            <Text style={styles.filterBadgeTitle} numberOfLines={1}>{filterLabel}</Text>
            <Text style={styles.filterBadgeHint} numberOfLines={1}>{filterHint}</Text>
          </View>
          <ChevronRight size={18} color="var(--app-subtle-text)" />
        </TouchableOpacity>
      )}


      <View style={[styles.ctaGrid, useRoomierLayout && styles.ctaGridRoomy]}>
        <TouchableOpacity
          style={[styles.ctaCard, styles.ctaCardAmber, isLightTheme && styles.ctaCardAmberLight, useRoomierLayout && styles.ctaCardRoomy]}
          onPress={() => setGenreFilterOpen(true)}
        >
          <View style={[styles.ctaIcon, styles.ctaIconAmber]}>
            <Music size={23} color="#facc15" />
          </View>

          <View style={styles.ctaContent}>
          <View style={styles.ctaTextBlock}>
            <Text style={styles.ctaTitle}>Selecione seu gênero preferido</Text>
            <Text style={styles.ctaSubtitle}>Escolha um filtro e bons treinos.</Text>
          </View>
          <View style={[styles.ctaInlineButton, styles.ctaInlineButtonAmber]}>
            <Text style={[styles.ctaInlineButtonText, styles.ctaInlineButtonTextAmber]}>Definir filtro</Text>
          </View></View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctaCard, styles.ctaCardBlue, isLightTheme && styles.ctaCardBlueLight, useRoomierLayout && styles.ctaCardRoomy]}
          onPress={() => {
            setNewPlaylistName('');
            setCreatePlaylistOpen(true);
          }}
        >
          <View style={[styles.ctaIcon, styles.ctaIconBlue]}>
            <ListMusic size={23} color="#38bdf8" />
          </View>
           <View style={styles.ctaContent}>
          <View style={styles.ctaTextBlock}>
            <Text style={styles.ctaTitle}>Crie aqui sua lista</Text>
            <Text style={styles.ctaSubtitle}>Monte uma sequência para tocar.</Text>
          </View>
          <View style={[styles.ctaInlineButton, styles.ctaInlineButtonBlue]}>
            <Text style={[styles.ctaInlineButtonText, styles.ctaInlineButtonTextBlue]}>Criar lista</Text>
          </View></View>
        </TouchableOpacity>
      </View>
      
    </ScrollView>
    <GenreFilterModal visible={genreFilterOpen} onClose={() => setGenreFilterOpen(false)} />
    <AppModal
      visible={favoritePlaylistsModalOpen}
      title="Favoritas"
      onClose={() => setFavoritePlaylistsModalOpen(false)}
      icon={<Star size={16} color="#ffd166" fill="#ffd166" />}
      maxWidth={480}
    >
      <View style={styles.favoriteModalList}>
        {favoritePlaylists.map((playlist) => (
          <TouchableOpacity
            key={playlist.id}
            accessibilityRole="button"
            style={styles.favoriteModalRow}
            onPress={() => {
              setFavoritePlaylistsModalOpen(false);
              openPlaylist(playlist);
            }}
          >
            <View style={styles.favoriteModalIcon}>
              <Star size={15} color="#ffd166" fill="#ffd166" />
            </View>
            <View style={styles.favoriteModalText}>
              <Text style={styles.favoriteModalTitle} numberOfLines={1}>{playlist.name}</Text>
              <Text style={styles.favoriteModalHint} numberOfLines={1}>{getPlaylistSongCount(playlist)} músicas</Text>
            </View>
            <ChevronRight size={18} color="var(--app-subtle-text)" />
          </TouchableOpacity>
        ))}
      </View>
    </AppModal>
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
        <Text style={styles.createPlaylistHint}>Monte uma sequência para tocar.</Text>
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
    backgroundColor: '#040f19',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  heroLight: {
    borderColor: 'rgba(15,131,201,0.18)',
    backgroundColor: '#fffdf8',
    backgroundImage: 'linear-gradient(135deg, rgba(255,253,248,0.98) 0%, rgba(238,244,248,0.92) 56%, rgba(232,219,190,0.44) 100%)',
    boxShadow: '0 16px 34px rgba(31,41,55,0.08)',
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
    zIndex: 2,
  },
  logoWrapLight: {
    backgroundColor: '#fffdf8',
    borderColor: 'rgba(15,131,201,0.18)',
    boxShadow: '0 12px 24px rgba(31,41,55,0.10)',
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
    zIndex: 2,
    paddingRight: 68,
  },
  heroStageArt: {
    position: 'absolute',
    right: -18,
    bottom: -10,
    width: '38%',
    height: '110%',
    objectFit: 'contain',
    opacity: 0.70,
    pointerEvents: 'none',
  },
  heroStageArtLight: {
    opacity: 0.25,
  },
  heroStageVeil: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '70%',
    backgroundImage: 'linear-gradient(90deg, rgba(12,20,27,0) 0%, rgba(12,20,27,0.32) 40%, rgba(12,20,27,0.08) 100%)',
    pointerEvents: 'none',
  },
  heroStageVeilLight: {
    backgroundImage: 'linear-gradient(90deg, rgba(255,253,248,0) 0%, rgba(255,253,248,0.76) 45%, rgba(241,245,247,0.22) 100%)',
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
    alignSelf: 'center',
    maxWidth: '100%',
    width: 'auto',
    minHeight: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.24)',
    backgroundColor: 'rgba(15, 23, 42, 0.76)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 10px 26px rgba(0,0,0,0.2)',
  },
  filterBadgeLight: {
    borderColor: 'rgba(15,131,201,0.16)',
    backgroundColor: 'rgba(255,253,248,0.88)',
    boxShadow: '0 10px 22px rgba(31,41,55,0.07)',
  },
  filterBadgeRoomy: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickAccessRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  quickAccessCard: {
    flex: 1,
    alignSelf: 'stretch',
    width: 'auto',
    justifyContent: 'center',
  },
  favoriteBadge: {
    borderColor: 'rgba(255,209,102,0.28)',
    backgroundImage: 'linear-gradient(135deg, rgba(255,209,102,0.12) 0%, rgba(15,23,42,0.76) 58%, rgba(255,255,255,0.03) 100%)',
  },
  favoriteBadgeLight: {
    borderColor: 'rgba(215,154,33,0.22)',
    backgroundImage: 'linear-gradient(135deg, rgba(215,154,33,0.12) 0%, rgba(255,253,248,0.96) 58%, rgba(254,243,199,0.38) 100%)',
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
    minHeight: 104,
    borderRadius: 8,
    borderWidth: 1,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.74)',
  },
  statCardLight: {
    backgroundColor: '#ffffff',
  },
  statCardRoomy: {
    minHeight: 116,
    padding: 15,
    gap: 13,
  },
  statIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    color: 'var(--app-text)',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  statLabel: {
    color: 'var(--app-text)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  statHint: {
    color: 'var(--app-subtle-text)',
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 1,
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
    gap: 8,
    paddingHorizontal: 0,
  },
  shortcutsGridRoomy: {
    gap: 12,
    paddingVertical: 4,
  },
  shortcutCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 84,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  shortcutCardLight: {
    backgroundColor: 'rgba(255,253,248,0.96)',
  },
  shortcutCardRoomy: {
    minHeight: 96,
    paddingVertical: 12,
  },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shortcutLabel: {
    color: 'var(--app-text)',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  phraseBlock: {
    borderTopWidth: 1,
    borderTopColor: 'var(--app-border-soft)',
    paddingTop: 12,
    marginTop: 4,
    minHeight: 54,
    justifyContent: 'center',
    boxShadow: '0 22px 34px rgba(13,21,27,0.95)',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 8,
    backgroundColor: '#0D151B',
  },
  phraseBlockLight: {
    borderTopColor: 'rgba(15,131,201,0.14)',
    backgroundColor: '#fffdf8',
    boxShadow: '0 14px 30px rgba(31,41,55,0.07)',
  },
  dailyPhrase: {
    color: 'var(--app-subtle-text)',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    fontWeight: '600',
    textAlign: 'left',
    paddingHorizontal: 34,
    marginTop: -2,
    zIndex: 2,
  },
  phraseNotesArt: {
    position: 'absolute',
    right: 8,
    top: -10,
    width: '42%',
    height: 68,
    objectFit: 'fill',
    opacity: 0.42,
    pointerEvents: 'none',
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
    overflow: 'hidden',
    position: 'relative',
  },
  songCardLight: {
    borderColor: 'rgba(15,131,201,0.14)',
    backgroundColor: '#fffdf8',
    boxShadow: '0 14px 28px rgba(31,41,55,0.08)',
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
    zIndex: 2,
  },
  songCardArt: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.86,
    pointerEvents: 'none',
  },
  songCardArtLight: {
    opacity: 0.90,
  },
  songCardOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(180deg, rgba(3,7,12,0.18) 0%, rgba(3,7,12,0.42) 42%, rgba(3,7,12,0.9) 100%)',
    pointerEvents: 'none',
  },
  songCardOverlayLight: {
    backgroundImage: 'linear-gradient(180deg, rgba(255,253,248,0.10) 0%, rgba(255,253,248,0.24) 46%, rgba(255,253,248,0.72) 100%)',
  },
  songBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  songBadgeLight: {
    backgroundColor: 'rgba(255,248,225,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(183,121,31,0.22)',
    boxShadow: '0 8px 18px rgba(146,64,14,0.10)',
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
  playPillLight: {
    backgroundColor: 'rgba(255,209,102,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(146,64,14,0.14)',
    boxShadow: '0 8px 16px rgba(146,64,14,0.10)',
  },
  playPillText: {
    color: '#04151e',
    fontSize: 11,
    fontWeight: '900',
  },
  songCardBottom: {
    minHeight: 86,
    zIndex: 2,
  },
  songCardBottomLight: {
    minHeight: 82,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(15,131,201,0.10)',
    backgroundColor: 'rgba(255,253,248,0.80)',
    paddingHorizontal: 8,
    paddingVertical: 7,
    boxShadow: '0 10px 20px rgba(31,41,55,0.07)',
  },
  songTitle: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  songTitleLight: {
    color: '#111827',
  },
  songArtist: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 6,
  },
  songArtistLight: {
    color: '#475569',
  },
  songGenre: {
    color: appTheme.colors.chord,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 6,
  },
  songGenreLight: {
    color: '#b7791f',
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
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 0,
  },
  ctaGridRoomy: {
    gap: 12,
    marginTop: 2,
  },
  ctaCard: {
    flex: 1,
    minWidth: 250,
    minHeight: 126,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'space-between',
    boxShadow: '0 14px 34px rgba(0,0,0,0.26)',
    overflow: 'hidden',
    flexDirection: 'row',
alignItems: 'center',
gap: 16,
  },
  ctaCardAmber: {
    borderColor: 'rgba(245, 158, 11, 0.36)',
    backgroundColor: 'rgba(35, 24, 16, 0.86)',
    backgroundImage: 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(36,24,18,0.92) 48%, rgba(255,255,255,0.035) 100%)',
  },
  ctaCardAmberLight: {
    borderColor: 'rgba(215,154,33,0.30)',
    backgroundColor: '#fffaf0',
    backgroundImage: 'linear-gradient(135deg, rgba(215,154,33,0.14) 0%, rgba(255,253,248,0.98) 52%, rgba(254,243,199,0.56) 100%)',
    boxShadow: '0 14px 30px rgba(146,64,14,0.08)',
  },
  ctaCardBlue: {
    borderColor: 'rgba(56, 189, 248, 0.32)',
    backgroundColor: 'rgba(9, 29, 46, 0.88)',
    backgroundImage: 'linear-gradient(135deg, rgba(56,189,248,0.2) 0%, rgba(8,33,54,0.94) 52%, rgba(255,255,255,0.035) 100%)',
  },
  ctaCardBlueLight: {
    borderColor: 'rgba(15,131,201,0.18)',
    backgroundColor: '#eef4f8',
    backgroundImage: 'linear-gradient(135deg, rgba(15,131,201,0.11) 0%, rgba(255,253,248,0.98) 52%, rgba(214,232,241,0.62) 100%)',
    boxShadow: '0 14px 30px rgba(15,131,201,0.08)',
  },
  ctaCardRoomy: {
    minHeight: 148,
    padding: 18,
  },
  ctaIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  ctaIconAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: 'rgba(245, 158, 11, 0.32)',
    boxShadow: '0 10px 26px rgba(245, 158, 11, 0.18)',
  },
  ctaIconBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderColor: 'rgba(56, 189, 248, 0.32)',
    boxShadow: '0 10px 26px rgba(56, 189, 248, 0.17)',
  },
  ctaTextBlock: {
    marginTop: 30,
  },
  ctaTitle: {
    color: 'var(--app-text)',
    fontSize: 14.5,
    fontWeight: '900',
    lineHeight: 18,
  },
  ctaSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  ctaInlineButton: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  ctaContent: {
  flex: 1,
  minWidth: 0,
  height: '100%',
  justifyContent: 'space-between',
},

  ctaInlineButtonAmber: {
    borderColor: 'rgba(245, 158, 11, 0.48)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  ctaInlineButtonBlue: {
    borderColor: 'rgba(56, 189, 248, 0.48)',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  ctaInlineButtonText: {
    fontSize: 12,
    fontWeight: '900',
  },
  ctaInlineButtonTextAmber: {
    color: '#fbbf24',
  },
  ctaInlineButtonTextBlue: {
    color: '#38bdf8',
  },
  favoriteModalList: {
    gap: 10,
  },
  favoriteModalRow: {
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  favoriteModalIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,209,102,0.30)',
    backgroundColor: 'rgba(255,209,102,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteModalText: {
    flex: 1,
    minWidth: 0,
  },
  favoriteModalTitle: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
  },
  favoriteModalHint: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
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
