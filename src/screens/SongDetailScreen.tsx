import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ChevronLeft, ChevronRight, HelpCircle, ListMusic, Menu, Mic, MoreHorizontal, Pause, Pencil, Play, StickyNote, Volume2, X } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { MetronomeIndicators } from './SongDetail/components/MetronomeIndicators';
import { SongBottomToolbar } from './SongDetail/components/SongBottomToolbar';
import { CurrentPlaylistModal } from './SongDetail/components/CurrentPlaylistModal';
import { QuickControlsModal } from './SongDetail/components/QuickControlsModal';
import { HelpModeOverlay } from './SongDetail/components/HelpModeOverlay';
import { RecordingMiniPlayer } from './SongDetail/components/RecordingMiniPlayer';
import { PlayModeHeader } from './SongDetail/components/PlayModeHeader';
import { PerformanceNote } from './SongDetail/components/PerformanceNote';
import { YoutubeOptionsModal } from './SongDetail/components/YoutubeOptionsModal';
import { SongLyricsBlock } from './SongDetail/components/SongLyricsBlock';
import { SongObservationBlock } from './SongDetail/components/SongObservationBlock';
import { TomSelectorModal } from './SongDetail/components/TomSelectorModal';
import { useAddToPlaylist } from './SongDetail/hooks/useAddToPlaylist';
import { useCurrentPlaylistData } from './SongDetail/hooks/useCurrentPlaylistData';
import { PlaylistPickerModal } from '../components/modals/PlaylistPickerModal';
import { useGenreFilter } from '../contexts/GenreFilterContext';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { usePlayback } from '../contexts/PlaybackContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTopBarControls } from '../contexts/TopBarContext';
import { useKeepAwake } from '../hooks/useKeepAwake';
import { useStageKeyboardControls } from '../hooks/useStageKeyboardControls';
import { useDevScreenPerformance } from '../utils/devPerformance';
import { transposeContent } from '../lib/chords';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import type { PerformanceNoteBoxSize, PerformanceNoteColor, PerformanceNotePosition, Song } from '../types/models';
import { detectTomFromContent, formatKeyForSpellingMode, getKeyOptionsForSpellingMode, getTransposeBetweenKeys, normalizeMusicKey, type MusicKey } from '../utils/chordKeys';
import { getSongGenreDisplay, matchesGenreFilter } from '../utils/genres';

const DEFAULT_METRONOME_BPM = 120;
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
const AUTO_SCROLL_MANUAL_PAUSE_MS = 900;
const AUTO_SCROLL_MANUAL_RELEASE_SYNC_MS = 150;
const AUTO_SCROLL_INTERACTION_DEBUG = false;

const YoutubeBadgeIcon = ({ active, size = 22 }: { active: boolean; size?: number }) => (
  <Play size={size} color={active ? '#fff' : 'var(--app-muted-text)'} fill={active ? '#fff' : 'transparent'} />
);

const SONG_DETAIL_HELP_ITEMS = {
  intro: {
    title: 'Modo ajuda',
    description: 'Toque nos botoes destacados para entender o que cada um faz. Durante a ajuda, nenhuma acao real e executada.',
    icon: <HelpCircle size={18} color="var(--app-accent)" />,
  },
  help: {
    title: 'Ajuda da musica',
    description: 'Ativa uma camada contextual para explorar os controles da cifra sem mudar nada na musica.',
    icon: <HelpCircle size={18} color="var(--app-accent)" />,
  },
  headerMenu: {
    title: 'Menu lateral',
    description: 'Abre o menu do aplicativo com musicas, pastas/listas, importacao, backup e configuracoes.',
    icon: <Menu size={18} color="var(--app-accent)" />,
  },
  headerBack: {
    title: 'Voltar',
    description: 'Retorna para a tela anterior mantendo o contexto de navegacao.',
    icon: <ChevronLeft size={18} color="var(--app-accent)" />,
  },
  headerControls: {
    title: 'Mostrar/Ocultar barra',
    description: 'Mostra ou esconde os controles inferiores para deixar a cifra mais limpa.',
    icon: <Text style={{ color: 'var(--app-accent)', fontWeight: '900', fontSize: 13 }}>Olho</Text>,
  },
  play: {
    title: 'Modo Play',
    description: 'Abre a visualizacao de apresentacao, com cifra em foco, header compacto, swipe de lista e auto-scroll.',
    icon: <Play size={18} color="var(--app-accent)" />,
  },
  audio: {
    title: 'Gravacao de referencia',
    description: 'Toca ou pausa o audio salvo nesta musica para lembrar entrada, melodia, ritmo ou conducao.',
    icon: <Mic size={18} color="var(--app-accent)" />,
  },
  audioPlayer: {
    title: 'Mini player',
    description: 'Controla a gravacao de referencia, mostrando tempo, progresso e atalhos de reproducao.',
    icon: <Pause size={18} color="var(--app-accent)" />,
  },
  fontDown: {
    title: 'Diminuir fonte',
    description: 'Reduz o tamanho da cifra para caber mais conteudo na tela.',
    icon: <Text style={{ color: 'var(--app-accent)', fontWeight: '900', fontSize: 13 }}>A-</Text>,
  },
  fontUp: {
    title: 'Aumentar fonte',
    description: 'Aumenta o tamanho da cifra para melhorar a leitura no ensaio ou no palco.',
    icon: <Text style={{ color: 'var(--app-accent)', fontWeight: '900', fontSize: 13 }}>A+</Text>,
  },
  key: {
    title: 'Tom atual',
    description: 'Abre a selecao de tom para transpor a cifra visualmente.',
    icon: <Text style={{ color: 'var(--app-accent)', fontWeight: '900', fontSize: 13 }}>Tom</Text>,
  },
  addToPlaylist: {
    title: 'Adicionar a lista',
    description: 'Envia a musica atual para uma lista existente, sem duplicar quando ela ja estiver no repertorio.',
    icon: <ListMusic size={18} color="var(--app-accent)" />,
  },
  youtube: {
    title: 'Link do YouTube',
    description: 'Abre opcoes do YouTube da musica: abrir no YouTube, copiar o link ou usar player interno quando disponivel.',
    icon: <YoutubeBadgeIcon active size={18} />,
  },
  postIt: {
    title: 'Post-it musical',
    description: 'Abre uma anotacao flutuante com autosave para lembretes de entrada, pausas, solos ou combinados.',
    icon: <StickyNote size={18} color="var(--app-accent)" />,
  },
  edit: {
    title: 'Editar musica',
    description: 'Abre o editor para alterar titulo, artista, cifra, generos, metronomo, fonte e gravacao.',
    icon: <Pencil size={18} color="var(--app-accent)" />,
  },
  quickControls: {
    title: 'Controles Rapidos',
    description: 'Reune navegacao, lista atual, exibicao e auto-scroll durante o modo Play.',
    icon: <Menu size={18} color="var(--app-accent)" />,
  },
  autoScroll: {
    title: 'Auto-scroll',
    description: 'Rola a cifra automaticamente no modo Play usando a velocidade selecionada. O gesto manual continua sendo respeitado.',
    icon: <Play size={18} color="var(--app-accent)" />,
  },
  exitPlay: {
    title: 'Sair do Play',
    description: 'Fecha o modo de apresentacao e volta para a tela normal da musica.',
    icon: <X size={18} color="var(--app-accent)" />,
  },
  swipe: {
    title: 'Swipe da lista',
    description: 'Quando a musica vem de uma lista, deslize horizontalmente para navegar para anterior ou proxima.',
    icon: <ChevronRight size={18} color="var(--app-accent)" />,
  },
  metronomeVisual: {
    title: 'Pulso visual',
    description: 'Liga ou desliga o indicador visual do metronomo configurado para esta musica.',
    icon: <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'var(--app-accent)' }} />,
  },
  metronomeSound: {
    title: 'Beep sonoro',
    description: 'Liga ou desliga o som do metronomo. O audio pode depender de uma interacao do usuario.',
    icon: <Volume2 size={18} color="var(--app-accent)" />,
  },
  noteMenu: {
    title: 'Opcoes do post-it',
    description: 'Permite trocar a cor ou excluir a anotacao musical salva para esta musica.',
    icon: <MoreHorizontal size={18} color="var(--app-accent)" />,
  },
  noteHide: {
    title: 'Ocultar post-it',
    description: 'Esconde o post-it sem apagar o texto salvo.',
    icon: <X size={18} color="var(--app-accent)" />,
  },
  noteDrag: {
    title: 'Mover post-it',
    description: 'Arraste o topo do post-it para reposicionar a anotacao na tela.',
    icon: <StickyNote size={18} color="var(--app-accent)" />,
  },
  noteResize: {
    title: 'Redimensionar post-it',
    description: 'Use a alca inferior para ajustar o tamanho da anotacao.',
    icon: <StickyNote size={18} color="var(--app-accent)" />,
  },
} as const;
type SongDetailHelpTarget = keyof typeof SONG_DETAIL_HELP_ITEMS;
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
  useDevScreenPerformance('SongDetail');
  const nav = useManualNavigation();
  const { globalFilters } = useGenreFilter();
  const { isPlaying, startPlaying, stopPlaying } = usePlayback();
  const { displaySettings: settings, favoriteMode } = useSettings();
  const { setTopBarControls, clearTopBarControls } = useTopBarControls();
  useKeepAwake(true);
  const [song, setSong] = useState<Song | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [controlsModalOpen, setControlsModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [helpMode, setHelpMode] = useState(false);
  const [activeHelpTarget, setActiveHelpTarget] = useState<SongDetailHelpTarget | null>(null);
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const [youtubeLinkCopied, setYoutubeLinkCopied] = useState(false);
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
  const autoScrollManualPauseUntilRef = useRef(0);
  const autoScrollManualPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollManualReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollUserInteractingRef = useRef(false);
  const chordSpellingMode = settings.chordSpellingMode ?? 'mixed';
  const keyOptions = getKeyOptionsForSpellingMode(chordSpellingMode);
  const activeHelpItem = activeHelpTarget ? SONG_DETAIL_HELP_ITEMS[activeHelpTarget] : null;
  const addToPlaylist = useAddToPlaylist({ song, favoriteMode });
  const {
    currentSongList,
    currentListName,
    currentSongIndex,
    previousPlaylistIndex,
    nextPlaylistIndex,
    previousPlaylistSong,
    nextPlaylistSong,
    previousDisabled,
    nextDisabled,
  } = useCurrentPlaylistData({
    id,
    allSongs,
    filteredSongs,
    sourcePlaylistId,
    sourcePlaylistName,
  });

  const showHelp = useCallback((target: SongDetailHelpTarget) => {
    setActiveHelpTarget(target);
  }, []);

  const enterHelpMode = useCallback(() => {
    setControlsModalOpen(false);
    setListModalOpen(false);
    addToPlaylist.closeModal();
    setYoutubeModalOpen(false);
    setTomOpen(false);
    setCustomAutoScrollOpen(false);
    setNoteMenuOpen(false);
    setHelpMode(true);
    setActiveHelpTarget('intro');
  }, [addToPlaylist.closeModal]);

  const exitHelpMode = useCallback(() => {
    setHelpMode(false);
    setActiveHelpTarget(null);
  }, []);

  const runOrExplain = useCallback((target: SongDetailHelpTarget, action: () => void) => {
    if (helpMode) {
      showHelp(target);
      return;
    }
    action();
  }, [helpMode, showHelp]);

  const getHelpHighlightStyle = (target: SongDetailHelpTarget) => {
    if (!helpMode) return null;
    return activeHelpTarget === target ? helpStyles.helpableActive : helpStyles.helpable;
  };

  const getHelpDomHighlightStyle = (target: SongDetailHelpTarget): CSSProperties | undefined => {
    if (!helpMode) return undefined;
    return activeHelpTarget === target ? helpDomStyles.helpableActive : helpDomStyles.helpable;
  };

  useEffect(() => {
    setTopBarControls({
      headerTitle: song?.title || 'Música',
      headerSubtitle: song?.artist || undefined,
      songDetailHelp: {
        active: helpMode,
        onToggle: helpMode ? exitHelpMode : enterHelpMode,
        onExplain: showHelp,
      },
    });

    return clearTopBarControls;
  }, [clearTopBarControls, enterHelpMode, exitHelpMode, helpMode, setTopBarControls, showHelp, song?.artist, song?.title]);

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
    if (autoScrollManualPauseTimerRef.current) {
      clearTimeout(autoScrollManualPauseTimerRef.current);
      autoScrollManualPauseTimerRef.current = null;
    }
    if (autoScrollManualReleaseTimerRef.current) {
      clearTimeout(autoScrollManualReleaseTimerRef.current);
      autoScrollManualReleaseTimerRef.current = null;
    }
    autoScrollLastTimestampRef.current = null;
    autoScrollManualPauseUntilRef.current = 0;
    autoScrollUserInteractingRef.current = false;
    setAutoScrollEnabled(false);
  }, []);

  const runAutoScrollFrame = useCallback((timestamp: number) => {
    if (!autoScrollEnabledRef.current || !isPlaying || typeof window === 'undefined') {
      stopAutoScroll();
      return;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : timestamp;
    if (autoScrollUserInteractingRef.current || now < autoScrollManualPauseUntilRef.current) {
      autoScrollPositionRef.current = window.scrollY;
      scrollPosRef.current = window.scrollY;
      autoScrollLastTimestampRef.current = null;
      if (AUTO_SCROLL_INTERACTION_DEBUG) {
        console.log('[auto-scroll-manual-skip]', {
          scrollY: window.scrollY,
          position: autoScrollPositionRef.current,
          userInteracting: autoScrollUserInteractingRef.current,
          pauseUntil: autoScrollManualPauseUntilRef.current,
        });
      }
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScrollFrame);
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

  const syncAutoScrollToWindowPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    autoScrollPositionRef.current = window.scrollY;
    scrollPosRef.current = window.scrollY;
    autoScrollLastTimestampRef.current = null;
  }, []);

  const extendManualAutoScrollPause = useCallback(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    autoScrollManualPauseUntilRef.current = now + AUTO_SCROLL_MANUAL_PAUSE_MS;

    if (autoScrollManualPauseTimerRef.current) {
      clearTimeout(autoScrollManualPauseTimerRef.current);
    }
    autoScrollManualPauseTimerRef.current = setTimeout(() => {
      autoScrollManualPauseTimerRef.current = null;
      syncAutoScrollToWindowPosition();
    }, AUTO_SCROLL_MANUAL_PAUSE_MS);
  }, [syncAutoScrollToWindowPosition]);

  const beginManualAutoScrollInteraction = useCallback((event: Event) => {
    if (!autoScrollEnabledRef.current) return;
    if (shouldIgnoreAutoScrollInteraction(event.target)) return;
    autoScrollUserInteractingRef.current = true;
    extendManualAutoScrollPause();
    syncAutoScrollToWindowPosition();
    if (AUTO_SCROLL_INTERACTION_DEBUG && typeof window !== 'undefined') {
      console.log('[auto-scroll-manual-begin]', {
        type: event.type,
        scrollY: window.scrollY,
        position: autoScrollPositionRef.current,
        lastTimestamp: autoScrollLastTimestampRef.current,
        pauseUntil: autoScrollManualPauseUntilRef.current,
      });
    }
  }, [extendManualAutoScrollPause, shouldIgnoreAutoScrollInteraction, syncAutoScrollToWindowPosition]);

  const finishManualAutoScrollInteraction = useCallback((event: Event) => {
    if (!autoScrollEnabledRef.current) return;
    if (shouldIgnoreAutoScrollInteraction(event.target)) return;
    extendManualAutoScrollPause();

    if (autoScrollManualReleaseTimerRef.current) {
      clearTimeout(autoScrollManualReleaseTimerRef.current);
    }
    autoScrollManualReleaseTimerRef.current = setTimeout(() => {
      autoScrollManualReleaseTimerRef.current = null;
      syncAutoScrollToWindowPosition();
      autoScrollUserInteractingRef.current = false;
      extendManualAutoScrollPause();
      if (AUTO_SCROLL_INTERACTION_DEBUG && typeof window !== 'undefined') {
        console.log('[auto-scroll-manual-finish]', {
          type: event.type,
          scrollY: window.scrollY,
          position: autoScrollPositionRef.current,
          lastTimestamp: autoScrollLastTimestampRef.current,
          pauseUntil: autoScrollManualPauseUntilRef.current,
        });
      }
    }, AUTO_SCROLL_MANUAL_RELEASE_SYNC_MS);
  }, [extendManualAutoScrollPause, shouldIgnoreAutoScrollInteraction, syncAutoScrollToWindowPosition]);

  const syncAutoScrollFromScrollEvent = useCallback((event: Event) => {
    if (!autoScrollEnabledRef.current || autoScrollProgrammaticRef.current) return;
    if (shouldIgnoreAutoScrollInteraction(event.target)) return;
    syncAutoScrollToWindowPosition();
    if (AUTO_SCROLL_INTERACTION_DEBUG && typeof window !== 'undefined') {
      console.log('[auto-scroll-manual-scroll]', {
        scrollY: window.scrollY,
        position: autoScrollPositionRef.current,
        lastTimestamp: autoScrollLastTimestampRef.current,
      });
    }
  }, [shouldIgnoreAutoScrollInteraction, syncAutoScrollToWindowPosition]);

  useEffect(() => {
    autoScrollSpeedRef.current = getAutoScrollPresetSpeed(autoScrollPreset, customAutoScrollSpeed);
  }, [autoScrollPreset, customAutoScrollSpeed]);

  useEffect(() => {
    if (!isPlaying) stopAutoScroll();
  }, [isPlaying, stopAutoScroll]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const options: AddEventListenerOptions = { passive: true };
    window.addEventListener('wheel', beginManualAutoScrollInteraction, options);
    window.addEventListener('touchstart', beginManualAutoScrollInteraction, options);
    window.addEventListener('touchmove', beginManualAutoScrollInteraction, options);
    window.addEventListener('touchend', finishManualAutoScrollInteraction, options);
    window.addEventListener('touchcancel', finishManualAutoScrollInteraction, options);
    window.addEventListener('pointerdown', beginManualAutoScrollInteraction, options);
    window.addEventListener('pointerup', finishManualAutoScrollInteraction, options);
    window.addEventListener('pointercancel', finishManualAutoScrollInteraction, options);
    window.addEventListener('scroll', syncAutoScrollFromScrollEvent, options);

    return () => {
      window.removeEventListener('wheel', beginManualAutoScrollInteraction);
      window.removeEventListener('touchstart', beginManualAutoScrollInteraction);
      window.removeEventListener('touchmove', beginManualAutoScrollInteraction);
      window.removeEventListener('touchend', finishManualAutoScrollInteraction);
      window.removeEventListener('touchcancel', finishManualAutoScrollInteraction);
      window.removeEventListener('pointerdown', beginManualAutoScrollInteraction);
      window.removeEventListener('pointerup', finishManualAutoScrollInteraction);
      window.removeEventListener('pointercancel', finishManualAutoScrollInteraction);
      window.removeEventListener('scroll', syncAutoScrollFromScrollEvent);
    };
  }, [beginManualAutoScrollInteraction, finishManualAutoScrollInteraction, syncAutoScrollFromScrollEvent]);

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
    if (!song) return;
    const detected = detectTomFromContent(song.content || '', chordSpellingMode);
    const preferred = normalizeMusicKey(song.preferredKey, chordSpellingMode);
    setBaseTom(detected);
    setSelectedTom(preferred ?? detected);
  }, [song?.id, song?.content, song?.preferredKey]);

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

  const navigateToIndex = useCallback((index: number) => {
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
  }, [currentSongList, nav, returnTo, sourcePlaylistId, sourcePlaylistName]);

  const toggleStageAutoScroll = useCallback(() => {
    if (autoScrollEnabled) {
      stopAutoScroll();
      return;
    }
    startAutoScroll();
  }, [autoScrollEnabled, startAutoScroll, stopAutoScroll]);

  const navigateToNextStageSong = useCallback(() => {
    if (!nextDisabled) navigateToIndex(nextPlaylistIndex);
  }, [navigateToIndex, nextDisabled, nextPlaylistIndex]);

  const navigateToPreviousStageSong = useCallback(() => {
    if (!previousDisabled) navigateToIndex(previousPlaylistIndex);
  }, [navigateToIndex, previousDisabled, previousPlaylistIndex]);

  const closeStageKeyboardOverlay = useCallback(() => {
    if (helpMode) {
      exitHelpMode();
      return;
    }
    if (customAutoScrollOpen) {
      setCustomAutoScrollOpen(false);
      return;
    }
    if (controlsModalOpen) {
      setControlsModalOpen(false);
      return;
    }
    if (listModalOpen) {
      setListModalOpen(false);
      return;
    }
    if (addToPlaylist.open) {
      addToPlaylist.closeModal();
      return;
    }
    if (youtubeModalOpen) {
      setYoutubeModalOpen(false);
      setYoutubeLinkCopied(false);
      return;
    }
    if (tomOpen) {
      setTomOpen(false);
      return;
    }
    if (noteMenuOpen) {
      setNoteMenuOpen(false);
      return;
    }
    stopPlaying();
  }, [
    addToPlaylist.closeModal,
    addToPlaylist.open,
    controlsModalOpen,
    customAutoScrollOpen,
    exitHelpMode,
    helpMode,
    listModalOpen,
    noteMenuOpen,
    stopPlaying,
    tomOpen,
    youtubeModalOpen,
  ]);

  const stageKeyboardOverlayOpen =
    helpMode ||
    controlsModalOpen ||
    listModalOpen ||
    addToPlaylist.open ||
    youtubeModalOpen ||
    tomOpen ||
    customAutoScrollOpen ||
    noteMenuOpen;

  useStageKeyboardControls({
    enabled: true,
    isPlaying,
    overlayOpen: stageKeyboardOverlayOpen,
    canGoNext: !!sourcePlaylistId && !nextDisabled,
    canGoPrevious: !!sourcePlaylistId && !previousDisabled,
    onToggleAutoScroll: toggleStageAutoScroll,
    onNextSong: navigateToNextStageSong,
    onPreviousSong: navigateToPreviousStageSong,
    onEscape: closeStageKeyboardOverlay,
  });

  const transpose = getTransposeBetweenKeys(baseTom, selectedTom);
  const text = useMemo(
    () => (song ? transposeContent(song.content, transpose, chordSpellingMode) : ''),
    [chordSpellingMode, song?.content, transpose]
  );

  if (!song) return null;
  const playlistSwipeEnabled = isPlaying && !!sourcePlaylistId && currentSongList.length > 1;
  const showPlaylistControls = playlistSwipeEnabled && playlistControlsVisible;
  const noteOverlayTop = isPlaying ? NOTE_OVERLAY_PLAY_TOP : NOTE_OVERLAY_TOP;
  const noteOverlayBottom = isPlaying
    ? showPlaylistControls ? NOTE_OVERLAY_PLAYLIST_BOTTOM : NOTE_OVERLAY_BOTTOM
    : controlsVisible ? NOTE_OVERLAY_CONTROLS_BOTTOM : NOTE_OVERLAY_BOTTOM;
  const hasAudioNote = !!song.audioNoteBase64 && !!song.audioNoteMimeType;
  const hasPerformanceNoteDraft = noteDraft.trim().length > 0 || !!song.performanceNote?.trim();
  const songGenreDisplay = getSongGenreDisplay(song);
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

  const openYoutubeModal = () => {
    if (!song?.youtubeUrl?.trim()) return;
    setYoutubeLinkCopied(false);
    setYoutubeModalOpen(true);
  };

  const closeYoutubeModal = () => {
    setYoutubeModalOpen(false);
    setYoutubeLinkCopied(false);
  };

  const openYoutubeLink = () => {
    const url = song?.youtubeUrl?.trim();
    if (!url) return;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;
  };

  const copyYoutubeLink = async () => {
    const url = song?.youtubeUrl?.trim();
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setYoutubeLinkCopied(true);
    } catch {
      setYoutubeLinkCopied(false);
    }
  };

  const shouldIgnorePlaylistSwipeTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return !!target.closest('button, textarea, input, select, a, [data-swipe-ignore="true"]');
  };

  const beginPlaylistSwipe = (clientX: number, clientY: number, pointerId: number, target: EventTarget | null) => {
    if (helpMode) {
      if (playlistSwipeEnabled) showHelp('swipe');
      return;
    }
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

  const selectTom = (key: MusicKey) => {
    setSelectedTom(key);
    setTomOpen(false);
    setSong((current) => (current && current.id === song.id ? { ...current, preferredKey: key } : current));
    void db.updateSong(song.id, { preferredKey: key }).then((updated) => {
      if (!updated) return;
      setSong((current) => (current && current.id === updated.id ? updated : current));
    });
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
    if (helpMode) {
      event.preventDefault();
      event.stopPropagation();
      showHelp('noteDrag');
      return;
    }
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
    if (helpMode) {
      event.preventDefault();
      event.stopPropagation();
      showHelp('noteResize');
      return;
    }
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

  const renderAudioNotePlayer = (variant: 'fixed' | 'inline') => (
    <RecordingMiniPlayer
      variant={variant}
      controlsVisible={controlsVisible}
      playing={audioNotePlaying}
      currentTime={audioNoteCurrentTime}
      duration={audioNoteSafeDuration}
      progress={audioNoteProgress}
      playerHighlightStyle={getHelpDomHighlightStyle('audioPlayer')}
      audioHighlightStyle={getHelpDomHighlightStyle('audio')}
      onToggle={() => runOrExplain('audio', toggleAudioNote)}
      onSeekPointerDown={() => {
        if (helpMode) showHelp('audioPlayer');
      }}
      onSeek={(value) => {
        if (helpMode) {
          showHelp('audioPlayer');
          return;
        }
        seekAudioNote(value);
      }}
      onClose={() => runOrExplain('audioPlayer', closeAudioNotePlayer)}
    />
  );
  return (
    <View style={[styles.container, styles.songDetailContainer, performanceNoteStyles.root]}>
      {!isPlaying ? (
        <>
          <View style={songNormalTopStyles.container}>
            <View style={songNormalTopStyles.meta}>
              {songGenreDisplay ? (
                <Text style={[styles.songGenreBadge, songNormalTopStyles.genreBadge]}>{songGenreDisplay}</Text>
              ) : null}
            </View>
            <View style={songNormalTopStyles.metronome}>
              <MetronomeIndicators
                visualOn={metronomeVisualOn}
                soundOn={metronomeSoundOn}
                pulse={metronomePulse}
                onToggleVisual={() => runOrExplain('metronomeVisual', toggleMetronomeVisual)}
                onToggleSound={() => runOrExplain('metronomeSound', toggleMetronomeSound)}
                visualHighlightStyle={getHelpHighlightStyle('metronomeVisual')}
                soundHighlightStyle={getHelpHighlightStyle('metronomeSound')}
              />
            </View>
          </View>
          {song.observation?.trim() ? (
            <SongObservationBlock observation={song.observation.trim()} />
          ) : null}
        </>
      ) : (
        <PlayModeHeader
          title={song.title}
          artist={song.artist}
          titleStyle={styles.screenTitle}
          subtitleStyle={styles.subtitle}
          metronomeIndicators={(
            <MetronomeIndicators
              visualOn={metronomeVisualOn}
              soundOn={metronomeSoundOn}
              pulse={metronomePulse}
              onToggleVisual={() => runOrExplain('metronomeVisual', toggleMetronomeVisual)}
              onToggleSound={() => runOrExplain('metronomeSound', toggleMetronomeSound)}
              visualHighlightStyle={getHelpHighlightStyle('metronomeVisual')}
              soundHighlightStyle={getHelpHighlightStyle('metronomeSound')}
            />
          )}
          autoScrollEnabled={autoScrollEnabled}
          autoScrollLabel={getAutoScrollPresetLabel(autoScrollPreset, customAutoScrollSpeed)}
          autoScrollHighlightStyle={getHelpHighlightStyle('autoScroll')}
          quickControlsHighlightStyle={getHelpHighlightStyle('quickControls')}
          exitHighlightStyle={getHelpHighlightStyle('exitPlay')}
          onToggleAutoScroll={() => runOrExplain('autoScroll', autoScrollEnabled ? stopAutoScroll : startAutoScroll)}
          onOpenQuickControls={() => runOrExplain('quickControls', () => setControlsModalOpen(true))}
          onExitPlay={() => runOrExplain('exitPlay', stopPlaying)}
        />
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
        <SongLyricsBlock text={text} fontSize={fontSize} settings={settings} />
      </div>
      {showPlaylistControls ? (
        <div
          style={{
            ...playlistSwipeIndicatorStyles.container,
            ...getHelpDomHighlightStyle('swipe'),
          }}
          data-swipe-ignore="true"
        >
          {previousPlaylistSong ? (
            <button
              type="button"
              style={playlistSwipeIndicatorStyles.pill}
              onClick={() => runOrExplain('swipe', () => navigateToIndex(previousPlaylistIndex))}
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
              onClick={() => runOrExplain('swipe', () => navigateToIndex(nextPlaylistIndex))}
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
      <PerformanceNote
        visible={noteVisible}
        overlayTop={noteOverlayTop}
        overlayBottom={noteOverlayBottom}
        cardRef={noteCardRef}
        position={notePosition}
        boxSize={noteBoxSize}
        color={noteColor}
        colorKeys={NOTE_COLOR_KEYS}
        colorConfig={PERFORMANCE_NOTE_COLORS}
        dragging={noteDragging}
        resizing={noteResizing}
        menuOpen={noteMenuOpen}
        draft={noteDraft}
        readOnly={helpMode}
        saveStatus={noteSaveStatus}
        menuHighlightStyle={getHelpDomHighlightStyle('noteMenu')}
        hideHighlightStyle={getHelpDomHighlightStyle('noteHide')}
        dragHighlightStyle={getHelpDomHighlightStyle('noteDrag')}
        resizeHighlightStyle={getHelpDomHighlightStyle('noteResize')}
        onCardPointerMove={moveNoteDrag}
        onCardPointerUp={stopNoteDrag}
        onCardPointerCancel={stopNoteDrag}
        onToggleMenu={() => runOrExplain('noteMenu', () => setNoteMenuOpen((current) => !current))}
        onHide={() => runOrExplain('noteHide', hidePerformanceNote)}
        onDelete={deletePerformanceNote}
        onHeaderPointerDown={startNoteDrag}
        onTextPointerDown={() => {
          if (helpMode) showHelp('postIt');
        }}
        onTextChange={(value) => {
          if (helpMode) {
            showHelp('postIt');
            return;
          }
          changePerformanceNoteText(value);
        }}
        onSelectColor={(color) => void selectPerformanceNoteColor(color)}
        onResizePointerDown={startNoteResize}
        onResizePointerMove={moveNoteResize}
        onResizePointerUp={stopNoteResize}
        onResizePointerCancel={stopNoteResize}
      />
      {!isPlaying && audioNotePlayerVisible && hasAudioNote ? renderAudioNotePlayer('fixed') : null}
      {!isPlaying && controlsVisible ? (
        <SongBottomToolbar
          hasAudioNote={hasAudioNote}
          audioNotePlaying={audioNotePlaying}
          hasYoutubeUrl={!!song?.youtubeUrl?.trim()}
          hasPerformanceNoteDraft={hasPerformanceNoteDraft}
          selectedTom={selectedTom}
          onPlay={() => runOrExplain('play', startPlaying)}
          onAudio={() => runOrExplain('audio', toggleAudioNote)}
          onYoutube={() => runOrExplain('youtube', openYoutubeModal)}
          onFontDown={() => runOrExplain('fontDown', () => void changeFontSize(-1))}
          onFontUp={() => runOrExplain('fontUp', () => void changeFontSize(1))}
          onKey={() => runOrExplain('key', () => setTomOpen(true))}
          onAddToPlaylist={() => runOrExplain('addToPlaylist', () => void addToPlaylist.openModal())}
          onPostIt={() => runOrExplain('postIt', openPerformanceNote)}
          onEdit={() => runOrExplain('edit', openEditor)}
          playHighlightStyle={getHelpHighlightStyle('play')}
          audioHighlightStyle={getHelpHighlightStyle('audio')}
          youtubeHighlightStyle={getHelpHighlightStyle('youtube')}
          fontDownHighlightStyle={getHelpHighlightStyle('fontDown')}
          fontUpHighlightStyle={getHelpHighlightStyle('fontUp')}
          keyHighlightStyle={getHelpHighlightStyle('key')}
          addToPlaylistHighlightStyle={getHelpHighlightStyle('addToPlaylist')}
          postItHighlightStyle={getHelpHighlightStyle('postIt')}
          editHighlightStyle={getHelpHighlightStyle('edit')}
        />
      ) : null}

      <HelpModeOverlay
        visible={helpMode}
        activeItem={activeHelpItem}
        onDismissItem={() => setActiveHelpTarget(null)}
      />

      {isPlaying ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={helpMode ? 'Sair da ajuda da tela' : 'Ativar ajuda da tela'}
          onPress={helpMode ? exitHelpMode : enterHelpMode}
          style={[
            helpStyles.floatingHelpButton,
            helpStyles.floatingHelpButtonPlay,
            helpMode && helpStyles.floatingHelpButtonActive,
            helpMode ? helpStyles.floatingHelpButtonHelpModeLayer : null,
          ]}
          data-swipe-ignore="true"
        >
          <HelpCircle size={19} color={helpMode ? '#051014' : 'var(--app-accent)'} />
        </TouchableOpacity>
      ) : null}

      <QuickControlsModal
        visible={controlsModalOpen && !helpMode}
        currentListName={currentListName}
        currentSongIndex={currentSongIndex}
        previousDisabled={previousDisabled}
        nextDisabled={nextDisabled}
        selectedTom={selectedTom}
        playlistControlsVisible={playlistControlsVisible}
        autoScrollPreset={autoScrollPreset}
        autoScrollPresetOptions={AUTO_SCROLL_PRESET_OPTIONS}
        customAutoScrollSpeed={customAutoScrollSpeed}
        hasAudioNote={hasAudioNote}
        audioPlayer={renderAudioNotePlayer('inline')}
        onClose={() => setControlsModalOpen(false)}
        onNavigateToIndex={navigateToIndex}
        onOpenCurrentList={() => {
          setControlsModalOpen(false);
          setListModalOpen(true);
        }}
        onOpenAddToPlaylist={() => {
          setControlsModalOpen(false);
          void addToPlaylist.openModal();
        }}
        onChangeFontSize={changeFontSize}
        onOpenTom={() => setTomOpen(true)}
        onTogglePlaylistControls={() => setPlaylistControlsVisible((current) => !current)}
        onOpenCustomAutoScroll={openCustomAutoScroll}
        onSelectAutoScrollPreset={selectAutoScrollPreset}
      />
      <AppModal
        visible={customAutoScrollOpen && !helpMode}
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

      <CurrentPlaylistModal
        visible={listModalOpen && !helpMode}
        title={currentListName}
        songs={currentSongList}
        currentSongIndex={currentSongIndex}
        onClose={() => setListModalOpen(false)}
        onNavigateToIndex={navigateToIndex}
      />
      <PlaylistPickerModal
        visible={addToPlaylist.open && !helpMode}
        title="Adicionar à lista"
        contextText={addToPlaylist.contextText}
        query={addToPlaylist.query}
        playlists={addToPlaylist.visiblePlaylists}
        addingToPlaylistId={addToPlaylist.addingToPlaylistId}
        removingFromPlaylistId={addToPlaylist.removingFromPlaylistId}
        onQueryChange={addToPlaylist.setQuery}
        onClose={addToPlaylist.closeModal}
        playlistAlreadyHasSong={addToPlaylist.playlistAlreadyHasSong}
        getPlaylistSubtitle={addToPlaylist.getPlaylistSubtitle}
        onSelectPlaylist={(playlist) => void addToPlaylist.addCurrentSongToPlaylist(playlist)}
        onRemoveFromPlaylist={(playlist) => void addToPlaylist.removeCurrentSongFromPlaylist(playlist)}
        showStars={addToPlaylist.showStars}
        onToggleStarredPlaylist={addToPlaylist.togglePlaylistStar}
        actionLabel="Adicionar"
        busyLabel="Adicionando..."
        alreadyAddedLabel="Já está nesta lista"
        emptyLabel="Nenhuma lista encontrada."
      />

      <YoutubeOptionsModal
        visible={youtubeModalOpen && !helpMode}
        title={song?.title || 'Sem título'}
        artist={song?.artist}
        youtubeUrl={song?.youtubeUrl}
        linkCopied={youtubeLinkCopied}
        onClose={closeYoutubeModal}
        onOpenYoutube={openYoutubeLink}
        onCopyLink={() => void copyYoutubeLink()}
      />

      <TomSelectorModal
        visible={tomOpen && !helpMode}
        selectedTom={selectedTom}
        keyOptions={keyOptions}
        onClose={() => setTomOpen(false)}
        onSelectTom={selectTom}
      />
    </View>
  );
}

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
} satisfies Record<string, CSSProperties>;

const songNormalTopStyles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  genreBadge: {
    marginHorizontal: 0,
    marginBottom: 0,
    alignSelf: 'flex-start',
  },
  metronome: {
    flexShrink: 0,
  },
});

const helpDomStyles: Record<string, CSSProperties> = {
  helpable: {
    position: 'relative',
    zIndex: 60,
    boxShadow: '0 0 0 2px rgba(79, 195, 247, 0.5), 0 0 22px rgba(79, 195, 247, 0.22)',
  },
  helpableActive: {
    position: 'relative',
    zIndex: 61,
    boxShadow: '0 0 0 3px rgba(79, 195, 247, 0.95), 0 0 30px rgba(79, 195, 247, 0.38)',
  },
};

const helpStyles = StyleSheet.create({
  helpable: {
    position: 'relative',
    zIndex: 60,
    borderColor: 'rgba(79, 195, 247, 0.72)',
    boxShadow: '0 0 0 2px rgba(79, 195, 247, 0.28), 0 0 20px rgba(79, 195, 247, 0.2)',
  },
  helpableActive: {
    position: 'relative',
    zIndex: 61,
    borderColor: 'var(--app-accent)',
    boxShadow: '0 0 0 3px rgba(79, 195, 247, 0.65), 0 0 30px rgba(79, 195, 247, 0.34)',
  },
  floatingHelpButton: {
    position: 'fixed',
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    zIndex: 90,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.28)',
    pointerEvents: 'auto',
  },
  floatingHelpButtonLow: {
    bottom: 18,
  },
  floatingHelpButtonAbovePanel: {
    bottom: 96,
  },
  floatingHelpButtonAboveAudio: {
    bottom: 174,
  },
  floatingHelpButtonPlay: {
    top: 74,
  },
  floatingHelpButtonActive: {
    backgroundColor: 'var(--app-accent)',
    borderColor: 'var(--app-accent)',
  },
  floatingHelpButtonHelpModeLayer: {
    zIndex: 120,
    boxShadow: '0 0 0 3px rgba(79, 195, 247, 0.7), 0 16px 36px rgba(0, 0, 0, 0.34)',
  },
});

const quickControlsStyles = StyleSheet.create({
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
});
