import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Play, Settings, Square } from 'lucide-react';
import { AppButton } from '../components/AppButton';
import { ChordLine } from '../components/ChordLine';
import { ScreenHeader } from '../components/ScreenHeader';
import { transposeContent } from '../lib/chords';
import type { RootStackScreenProps } from '../navigation/types';
import { db } from '../services/storage';
import { appTheme, DEFAULT_DISPLAY_SETTINGS } from '../theme/theme';
import type { DisplaySettings, Song } from '../types/models';
import { detectTomFromContent, formatKeyForSpellingMode, getKeyOptionsForSpellingMode, getTransposeBetweenKeys, type MusicKey } from '../utils/chordKeys';
import { getSongGenreDisplay } from '../utils/genres';

export function ChordViewScreen({ navigation, route }: RootStackScreenProps<'ChordView'>) {
  const [song, setSong] = React.useState<Song | null>(null);
  const [settings, setSettings] = React.useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = React.useState<0 | 1 | 2 | 3>(2);
  const [fontSize, setFontSize] = React.useState(17);
  const [baseTom, setBaseTom] = React.useState<MusicKey>('C');
  const [selectedTom, setSelectedTom] = React.useState<MusicKey>('C');
  const [tomOpen, setTomOpen] = React.useState(false);
  const [speedOpen, setSpeedOpen] = React.useState(false);
  const scrollRef = React.useRef<any>(null);
  const scrollPositionRef = React.useRef(0);
  const frameRef = React.useRef<number | null>(null);
  const lastTimeRef = React.useRef<number | null>(null);
  const chordSpellingMode = settings.chordSpellingMode ?? 'mixed';
  const keyOptions = getKeyOptionsForSpellingMode(chordSpellingMode);

  const getScrollNode = () => scrollRef.current?.getScrollableNode?.() ?? scrollRef.current;

  const getCurrentScrollTop = () => {
    const node = getScrollNode();
    return typeof node?.scrollTop === 'number' ? node.scrollTop : scrollPositionRef.current;
  };

  const scrollToPosition = (y: number) => {
    const nextY = Math.max(0, y);
    scrollPositionRef.current = nextY;
    const target = scrollRef.current;
    const node = getScrollNode();

    if (typeof target?.scrollTo === 'function') {
      target.scrollTo({ x: 0, y: nextY, animated: false });
      return;
    }

    if (typeof node?.scrollTo === 'function') {
      node.scrollTo({ left: 0, top: nextY, behavior: 'auto' });
      return;
    }

    if (node) node.scrollTop = nextY;
  };

  const syncScrollPosition = (event: any) => {
    const y =
      event?.nativeEvent?.contentOffset?.y ??
      event?.currentTarget?.scrollTop ??
      event?.target?.scrollTop ??
      0;
    scrollPositionRef.current = y;
  };

  React.useEffect(() => {
    void Promise.all([db.getSongs(), db.getDisplaySettings()]).then(([songs, displaySettings]) => {
      const nextSong = songs.find((item) => item.id === route.params.songId) || null;
      setSong(nextSong);
      setSettings(displaySettings);
      setFontSize(nextSong?.preferredFontSize ?? 17);

      if (nextSong?.content) {
        const detected = detectTomFromContent(nextSong.content, displaySettings.chordSpellingMode ?? 'mixed');
        setBaseTom(detected);
        setSelectedTom(detected);
      }
    });
  }, [route.params.songId]);

  React.useEffect(() => {
    setBaseTom((current) => formatKeyForSpellingMode(current, chordSpellingMode));
    setSelectedTom((current) => formatKeyForSpellingMode(current, chordSpellingMode));
  }, [chordSpellingMode]);

  React.useEffect(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastTimeRef.current = null;

    if (!isPlaying || autoScrollSpeed === 0) return;

    const pixelsPerSecond = autoScrollSpeed === 1 ? 95 : autoScrollSpeed === 2 ? 180 : 360;
    const tick = (time: number) => {
      const lastTime = lastTimeRef.current ?? time;
      const elapsedSeconds = Math.min((time - lastTime) / 1000, 0.08);
      lastTimeRef.current = time;

      const node = getScrollNode();
      const maxScroll =
        node && typeof node.scrollHeight === 'number' && typeof node.clientHeight === 'number'
          ? Math.max(0, node.scrollHeight - node.clientHeight)
          : Number.POSITIVE_INFINITY;
      const nextY = Math.min(getCurrentScrollTop() + pixelsPerSecond * elapsedSeconds, maxScroll);
      scrollToPosition(nextY);

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastTimeRef.current = null;
    };
  }, [autoScrollSpeed, isPlaying, song?.id]);

  const changeFontSize = async (delta: number) => {
    if (!song) return;
    const next = Math.max(12, Math.min(30, fontSize + delta));
    setFontSize(next);
    await db.updateSong(song.id, { preferredFontSize: next });
  };

  if (!song) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Cifra" onBack={navigation.goBack} />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Musica nao encontrada.</Text>
        </View>
      </View>
    );
  }

  const transpose = getTransposeBetweenKeys(baseTom, selectedTom);
  const content = transposeContent(song.content, transpose, chordSpellingMode);
  const speedLabel = autoScrollSpeed === 1 ? 'Lenta' : autoScrollSpeed === 2 ? 'Media' : autoScrollSpeed === 3 ? 'Rapida' : 'Off';

  return (
    <View style={styles.container}>
      {!isPlaying ? (
        <ScreenHeader
          title={song.title || 'Cifra'}
          onBack={navigation.goBack}
          right={
            <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Settings')}>
              <Settings size={20} color={appTheme.colors.chord} />
            </TouchableOpacity>
          }
        />
      ) : (
        <View style={styles.fullscreenActions}>
          <TouchableOpacity style={styles.fullscreenButton} onPress={() => setSpeedOpen(true)}>
            <Text style={styles.fullscreenButtonText}>{speedLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fullscreenButton} onPress={() => setIsPlaying(false)}>
            <Text style={styles.fullscreenButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {(song.artist || '').trim() || 'Sem artista'}
        </Text>
        {getSongGenreDisplay(song) ? <Text style={styles.genre}>{getSongGenreDisplay(song)}</Text> : null}
        {song.observation?.trim() ? <Text style={styles.observation}>{song.observation.trim()}</Text> : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.chordContent}
        onScroll={syncScrollPosition}
        scrollEventThrottle={16}
      >
        {content.split('\n').map((line, index) => (
          <ChordLine key={`${index}-${line}`} text={line} fontSize={fontSize} settings={settings} />
        ))}
      </ScrollView>

      {!isPlaying ? (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={() => setIsPlaying(true)}>
            <Play size={18} color={appTheme.colors.chord} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => void changeFontSize(-1)}>
            <Text style={styles.controlText}>A-</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => void changeFontSize(1)}>
            <Text style={styles.controlText}>A+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => setTomOpen(true)}>
            <Text style={styles.controlText}>Tom {selectedTom}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => setSpeedOpen(true)}>
            <Text style={styles.controlText}>{speedLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={tomOpen} transparent animationType="fade" onRequestClose={() => setTomOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecionar tom</Text>
            <View style={styles.keyGrid}>
              {keyOptions.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.keyButton, selectedTom === key && styles.keyButtonActive]}
                  onPress={() => {
                    setSelectedTom(key);
                    setTomOpen(false);
                  }}
                >
                  <Text style={[styles.keyText, selectedTom === key && styles.keyTextActive]}>{key}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={speedOpen} transparent animationType="fade" onRequestClose={() => setSpeedOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rolagem automatica</Text>
            {[
              { value: 0, label: 'Sem rolagem' },
              { value: 1, label: 'Lenta' },
              { value: 2, label: 'Media' },
              { value: 3, label: 'Rapida' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.speedButton, autoScrollSpeed === option.value && styles.speedButtonActive]}
                onPress={() => setAutoScrollSpeed(option.value as 0 | 1 | 2 | 3)}
              >
                <Text style={styles.speedText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalActions}>
              <AppButton label="Parar" variant="ghost" icon={<Square size={17} color={appTheme.colors.text} />} onPress={() => setIsPlaying(false)} />
              <AppButton label="OK" onPress={() => setSpeedOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appTheme.colors.background,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: appTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appTheme.colors.surface,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
  },
  songInfo: {
    paddingHorizontal: appTheme.spacing.md,
    paddingTop: appTheme.spacing.md,
    paddingBottom: appTheme.spacing.sm,
  },
  songTitle: {
    color: appTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  songArtist: {
    color: appTheme.colors.mutedText,
    marginTop: 3,
  },
  genre: {
    color: appTheme.colors.chord,
    marginTop: 6,
    fontWeight: '800',
  },
  observation: {
    color: appTheme.colors.subtleText,
    marginTop: 6,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: appTheme.spacing.md,
  },
  chordContent: {
    paddingBottom: 110,
  },
  controls: {
    minHeight: 64,
    borderTopWidth: 1,
    borderTopColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.background,
    padding: appTheme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: appTheme.spacing.sm,
  },
  controlButton: {
    minWidth: 46,
    height: 44,
    borderRadius: appTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: appTheme.spacing.sm,
    backgroundColor: appTheme.colors.surface,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
  },
  controlText: {
    color: appTheme.colors.chord,
    fontWeight: '900',
  },
  fullscreenActions: {
    position: 'absolute',
    zIndex: 10,
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: appTheme.spacing.sm,
  },
  fullscreenButton: {
    minHeight: 38,
    borderRadius: appTheme.radius.md,
    paddingHorizontal: appTheme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appTheme.colors.surface,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
  },
  fullscreenButtonText: {
    color: appTheme.colors.chord,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: appTheme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: appTheme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: appTheme.radius.lg,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
    padding: appTheme.spacing.lg,
  },
  modalTitle: {
    color: appTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: appTheme.spacing.md,
  },
  keyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: appTheme.spacing.sm,
  },
  keyButton: {
    width: 62,
    height: 42,
    borderRadius: appTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appTheme.colors.background,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
  },
  keyButtonActive: {
    borderColor: appTheme.colors.chord,
    backgroundColor: appTheme.colors.surfaceAlt,
  },
  keyText: {
    color: appTheme.colors.text,
    fontWeight: '800',
  },
  keyTextActive: {
    color: appTheme.colors.chord,
  },
  speedButton: {
    minHeight: 44,
    borderRadius: appTheme.radius.md,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.background,
    justifyContent: 'center',
    paddingHorizontal: appTheme.spacing.md,
    marginBottom: appTheme.spacing.sm,
  },
  speedButtonActive: {
    borderColor: appTheme.colors.chord,
  },
  speedText: {
    color: appTheme.colors.text,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: appTheme.spacing.sm,
    marginTop: appTheme.spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: appTheme.colors.mutedText,
  },
});
