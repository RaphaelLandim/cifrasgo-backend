import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { BookOpen, ChevronRight, FileText, LayoutDashboard, ListChecks, ListMusic, Music, Palette, Pencil, Plus, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { AppModal } from '../components/AppModal';
import { useConfirmDestructiveAction } from '../components/ConfirmDialog';
import { GenreFilterModal } from '../components/GenreFilterModal';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useSettings } from '../contexts/SettingsContext';
import {
  deleteQuickPdfFilesystemFile,
  isNativeFilesystemQuickPdfAvailable,
  MAX_QUICK_PDF_FILESYSTEM_FILE_BYTES,
  saveQuickPdfFileToFilesystem,
} from '../services/quickPdfFiles';
import { db } from '../services/storage';
import {
  COLOR_OPTIONS,
  STAFF_LINE_COLOR_OPTIONS,
  THEME_COLOR_INPUTS,
} from '../theme/theme';
import type { ChordFontFamily, ChordSpellingMode, FavoriteMode, FolderPlaylistDisplayMode, Genre, HomeShortcutDisplayMode, QuickPdfId, QuickPdfLink, Song, ThemePalette } from '../types/models';
import {
  NO_GENRE_KEY,
  getGenreDisplayName,
  getSongGenreKeys,
  normalizeGenreName,
} from '../utils/genres';
import {
  estimateQuickPdfDataUrlSize,
  formatQuickPdfFilesystemFileLimit,
  formatQuickPdfFileLimit,
  getQuickPdfFilesystemTooLargeMessage,
  getQuickPdfTooLargeMessage,
  hasQuickPdfSource,
  isLocalPdfPath,
  isPdfFileLike,
  isQuickPdfDataUrlTooLarge,
  MAX_QUICK_PDF_DATA_URL_CHARS,
  MAX_QUICK_PDF_FILE_BYTES,
} from '../utils/quickPdfs';

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

const CHORD_FONT_OPTIONS: Array<{ value: ChordFontFamily; title: string; hint: string; preview: string }> = [
  { value: 'default', title: 'Padrão do app', hint: 'Mantém a fonte atual aprovada.', preview: 'Am  C  G  D' },
  { value: 'system', title: 'Monospace do sistema', hint: 'Usa a fonte monoespaçada do aparelho/navegador.', preview: 'Am  C  G  D' },
  { value: 'courier', title: 'Courier', hint: 'Fonte clássica de cifra e texto monoespaçado.', preview: 'Am  C  G  D' },
  { value: 'robotoMono', title: 'Roboto Mono', hint: 'Boa opção para testar em Android/WebView.', preview: 'Am  C  G  D' },
  { value: 'droidSansMono', title: 'Droid Sans Mono', hint: 'Fallback comum em aparelhos Android antigos.', preview: 'Am  C  G  D' },
];

const FAVORITE_MODE_OPTIONS: Array<{ mode: FavoriteMode; title: string; hint: string }> = [
  { mode: 'disabled', title: 'Não marcar listas/pastas', hint: 'Tudo fica em ordem alfabética normal.' },
  { mode: 'single', title: 'Marcar apenas uma', hint: 'Uma pasta e uma lista podem ficar em destaque.' },
  { mode: 'multiple', title: 'Marcar várias', hint: 'Várias pastas e listas marcadas aparecem primeiro.' },
];

const FOLDER_PLAYLIST_DISPLAY_OPTIONS: Array<{ mode: FolderPlaylistDisplayMode; title: string; hint: string }> = [
  { mode: 'folders_first', title: 'Pastas primeiro', hint: 'Pastas marcadas A-Z, pastas normais A-Z, listas marcadas A-Z e listas normais A-Z.' },
  { mode: 'playlists_first', title: 'Listas primeiro', hint: 'Listas marcadas A-Z, listas normais A-Z, pastas marcadas A-Z e pastas normais A-Z.' },
  { mode: 'mixed', title: 'Misturado por nome', hint: 'Itens marcados primeiro A-Z; depois pastas e listas juntas em ordem alfabética.' },
];

const HOME_SHORTCUT_MODE_OPTIONS: Array<{ mode: HomeShortcutDisplayMode; title: string; hint: string }> = [
  { mode: 'recent', title: 'Último acessado', hint: 'Mostra a última lista aberta.' },
  { mode: 'favorites', title: 'Favoritos', hint: 'Mostra seus itens favoritos.' },
  { mode: 'all', title: 'Todos', hint: 'Mostra favoritos e o último acesso.' },
  { mode: 'none', title: 'Nenhum', hint: 'Oculta os atalhos desta área.' },
];

const QUICK_PDF_LABELS: Record<QuickPdfId, string> = {
  pdf1: 'PDF1',
  pdf2: 'PDF2',
  pdf3: 'PDF3',
};
const DEFAULT_QUICK_PDFS: QuickPdfLink[] = [
  { id: 'pdf1' },
  { id: 'pdf2' },
  { id: 'pdf3' },
];
type AppearanceColorId = 'chord' | 'lyrics' | 'staff';
type FolderPdfSettingsSection = 'favorites' | 'display' | 'pdfs';

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
    favoriteMode,
    updateFavoriteMode,
    folderPlaylistDisplayMode,
    updateFolderPlaylistDisplayMode,
    homeShortcutSettings,
    updateHomeShortcutSettings,
  } = useSettings();
  const isLightTheme = themeSettings.mode === 'light';
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
    'genres' | 'appearance' | 'chords' | 'theme' | 'favorites' | null
  >(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showColorPickerLyrics, setShowColorPickerLyrics] = useState(false);
  const [showColorPickerStaff, setShowColorPickerStaff] = useState(false);
  const [expandedAppearanceColor, setExpandedAppearanceColor] = useState<AppearanceColorId | null>(null);
  const [expandedChordFont, setExpandedChordFont] = useState(false);
  const [expandedChordSpelling, setExpandedChordSpelling] = useState(false);
  const [expandedFolderPdfSection, setExpandedFolderPdfSection] = useState<FolderPdfSettingsSection | null>(null);
  const [openHomeDashboardSettings, setOpenHomeDashboardSettings] = useState(false);
  const [showHomeDashboardOnStart, setShowHomeDashboardOnStart] = useState(false);
  const [homeDashboardUserName, setHomeDashboardUserName] = useState('');
  const [quickPdfs, setQuickPdfs] = useState<QuickPdfLink[]>(DEFAULT_QUICK_PDFS);
  const [expandedQuickPdfId, setExpandedQuickPdfId] = useState<QuickPdfId | null>(null);
  const quickPdfFileInputsRef = React.useRef<Record<QuickPdfId, HTMLInputElement | null>>({
    pdf1: null,
    pdf2: null,
    pdf3: null,
  });
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
    db.getQuickPdfs().then(setQuickPdfs);
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

  const saveQuickPdfs = (next: QuickPdfLink[]) => {
    const previous = quickPdfs;
    setQuickPdfs(next);
    return db.saveQuickPdfs(next)
      .then(() => true)
      .catch(() => {
        setQuickPdfs(previous);
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert('Não foi possível salvar este PDF no app. Tente um arquivo menor ou use um link público.');
        }
        return false;
      });
  };

  const updateQuickPdf = (id: QuickPdfId, updates: Partial<QuickPdfLink>) => {
    const next = quickPdfs.map((pdf) =>
      pdf.id === id
        ? {
            ...pdf,
            ...updates,
            name: updates.name !== undefined ? updates.name : pdf.name,
            url: updates.url !== undefined ? updates.url : pdf.url,
            updatedAt: Date.now(),
          }
        : pdf
    );
    saveQuickPdfs(next);
  };

  const updateQuickPdfUrl = (id: QuickPdfId, value: string) => {
    const cleanUrl = value.trim();
    const previousPdf = quickPdfs.find((pdf) => pdf.id === id);
    const next = quickPdfs.map((pdf) => {
      if (pdf.id !== id) return pdf;
      return {
        id,
        name: pdf.name,
        ...(cleanUrl ? { sourceType: 'url' as const, url: value } : {}),
        updatedAt: Date.now(),
      };
    });
    void saveQuickPdfs(next).then((saved) => {
      if (saved) {
        void db.clearQuickPdfPageState(id);
        void deleteQuickPdfFilesystemFile(previousPdf?.fileStorage);
      }
    });
  };

  const chooseQuickPdfFile = (id: QuickPdfId) => {
    quickPdfFileInputsRef.current[id]?.click();
  };

  const handleQuickPdfFileSelected = (id: QuickPdfId, file?: File | null) => {
    if (!file) return;

    if (!isPdfFileLike(file)) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Escolha um arquivo PDF válido.');
      }
      return;
    }

    if (isNativeFilesystemQuickPdfAvailable()) {
      if (file.size > MAX_QUICK_PDF_FILESYSTEM_FILE_BYTES) {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(getQuickPdfFilesystemTooLargeMessage());
        }
        return;
      }

      const previousPdf = quickPdfs.find((pdf) => pdf.id === id);
      void saveQuickPdfFileToFilesystem(id, file)
        .then((fileStorage) => {
          const next = quickPdfs.map((pdf) =>
            pdf.id === id
              ? {
                  id,
                  name: pdf.name,
                  sourceType: 'file' as const,
                  fileName: file.name,
                  fileStorage,
                  fileSize: file.size,
                  fileMimeType: file.type || 'application/pdf',
                  updatedAt: Date.now(),
                }
              : pdf
          );
          void saveQuickPdfs(next).then((saved) => {
            if (!saved) {
              void deleteQuickPdfFilesystemFile(fileStorage);
              return;
            }
            void db.clearQuickPdfPageState(id);
            if (previousPdf?.fileStorage && previousPdf.fileStorage.path !== fileStorage.path) {
              void deleteQuickPdfFilesystemFile(previousPdf.fileStorage);
            }
          });
        })
        .catch(() => {
          if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert('Não foi possível salvar este PDF no app. Tente um arquivo menor ou use um link público.');
          }
        });
      return;
    }

    if (file.size > MAX_QUICK_PDF_FILE_BYTES) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(getQuickPdfTooLargeMessage());
      }
      return;
    }

    if (estimateQuickPdfDataUrlSize(file.size, file.type || 'application/pdf') > MAX_QUICK_PDF_DATA_URL_CHARS) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(getQuickPdfTooLargeMessage());
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = typeof reader.result === 'string' ? reader.result : '';
      if (!fileData) return;
      if (isQuickPdfDataUrlTooLarge(fileData)) {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(getQuickPdfTooLargeMessage());
        }
        return;
      }
      const next = quickPdfs.map((pdf) =>
        pdf.id === id
          ? {
              id,
              name: pdf.name,
              sourceType: 'file' as const,
              fileName: file.name,
              fileData,
              fileSize: file.size,
              fileMimeType: file.type || 'application/pdf',
              updatedAt: Date.now(),
            }
          : pdf
      );
      void saveQuickPdfs(next).then((saved) => {
        if (saved) void db.clearQuickPdfPageState(id);
      });
    };
    reader.onerror = () => {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert('Não foi possível ler este PDF. Tente novamente ou use um link público.');
      }
    };
    reader.readAsDataURL(file);
  };

  const clearQuickPdf = (id: QuickPdfId) => {
    const previousPdf = quickPdfs.find((pdf) => pdf.id === id);
    const next = quickPdfs.map((pdf) => (pdf.id === id ? { id, updatedAt: Date.now() } : pdf));
    void saveQuickPdfs(next).then((saved) => {
      if (saved) {
        void db.clearQuickPdfPageState(id);
        void deleteQuickPdfFilesystemFile(previousPdf?.fileStorage);
      }
    });
  };

  const activeGenreCount = globalFilters.selectedGenres.length;
  const totalGenreCount = allGenres.length;
  const genreFilterSummary = activeGenreCount > 0
    ? `${activeGenreCount} de ${totalGenreCount} selecionados`
    : `Mostrando todos os ${totalGenreCount} gêneros`;
  const themeModeLabel =
    themeSettings.mode === 'light' ? 'Claro' : themeSettings.mode === 'custom' ? 'Personalizado' : 'Escuro';
  const favoriteModeLabel =
    FAVORITE_MODE_OPTIONS.find((option) => option.mode === favoriteMode)?.title ?? 'Não marcar listas/pastas';
  const folderPlaylistDisplayModeLabel =
    FOLDER_PLAYLIST_DISPLAY_OPTIONS.find((option) => option.mode === folderPlaylistDisplayMode)?.title ?? 'Pastas primeiro';
  const chordSpellingMode = settings.chordSpellingMode ?? 'mixed';
  const chordSpellingLabel =
    CHORD_SPELLING_OPTIONS.find((option) => option.mode === chordSpellingMode)?.title ?? 'Misto / Popular';
  const chordFontFamily = settings.chordFontFamily ?? 'default';
  const chordFontLabel =
    CHORD_FONT_OPTIONS.find((option) => option.value === chordFontFamily)?.title ?? 'Padrão do app';
  const configuredQuickPdfCount = quickPdfs.filter(hasQuickPdfSource).length;
  const quickPdfFileLimitLabel = isNativeFilesystemQuickPdfAvailable()
    ? formatQuickPdfFilesystemFileLimit()
    : formatQuickPdfFileLimit();
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

  const formatAppearanceColor = (color: string) => {
    const value = (color || '').trim();
    return value.startsWith('#') ? value.toUpperCase() : value || 'Padrao';
  };

  const toggleAppearanceColor = (id: AppearanceColorId) => {
    setExpandedAppearanceColor((current) => (current === id ? null : id));
  };

  const closeCustomPickerForAppearanceColor = (id: AppearanceColorId) => {
    if (id === 'chord') setShowColorPicker(false);
    if (id === 'lyrics') setShowColorPickerLyrics(false);
    if (id === 'staff') setShowColorPickerStaff(false);
  };

  const renderAppearanceColorControl = ({
    id,
    section,
    title,
    value,
    options,
    customOpen,
    bold,
    onToggleBold,
    onToggleCustom,
    onSelect,
    onCustomChange,
  }: {
    id: AppearanceColorId;
    section: string;
    title: string;
    value: string;
    options: readonly string[];
    customOpen: boolean;
    bold?: boolean;
    onToggleBold?: () => void;
    onToggleCustom: () => void;
    onSelect: (color: string) => void;
    onCustomChange: (color: string) => void;
  }) => {
    const expanded = expandedAppearanceColor === id;

    return (
      <View style={styles.settingsControlBlock}>
        <Text style={styles.settingsModalSubhead}>{section}</Text>
        <TouchableOpacity
          onPress={() => toggleAppearanceColor(id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.settingsControlTitle}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  backgroundColor: value,
                  borderWidth: 1,
                  borderColor: 'var(--app-border)',
                }}
              />
              <Text style={styles.settingsControlHint} numberOfLines={1}>
                {formatAppearanceColor(value)}
                {bold !== undefined ? ` • Negrito ${bold ? 'ativado' : 'desativado'}` : ''}
              </Text>
            </View>
          </View>
          <Text style={styles.modalGhostText}>Alterar</Text>
        </TouchableOpacity>

        {expanded && (
          <View style={{ marginTop: 12, gap: 10 }}>
            {onToggleBold && bold !== undefined && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingVertical: 2,
                }}
                onPress={onToggleBold}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.settingsControlTitle}>Negrito</Text>
                  <Text style={styles.settingsControlHint}>
                    {bold ? 'Texto destacado na cifra' : 'Texto com peso normal'}
                  </Text>
                </View>
                <View style={[styles.statusPill, bold && styles.statusPillActive]}>
                  <Text style={[styles.statusPillText, bold && styles.statusPillTextActive]}>
                    {bold ? 'Ativado' : 'Desativado'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            <View style={styles.colorSwatchRow}>
              {options.map((color) => (
                <TouchableOpacity
                  key={`${id}-${color}`}
                  onPress={() => {
                    onSelect(color);
                    closeCustomPickerForAppearanceColor(id);
                    setExpandedAppearanceColor(null);
                  }}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    value === color && styles.colorSwatchActive,
                  ]}
                />
              ))}
              <TouchableOpacity
                onPress={onToggleCustom}
                style={[styles.colorSwatch, styles.customColorButton]}
              >
                <Text style={styles.customColorButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            {customOpen && (
              <View style={styles.colorPickerContainer}>
                <HexColorPicker
                  color={value}
                  onChange={onCustomChange}
                />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderCompactSettingsSection = ({
    title,
    summary,
    expanded,
    onPress,
    children,
  }: {
    title: string;
    summary: string;
    expanded: boolean;
    onPress: () => void;
    children: React.ReactNode;
  }) => (
    <View style={styles.settingsControlBlock}>
      <TouchableOpacity
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.settingsControlTitle}>{title}</Text>
          <Text style={styles.settingsControlHint} numberOfLines={2}>{summary}</Text>
        </View>
        <ChevronRight
          size={18}
          color="var(--app-accent)"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </TouchableOpacity>
      {expanded ? (
        <View style={{ marginTop: 12 }}>
          {children}
        </View>
      ) : null}
    </View>
  );

  const renderSettingsCard = ({
    title,
    subtitle,
    icon,
    tone,
    onPress,
    danger,
  }: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    tone: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.86}
      style={[
        localStyles.settingsCard,
        isLightTheme && localStyles.settingsCardLight,
        danger && localStyles.settingsDangerCard,
        danger && isLightTheme && localStyles.settingsDangerCardLight,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          localStyles.settingsIconBox,
          {
            backgroundColor: `${tone}16`,
            borderColor: `${tone}42`,
            boxShadow: `0 10px 20px ${tone}18`,
          },
        ]}
      >
        {icon}
      </View>
      <View style={localStyles.settingsCardText}>
        <Text style={[localStyles.settingsCardTitle, danger && localStyles.settingsDangerTitle]}>{title}</Text>
        <Text style={localStyles.settingsCardSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <ChevronRight size={20} color={danger ? '#ff6b6b' : 'var(--app-muted-text)'} />
    </TouchableOpacity>
  );

  const renderSettingsGroup = ({
    label,
    icon,
    tone,
    children,
  }: {
    label: string;
    icon: React.ReactNode;
    tone: string;
    children: React.ReactNode;
  }) => (
    <View style={localStyles.settingsGroup}>
      <View style={localStyles.settingsGroupHeader}>
        {icon}
        <Text style={[localStyles.settingsGroupTitle, { color: tone }]}>{label}</Text>
      </View>
      <View style={[localStyles.settingsGroupCards, isLightTheme && localStyles.settingsGroupCardsLight]}>
        {children}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={localStyles.settingsContent}>
      {renderSettingsGroup({
        label: 'PERSONALIZAÇÃO',
        tone: '#38bdf8',
        icon: <Palette size={13} color="#38bdf8" />,
        children: (
          <>
            {renderSettingsCard({
              title: 'Tela inicial',
              subtitle: showHomeDashboardOnStart ? 'Mostra o dashboard ao abrir o app' : 'Dashboard de boas-vindas desativado',
              icon: <LayoutDashboard size={20} color="#38bdf8" />,
              tone: '#38bdf8',
              onPress: () => setOpenHomeDashboardSettings(true),
            })}
            {renderSettingsCard({
              title: 'Gêneros',
              subtitle: `${registeredGenres.length} cadastrados • ${genreFilterSummary}`,
              icon: <Music size={20} color="#a855f7" />,
              tone: '#a855f7',
              onPress: () => setOpenSettingsSection('genres'),
            })}
            {renderSettingsCard({
              title: 'Aparência da cifra',
              subtitle: 'Acordes, letra e pauta do editor',
              icon: <ListMusic size={20} color="#22c55e" />,
              tone: '#22c55e',
              onPress: () => setOpenSettingsSection('appearance'),
            })}
            {renderSettingsCard({
              title: 'Acordes e transposição',
              subtitle: `Preferência de escrita: ${chordSpellingLabel}`,
              icon: <Music size={20} color="#f59e0b" />,
              tone: '#f59e0b',
              onPress: () => setOpenSettingsSection('chords'),
            })}
            {renderSettingsCard({
              title: 'Tema',
              subtitle: `${themeModeLabel} • escolha as cores do app`,
              icon: <Palette size={20} color="#06b6d4" />,
              tone: '#06b6d4',
              onPress: () => setOpenSettingsSection('theme'),
            })}
          </>
        ),
      })}

      {renderSettingsGroup({
        label: 'ORGANIZAÇÃO',
        tone: '#38bdf8',
        icon: <Star size={13} color="#38bdf8" />,
        children: renderSettingsCard({
          title: 'Ajustes de pastas/listas e PDF',
          subtitle: 'Pastas, listas, favoritos e PDFs rápidos',
          icon: <Star size={20} color="#facc15" />,
          tone: '#facc15',
          onPress: () => setOpenSettingsSection('favorites'),
        }),
      })}

      {renderSettingsGroup({
        label: 'SUPORTE',
        tone: '#38bdf8',
        icon: <BookOpen size={13} color="#38bdf8" />,
        children: renderSettingsCard({
          title: 'Sobre / Guia do usuário',
          subtitle: 'Manual rápido, recursos e dicas de uso do CifrasGo',
          icon: <BookOpen size={20} color="#38bdf8" />,
          tone: '#38bdf8',
          onPress: () => nav.navigate('About'),
        }),
      })}

      {renderSettingsGroup({
        label: 'AVANÇADO',
        tone: '#ef4444',
        icon: <Trash2 size={13} color="#ef4444" />,
        children: renderSettingsCard({
          title: 'Restaurar padrão de fábrica',
          subtitle: 'Apagar todos os dados locais deste app',
          icon: <Trash2 size={20} color="#ff6b6b" />,
          tone: '#ef4444',
          onPress: handleFactoryReset,
          danger: true,
        }),
      })}

      <View style={[localStyles.protectedCard, isLightTheme && localStyles.protectedCardLight]}>
        <View style={[localStyles.settingsIconBox, localStyles.protectedIconBox]}>
          <ShieldCheck size={20} color="#38bdf8" />
        </View>
        <View style={localStyles.settingsCardText}>
          <Text style={localStyles.settingsCardTitle}>Seus dados estão protegidos</Text>
          <Text style={localStyles.settingsCardSubtitle}>
            Músicas, listas e configurações ficam apenas no seu dispositivo.
          </Text>
        </View>
      </View>

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

          <View style={styles.settingsControlBlock}>
            <Text style={styles.settingsControlTitle}>Atalhos da tela inicial</Text>
            <Text style={styles.settingsControlHint}>Escolha quais acessos rápidos aparecem no menu.</Text>
            <View style={[styles.themeModeGrid, { marginTop: 12 }]}>
              {HOME_SHORTCUT_MODE_OPTIONS.map((option) => {
                const isActive = homeShortcutSettings.mode === option.mode;
                return (
                  <TouchableOpacity
                    key={option.mode}
                    style={[styles.themeModeCard, isActive && styles.themeModeCardActive]}
                    onPress={() => updateHomeShortcutSettings({ mode: option.mode })}
                  >
                    <Star
                      size={18}
                      color={isActive ? '#ffd166' : 'var(--app-muted-text)'}
                      fill={isActive && option.mode === 'favorites' ? '#ffd166' : 'transparent'}
                    />
                    <Text style={[styles.themeModeTitle, isActive && styles.themeModeTitleActive]}>{option.title}</Text>
                    <Text style={styles.themeModeHint}>{option.hint}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </AppModal>

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
              <View style={styles.createOptionLeft}>
              <ListChecks size={18} color="#4FC3F7" />
              <Text style={styles.settingsControlTitle}>Filtrar gêneros</Text>
              <Text style={styles.settingsControlHint}>{genreFilterSummary}</Text>
            </View>
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
              <View style={styles.createOptionLeft}>
              <ListChecks size={18} color="#4FC3F7" />
              <Text style={styles.settingsControlTitle}>Gerenciar gêneros</Text>
              <Text style={styles.settingsControlHint}>
                Cadastrar, editar ou excluir gêneros salvos
              </Text>
            </View>
            </View>
            <ChevronRight size={19} color="#4FC3F7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsInlineAction}
            onPress={() => {
              setOpenSettingsSection(null);
              nav.navigate('BulkGenreOrganizer');
            }}
          >
            <View style={styles.createOptionLeft}>
              <ListChecks size={18} color="#4FC3F7" />
              <View>
                <Text style={styles.settingsControlTitle}>Organizar músicas por gênero</Text>
                <Text style={styles.settingsControlHint}>
                  Classifique várias músicas de uma vez
                </Text>
              </View>
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
          {renderCompactSettingsSection({
            title: 'Fonte da cifra',
            summary: `${chordFontLabel} • escolha a fonte usada na visualização da cifra`,
            expanded: expandedChordFont,
            onPress: () => setExpandedChordFont((current) => !current),
            children: (
              <>
                <Text style={styles.settingsControlHint}>
                  Escolha a fonte usada na visualização da cifra. O editor não muda nesta etapa.
                </Text>
                <View style={[styles.themeModeGrid, { marginTop: 12 }]}>
                  {CHORD_FONT_OPTIONS.map((option) => {
                    const isActive = chordFontFamily === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.themeModeCard, isActive && styles.themeModeCardActive]}
                        onPress={() => {
                          onChange({ chordFontFamily: option.value });
                          setExpandedChordFont(false);
                        }}
                      >
                        <Text style={[styles.themeModeTitle, isActive && styles.themeModeTitleActive]}>{option.title}</Text>
                        <Text style={styles.themeModeHint}>{option.hint}</Text>
                        <Text
                          style={[
                            styles.settingsControlHint,
                            {
                              marginTop: 8,
                              fontWeight: '800',
                              fontFamily:
                                option.value === 'default' || option.value === 'system'
                                  ? 'monospace'
                                  : option.value === 'courier'
                                    ? '"Courier New", Courier, monospace'
                                    : option.value === 'robotoMono'
                                      ? '"Roboto Mono", monospace'
                                      : '"Droid Sans Mono", monospace',
                            },
                          ]}
                        >
                          {option.preview}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ),
          })}

          <View style={styles.settingsControlBlock}>
            <TouchableOpacity
              onPress={() => onChange({ isVocalModeEnabled: !settings.isVocalModeEnabled })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.settingsControlTitle}>Modo Vocalista</Text>
                <Text style={styles.settingsControlHint}>
                  Oculta acordes durante a leitura da música.
                </Text>
              </View>
              <View style={[styles.statusPill, settings.isVocalModeEnabled && styles.statusPillActive]}>
                <Text style={[styles.statusPillText, settings.isVocalModeEnabled && styles.statusPillTextActive]}>
                  {settings.isVocalModeEnabled ? 'Ativado' : 'Desativado'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {renderAppearanceColorControl({
            id: 'chord',
            section: 'Acordes',
            title: 'Cor do acorde',
            value: settings.chordColor,
            options: COLOR_OPTIONS,
            customOpen: showColorPicker,
            bold: settings.chordBold,
            onToggleBold: () => onChange({ chordBold: !settings.chordBold }),
            onToggleCustom: () => setShowColorPicker((current) => !current),
            onSelect: (color) => onChange({ chordColor: color }),
            onCustomChange: (color) => onChange({ chordColor: color }),
          })}

          {renderAppearanceColorControl({
            id: 'lyrics',
            section: 'Letra',
            title: 'Cor da letra',
            value: settings.lyricsColor,
            options: COLOR_OPTIONS,
            customOpen: showColorPickerLyrics,
            bold: settings.lyricsBold,
            onToggleBold: () => onChange({ lyricsBold: !settings.lyricsBold }),
            onToggleCustom: () => setShowColorPickerLyrics((current) => !current),
            onSelect: (color) => onChange({ lyricsColor: color }),
            onCustomChange: (color) => onChange({ lyricsColor: color }),
          })}

          {renderAppearanceColorControl({
            id: 'staff',
            section: 'Editor',
            title: 'Cor da pauta',
            value: settings.staffLineColor,
            options: STAFF_LINE_COLOR_OPTIONS,
            customOpen: showColorPickerStaff,
            onToggleCustom: () => setShowColorPickerStaff((current) => !current),
            onSelect: (color) => onChange({ staffLineColor: color }),
            onCustomChange: (color) => onChange({ staffLineColor: color }),
          })}
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
          {renderCompactSettingsSection({
            title: 'Preferência de escrita dos acordes',
            summary: `${chordSpellingLabel} • ${CHORD_SPELLING_OPTIONS.find((option) => option.mode === chordSpellingMode)?.preview ?? ''}`,
            expanded: expandedChordSpelling,
            onPress: () => setExpandedChordSpelling((current) => !current),
            children: (
              <>
                <Text style={styles.settingsControlHint}>
                  Escolha como a transposição deve escrever notas enarmônicas.
                </Text>
                <View style={[styles.themeModeGrid, { marginTop: 12 }]}>
                  {CHORD_SPELLING_OPTIONS.map((option) => {
                    const isActive = chordSpellingMode === option.mode;
                    return (
                      <TouchableOpacity
                        key={option.mode}
                        style={[styles.themeModeCard, isActive && styles.themeModeCardActive]}
                        onPress={() => {
                          onChange({ chordSpellingMode: option.mode });
                          setExpandedChordSpelling(false);
                        }}
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
              </>
            ),
          })}
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
        visible={openSettingsSection === 'favorites'}
        title="Ajustes de pastas/listas e PDF"
        onClose={() => setOpenSettingsSection(null)}
        icon={<Star size={16} color="#ffd166" />}
        maxWidth={620}
        footer={(
          <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setOpenSettingsSection(null)}>
            <Text style={styles.modalGhostText}>Fechar</Text>
          </TouchableOpacity>
        )}
      >
        <ScrollView style={styles.settingsModalScroll} contentContainerStyle={{ paddingBottom: 4 }}>
          {renderCompactSettingsSection({
            title: 'Favoritos',
            summary: favoriteModeLabel,
            expanded: expandedFolderPdfSection === 'favorites',
            onPress: () => setExpandedFolderPdfSection((current) => (current === 'favorites' ? null : 'favorites')),
            children: (
              <>
                <Text style={styles.settingsControlHint}>
                  Use estrelas para deixar repertórios e pastas importantes no topo sem mudar o conteúdo.
                </Text>
                <View style={[styles.themeModeGrid, { marginTop: 12 }]}>
                  {FAVORITE_MODE_OPTIONS.map((option) => {
                    const isActive = favoriteMode === option.mode;
                    return (
                      <TouchableOpacity
                        key={option.mode}
                        style={[styles.themeModeCard, isActive && styles.themeModeCardActive]}
                        onPress={() => {
                          updateFavoriteMode(option.mode);
                          setExpandedFolderPdfSection(null);
                        }}
                      >
                        <Star
                          size={18}
                          color={isActive && option.mode !== 'disabled' ? '#ffd166' : 'var(--app-muted-text)'}
                          fill={isActive && option.mode !== 'disabled' ? '#ffd166' : 'transparent'}
                        />
                        <Text style={[styles.themeModeTitle, isActive && styles.themeModeTitleActive]}>{option.title}</Text>
                        <Text style={styles.themeModeHint}>{option.hint}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ),
          })}

          {renderCompactSettingsSection({
            title: 'Ordem de exibição',
            summary: folderPlaylistDisplayModeLabel,
            expanded: expandedFolderPdfSection === 'display',
            onPress: () => setExpandedFolderPdfSection((current) => (current === 'display' ? null : 'display')),
            children: (
              <>
                <Text style={styles.settingsControlHint}>
                  Escolha como pastas e listas aparecem nas telas principais de repertório.
                </Text>
                <View style={[styles.themeModeGrid, { marginTop: 12 }]}>
                  {FOLDER_PLAYLIST_DISPLAY_OPTIONS.map((option) => {
                    const isActive = folderPlaylistDisplayMode === option.mode;
                    return (
                      <TouchableOpacity
                        key={option.mode}
                        style={[styles.themeModeCard, isActive && styles.themeModeCardActive]}
                        onPress={() => {
                          updateFolderPlaylistDisplayMode(option.mode);
                          setExpandedFolderPdfSection(null);
                        }}
                      >
                        <ListMusic
                          size={18}
                          color={isActive ? 'var(--app-accent)' : 'var(--app-muted-text)'}
                        />
                        <Text style={[styles.themeModeTitle, isActive && styles.themeModeTitleActive]}>{option.title}</Text>
                        <Text style={styles.themeModeHint}>{option.hint}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ),
          })}

          {renderCompactSettingsSection({
            title: 'PDFs rápidos',
            summary: `${configuredQuickPdfCount} de 3 configurados`,
            expanded: expandedFolderPdfSection === 'pdfs',
            onPress: () => setExpandedFolderPdfSection((current) => (current === 'pdfs' ? null : 'pdfs')),
            children: (
              <>
                <Text style={styles.settingsControlHint}>
                  Cadastre até 3 PDFs para adicionar em listas. Você pode usar link público ou arquivo salvo no app.
                </Text>

                <View style={{ gap: 8, marginTop: 12 }}>
                  {quickPdfs.map((pdf) => {
                    const label = QUICK_PDF_LABELS[pdf.id];
                    const hasFile = !!pdf.fileStorage || !!pdf.fileData?.trim();
                    const hasUrl = !!pdf.url?.trim();
                    const linkLooksLocal = isLocalPdfPath(pdf.url);
                    const isExpanded = expandedQuickPdfId === pdf.id;
                    const summary = pdf.fileStorage
                      ? `Arquivo: ${pdf.fileStorage.fileName || pdf.fileName || 'PDF salvo no app'}`
                      : pdf.fileData?.trim()
                        ? `Arquivo: ${pdf.fileName || 'PDF salvo no app'}`
                      : hasUrl
                        ? `Configurado: ${pdf.name?.trim() || 'Link público'}`
                        : 'Slot vazio';

                    return (
                      <View
                        key={pdf.id}
                        style={{
                          borderWidth: 1,
                          borderColor: 'var(--app-border-soft)',
                          borderRadius: 10,
                          backgroundColor: 'var(--app-surface-soft)',
                          padding: 12,
                        }}
                      >
                        <TouchableOpacity
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                          onPress={() => setExpandedQuickPdfId(isExpanded ? null : pdf.id)}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.settingsControlTitle}>{label}</Text>
                            <Text style={styles.settingsControlHint} numberOfLines={1}>{summary}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {(hasFile || hasUrl) ? (
                              <View style={styles.statusPill}>
                                <Text style={styles.statusPillText}>Configurado</Text>
                              </View>
                            ) : null}
                            <ChevronRight
                              size={18}
                              color="var(--app-accent)"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            />
                          </View>
                        </TouchableOpacity>

                        {isExpanded ? (
                          <View style={{ marginTop: 12 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
                              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => clearQuickPdf(pdf.id)}>
                                <Text style={styles.modalGhostText}>Limpar</Text>
                              </TouchableOpacity>
                            </View>

                            <Text style={styles.settingsControlTitle}>Nome opcional</Text>
                            <TextInput
                              style={styles.settingsInput}
                              value={pdf.name || ''}
                              onChangeText={(value: string) => updateQuickPdf(pdf.id, { name: value })}
                              placeholder={`${label} - Ex: Folheto da Missa de Domingo`}
                              placeholderTextColor="#666"
                            />

                            <Text style={[styles.settingsControlTitle, { marginTop: 10 }]}>Link opcional</Text>
                            <TextInput
                              style={styles.settingsInput}
                              value={pdf.url || ''}
                              onChangeText={(value: string) => updateQuickPdfUrl(pdf.id, value)}
                              placeholder="https://..."
                              placeholderTextColor="#666"
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                            {linkLooksLocal ? (
                              <Text style={[styles.settingsControlHint, { color: '#ffd166', marginTop: -8, marginBottom: 10 }]}>
                                Caminhos locais como C:\arquivo.pdf ou E:\arquivo.pdf não funcionam como link. Use Escolher PDF.
                              </Text>
                            ) : null}

                            <TouchableOpacity style={styles.settingsInlineAction} onPress={() => chooseQuickPdfFile(pdf.id)}>
                              <View>
                                <Text style={styles.settingsControlTitle}>Escolher PDF</Text>
                                <Text style={styles.settingsControlHint}>
                                  Arquivo .pdf de até {quickPdfFileLimitLabel}. Ao escolher arquivo, o link deste slot é limpo.
                                </Text>
                              </View>
                              <FileText size={19} color="#4FC3F7" />
                            </TouchableOpacity>
                            <input
                              ref={(node) => {
                                quickPdfFileInputsRef.current[pdf.id] = node;
                              }}
                              type="file"
                              accept="application/pdf,.pdf"
                              style={{ display: 'none' }}
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0] || null;
                                event.currentTarget.value = '';
                                handleQuickPdfFileSelected(pdf.id, file);
                              }}
                            />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </>
            ),
          })}
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

const localStyles = StyleSheet.create({
  settingsContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 18,
  },
  settingsGroup: {
    gap: 8,
  },
  settingsGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
  },
  settingsGroupTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  settingsGroupCards: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    borderRadius: 10,
    backgroundColor: 'var(--app-surface)',
    backgroundImage:
      'linear-gradient(135deg, rgba(15,23,42,0.20) 0%, rgba(30,41,59,0.08) 70%, rgba(14,165,233,0.05) 100%)',
    overflow: 'hidden',
    boxShadow: '0 14px 26px rgba(0,0,0,0.10)',
  },
  settingsGroupCardsLight: {
    borderColor: 'rgba(15,131,201,0.12)',
    backgroundColor: '#fffdf8',
    backgroundImage:
      'linear-gradient(135deg, rgba(255,253,248,0.98) 0%, rgba(241,245,247,0.72) 72%, rgba(15,131,201,0.025) 100%)',
    boxShadow: '0 14px 26px rgba(31,41,55,0.065)',
  },
  settingsCard: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.12)',
  },
  settingsCardLight: {
    borderBottomColor: 'rgba(15,131,201,0.08)',
    backgroundColor: 'rgba(255,253,248,0.30)',
  },
  settingsDangerCard: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.36)',
    backgroundColor: 'rgba(127,29,29,0.16)',
    backgroundImage:
      'linear-gradient(135deg, rgba(127,29,29,0.20) 0%, rgba(15,23,42,0.08) 100%)',
  },
  settingsDangerCardLight: {
    borderColor: 'rgba(220,38,38,0.22)',
    backgroundColor: 'rgba(254,242,242,0.88)',
    backgroundImage:
      'linear-gradient(135deg, rgba(254,226,226,0.90) 0%, rgba(255,253,248,0.92) 100%)',
  },
  settingsIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingsCardText: {
    flex: 1,
    minWidth: 0,
  },
  settingsCardTitle: {
    color: 'var(--app-text)',
    fontSize: 16,
    fontWeight: '900',
  },
  settingsDangerTitle: {
    color: '#d41b1b',
  },
  settingsCardSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  protectedCard: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.20)',
    borderRadius: 10,
    backgroundColor: 'var(--app-surface)',
    backgroundImage:
      'linear-gradient(135deg, rgba(14,165,233,0.09) 0%, rgba(15,23,42,0.08) 100%)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    boxShadow: '0 12px 22px rgba(0,0,0,0.08)',
  },
  protectedCardLight: {
    borderColor: 'rgba(15,131,201,0.14)',
    backgroundColor: '#fffdf8',
    backgroundImage:
      'linear-gradient(135deg, rgba(15,131,201,0.08) 0%, rgba(255,253,248,0.96) 66%, rgba(214,232,241,0.42) 100%)',
    boxShadow: '0 12px 22px rgba(31,41,55,0.065)',
  },
  protectedIconBox: {
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderColor: 'rgba(56,189,248,0.32)',
  },
});
