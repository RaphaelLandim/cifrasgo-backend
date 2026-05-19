import { Search } from 'lucide-react';
import { StyleSheet, TextInput, View } from 'react-native';
import { appTheme } from '../theme/theme';

interface SearchBarProps {
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
}

export function SearchBar({ value, placeholder, onChangeText }: SearchBarProps) {
  return (
    <View style={styles.search}>
      <Search size={18} color={appTheme.colors.subtleText} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={appTheme.colors.subtleText}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 44,
    borderRadius: appTheme.radius.md,
    borderWidth: 1,
    borderColor: appTheme.colors.border,
    backgroundColor: appTheme.colors.surface,
    marginHorizontal: appTheme.spacing.md,
    marginVertical: appTheme.spacing.md,
    paddingHorizontal: appTheme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: appTheme.spacing.sm,
  },
  input: {
    flex: 1,
    color: appTheme.colors.text,
    outlineStyle: 'none',
  } as object,
});
