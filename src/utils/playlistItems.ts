import type { Playlist, PlaylistItem, PlaylistSection, QuickPdfId } from '../types/models';

export const QUICK_PDF_IDS: QuickPdfId[] = ['pdf1', 'pdf2', 'pdf3'];

export const QUICK_PDF_LABELS: Record<QuickPdfId, string> = {
  pdf1: 'PDF 1',
  pdf2: 'PDF 2',
  pdf3: 'PDF 3',
};

export const isQuickPdfId = (value: string): value is QuickPdfId =>
  QUICK_PDF_IDS.includes(value as QuickPdfId);

export const getSongPlaylistItemId = (songId: string) => `song:${songId}`;
export const getPdfPlaylistItemId = (pdfId: QuickPdfId) => `pdf:${pdfId}`;

export const makeSongPlaylistItem = (songId: string, isHighlighted = false): PlaylistItem => ({
  id: getSongPlaylistItemId(songId),
  type: 'song',
  songId,
  ...(isHighlighted ? { isHighlighted: true } : {}),
});

export const makePdfPlaylistItem = (pdfId: QuickPdfId): PlaylistItem => ({
  id: getPdfPlaylistItemId(pdfId),
  type: 'pdf',
  pdfId,
});

const cleanStringIds = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];

  return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
};

const cleanSongIds = (songIds: unknown): string[] => cleanStringIds(songIds);

const uniqueStrings = (values: string[]): string[] => {
  const used = new Set<string>();

  return values.filter((value) => {
    if (used.has(value)) return false;
    used.add(value);
    return true;
  });
};

export const derivePlaylistItemsFromSongIds = (songIds: string[]): PlaylistItem[] =>
  cleanSongIds(songIds).map((songId) => makeSongPlaylistItem(songId));

export const normalizePlaylistItems = (
  items: unknown,
  fallbackSongIds: string[],
): PlaylistItem[] | undefined => {
  if (!Array.isArray(items)) return undefined;

  const normalized = items
    .map((item): PlaylistItem | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Partial<PlaylistItem> & { id?: unknown; type?: unknown; songId?: unknown; pdfId?: unknown };
      const id = typeof record.id === 'string' && record.id.trim().length > 0 ? record.id : undefined;

      if (record.type === 'song' && typeof record.songId === 'string' && record.songId.trim().length > 0) {
        return {
          id: id ?? getSongPlaylistItemId(record.songId),
          type: 'song',
          songId: record.songId,
          ...(record.isHighlighted === true ? { isHighlighted: true } : {}),
        };
      }

      if (record.type === 'pdf' && typeof record.pdfId === 'string' && isQuickPdfId(record.pdfId)) {
        return { id: id ?? getPdfPlaylistItemId(record.pdfId), type: 'pdf', pdfId: record.pdfId };
      }

      return null;
    })
    .filter((item): item is PlaylistItem => item !== null);

  if (!normalized.length) return undefined;

  const presentSongIds = new Set(
    normalized.flatMap((item) => (item.type === 'song' ? [item.songId] : [])),
  );
  const missingSongItems = cleanSongIds(fallbackSongIds)
    .filter((songId) => !presentSongIds.has(songId))
    .map((songId) => makeSongPlaylistItem(songId));

  return [...normalized, ...missingSongItems];
};

export const getPlaylistItems = (playlist: Pick<Playlist, 'songIds' | 'items'>): PlaylistItem[] =>
  playlist.items && playlist.items.length > 0
    ? playlist.items
    : derivePlaylistItemsFromSongIds(playlist.songIds);

const getItemById = (items: PlaylistItem[]) => new Map(items.map((item) => [item.id, item]));

export const getPlaylistSectionItemIds = (
  section: PlaylistSection,
  playlistItems: PlaylistItem[],
): string[] => {
  const itemById = getItemById(playlistItems);
  const explicitItemIds = uniqueStrings(cleanStringIds(section.itemIds)).filter((itemId) =>
    itemById.has(itemId),
  );

  if (explicitItemIds.length > 0) return explicitItemIds;

  const songItemIdBySongId = new Map(
    playlistItems
      .filter((item): item is Extract<PlaylistItem, { type: 'song' }> => item.type === 'song')
      .map((item) => [item.songId, item.id]),
  );

  return uniqueStrings(cleanSongIds(section.songIds))
    .map((songId) => songItemIdBySongId.get(songId))
    .filter((itemId): itemId is string => Boolean(itemId));
};

export const getPlaylistSectionItems = (
  section: PlaylistSection,
  playlistItems: PlaylistItem[],
): PlaylistItem[] => {
  const itemById = getItemById(playlistItems);

  return getPlaylistSectionItemIds(section, playlistItems)
    .map((itemId) => itemById.get(itemId))
    .filter((item): item is PlaylistItem => Boolean(item));
};

export const syncPlaylistSectionItemIds = (
  section: PlaylistSection,
  playlistItems: PlaylistItem[],
  nextItemIds = getPlaylistSectionItemIds(section, playlistItems),
): PlaylistSection => {
  const itemById = getItemById(playlistItems);
  const itemIds = uniqueStrings(nextItemIds).filter((itemId) => itemById.has(itemId));
  const songIds = itemIds.flatMap((itemId) => {
    const item = itemById.get(itemId);
    return item?.type === 'song' ? [item.songId] : [];
  });

  return {
    ...section,
    itemIds,
    songIds,
  };
};

export const reorderPlaylistItemsBySongIds = (
  playlist: Pick<Playlist, 'songIds' | 'items'>,
  nextSongIds: string[],
): PlaylistItem[] => {
  const currentItems = getPlaylistItems(playlist);
  const songItemsBySongId = new Map(
    currentItems
      .filter((item): item is Extract<PlaylistItem, { type: 'song' }> => item.type === 'song')
      .map((item) => [item.songId, item]),
  );
  const remainingSongIds = [...cleanSongIds(nextSongIds)];
  const nextItems: PlaylistItem[] = [];

  currentItems.forEach((item) => {
    if (item.type === 'pdf') {
      nextItems.push(item);
      return;
    }

    const nextSongId = remainingSongIds.shift();
    if (nextSongId) {
      nextItems.push(songItemsBySongId.get(nextSongId) ?? makeSongPlaylistItem(nextSongId));
    }
  });

  remainingSongIds.forEach((songId) => {
    nextItems.push(songItemsBySongId.get(songId) ?? makeSongPlaylistItem(songId));
  });

  return nextItems;
};

export const deriveScriptPlaylistOrder = (
  sections: PlaylistSection[],
  currentItemsOrSongIds: PlaylistItem[] | string[],
): { songIds: string[]; items: PlaylistItem[]; sections: PlaylistSection[] } => {
  const firstItem = currentItemsOrSongIds[0];
  const currentItems =
    typeof firstItem === 'string'
      ? derivePlaylistItemsFromSongIds(currentItemsOrSongIds as string[])
      : (currentItemsOrSongIds as PlaylistItem[]);

  const itemById = getItemById(currentItems);
  const usedItemIds = new Set<string>();
  const orderedItems: PlaylistItem[] = [];
  const orderedSongIds: string[] = [];

  const normalizedSections = sections
    .map((section) => {
      const sectionItemIds: string[] = [];
      const sectionSongIds: string[] = [];

      getPlaylistSectionItemIds(section, currentItems).forEach((itemId) => {
        const item = itemById.get(itemId);
        if (!item || usedItemIds.has(itemId)) return;

        usedItemIds.add(itemId);
        sectionItemIds.push(itemId);
        orderedItems.push(item);

        if (item.type === 'song') {
          sectionSongIds.push(item.songId);
          orderedSongIds.push(item.songId);
        }
      });

      return {
        ...section,
        title: section.title.trim() || 'Sem titulo',
        itemIds: sectionItemIds,
        songIds: sectionSongIds,
      };
    })
    .filter((section) => section.title || section.itemIds.length > 0);

  currentItems.forEach((item) => {
    if (usedItemIds.has(item.id)) return;

    usedItemIds.add(item.id);
    orderedItems.push(item);

    if (item.type === 'song') {
      orderedSongIds.push(item.songId);
    }
  });

  return {
    songIds: orderedSongIds,
    items: orderedItems,
    sections: normalizedSections,
  };
};

export const appendSongItemIfNeeded = (playlist: Playlist, songId: string): PlaylistItem[] | undefined => {
  const items = getPlaylistItems(playlist);
  if (items.some((item) => item.type === 'song' && item.songId === songId)) return playlist.items;
  if (!playlist.items) return undefined;
  return [...items, makeSongPlaylistItem(songId)];
};

export const removeSongFromPlaylistItems = (
  playlistOrItems: Playlist | PlaylistItem[] | undefined,
  songId: string,
): PlaylistItem[] | undefined => {
  if (!playlistOrItems) return undefined;
  const items = Array.isArray(playlistOrItems) ? playlistOrItems : playlistOrItems.items;
  if (!items) return undefined;
  return items.filter((item) => item.type !== 'song' || item.songId !== songId);
};

export const setPlaylistSongHighlighted = (
  playlist: Playlist,
  songId: string,
  isHighlighted: boolean,
): PlaylistItem[] => {
  const items = getPlaylistItems(playlist);

  return items.map((item) => {
    if (item.type !== 'song' || item.songId !== songId) return item;

    return {
      ...item,
      ...(isHighlighted ? { isHighlighted: true } : { isHighlighted: undefined }),
    };
  });
};
