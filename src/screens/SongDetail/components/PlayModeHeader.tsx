import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { Menu, Pause, Play, X } from 'lucide-react';

interface PlayModeHeaderProps {
  title: string;
  artist: string;
  titleStyle: any;
  subtitleStyle: any;
  metronomeIndicators: ReactNode;
  autoScrollEnabled: boolean;
  autoScrollLabel: string;
  autoScrollHighlightStyle?: any;
  quickControlsHighlightStyle?: any;
  exitHighlightStyle?: any;
  onToggleAutoScroll: () => void;
  onOpenQuickControls: () => void;
  onExitPlay: () => void;
}

export function PlayModeHeader({
  title,
  artist,
  titleStyle,
  subtitleStyle,
  metronomeIndicators,
  autoScrollEnabled,
  autoScrollLabel,
  autoScrollHighlightStyle,
  quickControlsHighlightStyle,
  exitHighlightStyle,
  onToggleAutoScroll,
  onOpenQuickControls,
  onExitPlay,
}: PlayModeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text style={titleStyle} numberOfLines={1}>{title}</Text>
        <Text style={subtitleStyle} numberOfLines={1}>{artist}</Text>
      </View>
      <View style={styles.actions}>
        {metronomeIndicators}
        <TouchableOpacity
          onPress={onToggleAutoScroll}
          style={[
            styles.autoScrollButton,
            autoScrollEnabled && styles.autoScrollButtonActive,
            autoScrollHighlightStyle,
          ]}
        >
          {autoScrollEnabled ? (
            <Pause size={14} color="var(--app-accent)" />
          ) : (
            <Play size={14} color="var(--app-accent)" />
          )}
          <Text style={styles.autoScrollText}>{autoScrollLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onOpenQuickControls}
          style={[styles.actionButton, quickControlsHighlightStyle]}
        >
          <Menu size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onExitPlay}
          style={[styles.actionButton, exitHighlightStyle]}
        >
          <X size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
});
