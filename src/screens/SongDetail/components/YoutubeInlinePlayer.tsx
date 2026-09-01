import React from 'react';
import { StyleSheet, Text, View } from 'react-native-web';
import { getYoutubeEmbedUrl } from './youtubeEmbed';

interface YoutubeInlinePlayerProps {
  youtubeUrl: string;
}

const iframeStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  border: 0,
  display: 'block',
};

export function YoutubeInlinePlayer({ youtubeUrl }: YoutubeInlinePlayerProps) {
  const embedUrl = getYoutubeEmbedUrl(youtubeUrl);

  if (!embedUrl) {
    return (
      <View style={styles.fallbackBox}>
        <Text style={styles.fallbackTitle}>Player indisponivel</Text>
        <Text style={styles.fallbackText}>
          Nao foi possivel carregar o player no app. Use Abrir no YouTube para acessar o video.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.playerShell}>
      {React.createElement('iframe', {
        src: embedUrl,
        title: 'Player do YouTube',
        style: iframeStyle,
        allow: 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowFullScreen: true,
        loading: 'lazy',
        referrerPolicy: 'strict-origin-when-cross-origin',
      } as any)}
    </View>
  );
}

const styles = StyleSheet.create({
  playerShell: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: '#000',
  },
  fallbackBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
    gap: 4,
  },
  fallbackTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  fallbackText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 17,
  },
});
