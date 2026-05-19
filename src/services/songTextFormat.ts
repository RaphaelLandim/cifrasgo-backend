import type { Song, SongInput } from '../types/models';
import { getSongGenreDisplay, getSongGenreKeys, uniqueGenres } from '../utils/genres';

export const CIFRASGO_SONG_MARKER = '[CIFRASGO_SONG_V1]';
export const CIFRASGO_SONG_END_MARKER = '[/CIFRASGO_SONG_V1]';

interface CifrasGoSongMetadata {
  app: 'CifrasGo';
  format: 'song';
  version: 1;
  title: string;
  artist: string;
  genre?: string;
  genres?: string[];
  observation?: string;
  sourceUrl?: string;
  preferredFontSize?: number;
  content?: string;
}

const cleanOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  return value;
};

const cleanString = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  return value.trim() || fallback;
};

const cleanGenres = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const genres = uniqueGenres(value.filter((item): item is string => typeof item === 'string'));
  return genres.length ? genres : undefined;
};

const buildReadableSongText = (song: Song): string => {
  const lines = [
    song.title || 'Sem titulo',
    song.artist ? `Artista: ${song.artist}` : 'Artista: Sem artista',
    getSongGenreDisplay(song) ? `Genero: ${getSongGenreDisplay(song)}` : '',
    song.observation ? `Observacao: ${song.observation}` : '',
    '',
    song.content || '',
  ];
  return lines.filter((line, index) => index >= 4 || !!line).join('\n');
};

export const buildCifrasGoSongTextFile = (song: Song): string => {
  const genres = getSongGenreKeys(song);
  const metadata: CifrasGoSongMetadata = {
    app: 'CifrasGo',
    format: 'song',
    version: 1,
    title: song.title || 'Sem titulo',
    artist: song.artist || '',
    genre: getSongGenreDisplay(song) || undefined,
    genres: genres.length ? genres : undefined,
    observation: song.observation || undefined,
    sourceUrl: song.sourceUrl || undefined,
    preferredFontSize: song.preferredFontSize,
    content: song.content || '',
  };

  return [
    buildReadableSongText(song),
    '',
    CIFRASGO_SONG_MARKER,
    JSON.stringify(metadata, null, 2),
    CIFRASGO_SONG_END_MARKER,
  ].join('\n');
};

export const parseCifrasGoSongTextFile = (text: string): SongInput | null => {
  const source = text.replace(/^\uFEFF/, '');
  const markerIndex = source.lastIndexOf(CIFRASGO_SONG_MARKER);
  if (markerIndex < 0) return null;

  const endIndex = source.indexOf(CIFRASGO_SONG_END_MARKER, markerIndex + CIFRASGO_SONG_MARKER.length);
  if (endIndex < 0) {
    throw new Error('Marcador final CIFRASGO_SONG_V1 nao encontrado.');
  }

  const metadataText = source.slice(markerIndex + CIFRASGO_SONG_MARKER.length, endIndex).trim();
  let metadata: Partial<CifrasGoSongMetadata>;
  try {
    metadata = JSON.parse(metadataText) as Partial<CifrasGoSongMetadata>;
  } catch {
    throw new Error('Metadados da musica CifrasGo invalidos.');
  }

  if (metadata.app !== 'CifrasGo' || metadata.format !== 'song' || metadata.version !== 1) {
    throw new Error('Formato de musica CifrasGo nao suportado.');
  }

  let content = cleanOptionalString(metadata.content);
  if (content == null) {
    content = source.slice(endIndex + CIFRASGO_SONG_END_MARKER.length);
    if (content.startsWith('\r\n')) content = content.slice(2);
    else if (content.startsWith('\n')) content = content.slice(1);
  }

  const title = cleanString(metadata.title, 'Sem titulo');
  const artist = cleanOptionalString(metadata.artist)?.trim() || '';
  const genre = cleanOptionalString(metadata.genre);
  const genres = cleanGenres(metadata.genres);
  const observation = cleanOptionalString(metadata.observation);
  const sourceUrl = cleanOptionalString(metadata.sourceUrl);
  const preferredFontSize =
    typeof metadata.preferredFontSize === 'number' && Number.isFinite(metadata.preferredFontSize)
      ? metadata.preferredFontSize
      : undefined;

  return {
    title,
    artist,
    genre,
    genres,
    observation,
    sourceUrl,
    preferredFontSize,
    content,
  };
};
