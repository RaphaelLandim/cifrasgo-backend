import { StyleSheet, Text } from 'react-native-web';

interface SongObservationBlockProps {
  observation: string;
}

export function SongObservationBlock({ observation }: SongObservationBlockProps) {
  return <Text style={styles.observation}>{observation}</Text>;
}

const styles = StyleSheet.create({
  observation: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    marginHorizontal: 12,
    marginBottom: 10,
    fontStyle: 'italic',
  },
});
