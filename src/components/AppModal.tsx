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
  subtitle?: string;
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
  subtitle,
}: AppModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { maxWidth }]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
              <View style={styles.titleTextBlock}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
              </View>
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
    minHeight: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.20)',
    backgroundColor: 'var(--app-surface)',
    overflow: 'hidden',
    boxShadow: '0 24px 54px rgba(0, 0, 0, 0.26), 0 0 0 1px rgba(56, 189, 248, 0.05)',
  },
  header: {
    minHeight: 62,
    flexShrink: 0,
    paddingHorizontal: 18,
    paddingVertical: 13,
    backgroundColor: 'var(--app-header)',
    backgroundImage:
      'linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(15, 23, 42, 0.05) 54%, rgba(168, 85, 247, 0.08))',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.16)',
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
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.24)',
    boxShadow: '0 10px 18px rgba(14, 165, 233, 0.10)',
    flexShrink: 0,
  },
  titleTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: 'var(--app-text)',
    fontSize: 17,
    fontWeight: '900',
  },
  subtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-surface-soft)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    flexShrink: 0,
  },
  body: {
    backgroundColor: 'var(--app-surface)',
    padding: 16,
    flexShrink: 1,
    minHeight: 0,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.16)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(180deg, rgba(14, 165, 233, 0.03), rgba(15, 23, 42, 0.02))',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
