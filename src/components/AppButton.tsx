import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { appTheme } from '../theme/theme';

interface AppButtonProps {
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  onPress: () => void;
}

export function AppButton({ label, icon, variant = 'primary', disabled = false, onPress }: AppButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, styles[variant], disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      {icon}
      <Text style={[styles.label, variant === 'primary' && styles.primaryLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: appTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: appTheme.spacing.sm,
    paddingHorizontal: appTheme.spacing.md,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: appTheme.colors.chord,
    borderColor: appTheme.colors.chord,
  },
  ghost: {
    backgroundColor: appTheme.colors.surface,
    borderColor: appTheme.colors.border,
  },
  danger: {
    backgroundColor: 'transparent',
    borderColor: appTheme.colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: appTheme.colors.text,
    fontSize: appTheme.typography.body,
    fontWeight: '800',
  },
  primaryLabel: {
    color: '#171717',
  },
});
