import React from 'react';
import { STORAGE_KEYS } from '../services/storage';
import {
  DARK_THEME,
  DARK_THEME_DISPLAY_DEFAULTS,
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  LIGHT_THEME_DISPLAY_DEFAULTS,
  THEME_CSS_VARIABLES,
  resolveDisplaySettings,
  resolveThemePalette,
} from '../theme/theme';
import type { DisplaySettings, ThemePalette, ThemeSettings } from '../types/models';

interface SettingsContextValue {
  displaySettings: DisplaySettings;
  updateDisplaySettings: (next: Partial<DisplaySettings>) => void;
  themeSettings: ThemeSettings;
  updateThemeSettings: (next: Partial<ThemeSettings>) => void;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

const loadDisplaySettings = (): DisplaySettings => {
  const raw = window.localStorage.getItem(STORAGE_KEYS.displaySettings);
  if (!raw) return DEFAULT_DISPLAY_SETTINGS;
  try {
    return resolveDisplaySettings(JSON.parse(raw));
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
};

const loadThemeSettings = (): ThemeSettings => {
  const raw = window.localStorage.getItem(STORAGE_KEYS.themeSettings);
  if (!raw) return DEFAULT_THEME_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
    return {
      mode: parsed.mode === 'light' || parsed.mode === 'custom' ? parsed.mode : 'dark',
      custom: { ...DARK_THEME, ...(parsed.custom || {}) },
    };
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [displaySettings, setDisplaySettings] = React.useState<DisplaySettings>(loadDisplaySettings);
  const [themeSettings, setThemeSettings] = React.useState<ThemeSettings>(loadThemeSettings);
  const themeSettingsRef = React.useRef(themeSettings);

  React.useEffect(() => {
    themeSettingsRef.current = themeSettings;
  }, [themeSettings]);

  const updateDisplaySettings = React.useCallback((next: Partial<DisplaySettings>) => {
    setDisplaySettings((prev) => {
      const merged = { ...prev, ...next };
      window.localStorage.setItem(STORAGE_KEYS.displaySettings, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const updateThemeSettings = React.useCallback((next: Partial<ThemeSettings>) => {
    const nextMode = next.mode;
    const shouldApplyDisplayDefaults =
      (nextMode === 'dark' || nextMode === 'light') && nextMode !== themeSettingsRef.current.mode;

    if (shouldApplyDisplayDefaults) {
      const displayDefaults = nextMode === 'light' ? LIGHT_THEME_DISPLAY_DEFAULTS : DARK_THEME_DISPLAY_DEFAULTS;
      setDisplaySettings((prev) => {
        const merged = { ...prev, ...displayDefaults };
        window.localStorage.setItem(STORAGE_KEYS.displaySettings, JSON.stringify(merged));
        return merged;
      });
    }

    setThemeSettings((prev) => {
      const merged: ThemeSettings = {
        mode: next.mode ?? prev.mode,
        custom: { ...prev.custom, ...(next.custom || {}) },
      };
      window.localStorage.setItem(STORAGE_KEYS.themeSettings, JSON.stringify(merged));
      return merged;
    });
  }, []);

  React.useEffect(() => {
    const palette = resolveThemePalette(themeSettings);
    Object.entries(THEME_CSS_VARIABLES).forEach(([key, cssVariable]) => {
      document.documentElement.style.setProperty(cssVariable, palette[key as keyof ThemePalette]);
    });
    document.body.style.background = palette.background;
    document.body.style.color = palette.text;
  }, [themeSettings]);

  const value = React.useMemo(
    () => ({
      displaySettings,
      updateDisplaySettings,
      themeSettings,
      updateThemeSettings,
    }),
    [displaySettings, themeSettings, updateDisplaySettings, updateThemeSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = React.useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return context;
}
