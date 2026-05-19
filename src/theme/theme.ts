import type { DisplaySettings, ThemePalette, ThemeSettings } from '../types/models';

export const darkPalette: ThemePalette = {
  background: '#121212',
  surface: '#1e1e1e',
  surfaceAlt: '#171a20',
  surfaceSoft: '#111820',
  header: '#283b3d',
  border: '#333333',
  borderSoft: '#2f3946',
  text: '#ffffff',
  mutedText: '#aaaaaa',
  subtleText: '#9ca3af',
  accent: '#4FC3F7',
  accentSoft: 'rgba(79,195,247,0.10)',
  danger: '#ff6b6b',
  overlay: 'rgba(0,0,0,0.70)',
};

export const lightPalette: ThemePalette = {
  background: '#f5f7fb',
  surface: '#ffffff',
  surfaceAlt: '#eef3f8',
  surfaceSoft: '#e7eef7',
  header: '#b1b8be',
  border: '#d8e1ec',
  borderSoft: '#c5d2e0',
  text: '#101828',
  mutedText: '#475467',
  subtleText: '#667085',
  accent: '#2563eb',
  accentSoft: 'rgba(37,99,235,0.12)',
  danger: '#dc2626',
  overlay: 'rgba(15,23,42,0.42)',
};

export const appTheme = {
  colors: {
    ...darkPalette,
    chord: '#ffd166',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
  },
  typography: {
    title: 18,
    body: 15,
    small: 12,
  },
};

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  chordColor: '#4FC3F7',
  lyricsColor: '#ddd',
  chordBold: true,
  lyricsBold: false,
  staffLineColor: 'rgba(255,255,255,0.28)',
  chordSpellingMode: 'mixed',
};

export const resolveDisplaySettings = (settings?: Partial<DisplaySettings>): DisplaySettings => {
  const merged = { ...DEFAULT_DISPLAY_SETTINGS, ...(settings || {}) };
  return {
    ...merged,
    chordSpellingMode:
      merged.chordSpellingMode === 'sharp' ||
      merged.chordSpellingMode === 'flat' ||
      merged.chordSpellingMode === 'mixed'
        ? merged.chordSpellingMode
        : 'mixed',
  };
};

export const DARK_THEME_DISPLAY_DEFAULTS: Pick<DisplaySettings, 'lyricsColor' | 'chordColor'> = {
  lyricsColor: '#ffffff',
  chordColor: '#ffd166',
};

export const LIGHT_THEME_DISPLAY_DEFAULTS: Pick<DisplaySettings, 'lyricsColor' | 'chordColor'> = {
  lyricsColor: '#000000',
  chordColor: '#2563eb',
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mode: 'dark',
  custom: darkPalette,
};

export const DARK_THEME = darkPalette;
export const LIGHT_THEME = lightPalette;

export const COLOR_OPTIONS = [
  '#4FC3F7',
  '#22c55e',
  '#f59e0b',
  '#f97316',
  '#e879f9',
  '#f43f5e',
  '#ffffff',
  '#a78bfa',
  '#38bdf8',
  '#14b8a6',
  '#84cc16',
  '#fde047',
  '#fb7185',
  '#000000',
  '#d1d5db',
] as const;

export const STAFF_LINE_COLOR_OPTIONS = [
  'rgba(255,255,255,0.18)',
  'rgba(255,255,255,0.24)',
  'rgba(255,255,255,0.32)',
  'rgba(79,195,247,0.30)',
  'rgba(34,197,94,0.30)',
  'rgba(245,158,11,0.30)',
] as const;

export const THEME_CSS_VARIABLES: Record<keyof ThemePalette, string> = {
  background: '--app-bg',
  surface: '--app-surface',
  surfaceAlt: '--app-surface-alt',
  surfaceSoft: '--app-surface-soft',
  header: '--app-header',
  border: '--app-border',
  borderSoft: '--app-border-soft',
  text: '--app-text',
  mutedText: '--app-muted-text',
  subtleText: '--app-subtle-text',
  accent: '--app-accent',
  accentSoft: '--app-accent-soft',
  danger: '--app-danger',
  overlay: '--app-overlay',
};

export const THEME_COLOR_INPUTS: Array<{ key: keyof ThemePalette; label: string }> = [
  { key: 'background', label: 'Fundo' },
  { key: 'surface', label: 'Cartões' },
  { key: 'header', label: 'Topo' },
  { key: 'text', label: 'Texto' },
  { key: 'accent', label: 'Destaque' },
  { key: 'borderSoft', label: 'Bordas' },
];

export const resolveThemePalette = (settings: ThemeSettings): ThemePalette => {
  if (settings.mode === 'light') return lightPalette;
  if (settings.mode === 'custom') return { ...darkPalette, ...settings.custom };
  return darkPalette;
};
