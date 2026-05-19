import type { ReactNode } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { X } from 'lucide-react';

interface AppModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  showCloseButton?: boolean;
}

export function AppModal({
  visible,
  title,
  onClose,
  children,
  icon,
  footer,
  maxWidth = 520,
  showCloseButton = true,
}: AppModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { maxWidth }]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
            {showCloseButton ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar modal"
                onPress={onClose}
                style={styles.closeButton}
              >
                <X size={22} color="var(--app-muted-text)" />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'var(--app-overlay)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    overflow: 'hidden',
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.32)',
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'var(--app-header)',
    borderBottomWidth: 1,
    borderBottomColor: 'var(--app-border-soft)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconSlot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-surface-soft)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  title: {
    flex: 1,
    minWidth: 0,
    color: 'var(--app-text)',
    fontSize: 16,
    fontWeight: '900',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    backgroundColor: 'var(--app-surface)',
    padding: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
