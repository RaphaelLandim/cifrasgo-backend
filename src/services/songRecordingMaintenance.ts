import type { Song } from '../types/models';
import {
  deleteSongRecordingFile,
  listManagedSongRecordingFiles,
  normalizeSongRecordingPath,
  type SongRecordingDirectoryListing,
} from './songRecordingFiles';
import { db } from './storage';

export interface BrokenSongRecordingReference {
  songId: string;
  title: string;
  artist: string;
  path: string;
  reason: 'invalid-path' | 'missing-file' | 'empty-file';
}

export interface SongRecordingAuditResult {
  songsWithFile: number;
  referencedFiles: number;
  physicalFiles: number;
  orphanFiles: string[];
  brokenReferences: BrokenSongRecordingReference[];
  ignoredEntries: string[];
  legacyBase64: {
    total: number;
    migratable: number;
    missingMime: number;
    invalid: number;
    withFile: number;
  };
}

export interface SongRecordingCleanupResult {
  requested: number;
  removed: number;
  failed: string[];
  skippedReferenced: string[];
}

const normalizeReferencedPaths = (songs: Song[]): Set<string> => {
  const paths = new Set<string>();
  songs.forEach((song) => {
    if (!song.audioNoteFile?.trim()) return;
    try {
      paths.add(normalizeSongRecordingPath(song.audioNoteFile));
    } catch {
      // Referencias invalidas entram no relatorio, nunca no conjunto removivel.
    }
  });
  return paths;
};

const isPlausibleBase64 = (value: string): boolean => {
  const payload = value.includes(',') ? value.slice(value.lastIndexOf(',') + 1) : value;
  const compact = payload.replace(/\s/g, '');
  return !!compact && compact.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(compact);
};

export const buildSongRecordingAudit = (
  songs: Song[],
  listing: SongRecordingDirectoryListing,
): SongRecordingAuditResult => {
  const physicalByPath = new Map(listing.files.map((file) => [file.path, file]));
  const referencedPaths = normalizeReferencedPaths(songs);
  const brokenReferences: BrokenSongRecordingReference[] = [];
  let songsWithFile = 0;
  let legacyTotal = 0;
  let legacyMigratable = 0;
  let legacyMissingMime = 0;
  let legacyInvalid = 0;
  let legacyWithFile = 0;

  songs.forEach((song) => {
    if (song.audioNoteFile?.trim()) {
      songsWithFile += 1;
      try {
        const path = normalizeSongRecordingPath(song.audioNoteFile);
        const physical = physicalByPath.get(path);
        if (!physical) {
          brokenReferences.push({ songId: song.id, title: song.title, artist: song.artist, path, reason: 'missing-file' });
        } else if (physical.size <= 0) {
          brokenReferences.push({ songId: song.id, title: song.title, artist: song.artist, path, reason: 'empty-file' });
        }
      } catch {
        brokenReferences.push({
          songId: song.id,
          title: song.title,
          artist: song.artist,
          path: song.audioNoteFile,
          reason: 'invalid-path',
        });
      }
    }

    if (!song.audioNoteBase64?.trim()) return;
    legacyTotal += 1;
    if (song.audioNoteFile?.trim()) legacyWithFile += 1;
    if (!song.audioNoteMimeType?.trim()) {
      legacyMissingMime += 1;
    } else if (!isPlausibleBase64(song.audioNoteBase64)) {
      legacyInvalid += 1;
    } else {
      legacyMigratable += 1;
    }
  });

  return {
    songsWithFile,
    referencedFiles: referencedPaths.size,
    physicalFiles: listing.files.length,
    orphanFiles: listing.files.filter((file) => !referencedPaths.has(file.path)).map((file) => file.path),
    brokenReferences,
    ignoredEntries: listing.ignoredEntries,
    legacyBase64: {
      total: legacyTotal,
      migratable: legacyMigratable,
      missingMime: legacyMissingMime,
      invalid: legacyInvalid,
      withFile: legacyWithFile,
    },
  };
};

export const auditSongRecordings = async (): Promise<SongRecordingAuditResult> => {
  const songs = await db.getSongs();
  const listing = await listManagedSongRecordingFiles();
  return buildSongRecordingAudit(songs, listing);
};

export const cleanupOrphanSongRecordings = async (
  orphanSnapshot: string[],
): Promise<SongRecordingCleanupResult> => {
  const songs = await db.getSongs();
  const referencedPaths = normalizeReferencedPaths(songs);
  const currentListing = await listManagedSongRecordingFiles();
  const currentManagedPaths = new Set(currentListing.files.map((file) => file.path));
  const result: SongRecordingCleanupResult = {
    requested: orphanSnapshot.length,
    removed: 0,
    failed: [],
    skippedReferenced: [],
  };

  for (const candidate of orphanSnapshot) {
    let path: string;
    try {
      path = normalizeSongRecordingPath(candidate);
    } catch {
      result.failed.push(candidate);
      continue;
    }
    if (referencedPaths.has(path)) {
      result.skippedReferenced.push(path);
      continue;
    }
    if (!currentManagedPaths.has(path)) {
      result.failed.push(path);
      continue;
    }
    if (await deleteSongRecordingFile(path)) result.removed += 1;
    else result.failed.push(path);
  }
  return result;
};
