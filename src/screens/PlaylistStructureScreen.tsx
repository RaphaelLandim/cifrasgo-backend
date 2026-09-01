import type { CSSProperties, DragEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import { ArrowDown, ArrowUp, Copy, FileText, FolderPlus, GripHorizontal, Music, Palette, Plus, Search, Star, Trash2 } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { db } from '../services/storage';
import type { Playlist, PlaylistItem, PlaylistSection, PlaylistViewMode, QuickPdfLink, Song } from '../types/models';
import {
  deriveScriptPlaylistOrder,
  getPlaylistItems,
  getPlaylistSectionItemIds,
  getPlaylistSectionItems,
  makePdfPlaylistItem,
  QUICK_PDF_LABELS,
  syncPlaylistSectionItemIds,
} from '../utils/playlistItems';
import { hasQuickPdfSource } from '../utils/quickPdfs';
import { useDevScreenPerformance } from '../utils/devPerformance';

interface PlaylistStructureScreenProps {
  playlistId: string;
  playlistName?: string;
  folderId?: string | null;
  folderName?: string;
  styles: any;
}

const uid = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11);

type DragPayload =
  | { kind: 'order-item'; itemId: string }
  | { kind: 'section-item'; sectionId: string; itemId: string }
  | { kind: 'unsectioned-item'; itemId: string }
  | { kind: 'section'; sectionId: string };

type ItemDragPayload = Exclude<DragPayload, { kind: 'section' }>;

type SectionColorKey = 'blue' | 'green' | 'gold' | 'purple' | 'red' | 'gray';

const SECTION_COLOR_OPTIONS: Array<{ label: string; value?: SectionColorKey; color: string }> = [
  { label: 'Sem cor', value: undefined, color: 'transparent' },
  { label: 'Azul', value: 'blue', color: '#4FC3F7' },
  { label: 'Verde', value: 'green', color: '#22c55e' },
  { label: 'Dourado', value: 'gold', color: '#ffd166' },
  { label: 'Roxo', value: 'purple', color: '#a78bfa' },
  { label: 'Vermelho', value: 'red', color: '#ff6b6b' },
  { label: 'Cinza', value: 'gray', color: '#9ca3af' },
];

const SECTION_COLOR_VALUES: Record<SectionColorKey, string> = {
  blue: '#4FC3F7',
  green: '#22c55e',
  gold: '#ffd166',
  purple: '#a78bfa',
  red: '#ff6b6b',
  gray: '#9ca3af',
};

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const normalizeHexColor = (color: string) => {
  const value = color.trim();
  if (!HEX_COLOR_RE.test(value)) return null;
  if (value.length === 4) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return value.toUpperCase();
};

const getSectionColor = (color?: string) =>
  color && color in SECTION_COLOR_VALUES
    ? SECTION_COLOR_VALUES[color as SectionColorKey]
    : color
      ? normalizeHexColor(color) || undefined
      : undefined;

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return undefined;
  const raw = normalized.slice(1);
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getSectionSoftBackground = (color?: string) => {
  const resolved = getSectionColor(color);
  return resolved ? hexToRgba(resolved, 0.14) : undefined;
};

const getSectionColorLabel = (color?: string) => {
  if (!color) return 'Sem cor';
  const option = SECTION_COLOR_OPTIONS.find((item) => item.value === color);
  return option?.label || getSectionColor(color) || 'Personalizada';
};

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const syncSectionWithItemIds = (
  section: PlaylistSection,
  itemIds: string[],
  playlistItems: PlaylistItem[],
): PlaylistSection => syncPlaylistSectionItemIds({ ...section, itemIds }, playlistItems, itemIds);

export function PlaylistStructureScreen({
  playlistId,
  playlistName,
  folderId,
  folderName,
  styles,
}: PlaylistStructureScreenProps) {
  useDevScreenPerformance('PlaylistStructure');
  const nav = useManualNavigation();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [quickPdfs, setQuickPdfs] = useState<QuickPdfLink[]>([]);
  const [draftViewMode, setDraftViewMode] = useState<PlaylistViewMode>('default');
  const [draftItems, setDraftItems] = useState<PlaylistItem[]>([]);
  const [draftSections, setDraftSections] = useState<PlaylistSection[]>([]);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [addSectionId, setAddSectionId] = useState<string | null>(null);
  const [sectionItemSearch, setSectionItemSearch] = useState('');
  const [colorSectionId, setColorSectionId] = useState<string | null>(null);
  const [customSectionColor, setCustomSectionColor] = useState('');
  const [colorCopyFeedback, setColorCopyFeedback] = useState('');
  const [addSongOpen, setAddSongOpen] = useState(false);
  const [songSearch, setSongSearch] = useState('');
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const load = async () => {
    const [nextPlaylist, nextSongs, nextQuickPdfs] = await Promise.all([
      db.byPlaylist(playlistId),
      db.getSongs(),
      db.getQuickPdfs(),
    ]);
    if (!nextPlaylist) return;

    const validSongIds = new Set(nextSongs.map((song) => song.id));
    const safeItems = getPlaylistItems(nextPlaylist).filter((item) =>
      item.type === 'pdf' || validSongIds.has(item.songId),
    );
    const safeSections = (nextPlaylist.sections || [])
      .map((section) => syncPlaylistSectionItemIds(section, safeItems))
      .filter((section) => section.title.trim() || section.itemIds?.length || section.songIds.length);

    setPlaylist(nextPlaylist);
    setAllSongs(nextSongs);
    setQuickPdfs(nextQuickPdfs);
    setDraftViewMode(nextPlaylist.viewMode || 'default');
    setDraftItems(safeItems);
    setDraftSections(safeSections);
  };

  useEffect(() => { load(); }, [playlistId]);

  useEffect(() => {
    if (!colorSectionId) return;
    const current = draftSections.find((section) => section.id === colorSectionId)?.color;
    setCustomSectionColor(current && normalizeHexColor(current) ? normalizeHexColor(current) || '' : '');
    setColorCopyFeedback('');
  }, [colorSectionId, draftSections]);

  const songsById = useMemo(() => new Map(allSongs.map((song) => [song.id, song])), [allSongs]);
  const quickPdfsById = useMemo(() => new Map(quickPdfs.map((pdf) => [pdf.id, pdf])), [quickPdfs]);
  const draftSongIds = useMemo(
    () => draftItems.filter((item) => item.type === 'song').map((item) => item.songId),
    [draftItems],
  );
  const sectionItemIds = useMemo(
    () => new Set(draftSections.flatMap((section) => getPlaylistSectionItemIds(section, draftItems))),
    [draftItems, draftSections],
  );
  const unsectionedItems = useMemo(
    () => draftItems.filter((item) => !sectionItemIds.has(item.id)),
    [draftItems, sectionItemIds],
  );
  const draftSongIdSet = useMemo(() => new Set(draftSongIds), [draftSongIds]);
  const draftPdfIdSet = useMemo(
    () => new Set(draftItems.flatMap((item) => (item.type === 'pdf' ? [item.pdfId] : []))),
    [draftItems],
  );
  const addTargetSection = draftSections.find((section) => section.id === addSectionId) || null;
  const colorTargetSection = draftSections.find((section) => section.id === colorSectionId) || null;

  const addSongResults = useMemo(() => {
    const query = songSearch.trim().toLowerCase();
    return allSongs
      .filter((song) => {
        if (!query) return true;
        return (
          song.title.toLowerCase().includes(query) ||
          (song.artist || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aAdded = draftSongIdSet.has(a.id) ? 1 : 0;
        const bAdded = draftSongIdSet.has(b.id) ? 1 : 0;
        if (aAdded !== bAdded) return aAdded - bAdded;
        return a.title.localeCompare(b.title, 'pt-BR');
      });
  }, [allSongs, draftSongIdSet, songSearch]);

  const getQuickPdfTitle = (pdf?: QuickPdfLink | null, pdfId?: string) => {
    if (!pdf && !pdfId) return 'PDF';
    const label = pdfId && pdfId in QUICK_PDF_LABELS ? QUICK_PDF_LABELS[pdfId as keyof typeof QUICK_PDF_LABELS] : 'PDF';
    return pdf?.name?.trim() ? `${label} - ${pdf.name.trim()}` : label;
  };

  const getQuickPdfSubtitle = (pdf?: QuickPdfLink | null) => {
    if (pdf?.fileStorage || pdf?.fileData) return 'PDF salvo no app';
    if (pdf?.url) return 'PDF por link';
    return 'PDF rápido sem origem configurada';
  };

  const getItemTitle = (item: PlaylistItem) => {
    if (item.type === 'pdf') return getQuickPdfTitle(quickPdfsById.get(item.pdfId), item.pdfId);
    return songsById.get(item.songId)?.title || 'Música indisponível';
  };

  const getItemSubtitle = (item: PlaylistItem) => {
    if (item.type === 'pdf') return getQuickPdfSubtitle(quickPdfsById.get(item.pdfId));
    return songsById.get(item.songId)?.artist || 'Sem artista';
  };

  const sectionItemResults = useMemo(() => {
    const query = sectionItemSearch.trim().toLowerCase();
    const targetItemIds = new Set(addTargetSection ? getPlaylistSectionItemIds(addTargetSection, draftItems) : []);
    const newPdfItems = quickPdfs
      .filter((pdf) => hasQuickPdfSource(pdf) && !draftPdfIdSet.has(pdf.id))
      .map((pdf) => makePdfPlaylistItem(pdf.id));
    const candidates = [...draftItems, ...newPdfItems];

    return candidates
      .map((item) => ({
        item,
        title: getItemTitle(item),
        subtitle: getItemSubtitle(item),
        alreadyInTarget: targetItemIds.has(item.id),
      }))
      .filter((row) => {
        if (!query) return true;
        return row.title.toLowerCase().includes(query) || row.subtitle.toLowerCase().includes(query);
      });
  }, [addTargetSection, draftItems, draftPdfIdSet, quickPdfs, sectionItemSearch, songsById, quickPdfsById]);

  const startDrag = (event: DragEvent<HTMLDivElement>, payload: DragPayload) => {
    setDragPayload(payload);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  };

  const getDropPayload = (event: DragEvent<HTMLDivElement>): DragPayload | null => {
    if (dragPayload) return dragPayload;
    const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  };

  const resetDrag = () => {
    setDragPayload(null);
    setDragOverTarget(null);
  };

  const getItemDragPayload = (payload: DragPayload | null): ItemDragPayload | null => {
    if (!payload || payload.kind === 'section') return null;
    return payload;
  };

  const allowDrop = (event: DragEvent<HTMLDivElement>, target: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverTarget(target);
  };

  const moveDraftItem = (itemId: string, delta: number) => {
    setDraftItems((prev) => {
      const index = prev.findIndex((item) => item.id === itemId);
      return moveItem(prev, index, index + delta);
    });
  };

  const moveDraftItemToTarget = (itemId: string, targetItemId: string) => {
    if (itemId === targetItemId) return;
    setDraftItems((prev) =>
      moveItem(
        prev,
        prev.findIndex((item) => item.id === itemId),
        prev.findIndex((item) => item.id === targetItemId),
      ),
    );
  };

  const removeItemFromSections = (itemIdsToRemove: string[], nextItems: PlaylistItem[]) => {
    setDraftSections((prev) =>
      prev.map((section) => {
        const nextItemIds = getPlaylistSectionItemIds(section, draftItems).filter((itemId) => !itemIdsToRemove.includes(itemId));
        return syncSectionWithItemIds(section, nextItemIds, nextItems);
      }),
    );
  };

  const removeSongFromList = (songId: string) => {
    const itemIdsToRemove = draftItems
      .filter((item) => item.type === 'song' && item.songId === songId)
      .map((item) => item.id);
    const nextItems = draftItems.filter((item) => item.type !== 'song' || item.songId !== songId);
    setDraftItems(nextItems);
    removeItemFromSections(itemIdsToRemove, nextItems);
  };

  const removePdfFromList = (itemId: string) => {
    const nextItems = draftItems.filter((item) => item.id !== itemId);
    setDraftItems(nextItems);
    removeItemFromSections([itemId], nextItems);
  };

  const addSongToStructure = (songId: string) => {
    setDraftItems((prev) =>
      prev.some((item) => item.type === 'song' && item.songId === songId)
        ? prev
        : [...prev, { id: `song:${songId}`, type: 'song', songId }],
    );
  };

  const addSection = () => {
    const title = newSectionTitle.trim() || 'Nova seção';
    setDraftSections((prev) => [...prev, { id: uid(), title, songIds: [], itemIds: [] }]);
    setNewSectionTitle('');
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setDraftSections((prev) =>
      prev.map((section) => (section.id === sectionId ? { ...section, title } : section)),
    );
  };

  const removeSection = (sectionId: string) => {
    setDraftSections((prev) => prev.filter((section) => section.id !== sectionId));
  };

  const addItemToSection = (sectionId: string, item: PlaylistItem) => {
    const itemExists = draftItems.some((draftItem) => draftItem.id === item.id);
    const nextItems = itemExists ? draftItems : [...draftItems, item];
    setDraftItems(nextItems);
    setDraftSections((prev) =>
      prev.map((section) => {
        const currentItemIds = getPlaylistSectionItemIds(section, nextItems).filter((itemId) => itemId !== item.id);
        const nextItemIds = section.id === sectionId ? [...currentItemIds, item.id] : currentItemIds;
        return syncSectionWithItemIds(section, nextItemIds, nextItems);
      }),
    );
  };

  const updateSectionColor = (sectionId: string, color?: string) => {
    setDraftSections((prev) =>
      prev.map((section) => (section.id === sectionId ? { ...section, color } : section)),
    );
    setColorSectionId(null);
  };

  const applyCustomSectionColor = () => {
    if (!colorSectionId) return;
    const normalized = normalizeHexColor(customSectionColor);
    if (!normalized) return;
    updateSectionColor(colorSectionId, normalized);
  };

  const copyCurrentSectionColor = async () => {
    const currentColor = getSectionColor(colorTargetSection?.color);
    if (!currentColor) return;
    try {
      await navigator.clipboard?.writeText(currentColor);
      setColorCopyFeedback('Cor copiada');
    } catch {
      setColorCopyFeedback('Não foi possível copiar');
    }
  };

  const removeItemFromSection = (sectionId: string, itemId: string) => {
    setDraftSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const nextItemIds = getPlaylistSectionItemIds(section, draftItems).filter((id) => id !== itemId);
        return syncSectionWithItemIds(section, nextItemIds, draftItems);
      }),
    );
  };

  const moveSectionItem = (sectionId: string, itemId: string, delta: number) => {
    setDraftSections((prev) =>
      prev.map((section) => {
        if (section.id !== sectionId) return section;
        const itemIds = getPlaylistSectionItemIds(section, draftItems);
        const index = itemIds.indexOf(itemId);
        return syncSectionWithItemIds(section, moveItem(itemIds, index, index + delta), draftItems);
      }),
    );
  };

  const moveSectionToTarget = (sectionId: string, targetSectionId: string) => {
    if (sectionId === targetSectionId) return;
    setDraftSections((prev) =>
      moveItem(
        prev,
        prev.findIndex((section) => section.id === sectionId),
        prev.findIndex((section) => section.id === targetSectionId),
      ),
    );
  };

  const placeItemInSection = (sectionId: string, itemId: string, targetItemId?: string) => {
    setDraftSections((prev) =>
      prev.map((section) => {
        const sourceItemIds = getPlaylistSectionItemIds(section, draftItems);
        const cleanItemIds = sourceItemIds.filter((id) => id !== itemId);
        if (section.id !== sectionId) return syncSectionWithItemIds(section, cleanItemIds, draftItems);

        const insertIndex = targetItemId ? cleanItemIds.indexOf(targetItemId) : -1;
        const nextItemIds = [...cleanItemIds];
        nextItemIds.splice(insertIndex >= 0 ? insertIndex : nextItemIds.length, 0, itemId);
        return syncSectionWithItemIds(section, nextItemIds, draftItems);
      }),
    );
  };

  const moveItemToUnsectioned = (itemId: string) => {
    setDraftSections((prev) =>
      prev.map((section) => {
        const nextItemIds = getPlaylistSectionItemIds(section, draftItems).filter((id) => id !== itemId);
        return syncSectionWithItemIds(section, nextItemIds, draftItems);
      }),
    );
  };

  const saveStructure = async () => {
    if (!playlist) return;
    const validItems = draftItems.filter((item) => item.type === 'pdf' || songsById.has(item.songId));
    const shouldPersistItems = !!playlist.items || validItems.some((item) => item.type === 'pdf');
    const sanitizedSections = draftSections
      .map((section) => syncPlaylistSectionItemIds(section, validItems))
      .map((section) => ({ ...section, title: section.title.trim() || 'Sem título' }))
      .filter((section) => section.title || section.itemIds?.length || section.songIds.length);

    const scriptOrder = deriveScriptPlaylistOrder(sanitizedSections, validItems);
    const nextItems = draftViewMode === 'script' ? scriptOrder.items : validItems;
    const nextSongIds = nextItems.flatMap((item) => (item.type === 'song' ? [item.songId] : []));
    const nextSections = draftViewMode === 'script' ? scriptOrder.sections : sanitizedSections;

    const rows = await db.getPlaylists();
    await db.savePlaylists(
      rows.map((item) => {
        if (item.id !== playlistId) return item;
        return {
          ...item,
          songIds: nextSongIds,
          ...(shouldPersistItems ? { items: nextItems } : { items: undefined }),
          viewMode: draftViewMode,
          sections: nextSections,
        };
      }),
    );
    nav.navigate('PlaylistDetail', { playlistId, playlistName: playlist.name, folderId, folderName });
  };

  const renderItemIcon = (item: PlaylistItem) => (
    <View style={item.type === 'pdf' ? localStyles.pdfIconTile : localStyles.musicIconTile}>
      {item.type === 'pdf' ? <FileText size={17} color="#ffd166" /> : <Music size={17} color="#38bdf8" />}
    </View>
  );

  const renderOrderRow = (item: PlaylistItem, index: number) => {
    const isFirst = index === 0;
    const isLast = index === draftItems.length - 1;
    const targetId = `order-${item.id}`;
    const isDragging = dragPayload?.kind === 'order-item' && dragPayload.itemId === item.id;
    const isDropTarget = dragOverTarget === targetId;
    const highlighted = item.type === 'song' && item.isHighlighted === true;

    return (
      <div
        key={item.id}
        draggable
        style={{
          ...(localStyles.songRow as CSSProperties),
          ...(isDragging ? (localStyles.dragging as CSSProperties) : {}),
          ...(isDropTarget ? (localStyles.dropTarget as CSSProperties) : {}),
          ...(highlighted ? (localStyles.highlightedSongRow as CSSProperties) : {}),
        }}
        onDragStart={(event) => startDrag(event, { kind: 'order-item', itemId: item.id })}
        onDragOver={(event) => allowDrop(event, targetId)}
        onDragLeave={() => setDragOverTarget(null)}
        onDrop={(event) => {
          event.preventDefault();
          const payload = getDropPayload(event);
          if (payload?.kind === 'order-item') moveDraftItemToTarget(payload.itemId, item.id);
          resetDrag();
        }}
        onDragEnd={resetDrag}
      >
        <Text style={localStyles.orderNumber}>{index + 1}</Text>
        <View style={localStyles.songLeft}>
          <GripHorizontal size={17} color="#4FC3F7" />
          {renderItemIcon(item)}
          <View style={localStyles.songInfo}>
            <View style={localStyles.songTitleRow}>
              <Text style={styles.title} numberOfLines={1}>{getItemTitle(item)}</Text>
              {highlighted ? <Star size={14} color="#ffd166" fill="#ffd166" /> : null}
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>{getItemSubtitle(item)}</Text>
          </View>
        </View>
        <View style={localStyles.songControls}>
          <TouchableOpacity disabled={isFirst} style={localStyles.iconButton} onPress={() => moveDraftItem(item.id, -1)}>
            <ArrowUp size={15} color={isFirst ? '#4b5563' : '#4FC3F7'} />
          </TouchableOpacity>
          <TouchableOpacity disabled={isLast} style={localStyles.iconButton} onPress={() => moveDraftItem(item.id, 1)}>
            <ArrowDown size={15} color={isLast ? '#4b5563' : '#4FC3F7'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={localStyles.iconButton}
            onPress={() => (item.type === 'pdf' ? removePdfFromList(item.id) : removeSongFromList(item.songId))}
          >
            <Trash2 size={15} color="#ff7a7a" />
          </TouchableOpacity>
        </View>
      </div>
    );
  };

  const renderSectionItemRow = (section: PlaylistSection, item: PlaylistItem, index: number, total: number) => {
    const targetId = `section-item-${section.id}-${item.id}`;
    const itemPayload = getItemDragPayload(dragPayload);
    const isDragging = itemPayload?.itemId === item.id;
    const isDropTarget = dragOverTarget === targetId;
    const highlighted = item.type === 'song' && item.isHighlighted === true;

    return (
      <div
        key={item.id}
        draggable
        style={{
          ...(localStyles.songRow as CSSProperties),
          ...(isDragging ? (localStyles.dragging as CSSProperties) : {}),
          ...(isDropTarget ? (localStyles.dropTarget as CSSProperties) : {}),
          ...(highlighted ? (localStyles.highlightedSongRow as CSSProperties) : {}),
        }}
        onDragStart={(event) => startDrag(event, { kind: 'section-item', sectionId: section.id, itemId: item.id })}
        onDragOver={(event) => allowDrop(event, targetId)}
        onDragLeave={() => setDragOverTarget(null)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const payload = getItemDragPayload(getDropPayload(event));
          if (payload && payload.itemId !== item.id) placeItemInSection(section.id, payload.itemId, item.id);
          resetDrag();
        }}
        onDragEnd={resetDrag}
      >
        <View style={localStyles.songLeft}>
          <GripHorizontal size={17} color="#4FC3F7" />
          {renderItemIcon(item)}
          <View style={localStyles.songInfo}>
            <View style={localStyles.songTitleRow}>
              <Text style={styles.title} numberOfLines={1}>{getItemTitle(item)}</Text>
              {highlighted ? <Star size={14} color="#ffd166" fill="#ffd166" /> : null}
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>{getItemSubtitle(item)}</Text>
          </View>
        </View>
        <View style={localStyles.songControls}>
          <TouchableOpacity disabled={index === 0} style={localStyles.iconButton} onPress={() => moveSectionItem(section.id, item.id, -1)}>
            <ArrowUp size={15} color={index === 0 ? '#4b5563' : '#4FC3F7'} />
          </TouchableOpacity>
          <TouchableOpacity disabled={index === total - 1} style={localStyles.iconButton} onPress={() => moveSectionItem(section.id, item.id, 1)}>
            <ArrowDown size={15} color={index === total - 1 ? '#4b5563' : '#4FC3F7'} />
          </TouchableOpacity>
          <TouchableOpacity style={localStyles.iconButton} onPress={() => removeItemFromSection(section.id, item.id)}>
            <Trash2 size={15} color="#ff7a7a" />
          </TouchableOpacity>
        </View>
      </div>
    );
  };

  const renderUnsectionedItemRow = (item: PlaylistItem) => {
    const targetId = `unsectioned-item-${item.id}`;
    const itemPayload = getItemDragPayload(dragPayload);
    const isDragging = itemPayload?.itemId === item.id;
    const isDropTarget = dragOverTarget === targetId;
    const highlighted = item.type === 'song' && item.isHighlighted === true;

    return (
      <div
        key={item.id}
        draggable
        style={{
          ...(localStyles.songRow as CSSProperties),
          ...(isDragging ? (localStyles.dragging as CSSProperties) : {}),
          ...(isDropTarget ? (localStyles.dropTarget as CSSProperties) : {}),
          ...(highlighted ? (localStyles.highlightedSongRow as CSSProperties) : {}),
        }}
        onDragStart={(event) => startDrag(event, { kind: 'unsectioned-item', itemId: item.id })}
        onDragOver={(event) => allowDrop(event, targetId)}
        onDragLeave={() => setDragOverTarget(null)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const payload = getItemDragPayload(getDropPayload(event));
          if (payload) moveItemToUnsectioned(payload.itemId);
          resetDrag();
        }}
        onDragEnd={resetDrag}
      >
        <View style={localStyles.songLeft}>
          <GripHorizontal size={17} color="#4FC3F7" />
          {renderItemIcon(item)}
          <View style={localStyles.songInfo}>
            <View style={localStyles.songTitleRow}>
              <Text style={styles.title} numberOfLines={1}>{getItemTitle(item)}</Text>
              {highlighted ? <Star size={14} color="#ffd166" fill="#ffd166" /> : null}
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>{getItemSubtitle(item)}</Text>
          </View>
        </View>
      </div>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={localStyles.content}>
        <View style={localStyles.headerCard}>
          <Text style={localStyles.headerTitle}>{playlist?.name || playlistName || 'Lista'}</Text>
          <Text style={localStyles.headerSubtitle}>
            Escolha entre lista simples ou roteiro com seções.
          </Text>
          <TouchableOpacity
            style={localStyles.addSongTopButton}
            onPress={() => {
              setSongSearch('');
              setAddSongOpen(true);
            }}
          >
            <Plus size={16} color="#04151e" />
            <Text style={localStyles.addSongTopButtonText}>Música</Text>
          </TouchableOpacity>
          <View style={localStyles.modeRow}>
            {[
              { mode: 'default' as const, label: 'Modo padrão' },
              { mode: 'script' as const, label: 'Modo roteiro' },
            ].map((option) => {
              const active = draftViewMode === option.mode;
              return (
                <TouchableOpacity
                  key={option.mode}
                  style={[localStyles.modeButton, active && localStyles.modeButtonActive]}
                  onPress={() => setDraftViewMode(option.mode)}
                >
                  <Text style={[localStyles.modeButtonText, active && localStyles.modeButtonTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {draftViewMode === 'default' ? (
          <View style={styles.settingsControlBlock}>
            <Text style={styles.settingsModalSubhead}>Modo padrão</Text>
            <Text style={styles.settingsControlHint}>
              Mantém a lista simples. Use as setas para ordenar ou remova itens da lista.
            </Text>
            <View style={localStyles.listBlock}>
              {draftItems.length ? draftItems.map(renderOrderRow) : (
                <Text style={styles.settingsEmptyText}>Adicione músicas à lista antes de organizar.</Text>
              )}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.settingsControlBlock}>
              <Text style={styles.settingsModalSubhead}>Modo roteiro</Text>
              <Text style={styles.settingsControlHint}>
                Crie títulos de roteiro e associe músicas ou PDFs rápidos a cada seção.
              </Text>
              <View style={localStyles.addSectionRow}>
                <TextInput
                  style={[styles.input, localStyles.sectionInput]}
                  value={newSectionTitle}
                  onChangeText={setNewSectionTitle}
                  placeholder="Ex: ENTRADA"
                  placeholderTextColor="#666"
                />
                <TouchableOpacity style={localStyles.addButton} onPress={addSection}>
                  <Plus size={17} color="#04151e" />
                  <Text style={localStyles.addButtonText}>Seção</Text>
                </TouchableOpacity>
              </View>
            </View>

            {draftSections.length ? (
              draftSections.map((section) => {
                const sectionItems = getPlaylistSectionItems(section, draftItems);
                const targetId = `section-${section.id}`;
                const sectionColor = getSectionColor(section.color);
                const sectionBackground = getSectionSoftBackground(section.color);
                const isDragging = dragPayload?.kind === 'section' && dragPayload.sectionId === section.id;
                const isDropTarget = dragOverTarget === targetId;
                return (
                  <div
                    key={section.id}
                    style={{
                      ...(styles.settingsControlBlock as CSSProperties),
                      ...(localStyles.sectionCard as CSSProperties),
                      ...(sectionBackground
                        ? ({ backgroundColor: sectionBackground, borderColor: sectionColor } as CSSProperties)
                        : {}),
                      ...(isDragging ? (localStyles.dragging as CSSProperties) : {}),
                      ...(isDropTarget ? (localStyles.dropTarget as CSSProperties) : {}),
                    }}
                    onDragOver={(event) => allowDrop(event, targetId)}
                    onDragLeave={() => setDragOverTarget(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      const payload = getDropPayload(event);
                      if (payload?.kind === 'section') {
                        moveSectionToTarget(payload.sectionId, section.id);
                      } else {
                        const itemPayload = getItemDragPayload(payload);
                        if (itemPayload) placeItemInSection(section.id, itemPayload.itemId);
                      }
                      resetDrag();
                    }}
                  >
                    <View style={localStyles.sectionHeader}>
                      <div
                        draggable
                        style={localStyles.sectionDragHandle as CSSProperties}
                        onDragStart={(event) => startDrag(event, { kind: 'section', sectionId: section.id })}
                        onDragEnd={resetDrag}
                      >
                        <GripHorizontal size={17} color="#4FC3F7" />
                      </div>
                      <View
                        style={[
                          localStyles.sectionColorMarker,
                          {
                            backgroundColor: sectionColor || 'transparent',
                            borderColor: sectionColor || 'var(--app-border-soft)',
                          },
                        ]}
                      />
                      <TextInput
                        style={[styles.input, localStyles.sectionTitleInput]}
                        value={section.title}
                        onChangeText={(title: string) => updateSectionTitle(section.id, title)}
                        placeholder="Nome da seção"
                        placeholderTextColor="#666"
                      />
                      <TouchableOpacity style={localStyles.colorButton} onPress={() => setColorSectionId(section.id)}>
                        <Palette size={15} color={sectionColor || 'var(--app-accent)'} />
                        <Text style={localStyles.colorButtonText}>Cor</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={localStyles.iconButton} onPress={() => removeSection(section.id)}>
                        <Trash2 size={16} color="#ff7a7a" />
                      </TouchableOpacity>
                    </View>
                    {sectionItems.length ? (
                      sectionItems.map((item, index) => renderSectionItemRow(section, item, index, sectionItems.length))
                    ) : (
                      <Text style={styles.settingsEmptyText}>Nenhum item nesta seção.</Text>
                    )}
                    <TouchableOpacity
                      style={localStyles.secondaryButton}
                      onPress={() => {
                        setSectionItemSearch('');
                        setAddSectionId(section.id);
                      }}
                    >
                      <Plus size={16} color="#4FC3F7" />
                      <Text style={localStyles.secondaryButtonText}>Adicionar item à seção</Text>
                    </TouchableOpacity>
                  </div>
                );
              })
            ) : (
              <View style={styles.settingsControlBlock}>
                <Text style={styles.settingsEmptyText}>
                  Nenhuma seção criada. A lista continuará aparecendo como lista simples até você criar uma seção.
                </Text>
              </View>
            )}

            {unsectionedItems.length ? (
              <div
                style={{
                  ...(styles.settingsControlBlock as CSSProperties),
                  ...(dragOverTarget === 'unsectioned' ? (localStyles.dropTarget as CSSProperties) : {}),
                }}
                onDragOver={(event) => allowDrop(event, 'unsectioned')}
                onDragLeave={() => setDragOverTarget(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  const payload = getItemDragPayload(getDropPayload(event));
                  if (payload) moveItemToUnsectioned(payload.itemId);
                  resetDrag();
                }}
              >
                <Text style={styles.settingsModalSubhead}>Sem seção</Text>
                {unsectionedItems.map(renderUnsectionedItemRow)}
              </div>
            ) : null}
          </>
        )}
      </ScrollView>

      <View style={localStyles.footer}>
        <TouchableOpacity
          style={styles.modalGhostBtn}
          onPress={() => nav.navigate('PlaylistDetail', { playlistId, playlistName: playlist?.name || playlistName, folderId, folderName })}
        >
          <Text style={styles.modalGhostText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalPrimaryBtn} onPress={saveStructure}>
          <Text style={styles.modalPrimaryText}>Salvar organização</Text>
        </TouchableOpacity>
      </View>

      <AppModal
        visible={addSongOpen}
        title="Adicionar música"
        onClose={() => setAddSongOpen(false)}
        icon={<Music size={16} color="var(--app-accent)" />}
        maxWidth={560}
        footer={
          <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setAddSongOpen(false)}>
            <Text style={styles.modalGhostText}>Fechar</Text>
          </TouchableOpacity>
        }
      >
        <View style={localStyles.searchBox}>
          <Search size={18} color="var(--app-muted-text)" />
          <TextInput
            style={localStyles.searchInput}
            value={songSearch}
            onChangeText={setSongSearch}
            placeholder="Buscar por título ou artista..."
            placeholderTextColor="var(--app-subtle-text)"
            autoFocus
          />
        </View>
        <ScrollView style={localStyles.addSongScroll}>
          {addSongResults.length ? (
            addSongResults.map((song) => {
              const alreadyAdded = draftSongIdSet.has(song.id);
              return (
                <TouchableOpacity
                  key={song.id}
                  style={[localStyles.addSongRow, alreadyAdded && localStyles.disabledRow]}
                  disabled={alreadyAdded}
                  onPress={() => addSongToStructure(song.id)}
                >
                  <View style={localStyles.addSongInfo}>
                    <Text style={styles.settingsControlTitle} numberOfLines={1}>{song.title}</Text>
                    <Text style={styles.settingsControlHint} numberOfLines={1}>{song.artist || 'Sem artista'}</Text>
                  </View>
                  {alreadyAdded ? (
                    <Text style={localStyles.alreadyAddedText}>Já adicionada</Text>
                  ) : (
                    <Plus size={18} color="#4FC3F7" />
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.settingsEmptyText}>Nenhuma música encontrada.</Text>
          )}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={!!addSectionId}
        title={addTargetSection ? `Adicionar em ${addTargetSection.title || 'seção'}` : 'Adicionar item'}
        onClose={() => setAddSectionId(null)}
        icon={<FolderPlus size={16} color="var(--app-accent)" />}
        maxWidth={520}
      >
        <View style={localStyles.searchBox}>
          <Search size={18} color="var(--app-muted-text)" />
          <TextInput
            style={localStyles.searchInput}
            value={sectionItemSearch}
            onChangeText={setSectionItemSearch}
            placeholder="Buscar música ou PDF..."
            placeholderTextColor="var(--app-subtle-text)"
            autoFocus
          />
        </View>
        <ScrollView style={{ maxHeight: 360 }}>
          {sectionItemResults.length ? (
            sectionItemResults.map((row) => (
              <TouchableOpacity
                key={row.item.id}
                style={[styles.settingsInlineAction, row.alreadyInTarget && localStyles.disabledRow]}
                disabled={row.alreadyInTarget}
                onPress={() => {
                  if (!addSectionId) return;
                  addItemToSection(addSectionId, row.item);
                  setAddSectionId(null);
                }}
              >
                <View style={localStyles.addItemRowIconWrap}>{renderItemIcon(row.item)}</View>
                <View style={localStyles.addSongInfo}>
                  <Text style={styles.settingsControlTitle} numberOfLines={1}>{row.title}</Text>
                  <Text style={styles.settingsControlHint} numberOfLines={1}>{row.subtitle}</Text>
                </View>
                {row.alreadyInTarget ? (
                  <Text style={localStyles.alreadyAddedText}>Na seção</Text>
                ) : (
                  <Plus size={18} color="#4FC3F7" />
                )}
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.settingsEmptyText}>Nenhum item disponível para adicionar.</Text>
          )}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={!!colorSectionId}
        title={colorTargetSection ? `Cor de ${colorTargetSection.title || 'seção'}` : 'Cor da seção'}
        onClose={() => setColorSectionId(null)}
        icon={<Palette size={16} color="var(--app-accent)" />}
        maxWidth={460}
      >
        <View style={localStyles.currentColorBox}>
          <View
            style={[
              localStyles.currentColorPreview,
              {
                backgroundColor: getSectionColor(colorTargetSection?.color) || 'transparent',
                borderColor: getSectionColor(colorTargetSection?.color) || 'var(--app-border-soft)',
              },
            ]}
          />
          <View style={localStyles.currentColorTextWrap}>
            <Text style={localStyles.currentColorLabel}>Cor atual</Text>
            <Text style={localStyles.currentColorValue}>
              {getSectionColorLabel(colorTargetSection?.color)}
              {getSectionColor(colorTargetSection?.color) ? ` • ${getSectionColor(colorTargetSection?.color)}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[localStyles.copyColorButton, !getSectionColor(colorTargetSection?.color) && localStyles.disabledRow]}
            disabled={!getSectionColor(colorTargetSection?.color)}
            onPress={copyCurrentSectionColor}
          >
            <Copy size={15} color="var(--app-accent)" />
          </TouchableOpacity>
        </View>
        {colorCopyFeedback ? <Text style={localStyles.colorFeedback}>{colorCopyFeedback}</Text> : null}

        <View style={localStyles.colorGrid}>
          {SECTION_COLOR_OPTIONS.map((option) => {
            const active = colorTargetSection?.color === option.value || (!colorTargetSection?.color && !option.value);
            return (
              <TouchableOpacity
                key={option.value || 'none'}
                style={[localStyles.colorOption, active && localStyles.colorOptionActive]}
                onPress={() => colorSectionId && updateSectionColor(colorSectionId, option.value)}
              >
                <View
                  style={[
                    localStyles.colorDot,
                    {
                      backgroundColor: option.color,
                      borderColor: option.value ? option.color : 'var(--app-border-soft)',
                    },
                  ]}
                />
                <Text style={localStyles.colorOptionText}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={localStyles.customColorBox}>
          <Text style={localStyles.currentColorLabel}>Personalizada</Text>
          <View style={localStyles.customColorRow}>
            <TextInput
              style={[localStyles.customColorInput, !normalizeHexColor(customSectionColor) && customSectionColor.trim() ? localStyles.customColorInputError : null]}
              value={customSectionColor}
              onChangeText={setCustomSectionColor}
              placeholder="#4FC3F7"
              placeholderTextColor="#777"
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[localStyles.applyColorButton, !normalizeHexColor(customSectionColor) && localStyles.disabledRow]}
              disabled={!normalizeHexColor(customSectionColor)}
              onPress={applyCustomSectionColor}
            >
              <Text style={localStyles.applyColorText}>Definir</Text>
            </TouchableOpacity>
          </View>
          {customSectionColor.trim() && !normalizeHexColor(customSectionColor) ? (
            <Text style={localStyles.colorErrorText}>Use HEX válido, exemplo #4FC3F7.</Text>
          ) : null}
        </View>
      </AppModal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  content: {
    padding: 12,
    paddingBottom: 110,
    gap: 12,
  },
  headerCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    padding: 14,
  },
  headerTitle: {
    color: 'var(--app-text)',
    fontSize: 18,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    marginTop: 4,
  },
  addSongTopButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: 'var(--app-accent)',
    paddingHorizontal: 14,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addSongTopButtonText: {
    color: '#04151e',
    fontSize: 13,
    fontWeight: '900',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  modeButtonText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  modeButtonTextActive: {
    color: 'var(--app-accent)',
  },
  listBlock: {
    marginTop: 12,
    gap: 8,
  },
  songRow: {
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: 8,
    width: '100%',
    boxSizing: 'border-box',
  },
  songLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  songControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  dragging: {
    opacity: 0.55,
  },
  dropTarget: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  highlightedSongRow: {
    borderColor: 'rgba(255, 209, 102, 0.46)',
    backgroundColor: 'rgba(255, 209, 102, 0.08)',
  },
  orderNumber: {
    width: 26,
    color: 'var(--app-subtle-text)',
    fontSize: 12,
    fontWeight: '900',
  },
  songInfo: {
    flex: 1,
    minWidth: 0,
  },
  songTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  musicIconTile: {
    width: 34,
    height: 34,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 165, 233, 0.10)',
    borderColor: 'rgba(56, 189, 248, 0.22)',
    borderWidth: 1,
    flexShrink: 0,
  },
  pdfIconTile: {
    width: 34,
    height: 34,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 209, 102, 0.12)',
    borderColor: 'rgba(255, 209, 102, 0.28)',
    borderWidth: 1,
    flexShrink: 0,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-surface-soft)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    flexShrink: 0,
  },
  addSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  sectionInput: {
    flex: 1,
    marginHorizontal: 0,
    marginVertical: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCard: {
    transitionProperty: 'border-color, background-color, opacity',
    transitionDuration: '120ms',
  },
  sectionDragHandle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    flexShrink: 0,
  },
  sectionColorMarker: {
    width: 8,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
  },
  sectionTitleInput: {
    flex: 1,
    marginHorizontal: 0,
    marginVertical: 0,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  colorButton: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  colorButtonText: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '800',
  },
  addButton: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: 'var(--app-accent)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    color: '#04151e',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  disabledRow: {
    opacity: 0.48,
  },
  colorGrid: {
    gap: 8,
  },
  currentColorBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currentColorPreview: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
  },
  currentColorTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  currentColorLabel: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '800',
  },
  currentColorValue: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  copyColorButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorFeedback: {
    color: 'var(--app-accent)',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  colorOption: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorOptionActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },
  colorOptionText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  customColorBox: {
    borderTopWidth: 1,
    borderTopColor: 'var(--app-border-soft)',
    marginTop: 12,
    paddingTop: 12,
  },
  customColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  customColorInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    color: 'var(--app-text)',
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '800',
  },
  customColorInputError: {
    borderColor: '#ff6b6b',
  },
  applyColorButton: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: 'var(--app-accent)',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyColorText: {
    color: '#04151e',
    fontSize: 13,
    fontWeight: '900',
  },
  colorErrorText: {
    color: '#ff8a8a',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  searchBox: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    color: 'var(--app-text)',
    fontSize: 14,
    outlineStyle: 'none',
  },
  addSongScroll: {
    maxHeight: 380,
  },
  addSongRow: {
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addItemRowIconWrap: {
    flexShrink: 0,
  },
  addSongInfo: {
    flex: 1,
    minWidth: 0,
  },
  alreadyAddedText: {
    color: 'var(--app-subtle-text)',
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
