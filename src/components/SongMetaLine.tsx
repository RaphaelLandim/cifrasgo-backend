import { Text, View } from 'react-native-web';
import type { Song } from '../types/models';
import { getSongGenreDisplay } from '../utils/genres';

export function SongMetaLine({ song, styles }: { song: Song; styles: any }) {
  const genreDisplay = getSongGenreDisplay(song);
  return (
    <View style={styles.songMetaLine}>
      <Text style={[styles.subtitle, styles.songArtistText]} numberOfLines={1}>
        {(song.artist || '').trim() || 'Sem artista'}
      </Text>
      {genreDisplay ? (
        <>
          <Text style={styles.songMetaSeparator}>•</Text>
          <Text style={styles.songGenreInline} numberOfLines={1}>
            {genreDisplay}
          </Text>
        </>
      ) : null}
    </View>
  );
}
