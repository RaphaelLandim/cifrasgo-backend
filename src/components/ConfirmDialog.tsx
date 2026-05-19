import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native-web';
import { Trash2 } from 'lucide-react';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ActiveConfirmDialog
  extends Required<Pick<ConfirmDialogOptions, 'title' | 'message' | 'confirmLabel' | 'cancelLabel'>> {
  detail?: string;
}

export const ConfirmDialogContext = React.createContext<((options: ConfirmDialogOptions) => Promise<boolean>) | null>(null);

interface ConfirmDialogController {
  isDialogOpen: boolean;
  closeConfirmation: (confirmed: boolean) => void;
}

const ConfirmDialogControllerContext = React.createContext<ConfirmDialogController | null>(null);

export function ConfirmDialogProvider({ children, styles }: { children: React.ReactNode; styles: any }) {
  const [dialog, setDialog] = React.useState<ActiveConfirmDialog | null>(null);
  const confirmResolveRef = React.useRef<((confirmed: boolean) => void) | null>(null);

  const requestConfirmation = React.useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current?.(false);
      confirmResolveRef.current = resolve;
      setDialog({
        title: options.title,
        message: options.message,
        detail: options.detail,
        confirmLabel: options.confirmLabel || 'Confirmar',
        cancelLabel: options.cancelLabel || 'Cancelar',
      });
    });
  }, []);

  const closeConfirmation = React.useCallback((confirmed: boolean) => {
    const resolve = confirmResolveRef.current;
    confirmResolveRef.current = null;
    setDialog(null);
    resolve?.(confirmed);
  }, []);

  React.useEffect(() => {
    return () => {
      confirmResolveRef.current?.(false);
      confirmResolveRef.current = null;
    };
  }, []);

  const controller = React.useMemo(
    () => ({ isDialogOpen: !!dialog, closeConfirmation }),
    [closeConfirmation, dialog]
  );

  return (
    <ConfirmDialogContext.Provider value={requestConfirmation}>
      <ConfirmDialogControllerContext.Provider value={controller}>
        {children}
        <ConfirmDialogModal dialog={dialog} styles={styles} onClose={closeConfirmation} />
      </ConfirmDialogControllerContext.Provider>
    </ConfirmDialogContext.Provider>
  );
}

export const useConfirmDialogController = () => {
  const controller = React.useContext(ConfirmDialogControllerContext);
  if (!controller) throw new Error('ConfirmDialogControllerContext not available');
  return controller;
};

export const useConfirmDestructiveAction = () => {
  const confirm = React.useContext(ConfirmDialogContext);
  if (!confirm) throw new Error('ConfirmDialogContext not available');
  return (message: string, title = 'Confirmar exclusão', confirmLabel = 'Excluir') =>
    confirm({
      title,
      message,
      detail: 'Essa ação não poderá ser desfeita.',
      confirmLabel,
      cancelLabel: 'Cancelar',
    });
};

export function ConfirmDialogModal({
  dialog,
  styles,
  onClose,
}: {
  dialog: ActiveConfirmDialog | null;
  styles: any;
  onClose: (confirmed: boolean) => void;
}) {
  return (
    <Modal
      visible={!!dialog}
      transparent
      animationType="fade"
      onRequestClose={() => onClose(false)}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmCard}>
          <View style={styles.confirmIconWrap}>
            <Trash2 size={24} color="#ff7a7a" />
          </View>
          <Text style={styles.confirmTitle}>{dialog?.title}</Text>
          <Text style={styles.confirmMessage}>{dialog?.message}</Text>
          {dialog?.detail ? (
            <Text style={styles.confirmDetail}>{dialog.detail}</Text>
          ) : null}
          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => onClose(false)}>
              <Text style={styles.confirmCancelText}>{dialog?.cancelLabel || 'Cancelar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmDeleteBtn} onPress={() => onClose(true)}>
              <Text style={styles.confirmDeleteText}>{dialog?.confirmLabel || 'Excluir'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
