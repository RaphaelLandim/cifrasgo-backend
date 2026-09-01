import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { ListMusic, Mic, Pause, Pencil, Play, StickyNote } from 'lucide-react';

const YoutubeBadgeIcon = ({ active, size = 22 }: { active: boolean; size?: number }) => (
  <Play size={size} color={active ? '#fff' : 'var(--app-muted-text)'} fill={active ? '#fff' : 'transparent'} />
);

interface SongBottomToolbarProps {
  hasAudioNote: boolean;
  audioNotePlaying: boolean;
  hasYoutubeUrl: boolean;
  hasPerformanceNoteDraft: boolean;
  selectedTom: string;
  onPlay: () => void;
  onAudio: () => void;
  onYoutube: () => void;
  onFontDown: () => void;
  onFontUp: () => void;
  onKey: () => void;
  onAddToPlaylist: () => void;
  onPostIt: () => void;
  onEdit: () => void;
  playHighlightStyle?: any;
  audioHighlightStyle?: any;
  youtubeHighlightStyle?: any;
  fontDownHighlightStyle?: any;
  fontUpHighlightStyle?: any;
  keyHighlightStyle?: any;
  addToPlaylistHighlightStyle?: any;
  postItHighlightStyle?: any;
  editHighlightStyle?: any;
}

export function SongBottomToolbar({
  hasAudioNote,
  audioNotePlaying,
  hasYoutubeUrl,
  hasPerformanceNoteDraft,
  selectedTom,
  onPlay,
  onAudio,
  onYoutube,
  onFontDown,
  onFontUp,
  onKey,
  onAddToPlaylist,
  onPostIt,
  onEdit,
  playHighlightStyle,
  audioHighlightStyle,
  youtubeHighlightStyle,
  fontDownHighlightStyle,
  fontUpHighlightStyle,
  keyHighlightStyle,
  addToPlaylistHighlightStyle,
  postItHighlightStyle,
  editHighlightStyle,
}: SongBottomToolbarProps) {
  return (
    <View style={styles.panel} data-swipe-ignore="true">
      <TouchableOpacity onPress={onPlay} style={[styles.panelBtn, playHighlightStyle]}>
        <Play size={18} color="#4FC3F7" />
      </TouchableOpacity>
      {hasAudioNote ? (
        <TouchableOpacity onPress={onAudio} style={[styles.panelBtn, audioHighlightStyle]}>
          {audioNotePlaying ? (
            <Pause size={17} color="#ff6b6b" />
          ) : (
            <Mic size={17} color="#ff6b6b" />
          )}
        </TouchableOpacity>
      ) : null}
      {hasYoutubeUrl ? (
        <TouchableOpacity onPress={onYoutube} style={[styles.panelBtn, styles.youtubePanelButton, youtubeHighlightStyle]}>
          <YoutubeBadgeIcon active size={18} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity onPress={onFontDown} style={[styles.panelBtn, fontDownHighlightStyle]}>
        <Text style={styles.fontButtonText}>A-</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onFontUp} style={[styles.panelBtn, fontUpHighlightStyle]}>
        <Text style={styles.fontButtonText}>A+</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onKey} style={[styles.panelBtn, keyHighlightStyle]}>
        <Text style={styles.transpose}>{selectedTom}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onAddToPlaylist} style={[styles.panelBtn, addToPlaylistHighlightStyle]}>
        <ListMusic size={17} color="#ffd166" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onPostIt}
        style={[styles.panelBtn, hasPerformanceNoteDraft ? styles.panelBtnActive : null, postItHighlightStyle]}
      >
        <StickyNote size={17} color={hasPerformanceNoteDraft ? '#051014' : '#fbbf24'} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onEdit} style={[styles.panelBtn, editHighlightStyle]}>
        <Pencil size={17} color="#4FC3F7" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: 'var(--app-border-soft)',
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: 'var(--app-header)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -8 },
    boxShadow: '0 -10px 28px rgba(0,0,0,0.28)',
  },
  panelBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelBtnActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent)',
  },
  youtubePanelButton: {
    borderColor: '#ff4d4d',
    backgroundColor: '#ff0000',
  },
  fontButtonText: {
    color: '#bbb',
    fontWeight: '700',
  },
  transpose: {
    color: 'var(--app-accent)',
    fontWeight: '900',
    minWidth: 42,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
  },
});
