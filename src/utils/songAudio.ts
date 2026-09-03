import type { Song } from '../types/models';

type SongAudioMetadata = Pick<Song, 'audioNoteFile' | 'audioNoteBase64' | 'audioNoteMimeType'>;

export const hasSongAudioNote = (song: SongAudioMetadata): boolean => {
  const hasMimeType = !!song.audioNoteMimeType?.trim();
  if (!hasMimeType) return false;
  return !!song.audioNoteFile?.trim() || !!song.audioNoteBase64?.trim();
};
