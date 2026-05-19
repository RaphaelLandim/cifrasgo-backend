import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ChevronLeft, ChevronRight, ListMusic, Menu, Mic, MoreHorizontal, Pause, Pencil, Play, Search, StickyNote, Trash2, Volume2, X } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { ChordLine } from '../components/ChordLine';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { usePlayback } from '../contexts/PlaybackContext';
import { useSettings } from '../contexts/SettingsContext';
import { transposeContent } from '../lib/chords';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import type { Folder, PerformanceNoteBoxSize, PerformanceNoteColor, PerformanceNotePosition, Playlist, Song } from '../types/models';
import { detectTomFromContent, formatKeyForSpellingMode, getKeyOptionsForSpellingMode, getTransposeBetweenKeys, type MusicKey } from '../utils/chordKeys';
import { getSongGenreDisplay, matchesGenreFilter } from '../utils/genres';

const DEFAULT_METRONOME_BPM = 120;
const SOUND_INDICATOR_COLOR = '#f59e0b';
const PERFORMANCE_NOTE_INITIAL_POSITION = { x: 18, y: 124 };
const PERFORMANCE_NOTE_MIN_BOX = { width: 160, height: 110 };
const PERFORMANCE_NOTE_DEFAULT_BOX = { width: 240, height: 132 };
const PLAYLIST_SWIPE_MIN_DISTANCE = 60;
const NOTE_OVERLAY_PADDING = 8;
const NOTE_OVERLAY_TOP = 64;
const NOTE_OVERLAY_PLAY_TOP = 72;
const NOTE_OVERLAY_BOTTOM = 12;
const NOTE_OVERLAY_CONTROLS_BOTTOM = 76;
const NOTE_OVERLAY_PLAYLIST_BOTTOM = 58;
const AUTO_SCROLL_PRESET_OPTIONS = [
  { value: 'v1', label: 'V1', speed: 12 },
  { value: 'v2', label: 'V2', speed: 18 },
  { value: 'v3', label: 'V3', speed: 24 },
  { value: 'v4', label: 'V4', speed: 32 },
  { value: 'v5', label: 'V5', speed: 40 },
  { value: 'v6', label: 'V6', speed: 50 },
  { value: 'v7', label: 'V7', speed: 62 },
  { value: 'v8', label: 'V8', speed: 76 },
] as const;
type AutoScrollPresetValue = (typeof AUTO_SCROLL_PRESET_OPTIONS)[number]['value'];
type AutoScrollPreset = AutoScrollPresetValue | 'custom';
const DEFAULT_AUTO_SCROLL_PRESET: AutoScrollPresetValue = 'v4';
const DEFAULT_CUSTOM_AUTO_SCROLL_SPEED = 35;
const MIN_CUSTOM_AUTO_SCROLL_SPEED = 5;
const MAX_CUSTOM_AUTO_SCROLL_SPEED = 150;
const PERFORMANCE_NOTE_COLORS: Record<PerformanceNoteColor, { label: string; background: string; border: string; text: string; accent: string }> = {
  yellow: { label: 'Amarelo', background: 'linear-gradient(145deg, #fff2a8 0%, #ffe17a 100%)', border: 'rgba(120, 82, 12, 0.28)', text: '#3d2a03', accent: '#5f4300' },
  green: { label: 'Verde', background: 'linear-gradient(145deg, #dcfce7 0%, #a7f3d0 100%)', border: 'rgba(21, 128, 61, 0.26)', text: '#06391d', accent: '#166534' },
  pink: { label: 'Rosa', background: 'linear-gradient(145deg, #ffe4f1 0%, #fbcfe8 100%)', border: 'rgba(190, 24, 93, 0.24)', text: '#57132f', accent: '#be185d' },
  purple: { label: 'Roxo', background: 'linear-gradient(145deg, #ede9fe 0%, #ddd6fe 100%)', border: 'rgba(109, 40, 217, 0.24)', text: '#2e1065', accent: '#6d28d9' },
  blue: { label: 'Azul', background: 'linear-gradient(145deg, #dff6ff 0%, #bae6fd 100%)', border: 'rgba(2, 132, 199, 0.26)', text: '#083344', accent: '#0284c7' },
  gray: { label: 'Cinza', background: 'linear-gradient(145deg, #f4f4f5 0%, #d4d4d8 100%)', border: 'rgba(82, 82, 91, 0.24)', text: '#27272a', accent: '#52525b' },
};

const NOTE_COLOR_KEYS = Object.keys(PERFORMANCE_NOTE_COLORS) as PerformanceNoteColor[];

const normalizePerformanceNoteColor = (value?: PerformanceNoteColor): PerformanceNoteColor =>
  value && NOTE_COLOR_KEYS.includes(value) ? value : 'yellow';

const normalizePerformanceNotePosition = (value?: PerformanceNotePosition): PerformanceNotePosition =>
  value && Number.isFinite(value.x) && Number.isFinite(value.y) ? value : PERFORMANCE_NOTE_INITIAL_POSITION;

const normalizePerformanceNoteBoxSize = (value?: PerformanceNoteBoxSize): PerformanceNoteBoxSize => ({
  width: Math.max(value?.width ?? PERFORMANCE_NOTE_DEFAULT_BOX.width, PERFORMANCE_NOTE_MIN_BOX.width),
  height: Math.max(value?.height ?? PERFORMANCE_NOTE_DEFAULT_BOX.height, PERFORMANCE_NOTE_MIN_BOX.height),
});

const normalizeMetronomeBpm = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_METRONOME_BPM;
  return Math.max(30, Math.min(300, Math.round(value || DEFAULT_METRONOME_BPM)));
};

const getCompassoBeats = (compasso?: Song['compasso']) => {
  if (compasso === '2/4') return 2;
  if (compasso === '3/4') return 3;
  if (compasso === '6/8') return 6;
  return 4;
};

const getAutoScrollPresetSpeed = (preset: AutoScrollPreset, customSpeed: number) => {
  if (preset === 'custom') return customSpeed;
  return AUTO_SCROLL_PRESET_OPTIONS.find((option) => option.value === preset)?.speed ?? AUTO_SCROLL_PRESET_OPTIONS[3].speed;
};

const getAutoScrollPresetLabel = (preset: AutoScrollPreset, customSpeed: number) => {
  if (preset === 'custom') return `${customSpeed} px/s`;
  return AUTO_SCROLL_PRESET_OPTIONS.find((option) => option.value === preset)?.label ?? 'V4';
};

const getAudioNoteDataUrl = (base64?: string, mimeType?: string) =>
  base64 && mimeType ? `data:${mimeType};base64,${base64}` : '';

const formatAudioTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

interface SongDetailScreenProps {
  id: string;
  returnTo?: ManualRoute;
  sourcePlaylistId?: string;
  sourcePlaylistName?: string;
  controlsVisible: boolean;
  styles: any;
}

export function SongDetailScreen({
  id,
  returnTo,
  sourcePlaylistId,
  sourcePlaylistName,
  controlsVisible,
  styles,
}: SongDetailScreenProps) {
  const nav = useManualNavigation();
  const { globalFilters } = useGenreFilter();
  const { isPlaying, startPlaying, stopPlaying } = usePlayback();
  const { displaySettings: settings } = useSettings();
  const [song, setSong] = useState<Song | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [sourcePlaylistSongs, setSourcePlaylistSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [controlsModalOpen, setControlsModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const [addToPlaylistSearch, setAddToPlaylistSearch] = useState('');
  const [addToPlaylistPlaylists, setAddToPlaylistPlaylists] = useState<Playlist[]>([]);
  const [addToPlaylistFolders, setAddToPlaylistFolders] = useState<Folder[]>([]);
  const [addingToPlaylistId, setAddingToPlaylistId] = useState<string | null>(null);
  const [removingFromPlaylistId, setRemovingFromPlaylistId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(17);
  const [tomOpen, setTomOpen] = useState(false);
  const [baseTom, setBaseTom] = useState<MusicKey>('C');
  const [selectedTom, setSelectedTom] = useState<MusicKey>('C');
  const [metronomeVisualOn, setMetronomeVisualOn] = useState(false);
  const [metronomeSoundOn, setMetronomeSoundOn] = useState(false);
  const [metronomePulse, setMetronomePulse] = useState<0 | 1 | 2>(0);
  const scrollRef = useRef<any>(null);
  const scrollPosRef = useRef(0);
  const metronomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metronomePulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metronomeBeatRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNoteRef = useRef<HTMLAudioElement | null>(null);
  const [audioNotePlaying, setAudioNotePlaying] = useState(false);
  const [audioNotePlayerVisible, setAudioNotePlayerVisible] = useState(false);
  const [audioNoteCurrentTime, setAudioNoteCurrentTime] = useState(0);
  const [audioNoteDuration, setAudioNoteDuration] = useState(0);
  const [playlistControlsVisible, setPlaylistControlsVisible] = useState(true);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);
  const [autoScrollPreset, setAutoScrollPreset] = useState<AutoScrollPreset>(DEFAULT_AUTO_SCROLL_PRESET);
  const [customAutoScrollSpeed, setCustomAutoScrollSpeed] = useState(DEFAULT_CUSTOM_AUTO_SCROLL_SPEED);
  const [customAutoScrollDraft, setCustomAutoScrollDraft] = useState(String(DEFAULT_CUSTOM_AUTO_SCROLL_SPEED));
  const [customAutoScrollError, setCustomAutoScrollError] = useState('');
  const [customAutoScrollOpen, setCustomAutoScrollOpen] = useState(false);
  const [noteVisible, setNoteVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteColor, setNoteColor] = useState<PerformanceNoteColor>('yellow');
  const [noteBoxSize, setNoteBoxSize] = useState<PerformanceNoteBoxSize>(normalizePerformanceNoteBoxSize());
  const [noteMenuOpen, setNoteMenuOpen] = useState(false);
  const [noteSaveStatus, setNoteSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [notePosition, setNotePosition] = useState(PERFORMANCE_NOTE_INITIAL_POSITION);
  const [noteDragging, setNoteDragging] = useState(false);
  const [noteResizing, setNoteResizing] = useState(false);
  const noteCardRef = useRef<HTMLDivElement | null>(null);
  const noteDraftRef = useRef('');
  const noteLastSavedTextRef = useRef('');
  const noteSongIdRef = useRef('');
  const noteAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteAutosavePendingRef = useRef(false);
  const noteAutosaveInFlightRef = useRef(false);
  const noteDragFrameRef = useRef<number | null>(null);
  const noteResizeFrameRef = useRef<number | null>(null);
  const notePositionRef = useRef<PerformanceNotePosition>(PERFORMANCE_NOTE_INITIAL_POSITION);
  const noteBoxSizeRef = useRef<PerformanceNoteBoxSize>(normalizePerformanceNoteBoxSize());
  const noteDragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: PERFORMANCE_NOTE_INITIAL_POSITION.x,
    originY: PERFORMANCE_NOTE_INITIAL_POSITION.y,
  });
  const noteResizeRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originWidth: PERFORMANCE_NOTE_DEFAULT_BOX.width,
    originHeight: PERFORMANCE_NOTE_DEFAULT_BOX.height,
  });
  const playlistSwipeRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollLastTimestampRef = useRef<number | null>(null);
  const autoScrollEnabledRef = useRef(false);
  const autoScrollPositionRef = useRef(0);
  const autoScrollProgrammaticRef = useRef(false);
  const autoScrollSpeedRef = useRef<number>(AUTO_SCROLL_PRESET_OPTIONS[3].speed);
  const chordSpellingMode = settings.chordSpellingMode ?? 'mixed';
  const keyOptions = getKeyOptionsForSpellingMode(chordSpellingMode);

  const getScrollNode = () => {
    const target = scrollRef.current;
    return target?.getScrollableNode?.() ?? target?.getNativeScrollRef?.() ?? target;
  };

  const isScrollableDomNode = (value: any): value is HTMLElement =>
    !!value &&
    typeof value.scrollTop === 'number' &&
    typeof value.scrollHeight === 'number' &&
    typeof value.clientHeight === 'number';

  const getScrollableDomNode = (): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    const target = scrollRef.current;
    const rawCandidates = [
      target?.getScrollableNode?.(),
      target?.getNativeScrollRef?.(),
      target,
    ].filter(Boolean);
    const candidates: HTMLElement[] = [];

    rawCandidates.forEach((candidate) => {
      if (isScrollableDomNode(candidate)) candidates.push(candidate);
      if (typeof candidate?.querySelectorAll === 'function') {
        candidates.push(...Array.from(candidate.querySelectorAll('*')).filter(isScrollableDomNode));
      }
    });

    return (
      candidates.find((candidate) => candidate.scrollHeight > candidate.clientHeight) ||
      candidates[0] ||
      null
    );
  };

  const scrollToPosition = (y: number) => {
    const nextY = Math.max(0, y);
    scrollPosRef.current = nextY;
    const target = scrollRef.current;
    const node = getScrollNode();
    const domNode = getScrollableDomNode();

    if (domNode) {
      domNode.scrollTop = nextY;
      if (Math.abs(domNode.scrollTop - nextY) < 1 || nextY === 0) {
        scrollPosRef.current = domNode.scrollTop;
        return;
      }
    }

    if (node && typeof node.scrollTop === 'number') {
      node.scrollTop = nextY;
      if (Math.abs(node.scrollTop - nextY) < 1 || nextY === 0) {
        scrollPosRef.current = node.scrollTop;
        return;
      }
    }

    if (typeof target?.scrollTo === 'function') {
      try {
        target.scrollTo({ x: 0, y: nextY, animated: false });
        return;
      } catch {
        try {
          target.scrollTo(0, nextY);
          return;
        } catch {
          // Continue to web fallback.
        }
      }
    }

    if (node && node !== target && typeof node.scrollTo === 'function') {
      try {
        node.scrollTo({ left: 0, top: nextY, behavior: 'auto' });
        return;
      } catch {
        try {
          node.scrollTo(0, nextY);
          return;
        } catch {
          // Continue to scrollTop fallback.
        }
      }
    }

    if (target && typeof target.scrollTop === 'number') target.scrollTop = nextY;
  };

  const syncScrollPosition = (event: any) => {
    const y =
      event?.nativeEvent?.contentOffset?.y ??
      event?.currentTarget?.scrollTop ??
      event?.target?.scrollTop ??
      0;
    scrollPosRef.current = y;
  };

  // Auto-scroll usa window como scroll real da cifra. Historico: docs/AUTO_SCROLL_DEBUG.md

  const scrollWindowTo = useCallback((top: number) => {
    if (typeof window === 'undefined') return;
    autoScrollProgrammaticRef.current = true;
    try {
      window.scrollTo({ top, behavior: 'auto' });
    } catch {
      window.scrollTo(0, top);
    }
    requestAnimationFrame(() => {
      autoScrollProgrammaticRef.current = false;
    });
  }, []);

  const getWindowMaxScroll = useCallback(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return 0;
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }, []);

  const stopAutoScroll = useCallback(() => {
    autoScrollEnabledRef.current = false;
    if (autoScrollFrameRef.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    autoScrollLastTimestampRef.current = null;
    setAutoScrollEnabled(false);
  }, []);

  const runAutoScrollFrame = useCallback((timestamp: number) => {
    if (!autoScrollEnabledRef.current || !isPlaying || typeof window === 'undefined') {
      stopAutoScroll();
      return;
    }

    const lastTimestamp = autoScrollLastTimestampRef.current ?? timestamp;
    autoScrollLastTimestampRef.current = timestamp;
    const deltaSeconds = Math.max(0, (timestamp - lastTimestamp) / 1000);
    const maxScroll = getWindowMaxScroll();
    const delta = autoScrollSpeedRef.current * deltaSeconds;
    autoScrollPositionRef.current = Math.min(maxScroll, autoScrollPositionRef.current + delta);
    const nextY = autoScrollPositionRef.current;

    scrollWindowTo(nextY);
    const afterY = window.scrollY;
    if (Math.abs(afterY - nextY) > 2) {
      autoScrollPositionRef.current = afterY;
    }

    if (nextY >= maxScroll - 1) {
      stopAutoScroll();
      return;
    }

    autoScrollFrameRef.current = requestAnimationFrame(runAutoScrollFrame);
  }, [getWindowMaxScroll, isPlaying, scrollWindowTo, stopAutoScroll]);

  const startAutoScroll = useCallback(() => {
    if (typeof window === 'undefined' || !isPlaying) return;
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
    }
    autoScrollLastTimestampRef.current = null;
    autoScrollEnabledRef.current = true;
    autoScrollPositionRef.current = window.scrollY;
    setAutoScrollEnabled(true);
    autoScrollFrameRef.current = requestAnimationFrame(runAutoScrollFrame);
  }, [isPlaying, runAutoScrollFrame]);

  const selectAutoScrollPreset = useCallback((preset: AutoScrollPresetValue) => {
    setAutoScrollPreset(preset);
    autoScrollSpeedRef.current = getAutoScrollPresetSpeed(preset, customAutoScrollSpeed);
  }, [customAutoScrollSpeed]);

  const openCustomAutoScroll = useCallback(() => {
    setCustomAutoScrollDraft(String(customAutoScrollSpeed));
    setCustomAutoScrollError('');
    setCustomAutoScrollOpen(true);
  }, [customAutoScrollSpeed]);

  const saveCustomAutoScroll = useCallback(() => {
    const parsed = Number(customAutoScrollDraft.trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < MIN_CUSTOM_AUTO_SCROLL_SPEED || parsed > MAX_CUSTOM_AUTO_SCROLL_SPEED) {
      setCustomAutoScrollError(`Informe um valor entre ${MIN_CUSTOM_AUTO_SCROLL_SPEED} e ${MAX_CUSTOM_AUTO_SCROLL_SPEED} px/s.`);
      return;
    }
    const normalized = Math.round(parsed);
    setCustomAutoScrollSpeed(normalized);
    setAutoScrollPreset('custom');
    autoScrollSpeedRef.current = normalized;
    setCustomAutoScrollError('');
    setCustomAutoScrollOpen(false);
  }, [customAutoScrollDraft]);

  const shouldIgnoreAutoScrollInteraction = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return !!target.closest('button, [role="button"], textarea, input, select, a, [data-swipe-ignore="true"]');
  }, []);

  const stopAutoScrollFromManualInteraction = useCallback((event: Event) => {
    if (!autoScrollEnabledRef.current || autoScrollProgrammaticRef.current) return;
    if (shouldIgnoreAutoScrollInteraction(event.target)) return;
    stopAutoScroll();
  }, [shouldIgnoreAutoScrollInteraction, stopAutoScroll]);

  useEffect(() => {
    autoScrollSpeedRef.current = getAutoScrollPresetSpeed(autoScrollPreset, customAutoScrollSpeed);
  }, [autoScrollPreset, customAutoScrollSpeed]);

  useEffect(() => {
    if (!isPlaying) stopAutoScroll();
  }, [isPlaying, stopAutoScroll]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const options: AddEventListenerOptions = { passive: true };
    window.addEventListener('wheel', stopAutoScrollFromManualInteraction, options);
    window.addEventListener('touchstart', stopAutoScrollFromManualInteraction, options);
    window.addEventListener('touchmove', stopAutoScrollFromManualInteraction, options);
    window.addEventListener('pointerdown', stopAutoScrollFromManualInteraction, options);

    return () => {
      window.removeEventListener('wheel', stopAutoScrollFromManualInteraction);
      window.removeEventListener('touchstart', stopAutoScrollFromManualInteraction);
      window.removeEventListener('touchmove', stopAutoScrollFromManualInteraction);
      window.removeEventListener('pointerdown', stopAutoScrollFromManualInteraction);
    };
  }, [stopAutoScrollFromManualInteraction]);

  useEffect(() => {
    stopAutoScroll();
  }, [id, stopAutoScroll]);

  useEffect(() => () => {
    stopAutoScroll();
  }, [stopAutoScroll]);

  const clearMetronomeTimers = useCallback(() => {
    if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current);
      metronomeIntervalRef.current = null;
    }
    if (metronomePulseTimeoutRef.current) {
      clearTimeout(metronomePulseTimeoutRef.current);
      metronomePulseTimeoutRef.current = null;
    }
  }, []);

  const unlockMetronomeAudio = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;
    const context = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = context;
    if (context.state === 'suspended') {
      await context.resume().catch(() => undefined);
    }
    return context;
  }, []);

  const playMetronomeClick = useCallback((strong: boolean) => {
    if (typeof window === 'undefined') return;
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = context;
    if (context.state === 'suspended') return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = strong ? 1320 : 880;
    gain.gain.setValueAtTime(strong ? 0.14 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.065);
  }, []);

  const toggleMetronomeVisual = useCallback(() => {
    if (!song) return;
    const next = !metronomeVisualOn;
    setMetronomeVisualOn(next);
    setSong((current) => (current ? { ...current, beepVisualEnabled: next } : current));
    void db.updateSong(song.id, { beepVisualEnabled: next });
  }, [metronomeVisualOn, song]);

  const toggleMetronomeSound = useCallback(() => {
    if (!song) return;
    const next = !metronomeSoundOn;
    if (next) void unlockMetronomeAudio();
    setMetronomeSoundOn(next);
    setSong((current) => (current ? { ...current, beepSoundEnabled: next } : current));
    void db.updateSong(song.id, { beepSoundEnabled: next });
  }, [metronomeSoundOn, song, unlockMetronomeAudio]);

  const stopAudioNote = useCallback(() => {
    if (audioNoteRef.current) {
      audioNoteRef.current.pause();
      audioNoteRef.current.currentTime = 0;
      audioNoteRef.current.src = '';
      audioNoteRef.current = null;
    }
    setAudioNotePlaying(false);
    setAudioNotePlayerVisible(false);
    setAudioNoteCurrentTime(0);
    setAudioNoteDuration(0);
  }, []);

  const prepareAudioNote = useCallback(() => {
    if (!song?.audioNoteBase64 || !song.audioNoteMimeType) return;
    if (audioNoteRef.current) return audioNoteRef.current;
    const audio = new Audio(getAudioNoteDataUrl(song.audioNoteBase64, song.audioNoteMimeType));
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      setAudioNoteDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setAudioNoteCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    };
    audio.ontimeupdate = () => {
      setAudioNoteCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      setAudioNoteDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.onended = () => {
      setAudioNotePlaying(false);
      setAudioNoteCurrentTime(Number.isFinite(audio.duration) ? audio.duration : audio.currentTime || 0);
    };
    audioNoteRef.current = audio;
    return audio;
  }, [song?.audioNoteBase64, song?.audioNoteMimeType]);

  const toggleAudioNote = useCallback(() => {
    const audio = prepareAudioNote();
    if (!audio) return;
    setAudioNotePlayerVisible(true);
    if (audioNotePlaying) {
      audio.pause();
      setAudioNotePlaying(false);
      return;
    }
    if (audio.ended || (Number.isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration)) {
      audio.currentTime = 0;
      setAudioNoteCurrentTime(0);
    }
    audio.play()
      .then(() => setAudioNotePlaying(true))
      .catch(() => {
        setAudioNotePlaying(false);
      });
  }, [audioNotePlaying, prepareAudioNote]);

  const closeAudioNotePlayer = useCallback(() => {
    audioNoteRef.current?.pause();
    setAudioNotePlaying(false);
    setAudioNotePlayerVisible(false);
  }, []);

  const seekAudioNote = useCallback((value: number) => {
    const audio = audioNoteRef.current;
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : audioNoteDuration;
    const nextTime = Math.max(0, Math.min(duration || 0, value));
    audio.currentTime = nextTime;
    setAudioNoteCurrentTime(nextTime);
  }, [audioNoteDuration]);

  useEffect(() => {
    db.getSongs().then((all) => {
      setAllSongs(all);
      setSong(all.find((item) => item.id === id) || null);
      scrollPosRef.current = 0;
    });
  }, [id]);

  useEffect(() => {
    if (!song) return;
    setMetronomeVisualOn(song.beepVisualEnabled === true);
    setMetronomeSoundOn(song.beepSoundEnabled === true);
    setMetronomePulse(0);
    metronomeBeatRef.current = 0;
  }, [song?.id]);

  useEffect(() => {
    clearMetronomeTimers();
    if (!song || (!metronomeVisualOn && !metronomeSoundOn)) {
      setMetronomePulse(0);
      metronomeBeatRef.current = 0;
      return;
    }

    const bpm = normalizeMetronomeBpm(song.bpm);
    const beatsPerMeasure = getCompassoBeats(song.compasso);
    const intervalMs = Math.max(120, Math.round(60000 / bpm));

    const tick = () => {
      const nextBeat = (metronomeBeatRef.current % beatsPerMeasure) + 1;
      const strong = nextBeat === 1;
      metronomeBeatRef.current = nextBeat;

      if (metronomeVisualOn) {
        setMetronomePulse(strong ? 2 : 1);
        if (metronomePulseTimeoutRef.current) clearTimeout(metronomePulseTimeoutRef.current);
        metronomePulseTimeoutRef.current = setTimeout(() => setMetronomePulse(0), strong ? 140 : 105);
      }

      if (metronomeSoundOn) playMetronomeClick(strong);
    };

    tick();
    metronomeIntervalRef.current = setInterval(tick, intervalMs);
    return clearMetronomeTimers;
  }, [clearMetronomeTimers, metronomeSoundOn, metronomeVisualOn, playMetronomeClick, song, song?.bpm, song?.compasso]);

  useEffect(() => () => {
    clearMetronomeTimers();
    stopAudioNote();
    void audioContextRef.current?.close?.();
  }, [clearMetronomeTimers, stopAudioNote]);

  useEffect(() => {
    stopAudioNote();
  }, [song?.id, stopAudioNote]);

  useEffect(() => {
    const list = allSongs.filter((item) => matchesGenreFilter(item, globalFilters.selectedGenres));
    setFilteredSongs(list);
  }, [allSongs, globalFilters]);

  useEffect(() => {
    if (sourcePlaylistId) {
      db.byPlaylist(sourcePlaylistId).then((playlist) => {
        if (!playlist) {
          setSourcePlaylistSongs([]);
          return;
        }
        const byId = new Map(allSongs.map((item) => [item.id, item]));
        setSourcePlaylistSongs(
          playlist.songIds
            .map((songId) => byId.get(songId))
            .filter((item): item is Song => !!item)
        );
      });
    } else {
      setSourcePlaylistSongs([]);
    }
  }, [sourcePlaylistId, allSongs]);

  useEffect(() => {
    const list = sourcePlaylistId && sourcePlaylistSongs.length > 0 ? sourcePlaylistSongs : filteredSongs;
    const index = list.findIndex((item) => item.id === id);
    setCurrentSongIndex(index >= 0 ? index : 0);
  }, [filteredSongs, sourcePlaylistSongs, sourcePlaylistId, id]);

  useEffect(() => {
    if (!song) return;
    setFontSize(song.preferredFontSize ?? 17);
  }, [song?.id, song?.preferredFontSize]);

  useEffect(() => {
    if (!song) return;
    scrollToPosition(0);
  }, [song?.id]);

  const clearNoteAutosaveTimer = useCallback(() => {
    if (noteAutosaveTimerRef.current) {
      clearTimeout(noteAutosaveTimerRef.current);
      noteAutosaveTimerRef.current = null;
    }
  }, []);

  const persistPerformanceNotePatch = useCallback(async (updates: Partial<Song>) => {
    const targetSongId = noteSongIdRef.current;
    if (!targetSongId) return;
    const updated = await db.updateSong(targetSongId, updates);
    setSong((current) => {
      if (!current || current.id !== targetSongId) return current;
      return updated ?? { ...current, ...updates };
    });
  }, []);

  const flushPerformanceNoteAutosave = useCallback(async () => {
    clearNoteAutosaveTimer();
    if (!noteAutosavePendingRef.current || noteAutosaveInFlightRef.current) return;

    noteAutosavePendingRef.current = false;
    const trimmed = noteDraftRef.current.trim();
    if (!trimmed || trimmed === noteLastSavedTextRef.current.trim()) {
      setNoteSaveStatus(trimmed ? 'saved' : 'idle');
      return;
    }

    noteAutosaveInFlightRef.current = true;
    setNoteSaveStatus('saving');
    try {
      await persistPerformanceNotePatch({
        performanceNote: trimmed,
        performanceNoteVisible: true,
      });
      noteLastSavedTextRef.current = trimmed;
      setNoteSaveStatus('saved');
    } finally {
      noteAutosaveInFlightRef.current = false;
      if (noteAutosavePendingRef.current) {
        noteAutosaveTimerRef.current = setTimeout(() => {
          void flushPerformanceNoteAutosave();
        }, 700);
      }
    }
  }, [clearNoteAutosaveTimer, persistPerformanceNotePatch]);

  const schedulePerformanceNoteAutosave = useCallback((nextText: string) => {
    noteDraftRef.current = nextText;
    setNoteDraft(nextText);
    noteAutosavePendingRef.current = true;
    setNoteSaveStatus('idle');
    clearNoteAutosaveTimer();
    noteAutosaveTimerRef.current = setTimeout(() => {
      void flushPerformanceNoteAutosave();
    }, 700);
  }, [clearNoteAutosaveTimer, flushPerformanceNoteAutosave]);

  useEffect(() => () => {
    void flushPerformanceNoteAutosave();
    clearNoteAutosaveTimer();
    if (noteDragFrameRef.current !== null) cancelAnimationFrame(noteDragFrameRef.current);
    if (noteResizeFrameRef.current !== null) cancelAnimationFrame(noteResizeFrameRef.current);
  }, [clearNoteAutosaveTimer, flushPerformanceNoteAutosave]);

  useEffect(() => {
    if (!song?.content) return;
    const detected = detectTomFromContent(song.content, chordSpellingMode);
    setBaseTom(detected);
    setSelectedTom(detected);
  }, [song?.id, song?.content]);

  useEffect(() => {
    setBaseTom((current) => formatKeyForSpellingMode(current, chordSpellingMode));
    setSelectedTom((current) => formatKeyForSpellingMode(current, chordSpellingMode));
  }, [chordSpellingMode]);

  useEffect(() => {
    if (!song) return;
    if (noteSongIdRef.current && noteSongIdRef.current !== song.id) {
      void flushPerformanceNoteAutosave();
    }
    const isSameNoteSong = noteSongIdRef.current === song.id;
    noteSongIdRef.current = song.id;
    const hasSavedNote = !!song.performanceNote?.trim();
    if (!isSameNoteSong) {
      setNoteVisible(hasSavedNote && song.performanceNoteVisible !== false);
    } else if (hasSavedNote && song.performanceNoteVisible !== false) {
      setNoteVisible(true);
    }
    if (!isSameNoteSong || (!noteAutosavePendingRef.current && !noteAutosaveInFlightRef.current)) {
      const savedText = song.performanceNote || '';
      noteDraftRef.current = savedText;
      noteLastSavedTextRef.current = savedText.trim();
      setNoteDraft(savedText);
    }
    setNoteColor(normalizePerformanceNoteColor(song.performanceNoteColor));
    const nextBoxSize = normalizePerformanceNoteBoxSize(song.performanceNoteBoxSize);
    const nextPosition = normalizePerformanceNotePosition(song.performanceNotePosition);
    noteBoxSizeRef.current = nextBoxSize;
    notePositionRef.current = nextPosition;
    setNoteBoxSize(nextBoxSize);
    setNoteMenuOpen(false);
    setNoteSaveStatus(hasSavedNote ? 'saved' : 'idle');
    setNotePosition(nextPosition);
    noteDragRef.current.active = false;
    noteResizeRef.current.active = false;
    setNoteDragging(false);
    setNoteResizing(false);
  }, [
    song?.id,
    song?.performanceNote,
    song?.performanceNoteBoxSize,
    song?.performanceNoteColor,
    song?.performanceNotePosition,
    song?.performanceNoteVisible,
    flushPerformanceNoteAutosave,
  ]);

  if (!song) return null;

  const transpose = getTransposeBetweenKeys(baseTom, selectedTom);
  const text = transposeContent(song.content, transpose, chordSpellingMode);
  const currentSongList = sourcePlaylistId && sourcePlaylistSongs.length > 0 ? sourcePlaylistSongs : filteredSongs;
  const currentListName = sourcePlaylistId && sourcePlaylistName ? sourcePlaylistName : 'Lista Atual';
  const playlistSwipeEnabled = isPlaying && !!sourcePlaylistId && currentSongList.length > 1;
  const showPlaylistControls = playlistSwipeEnabled && playlistControlsVisible;
  const previousPlaylistIndex = currentSongIndex - 1;
  const nextPlaylistIndex = currentSongIndex + 1;
  const previousPlaylistSong = sourcePlaylistId ? currentSongList[previousPlaylistIndex] : undefined;
  const nextPlaylistSong = sourcePlaylistId ? currentSongList[nextPlaylistIndex] : undefined;
  const previousDisabled = currentSongIndex <= 0;
  const nextDisabled = currentSongIndex >= currentSongList.length - 1;
  const noteOverlayTop = isPlaying ? NOTE_OVERLAY_PLAY_TOP : NOTE_OVERLAY_TOP;
  const noteOverlayBottom = isPlaying
    ? showPlaylistControls ? NOTE_OVERLAY_PLAYLIST_BOTTOM : NOTE_OVERLAY_BOTTOM
    : controlsVisible ? NOTE_OVERLAY_CONTROLS_BOTTOM : NOTE_OVERLAY_BOTTOM;
  const hasAudioNote = !!song.audioNoteBase64 && !!song.audioNoteMimeType;
  const hasPerformanceNoteDraft = noteDraft.trim().length > 0 || !!song.performanceNote?.trim();
  const audioNoteSafeDuration = audioNoteDuration > 0 ? audioNoteDuration : 0;
  const audioNoteProgress = audioNoteSafeDuration > 0
    ? Math.min(100, Math.max(0, (audioNoteCurrentTime / audioNoteSafeDuration) * 100))
    : 0;
  const songScrollStyle: CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    flex: '1 1 0%',
    height: 0,
    minHeight: 0,
    boxSizing: 'border-box',
    paddingLeft: isPlaying ? 18 : 12,
    paddingRight: isPlaying ? 18 : 12,
    paddingTop: isPlaying ? 74 : 0,
    paddingBottom: isPlaying ? (showPlaylistControls ? 82 : 32) : controlsVisible ? (audioNotePlayerVisible ? 232 : 152) : 28,
    overflowY: 'auto',
    overflowX: 'auto',
    overscrollBehaviorX: 'contain',
    touchAction: playlistSwipeEnabled ? 'pan-y' : 'auto',
    WebkitOverflowScrolling: 'touch',
  };

  const openAddToPlaylistModal = async () => {
    if (!song) return;
    setAddToPlaylistSearch('');
    setAddToPlaylistOpen(true);
    const [playlists, folders] = await Promise.all([db.getPlaylists(), db.getFolders()]);
    setAddToPlaylistPlaylists(playlists);
    setAddToPlaylistFolders(folders);
  };

  const closeAddToPlaylistModal = () => {
    setAddToPlaylistOpen(false);
    setAddToPlaylistSearch('');
    setAddingToPlaylistId(null);
    setRemovingFromPlaylistId(null);
  };

  const getPlaylistFolderPath = (folderId?: string | null) => {
    if (!folderId) return '';
    const byId = new Map(addToPlaylistFolders.map((folder) => [folder.id, folder]));
    const names: string[] = [];
    const visited = new Set<string>();
    let current = byId.get(folderId);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names.join(' / ');
  };

  const getPlaylistSongCountLabel = (playlist: Playlist) => {
    const count = playlist.songIds?.length ?? 0;
    return `${count} ${count === 1 ? 'música' : 'músicas'}`;
  };

  const getAddToPlaylistSubtitle = (playlist: Playlist) => {
    const path = getPlaylistFolderPath(playlist.folderId);
    return `${path ? `Lista em ${path}` : 'Lista na raiz'} · ${getPlaylistSongCountLabel(playlist)}`;
  };

  const playlistAlreadyHasSong = (playlist: Playlist) =>
    !!song && (playlist.songIds ?? []).includes(song.id);

  const addCurrentSongToPlaylist = async (playlist: Playlist) => {
    if (!song || playlistAlreadyHasSong(playlist) || addingToPlaylistId || removingFromPlaylistId) return;
    setAddingToPlaylistId(playlist.id);
    await db.addSongToPlaylist(playlist.id, song.id);
    setAddToPlaylistPlaylists((current) =>
      current.map((item) =>
        item.id === playlist.id
          ? { ...item, songIds: (item.songIds ?? []).includes(song.id) ? item.songIds : [...(item.songIds ?? []), song.id] }
          : item
      )
    );
    setAddingToPlaylistId(null);
  };

  const removeCurrentSongFromPlaylist = async (playlist: Playlist) => {
    if (!song || !playlistAlreadyHasSong(playlist) || addingToPlaylistId || removingFromPlaylistId) return;
    setRemovingFromPlaylistId(playlist.id);
    await db.removeSongFromPlaylist(playlist.id, song.id);
    setAddToPlaylistPlaylists((current) =>
      current.map((item) =>
        item.id === playlist.id
          ? { ...item, songIds: (item.songIds ?? []).filter((songId) => songId !== song.id) }
          : item
      )
    );
    setRemovingFromPlaylistId(null);
  };

  const normalizedAddToPlaylistSearch = addToPlaylistSearch.trim().toLowerCase();
  const visibleAddToPlaylistOptions = [...addToPlaylistPlaylists]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .filter((playlist) => {
      if (!normalizedAddToPlaylistSearch) return true;
      return `${playlist.name} ${getPlaylistFolderPath(playlist.folderId)}`.toLowerCase().includes(normalizedAddToPlaylistSearch);
    });

  const navigateToIndex = (index: number) => {
    if (index < 0 || index >= currentSongList.length) return;
    const nextSong = currentSongList[index];
    setControlsModalOpen(false);
    setListModalOpen(false);
    nav.replace('SongDetail', {
      id: nextSong.id,
      returnTo,
      sourcePlaylistId,
      sourcePlaylistName,
    });
  };

  const shouldIgnorePlaylistSwipeTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return !!target.closest('button, textarea, input, select, a, [data-swipe-ignore="true"]');
  };

  const beginPlaylistSwipe = (clientX: number, clientY: number, pointerId: number, target: EventTarget | null) => {
    if (!playlistSwipeEnabled || noteDragRef.current.active || noteResizeRef.current.active) return;
    if (shouldIgnorePlaylistSwipeTarget(target)) return;
    playlistSwipeRef.current = {
      active: true,
      pointerId,
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastY: clientY,
    };
  };

  const updatePlaylistSwipe = (clientX: number, clientY: number, pointerId: number) => {
    if (!playlistSwipeRef.current.active) return;
    if (playlistSwipeRef.current.pointerId !== -1 && pointerId !== playlistSwipeRef.current.pointerId) return;
    playlistSwipeRef.current.lastX = clientX;
    playlistSwipeRef.current.lastY = clientY;
  };

  const finishPlaylistSwipe = (clientX: number, clientY: number, pointerId: number) => {
    const gesture = playlistSwipeRef.current;
    if (!gesture.active) return;
    if (gesture.pointerId !== -1 && pointerId !== gesture.pointerId) return;

    playlistSwipeRef.current.active = false;
    const endX = clientX;
    const endY = clientY;
    const deltaX = endX - gesture.startX;
    const deltaY = endY - gesture.startY;

    if (!playlistSwipeEnabled) return;
    if (Math.abs(deltaX) < PLAYLIST_SWIPE_MIN_DISTANCE) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

    if (deltaX < 0 && !nextDisabled) {
      navigateToIndex(currentSongIndex + 1);
    } else if (deltaX > 0 && !previousDisabled) {
      navigateToIndex(currentSongIndex - 1);
    }
  };

  const cancelPlaylistSwipe = () => {
    playlistSwipeRef.current.active = false;
  };

  const startPlaylistSwipe = (event: any) => {
    if (event.pointerType === 'touch') return;
    beginPlaylistSwipe(event.clientX ?? 0, event.clientY ?? 0, event.pointerId ?? -1, event.target);
  };

  const movePlaylistSwipe = (event: any) => {
    if (event.pointerType === 'touch') return;
    updatePlaylistSwipe(event.clientX ?? playlistSwipeRef.current.lastX, event.clientY ?? playlistSwipeRef.current.lastY, event.pointerId ?? -1);
  };

  const stopPlaylistSwipe = (event: any) => {
    if (event.pointerType === 'touch') return;
    finishPlaylistSwipe(event.clientX ?? playlistSwipeRef.current.lastX, event.clientY ?? playlistSwipeRef.current.lastY, event.pointerId ?? -1);
  };

  const startPlaylistTouchSwipe = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    beginPlaylistSwipe(touch.clientX, touch.clientY, -1, event.target);
  };

  const movePlaylistTouchSwipe = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    updatePlaylistSwipe(touch.clientX, touch.clientY, -1);
  };

  const stopPlaylistTouchSwipe = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    finishPlaylistSwipe(touch?.clientX ?? playlistSwipeRef.current.lastX, touch?.clientY ?? playlistSwipeRef.current.lastY, -1);
  };

  const openEditor = () => {
    if (transpose !== 0) {
      nav.navigate('SongEditor', {
        id: song.id,
        returnTo,
        initialContentOverride: text,
        editingTransposedFromKey: baseTom,
        editingTransposedToKey: selectedTom,
      });
      return;
    }

    nav.navigate('SongEditor', { id: song.id, returnTo });
  };

  const changeFontSize = async (delta: number) => {
    const next = Math.max(12, Math.min(28, fontSize + delta));
    setFontSize(next);
    await db.updateSong(song.id, { preferredFontSize: next });
  };

  const clampNotePosition = (x: number, y: number) => {
    if (typeof window === 'undefined') {
      return { x: Math.max(8, x), y: Math.max(8, y) };
    }

    const minY = NOTE_OVERLAY_PADDING;
    const currentWidth = noteBoxSizeRef.current.width;
    const currentHeight = noteBoxSizeRef.current.height;
    const availableHeight = Math.max(0, window.innerHeight - noteOverlayTop - noteOverlayBottom);
    const maxX = Math.max(NOTE_OVERLAY_PADDING, window.innerWidth - currentWidth - NOTE_OVERLAY_PADDING);
    const maxY = Math.max(minY, availableHeight - currentHeight - NOTE_OVERLAY_PADDING);

    return {
      x: Math.min(Math.max(NOTE_OVERLAY_PADDING, x), maxX),
      y: Math.min(Math.max(minY, y), maxY),
    };
  };

  const openPerformanceNote = () => {
    const nextBoxSize = normalizePerformanceNoteBoxSize(song.performanceNoteBoxSize);
    const nextPosition = normalizePerformanceNotePosition(song.performanceNotePosition);
    const savedText = song.performanceNote || '';
    noteDraftRef.current = savedText;
    noteLastSavedTextRef.current = savedText.trim();
    setNoteDraft(savedText);
    setNoteColor(normalizePerformanceNoteColor(song.performanceNoteColor));
    noteBoxSizeRef.current = nextBoxSize;
    notePositionRef.current = nextPosition;
    setNoteBoxSize(nextBoxSize);
    setNotePosition(nextPosition);
    setNoteMenuOpen(false);
    setNoteVisible(true);
    void persistPerformanceNotePatch({ performanceNoteVisible: true });
  };

  const deletePerformanceNote = async () => {
    if (!song || noteAutosaveInFlightRef.current) return;
    clearNoteAutosaveTimer();
    noteAutosavePendingRef.current = false;
    setNoteSaveStatus('saving');
    try {
      await persistPerformanceNotePatch({
        performanceNote: undefined,
        performanceNoteSize: undefined,
        performanceNoteColor: undefined,
        performanceNotePosition: undefined,
        performanceNoteBoxSize: undefined,
        performanceNoteVisible: undefined,
      });
      setNoteDraft('');
      noteDraftRef.current = '';
      noteLastSavedTextRef.current = '';
      setNoteMenuOpen(false);
      setNoteVisible(false);
    } finally {
      setNoteSaveStatus('idle');
    }
  };

  const hidePerformanceNote = () => {
    setNoteVisible(false);
    setNoteMenuOpen(false);
    void (async () => {
      await flushPerformanceNoteAutosave();
      await persistPerformanceNotePatch({ performanceNoteVisible: false });
    })();
  };

  const selectPerformanceNoteColor = async (color: PerformanceNoteColor) => {
    setNoteColor(color);
    await persistPerformanceNotePatch({ performanceNoteColor: color });
  };

  const changePerformanceNoteText = (value: string) => {
    schedulePerformanceNoteAutosave(value);
  };

  const startNoteDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    noteDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: notePositionRef.current.x,
      originY: notePositionRef.current.y,
    };
    setNoteDragging(true);
  };

  const moveNoteDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = noteDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const nextPosition = clampNotePosition(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY
    );
    notePositionRef.current = nextPosition;
    if (noteDragFrameRef.current !== null) return;
    noteDragFrameRef.current = requestAnimationFrame(() => {
      noteDragFrameRef.current = null;
      setNotePosition(notePositionRef.current);
    });
  };

  const stopNoteDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = noteDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    noteDragRef.current.active = false;
    if (noteDragFrameRef.current !== null) {
      cancelAnimationFrame(noteDragFrameRef.current);
      noteDragFrameRef.current = null;
    }
    setNotePosition(notePositionRef.current);
    setNoteDragging(false);
    void persistPerformanceNotePatch({ performanceNotePosition: notePositionRef.current });
  };

  const clampNoteBoxSize = (width: number, height: number): PerformanceNoteBoxSize => {
    const currentPosition = notePositionRef.current;
    const maxWidth = typeof window === 'undefined'
      ? PERFORMANCE_NOTE_DEFAULT_BOX.width
      : Math.max(PERFORMANCE_NOTE_MIN_BOX.width, window.innerWidth - currentPosition.x - 24);
    const availableHeight = typeof window === 'undefined'
      ? PERFORMANCE_NOTE_DEFAULT_BOX.height + currentPosition.y + NOTE_OVERLAY_PADDING
      : window.innerHeight - noteOverlayTop - noteOverlayBottom;
    const maxHeight = typeof window === 'undefined'
      ? PERFORMANCE_NOTE_DEFAULT_BOX.height
      : Math.max(PERFORMANCE_NOTE_MIN_BOX.height, availableHeight - currentPosition.y - 24);
    return {
      width: Math.min(Math.max(width, PERFORMANCE_NOTE_MIN_BOX.width), maxWidth),
      height: Math.min(Math.max(height, PERFORMANCE_NOTE_MIN_BOX.height), maxHeight),
    };
  };

  const startNoteResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    noteResizeRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: noteBoxSizeRef.current.width,
      originHeight: noteBoxSizeRef.current.height,
    };
    setNoteResizing(true);
  };

  const moveNoteResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = noteResizeRef.current;
    if (!resize.active || resize.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const nextBoxSize = clampNoteBoxSize(
      resize.originWidth + event.clientX - resize.startX,
      resize.originHeight + event.clientY - resize.startY
    );
    const nextPosition = clampNotePosition(notePositionRef.current.x, notePositionRef.current.y);
    noteBoxSizeRef.current = nextBoxSize;
    notePositionRef.current = nextPosition;
    if (noteResizeFrameRef.current !== null) return;
    noteResizeFrameRef.current = requestAnimationFrame(() => {
      noteResizeFrameRef.current = null;
      setNoteBoxSize(noteBoxSizeRef.current);
      setNotePosition(notePositionRef.current);
    });
  };

  const stopNoteResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const resize = noteResizeRef.current;
    if (!resize.active || resize.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    noteResizeRef.current.active = false;
    if (noteResizeFrameRef.current !== null) {
      cancelAnimationFrame(noteResizeFrameRef.current);
      noteResizeFrameRef.current = null;
    }
    setNoteBoxSize(noteBoxSizeRef.current);
    setNotePosition(notePositionRef.current);
    setNoteResizing(false);
    void persistPerformanceNotePatch({
      performanceNoteBoxSize: noteBoxSizeRef.current,
      performanceNotePosition: notePositionRef.current,
    });
  };

  const renderMetronomeIndicators = () => (
    <View style={metronomeStyles.indicatorRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Alternar metrônomo visual"
        onPress={toggleMetronomeVisual}
        style={[
          metronomeStyles.indicator,
          metronomeVisualOn ? metronomeStyles.visualIndicatorActive : metronomeStyles.indicatorDisabled,
          metronomeVisualOn && metronomePulse === 1 ? metronomeStyles.indicatorPulse : null,
          metronomeVisualOn && metronomePulse === 2 ? metronomeStyles.indicatorStrongPulse : null,
        ]}
      >
        <View style={metronomeStyles.innerMark} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Alternar beep sonoro"
        onPress={toggleMetronomeSound}
        style={[
          metronomeStyles.indicator,
          metronomeSoundOn ? metronomeStyles.soundIndicatorActive : metronomeStyles.indicatorDisabled,
          metronomeSoundOn && metronomePulse === 2 ? metronomeStyles.soundStrongPulse : null,
        ]}
      >
        <Volume2 size={13} color={metronomeSoundOn ? '#051014' : 'var(--app-muted-text)'} />
      </TouchableOpacity>
    </View>
  );

  const renderAudioNotePlayer = (variant: 'fixed' | 'inline') => {
    const isInline = variant === 'inline';

    return (
      <div
        style={isInline ? audioNotePlayerStyles.inlineRoot : getAudioNotePlayerStyle(controlsVisible)}
        data-swipe-ignore="true"
      >
        <button
          type="button"
          aria-label={audioNotePlaying ? 'Pausar gravação de referência' : 'Tocar gravação de referência'}
          style={audioNotePlayerStyles.iconButton}
          onClick={toggleAudioNote}
        >
          {audioNotePlaying ? (
            <Pause size={16} color="var(--app-accent)" />
          ) : (
            <Play size={16} color="var(--app-accent)" />
          )}
        </button>
        <div style={audioNotePlayerStyles.content}>
          <div style={audioNotePlayerStyles.headerRow}>
            <span style={audioNotePlayerStyles.title}>Gravação de referência</span>
            <span style={audioNotePlayerStyles.time}>
              {formatAudioTime(audioNoteCurrentTime)} / {formatAudioTime(audioNoteSafeDuration)}
            </span>
          </div>
          <div style={audioNotePlayerStyles.progressWrap}>
            <div style={audioNotePlayerStyles.progressTrack}>
              <div style={{ ...audioNotePlayerStyles.progressFill, width: `${audioNoteProgress}%` }} />
            </div>
            <input
              aria-label="Buscar posição da gravação"
              type="range"
              min={0}
              max={audioNoteSafeDuration || 0}
              step={0.1}
              value={Math.min(audioNoteCurrentTime, audioNoteSafeDuration || audioNoteCurrentTime)}
              onChange={(event) => seekAudioNote(Number(event.currentTarget.value))}
              style={audioNotePlayerStyles.range}
            />
          </div>
        </div>
        <button
          type="button"
          aria-label="Fechar gravação de referência"
          style={audioNotePlayerStyles.closeButton}
          onClick={closeAudioNotePlayer}
        >
          <X size={15} color="var(--app-muted-text)" />
        </button>
      </div>
    );
  };

  return (
    <View style={[styles.container, styles.songDetailContainer, performanceNoteStyles.root]}>
      {!isPlaying ? (
        <>
          <View style={metronomeStyles.songHeader}>
            <View style={metronomeStyles.songHeaderText}>
              <Text style={[styles.screenTitle, metronomeStyles.songTitle]} numberOfLines={1}>{song.title}</Text>
              <Text style={[styles.subtitle, { marginBottom: getSongGenreDisplay(song) ? 4 : 8 }]}>{song.artist}</Text>
              {getSongGenreDisplay(song) ? (
                <Text style={[styles.songGenreBadge, metronomeStyles.genreBadge]}>{getSongGenreDisplay(song)}</Text>
              ) : null}
            </View>
            {renderMetronomeIndicators()}
          </View>
          {song.observation?.trim() ? (
            <Text style={styles.songObservation}>{song.observation.trim()}</Text>
          ) : null}
        </>
      ) : (
        <View style={playHeaderStyles.header}>
          <View style={playHeaderStyles.titleBlock}>
            <Text style={styles.screenTitle} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{song.artist}</Text>
          </View>
          <View style={playHeaderStyles.actions}>
            {renderMetronomeIndicators()}
            <TouchableOpacity
              onPress={autoScrollEnabled ? stopAutoScroll : startAutoScroll}
              style={[
                playHeaderStyles.autoScrollButton,
                autoScrollEnabled && playHeaderStyles.autoScrollButtonActive,
              ]}
            >
              {autoScrollEnabled ? (
                <Pause size={14} color="var(--app-accent)" />
              ) : (
                <Play size={14} color="var(--app-accent)" />
              )}
              <Text style={playHeaderStyles.autoScrollText}>{getAutoScrollPresetLabel(autoScrollPreset, customAutoScrollSpeed)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setControlsModalOpen(true)}
              style={styles.fullscreenActionBtn}
            >
              <Menu size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={stopPlaying} style={styles.fullscreenActionBtn}>
              <X size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      <div
        ref={scrollRef}
        style={songScrollStyle}
        onScroll={syncScrollPosition}
        onPointerDown={startPlaylistSwipe}
        onPointerMove={movePlaylistSwipe}
        onPointerUp={stopPlaylistSwipe}
        onPointerCancel={cancelPlaylistSwipe}
        onTouchStartCapture={startPlaylistTouchSwipe}
        onTouchMoveCapture={movePlaylistTouchSwipe}
        onTouchEndCapture={stopPlaylistTouchSwipe}
        onTouchCancelCapture={cancelPlaylistSwipe}
      >
        {text.split('\n').map((line, index) => (
          <ChordLine key={index} text={line} fontSize={fontSize} settings={settings} />
        ))}
      </div>
      {showPlaylistControls ? (
        <div style={playlistSwipeIndicatorStyles.container} data-swipe-ignore="true">
          {previousPlaylistSong ? (
            <button
              type="button"
              style={playlistSwipeIndicatorStyles.pill}
              onClick={() => navigateToIndex(previousPlaylistIndex)}
              data-swipe-ignore="true"
            >
              <span style={playlistSwipeIndicatorStyles.label}>Anterior</span>
              <span style={playlistSwipeIndicatorStyles.song}>
                {previousPlaylistIndex + 1}: {previousPlaylistSong.title}
              </span>
            </button>
          ) : null}
          {nextPlaylistSong ? (
            <button
              type="button"
              style={playlistSwipeIndicatorStyles.pill}
              onClick={() => navigateToIndex(nextPlaylistIndex)}
              data-swipe-ignore="true"
            >
              <span style={playlistSwipeIndicatorStyles.label}>Próxima</span>
              <span style={playlistSwipeIndicatorStyles.song}>
                {nextPlaylistIndex + 1}: {nextPlaylistSong.title}
              </span>
            </button>
          ) : (
            <span style={playlistSwipeIndicatorStyles.endText}>Fim da lista</span>
          )}
        </div>
      ) : null}
      {noteVisible ? (
        <div style={getPerformanceNoteOverlayStyle(noteOverlayTop, noteOverlayBottom)} data-swipe-ignore="true">
        <div
          ref={noteCardRef}
          data-swipe-ignore="true"
          style={getPerformanceNoteCardStyle(notePosition, noteDragging || noteResizing, noteBoxSize, noteColor)}
          onPointerMove={moveNoteDrag}
          onPointerUp={stopNoteDrag}
          onPointerCancel={stopNoteDrag}
        >
          <div style={performanceNoteStyles.pin} />
          <button
            type="button"
            aria-label="OpÃ§Ãµes do post-it"
            style={performanceNoteStyles.menuButton}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setNoteMenuOpen((current) => !current)}
          >
            <MoreHorizontal size={14} color={PERFORMANCE_NOTE_COLORS[noteColor].accent} />
          </button>
          <button
            type="button"
            aria-label="Ocultar lembrete"
            style={performanceNoteStyles.closeButton}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={hidePerformanceNote}
          >
            <X size={13} color={PERFORMANCE_NOTE_COLORS[noteColor].accent} />
          </button>
          {noteMenuOpen ? (
            <div style={performanceNoteStyles.menu}>
              <div style={performanceNoteStyles.menuTitle}>Trocar cor</div>
              <div style={performanceNoteStyles.colorRow}>
                {NOTE_COLOR_KEYS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={PERFORMANCE_NOTE_COLORS[color].label}
                    style={getColorButtonStyle(color, noteColor)}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => void selectPerformanceNoteColor(color)}
                  />
                ))}
              </div>
              <button
                type="button"
                style={performanceNoteStyles.deleteButton}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={deletePerformanceNote}
              >
                <Trash2 size={13} color="#991b1b" />
                Excluir anotação
              </button>
            </div>
          ) : null}
          <div
            style={performanceNoteStyles.noteHeader}
            onPointerDown={startNoteDrag}
          >
            <span style={performanceNoteStyles.iconBox}>
              <StickyNote size={15} color={PERFORMANCE_NOTE_COLORS[noteColor].accent} />
            </span>
            <span style={performanceNoteStyles.label}>Lembrete</span>
          </div>
          <textarea
            value={noteDraft}
            onChange={(event) => changePerformanceNoteText(event.target.value)}
            placeholder="Ex: Tom D"
            style={getPerformanceNoteTextareaStyle(noteBoxSize, noteColor)}
            onPointerDown={(event) => event.stopPropagation()}
          />
          <div style={performanceNoteStyles.noteFooter}>
            <span style={performanceNoteStyles.autosaveStatus}>
              {noteSaveStatus === 'saving' ? 'Salvando...' : noteSaveStatus === 'saved' ? 'Salvo' : 'Autosave'}
            </span>
          </div>
          <div
            style={performanceNoteStyles.resizeHandle}
            onPointerDown={startNoteResize}
            onPointerMove={moveNoteResize}
            onPointerUp={stopNoteResize}
            onPointerCancel={stopNoteResize}
          />
        </div>
        </div>
      ) : null}
      {!isPlaying && audioNotePlayerVisible && hasAudioNote ? renderAudioNotePlayer('fixed') : null}
      {!isPlaying && controlsVisible ? (
        <View style={styles.panel} data-swipe-ignore="true">
          <TouchableOpacity onPress={startPlaying} style={styles.panelBtn}>
            <Play size={18} color="#4FC3F7" />
          </TouchableOpacity>
          {hasAudioNote ? (
            <TouchableOpacity onPress={toggleAudioNote} style={styles.panelBtn}>
              {audioNotePlaying ? (
                <Pause size={17} color="#ff6b6b" />
              ) : (
                <Mic size={17} color="#ff6b6b" />
              )}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => changeFontSize(-1)} style={styles.panelBtn}>
            <Text style={{ color: '#bbb', fontWeight: '700' }}>A-</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeFontSize(1)} style={styles.panelBtn}>
            <Text style={{ color: '#bbb', fontWeight: '700' }}>A+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTomOpen(true)} style={styles.panelBtn}>
            <Text style={styles.transpose}>{selectedTom}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openAddToPlaylistModal}
            style={styles.panelBtn}
          >
            <ListMusic size={17} color="#ffd166" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openPerformanceNote}
            style={[styles.panelBtn, hasPerformanceNoteDraft ? styles.panelBtnActive : null]}
          >
            <StickyNote size={17} color={hasPerformanceNoteDraft ? '#051014' : '#fbbf24'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openEditor}
            style={styles.panelBtn}
          >
            <Pencil size={17} color="#4FC3F7" />
          </TouchableOpacity>
        </View>
      ) : null}

      <AppModal
        visible={controlsModalOpen}
        title="Controles Rápidos"
        onClose={() => setControlsModalOpen(false)}
        icon={<Menu size={16} color="var(--app-accent)" />}
        maxWidth={520}
      >
        <ScrollView
          style={quickControlsStyles.scrollBody}
          contentContainerStyle={quickControlsStyles.body}
        >
          <View style={quickControlsStyles.section}>
            <Text style={quickControlsStyles.sectionTitle}>Navegação</Text>
          <View style={quickControlsStyles.navRow}>
            <TouchableOpacity
              style={[
                quickControlsStyles.navButton,
                previousDisabled && quickControlsStyles.disabledButton,
              ]}
              disabled={previousDisabled}
              onPress={() => navigateToIndex(currentSongIndex - 1)}
            >
              <ChevronLeft size={18} color={previousDisabled ? '#777' : '#4FC3F7'} />
              <Text style={[quickControlsStyles.navButtonText, previousDisabled && quickControlsStyles.disabledText]}>
                Anterior
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                quickControlsStyles.navButton,
                !nextDisabled && quickControlsStyles.navButtonPrimary,
                nextDisabled && quickControlsStyles.disabledButton,
              ]}
              disabled={nextDisabled}
              onPress={() => navigateToIndex(currentSongIndex + 1)}
            >
              <Text style={[quickControlsStyles.navButtonText, nextDisabled && quickControlsStyles.disabledText]}>
                Próxima
              </Text>
              <ChevronRight size={18} color={nextDisabled ? '#777' : '#4FC3F7'} />
            </TouchableOpacity>
          </View>
          </View>
          <View style={quickControlsStyles.section}>
          <Text style={quickControlsStyles.sectionTitle}>Lista atual</Text>
          <TouchableOpacity
            style={quickControlsStyles.featureButton}
            onPress={() => {
              setControlsModalOpen(false);
              setListModalOpen(true);
            }}
          >
            <View style={quickControlsStyles.featureIcon}>
              <ListMusic size={20} color="#4FC3F7" />
            </View>
            <View style={quickControlsStyles.featureTextBlock}>
              <Text style={quickControlsStyles.featureTitle}>Ver Lista Atual</Text>
              <Text style={quickControlsStyles.featureSubtitle} numberOfLines={1}>{currentListName}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[quickControlsStyles.featureButton, quickControlsStyles.featureButtonTight, { display: 'none' }]}
            onPress={() => {
              setControlsModalOpen(false);
              void openAddToPlaylistModal();
            }}
          >
            <View style={quickControlsStyles.featureIcon}>
              <ListMusic size={19} color="#4FC3F7" />
            </View>
            <View style={quickControlsStyles.featureTextBlock}>
              <Text style={quickControlsStyles.featureTitle}>Adicionar à lista</Text>
              <Text style={quickControlsStyles.featureSubtitle} numberOfLines={1}>Enviar música atual para um repertório</Text>
            </View>
          </TouchableOpacity>
          </View>
          <View style={quickControlsStyles.section}>
          <Text style={quickControlsStyles.sectionTitle}>Exibição</Text>
          <View style={quickControlsStyles.controlGrid}>
            <TouchableOpacity style={quickControlsStyles.controlPill} onPress={() => changeFontSize(-1)}>
              <Text style={quickControlsStyles.controlPillText}>A-</Text>
            </TouchableOpacity>
            <TouchableOpacity style={quickControlsStyles.controlPill} onPress={() => changeFontSize(1)}>
              <Text style={quickControlsStyles.controlPillText}>A+</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[quickControlsStyles.controlPill, quickControlsStyles.controlPillSoft]} onPress={() => setTomOpen(true)}>
              <Text style={quickControlsStyles.controlPillAccent}>{selectedTom}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[quickControlsStyles.controlPill, quickControlsStyles.controlPillWide]}
              onPress={() => setPlaylistControlsVisible((current) => !current)}
            >
              <Text style={quickControlsStyles.controlPillAccent}>
                {playlistControlsVisible ? 'Ocultar botões' : 'Mostrar botões'}
              </Text>
            </TouchableOpacity>
          </View>
          </View>
          <View style={quickControlsStyles.section}>
          <Text style={quickControlsStyles.sectionTitle}>Auto-scroll</Text>
          <View style={quickControlsStyles.autoScrollBox}>
            <View style={quickControlsStyles.autoScrollHeader}>
              <View>
                <Text style={quickControlsStyles.featureTitle}>Auto-scroll</Text>
                <Text style={quickControlsStyles.featureSubtitle}>Rolar cifra no modo Play</Text>
              </View>
              <TouchableOpacity
                style={[
                  quickControlsStyles.autoScrollCustomHeaderButton,
                  autoScrollPreset === 'custom' && quickControlsStyles.autoScrollPresetActive,
                ]}
                onPress={openCustomAutoScroll}
              >
                <Text style={[
                  quickControlsStyles.autoScrollPresetText,
                  autoScrollPreset === 'custom' && quickControlsStyles.autoScrollPresetTextActive,
                ]}>
                  Personalizado
                </Text>
                <Text style={[
                  quickControlsStyles.autoScrollPresetHint,
                  autoScrollPreset === 'custom' && quickControlsStyles.autoScrollPresetTextActive,
                ]}>
                  {customAutoScrollSpeed} px/s
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={quickControlsStyles.autoScrollSectionTitle}>Velocidade da rolagem</Text>
            <View style={quickControlsStyles.autoScrollPresetRow}>
              {AUTO_SCROLL_PRESET_OPTIONS.map((option) => {
                const selected = autoScrollPreset === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      quickControlsStyles.autoScrollPreset,
                      selected && quickControlsStyles.autoScrollPresetActive,
                    ]}
                    onPress={() => selectAutoScrollPreset(option.value)}
                  >
                    <Text style={[
                      quickControlsStyles.autoScrollPresetText,
                      selected && quickControlsStyles.autoScrollPresetTextActive,
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[
                      quickControlsStyles.autoScrollPresetHint,
                      selected && quickControlsStyles.autoScrollPresetTextActive,
                    ]}>
                      {option.speed} px/s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[
                quickControlsStyles.autoScrollPreset,
                quickControlsStyles.autoScrollCustomPreset,
                { display: 'none' },
                autoScrollPreset === 'custom' && quickControlsStyles.autoScrollPresetActive,
              ]}
              onPress={openCustomAutoScroll}
            >
              <Text style={[
                quickControlsStyles.autoScrollPresetText,
                autoScrollPreset === 'custom' && quickControlsStyles.autoScrollPresetTextActive,
              ]}>
                Personalizado
              </Text>
              <Text style={[
                quickControlsStyles.autoScrollPresetHint,
                autoScrollPreset === 'custom' && quickControlsStyles.autoScrollPresetTextActive,
              ]}>
                {customAutoScrollSpeed} px/s
              </Text>
            </TouchableOpacity>
          </View>
          </View>
          {hasAudioNote ? (
            <View style={quickControlsStyles.section}>
            <Text style={quickControlsStyles.sectionTitle}>Gravação</Text>
            <View style={quickControlsStyles.audioSection}>
              {renderAudioNotePlayer('inline')}
            </View>
            </View>
          ) : null}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={customAutoScrollOpen}
        title="Velocidade do auto-scroll"
        onClose={() => setCustomAutoScrollOpen(false)}
        maxWidth={420}
        footer={
          <>
            <TouchableOpacity
              style={quickControlsStyles.customModalCancel}
              onPress={() => setCustomAutoScrollOpen(false)}
            >
              <Text style={quickControlsStyles.customModalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={quickControlsStyles.customModalSave}
              onPress={saveCustomAutoScroll}
            >
              <Text style={quickControlsStyles.customModalSaveText}>Salvar</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={quickControlsStyles.customSpeedBox}>
          <Text style={quickControlsStyles.customSpeedLabel}>Valor em pixels por segundo</Text>
          <TextInput
            style={quickControlsStyles.customSpeedInput}
            value={customAutoScrollDraft}
            onChangeText={(value: string) => {
              setCustomAutoScrollDraft(value.replace(/[^0-9.,]/g, ''));
              if (customAutoScrollError) setCustomAutoScrollError('');
            }}
            keyboardType="numeric"
            placeholder="Ex: 35 px/s"
            placeholderTextColor="var(--app-muted-text)"
          />
          <Text style={quickControlsStyles.customSpeedHint}>
            Minimo {MIN_CUSTOM_AUTO_SCROLL_SPEED} px/s. Maximo {MAX_CUSTOM_AUTO_SCROLL_SPEED} px/s.
          </Text>
          {customAutoScrollError ? (
            <Text style={quickControlsStyles.customSpeedError}>{customAutoScrollError}</Text>
          ) : null}
        </View>
      </AppModal>

      <AppModal
        visible={listModalOpen}
        title={currentListName}
        onClose={() => setListModalOpen(false)}
        icon={<ListMusic size={16} color="var(--app-accent)" />}
        maxWidth={520}
        footer={
          <TouchableOpacity onPress={() => setListModalOpen(false)}>
            <Text style={{ color: 'var(--app-muted-text)', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingBottom: 8 }}>
            <FlatList<Song>
              data={currentSongList}
              keyExtractor={(item: Song) => item.id}
              style={{ maxHeight: 320, paddingHorizontal: 12 }}
              renderItem={({ item, index }: { item: Song; index: number }) => (
                <TouchableOpacity
                  style={[
                    quickControlsStyles.listSongRow,
                    index === currentSongIndex && quickControlsStyles.listSongRowActive,
                  ]}
                  onPress={() => navigateToIndex(index)}
                >
                  <Text style={[quickControlsStyles.listSongIndex, index === currentSongIndex && quickControlsStyles.listSongIndexActive]}>
                    {index + 1}
                  </Text>
                  <View style={quickControlsStyles.listSongTextBlock}>
                    <Text style={[quickControlsStyles.listSongTitle, index === currentSongIndex && quickControlsStyles.listSongTitleActive]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={quickControlsStyles.listSongArtist} numberOfLines={1}>{item.artist || 'Sem artista'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.settingsEmptyText}>Nenhuma música na lista atual.</Text>}
            />
        </ScrollView>
      </AppModal>

      <AppModal
        visible={addToPlaylistOpen}
        title="Adicionar à lista"
        onClose={closeAddToPlaylistModal}
        icon={<ListMusic size={16} color="#ffd166" />}
        maxWidth={520}
        footer={
          <TouchableOpacity onPress={closeAddToPlaylistModal}>
            <Text style={{ color: 'var(--app-muted-text)', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <View style={[styles.search, { marginHorizontal: 0, marginBottom: 10 }]}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.inputSearch}
            placeholder="Buscar lista..."
            placeholderTextColor="#666"
            value={addToPlaylistSearch}
            onChangeText={setAddToPlaylistSearch}
            autoFocus
          />
        </View>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 10 }}>
          {visibleAddToPlaylistOptions.length ? (
            visibleAddToPlaylistOptions.map((playlist) => {
              const alreadyAdded = playlistAlreadyHasSong(playlist);
              const isAdding = addingToPlaylistId === playlist.id;
              const isRemoving = removingFromPlaylistId === playlist.id;
              return (
                <TouchableOpacity
                  key={playlist.id}
                  style={[
                    quickControlsStyles.addToPlaylistRow,
                    alreadyAdded && quickControlsStyles.addToPlaylistRowDisabled,
                  ]}
                  disabled={!!addingToPlaylistId || !!removingFromPlaylistId}
                  onPress={() => void addCurrentSongToPlaylist(playlist)}
                >
                  <View style={quickControlsStyles.featureIcon}>
                    <ListMusic size={17} color={alreadyAdded ? 'var(--app-muted-text)' : '#ffd166'} />
                  </View>
                  <View style={quickControlsStyles.featureTextBlock}>
                    <Text
                      style={[
                        quickControlsStyles.featureTitle,
                        alreadyAdded && quickControlsStyles.addToPlaylistTextMuted,
                      ]}
                      numberOfLines={1}
                    >
                      {playlist.name}
                    </Text>
                    <Text style={quickControlsStyles.featureSubtitle} numberOfLines={1}>
                      {getAddToPlaylistSubtitle(playlist)}
                    </Text>
                  </View>
                  <View style={quickControlsStyles.addToPlaylistStatus}>
                    <Text style={[
                      quickControlsStyles.addToPlaylistStatusText,
                      alreadyAdded && quickControlsStyles.addToPlaylistStatusDone,
                    ]}>
                      {alreadyAdded ? 'Já está nesta lista' : isAdding ? 'Adicionando...' : 'Adicionar'}
                    </Text>
                    {alreadyAdded ? (
                      <TouchableOpacity
                        style={quickControlsStyles.removeFromPlaylistButton}
                        disabled={isRemoving}
                        onPress={() => void removeCurrentSongFromPlaylist(playlist)}
                      >
                        <Text style={quickControlsStyles.removeFromPlaylistText}>
                          {isRemoving ? 'Retirando...' : 'Retirar'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={[styles.subtitle, { marginTop: 6 }]}>Nenhuma lista encontrada.</Text>
          )}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={tomOpen}
        title="Selecionar tom"
        onClose={() => setTomOpen(false)}
        maxWidth={420}
        footer={
          <TouchableOpacity onPress={() => setTomOpen(false)}>
            <Text style={{ color: 'var(--app-muted-text)', fontWeight: '800' }}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {keyOptions.map((key) => (
            <TouchableOpacity
              key={key}
              style={{
                borderWidth: 1,
                borderColor: selectedTom === key ? 'var(--app-accent)' : 'var(--app-border-soft)',
                borderRadius: 8,
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: selectedTom === key ? 'var(--app-accent-soft)' : 'var(--app-surface-alt)',
              }}
              onPress={() => {
                setSelectedTom(key);
                setTomOpen(false);
              }}
            >
              <Text style={{ color: selectedTom === key ? 'var(--app-accent)' : 'var(--app-text)', fontWeight: '800' }}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AppModal>
    </View>
  );
}

const getPerformanceNoteCardStyle = (
  position: { x: number; y: number },
  dragging: boolean,
  boxSize: PerformanceNoteBoxSize,
  color: PerformanceNoteColor
): CSSProperties => ({
  width: boxSize.width,
  height: boxSize.height,
  position: 'absolute',
  left: position.x,
  top: position.y,
  zIndex: 40,
  maxWidth: 'calc(100vw - 24px)',
  borderRadius: 10,
  border: `1px solid ${PERFORMANCE_NOTE_COLORS[color].border}`,
  background: PERFORMANCE_NOTE_COLORS[color].background,
  boxShadow: dragging
    ? '0 18px 36px rgba(0, 0, 0, 0.36)'
    : '0 12px 24px rgba(0, 0, 0, 0.26)',
  padding: '14px 14px 16px',
  color: PERFORMANCE_NOTE_COLORS[color].text,
  cursor: dragging ? 'grabbing' : 'grab',
  touchAction: 'none',
  userSelect: 'none',
  pointerEvents: 'auto',
  transform: dragging ? 'rotate(-1deg) scale(1.015)' : 'rotate(-1deg)',
  transition: dragging ? 'none' : 'box-shadow 140ms ease, transform 140ms ease',
});

const getPerformanceNoteOverlayStyle = (top: number, bottom: number): CSSProperties => ({
  position: 'fixed',
  top,
  left: 0,
  right: 0,
  bottom,
  zIndex: 39,
  pointerEvents: 'none',
  overflow: 'hidden',
});

const getPerformanceNoteTextareaStyle = (
  boxSize: PerformanceNoteBoxSize,
  color: PerformanceNoteColor
): CSSProperties => ({
  width: '100%',
  minHeight: Math.max(56, boxSize.height - 86),
  border: 'none',
  outline: 'none',
  resize: 'none',
  background: 'rgba(255, 255, 255, 0.2)',
  borderRadius: 8,
  color: PERFORMANCE_NOTE_COLORS[color].text,
  fontSize: 13,
  lineHeight: '18px',
  fontWeight: '700',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  padding: '8px 9px',
});

const getColorButtonStyle = (
  color: PerformanceNoteColor,
  selectedColor: PerformanceNoteColor
): CSSProperties => ({
  width: 22,
  height: 22,
  borderRadius: 999,
  border: color === selectedColor ? `2px solid ${PERFORMANCE_NOTE_COLORS[color].accent}` : '1px solid rgba(0,0,0,0.18)',
  background: PERFORMANCE_NOTE_COLORS[color].background,
  cursor: 'pointer',
  padding: 0,
});

const getAudioNotePlayerStyle = (controlsVisible: boolean): CSSProperties => ({
  position: 'fixed',
  left: 12,
  right: 12,
  bottom: controlsVisible ? 84 : 14,
  zIndex: 28,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 62,
  borderRadius: 14,
  border: '1px solid var(--app-border-soft)',
  background: 'var(--app-surface)',
  boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
  padding: '10px 12px',
  boxSizing: 'border-box',
});

const audioNotePlayerStyles = {
  inlineRoot: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 62,
    borderRadius: 14,
    border: '1px solid var(--app-border-soft)',
    background: 'var(--app-surface)',
    padding: '10px 12px',
    boxSizing: 'border-box',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    border: '1px solid var(--app-border-soft)',
    background: 'var(--app-header)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '900',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  time: {
    color: 'var(--app-muted-text)',
    fontSize: 11,
    fontWeight: '800',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  progressWrap: {
    position: 'relative',
    height: 20,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8,
    height: 5,
    borderRadius: 999,
    background: 'var(--app-surface-alt)',
    overflow: 'hidden',
    border: '1px solid var(--app-border-soft)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: 'var(--app-accent)',
  },
  range: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    width: '100%',
    height: 20,
    opacity: 0,
    cursor: 'pointer',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 12,
    border: '1px solid var(--app-border-soft)',
    background: 'var(--app-surface-alt)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },
} satisfies Record<string, CSSProperties>;

const playlistSwipeIndicatorStyles = {
  container: {
    position: 'fixed',
    left: '50%',
    bottom: 14,
    zIndex: 24,
    transform: 'translateX(-50%)',
    width: 'auto',
    maxWidth: 'calc(100vw - 24px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    pointerEvents: 'auto',
  },
  pill: {
    minHeight: 34,
    maxWidth: 'min(46vw, 260px)',
    borderRadius: 999,
    border: '1px solid var(--app-border-soft)',
    background: 'var(--app-header)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.24)',
    padding: '7px 11px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--app-text)',
    cursor: 'pointer',
  },
  label: {
    color: 'var(--app-accent)',
    fontSize: 11,
    lineHeight: '14px',
    fontWeight: '900',
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  song: {
    color: 'var(--app-text)',
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: '900',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
    minWidth: 0,
  },
  endText: {
    minHeight: 34,
    borderRadius: 999,
    border: '1px solid var(--app-border-soft)',
    background: 'var(--app-header)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.24)',
    padding: '8px 14px',
    color: 'var(--app-text-muted)',
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: '900',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
  },
} satisfies Record<string, CSSProperties>;

const performanceNoteStyles = {
  root: {
    position: 'relative',
  },
  pin: {
    position: 'absolute',
    top: 8,
    left: '50%',
    width: 34,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(120, 82, 12, 0.18)',
    transform: 'translateX(-50%)',
  },
  closeButton: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    border: '1px solid rgba(95, 67, 0, 0.22)',
    background: 'rgba(255, 255, 255, 0.38)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
  },
  menuButton: {
    position: 'absolute',
    top: 7,
    right: 36,
    width: 24,
    height: 24,
    borderRadius: 12,
    border: '1px solid rgba(95, 67, 0, 0.22)',
    background: 'rgba(255, 255, 255, 0.38)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
  },
  menu: {
    position: 'absolute',
    top: 36,
    right: 8,
    zIndex: 2,
    width: 186,
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.14)',
    background: 'rgba(255,255,255,0.88)',
    boxShadow: '0 12px 22px rgba(0,0,0,0.22)',
    padding: 10,
  },
  menuTitle: {
    color: '#3d2a03',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  colorRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 7,
    marginBottom: 10,
  },
  deleteButton: {
    width: '100%',
    minHeight: 32,
    borderRadius: 8,
    border: '1px solid rgba(153,27,27,0.18)',
    background: 'rgba(254,226,226,0.78)',
    color: '#991b1b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    fontSize: 12,
    fontWeight: '900',
    cursor: 'pointer',
  },
  noteHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    paddingRight: 24,
    marginTop: 4,
    marginBottom: 8,
    cursor: 'grab',
    touchAction: 'none',
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
    border: '1px solid rgba(95, 67, 0, 0.18)',
    flexShrink: 0,
  },
  label: {
    color: '#5f4300',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  noteFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  autosaveStatus: {
    color: '#5f4300',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    opacity: 0.72,
  },
  resizeHandle: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRight: '3px solid rgba(95, 67, 0, 0.34)',
    borderBottom: '3px solid rgba(95, 67, 0, 0.34)',
    borderRadius: 3,
    cursor: 'nwse-resize',
    touchAction: 'none',
  },
} satisfies Record<string, CSSProperties>;

const metronomeStyles = StyleSheet.create({
  songHeader: {
    paddingTop: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  songHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  songTitle: {
    marginHorizontal: 0,
    marginBottom: 6,
  },
  genreBadge: {
    marginHorizontal: 0,
    marginBottom: 8,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  indicator: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorDisabled: {
    opacity: 0.48,
    backgroundColor: 'var(--app-surface-alt)',
  },
  visualIndicatorActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  soundIndicatorActive: {
    borderColor: SOUND_INDICATOR_COLOR,
    backgroundColor: SOUND_INDICATOR_COLOR,
  },
  indicatorPulse: {
    transform: [{ scale: 1.06 }],
    backgroundColor: 'var(--app-accent)',
  },
  indicatorStrongPulse: {
    transform: [{ scale: 1.15 }],
    backgroundColor: 'var(--app-accent)',
    borderColor: 'var(--app-accent)',
  },
  soundStrongPulse: {
    transform: [{ scale: 1.1 }],
  },
  innerMark: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'var(--app-accent)',
    opacity: 0.85,
  },
});

const playHeaderStyles = StyleSheet.create({
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'var(--app-header)',
    borderBottomWidth: 1,
    borderBottomColor: 'var(--app-border-soft)',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoScrollButton: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  autoScrollButtonActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  autoScrollText: {
    color: 'var(--app-accent)',
    fontSize: 11,
    fontWeight: '900',
  },
});

const quickControlsStyles = StyleSheet.create({
  scrollBody: {
    maxHeight: '72vh',
    minHeight: 0,
  },
  body: {
    paddingHorizontal: 4,
    paddingBottom: 12,
    gap: 10,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'rgba(255,255,255,0.015)',
    padding: 9,
    gap: 8,
  },
  sectionTitle: {
    color: 'var(--app-muted-text)',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navButtonPrimary: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  navButtonText: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.46,
  },
  disabledText: {
    color: 'var(--app-muted-text)',
  },
  featureButton: {
    minHeight: 54,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureButtonTight: {
    minHeight: 48,
    paddingVertical: 8,
  },
  featureButtonAccent: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  compactFeatureButton: {
    flex: 1,
    minWidth: 190,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconAccent: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent)',
  },
  featureTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  featureTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  featureSubtitle: {
    color: 'var(--app-subtle-text)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  controlGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  controlPill: {
    flexGrow: 1,
    minWidth: 68,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPillSoft: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  controlPillWide: {
    flexBasis: 132,
    minWidth: 118,
  },
  controlPillText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  controlPillAccent: {
    color: 'var(--app-accent)',
    fontSize: 13,
    fontWeight: '900',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  autoScrollBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  autoScrollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  autoScrollCustomHeaderButton: {
    minWidth: 128,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  autoScrollToggle: {
    minWidth: 86,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  autoScrollToggleActive: {
    backgroundColor: 'var(--app-header)',
  },
  autoScrollToggleText: {
    color: 'var(--app-accent)',
    fontSize: 13,
    fontWeight: '900',
  },
  autoScrollSectionTitle: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
  },
  autoScrollPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  autoScrollPreset: {
    flexGrow: 1,
    flexBasis: 92,
    minWidth: 82,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  autoScrollPresetActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  autoScrollCustomPreset: {
    flexBasis: 'auto',
    width: '100%',
    minHeight: 42,
  },
  autoScrollPresetText: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '900',
  },
  autoScrollPresetHint: {
    color: 'var(--app-muted-text)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  autoScrollPresetTextActive: {
    color: 'var(--app-accent)',
  },
  customSpeedBox: {
    gap: 8,
  },
  customSpeedLabel: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  customSpeedInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    color: 'var(--app-text)',
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '800',
    outlineStyle: 'none',
  },
  customSpeedHint: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '700',
  },
  customSpeedError: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '800',
  },
  customModalCancel: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customModalCancelText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  customModalSave: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: 'var(--app-accent)',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customModalSaveText: {
    color: '#051014',
    fontSize: 13,
    fontWeight: '900',
  },
  audioSection: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    padding: 8,
  },
  listSongRow: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listSongRowActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  listSongIndex: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 24,
    flexShrink: 0,
  },
  listSongIndexActive: {
    borderColor: 'var(--app-accent)',
    color: 'var(--app-accent)',
  },
  listSongTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  listSongTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  listSongTitleActive: {
    color: 'var(--app-accent)',
  },
  listSongArtist: {
    color: 'var(--app-muted-text)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  addToPlaylistRow: {
    minHeight: 58,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addToPlaylistRowDisabled: {
    opacity: 0.72,
    backgroundColor: 'var(--app-header)',
  },
  addToPlaylistTextMuted: {
    color: 'var(--app-muted-text)',
  },
  addToPlaylistStatus: {
    minWidth: 96,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    gap: 2,
  },
  addToPlaylistStatusText: {
    color: 'var(--app-accent)',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  addToPlaylistStatusDone: {
    color: 'var(--app-muted-text)',
  },
  removeFromPlaylistButton: {
    minHeight: 20,
    borderRadius: 999,
    paddingHorizontal: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  removeFromPlaylistText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '900',
  },
});
