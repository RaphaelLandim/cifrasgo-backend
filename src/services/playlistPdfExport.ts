import type { jsPDF as JsPdfDocument } from 'jspdf';
import { getRenderableChordMatches } from '../lib/chords';
import type { Playlist, Song } from '../types/models';
import { getPlaylistItems } from '../utils/playlistItems';
import { getVocalModeText } from '../utils/vocalMode';
import { db } from './storage';
import { sanitizeFileName } from './share';

export type PlaylistPdfExportMode = 'chords' | 'vocal';

export interface PlaylistPdfExportOptions {
  playlistId: string;
  mode: PlaylistPdfExportMode;
  fontSize: number;
  pageBreakBetweenSongs: boolean;
  includeSummary?: boolean;
  includeTitle: boolean;
  includeArtist: boolean;
}

export interface PlaylistPdfExportResult {
  blob: Blob;
  fileName: string;
  playlistName: string;
  songCount: number;
  skippedPdfCount: number;
}

const BODY_FONT = 'courier';
const TITLE_FONT = 'helvetica';
const CHORD_COLOR: [number, number, number] = [28, 72, 112];
const TEXT_COLOR: [number, number, number] = [18, 24, 30];
const MUTED_COLOR: [number, number, number] = [82, 91, 102];
const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 18;
const SUMMARY_ROW_HEIGHT = 18;
const SUMMARY_HEADER_HEIGHT = 76;

const clampFontSize = (value: number) =>
  Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Number.isFinite(value) ? value : 11));

const formatDateForFile = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
  ].join('');
};

export const formatPlaylistPdfFileName = (playlistName: string, date = new Date()) =>
  `CifrasGo_lista_${sanitizeFileName(playlistName || 'Lista')}_${formatDateForFile(date)}.pdf`;

const getOrderedPlaylistSongIds = (playlist: Playlist) => {
  const seen = new Set<string>();
  const ids: string[] = [];

  getPlaylistItems(playlist)
    .filter((item) => item.type === 'song')
    .forEach((item) => {
      if (seen.has(item.songId)) return;
      seen.add(item.songId);
      ids.push(item.songId);
    });

  return ids;
};

const countPlaylistPdfItems = (playlist: Playlist) =>
  getPlaylistItems(playlist).filter((item) => item.type === 'pdf').length;

const normalizeSongLines = (content: string, mode: PlaylistPdfExportMode) => {
  const lines = (content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (mode === 'chords') return lines;
  return lines
    .map(getVocalModeText)
    .filter((line): line is string => line !== null);
};

const ensurePageSpace = (doc: JsPdfDocument, y: number, needed: number, pageHeight: number, margin: number) => {
  if (y + needed <= pageHeight - margin) return y;
  doc.addPage();
  return margin;
};

const setTextColor = (doc: JsPdfDocument, color: [number, number, number]) => {
  doc.setTextColor(color[0], color[1], color[2]);
};

const getCurrentPageNumber = (doc: JsPdfDocument) =>
  (doc.internal as typeof doc.internal & { getCurrentPageInfo?: () => { pageNumber: number } })
    .getCurrentPageInfo?.().pageNumber ?? doc.getNumberOfPages();

const getSummaryPageCount = (songCount: number, pageHeight: number, margin: number) => {
  const usableRows = Math.max(1, Math.floor((pageHeight - margin * 2 - SUMMARY_HEADER_HEIGHT) / SUMMARY_ROW_HEIGHT));
  return Math.max(1, Math.ceil(songCount / usableRows));
};

const truncateTextToWidth = (doc: JsPdfDocument, value: string, width: number) => {
  const clean = value.trim() || 'Sem titulo';
  if (doc.getTextWidth(clean) <= width) return clean;
  let next = clean;
  while (next.length > 1 && doc.getTextWidth(`${next}...`) > width) {
    next = next.slice(0, -1);
  }
  return `${next.trimEnd()}...`;
};

const drawChordAwareLine = (
  doc: JsPdfDocument,
  line: string,
  x: number,
  y: number,
  fontSize: number
) => {
  const chords = getRenderableChordMatches(line);
  if (chords.length === 0) {
    doc.setFont(BODY_FONT, 'normal');
    setTextColor(doc, TEXT_COLOR);
    doc.text(line, x, y);
    return;
  }

  let cursorX = x;
  let last = 0;

  const drawPart = (part: string, chord: boolean) => {
    if (!part) return;
    doc.setFont(BODY_FONT, chord ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    setTextColor(doc, chord ? CHORD_COLOR : TEXT_COLOR);
    if (/\S/.test(part)) doc.text(part, cursorX, y);
    cursorX += doc.getTextWidth(part);
  };

  chords.forEach((chord) => {
    if (chord.index > last) drawPart(line.slice(last, chord.index), false);
    drawPart(chord.text, true);
    last = chord.end;
  });

  if (last < line.length) drawPart(line.slice(last), false);
};

const drawSummaryPages = ({
  doc,
  playlistName,
  entries,
  summaryPageCount,
  pageWidth,
  pageHeight,
  margin,
}: {
  doc: JsPdfDocument;
  playlistName: string;
  entries: Array<{ index: number; title: string; pageNumber: number }>;
  summaryPageCount: number;
  pageWidth: number;
  pageHeight: number;
  margin: number;
}) => {
  const maxWidth = pageWidth - margin * 2;
  const pageColumnX = pageWidth - margin - 52;
  const titleMaxWidth = pageColumnX - margin - 16;
  const rowsPerPage = Math.max(1, Math.floor((pageHeight - margin * 2 - SUMMARY_HEADER_HEIGHT) / SUMMARY_ROW_HEIGHT));

  for (let pageIndex = 0; pageIndex < summaryPageCount; pageIndex += 1) {
    doc.setPage(pageIndex + 1);
    let y = margin;

    doc.setFont(TITLE_FONT, 'bold');
    doc.setFontSize(18);
    setTextColor(doc, TEXT_COLOR);
    doc.text(playlistName, margin, y);
    y += 26;

    doc.setFont(TITLE_FONT, 'normal');
    doc.setFontSize(12);
    setTextColor(doc, MUTED_COLOR);
    doc.text('Sumario da lista', margin, y);
    y += 30;

    doc.setDrawColor(220, 226, 232);
    doc.line(margin, y - 12, pageWidth - margin, y - 12);

    entries.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage).forEach((entry) => {
      doc.setFont(TITLE_FONT, 'normal');
      doc.setFontSize(11);
      setTextColor(doc, TEXT_COLOR);

      const prefix = `${entry.index + 1}. `;
      const pageLabel = `pag. ${entry.pageNumber}`;
      const title = truncateTextToWidth(doc, `${prefix}${entry.title}`, titleMaxWidth);
      const pageTextWidth = doc.getTextWidth(pageLabel);

      doc.text(title, margin, y);
      doc.setLineDashPattern([1.5, 2.5], 0);
      doc.setDrawColor(170, 180, 190);
      doc.line(margin + doc.getTextWidth(title) + 6, y - 3, pageColumnX - 8, y - 3);
      doc.setLineDashPattern([], 0);
      doc.text(pageLabel, pageWidth - margin - pageTextWidth, y);

      try {
        doc.link(margin, y - 11, maxWidth, SUMMARY_ROW_HEIGHT, {
          pageNumber: entry.pageNumber,
          top: margin,
          zoom: 0,
        });
      } catch {
        // Internal links are optional; page numbers remain the source of truth.
      }

      y += SUMMARY_ROW_HEIGHT;
    });
  }
};

export const buildPlaylistPdfExport = async (
  options: PlaylistPdfExportOptions
): Promise<PlaylistPdfExportResult> => {
  const [playlists, songs] = await Promise.all([db.getPlaylists(), db.getSongs()]);
  const playlist = playlists.find((item) => item.id === options.playlistId);
  if (!playlist) throw new Error('Lista nao encontrada para exportar.');

  const songsById = new Map(songs.map((song) => [song.id, song]));
  const orderedSongIds = getOrderedPlaylistSongIds(playlist);
  const orderedSongs = orderedSongIds
    .map((songId) => songsById.get(songId))
    .filter((song): song is Song => !!song);

  if (orderedSongs.length === 0) {
    throw new Error('Esta lista nao tem musicas para exportar.');
  }

  const playlistName = playlist.name.trim() || 'Lista';
  const fontSize = clampFontSize(options.fontSize);
  const lineHeight = fontSize * 1.28;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  const includeSummary = options.includeSummary === true;
  const summaryPageCount = includeSummary ? getSummaryPageCount(orderedSongs.length, pageHeight, margin) : 0;
  const summaryEntries: Array<{ index: number; title: string; pageNumber: number }> = [];
  let y = margin;

  doc.setProperties({
    title: `CifrasGo - ${playlistName}`,
    subject: options.mode === 'vocal' ? 'Lista em modo vocalista' : 'Lista com acordes',
    creator: 'CifrasGo',
  });

  if (includeSummary) {
    for (let index = 1; index < summaryPageCount; index += 1) {
      doc.addPage();
    }
    doc.addPage();
    y = margin;
  }

  const drawWrappedLine = (line: string) => {
    const chunks = (doc.splitTextToSize(line || ' ', maxWidth) as string[]) || [' '];
    chunks.forEach((chunk) => {
      y = ensurePageSpace(doc, y, lineHeight, pageHeight, margin);
      if (chunk.trim().length === 0) {
        y += lineHeight * 0.75;
        return;
      }
      drawChordAwareLine(doc, chunk, margin, y, fontSize);
      y += lineHeight;
    });
  };

  const drawSongHeading = (song: Song, index: number) => {
    if (!options.includeTitle && !options.includeArtist) return;

    y = ensurePageSpace(doc, y, 48, pageHeight, margin);

    if (options.includeTitle) {
      doc.setFont(TITLE_FONT, 'bold');
      doc.setFontSize(17);
      setTextColor(doc, TEXT_COLOR);
      const title = `${index + 1}. ${song.title?.trim() || 'Sem titulo'}`;
      const titleLines = doc.splitTextToSize(title, maxWidth) as string[];
      titleLines.forEach((line) => {
        y = ensurePageSpace(doc, y, 20, pageHeight, margin);
        doc.text(line, margin, y);
        y += 20;
      });
    }

    if (options.includeArtist) {
      doc.setFont(TITLE_FONT, 'normal');
      doc.setFontSize(11);
      setTextColor(doc, MUTED_COLOR);
      const artist = song.artist?.trim() || 'Sem artista';
      const artistLines = doc.splitTextToSize(artist, maxWidth) as string[];
      artistLines.forEach((line) => {
        y = ensurePageSpace(doc, y, 14, pageHeight, margin);
        doc.text(line, margin, y);
        y += 14;
      });
    }

    y += 8;
  };

  orderedSongs.forEach((song, index) => {
    if (index > 0) {
      if (options.pageBreakBetweenSongs) {
        doc.addPage();
        y = margin;
      } else {
        y += lineHeight * 1.6;
      }
    }

    summaryEntries.push({
      index,
      title: song.title?.trim() || 'Sem titulo',
      pageNumber: getCurrentPageNumber(doc),
    });
    drawSongHeading(song, index);
    doc.setFont(BODY_FONT, 'normal');
    doc.setFontSize(fontSize);
    normalizeSongLines(song.content, options.mode).forEach(drawWrappedLine);
  });

  if (includeSummary) {
    const lastPage = getCurrentPageNumber(doc);
    drawSummaryPages({
      doc,
      playlistName,
      entries: summaryEntries,
      summaryPageCount,
      pageWidth,
      pageHeight,
      margin,
    });
    doc.setPage(lastPage);
  }

  const rawBlob = doc.output('blob') as Blob;
  const blob = rawBlob.type === 'application/pdf' ? rawBlob : rawBlob.slice(0, rawBlob.size, 'application/pdf');

  return {
    blob,
    fileName: formatPlaylistPdfFileName(playlistName),
    playlistName,
    songCount: orderedSongs.length,
    skippedPdfCount: countPlaylistPdfItems(playlist),
  };
};
