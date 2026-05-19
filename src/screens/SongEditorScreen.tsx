import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native-web';
import { Copy, ExternalLink, Link, ChevronRight, Maximize2, Mic, Minimize2, Play, Square, Timer, Trash2 } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { GenreFilterModal } from '../components/GenreFilterModal';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useSettings } from '../contexts/SettingsContext';
import { useSongEditorHeaderControls } from '../contexts/TopBarContext';
import type { ManualRoute } from '../navigation/manualTypes';
import { db } from '../services/storage';
import type { Genre, SongCompasso } from '../types/models';
import { getGenreDisplayName, getSongGenreKeys } from '../utils/genres';

interface SongEditorScreenProps {
  id: string;
  returnTo?: ManualRoute;
  initialContentOverride?: string;
  editingTransposedFromKey?: string;
  editingTransposedToKey?: string;
  styles: any;
}

const COMPASSO_OPTIONS: SongCompasso[] = ['2/4', '3/4', '4/4', '6/8'];
const DEFAULT_BPM = 120;
const AUDIO_NOTE_MAX_SECONDS = 30;

const getCompassoBeats = (value: SongCompasso) => {
  if (value === '2/4') return 2;
  if (value === '3/4') return 3;
  if (value === '6/8') return 6;
  return 4;
};

type AudioRecorderStatus = 'idle' | 'recording' | 'recorded' | 'saving' | 'error';

const getAudioNoteDataUrl = (base64?: string, mimeType?: string) =>
  base64 && mimeType ? `data:${mimeType};base64,${base64}` : '';

const getSupportedAudioMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  return undefined;
};

const blobToBase64Payload = (blob: Blob): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [header, base64 = ''] = result.split(',');
      const mimeType = header.match(/^data:(.*);base64$/)?.[1] || blob.type || 'audio/webm';
      if (!base64) {
        reject(new Error('Audio vazio.'));
        return;
      }
      resolve({ base64, mimeType });
    };
    reader.onerror = () => reject(new Error('Nao foi possivel processar o audio.'));
    reader.readAsDataURL(blob);
  });

export function SongEditorScreen({
  id,
  returnTo,
  initialContentOverride,
  editingTransposedFromKey,
  editingTransposedToKey,
  styles,
}: SongEditorScreenProps) {
  const nav = useManualNavigation();
  const { displaySettings: settings } = useSettings();
  const { setSongEditorHeaderControls, clearSongEditorHeaderControls } = useSongEditorHeaderControls();
  const isNew = id === 'new';
  const webEditorHeight = 'calc(100dvh - 250px)';
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [observation, setObservation] = useState('');
  const [registeredGenres, setRegisteredGenres] = useState<Genre[]>([]);
  const [selectedGenreKeys, setSelectedGenreKeys] = useState<Set<string>>(new Set());
  const [openGenres, setOpenGenres] = useState(false);
  const [openMetronome, setOpenMetronome] = useState(false);
  const [openSourceModal, setOpenSourceModal] = useState(false);
  const [sourceCopied, setSourceCopied] = useState(false);
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [editorFontSize, setEditorFontSize] = useState(17);
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [bpm, setBpm] = useState(String(DEFAULT_BPM));
  const [compasso, setCompasso] = useState<SongCompasso>('4/4');
  const [beepVisualEnabled, setBeepVisualEnabled] = useState(false);
  const [beepSoundEnabled, setBeepSoundEnabled] = useState(false);
  const [metronomePreviewing, setMetronomePreviewing] = useState(false);
  const [metronomePreviewPulse, setMetronomePreviewPulse] = useState<0 | 1 | 2>(0);
  const [metronomePreviewNotice, setMetronomePreviewNotice] = useState('');
  const [openAudioNote, setOpenAudioNote] = useState(false);
  const [audioRecorderStatus, setAudioRecorderStatus] = useState<AudioRecorderStatus>('idle');
  const [audioRecorderError, setAudioRecorderError] = useState('');
  const [audioRecorderNotice, setAudioRecorderNotice] = useState('');
  const [audioNoteBase64, setAudioNoteBase64] = useState<string | undefined>();
  const [audioNoteMimeType, setAudioNoteMimeType] = useState<string | undefined>();
  const [audioNoteUpdatedAt, setAudioNoteUpdatedAt] = useState<number | undefined>();
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const recordLimitTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const metronomePreviewIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const metronomePreviewPulseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const metronomePreviewAudioContextRef = React.useRef<AudioContext | null>(null);

  useEffect(() => {
    db.ensureDefaultGenres().then(setRegisteredGenres);
  }, []);

  useEffect(() => {
    if (!isNew) {
      db.getSongs().then((all) => {
        const song = all.find((item) => item.id === id);
        if (song) {
          setTitle(song.title);
          setArtist(song.artist);
          setObservation(song.observation || '');
          setSelectedGenreKeys(new Set(getSongGenreKeys(song)));
          setContent(initialContentOverride ?? song.content);
          setSourceUrl(song.sourceUrl || '');
          setEditorFontSize(song.preferredFontSize ?? 17);
          setBpm(String(song.bpm ?? DEFAULT_BPM));
          setCompasso(song.compasso ?? '4/4');
          setBeepVisualEnabled(song.beepVisualEnabled === true);
          setBeepSoundEnabled(song.beepSoundEnabled === true);
          setAudioNoteBase64(song.audioNoteBase64);
          setAudioNoteMimeType(song.audioNoteMimeType);
          setAudioNoteUpdatedAt(song.audioNoteUpdatedAt);
          setAudioRecorderStatus(song.audioNoteBase64 && song.audioNoteMimeType ? 'recorded' : 'idle');
        }
      });
    }
  }, [id, initialContentOverride, isNew]);

  const parseBpm = React.useCallback(() => {
    const parsed = Number.parseInt(bpm, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_BPM;
    return Math.max(30, Math.min(300, parsed));
  }, [bpm]);

  const clearMetronomePreviewTimers = React.useCallback(() => {
    if (metronomePreviewIntervalRef.current) {
      clearInterval(metronomePreviewIntervalRef.current);
      metronomePreviewIntervalRef.current = null;
    }
    if (metronomePreviewPulseTimeoutRef.current) {
      clearTimeout(metronomePreviewPulseTimeoutRef.current);
      metronomePreviewPulseTimeoutRef.current = null;
    }
  }, []);

  const stopMetronomePreview = React.useCallback(() => {
    clearMetronomePreviewTimers();
    setMetronomePreviewing(false);
    setMetronomePreviewPulse(0);
  }, [clearMetronomePreviewTimers]);

  const playMetronomePreviewBeep = React.useCallback((strongBeat: boolean) => {
    if (!beepSoundEnabled) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      setMetronomePreviewNotice('Audio indisponivel neste dispositivo.');
      return;
    }

    const context = metronomePreviewAudioContextRef.current ?? new AudioContextClass();
    metronomePreviewAudioContextRef.current = context;
    void context.resume?.();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = strongBeat ? 1180 : 880;
    gain.gain.setValueAtTime(strongBeat ? 0.12 : 0.075, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  }, [beepSoundEnabled]);

  const startMetronomePreview = React.useCallback(() => {
    if (!beepSoundEnabled && !beepVisualEnabled) {
      setMetronomePreviewNotice('Ative beep sonoro ou visual para testar.');
      return;
    }

    stopMetronomePreview();
    setMetronomePreviewNotice('');
    setMetronomePreviewing(true);

    const beats = getCompassoBeats(compasso);
    const intervalMs = Math.max(180, Math.round(60000 / parseBpm()));
    let beat = 0;

    const playBeat = () => {
      const strongBeat = beat % beats === 0;
      if (beepVisualEnabled) {
        setMetronomePreviewPulse(strongBeat ? 2 : 1);
        if (metronomePreviewPulseTimeoutRef.current) {
          clearTimeout(metronomePreviewPulseTimeoutRef.current);
        }
        metronomePreviewPulseTimeoutRef.current = setTimeout(() => setMetronomePreviewPulse(0), 130);
      }
      playMetronomePreviewBeep(strongBeat);
      beat = (beat + 1) % beats;
    };

    playBeat();
    metronomePreviewIntervalRef.current = setInterval(playBeat, intervalMs);
  }, [beepSoundEnabled, beepVisualEnabled, compasso, parseBpm, playMetronomePreviewBeep, stopMetronomePreview]);

  const stopAudioPreview = React.useCallback(() => {
    if (!previewAudioRef.current) return;
    previewAudioRef.current.pause();
    previewAudioRef.current.currentTime = 0;
    previewAudioRef.current = null;
  }, []);

  const stopRecordingTimers = React.useCallback(() => {
    if (recordLimitTimeoutRef.current) {
      clearTimeout(recordLimitTimeoutRef.current);
      recordLimitTimeoutRef.current = null;
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }, []);

  const stopMediaStream = React.useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const cleanupRecorder = React.useCallback(() => {
    stopRecordingTimers();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    stopMediaStream();
  }, [stopMediaStream, stopRecordingTimers]);

  useEffect(() => () => {
    cleanupRecorder();
    stopAudioPreview();
    stopMetronomePreview();
    void metronomePreviewAudioContextRef.current?.close?.();
    metronomePreviewAudioContextRef.current = null;
  }, [cleanupRecorder, stopAudioPreview, stopMetronomePreview]);

  const startAudioRecording = React.useCallback(async () => {
    setAudioRecorderError('');
    setAudioRecorderNotice('');
    stopAudioPreview();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setAudioRecorderStatus('error');
      setAudioRecorderError('Este navegador/WebView nao suporta gravacao de audio.');
      return;
    }

    try {
      cleanupRecorder();
      audioChunksRef.current = [];
      setRecordingSeconds(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setAudioRecorderStatus('error');
        setAudioRecorderError('Falha durante a gravacao.');
        stopMediaStream();
        stopRecordingTimers();
      };

      recorder.onstop = async () => {
        stopRecordingTimers();
        stopMediaStream();
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (!chunks.length) {
          setAudioRecorderStatus('idle');
          setAudioRecorderError('Nenhum audio foi capturado.');
          return;
        }
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          const payload = await blobToBase64Payload(blob);
          setAudioNoteBase64(payload.base64);
          setAudioNoteMimeType(payload.mimeType);
          setAudioNoteUpdatedAt(Date.now());
          setAudioRecorderStatus('recorded');
          setAudioRecorderNotice('Gravacao pronta para salvar.');
        } catch {
          setAudioRecorderStatus('error');
          setAudioRecorderError('Nao foi possivel preparar a gravacao.');
        }
      };

      recorder.start();
      setAudioRecorderStatus('recording');
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((value) => Math.min(AUDIO_NOTE_MAX_SECONDS, value + 1));
      }, 1000);
      recordLimitTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      }, AUDIO_NOTE_MAX_SECONDS * 1000);
    } catch (error) {
      stopMediaStream();
      stopRecordingTimers();
      setAudioRecorderStatus('error');
      const name = error instanceof DOMException ? error.name : '';
      setAudioRecorderError(
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? 'Permissao de microfone negada.'
          : 'Nao foi possivel acessar o microfone.'
      );
    }
  }, [cleanupRecorder, stopAudioPreview, stopMediaStream, stopRecordingTimers]);

  const stopAudioRecording = React.useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const playAudioPreview = React.useCallback(() => {
    const dataUrl = getAudioNoteDataUrl(audioNoteBase64, audioNoteMimeType);
    if (!dataUrl) {
      setAudioRecorderError('Nenhuma gravacao disponivel para ouvir.');
      return;
    }
    stopAudioPreview();
    const audio = new Audio(dataUrl);
    previewAudioRef.current = audio;
    audio.onended = () => {
      previewAudioRef.current = null;
    };
    audio.play().catch(() => {
      setAudioRecorderError('Nao foi possivel reproduzir a gravacao.');
    });
  }, [audioNoteBase64, audioNoteMimeType, stopAudioPreview]);

  const saveAudioNote = React.useCallback(async () => {
    if (!audioNoteBase64 || !audioNoteMimeType) {
      setAudioRecorderError('Grave um trecho antes de salvar.');
      return;
    }
    const nextUpdatedAt = audioNoteUpdatedAt || Date.now();
    setAudioRecorderStatus('saving');
    if (!isNew) {
      await db.updateSong(id, {
        audioNoteBase64,
        audioNoteMimeType,
        audioNoteUpdatedAt: nextUpdatedAt,
      });
    }
    setAudioNoteUpdatedAt(nextUpdatedAt);
    setAudioRecorderStatus('recorded');
    setAudioRecorderNotice(isNew ? 'Gravacao pronta. Salve a musica para guardar.' : 'Gravacao salva.');
  }, [audioNoteBase64, audioNoteMimeType, audioNoteUpdatedAt, id, isNew]);

  const deleteAudioNote = React.useCallback(async () => {
    cleanupRecorder();
    stopAudioPreview();
    setAudioNoteBase64(undefined);
    setAudioNoteMimeType(undefined);
    setAudioNoteUpdatedAt(undefined);
    setRecordingSeconds(0);
    setAudioRecorderStatus('idle');
    setAudioRecorderNotice(isNew ? 'Gravacao removida.' : 'Gravacao apagada.');
    setAudioRecorderError('');
    if (!isNew) {
      await db.updateSong(id, {
        audioNoteBase64: undefined,
        audioNoteMimeType: undefined,
        audioNoteUpdatedAt: undefined,
      });
    }
  }, [cleanupRecorder, id, isNew, stopAudioPreview]);

  const save = React.useCallback(async () => {
    if (!title.trim()) return Alert.alert('Informe o título');
    const nextGenreKeys = Array.from(selectedGenreKeys);
    const genreDisplay = nextGenreKeys.map((genre) => getGenreDisplayName(genre, registeredGenres)).join(', ');
    const nextBpm = parseBpm();
    setBpm(String(nextBpm));
    if (isNew) {
      const created = await db.addSong({
        title,
        artist,
        genre: genreDisplay || undefined,
        genres: nextGenreKeys.length ? nextGenreKeys : undefined,
        observation,
        content,
        sourceUrl,
        bpm: nextBpm,
        compasso,
        beepVisualEnabled,
        beepSoundEnabled,
        audioNoteBase64,
        audioNoteMimeType,
        audioNoteUpdatedAt,
        updatedAt: Date.now(),
      });
      nav.navigate('SongDetail', { id: created.id, returnTo });
      return;
    }
    await db.updateSong(id, {
      title,
      artist,
      genre: genreDisplay || undefined,
      genres: nextGenreKeys.length ? nextGenreKeys : undefined,
      observation,
      content,
      sourceUrl,
      bpm: nextBpm,
      compasso,
      beepVisualEnabled,
      beepSoundEnabled,
      audioNoteBase64,
      audioNoteMimeType,
      audioNoteUpdatedAt,
      updatedAt: Date.now(),
    });
    nav.navigate('SongDetail', { id, returnTo });
  }, [artist, audioNoteBase64, audioNoteMimeType, audioNoteUpdatedAt, beepSoundEnabled, beepVisualEnabled, compasso, content, id, isNew, nav, observation, parseBpm, registeredGenres, returnTo, selectedGenreKeys, sourceUrl, title]);

  const cancel = React.useCallback(() => {
    if (isNew) {
      if (returnTo?.name) {
        nav.navigate(returnTo.name, returnTo.params);
        return;
      }
      nav.navigate('Songs');
      return;
    }
    nav.navigate('SongDetail', { id, returnTo });
  }, [id, isNew, nav, returnTo]);

  const openSource = React.useCallback(() => {
    if (!sourceUrl) return;
    setSourceCopied(false);
    setOpenSourceModal(true);
  }, [sourceUrl]);

  const openSourceUrl = React.useCallback(() => {
    if (!sourceUrl) return;
    window.open(sourceUrl, '_blank', 'noopener,noreferrer');
  }, [sourceUrl]);

  const copySourceUrl = React.useCallback(async () => {
    if (!sourceUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sourceUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = sourceUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setSourceCopied(true);
    } catch {
      Alert.alert('Erro', 'Nao foi possivel copiar o link.');
    }
  }, [sourceUrl]);

  useEffect(() => {
    setSongEditorHeaderControls({
      onCancel: cancel,
      onOpenSource: openSource,
      onSave: save,
      canOpenSource: !!sourceUrl,
    });
    return clearSongEditorHeaderControls;
  }, [cancel, clearSongEditorHeaderControls, openSource, save, setSongEditorHeaderControls, sourceUrl]);

  const editorLineHeight = Math.max(24, Math.round(editorFontSize * 1.85));
  const editorTextareaStyle = (expanded = false): React.CSSProperties => {
    const paddingTop = expanded ? 14 : 10;
    return {
      width: '100%',
      height: '100%',
      minHeight: 0,
      display: 'block',
      flex: '1 1 auto',
      margin: 0,
      padding: expanded ? `${paddingTop}px 12px 24px` : `${paddingTop}px 10px 10px`,
      border: 'none',
      outline: 'none',
      resize: 'none',
      backgroundColor: 'transparent',
      color: '#fff',
      lineHeight: `${editorLineHeight}px`,
      fontSize: `${editorFontSize}px`,
      fontFamily: 'monospace',
      boxSizing: 'border-box',
      backgroundImage: `linear-gradient(to bottom, transparent ${Math.max(0, editorLineHeight - 1)}px, ${settings.staffLineColor} ${editorLineHeight}px)`,
      backgroundSize: `100% ${editorLineHeight}px`,
      backgroundPosition: `0 ${paddingTop}px`,
      backgroundAttachment: 'local',
    };
  };

  const selectedGenreLabel = Array.from(selectedGenreKeys)
    .map((genre) => getGenreDisplayName(genre, registeredGenres))
    .join(', ');

  const selectedGenreValues = React.useMemo(() => Array.from(selectedGenreKeys), [selectedGenreKeys]);
  const transposedEditNotice =
    initialContentOverride && editingTransposedFromKey && editingTransposedToKey
      ? `Editando no tom transposto: ${editingTransposedFromKey} -> ${editingTransposedToKey}`
      : '';

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>{isNew ? 'Nova música' : 'Editar música'}</Text>
      <View style={styles.editorForm}>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Nome da música" placeholderTextColor="#666" />
        <TextInput style={styles.input} value={artist} onChangeText={setArtist} placeholder="Nome do artista" placeholderTextColor="#666" />
        <View style={metronomeEditorStyles.genreMetronomeRow}>
        <TouchableOpacity
          style={[styles.input, styles.genrePicker, metronomeEditorStyles.genrePickerInRow]}
          onPress={() => setOpenGenres(true)}
        >
          <Text style={{ color: selectedGenreLabel ? '#fff' : '#666' }}>
            {selectedGenreLabel || 'Selecionar gêneros'}
          </Text>
          <ChevronRight size={18} color="#4FC3F7" />
        </TouchableOpacity>
          <TouchableOpacity
            style={[
              metronomeEditorStyles.metronomeButton,
              audioRecorderStyles.recButton,
              audioNoteBase64 && audioNoteMimeType ? audioRecorderStyles.recButtonHasAudio : null,
            ]}
            onPress={() => {
              setAudioRecorderError('');
              setAudioRecorderNotice('');
              setOpenAudioNote(true);
            }}
          >
            <Mic size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={metronomeEditorStyles.metronomeButton}
            onPress={() => setOpenMetronome(true)}
          >
            <Timer size={20} color="var(--app-accent)" />
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          value={observation}
          onChangeText={setObservation}
          placeholder="Observação (ex: Meu tom é A)"
          placeholderTextColor="#666"
        />
        <View style={styles.editorSectionHeader}>
          <Text style={styles.editorSectionTitle}>Texto da cifra</Text>
          <TouchableOpacity style={styles.editorExpandBtn} onPress={() => setEditorExpanded(true)}>
            <Maximize2 size={18} color="#4FC3F7" />
          </TouchableOpacity>
        </View>
        {transposedEditNotice ? (
          <View style={transposedEditStyles.notice}>
            <Text style={transposedEditStyles.noticeText}>{transposedEditNotice}</Text>
          </View>
        ) : null}
        <View
          style={[
            styles.editorContentWrap,
            Platform.OS === 'web' ? ({ height: webEditorHeight, minHeight: webEditorHeight } as any) : null,
          ]}
        >
          {Platform.OS === 'web' ? (
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Cole os acordes/letra"
              style={editorTextareaStyle()}
            />
          ) : (
            <TextInput
              style={[styles.editorContentInput, { fontSize: editorFontSize, lineHeight: editorLineHeight }]}
              multiline
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
              placeholder="Cole os acordes/letra"
              placeholderTextColor="#666"
            />
          )}
        </View>
      </View>
      <Modal visible={editorExpanded} transparent={false} animationType="slide" onRequestClose={() => setEditorExpanded(false)}>
        <SafeAreaView style={styles.expandedEditorModal}>
          <View style={styles.expandedEditorHeader}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setEditorExpanded(false)}>
              <Minimize2 size={18} color="#4FC3F7" />
            </TouchableOpacity>
            <Text style={styles.expandedEditorTitle} numberOfLines={1}>
              Texto da cifra
            </Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setEditorExpanded(false)}>
              <Text style={styles.editorActionLabel}>OK</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.expandedEditorBody}>
            {Platform.OS === 'web' ? (
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Cole os acordes/letra"
                autoFocus
                style={editorTextareaStyle(true)}
              />
            ) : (
              <TextInput
                style={[
                  styles.editorContentInput,
                  styles.expandedEditorInput,
                  { fontSize: editorFontSize, lineHeight: editorLineHeight },
                ]}
                multiline
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
                placeholder="Cole os acordes/letra"
                placeholderTextColor="#666"
                autoFocus
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
      <GenreFilterModal
        visible={openGenres}
        onClose={() => setOpenGenres(false)}
        title="Generos da musica"
        hint="Selecione um ou mais generos para salvar nesta musica."
        selectedGenres={selectedGenreValues}
        onConfirm={(genres) => setSelectedGenreKeys(new Set(genres))}
      />
      <AppModal
        visible={openAudioNote}
        title="Gravação de referência"
        onClose={() => {
          if (audioRecorderStatus === 'recording') stopAudioRecording();
          stopAudioPreview();
          setOpenAudioNote(false);
        }}
        icon={<Mic size={16} color="#ff6b6b" />}
        maxWidth={520}
      >
        <View style={audioRecorderStyles.body}>
          <View style={audioRecorderStyles.infoBox}>
            <Text style={audioRecorderStyles.infoTitle}>Lembrete de áudio</Text>
            <Text style={audioRecorderStyles.infoText}>
              Grave até {AUDIO_NOTE_MAX_SECONDS}s para lembrar como tocar ou cantar esta música.
            </Text>
          </View>

          <View style={audioRecorderStyles.statusRow}>
            <View
              style={[
                audioRecorderStyles.statusDot,
                audioRecorderStatus === 'recording' ? audioRecorderStyles.statusDotRecording : null,
                audioNoteBase64 && audioNoteMimeType ? audioRecorderStyles.statusDotReady : null,
              ]}
            />
            <Text style={audioRecorderStyles.statusText}>
              {audioRecorderStatus === 'recording'
                ? `Gravando ${recordingSeconds}s / ${AUDIO_NOTE_MAX_SECONDS}s`
                : audioNoteBase64 && audioNoteMimeType
                  ? 'Gravação disponÃ­vel'
                  : 'Nenhuma gravação salva'}
            </Text>
          </View>

          {audioRecorderError ? <Text style={audioRecorderStyles.errorText}>{audioRecorderError}</Text> : null}
          {audioRecorderNotice ? <Text style={audioRecorderStyles.noticeText}>{audioRecorderNotice}</Text> : null}

          <View style={audioRecorderStyles.actionGrid}>
            {audioRecorderStatus === 'recording' ? (
              <TouchableOpacity style={[audioRecorderStyles.actionButton, audioRecorderStyles.stopButton]} onPress={stopAudioRecording}>
                <Square size={17} color="#fff" />
                <Text style={audioRecorderStyles.actionTextLight}>Parar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[audioRecorderStyles.actionButton, audioRecorderStyles.recordButton]} onPress={startAudioRecording}>
                <Mic size={17} color="#fff" />
                <Text style={audioRecorderStyles.actionTextLight}>
                  {audioNoteBase64 && audioNoteMimeType ? 'Substituir' : 'Iniciar gravação'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[audioRecorderStyles.actionButton, !audioNoteBase64 || !audioNoteMimeType ? audioRecorderStyles.disabledButton : null]}
              disabled={!audioNoteBase64 || !audioNoteMimeType || audioRecorderStatus === 'recording'}
              onPress={playAudioPreview}
            >
              <Play size={17} color="var(--app-accent)" />
              <Text style={audioRecorderStyles.actionText}>Ouvir prévia</Text>
            </TouchableOpacity>
          </View>

          <View style={audioRecorderStyles.footerRow}>
            <TouchableOpacity
              style={[
                audioRecorderStyles.actionButton,
                audioRecorderStyles.deleteButton,
                !audioNoteBase64 || !audioNoteMimeType
                  ? audioRecorderStyles.disabledButton
                  : null,
              ]}
              disabled={!audioNoteBase64 || !audioNoteMimeType || audioRecorderStatus === 'recording'}
              onPress={deleteAudioNote}
            >
              <Trash2 size={15} color="#ff7a7a" />
              <Text style={audioRecorderStyles.actionText}>
                Apagar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, !audioNoteBase64 || !audioNoteMimeType ? audioRecorderStyles.disabledButton : null]}
              disabled={!audioNoteBase64 || !audioNoteMimeType || audioRecorderStatus === 'recording' || audioRecorderStatus === 'saving'}
              onPress={saveAudioNote}
            >
              <Text style={styles.modalPrimaryText}>
                {audioRecorderStatus === 'saving' ? 'Salvando...' : 'Salvar gravação'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppModal>
      <AppModal
        visible={openMetronome}
        title="Metrônomo"
        onClose={() => {
          stopMetronomePreview();
          setOpenMetronome(false);
        }}
        icon={<Timer size={16} color="var(--app-accent)" />}
        maxWidth={460}
        footer={
          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            onPress={() => {
              stopMetronomePreview();
              setOpenMetronome(false);
            }}
          >
            <Text style={styles.modalPrimaryText}>OK</Text>
          </TouchableOpacity>
        }
      >
        <View style={metronomeEditorStyles.modalBody}>
          <View>
            <Text style={metronomeEditorStyles.label}>BPM</Text>
            <TextInput
              style={[styles.input, metronomeEditorStyles.bpmInput]}
              value={bpm}
              onChangeText={setBpm}
              keyboardType="numeric"
              placeholder={String(DEFAULT_BPM)}
              placeholderTextColor="#666"
            />
          </View>

          <View>
            <Text style={metronomeEditorStyles.label}>Compasso</Text>
            <View style={metronomeEditorStyles.segmented}>
              {COMPASSO_OPTIONS.map((option, index) => {
                const selected = compasso === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      metronomeEditorStyles.segmentButton,
                      selected && metronomeEditorStyles.segmentButtonActive,
                      index > 0 && metronomeEditorStyles.segmentDivider,
                    ]}
                    onPress={() => setCompasso(option)}
                  >
                    <Text style={[metronomeEditorStyles.segmentText, selected && metronomeEditorStyles.segmentTextActive]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={metronomeEditorStyles.toggleRow}
            onPress={() => setBeepSoundEnabled((value) => !value)}
          >
            <View style={[metronomeEditorStyles.checkBox, beepSoundEnabled && metronomeEditorStyles.checkBoxActive]}>
              {beepSoundEnabled ? <Text style={metronomeEditorStyles.checkText}>✓</Text> : null}
            </View>
            <View>
              <Text style={metronomeEditorStyles.toggleTitle}>Beep sonoro</Text>
              <Text style={metronomeEditorStyles.toggleHint}>Som curto a cada tempo.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={metronomeEditorStyles.toggleRow}
            onPress={() => setBeepVisualEnabled((value) => !value)}
          >
            <View style={[metronomeEditorStyles.checkBox, beepVisualEnabled && metronomeEditorStyles.checkBoxActive]}>
              {beepVisualEnabled ? <Text style={metronomeEditorStyles.checkText}>✓</Text> : null}
            </View>
            <View>
              <Text style={metronomeEditorStyles.toggleTitle}>Beep visual</Text>
              <Text style={metronomeEditorStyles.toggleHint}>Indicador piscando na tela da música.</Text>
            </View>
          </TouchableOpacity>

          <View style={metronomeEditorStyles.previewBox}>
            <View
              style={[
                metronomeEditorStyles.previewDot,
                metronomePreviewPulse === 1 && metronomeEditorStyles.previewDotPulse,
                metronomePreviewPulse === 2 && metronomeEditorStyles.previewDotStrongPulse,
              ]}
            />
            <View style={metronomeEditorStyles.previewTextBlock}>
              <Text style={metronomeEditorStyles.previewTitle}>Prévia do metrônomo</Text>
              <Text style={metronomeEditorStyles.previewHint}>
                Testa {getCompassoBeats(compasso)} tempos em {parseBpm()} BPM.
              </Text>
              {metronomePreviewNotice ? (
                <Text style={metronomeEditorStyles.previewNotice}>{metronomePreviewNotice}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[
                metronomeEditorStyles.previewButton,
                metronomePreviewing && metronomeEditorStyles.previewButtonActive,
              ]}
              onPress={metronomePreviewing ? stopMetronomePreview : startMetronomePreview}
            >
              <Text style={metronomeEditorStyles.previewButtonText}>
                {metronomePreviewing ? 'Parar' : 'Testar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AppModal>
      <AppModal
        visible={openSourceModal}
        title="Link da música"
        onClose={() => setOpenSourceModal(false)}
        icon={<Link size={16} color="var(--app-accent)" />}
        maxWidth={520}
        footer={
          <>
            <TouchableOpacity style={styles.modalGhostBtn} onPress={copySourceUrl}>
              <Text style={styles.modalGhostText}>Copiar link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={openSourceUrl}>
              <Text style={styles.modalPrimaryText}>Abrir link da música</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={sourceLinkStyles.body}>
          <View style={sourceLinkStyles.urlBox}>
            <Text style={sourceLinkStyles.urlText}>{sourceUrl}</Text>
          </View>
          {sourceCopied ? (
            <View style={sourceLinkStyles.copiedRow}>
              <Copy size={14} color="var(--app-accent)" />
              <Text style={sourceLinkStyles.copiedText}>Link copiado</Text>
            </View>
          ) : null}
          <TouchableOpacity style={sourceLinkStyles.openInlineButton} onPress={openSourceUrl}>
            <ExternalLink size={15} color="var(--app-accent)" />
            <Text style={sourceLinkStyles.openInlineText}>Abrir link da música</Text>
          </TouchableOpacity>
        </View>
      </AppModal>
    </View>
  );
}

const sourceLinkStyles = StyleSheet.create({
  body: {
    gap: 12,
  },
  urlBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  urlText: {
    color: 'var(--app-text)',
    fontSize: 13,
    lineHeight: 19,
  },
  copiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copiedText: {
    color: 'var(--app-accent)',
    fontSize: 13,
    fontWeight: '800',
  },
  openInlineButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  openInlineText: {
    color: 'var(--app-accent)',
    fontSize: 13,
    fontWeight: '800',
  },
});

const audioRecorderStyles = StyleSheet.create({
  recButton: {
    borderColor: '#ff6b6b',
    backgroundColor: '#b91c1c',
  },
  recButtonHasAudio: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ff8a8a',
  },
  body: {
    gap: 12,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoTitle: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '900',
  },
  infoText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'var(--app-border-soft)',
  },
  statusDotRecording: {
    backgroundColor: '#ff3b3b',
  },
  statusDotReady: {
    backgroundColor: 'var(--app-accent)',
  },
  statusText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    color: '#ff9a9a',
    fontSize: 13,
    fontWeight: '800',
  },
  noticeText: {
    color: 'var(--app-accent)',
    fontSize: 13,
    fontWeight: '800',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  recordButton: {
    borderColor: '#ff6b6b',
    backgroundColor: '#dc2626',
  },
  stopButton: {
    borderColor: '#ff8a8a',
    backgroundColor: '#991b1b',
  },
  actionText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  actionTextLight: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  footerRow: {
    borderTopWidth: 1,
    borderTopColor: 'var(--app-border-soft)',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  disabledButton: {
    opacity: 0.45,
  },
});

const metronomeEditorStyles = StyleSheet.create({
  genreMetronomeRow: {
    marginHorizontal: 12,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  genrePickerInRow: {
    flex: 1,
    marginHorizontal: 0,
    marginVertical: 0,
  },
  metronomeButton: {
    width: 48,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'var(--app-border)',
    backgroundColor: 'var(--app-surface)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    gap: 14,
  },
  label: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
  },
  bpmInput: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'var(--app-surface-alt)',
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: 'var(--app-accent-soft)',
  },
  segmentDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'var(--app-border-soft)',
  },
  segmentText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: 'var(--app-accent)',
  },
  toggleRow: {
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent)',
  },
  checkText: {
    color: '#051014',
    fontSize: 14,
    fontWeight: '900',
  },
  toggleTitle: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
  },
  toggleHint: {
    color: 'var(--app-subtle-text)',
    fontSize: 12,
    marginTop: 2,
  },
  previewBox: {
    minHeight: 74,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewDot: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
  },
  previewDotPulse: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  previewDotStrongPulse: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent)',
  },
  previewTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  previewTitle: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
  },
  previewHint: {
    color: 'var(--app-subtle-text)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  previewNotice: {
    color: 'var(--app-accent)',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },
  previewButton: {
    minWidth: 74,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  previewButtonActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
    opacity: 0.72,
  },
  previewButtonText: {
    color: 'var(--app-accent)',
    fontSize: 13,
    fontWeight: '900',
  },
});

const transposedEditStyles = StyleSheet.create({
  notice: {
    marginHorizontal: 12,
    marginTop: -2,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.28)',
    backgroundColor: 'var(--app-accent-soft)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noticeText: {
    color: 'var(--app-accent)',
    fontSize: 12,
    fontWeight: '900',
  },
});
