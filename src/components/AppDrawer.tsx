import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native-web';
import {
  ArrowDownToLine,
  BookOpen,
  Folder as FolderIcon,
  Globe,
  Music,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import type { ManualRoute } from '../navigation/manualTypes';
import { getGenreDisplayName, NO_GENRE_KEY, NO_GENRE_LABEL } from '../utils/genres';
import { DrawerItem } from './DrawerItem';

interface AppDrawerProps {
  visible: boolean;
  stats: {
    songs: number;
    playlists: number;
  };
  onClose: () => void;
  onNavigate: (route: ManualRoute) => void;
  styles: any;
}

export function AppDrawer({ visible, stats, onClose, onNavigate, styles }: AppDrawerProps) {
  const { globalFilters } = useGenreFilter();
  const selectedGenres = globalFilters.selectedGenres;
  const filterLabel =
    selectedGenres.length === 0
      ? 'Todos os gêneros'
      : selectedGenres.length === 1
        ? selectedGenres[0] === NO_GENRE_KEY
          ? NO_GENRE_LABEL
          : getGenreDisplayName(selectedGenres[0])
        : `${selectedGenres.length} gêneros selecionados`;
  const navigate = (route: ManualRoute) => {
    onNavigate(route);
    onClose();
  };

  const filterCardStyle = {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  } as const;
  const filterIconStyle = {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'var(--app-surface-alt)',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
  const filterEyebrowStyle = {
    color: 'var(--app-subtle-text)',
    fontSize: 11,
    fontWeight: '700',
  } as const;
  const filterTitleStyle = {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
  } as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.drawerOverlay} onPress={onClose} activeOpacity={1}>
        <View />
      </TouchableOpacity>
      <View style={styles.drawer}>
        <View style={styles.drawerBrand}>
          <img src="/CifrasGo.png" alt="CifrasGo" style={styles.drawerLogo as React.CSSProperties} />
          <View style={filterCardStyle}>
            <View style={filterIconStyle}>
              <Music size={18} color="#4FC3F7" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={filterEyebrowStyle}>Filtro global</Text>
              <Text style={filterTitleStyle} numberOfLines={1}>{filterLabel}</Text>
            </View>
          </View>
          <View style={styles.drawerStatsRow}>
            <View style={styles.drawerStatPill}>
              <Text style={styles.drawerStatNumber}>{stats.songs}</Text>
              <Text style={styles.drawerStatLabel}>{stats.songs === 1 ? 'música' : 'músicas'}</Text>
            </View>
            <View style={styles.drawerStatPill}>
              <Text style={styles.drawerStatNumber}>{stats.playlists}</Text>
              <Text style={styles.drawerStatLabel}>{stats.playlists === 1 ? 'lista' : 'listas'}</Text>
            </View>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 22 }}>
          <DrawerItem
            label="Artistas"
            styles={styles}
            icon={<User size={18} color="#4FC3F7" />}
            onPress={() => navigate({ name: 'Artists' })}
          />
          <DrawerItem
            label="Músicas"
            styles={styles}
            icon={<Music size={18} color="#4FC3F7" />}
            onPress={() => navigate({ name: 'Songs' })}
          />
          <DrawerItem
            label="Pastas/Listas"
            styles={styles}
            icon={<FolderIcon size={18} color="#4FC3F7" />}
            onPress={() => navigate({ name: 'Folders' })}
          />
          <DrawerItem
            label="Importar Cifras"
            styles={styles}
            icon={<Globe size={18} color="#4FC3F7" />}
            onPress={() => navigate({ name: 'Import' })}
          />
          <DrawerItem
            label="Backup/Restauração"
            styles={styles}
            icon={<ArrowDownToLine size={18} color="#4FC3F7" />}
            onPress={() => navigate({ name: 'Backup' })}
          />
          <DrawerItem
            label="Sobre / Guia do usuário"
            styles={styles}
            icon={<BookOpen size={18} color="#4FC3F7" />}
            onPress={() => navigate({ name: 'About' })}
          />
        </ScrollView>
        <View style={styles.drawerBottom}>
          <DrawerItem
            label="Configurações"
            styles={styles}
            icon={<SettingsIcon size={18} color="#4FC3F7" />}
            onPress={() => navigate({ name: 'Settings' })}
          />
        </View>
      </View>
    </Modal>
  );
}
