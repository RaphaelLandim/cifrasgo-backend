import { StyleSheet, TouchableOpacity, View } from 'react-native-web';
import { Volume2 } from 'lucide-react';

const SOUND_INDICATOR_COLOR = '#f59e0b';

interface MetronomeIndicatorsProps {
  visualOn: boolean;
  soundOn: boolean;
  pulse: 0 | 1 | 2;
  onToggleVisual: () => void;
  onToggleSound: () => void;
  visualHighlightStyle?: any;
  soundHighlightStyle?: any;
}

export function MetronomeIndicators({
  visualOn,
  soundOn,
  pulse,
  onToggleVisual,
  onToggleSound,
  visualHighlightStyle,
  soundHighlightStyle,
}: MetronomeIndicatorsProps) {
  return (
    <View style={styles.indicatorRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Alternar metrônomo visual"
        onPress={onToggleVisual}
        style={[
          styles.indicator,
          visualOn ? styles.visualIndicatorActive : styles.indicatorDisabled,
          visualOn && pulse === 1 ? styles.indicatorPulse : null,
          visualOn && pulse === 2 ? styles.indicatorStrongPulse : null,
          visualHighlightStyle,
        ]}
      >
        <View style={styles.innerMark} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Alternar beep sonoro"
        onPress={onToggleSound}
        style={[
          styles.indicator,
          soundOn ? styles.soundIndicatorActive : styles.indicatorDisabled,
          soundOn && pulse === 2 ? styles.soundStrongPulse : null,
          soundHighlightStyle,
        ]}
      >
        <Volume2 size={13} color={soundOn ? '#051014' : 'var(--app-muted-text)'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
