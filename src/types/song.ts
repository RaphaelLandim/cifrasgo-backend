export interface Song {
  id: string;
  title: string;
  artist: string;
  content: string;
  youtubeUrl?: string;
  updatedAt: number;
}

export interface SongInput {
  title: string;
  artist: string;
  content: string;
  youtubeUrl?: string;
}
