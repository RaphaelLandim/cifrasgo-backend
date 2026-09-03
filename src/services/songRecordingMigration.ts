import type { Song } from '../types/models';
import {
  deleteSongRecordingFile,
  isSongRecordingFilesystemAvailable,
  saveSongRecordingFile,
  songRecordingBase64ToBlob,
  songRecordingFileExists,
} from './songRecordingFiles';
import { db } from './storage';

export interface SongRecordingMigrationProgress {
  done: number;
  total: number;
  title: string;
}

export interface SongRecordingMigrationFailure {
  songId: string;
  title: string;
  reason: string;
}

export interface SongRecordingMigrationResult {
  total: number;
  migrated: number;
  failures: SongRecordingMigrationFailure[];
  stoppedReason?: string;
}

interface SongRecordingMigrationOptions {
  onProgress?: (progress: SongRecordingMigrationProgress) => void;
}

const withoutLegacyBase64 = (song: Song, audioNoteFile?: string): Song => {
  const migrated = {
    ...song,
    ...(audioNoteFile ? { audioNoteFile } : {}),
  };
  delete migrated.audioNoteBase64;
  return migrated;
};

const migrationFailure = (song: Song, reason: string): SongRecordingMigrationFailure => ({
  songId: song.id,
  title: song.title || 'Sem titulo',
  reason,
});

export const countLegacySongRecordings = (songs: Song[]): number =>
  songs.filter((song) => !!song.audioNoteBase64?.trim()).length;

export const migrateLegacySongRecordings = async (
  options: SongRecordingMigrationOptions = {},
): Promise<SongRecordingMigrationResult> => {
  let workingSongs = await db.getSongs();
  const candidateIds = workingSongs
    .filter((song) => !!song.audioNoteBase64?.trim())
    .map((song) => song.id);
  const result: SongRecordingMigrationResult = {
    total: candidateIds.length,
    migrated: 0,
    failures: [],
  };

  if (!candidateIds.length) return result;
  if (!isSongRecordingFilesystemAvailable()) {
    return {
      ...result,
      stoppedReason: 'O armazenamento de gravacoes nao esta disponivel neste aparelho.',
    };
  }

  for (let index = 0; index < candidateIds.length; index += 1) {
    const songId = candidateIds[index];
    const songIndex = workingSongs.findIndex((song) => song.id === songId);
    if (songIndex < 0) continue;
    const song = workingSongs[songIndex];
    const title = song.title || 'Sem titulo';
    let nextFile: string | undefined;
    let createdFile: string | undefined;

    if (!song.audioNoteMimeType?.trim()) {
      result.failures.push(migrationFailure(song, 'Tipo do arquivo de audio nao identificado.'));
      options.onProgress?.({ done: index + 1, total: candidateIds.length, title });
      continue;
    }

    if (song.audioNoteFile?.trim() && await songRecordingFileExists(song.audioNoteFile)) {
      nextFile = song.audioNoteFile;
    } else {
      let blob: Blob;
      try {
        blob = songRecordingBase64ToBlob(song.audioNoteBase64 || '', song.audioNoteMimeType);
        if (!blob.size) throw new Error('Audio vazio.');
      } catch {
        result.failures.push(migrationFailure(song, 'A gravacao antiga esta corrompida.'));
        options.onProgress?.({ done: index + 1, total: candidateIds.length, title });
        continue;
      }

      try {
        createdFile = await saveSongRecordingFile(blob, song.audioNoteMimeType);
        nextFile = createdFile;
      } catch {
        result.stoppedReason = `Nao foi possivel gravar o arquivo de "${title}". A conversao foi interrompida.`;
        break;
      }
    }

    const migratedSong = withoutLegacyBase64(song, nextFile);
    const nextSongs = workingSongs.map((row, rowIndex) => rowIndex === songIndex ? migratedSong : row);
    try {
      await db.saveSongs(nextSongs);
      workingSongs = nextSongs;
      result.migrated += 1;
    } catch {
      if (createdFile) await deleteSongRecordingFile(createdFile);
      result.stoppedReason = `Nao foi possivel salvar a conversao de "${title}". Nenhuma gravacao original foi removida.`;
      break;
    }

    options.onProgress?.({ done: index + 1, total: candidateIds.length, title });
  }

  return result;
};
