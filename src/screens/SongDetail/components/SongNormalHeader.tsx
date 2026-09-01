import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native-web';

interface SongNormalHeaderProps {
  title: string;
  artist: string;
  genreDisplay: string;
  titleStyle: any;
  subtitleStyle: any;
  genreBadgeStyle: any;
  metronomeIndicators: ReactNode;
}

export function SongNormalHeader({
  title,
  artist,
  genreDisplay,
  titleStyle,
  subtitleStyle,
  genreBadgeStyle,
  metronomeIndicators,
}: SongNormalHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.textBlock}>
        <Text style={[titleStyle, styles.title]} numberOfLines={1}>{title}</Text>
        <Text style={[subtitleStyle, { marginBottom: genreDisplay ? 4 : 8 }]}>{artist}</Text>
        {genreDisplay ? (
          <Text style={[genreBadgeStyle, styles.genreBadge]}>{genreDisplay}</Text>
        ) : null}
      </View>
      {metronomeIndicators}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    marginHorizontal: 0,
    marginBottom: 6,
  },
  genreBadge: {
    marginHorizontal: 0,
    marginBottom: 8,
  },
});
