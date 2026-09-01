import type { CSSProperties } from 'react';
import { Pause, Play, X } from 'lucide-react';

interface RecordingMiniPlayerProps {
  variant: 'fixed' | 'inline';
  controlsVisible: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  playerHighlightStyle?: CSSProperties;
  audioHighlightStyle?: CSSProperties;
  onToggle: () => void;
  onSeek: (value: number) => void;
  onSeekPointerDown: () => void;
  onClose: () => void;
}

const formatAudioTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const getFixedRootStyle = (controlsVisible: boolean): CSSProperties => ({
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

export function RecordingMiniPlayer({
  variant,
  controlsVisible,
  playing,
  currentTime,
  duration,
  progress,
  playerHighlightStyle,
  audioHighlightStyle,
  onToggle,
  onSeek,
  onSeekPointerDown,
  onClose,
}: RecordingMiniPlayerProps) {
  const isInline = variant === 'inline';
  const safeDuration = duration > 0 ? duration : 0;

  return (
    <div
      style={{
        ...(isInline ? styles.inlineRoot : getFixedRootStyle(controlsVisible)),
        ...playerHighlightStyle,
      }}
      data-swipe-ignore="true"
    >
      <button
        type="button"
        aria-label={playing ? 'Pausar gravação de referência' : 'Tocar gravação de referência'}
        style={{
          ...styles.iconButton,
          ...audioHighlightStyle,
        }}
        onClick={onToggle}
      >
        {playing ? (
          <Pause size={16} color="var(--app-accent)" />
        ) : (
          <Play size={16} color="var(--app-accent)" />
        )}
      </button>
      <div style={styles.content}>
        <div style={styles.headerRow}>
          <span style={styles.title}>Gravação de referência</span>
          <span style={styles.time}>
            {formatAudioTime(currentTime)} / {formatAudioTime(safeDuration)}
          </span>
        </div>
        <div style={styles.progressWrap}>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <input
            aria-label="Buscar posição da gravação"
            type="range"
            min={0}
            max={safeDuration || 0}
            step={0.1}
            value={Math.min(currentTime, safeDuration || currentTime)}
            onPointerDown={onSeekPointerDown}
            onChange={(event) => onSeek(Number(event.currentTarget.value))}
            style={styles.range}
          />
        </div>
      </div>
      <button
        type="button"
        aria-label="Fechar gravação de referência"
        style={styles.closeButton}
        onClick={onClose}
      >
        <X size={15} color="var(--app-muted-text)" />
      </button>
    </div>
  );
}

const styles = {
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
