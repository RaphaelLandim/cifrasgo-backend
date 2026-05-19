import { Alert } from 'react-native-web';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import JSZip from 'jszip';
import type { Playlist, Song } from '../types/models';
import { getSongGenreDisplay } from '../utils/genres';
import { buildCifrasGoSongTextFile } from './songTextFormat';
export { buildCifrasGoSongTextFile } from './songTextFormat';

interface CifrasGoPlaylistExport {
  app: 'CifrasGo';
  format: 'playlist';
  version: 1;
  exportedAt: number;
  playlist: {
    id: string;
    name: string;
    songIds: string[];
    genres?: string[];
  };
  songs: Array<{
    id: string;
    title: string;
    artist: string;
    genre?: string;
    genres?: string[];
    observation?: string;
    content: string;
    sourceUrl?: string;
    preferredFontSize?: number;
    updatedAt?: number;
  }>;
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const isAndroidCapacitor = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const getShareErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Erro desconhecido.';
};

const isShareCanceled = (error: unknown): boolean => {
  const message = getShareErrorMessage(error).toLowerCase();
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    message.includes('share canceled') ||
    message.includes('share cancelled') ||
    message.includes('compartilhamento cancelado')
  );
};

const showNativeShareError = (fileName: string, error: unknown): void => {
  const message = [
    `Não foi possível compartilhar "${fileName}" pelo Android.`,
    '',
    `Detalhes: ${getShareErrorMessage(error)}`,
    '',
    'Verifique se o app foi sincronizado com Capacitor depois de instalar os plugins de compartilhamento.',
  ].join('\n');

  console.error('[shareBlobFile] Android share failed', error);
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`Falha ao compartilhar arquivo\n\n${message}`);
    return;
  }
  Alert.alert('Falha ao compartilhar arquivo', message);
};

const shareBlobFileNative = async ({
  blob,
  fileName,
  title,
  text,
}: {
  blob: Blob;
  fileName: string;
  title: string;
  text: string;
}): Promise<void> => {
  const base64 = await blobToBase64(blob);
  const path = `share/${Date.now()}-${sanitizeFileName(fileName)}`;
  const savedFile = await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });
  const uriResult = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  });
  const fileUri = uriResult.uri || savedFile.uri;

  await Share.share({
    title,
    text,
    files: [fileUri],
    dialogTitle: title,
  });
};

export const sanitizeFileName = (value: string): string => {
  const safeName = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return safeName || 'musica';
};

export const buildSongTextFile = (song: Song): string => {
  const lines = [
    (song.title || '').trim() || 'Sem titulo',
    (song.artist || '').trim() ? `Artista: ${song.artist.trim()}` : 'Artista: Sem artista',
    getSongGenreDisplay(song) ? `Genero: ${getSongGenreDisplay(song)}` : '',
    song.observation?.trim() ? `Observacao: ${song.observation.trim()}` : '',
    '',
    song.content || '',
  ];
  return lines.filter((line, index) => index >= 4 || !!line).join('\n');
};

export const downloadBlobFile = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
};

export const shareBlobFile = async ({
  blob,
  fileName,
  title,
  text,
  fallbackMessage,
}: {
  blob: Blob;
  fileName: string;
  title: string;
  text: string;
  fallbackMessage: string;
}): Promise<boolean> => {
  if (isAndroidCapacitor()) {
    try {
      await shareBlobFileNative({ blob, fileName, title, text });
      return true;
    } catch (error) {
      if (isShareCanceled(error)) return false;
      showNativeShareError(fileName, error);
      return false;
    }
  }

  const shareApi = window.navigator as Navigator & {
    canShare?: (data: ShareData & { files?: File[] }) => boolean;
    share?: (data: ShareData & { files?: File[] }) => Promise<void>;
  };

  try {
    if (shareApi.share && typeof File !== 'undefined') {
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const shareData = { title, text, files: [file] };
      const hasCanShare = typeof shareApi.canShare === 'function';

      if (!hasCanShare || shareApi.canShare?.(shareData)) {
        await shareApi.share(shareData);
        return true;
      }
    }

    downloadBlobFile(blob, fileName);
    Alert.alert('Arquivo gerado', fallbackMessage);
    return true;
  } catch (error: any) {
    if (error?.name === 'AbortError') return false;
    downloadBlobFile(blob, fileName);
    Alert.alert('Compartilhamento indisponível', fallbackMessage);
    return true;
  }
};

export const buildPlaylistZip = async (playlist: Playlist, songsById: Map<string, Song>): Promise<Blob> => {
  const zip = new JSZip();
  const playlistName = playlist.name.trim() || 'Lista';
  const songs = playlist.songIds
    .map((songId) => songsById.get(songId))
    .filter((song): song is Song => !!song);
  const manifest: CifrasGoPlaylistExport = {
    app: 'CifrasGo',
    format: 'playlist',
    version: 1,
    exportedAt: Date.now(),
    playlist: {
      id: playlist.id,
      name: playlistName,
      songIds: songs.map((song) => song.id),
      genres: playlist.genres,
    },
    songs: songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      genre: song.genre,
      genres: song.genres,
      observation: song.observation,
      content: song.content,
      sourceUrl: song.sourceUrl,
      preferredFontSize: song.preferredFontSize,
      updatedAt: song.updatedAt,
    })),
  };

  zip.file('cifrasgo-playlist.json', JSON.stringify(manifest, null, 2));

  zip.file(
    'lista.txt',
    [
      `Lista: ${playlistName}`,
      `Total de musicas: ${songs.length}`,
      '',
      ...songs.map((song, index) => `${index + 1}. ${song.title || 'Sem titulo'} - ${song.artist || 'Sem artista'}`),
    ].join('\n')
  );

  const songsFolder = zip.folder('musicas') || zip;
  songs.forEach((song, index) => {
    const prefix = String(index + 1).padStart(2, '0');
    const fileName = sanitizeFileName(`${prefix} - ${song.title || 'musica'}${song.artist ? ` - ${song.artist}` : ''}`);
    songsFolder.file(`${fileName}.txt`, buildCifrasGoSongTextFile(song));
  });

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};
