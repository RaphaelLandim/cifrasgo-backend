import { StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { AppModal } from '../../../components/AppModal';
import type { MusicKey } from '../../../utils/chordKeys';

interface TomSelectorModalProps {
  visible: boolean;
  selectedTom: MusicKey;
  keyOptions: readonly MusicKey[];
  onClose: () => void;
  onSelectTom: (key: MusicKey) => void;
}

export function TomSelectorModal({
  visible,
  selectedTom,
  keyOptions,
  onClose,
  onSelectTom,
}: TomSelectorModalProps) {
  return (
    <AppModal
      visible={visible}
      title="Selecionar tom"
      onClose={onClose}
      maxWidth={420}
      footer={
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.footerText}>Fechar</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.keyGrid}>
        {keyOptions.map((key) => {
          const selected = selectedTom === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.keyButton,
                selected ? styles.keyButtonSelected : styles.keyButtonDefault,
              ]}
              onPress={() => onSelectTom(key)}
            >
              <Text style={[styles.keyText, selected ? styles.keyTextSelected : styles.keyTextDefault]}>
                {key}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  footerText: {
    color: 'var(--app-muted-text)',
    fontWeight: '800',
  },
  keyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keyButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  keyButtonDefault: {
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
  },
  keyButtonSelected: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  keyText: {
    fontWeight: '800',
  },
  keyTextDefault: {
    color: 'var(--app-text)',
  },
  keyTextSelected: {
    color: 'var(--app-accent)',
  },
});
