import type { Song, SongInput } from '../types/song';

const STORAGE_KEY = 'cifras_vite_songs';

const hasWindow = typeof window !== 'undefined';

const parseSongs = (raw: string | null): Song[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Song[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const songStorage = {
  list(): Song[] {
    if (!hasWindow) return [];
    return parseSongs(window.localStorage.getItem(STORAGE_KEY));
  },

  saveAll(songs: Song[]): void {
    if (!hasWindow) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  },

  create(input: SongInput): Song {
    const songs = this.list();
    const song: Song = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      artist: input.artist.trim(),
      content: input.content,
      updatedAt: Date.now(),
    };
    this.saveAll([song, ...songs]);
    return song;
  },

  update(id: string, input: SongInput): Song | null {
    const songs = this.list();
    let updatedSong: Song | null = null;
    const next = songs.map((song) => {
      if (song.id !== id) return song;
      updatedSong = {
        ...song,
        title: input.title.trim(),
        artist: input.artist.trim(),
        content: input.content,
        updatedAt: Date.now(),
      };
      return updatedSong;
    });
    this.saveAll(next);
    return updatedSong;
  },

  remove(id: string): void {
    const songs = this.list().filter((song) => song.id !== id);
    this.saveAll(songs);
  },
};
