import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import {
  ArrowDownToLine,
  BookOpen,
  Folder as FolderIcon,
  Globe,
  Heart,
  ListMusic,
  Music,
  PlayCircle,
  Settings as SettingsIcon,
  Star,
  User,
  X,
} from 'lucide-react';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import type { DrawerFavoriteShortcut } from '../contexts/DrawerContext';
import { useSettings } from '../contexts/SettingsContext';
import type { ManualRoute } from '../navigation/manualTypes';
import type { LastOpenedPlaylist } from '../types/models';
import { getGenreDisplayName, NO_GENRE_KEY, NO_GENRE_LABEL } from '../utils/genres';
import { DrawerItem } from './DrawerItem';

interface AppDrawerProps {
  visible: boolean;
  stats: {
    songs: number;
    playlists: number;
    artists: number;
    folders: number;
    lastOpenedPlaylist: LastOpenedPlaylist | null;
    favoriteShortcuts: DrawerFavoriteShortcut[];
  };
  onClose: () => void;
  onNavigate: (route: ManualRoute) => void;
  styles: any;
}

export function AppDrawer({ visible, stats, onClose, onNavigate, styles }: AppDrawerProps) {
  const { globalFilters } = useGenreFilter();
  const { homeShortcutSettings, themeSettings } = useSettings();
  const selectedGenres = globalFilters.selectedGenres;
  const artistCount = stats.artists;
  const folderCount = stats.folders;
  const lastOpenedPlaylist = stats.lastOpenedPlaylist;
  const favoriteShortcuts = stats.favoriteShortcuts;
  const isLightTheme = themeSettings.mode === 'light';

  const filterLabel =
    selectedGenres.length === 0
      ? 'Todos os gêneros'
      : selectedGenres.length === 1
        ? selectedGenres[0] === NO_GENRE_KEY
          ? NO_GENRE_LABEL
          : getGenreDisplayName(selectedGenres[0])
        : `${selectedGenres.length} gêneros selecionados`;

  const filterChips =
    selectedGenres.length === 0
      ? ['Todos']
      : [
          ...selectedGenres
            .slice(0, 4)
            .map((genre) => (genre === NO_GENRE_KEY ? NO_GENRE_LABEL : getGenreDisplayName(genre))),
          ...(selectedGenres.length > 4 ? [`+${selectedGenres.length - 4}`] : []),
        ];

  const navigate = (route: ManualRoute) => {
    onNavigate(route);
    onClose();
  };

  const openLastPlaylist = () => {
    if (!lastOpenedPlaylist) return;
    navigate({
      name: 'PlaylistDetail',
      params: {
        playlistId: lastOpenedPlaylist.playlistId,
        playlistName: lastOpenedPlaylist.playlistName,
        folderId: lastOpenedPlaylist.folderId ?? null,
      },
    });
  };

  const openFavoriteShortcut = (shortcut: DrawerFavoriteShortcut) => {
    if (shortcut.type === 'folder') {
      navigate({ name: 'FolderDetail', params: { folderId: shortcut.id, folderName: shortcut.name } });
      return;
    }
    navigate({
      name: 'PlaylistDetail',
      params: {
        playlistId: shortcut.id,
        playlistName: shortcut.name,
        folderId: shortcut.folderId,
      },
    });
  };

  const showFavoriteShortcuts = homeShortcutSettings.mode === 'favorites' || homeShortcutSettings.mode === 'all';
  const lastOpenedIsFavorite = favoriteShortcuts.some((shortcut) => (
    shortcut.type === 'playlist' && shortcut.id === lastOpenedPlaylist?.playlistId
  ));
  const showRecentShortcut = (homeShortcutSettings.mode === 'recent' || homeShortcutSettings.mode === 'all')
    && !(homeShortcutSettings.mode === 'all' && lastOpenedIsFavorite);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.drawerOverlay} onPress={onClose} activeOpacity={1}>
        <View />
      </TouchableOpacity>

      <View style={[localStyles.drawer, isLightTheme && localStyles.drawerLight]}>
        <View style={[localStyles.header, isLightTheme && localStyles.headerLight]}>
          <View style={localStyles.brandRow}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Ir para o inicio"
              activeOpacity={0.82}
              onPress={() => navigate({ name: 'HomeDashboard' })}
              style={localStyles.brandLink}
            >
              <img src="/CifrasGo-192.png" alt="CifrasGo" style={localStyles.logo as React.CSSProperties} />
            <View style={localStyles.brandTextBlock}>
              <Text style={localStyles.brandTitle}>CifrasGo</Text>
              <Text style={localStyles.brandSubtitle}>Seu repertório sempre com você.</Text>
            </View>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fechar menu"
              activeOpacity={0.82}
              onPress={onClose}
              style={[localStyles.closeButton, isLightTheme && localStyles.closeButtonLight]}
            >
              <X size={18} color="var(--app-muted-text)" />
            </TouchableOpacity>
          </View>

          <View style={[localStyles.filterCard, isLightTheme && localStyles.filterCardLight]}>
            <View style={[localStyles.filterIcon, isLightTheme && localStyles.filterIconLight]}>
              <Music size={18} color="#facc15" />
            </View>
            <View style={localStyles.filterTextBlock}>
              <Text style={localStyles.filterEyebrow}>Filtro atual</Text>
              <Text style={localStyles.filterTitle} numberOfLines={1}>
                {filterLabel}
              </Text>
            </View>
          </View>

          <View style={localStyles.chipRow}>
            {filterChips.map((chip) => (
              <View key={chip} style={[localStyles.filterChip, isLightTheme && localStyles.filterChipLight]}>
                <Text style={localStyles.filterChipText} numberOfLines={1}>
                  {chip}
                </Text>
              </View>
            ))}
          </View>

          <View style={localStyles.statsRow}>
            <View style={[localStyles.statCard, isLightTheme && localStyles.statCardLight]}>
              <View style={[localStyles.statIcon, { backgroundColor: 'rgba(250,204,21,0.12)' }]}>
                <Music size={16} color="#facc15" />
              </View>
              <Text style={localStyles.statNumber}>{stats.songs}</Text>
              <Text style={localStyles.statLabel}>Músicas</Text>
            </View>
            <View style={[localStyles.statCard, isLightTheme && localStyles.statCardLight]}>
              <View style={[localStyles.statIcon, { backgroundColor: 'rgba(56,189,248,0.12)' }]}>
                <ListMusic size={16} color="#38bdf8" />
              </View>
              <Text style={localStyles.statNumber}>{stats.playlists}</Text>
              <Text style={localStyles.statLabel}>Listas</Text>
            </View>
            <View style={[localStyles.statCard, isLightTheme && localStyles.statCardLight]}>
              <View style={[localStyles.statIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                <User size={16} color="#22c55e" />
              </View>
              <Text style={localStyles.statNumber}>{artistCount}</Text>
              <Text style={localStyles.statLabel}>Artistas</Text>
            </View>
          </View>
          {showFavoriteShortcuts ? favoriteShortcuts.map((shortcut) => {
            const tone = shortcut.type === 'playlist' ? '#facc15' : '#a855f7';
            return (
              <TouchableOpacity
                key={`${shortcut.type}-${shortcut.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Abrir favorito ${shortcut.name}`}
                activeOpacity={0.86}
                onPress={() => openFavoriteShortcut(shortcut)}
                style={[
                  localStyles.continueCard,
                  localStyles.favoriteCard,
                  isLightTheme && localStyles.continueCardLight,
                  isLightTheme && localStyles.favoriteCardLight,
                ]}
              >
                <View style={[localStyles.continueIcon, localStyles.favoriteIcon]}>
                  {shortcut.type === 'playlist' ? (
                    <ListMusic size={18} color={tone} />
                  ) : (
                    <FolderIcon size={18} color={tone} />
                  )}
                </View>
                <View style={localStyles.continueTextBlock}>
                  <Text style={localStyles.continueTitle}>Favorito</Text>
                  <Text style={localStyles.continuePlaylistName} numberOfLines={1}>{shortcut.name}</Text>
                  <Text style={localStyles.continueSubtitle}>{shortcut.type === 'playlist' ? 'Lista' : 'Pasta'}</Text>
                </View>
                <Star size={15} color={tone} fill={tone} />
              </TouchableOpacity>
            );
          }) : null}

          {showRecentShortcut ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Continuar de onde parou"
              activeOpacity={lastOpenedPlaylist ? 0.86 : 1}
              disabled={!lastOpenedPlaylist}
              onPress={openLastPlaylist}
              style={[localStyles.continueCard, isLightTheme && localStyles.continueCardLight]}
            >
              <View style={[localStyles.continueIcon, isLightTheme && localStyles.continueIconLight]}>
                <PlayCircle size={18} color="#38bdf8" />
              </View>
              <View style={localStyles.continueTextBlock}>
                <Text style={localStyles.continueTitle}>Continuar de onde parou</Text>
                <Text style={lastOpenedPlaylist ? localStyles.continuePlaylistName : localStyles.continueSubtitle} numberOfLines={1}>
                  {lastOpenedPlaylist?.playlistName || 'Abra uma lista para continuar depois.'}
                </Text>
                {lastOpenedPlaylist ? (
                  <Text style={localStyles.continueSubtitle}>Última lista aberta</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView style={localStyles.scroll} contentContainerStyle={localStyles.scrollContent}>
          <Text style={localStyles.sectionTitle}>Navegação</Text>
          <View style={localStyles.tileGrid}>
            <DrawerItem
              label="Listas"
              subtitle="Sequências"
              count={stats.playlists}
              variant="tile"
              tone="#facc15"
              styles={styles}
              icon={<ListMusic size={18} color="#facc15" />}
              onPress={() => navigate({ name: 'Folders' })}
            />
            <DrawerItem
              label="Músicas"
              subtitle="Repertório"
              count={stats.songs}
              variant="tile"
              tone="#38bdf8"
              styles={styles}
              icon={<Music size={18} color="#38bdf8" />}
              onPress={() => navigate({ name: 'Songs' })}
            />
            <DrawerItem
              label="Pastas"
              subtitle="Organização"
              count={folderCount}
              variant="tile"
              tone="#a855f7"
              styles={styles}
              icon={<FolderIcon size={18} color="#a855f7" />}
              onPress={() => navigate({ name: 'Folders' })}
            />
            <DrawerItem
              label="Artistas"
              subtitle="Catálogo"
              count={artistCount}
              variant="tile"
              tone="#22c55e"
              styles={styles}
              icon={<User size={18} color="#22c55e" />}
              onPress={() => navigate({ name: 'Artists' })}
            />
          </View>

          <Text style={localStyles.sectionTitle}>Ferramentas</Text>
          <DrawerItem
            label="Importar cifras"
            subtitle="Cole o link e importe rápido"
            tone="#06b6d4"
            styles={styles}
            icon={<Globe size={18} color="#06b6d4" />}
            onPress={() => navigate({ name: 'Import' })}
          />
          <DrawerItem
            label="Backup/Restauração"
            subtitle="Seus dados sempre seguros"
            tone="#22c55e"
            styles={styles}
            icon={<ArrowDownToLine size={18} color="#22c55e" />}
            onPress={() => navigate({ name: 'Backup' })}
          />

          <Text style={localStyles.sectionTitle}>Apoio</Text>
          <DrawerItem
            label="Sobre / Guia do usuário"
            subtitle="Manual rápido e dicas de uso"
            tone="#38bdf8"
            styles={styles}
            icon={<BookOpen size={18} color="#38bdf8" />}
            onPress={() => navigate({ name: 'About' })}
          />
          <DrawerItem
            label="Configurações"
            subtitle="Personalize o app do seu jeito"
            tone="#94a3b8"
            styles={styles}
            icon={<SettingsIcon size={18} color="#94a3b8" />}
            onPress={() => navigate({ name: 'Settings' })}
          />

          <View style={[localStyles.footerCard, isLightTheme && localStyles.footerCardLight]}>
            <View style={localStyles.footerIcon}>
              <Heart size={17} color="#38bdf8" />
            </View>
            <View style={localStyles.footerTextBlock}>
              <Text style={localStyles.footerTitle}>Feito para momentos que importam</Text>
              <Text style={localStyles.footerSubtitle}>Em ensaio, missa e celebrações.</Text>
            </View>
            <View style={localStyles.footerNotes}>
              <Music size={18} color="rgba(56,189,248,0.34)" />
              <Music size={14} color="rgba(56,189,248,0.22)" />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: 8,
    width: 304,
    maxWidth: '88%',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.18)',
    backgroundColor: 'var(--app-bg)',
    backgroundImage:
      'linear-gradient(165deg, rgba(14,165,233,0.10) 0%, rgba(15,23,42,0.04) 55%, rgba(8,47,73,0.08) 100%)',
    boxShadow: '0 24px 55px rgba(0,0,0,0.34)',
    overflow: 'hidden',
  },
  drawerLight: {
    borderColor: 'rgba(15,131,201,0.18)',
    backgroundColor: 'var(--app-bg)',
    backgroundImage:
      'linear-gradient(165deg, rgba(255,253,248,0.98) 0%, rgba(239,246,249,0.92) 58%, rgba(214,232,241,0.62) 100%)',
    boxShadow: '0 24px 48px rgba(31,41,55,0.16)',
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.12)',
    gap: 10,
  },
  headerLight: {
    borderBottomColor: 'rgba(15,131,201,0.12)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLink: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 10,
    objectFit: 'cover',
    boxShadow: '0 10px 18px rgba(14,165,233,0.18)',
  },
  brandTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  brandTitle: {
    color: 'var(--app-text)',
    fontSize: 16,
    fontWeight: '900',
  },
  brandSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 10.5,
    marginTop: 2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'var(--app-surface)',
  },
  closeButtonLight: {
    borderColor: 'rgba(15,131,201,0.14)',
    backgroundColor: 'rgba(255,253,248,0.92)',
    boxShadow: '0 8px 18px rgba(31,41,55,0.08)',
  },
  filterCard: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.36)',
    backgroundColor: 'rgba(250,204,21,0.08)',
    backgroundImage: 'linear-gradient(135deg, rgba(250,204,21,0.12), rgba(15,23,42,0.08))',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterCardLight: {
    borderColor: 'rgba(215,154,33,0.34)',
    backgroundColor: 'rgba(255,248,229,0.82)',
    backgroundImage: 'linear-gradient(135deg, rgba(215,154,33,0.14), rgba(255,253,248,0.96))',
    boxShadow: '0 12px 22px rgba(146,64,14,0.08)',
  },
  filterIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.30)',
    backgroundColor: 'rgba(250,204,21,0.12)',
  },
  filterIconLight: {
    borderColor: 'rgba(215,154,33,0.28)',
    backgroundColor: 'rgba(215,154,33,0.12)',
  },
  filterTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  filterEyebrow: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  filterTitle: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'var(--app-surface)',
  },
  filterChipLight: {
    borderColor: 'rgba(15,131,201,0.12)',
    backgroundColor: 'rgba(255,253,248,0.82)',
  },
  filterChipText: {
    color: 'var(--app-muted-text)',
    fontSize: 10,
    fontWeight: '800',
  },
  continueCard: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.20)',
    backgroundColor: 'rgba(14,165,233,0.07)',
    backgroundImage: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(15,23,42,0.04))',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  continueCardLight: {
    borderColor: 'rgba(15,131,201,0.16)',
    backgroundColor: 'rgba(239,246,249,0.88)',
    backgroundImage: 'linear-gradient(135deg, rgba(15,131,201,0.10), rgba(255,253,248,0.92))',
    boxShadow: '0 12px 22px rgba(31,41,55,0.08)',
  },
  favoriteCard: {
    borderColor: 'rgba(250,204,21,0.24)',
    backgroundImage: 'linear-gradient(135deg, rgba(250,204,21,0.10), rgba(15,23,42,0.08))',
  },
  favoriteCardLight: {
    borderColor: 'rgba(215,154,33,0.24)',
    backgroundImage: 'linear-gradient(135deg, rgba(215,154,33,0.10), rgba(255,253,248,0.94))',
  },
  continueIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.24)',
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  continueIconLight: {
    borderColor: 'rgba(15,131,201,0.18)',
    backgroundColor: 'rgba(15,131,201,0.10)',
  },
  favoriteIcon: {
    borderColor: 'rgba(250,204,21,0.26)',
    backgroundColor: 'rgba(250,204,21,0.12)',
  },
  continueTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  continueTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  continueSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  continuePlaylistName: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  continueOpenPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.24)',
    backgroundColor: 'rgba(14,165,233,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  continueOpenPillLight: {
    borderColor: 'rgba(15,131,201,0.16)',
    backgroundColor: 'rgba(15,131,201,0.10)',
  },
  continueOpenText: {
    color: 'var(--app-text)',
    fontSize: 10.5,
    fontWeight: '900',
  },
  statsRow: {
    display: 'none',
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    backgroundColor: 'var(--app-surface)',
    paddingVertical: 9,
    paddingHorizontal: 7,
    alignItems: 'center',
    gap: 3,
  },
  statCardLight: {
    borderColor: 'rgba(15,131,201,0.12)',
    backgroundColor: 'rgba(255,253,248,0.88)',
    boxShadow: '0 10px 20px rgba(31,41,55,0.07)',
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '900',
  },
  statLabel: {
    color: 'var(--app-muted-text)',
    fontSize: 10,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
  },
  sectionTitle: {
    color: 'var(--app-accent)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 2,
    marginBottom: 7,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  footerCard: {
    marginTop: 'auto',
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.18)',
    backgroundColor: 'rgba(14,165,233,0.07)',
    backgroundImage: 'linear-gradient(135deg, rgba(14,165,233,0.10), rgba(2,6,23,0.04))',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    overflow: 'hidden',
  },
  footerCardLight: {
    borderColor: 'rgba(15,131,201,0.16)',
    backgroundColor: 'rgba(239,246,249,0.86)',
    backgroundImage: 'linear-gradient(135deg, rgba(15,131,201,0.10), rgba(255,253,248,0.86))',
    boxShadow: '0 12px 24px rgba(31,41,55,0.08)',
  },
  footerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.22)',
  },
  footerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  footerTitle: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '900',
  },
  footerSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 10.5,
    marginTop: 2,
  },
  footerNotes: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    opacity: 0.9,
  },
});
