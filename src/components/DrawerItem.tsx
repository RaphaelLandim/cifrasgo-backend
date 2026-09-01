import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { ChevronRight } from 'lucide-react';

export function DrawerItem({
  icon,
  label,
  onPress,
  styles: _styles,
  subtitle,
  count,
  tone = '#38bdf8',
  variant = 'row',
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  styles: any;
  subtitle?: string;
  count?: number;
  tone?: string;
  variant?: 'tile' | 'row';
}) {
  const isTile = variant === 'tile';
  return (
    <TouchableOpacity
      style={[localStyles.item, isTile ? localStyles.tileItem : localStyles.rowItem]}
      onPress={onPress}
      activeOpacity={0.86}
    >
      {isTile ? (
        <View style={localStyles.tileTopRow}>
          <View
            style={[
              localStyles.iconBox,
              {
                backgroundColor: `${tone}16`,
                borderColor: `${tone}33`,
                boxShadow: `0 10px 20px ${tone}12`,
              },
            ]}
          >
            {icon}
          </View>
          {typeof count === 'number' ? (
            <Text style={localStyles.tileCount} numberOfLines={1} adjustsFontSizeToFit>
              {count}
            </Text>
          ) : null}
        </View>
      ) : (
        <View
          style={[
            localStyles.iconBox,
            {
              backgroundColor: `${tone}16`,
              borderColor: `${tone}33`,
              boxShadow: `0 10px 20px ${tone}12`,
            },
          ]}
        >
          {icon}
        </View>
      )}
      <View style={localStyles.textBlock}>
        <Text style={localStyles.label} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={localStyles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {!isTile ? (
        <View style={localStyles.chevron}>
          <ChevronRight size={15} color="var(--app-subtle-text)" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const localStyles = StyleSheet.create({
  item: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(14,165,233,0.055), rgba(255,255,255,0.025))',
    boxShadow: '0 10px 18px rgba(0,0,0,0.10)',
  },
  rowItem: {
    minHeight: 54,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  tileItem: {
    flex: 1,
    minWidth: 104,
    minHeight: 86,
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-between',
    gap: 8,
  },
  tileTopRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tileCount: {
    flex: 1,
    minWidth: 0,
    color: 'var(--app-text)',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'right',
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  subtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  chevron: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    flexShrink: 0,
  },
});
