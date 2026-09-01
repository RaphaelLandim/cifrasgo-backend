import type { Playlist, PlaylistItem } from '../types/models';

const uid = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11);

const COPY_SUFFIX_RE = /\s+\(cópia(?:\s+\d+)?\)$/i;

const clonePlaylistItem = (item: PlaylistItem): PlaylistItem =>
  item.type === 'song'
    ? {
        id: uid(),
        type: 'song',
        songId: item.songId,
        ...(item.isHighlighted ? { isHighlighted: true } : {}),
      }
    : { id: uid(), type: 'pdf', pdfId: item.pdfId };

export const getDuplicatedPlaylistName = (sourceName: string, allPlaylists: Playlist[]) => {
  const baseName = (sourceName.trim() || 'Lista').replace(COPY_SUFFIX_RE, '');
  const usedNames = new Set(allPlaylists.map((playlist) => playlist.name.trim().toLocaleLowerCase('pt-BR')));
  const firstCopyName = `${baseName} (cópia)`;

  if (!usedNames.has(firstCopyName.toLocaleLowerCase('pt-BR'))) {
    return firstCopyName;
  }

  let copyIndex = 2;
  while (usedNames.has(`${baseName} (cópia ${copyIndex})`.toLocaleLowerCase('pt-BR'))) {
    copyIndex += 1;
  }

  return `${baseName} (cópia ${copyIndex})`;
};

export const createDuplicatedPlaylist = (source: Playlist, allPlaylists: Playlist[]): Playlist => {
  const clonedItems = source.items?.map(clonePlaylistItem);
  const clonedItemIdBySourceId = new Map(
    source.items?.map((item, index) => [item.id, clonedItems?.[index]?.id]).filter((entry): entry is [string, string] => {
      return typeof entry[1] === 'string';
    }) ?? [],
  );

  return {
    id: uid(),
    folderId: source.folderId ?? null,
    name: getDuplicatedPlaylistName(source.name, allPlaylists),
    songIds: [...source.songIds],
    ...(clonedItems ? { items: clonedItems } : {}),
    ...(source.genres?.length ? { genres: [...source.genres] } : {}),
    ...(source.viewMode ? { viewMode: source.viewMode } : {}),
    ...(source.sections
      ? {
          sections: source.sections.map((section) => {
            const itemIds = section.itemIds
              ?.map((itemId) => clonedItemIdBySourceId.get(itemId) ?? itemId)
              .filter((itemId): itemId is string => typeof itemId === 'string' && itemId.trim().length > 0);

            return {
              id: uid(),
              title: section.title,
              songIds: [...section.songIds],
              ...(itemIds?.length ? { itemIds } : {}),
              ...(section.color ? { color: section.color } : {}),
            };
          }),
        }
      : {}),
  };
};

export const insertPlaylistAfterSource = (rows: Playlist[], sourceId: string, duplicate: Playlist) => {
  const sourceIndex = rows.findIndex((playlist) => playlist.id === sourceId);
  if (sourceIndex < 0) return [duplicate, ...rows];
  return [...rows.slice(0, sourceIndex + 1), duplicate, ...rows.slice(sourceIndex + 1)];
};
