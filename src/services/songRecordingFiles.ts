import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const SONG_RECORDINGS_DIRECTORY = Directory.Data;
const SONG_RECORDINGS_PATH_PREFIX = 'recordings/';

export interface SongRecordingPlaybackSource {
  url: string;
  cleanup: () => void;
}

export interface ManagedSongRecordingFile {
  path: string;
  size: number;
}

export interface SongRecordingDirectoryListing {
  files: ManagedSongRecordingFile[];
  ignoredEntries: string[];
}

export const normalizeSongRecordingPath = (path: string): string => {
  const normalized = path.trim().replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized) ||
    segments.length !== 2 ||
    segments[0] !== SONG_RECORDINGS_PATH_PREFIX.slice(0, -1) ||
    !segments[1] ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('Referencia de gravacao invalida.');
  }
  return normalized;
};

export const songRecordingBase64ToBlob = (base64: string, mimeType: string): Blob => {
  const payload = base64.includes(',') ? base64.split(',').pop() || '' : base64;
  const binary = atob(payload.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const payload = result.includes(',') ? result.split(',')[1] : result;
      if (!payload) {
        reject(new Error('Audio vazio.'));
        return;
      }
      resolve(payload);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Nao foi possivel processar o audio.'));
    reader.readAsDataURL(blob);
  });

export const isSongRecordingFilesystemAvailable = (): boolean => {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== 'undefined' && 'indexedDB' in window;
};

export const getSongRecordingExtension = (mimeType: string): string => {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  if (normalized === 'audio/mp4' || normalized === 'audio/m4a' || normalized === 'audio/x-m4a') return 'm4a';
  if (normalized === 'audio/ogg') return 'ogg';
  if (normalized === 'audio/mpeg') return 'mp3';
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav') return 'wav';
  return 'webm';
};

export const createSongRecordingPath = (mimeType: string): string => {
  const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11);
  return `${SONG_RECORDINGS_PATH_PREFIX}${id}.${getSongRecordingExtension(mimeType)}`;
};

export const saveSongRecordingFile = async (blob: Blob, mimeType: string): Promise<string> => {
  if (!blob.size) throw new Error('A gravacao esta vazia.');
  if (!isSongRecordingFilesystemAvailable()) {
    throw new Error('O armazenamento de gravacoes nao esta disponivel neste aparelho.');
  }

  const path = createSongRecordingPath(mimeType);
  try {
    const data = Capacitor.isNativePlatform() ? await blobToBase64(blob) : blob;
    await Filesystem.writeFile({
      path,
      data,
      directory: SONG_RECORDINGS_DIRECTORY,
      recursive: true,
    });
    if (!(await songRecordingFileExists(path))) {
      throw new Error('Nao foi possivel validar o arquivo da gravacao.');
    }
    return path;
  } catch (error) {
    await deleteSongRecordingFile(path);
    throw error;
  }
};

export const songRecordingFileExists = async (path: string): Promise<boolean> => {
  try {
    const result = await Filesystem.stat({
      path: normalizeSongRecordingPath(path),
      directory: SONG_RECORDINGS_DIRECTORY,
    });
    return result.type === 'file' && result.size > 0;
  } catch {
    return false;
  }
};

export const resolveSongRecordingPlaybackSource = async (
  path: string,
  mimeType: string,
): Promise<SongRecordingPlaybackSource> => {
  const normalizedPath = normalizeSongRecordingPath(path);
  if (!(await songRecordingFileExists(normalizedPath))) {
    throw new Error('Arquivo de gravacao nao encontrado.');
  }

  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.getUri({
      path: normalizedPath,
      directory: SONG_RECORDINGS_DIRECTORY,
    });
    return {
      url: Capacitor.convertFileSrc(result.uri),
      cleanup: () => undefined,
    };
  }

  const result = await Filesystem.readFile({
    path: normalizedPath,
    directory: SONG_RECORDINGS_DIRECTORY,
  });
  const blob = typeof result.data === 'string'
    ? songRecordingBase64ToBlob(result.data, mimeType)
    : new Blob([await result.data.arrayBuffer()], { type: mimeType });
  const url = URL.createObjectURL(blob);
  let revoked = false;
  return {
    url,
    cleanup: () => {
      if (revoked) return;
      URL.revokeObjectURL(url);
      revoked = true;
    },
  };
};

export const readSongRecordingFile = async (path: string, mimeType: string): Promise<Blob> => {
  const normalizedPath = normalizeSongRecordingPath(path);
  if (!(await songRecordingFileExists(normalizedPath))) {
    throw new Error('Arquivo de gravacao nao encontrado.');
  }
  const result = await Filesystem.readFile({
    path: normalizedPath,
    directory: SONG_RECORDINGS_DIRECTORY,
  });
  return typeof result.data === 'string'
    ? songRecordingBase64ToBlob(result.data, mimeType)
    : new Blob([await result.data.arrayBuffer()], { type: mimeType });
};

export const deleteSongRecordingFile = async (path?: string): Promise<boolean> => {
  if (!path?.trim()) return true;
  try {
    await Filesystem.deleteFile({
      path: normalizeSongRecordingPath(path),
      directory: SONG_RECORDINGS_DIRECTORY,
    });
    return true;
  } catch {
    return false;
  }
};

export const listManagedSongRecordingFiles = async (): Promise<SongRecordingDirectoryListing> => {
  let entries;
  try {
    entries = (await Filesystem.readdir({
      path: SONG_RECORDINGS_PATH_PREFIX.slice(0, -1),
      directory: SONG_RECORDINGS_DIRECTORY,
    })).files;
  } catch {
    try {
      await Filesystem.mkdir({
        path: SONG_RECORDINGS_PATH_PREFIX.slice(0, -1),
        directory: SONG_RECORDINGS_DIRECTORY,
        recursive: true,
      });
    } catch {
      // O diretorio pode ter sido criado por outra operacao entre as chamadas.
    }
    try {
      entries = (await Filesystem.readdir({
        path: SONG_RECORDINGS_PATH_PREFIX.slice(0, -1),
        directory: SONG_RECORDINGS_DIRECTORY,
      })).files;
    } catch {
      throw new Error('Nao foi possivel acessar o armazenamento das gravacoes.');
    }
  }

  const files: ManagedSongRecordingFile[] = [];
  const ignoredEntries: string[] = [];
  entries.forEach((entry) => {
    if (entry.type !== 'file') {
      ignoredEntries.push(entry.name);
      return;
    }
    try {
      const path = normalizeSongRecordingPath(`${SONG_RECORDINGS_PATH_PREFIX}${entry.name}`);
      files.push({ path, size: Number.isFinite(entry.size) ? Math.max(0, entry.size) : 0 });
    } catch {
      ignoredEntries.push(entry.name);
    }
  });
  return { files, ignoredEntries };
};
