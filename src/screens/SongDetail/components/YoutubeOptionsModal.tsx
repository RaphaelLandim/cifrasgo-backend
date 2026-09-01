import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { Copy, Play } from 'lucide-react';
import { AppModal } from '../../../components/AppModal';
import { YoutubeInlinePlayer } from './YoutubeInlinePlayer';

const YoutubeBadgeIcon = ({ active, size = 22 }: { active: boolean; size?: number }) => (
  <Play size={size} color={active ? '#fff' : 'var(--app-muted-text)'} fill={active ? '#fff' : 'transparent'} />
);

interface YoutubeOptionsModalProps {
  visible: boolean;
  title: string;
  artist?: string;
  youtubeUrl?: string;
  linkCopied: boolean;
  onClose: () => void;
  onOpenYoutube: () => void;
  onCopyLink: () => void;
}

export function YoutubeOptionsModal({
  visible,
  title,
  artist,
  youtubeUrl,
  linkCopied,
  onClose,
  onOpenYoutube,
  onCopyLink,
}: YoutubeOptionsModalProps) {
  const trimmedUrl = youtubeUrl?.trim() ?? '';
  const [playerOpen, setPlayerOpen] = useState(false);

  useEffect(() => {
    if (!visible) setPlayerOpen(false);
  }, [visible]);

  useEffect(() => {
    setPlayerOpen(false);
  }, [trimmedUrl]);

  return (
    <AppModal
      visible={visible}
      title="YouTube da música"
      onClose={onClose}
      icon={<YoutubeBadgeIcon active size={18} />}
      maxWidth={640}
      footer={
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: 'var(--app-muted-text)', fontWeight: '800' }}>Fechar</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView style={styles.scrollBody} contentContainerStyle={styles.body}>
        <View style={styles.infoBox}>
          <Text style={styles.songTitle} numberOfLines={1}>{title || 'Sem título'}</Text>
          {artist ? <Text style={styles.songArtist} numberOfLines={1}>{artist}</Text> : null}
        </View>
        {trimmedUrl ? (
          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={2}>{trimmedUrl}</Text>
          </View>
        ) : null}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionButton, playerOpen ? styles.playerActionActive : null]}
            onPress={() => setPlayerOpen((current) => !current)}
            disabled={!trimmedUrl}
          >
            <Play size={16} color={playerOpen ? '#fff' : 'var(--app-accent)'} fill={playerOpen ? '#fff' : 'transparent'} />
            <View style={styles.actionTextBlock}>
              <Text style={playerOpen ? styles.actionTitleLight : styles.actionTitle}>Player no app</Text>
              <Text style={playerOpen ? styles.actionSubtitleLight : styles.actionSubtitle}>
                {playerOpen ? 'Ocultar player' : 'Assistir dentro do CifrasGo'}
              </Text>
            </View>
          </TouchableOpacity>
          {playerOpen && trimmedUrl ? <YoutubeInlinePlayer youtubeUrl={trimmedUrl} /> : null}
          <TouchableOpacity style={[styles.actionButton, styles.primaryAction]} onPress={onOpenYoutube}>
            <YoutubeBadgeIcon active size={17} />
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitleLight}>Abrir no YouTube</Text>
              <Text style={styles.actionSubtitleLight}>Abre fora do CifrasGo</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onCopyLink}>
            <Copy size={16} color="var(--app-accent)" />
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>Copiar link da música</Text>
              <Text style={styles.actionSubtitle}>{linkCopied ? 'Link copiado' : 'Copiar para a área de transferência'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrollBody: {
    minHeight: 0,
  },
  body: {
    gap: 12,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  songTitle: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '900',
  },
  songArtist: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  linkBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 17,
  },
  actionGrid: {
    gap: 10,
  },
  actionButton: {
    minHeight: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryAction: {
    borderColor: '#ff4d4d',
    backgroundColor: '#ff0000',
  },
  playerActionActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent)',
  },
  actionTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  actionTitleLight: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  actionSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 11,
    marginTop: 2,
  },
  actionSubtitleLight: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    marginTop: 2,
  },
});
