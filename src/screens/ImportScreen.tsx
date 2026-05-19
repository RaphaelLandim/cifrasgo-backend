import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { Globe, Music } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
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
    <View style={[styles.container, { padding: 16 }]}>
      <View style={styles.importBanner}>
        <Globe size={44} color="#4FC3F7" />
        <Text style={styles.importTitle}>Importação</Text>
        <Text style={styles.importDesc}>Cole a URL da Cifra Aqui.</Text>
      </View>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={(value: string) => {
          setUrl(value);
          setErrorMessage(null);
        }}
        placeholder="https://..."
        placeholderTextColor="#666"
        autoCapitalize="none"
      />
      {errorMessage ? (
        <Text style={{ color: 'var(--app-danger)', marginHorizontal: 12, marginBottom: 8 }}>
          {errorMessage}
        </Text>
      ) : null}
      <TouchableOpacity style={styles.primaryBtn} onPress={() => void run()} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '700' }}>Importar</Text>}
      </TouchableOpacity>

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
