import { StyleSheet, Text, View } from 'react-native-web';
import { Music } from 'lucide-react';
import { ChordDiagram } from '../chords/ChordDiagram';
import { AppModal } from '../AppModal';
import type { ChordShape } from '../../lib/chordShapes';

interface ChordPreviewModalProps {
  visible: boolean;
  shape: ChordShape | null;
  onClose: () => void;
}

export function ChordPreviewModal({ visible, shape, onClose }: ChordPreviewModalProps) {
  if (!shape) return null;

  return (
    <AppModal
      visible={visible}
      title={`Acorde ${shape.chord}`}
      onClose={onClose}
      icon={<Music size={16} color="var(--app-accent)" />}
      maxWidth={460}
    >
      <View style={styles.content}>
        <Text style={styles.subtitle}>{shape.name}</Text>
        <ChordDiagram shape={shape} />
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  subtitle: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '800',
  },
});
