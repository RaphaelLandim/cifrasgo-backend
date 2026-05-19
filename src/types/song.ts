export interface Song {
  id: string;
  title: string;
  artist: string;
  content: string;
  updatedAt: number;
}

export interface SongInput {
  title: string;
  artist: string;
  content: string;
}
