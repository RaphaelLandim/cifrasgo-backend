import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { BookOpen, ChevronRight, LayoutDashboard, ListMusic, Music, Palette, Pencil, Plus, Trash2 } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { AppModal } from '../components/AppModal';
import { useConfirmDestructiveAction } from '../components/ConfirmDialog';
import { GenreFilterModal } from '../components/GenreFilterModal';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../services/storage';
import {
  COLOR_OPTIONS,
  STAFF_LINE_COLOR_OPTIONS,
  THEME_COLOR_INPUTS,
} from '../theme/theme';
import type { ChordSpellingMode, Genre, Song, ThemePalette } from '../types/models';
import {
  NO_GENRE_KEY,
  getGenreDisplayName,
  getSongGenreKeys,
  normalizeGenreName,
} from '../utils/genres';

interface SettingsScreenProps {
  songs: Song[];
  styles: any;
}

const normalizeHexColor = (value: string): string => {
  const clean = (value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean;
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    const [, r, g, b] = clean;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#000000';
};

const hexToRgbText = (hex: string): string => {
  const normalized = normalizeHexColor(hex).replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

const CHORD_SPELLING_OPTIONS: Array<{ mode: ChordSpellingMode; title: string; hint: string; preview: string }> = [
  { mode: 'sharp', title: 'Sustenidos', hint: 'Prefere notas com #', preview: 'A A# B C C# D D# E F F# G G#' },
  { mode: 'flat', title: 'Bemóis', hint: 'Prefere notas com b', preview: 'A Bb B C Db D Eb E F Gb G Ab' },
  { mode: 'mixed', title: 'Misto / Popular', hint: 'Grafia comum para repertório popular', preview: 'A Bb B C C# D D# E F F# G G#' },
];

export function SettingsScreen({
  songs: songsProp,
  styles,
}: SettingsScreenProps) {
  const nav = useManualNavigation();
  const {
    displaySettings: settings,
    updateDisplaySettings: onChange,
    themeSettings,
    updateThemeSettings: onThemeChange,
  } = useSettings();
  const { globalFilters, updateGlobalFilters } = useGenreFilter();
  const confirmDestructiveAction = useConfirmDestructiveAction();
  const [songs, setSongs] = useState<Song[]>(songsProp);
  const [registeredGenres, setRegisteredGenres] = useState<Genre[]>([]);
  const [openGenreFilter, setOpenGenreFilter] = useState(false);
  const [openManageGenres, setOpenManageGenres] = useState(false);
  const [openCreateGenre, setOpenCreateGenre] = useState(false);
  const [openEditGenre, setOpenEditGenre] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [genreName, setGenreName] = useState('');
  const [openSettingsSection, setOpenSettingsSection] = useState<
    'genres' | 'appearance' | 'chords' | 'theme' | null
  >(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showColorPickerLyrics, setShowColorPickerLyrics] = useState(false);
  const [showColorPickerStaff, setShowColorPickerStaff] = useState(false);
  const [openHomeDashboardSettings, setOpenHomeDashboardSettings] = useState(false);
  const [showHomeDashboardOnStart, setShowHomeDashboardOnStart] = useState(false);
  const [homeDashboardUserName, setHomeDashboardUserName] = useState('');
  const [themeColorPicker, setThemeColorPicker] = useState<{ key: keyof ThemePalette; label: string } | null>(null);
  const [themeColorDraft, setThemeColorDraft] = useState('#000000');

  const loadGenres = async () => {
    setRegisteredGenres(await db.ensureDefaultGenres());
  };

  useEffect(() => {
    if (songsProp.length === 0) {
      db.getSongs().then(setSongs);
    } else {
      setSongs(songsProp);
    }
  }, [songsProp]);
  useEffect(() => { loadGenres(); }, []);
  useEffect(() => {
    db.getShowHomeDashboardOnStart().then(setShowHomeDashboardOnStart);
    db.getHomeDashboardUserName().then(setHomeDashboardUserName);
  }, []);

  const allGenres = React.useMemo(() => {
    const set = new Set<string>();
    registeredGenres.forEach((genre) => {
      const g = normalizeGenreName(genre.name);
      if (g) set.add(g);
    });
    songs.forEach((s) => {
      getSongGenreKeys(s).forEach((g) => set.add(g));
    });
    return Array.from(set)
      .filter((genre) => genre !== NO_GENRE_KEY)
      .sort((a, b) => getGenreDisplayName(a, registeredGenres).localeCompare(getGenreDisplayName(b, registeredGenres), 'pt-BR'));
  }, [registeredGenres, songs]);

  const genreCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    songs.forEach((s) => {
      getSongGenreKeys(s).forEach((g) => map.set(g, (map.get(g) || 0) + 1));
    });
    return map;
  }, [songs]);

  const handleOpenGenreFilter = () => {
    setOpenGenreFilter(true);
  };

  const handleCreateGenre = async () => {
    const created = await db.addGenre(genreName);
    if (!created) return;
    setGenreName('');
    setOpenCreateGenre(false);
    await loadGenres();
    setOpenManageGenres(true);
  };

  const handleOpenEditGenre = (genre: Genre) => {
    setSelectedGenre(genre);
    setGenreName(genre.name);
    setOpenManageGenres(false);
    setOpenEditGenre(true);
  };

  const handleUpdateGenre = async () => {
    if (!selectedGenre) return;
    await db.updateGenre(selectedGenre.id, genreName);
    setOpenEditGenre(false);
    setSelectedGenre(null);
    setGenreName('');
    await loadGenres();
    setSongs(await db.getSongs());
    setOpenManageGenres(true);
  };

  const handleDeleteGenre = async () => {
    if (!selectedGenre) return;
    setOpenEditGenre(false);
    const confirmed = await confirmDestructiveAction(
      `Tem certeza que deseja excluir o gênero "${selectedGenre.name}"? Ele será removido das músicas.`
    );
    if (!confirmed) {
      setSelectedGenre(null);
      setGenreName('');
      setOpenManageGenres(true);
      return;
    }
    await db.deleteGenre(selectedGenre.id);
    const deletedKey = normalizeGenreName(selectedGenre.name);
    updateGlobalFilters(globalFilters.selectedGenres.filter((genre) => genre !== deletedKey));
    setOpenEditGenre(false);
    setSelectedGenre(null);
    setGenreName('');
    await loadGenres();
    setSongs(await db.getSongs());
    setOpenManageGenres(true);
  };

  const handleFactoryReset = async () => {
    const firstConfirmed = await confirmDestructiveAction(
      'Tem certeza? Isso apagará músicas, listas, pastas, gêneros e configurações.',
      'Restaurar padrão de fábrica?',
      'Continuar'
    );
    if (!firstConfirmed) return;

    const secondConfirmed = await confirmDestructiveAction(
      'Você já fez backup? Esta ação não tem volta.',
      'Última confirmação',
      'Apagar todos os dados'
    );
    if (!secondConfirmed) return;

    await db.clearAllData();
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert('Todos os dados locais foram apagados. O app será recarregado.');
      window.location.reload();
    }
  };

  const handleToggleHomeDashboardOnStart = async () => {
    const next = !showHomeDashboardOnStart;
    setShowHomeDashboardOnStart(next);
    await db.saveShowHomeDashboardOnStart(next);
  };

  const handleChangeHomeDashboardUserName = (name: string) => {
    setHomeDashboardUserName(name);
    void db.saveHomeDashboardUserName(name);
  };

  const activeGenreCount = globalFilters.selectedGenres.length;
  const totalGenreCount = allGenres.length;
  const genreFilterSummary = activeGenreCount > 0
    ? `${activeGenreCount} de ${totalGenreCount} selecionados`
    : `Mostrando todos os ${totalGenreCount} gêneros`;
  const themeModeLabel =
    themeSettings.mode === 'light' ? 'Claro' : themeSettings.mode === 'custom' ? 'Personalizado' : 'Escuro';
  const chordSpellingMode = settings.chordSpellingMode ?? 'mixed';
  const chordSpellingLabel =
    CHORD_SPELLING_OPTIONS.find((option) => option.mode === chordSpellingMode)?.title ?? 'Misto / Popular';
  const updateCustomThemeColor = (key: keyof ThemePalette, value: string) => {
    const nextCustom = { ...themeSettings.custom, [key]: value };
    if (key === 'surface') {
      nextCustom.surfaceAlt = value;
      nextCustom.surfaceSoft = value;
    }
    if (key === 'borderSoft') {
      nextCustom.border = value;
    }
    if (key === 'accent') {
      nextCustom.accentSoft = value.length === 7 ? `${value}22` : themeSettings.custom.accentSoft;
    }
    onThemeChange({ mode: 'custom', custom: nextCustom });
  };

  const openThemeColorPicker = (item: { key: keyof ThemePalette; label: string }) => {
    setThemeColorPicker(item);
    setThemeColorDraft(normalizeHexColor(themeSettings.custom[item.key]));
  };

  const confirmThemeColorPicker = () => {
    if (!themeColorPicker) return;
    updateCustomThemeColor(themeColorPicker.key, normalizeHexColor(themeColorDraft));
    setThemeColorPicker(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.settingsContent}>
      <TouchableOpacity
        style={styles.settingsCategoryCard}
        onPress={() => setOpenHomeDashboardSettings(true)}
      >
        <View style={styles.settingsCategoryIcon}>
          <LayoutDashboard size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Tela inicial</Text>
          <Text style={styles.settingsCategorySubtitle}>
            {showHomeDashboardOnStart ? 'Mostra o dashboard ao abrir o app' : 'Dashboard de boas-vindas desativado'}
          </Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <AppModal
        visible={openHomeDashboardSettings}
        title="Tela inicial"
        onClose={() => setOpenHomeDashboardSettings(false)}
        icon={<LayoutDashboard size={16} color="var(--app-accent)" />}
        footer={(
          <>
            <TouchableOpacity
              style={styles.modalGhostBtn}
              onPress={() => setOpenHomeDashboardSettings(false)}
            >
              <Text style={styles.modalGhostText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setOpenHomeDashboardSettings(false);
                nav.navigate('HomeDashboard', { returnTo: { name: 'Settings' } });
              }}
            >
              <Text style={styles.modalPrimaryText}>Abrir tela inicial agora</Text>
            </TouchableOpacity>
          </>
        )}
      >
        <View style={{ gap: 12 }}>
          <TouchableOpacity style={styles.settingsControlRow} onPress={handleToggleHomeDashboardOnStart}>
            <View style={styles.settingsCategoryText}>
              <Text style={styles.settingsControlTitle}>Mostrar tela inicial ao abrir o app</Text>
              <Text style={styles.settingsControlHint}>Exibe o dashboard antes da lista de músicas.</Text>
            </View>
            <View style={[styles.statusPill, showHomeDashboardOnStart && styles.statusPillActive]}>
              <Text style={[styles.statusPillText, showHomeDashboardOnStart && styles.statusPillTextActive]}>
                {showHomeDashboardOnStart ? 'Ativado' : 'Desativado'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.settingsControlBlock}>
            <Text style={styles.settingsControlTitle}>Entre aqui com seu nome</Text>
            <Text style={styles.settingsControlHint}>Esse nome aparece na saudação da tela inicial.</Text>
            <TextInput
              style={styles.settingsInput}
              value={homeDashboardUserName}
              onChangeText={handleChangeHomeDashboardUserName}
              placeholder="Ex: Raphael"
              placeholderTextColor="#666"
            />
          </View>
        </View>
      </AppModal>

      <TouchableOpacity style={styles.settingsCategoryCard} onPress={() => setOpenSettingsSection('genres')}>
        <View style={styles.settingsCategoryIcon}>
          <Music size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Gêneros</Text>
          <Text style={styles.settingsCategorySubtitle}>
            {registeredGenres.length} cadastrados • {genreFilterSummary}
          </Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsCategoryCard} onPress={() => setOpenSettingsSection('appearance')}>
        <View style={styles.settingsCategoryIcon}>
          <ListMusic size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Aparência da cifra</Text>
          <Text style={styles.settingsCategorySubtitle}>
            Acordes, letra e pauta do editor
          </Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsCategoryCard} onPress={() => setOpenSettingsSection('chords')}>
        <View style={styles.settingsCategoryIcon}>
          <Music size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Acordes e transposição</Text>
          <Text style={styles.settingsCategorySubtitle}>
            Preferência de escrita: {chordSpellingLabel}
          </Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsCategoryCard} onPress={() => setOpenSettingsSection('theme')}>
        <View style={styles.settingsCategoryIcon}>
          <Palette size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Tema</Text>
          <Text style={styles.settingsCategorySubtitle}>
            {themeModeLabel} • escolha as cores do app
          </Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingsCategoryCard} onPress={() => nav.navigate('About')}>
        <View style={styles.settingsCategoryIcon}>
          <BookOpen size={20} color="#4FC3F7" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.settingsCategoryTitle}>Sobre / Guia do usuário</Text>
          <Text style={styles.settingsCategorySubtitle}>
            Manual rápido, recursos e dicas de uso do CifrasGo
          </Text>
        </View>
        <ChevronRight size={20} color="#4FC3F7" />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.settingsCategoryCard, styles.modalDangerBtn]} onPress={handleFactoryReset}>
        <View style={styles.settingsCategoryIcon}>
          <Trash2 size={20} color="#ff7a7a" />
        </View>
        <View style={styles.settingsCategoryText}>
          <Text style={styles.modalDangerText}>Restaurar padrão de fábrica</Text>
          <Text style={styles.settingsCategorySubtitle}>Apagar todos os dados locais deste app</Text>
        </View>
        <ChevronRight size={20} color="#ff7a7a" />
      </TouchableOpacity>

      <AppModal
        visible={openSettingsSection === 'genres'}
        title="Gêneros"
        onClose={() => setOpenSettingsSection(null)}
        icon={<Music size={16} color="var(--app-accent)" />}
        maxWidth={620}
      >
        <ScrollView style={styles.settingsModalScroll} contentContainerStyle={{ paddingBottom: 4 }}>
          <TouchableOpacity
            style={styles.settingsInlineAction}
            onPress={handleOpenGenreFilter}
          >
            <View>
              <Text style={styles.settingsControlTitle}>Filtrar gêneros</Text>
              <Text style={styles.settingsControlHint}>{genreFilterSummary}</Text>
            </View>
            <ChevronRight size={19} color="#4FC3F7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsInlineAction}
            onPress={() => {
              setOpenSettingsSection(null);
              setOpenManageGenres(true);
            }}
          >
            <View>
              <Text style={styles.settingsControlTitle}>Gerenciar gêneros</Text>
              <Text style={styles.settingsControlHint}>
                Cadastrar, editar ou excluir gêneros salvos
              </Text>
            </View>
            <ChevronRight size={19} color="#4FC3F7" />
          </TouchableOpacity>
        </ScrollView>
      </AppModal>

      <AppModal
        visible={openSettingsSection === 'appearance'}
        title="Aparência da cifra"
        onClose={() => setOpenSettingsSection(null)}
        icon={<ListMusic size={16} color="var(--app-accent)" />}
        maxWidth={620}
      >
        <ScrollView style={styles.settingsModalScroll} contentContainerStyle={{ paddingBottom: 4 }}>
          <View style={styles.settingsControlBlock}>
            <Text style={styles.settingsModalSubhead}>Acordes</Text>
            <Text style={styles.settingsControlTitle}>Cor do acorde</Text>
            <View style={styles.colorSwatchRow}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => onChange({ chordColor: color })}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    settings.chordColor === color && styles.colorSwatchActive,
                  ]}
                />
              ))}
              <TouchableOpacity
                onPress={() => setShowColorPicker(!showColorPicker)}
                style={[styles.colorSwatch, styles.customColorButton]}
              >
                <Text style={styles.customColorButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            {showColorPicker && (
              <View style={styles.colorPickerContainer}>
                <HexColorPicker
                  color={settings.chordColor}
                  onChange={(color) => onChange({ chordColor: color })}
                />
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.settingsControlRow}
            onPress={() => onChange({ chordBold: !settings.chordBold })}
          >
            <Text style={styles.settingsControlTitle}>Acorde em negrito</Text>
            <View style={[styles.statusPill, settings.chordBold && styles.statusPillActive]}>
              <Text style={[styles.statusPillText, settings.chordBold && styles.statusPillTextActive]}>
                {settings.chordBold ? 'Ativado' : 'Desativado'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.settingsControlBlock}>
            <Text style={styles.settingsModalSubhead}>Letra</Text>
            <Text style={styles.settingsControlTitle}>Cor da letra</Text>
            <View style={styles.colorSwatchRow}>
              {COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={`ly-${color}`}
                  onPress={() => onChange({ lyricsColor: color })}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    settings.lyricsColor === color && styles.colorSwatchActive,
                  ]}
                />
              ))}
              <TouchableOpacity
                onPress={() => setShowColorPickerLyrics(!showColorPickerLyrics)}
                style={[styles.colorSwatch, styles.customColorButton]}
              >
                <Text style={styles.customColorButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            {showColorPickerLyrics && (
              <View style={styles.colorPickerContainer}>
                <HexColorPicker
                  color={settings.lyricsColor}
                  onChange={(color) => onChange({ lyricsColor: color })}
                />
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.settingsControlRow}
            onPress={() => onChange({ lyricsBold: !settings.lyricsBold })}
          >
            <Text style={styles.settingsControlTitle}>Letra em negrito</Text>
            <View style={[styles.statusPill, settings.lyricsBold && styles.statusPillActive]}>
              <Text style={[styles.statusPillText, settings.lyricsBold && styles.statusPillTextActive]}>
                {settings.lyricsBold ? 'Ativado' : 'Desativado'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.settingsControlBlock}>
            <Text style={styles.settingsModalSubhead}>Editor</Text>
            <Text style={styles.settingsControlTitle}>Cor da pauta</Text>
            <View style={styles.colorSwatchRow}>
              {STAFF_LINE_COLOR_OPTIONS.map((color) => (
                <TouchableOpacity
                  key={`staff-${color}`}
                  onPress={() => onChange({ staffLineColor: color })}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    settings.staffLineColor === color && styles.colorSwatchActive,
                  ]}
                />
              ))}
              <TouchableOpacity
                onPress={() => setShowColorPickerStaff(!showColorPickerStaff)}
                style={[styles.colorSwatch, styles.customColorButton]}
              >
                <Text style={styles.customColorButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            {showColorPickerStaff && (
              <View style={styles.colorPickerContainer}>
                <HexColorPicker
                  color={settings.staffLineColor}
                  onChange={(color) => onChange({ staffLineColor: color })}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </AppModal>

      <AppModal
        visible={openManageGenres}
        title="Gerenciar gêneros"
        onClose={() => setOpenManageGenres(false)}
        icon={<Pencil size={16} color="var(--app-accent)" />}
        maxWidth={620}
      >
        <ScrollView style={styles.settingsModalScroll} contentContainerStyle={{ paddingBottom: 4 }}>
          <TouchableOpacity
            style={styles.settingsInlineAction}
            onPress={() => {
              setGenreName('');
              setOpenManageGenres(false);
              setOpenCreateGenre(true);
            }}
          >
            <View>
              <Text style={styles.settingsControlTitle}>Cadastrar gênero</Text>
              <Text style={styles.settingsControlHint}>{registeredGenres.length} cadastrados</Text>
            </View>
            <Plus size={19} color="#4FC3F7" />
          </TouchableOpacity>

          <Text style={styles.settingsModalSubhead}>Gêneros cadastrados</Text>
          {registeredGenres.length ? (
            <View style={styles.registeredGenreGrid}>
              {registeredGenres.map((genre) => {
                const count = genreCountMap.get(normalizeGenreName(genre.name)) || 0;
                return (
                  <TouchableOpacity
                    key={genre.id}
                    style={styles.registeredGenreChip}
                    onPress={() => handleOpenEditGenre(genre)}
                  >
                    <View style={styles.registeredGenreChipText}>
                      <Text style={styles.registeredGenreName} numberOfLines={1}>{genre.name}</Text>
                      <Text style={styles.registeredGenreCount}>
                        {count} {count === 1 ? 'música' : 'músicas'}
                      </Text>
                    </View>
                    <Pencil size={13} color="#4FC3F7" />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.settingsEmptyText}>Nenhum gênero cadastrado.</Text>
          )}

          <View style={styles.settingsControlBlock}>
            <Text style={styles.settingsControlTitle}>Sem gênero</Text>
            <Text style={styles.settingsControlHint}>
              Opção fixa do filtro global. Não pode ser excluída.
            </Text>
          </View>
        </ScrollView>
      </AppModal>

      <AppModal
        visible={openSettingsSection === 'chords'}
        title="Acordes e transposição"
        onClose={() => setOpenSettingsSection(null)}
        icon={<Music size={16} color="var(--app-accent)" />}
        maxWidth={620}
        footer={(
          <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setOpenSettingsSection(null)}>
            <Text style={styles.modalGhostText}>Fechar</Text>
          </TouchableOpacity>
        )}
      >
        <ScrollView style={styles.settingsModalScroll} contentContainerStyle={{ paddingBottom: 4 }}>
          <View style={styles.settingsControlBlock}>
            <Text style={styles.settingsModalSubhead}>Preferência de escrita dos acordes</Text>
            <Text style={styles.settingsControlHint}>
              Escolha como a transposição deve escrever notas enarmônicas.
            </Text>
            <View style={styles.themeModeGrid}>
              {CHORD_SPELLING_OPTIONS.map((option) => {
                const isActive = chordSpellingMode === option.mode;
                return (
                  <TouchableOpacity
                    key={option.mode}
                    style={[styles.themeModeCard, isActive && styles.themeModeCardActive]}
                    onPress={() => onChange({ chordSpellingMode: option.mode })}
                  >
                    <Text style={[styles.themeModeTitle, isActive && styles.themeModeTitleActive]}>{option.title}</Text>
                    <Text style={styles.themeModeHint}>{option.hint}</Text>
                    <Text style={[styles.settingsControlHint, { marginTop: 8, fontWeight: '800' }]}>
                      {option.preview}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </AppModal>

      <AppModal
        visible={openSettingsSection === 'theme'}
        title="Tema"
        onClose={() => setOpenSettingsSection(null)}
        icon={<Palette size={16} color="var(--app-accent)" />}
        maxWidth={620}
        footer={(
          <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setOpenSettingsSection(null)}>
            <Text style={styles.modalGhostText}>Fechar</Text>
          </TouchableOpacity>
        )}
      >
        <ScrollView style={styles.settingsModalScroll} contentContainerStyle={{ paddingBottom: 4 }}>
          {openSettingsSection === 'theme' ? (
            <>
              <View style={styles.themeModeGrid}>
                {[
                  { mode: 'dark' as const, title: 'Escuro', hint: 'Tema atual' },
                  { mode: 'light' as const, title: 'Claro', hint: 'Fundo claro' },
                  { mode: 'custom' as const, title: 'Personalizado', hint: 'Suas cores' },
                ].map((option) => {
                  const isActive = themeSettings.mode === option.mode;
                  return (
                    <TouchableOpacity
                      key={option.mode}
                      style={[styles.themeModeCard, isActive && styles.themeModeCardActive]}
                      onPress={() => onThemeChange({ mode: option.mode })}
                    >
                      <View style={[styles.themeModeDot, option.mode === 'light' && styles.themeModeDotLight, option.mode === 'custom' && styles.themeModeDotCustom]} />
                      <Text style={[styles.themeModeTitle, isActive && styles.themeModeTitleActive]}>{option.title}</Text>
                      <Text style={styles.themeModeHint}>{option.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {themeSettings.mode === 'custom' ? (
                <View style={styles.settingsControlBlock}>
                  <Text style={styles.settingsControlTitle}>Cores personalizadas</Text>
                  <Text style={styles.settingsControlHint}>
                    Ao alterar uma cor, o tema personalizado será aplicado.
                  </Text>
                  <View style={styles.themeCustomGrid}>
                    {THEME_COLOR_INPUTS.map((item) => (
                      <View key={item.key} style={styles.themeColorRow}>
                        <View>
                          <Text style={styles.themeColorLabel}>{item.label}</Text>
                          <Text style={styles.themeColorValue}>{themeSettings.custom[item.key]}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.themeColorButton}
                          onPress={() => openThemeColorPicker(item)}
                        >
                          <View
                            style={[
                              styles.themeColorPreview,
                              { backgroundColor: normalizeHexColor(themeSettings.custom[item.key]) },
                            ]}
                          />
                          <Text style={styles.themeColorEditText}>Editar</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={openCreateGenre}
        title="Novo gênero"
        onClose={() => setOpenCreateGenre(false)}
        icon={<Plus size={16} color="var(--app-accent)" />}
        maxWidth={460}
        footer={(
          <>
            <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setOpenCreateGenre(false)}>
              <Text style={styles.modalGhostText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleCreateGenre}>
              <Text style={styles.modalPrimaryText}>Criar</Text>
            </TouchableOpacity>
          </>
        )}
      >
        <Text style={styles.settingsControlHint}>Cadastre um gênero para organizar melhor seu repertório.</Text>
        <TextInput
          style={styles.settingsInput}
          value={genreName}
          onChangeText={setGenreName}
          placeholder="Ex: Católica"
          placeholderTextColor="#666"
          autoFocus
        />
      </AppModal>

      <AppModal
        visible={!!themeColorPicker}
        title={themeColorPicker ? `Cor: ${themeColorPicker.label}` : 'Cor do tema'}
        onClose={() => setThemeColorPicker(null)}
        icon={<Palette size={16} color="var(--app-accent)" />}
        maxWidth={500}
        footer={(
          <>
            <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setThemeColorPicker(null)}>
              <Text style={styles.modalGhostText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={confirmThemeColorPicker}>
              <Text style={styles.modalPrimaryText}>Definir</Text>
            </TouchableOpacity>
          </>
        )}
      >
        <View style={styles.themePickerBody}>
          <HexColorPicker
            color={themeColorDraft}
            onChange={(color) => setThemeColorDraft(normalizeHexColor(color))}
          />
          <View style={styles.themePickerPreview}>
            <View
              style={[
                styles.themePickerColorBox,
                { backgroundColor: normalizeHexColor(themeColorDraft) },
              ]}
            />
            <View style={styles.themePickerCodes}>
              <Text style={styles.settingsControlTitle}>Cor escolhida</Text>
              <Text style={styles.themePickerCodeLine}>
                <Text style={styles.themePickerCodeLabel}>HEX: </Text>
                <Text style={styles.themePickerCodeValue}>{normalizeHexColor(themeColorDraft).toUpperCase()}</Text>
              </Text>
              <Text style={styles.themePickerCodeLine}>
                <Text style={styles.themePickerCodeLabel}>RGB: </Text>
                <Text style={styles.themePickerCodeValue}>{hexToRgbText(themeColorDraft)}</Text>
              </Text>
            </View>
          </View>
        </View>
      </AppModal>

      <AppModal
        visible={openEditGenre}
        title="Editar gênero"
        onClose={() => {
          setOpenEditGenre(false);
          setOpenManageGenres(true);
        }}
        icon={<Pencil size={16} color="var(--app-accent)" />}
        maxWidth={460}
        footer={(
          <>
            <TouchableOpacity
              style={styles.modalGhostBtn}
              onPress={() => {
                setOpenEditGenre(false);
                setOpenManageGenres(true);
              }}
            >
              <Text style={styles.modalGhostText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleUpdateGenre}>
              <Text style={styles.modalPrimaryText}>Salvar</Text>
            </TouchableOpacity>
          </>
        )}
      >
        <TextInput
          style={styles.settingsInput}
          value={genreName}
          onChangeText={setGenreName}
          placeholder="Nome do gênero"
          placeholderTextColor="#666"
          autoFocus
        />
        <TouchableOpacity style={[styles.modalActionBtn, styles.modalDangerBtn]} onPress={handleDeleteGenre}>
          <Text style={styles.modalDangerText}>Excluir gênero</Text>
        </TouchableOpacity>
      </AppModal>

      <GenreFilterModal
        visible={openGenreFilter}
        onClose={() => setOpenGenreFilter(false)}
      />
    </ScrollView>
  );
}
