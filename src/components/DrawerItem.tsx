import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native-web';

export function DrawerItem({
  icon,
  label,
  onPress,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  styles: any;
}) {
  return (
    <TouchableOpacity style={styles.drawerItem} onPress={onPress}>
      <View style={{ width: 24, alignItems: 'center' }}>{icon}</View>
      <Text style={styles.drawerItemText}>{label}</Text>
    </TouchableOpacity>
  );
}
