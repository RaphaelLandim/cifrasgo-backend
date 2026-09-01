import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { Bolt, Globe2, Link2, Music, ShieldCheck, Wifi } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../services/storage';
import { scrapeSongFromUrl } from '../services/scraper';
import type { Song } from '../types/models';
import { extractUrlFromSharedText } from '../utils/links';

interface ImportScreenProps {
  initialUrl?: string;
  autoImportKey?: number;
  styles: any;
}

export function ImportScreen({
  initialUrl,
  autoImportKey,
  styles,
}: ImportScreenProps) {
  const nav = useManualNavigation();
  const { themeSettings } = useSettings();
  const isLightTheme = themeSettings.mode === 'light';
  const [url, setUrl] = useState(() => extractUrlFromSharedText(initialUrl) || '');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingSong, setExistingSong] = useState<Song | null>(null);
  const loadingRef = useRef(false);
  const lastAutoImportKeyRef = useRef<string | null>(null);

  const run = React.useCallback(async (nextUrl?: string) => {
    const rawUrl = (nextUrl ?? url).trim();
    const importUrl = (extractUrlFromSharedText(rawUrl) || rawUrl).trim();
    if (!importUrl) {
      const message = 'Informe uma URL do Cifra Club para importar.';
      setErrorMessage(message);
      Alert.alert('URL obrigatoria', message);
      return;
    }
    if (loadingRef.current) return;

    console.info('[CifrasGo ImportScreen] import started', { importUrl, autoImportKey });
    loadingRef.current = true;
    setErrorMessage(null);
    setUrl(importUrl);
    setLoading(true);
    try {
      const data = await scrapeSongFromUrl(importUrl);
      const songKey = `${data.artist.trim().toLowerCase()}::${data.title.trim().toLowerCase()}`;
      const currentSongs = await db.getSongs();
      const duplicate = currentSongs.find(
        (song) => `${song.artist.trim().toLowerCase()}::${song.title.trim().toLowerCase()}` === songKey
      );
      if (duplicate) {
        console.info('[CifrasGo ImportScreen] duplicate song found', { songId: duplicate.id, importUrl });
        setExistingSong(duplicate);
        return;
      }

      const song = await db.addSong({
        title: data.title,
        artist: data.artist,
        observation: '',
        content: data.content,
        sourceUrl: importUrl,
        updatedAt: Date.now(),
      });
      console.info('[CifrasGo ImportScreen] import succeeded', { songId: song.id, importUrl });
      nav.navigate('SongDetail', { id: song.id, returnTo: { name: 'Import' } });
    } catch (error) {
      console.info('[CifrasGo ImportScreen] import failed', { importUrl, error });
      const detail = error instanceof Error ? error.message : '';
      const message = detail
        ? `Nao foi possivel importar esta URL. Detalhe: ${detail}`
        : 'Nao foi possivel importar esta URL.';
      setErrorMessage(message);
      Alert.alert('Erro', message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [autoImportKey, nav, url]);

  const openExistingSong = React.useCallback(() => {
    if (!existingSong) return;
    const songId = existingSong.id;
    setExistingSong(null);
    nav.navigate('SongDetail', { id: songId, returnTo: { name: 'Import' } });
  }, [existingSong, nav]);

  useEffect(() => {
    const importUrl = extractUrlFromSharedText(initialUrl);
    if (importUrl) {
      console.info('[CifrasGo ImportScreen] initial URL received', { importUrl, autoImportKey });
      setUrl(importUrl);
    }
  }, [initialUrl]);

  useEffect(() => {
    const importUrl = extractUrlFromSharedText(initialUrl)?.trim();
    if (!importUrl || loading) return;

    const requestKey = `${autoImportKey ?? 'initialUrl'}:${importUrl}`;
    if (lastAutoImportKeyRef.current === requestKey) return;

    lastAutoImportKeyRef.current = requestKey;
    console.info('[CifrasGo ImportScreen] auto import triggered', { importUrl, autoImportKey, requestKey });
    setUrl(importUrl);
    void run(importUrl);
  }, [autoImportKey, initialUrl, loading, run]);

  return (
    <View style={styles.container}>
      <ScrollView style={localStyles.pageScroll} contentContainerStyle={localStyles.pageContent}>
        <View style={[localStyles.importCard, isLightTheme && localStyles.importCardLight]}>
          <View style={localStyles.cardHeader}>
            <View style={[localStyles.heroIcon, isLightTheme && localStyles.heroIconLight]}>
              <Globe2 size={56} color="#38bdf8" />
              <View style={localStyles.linkBadge}>
                <Link2 size={21} color="#ffffff" />
              </View>
            </View>
            <View style={localStyles.heroTextBlock}>
              <Text style={localStyles.heroTitle}>Importar cifra por URL</Text>
              <Text style={localStyles.heroSubtitle}>
                Cole o link de uma cifra para importar para o CifrasGo.
              </Text>
            </View>
          </View>

          <View style={[localStyles.inputPanel, isLightTheme && localStyles.inputPanelLight]}>
            <View style={localStyles.inputLabelRow}>
              <Link2 size={15} color="var(--app-accent)" />
              <Text style={localStyles.inputLabel}>URL da cifra</Text>
            </View>
            <TextInput
              style={[localStyles.urlInput, isLightTheme && localStyles.urlInputLight]}
              value={url}
              onChangeText={(value: string) => {
                setUrl(value);
                setErrorMessage(null);
              }}
              placeholder="https://..."
              placeholderTextColor="var(--app-subtle-text)"
              autoCapitalize="none"
            />
            <View style={[localStyles.helpBox, isLightTheme && localStyles.helpBoxLight]}>
              <Link2 size={15} color="var(--app-accent)" />
              <Text style={localStyles.helpText}>
                Cole aqui o link compartilhado de uma cifra para importar a musica.
              </Text>
            </View>
          </View>

          {errorMessage ? (
            <View style={localStyles.errorBox}>
              <Text style={localStyles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[localStyles.importButton, loading && localStyles.importButtonDisabled]}
            onPress={() => void run()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Link2 size={18} color="#ffffff" />
                <Text style={localStyles.importButtonText}>Importar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={localStyles.infoGrid}>
          {[
            {
              title: 'Online',
              text: 'Usa o backend configurado para buscar a cifra.',
              icon: <Wifi size={22} color="#38bdf8" />,
              tone: '#38bdf8',
            },
            {
              title: 'Seguro',
              text: 'A musica importada fica salva no seu repertorio.',
              icon: <ShieldCheck size={22} color="#22c55e" />,
              tone: '#22c55e',
            },
            {
              title: 'Rapido',
              text: 'Ideal para trazer cifras por link.',
              icon: <Bolt size={22} color="#a855f7" />,
              tone: '#a855f7',
            },
          ].map((item) => (
            <View key={item.title} style={[localStyles.infoCard, isLightTheme && localStyles.infoCardLight]}>
              <View style={[localStyles.infoIcon, { backgroundColor: `${item.tone}16`, borderColor: `${item.tone}38` }]}>
                {item.icon}
              </View>
              <View style={localStyles.infoTextBlock}>
                <Text style={localStyles.infoTitle}>{item.title}</Text>
                <Text style={localStyles.infoText}>{item.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={{ display: 'none' }}>
        <Globe2 size={44} color="#4FC3F7" />
        <Text style={styles.importTitle}>Importação</Text>
        <Text style={styles.importDesc}>Cole a URL da Cifra Aqui.</Text>
      </View>
      <AppModal
        visible={!!existingSong}
        title="Música já existente no app"
        icon={<Music size={16} color="var(--app-accent)" />}
        onClose={() => setExistingSong(null)}
        footer={
          <>
            <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setExistingSong(null)}>
              <Text style={styles.modalGhostText}>Fechar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={openExistingSong}>
              <Text style={styles.modalPrimaryText}>Abrir música</Text>
            </TouchableOpacity>
          </>
        }
      >
        <Text style={styles.subtitle}>
          {existingSong
            ? `"${existingSong.title}" de ${existingSong.artist} já está salva.`
            : ''}
        </Text>
      </AppModal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  pageScroll: {
    flex: 1,
    backgroundColor: 'var(--app-bg)',
  },
  pageContent: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
    gap: 18,
  },
  importCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.26)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(37,99,235,0.22) 0%, rgba(8,25,50,0.70) 48%, rgba(255,255,255,0.025) 100%)',
    padding: 20,
    gap: 18,
    boxShadow: '0 20px 42px rgba(0,0,0,0.26)',
  },
  importCardLight: {
    borderColor: 'rgba(15,131,201,0.18)',
    backgroundColor: '#fffdf8',
    backgroundImage: 'linear-gradient(135deg, rgba(255,253,248,0.98) 0%, rgba(238,244,248,0.92) 52%, rgba(214,232,241,0.55) 100%)',
    boxShadow: '0 20px 42px rgba(31,41,55,0.09)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    flexWrap: 'wrap',
  },
  heroIcon: {
    width: 104,
    height: 104,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.32)',
    backgroundColor: 'rgba(37,99,235,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
    boxShadow: '0 16px 34px rgba(37,99,235,0.22)',
  },
  heroIconLight: {
    borderColor: 'rgba(15,131,201,0.22)',
    backgroundColor: 'rgba(15,131,201,0.10)',
    boxShadow: '0 16px 34px rgba(15,131,201,0.12)',
  },
  linkBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 220,
  },
  heroTitle: {
    color: 'var(--app-text)',
    fontSize: 22,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 8,
  },
  inputPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'rgba(8,18,32,0.36)',
    padding: 14,
    gap: 10,
  },
  inputPanelLight: {
    borderColor: 'rgba(15,131,201,0.14)',
    backgroundColor: 'rgba(255,253,248,0.78)',
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  inputLabel: {
    color: 'var(--app-accent)',
    fontSize: 12,
    fontWeight: '900',
  },
  urlInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.28)',
    backgroundColor: 'rgba(2,8,23,0.56)',
    color: 'var(--app-text)',
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    outlineStyle: 'none',
  },
  urlInputLight: {
    borderColor: 'rgba(15,131,201,0.18)',
    backgroundColor: 'rgba(255,253,248,0.96)',
  },
  helpBox: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpBoxLight: {
    borderColor: 'rgba(15,131,201,0.12)',
    backgroundColor: 'rgba(238,244,248,0.76)',
  },
  helpText: {
    flex: 1,
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.28)',
    backgroundColor: 'rgba(220,38,38,0.10)',
    padding: 12,
  },
  errorText: {
    color: 'var(--app-danger)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  importButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    boxShadow: '0 14px 28px rgba(37,99,235,0.28)',
  },
  importButtonDisabled: {
    opacity: 0.55,
  },
  importButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    minWidth: 190,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(255,255,255,0.02) 100%)',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    boxShadow: '0 12px 24px rgba(0,0,0,0.16)',
  },
  infoCardLight: {
    borderColor: 'rgba(15,131,201,0.12)',
    backgroundColor: '#fffdf8',
    backgroundImage: 'linear-gradient(135deg, rgba(15,131,201,0.055) 0%, rgba(255,253,248,0.96) 100%)',
    boxShadow: '0 12px 24px rgba(31,41,55,0.07)',
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  infoTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  infoText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
});
