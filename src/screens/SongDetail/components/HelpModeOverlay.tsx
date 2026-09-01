import type { CSSProperties, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { X } from 'lucide-react';

interface HelpModeItem {
  title: string;
  description: string;
  icon: ReactNode;
}

interface HelpModeOverlayProps {
  visible: boolean;
  activeItem: HelpModeItem | null;
  onDismissItem: () => void;
}

export function HelpModeOverlay({
  visible,
  activeItem,
  onDismissItem,
}: HelpModeOverlayProps) {
  if (!visible) return null;

  return (
    <>
      <div style={domStyles.backdrop} />

      {activeItem ? (
        <View style={styles.card} data-swipe-ignore="true">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Fechar explicacao"
            onPress={onDismissItem}
            style={styles.cardCloseButton}
          >
            <X size={15} color="var(--app-muted-text)" />
          </TouchableOpacity>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              {activeItem.icon}
            </View>
            <Text style={styles.cardTitle}>{activeItem.title}</Text>
          </View>
          <Text style={styles.cardText}>{activeItem.description}</Text>
          <TouchableOpacity
            onPress={onDismissItem}
            style={styles.cardButton}
          >
            <Text style={styles.cardButtonText}>Entendi</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );
}

const domStyles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    pointerEvents: 'none',
  },
};

const styles = StyleSheet.create({
  card: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    zIndex: 81,
    width: 'calc(100% - 32px)',
    maxWidth: 520,
    transform: 'translate(-50%, -50%)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    boxShadow: '0 22px 58px rgba(0, 0, 0, 0.38)',
  },
  cardCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 8,
    paddingRight: 30,
  },
  cardIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-accent-soft)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  cardTitle: {
    flex: 1,
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '900',
  },
  cardText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  cardButton: {
    alignSelf: 'flex-end',
    marginTop: 10,
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-accent-soft)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  cardButtonText: {
    color: 'var(--app-accent)',
    fontSize: 12,
    fontWeight: '900',
  },
});
