import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native-web';
import {
  Archive,
  Check,
  Database,
  FileText,
  Folder,
  HardDrive,
  ListMusic,
  Music,
  Search,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  UserRound,
} from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { useSettings } from '../contexts/SettingsContext';
import {
  buildCifrasGoCustomBackupZip,
  buildCifrasGoFullBackupZip,
  restoreBackupZip,
  restoreCifrasGoSongTextFile,
} from '../services/backup';
import { buildPlaylistPdfExport, type PlaylistPdfExportMode } from '../services/playlistPdfExport';
import { shareBlobFile } from '../services/share';
import {
  auditSongRecordings,
  cleanupOrphanSongRecordings,
  type SongRecordingAuditResult,
  type SongRecordingCleanupResult,
} from '../services/songRecordingMaintenance';
import {
  countLegacySongRecordings,
  migrateLegacySongRecordings,
  type SongRecordingMigrationProgress,
  type SongRecordingMigrationResult,
} from '../services/songRecordingMigration';
import { db } from '../services/storage';
import type { Folder as FolderModel, Playlist, PlaylistSection, Song } from '../types/models';
import { getPlaylistItems } from '../utils/playlistItems';
import { hasSongAudioNote } from '../utils/songAudio';

interface BackupScreenProps {
  styles: any;
}

type CustomBackupTab = 'songs' | 'artists' | 'playlists' | 'folders';

type BackupStats = {
  songs: number;
  playlists: number;
  folders: number;
  audioRecordings: number;
  audioBase64Chars: number;
  audioFileRecordings: number;
  legacyAudioRecordings: number;
};

const customTabs: Array<{ id: CustomBackupTab; label: string }> = [
  { id: 'songs', label: 'Musicas' },
  { id: 'artists', label: 'Artistas' },
  { id: 'playlists', label: 'Listas' },
  { id: 'folders', label: 'Pastas' },
];

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const safeSongIds = (value: string[] | undefined): string[] =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : [];

const getPlaylistSongIds = (playlist: Playlist): string[] => {
  const sectionSongIds = Array.isArray(playlist.sections)
    ? playlist.sections.flatMap((section: PlaylistSection) => safeSongIds(section.songIds))
    : [];
  return Array.from(new Set([...safeSongIds(playlist.songIds), ...sectionSongIds]));
};

const getPlaylistExportSongIds = (playlist: Playlist): string[] =>
  Array.from(new Set(getPlaylistItems(playlist).filter((item) => item.type === 'song').map((item) => item.songId)));

const getPlaylistExportPdfCount = (playlist: Playlist): number =>
  getPlaylistItems(playlist).filter((item) => item.type === 'pdf').length;

const toggleValue = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

const formatCustomBackupFileName = () => {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    'CifrasGo_backup_personalizado_',
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    '-',
    pad(date.getMinutes()),
    '.zip',
  ].join('');
};

export function BackupScreen({ styles }: BackupScreenProps) {
  const { themeSettings } = useSettings();
  const isLightTheme = themeSettings.mode === 'light';
  const [backupStats, setBackupStats] = useState<BackupStats>({
    songs: 0,
    playlists: 0,
    folders: 0,
    audioRecordings: 0,
    audioBase64Chars: 0,
    audioFileRecordings: 0,
    legacyAudioRecordings: 0,
  });
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<{ done: number; total: number } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customLoading, setCustomLoading] = useState(false);
  const [customDataLoading, setCustomDataLoading] = useState(false);
  const [includeFullBackupAudio, setIncludeFullBackupAudio] = useState(true);
  const [includeCustomBackupAudio, setIncludeCustomBackupAudio] = useState(true);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<SongRecordingMigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<SongRecordingMigrationResult | null>(null);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [recordingAudit, setRecordingAudit] = useState<SongRecordingAuditResult | null>(null);
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<SongRecordingCleanupResult | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [pdfExportOpen, setPdfExportOpen] = useState(false);
  const [pdfExportLoading, setPdfExportLoading] = useState(false);
  const [pdfExportDataLoading, setPdfExportDataLoading] = useState(false);
  const [pdfExportPlaylists, setPdfExportPlaylists] = useState<Playlist[]>([]);
  const [pdfExportQuery, setPdfExportQuery] = useState('');
  const [selectedPdfPlaylistId, setSelectedPdfPlaylistId] = useState('');
  const [pdfExportMode, setPdfExportMode] = useState<PlaylistPdfExportMode>('chords');
  const [pdfExportFontSize, setPdfExportFontSize] = useState('11');
  const [pdfPageBreakBetweenSongs, setPdfPageBreakBetweenSongs] = useState(true);
  const [pdfIncludeSummary, setPdfIncludeSummary] = useState(false);
  const [pdfIncludeTitle, setPdfIncludeTitle] = useState(true);
  const [pdfIncludeArtist, setPdfIncludeArtist] = useState(true);
  const [customTab, setCustomTab] = useState<CustomBackupTab>('songs');
  const [customSongs, setCustomSongs] = useState<Song[]>([]);
  const [customPlaylists, setCustomPlaylists] = useState<Playlist[]>([]);
  const [customFolders, setCustomFolders] = useState<FolderModel[]>([]);
  const [customFolderSongs, setCustomFolderSongs] = useState<Record<string, string[]>>({});
  const [songQuery, setSongQuery] = useState('');
  const [artistQuery, setArtistQuery] = useState('');
  const [playlistQuery, setPlaylistQuery] = useState('');
  const [folderQuery, setFolderQuery] = useState('');
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [selectedArtistNames, setSelectedArtistNames] = useState<string[]>([]);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const busy = restoreLoading || exportLoading || customLoading || pdfExportLoading || migrationLoading || maintenanceLoading;
  const hasCustomSelection =
    selectedSongIds.length > 0 ||
    selectedArtistNames.length > 0 ||
    selectedPlaylistIds.length > 0 ||
    selectedFolderIds.length > 0;

  useEffect(() => {
    let active = true;

    const loadBackupStats = async () => {
      try {
        const [songs, playlists, folders] = await Promise.all([
          db.getSongs(),
          db.getPlaylists(),
          db.getFolders(),
        ]);
        if (!active) return;
        const songsWithAudio = songs.filter(hasSongAudioNote);
        setBackupStats({
          songs: songs.length,
          playlists: playlists.length,
          folders: folders.length,
          audioRecordings: songsWithAudio.length,
          audioBase64Chars: songsWithAudio.reduce((total, song) => total + (song.audioNoteBase64?.length || 0), 0),
          audioFileRecordings: songsWithAudio.filter((song) => !!song.audioNoteFile?.trim()).length,
          legacyAudioRecordings: countLegacySongRecordings(songs),
        });
      } catch {
        if (active) setBackupStats({
          songs: 0,
          playlists: 0,
          folders: 0,
          audioRecordings: 0,
          audioBase64Chars: 0,
          audioFileRecordings: 0,
          legacyAudioRecordings: 0,
        });
      }
    };

    void loadBackupStats();
    return () => {
      active = false;
    };
  }, []);

  const foldersById = useMemo(
    () => new Map(customFolders.map((folder) => [folder.id, folder])),
    [customFolders]
  );
  const songsById = useMemo(
    () => new Map(customSongs.map((song) => [song.id, song])),
    [customSongs]
  );

  const getFolderPath = (folderId: string | null | undefined): string => {
    if (!folderId) return 'Raiz';
    const names: string[] = [];
    const visited = new Set<string>();
    let currentId: string | null | undefined = folderId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const folder = foldersById.get(currentId);
      if (!folder) break;
      names.unshift(folder.name);
      currentId = folder.parentId ?? null;
    }

    return names.length ? names.join(' / ') : 'Raiz';
  };

  const getDescendantFolderIds = (folderId: string): string[] => {
    const children = customFolders.filter((folder) => (folder.parentId ?? null) === folderId);
    return children.flatMap((folder) => [folder.id, ...getDescendantFolderIds(folder.id)]);
  };

  const getFolderStats = (folderId: string) => {
    const treeIds = new Set([folderId, ...getDescendantFolderIds(folderId)]);
    const subfolderCount = treeIds.size - 1;
    const playlistCount = customPlaylists.filter((playlist) => playlist.folderId && treeIds.has(playlist.folderId)).length;
    const songCount = new Set(
      Object.entries(customFolderSongs)
        .filter(([id]) => treeIds.has(id))
        .flatMap(([, ids]) => ids)
    ).size;
    return { playlistCount, subfolderCount, songCount };
  };

  const artistOptions = useMemo(() => {
    const byArtist = new Map<string, { name: string; count: number }>();
    customSongs.forEach((song) => {
      const name = song.artist.trim();
      if (!name) return;
      const key = name.toLowerCase();
      const current = byArtist.get(key);
      byArtist.set(key, { name, count: (current?.count || 0) + 1 });
    });
    return Array.from(byArtist.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [customSongs]);

  const filteredSongs = useMemo(() => {
    const query = normalizeText(songQuery);
    return customSongs
      .filter((song) => !query || normalizeText(`${song.title} ${song.artist}`).includes(query))
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  }, [customSongs, songQuery]);

  const filteredArtists = useMemo(() => {
    const query = normalizeText(artistQuery);
    return artistOptions.filter((artist) => !query || normalizeText(artist.name).includes(query));
  }, [artistOptions, artistQuery]);

  const filteredPlaylists = useMemo(() => {
    const query = normalizeText(playlistQuery);
    return customPlaylists
      .filter((playlist) => !query || normalizeText(`${playlist.name} ${getFolderPath(playlist.folderId)}`).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [customPlaylists, playlistQuery, foldersById]);

  const filteredFolders = useMemo(() => {
    const query = normalizeText(folderQuery);
    return customFolders
      .filter((folder) => !query || normalizeText(getFolderPath(folder.id)).includes(query))
      .sort((a, b) => getFolderPath(a.id).localeCompare(getFolderPath(b.id), 'pt-BR'));
  }, [customFolders, folderQuery, foldersById]);

  const filteredPdfExportPlaylists = useMemo(() => {
    const query = normalizeText(pdfExportQuery);
    return pdfExportPlaylists
      .filter((playlist) => !query || normalizeText(playlist.name).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [pdfExportPlaylists, pdfExportQuery]);

  const selectedPdfPlaylist = useMemo(
    () => pdfExportPlaylists.find((playlist) => playlist.id === selectedPdfPlaylistId) || null,
    [pdfExportPlaylists, selectedPdfPlaylistId]
  );
  const selectedPdfPlaylistSongCount = selectedPdfPlaylist ? getPlaylistExportSongIds(selectedPdfPlaylist).length : 0;
  const selectedPdfPlaylistPdfCount = selectedPdfPlaylist ? getPlaylistExportPdfCount(selectedPdfPlaylist) : 0;
  const pdfExportFontSizeNumber = Number(pdfExportFontSize.replace(',', '.')) || 11;
  const canGeneratePdfExport = !!selectedPdfPlaylist && selectedPdfPlaylistSongCount > 0 && !pdfExportLoading;

  const summaryItems = useMemo(() => {
    const rows: string[] = [];

    selectedArtistNames.forEach((name) => {
      const artist = artistOptions.find((item) => item.name === name);
      rows.push(`Artista: ${name} - ${artist?.count || 0} musicas`);
    });
    selectedSongIds.forEach((id) => {
      const song = songsById.get(id);
      if (song) rows.push(`Musica: ${song.title || 'Sem titulo'} - ${song.artist || 'Sem artista'}`);
    });
    selectedPlaylistIds.forEach((id) => {
      const playlist = customPlaylists.find((item) => item.id === id);
      if (playlist) rows.push(`Lista: ${playlist.name} - ${getPlaylistSongIds(playlist).length} musicas`);
    });
    selectedFolderIds.forEach((id) => {
      const folder = foldersById.get(id);
      if (!folder) return;
      const stats = getFolderStats(id);
      rows.push(`Pasta: ${getFolderPath(id)} - ${stats.playlistCount} listas / ${stats.subfolderCount} subpastas`);
    });

    return rows;
  }, [
    artistOptions,
    customPlaylists,
    foldersById,
    selectedArtistNames,
    selectedFolderIds,
    selectedPlaylistIds,
    selectedSongIds,
    songsById,
    customFolderSongs,
  ]);

  useEffect(() => {
    if (!customOpen) return;
    let active = true;

    const loadCustomBackupData = async () => {
      setCustomDataLoading(true);
      try {
        const [songs, playlists, folders, folderSongs] = await Promise.all([
          db.getSongs(),
          db.getPlaylists(),
          db.getFolders(),
          db.getFolderSongMap(),
        ]);
        if (!active) return;
        setCustomSongs(songs);
        setCustomPlaylists(playlists);
        setCustomFolders(folders);
        setCustomFolderSongs(folderSongs);
      } catch (error: any) {
        if (active) setRestoreMsg(error?.message ? `Erro: ${error.message}` : 'Erro ao carregar dados do backup personalizado.');
      } finally {
        if (active) setCustomDataLoading(false);
      }
    };

    void loadCustomBackupData();
    return () => {
      active = false;
    };
  }, [customOpen]);

  useEffect(() => {
    if (!pdfExportOpen) return;
    let active = true;

    const loadPdfExportData = async () => {
      setPdfExportDataLoading(true);
      try {
        const playlists = await db.getPlaylists();
        if (!active) return;
        setPdfExportPlaylists(playlists);
        setSelectedPdfPlaylistId((current) => current || playlists[0]?.id || '');
      } catch (error: any) {
        if (active) setRestoreMsg(error?.message ? `Erro: ${error.message}` : 'Erro ao carregar listas para exportar PDF.');
      } finally {
        if (active) setPdfExportDataLoading(false);
      }
    };

    void loadPdfExportData();
    return () => {
      active = false;
    };
  }, [pdfExportOpen]);

  const clearCustomSelection = () => {
    setSelectedSongIds([]);
    setSelectedArtistNames([]);
    setSelectedPlaylistIds([]);
    setSelectedFolderIds([]);
  };

  const openCustomBackupModal = () => {
    setRestoreMsg(null);
    setRestoreProgress(null);
    setCustomOpen(true);
  };

  const openPlaylistPdfExportModal = () => {
    setRestoreMsg(null);
    setRestoreProgress(null);
    setPdfExportOpen(true);
  };

  const openRecordingMigrationModal = () => {
    setMigrationProgress(null);
    setMigrationResult(null);
    setMigrationOpen(true);
  };

  const runRecordingMigration = async () => {
    setMigrationLoading(true);
    setMigrationProgress({ done: 0, total: backupStats.legacyAudioRecordings, title: '' });
    setMigrationResult(null);
    try {
      const result = await migrateLegacySongRecordings({
        onProgress: setMigrationProgress,
      });
      setMigrationResult(result);
      try {
        const songs = await db.getSongs();
        const songsWithAudio = songs.filter(hasSongAudioNote);
        setBackupStats((current) => ({
          ...current,
          songs: songs.length,
          audioRecordings: songsWithAudio.length,
          audioBase64Chars: songsWithAudio.reduce((total, song) => total + (song.audioNoteBase64?.length || 0), 0),
          audioFileRecordings: songsWithAudio.filter((song) => !!song.audioNoteFile?.trim()).length,
          legacyAudioRecordings: countLegacySongRecordings(songs),
        }));
      } catch {
        // O resultado da migracao continua valido mesmo se a releitura visual falhar.
      }
    } catch (error: any) {
      setMigrationResult({
        total: backupStats.legacyAudioRecordings,
        migrated: 0,
        failures: [],
        stoppedReason: error?.message || 'Nao foi possivel iniciar a conversao.',
      });
    } finally {
      setMigrationLoading(false);
    }
  };

  const runRecordingAudit = async () => {
    setMaintenanceLoading(true);
    setMaintenanceError(null);
    setCleanupResult(null);
    try {
      setRecordingAudit(await auditSongRecordings());
    } catch (error: any) {
      setRecordingAudit(null);
      setMaintenanceError(error?.message || 'Nao foi possivel verificar as gravacoes.');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const openRecordingMaintenance = () => {
    setMaintenanceOpen(true);
    setCleanupConfirmOpen(false);
    void runRecordingAudit();
  };

  const runOrphanCleanup = async () => {
    if (!recordingAudit?.orphanFiles.length) return;
    setMaintenanceLoading(true);
    setMaintenanceError(null);
    try {
      const result = await cleanupOrphanSongRecordings(recordingAudit.orphanFiles);
      setCleanupResult(result);
      setCleanupConfirmOpen(false);
      setRecordingAudit(await auditSongRecordings());
    } catch (error: any) {
      setMaintenanceError(error?.message || 'Nao foi possivel limpar os arquivos nao utilizados.');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const exportFullBackup = async () => {
    setRestoreMsg(null);
    setRestoreProgress(null);
    setExportLoading(true);
    try {
      const blob = await buildCifrasGoFullBackupZip({
        includeAudioRecordings: includeFullBackupAudio,
      });
      const date = new Date().toISOString().slice(0, 10);
      const shared = await shareBlobFile({
        blob,
        fileName: `CifrasGo_backup_${date}.zip`,
        title: 'Backup completo CifrasGo',
        text: 'Backup completo do CifrasGo.',
        fallbackMessage: 'O compartilhamento nao abriu, entao o backup completo foi baixado.',
      });
      if (shared) setRestoreMsg('Backup completo gerado com sucesso.');
    } catch (error: any) {
      setRestoreMsg(error?.message ? `Erro: ${error.message}` : 'Erro ao gerar o backup completo.');
    } finally {
      setExportLoading(false);
    }
  };

  const exportCustomBackup = async () => {
    if (!hasCustomSelection) return;
    setRestoreMsg(null);
    setRestoreProgress(null);
    setCustomLoading(true);
    try {
      const blob = await buildCifrasGoCustomBackupZip({
        songIds: selectedSongIds,
        artistNames: selectedArtistNames,
        playlistIds: selectedPlaylistIds,
        folderIds: selectedFolderIds,
      }, {
        includeAudioRecordings: includeCustomBackupAudio,
      });
      const shared = await shareBlobFile({
        blob,
        fileName: formatCustomBackupFileName(),
        title: 'Backup personalizado CifrasGo',
        text: 'Backup personalizado do CifrasGo.',
        fallbackMessage: 'O compartilhamento nao abriu, entao o backup personalizado foi baixado.',
      });
      if (shared) {
        setRestoreMsg('Backup personalizado gerado com sucesso.');
        setCustomOpen(false);
      }
    } catch (error: any) {
      setRestoreMsg(error?.message ? `Erro: ${error.message}` : 'Erro ao gerar o backup personalizado.');
    } finally {
      setCustomLoading(false);
    }
  };

  const exportPlaylistPdf = async () => {
    if (!canGeneratePdfExport || !selectedPdfPlaylist) return;
    setRestoreMsg(null);
    setRestoreProgress(null);
    setPdfExportLoading(true);
    try {
      const result = await buildPlaylistPdfExport({
        playlistId: selectedPdfPlaylist.id,
        mode: pdfExportMode,
        fontSize: pdfExportFontSizeNumber,
        pageBreakBetweenSongs: pdfPageBreakBetweenSongs,
        includeSummary: pdfIncludeSummary,
        includeTitle: pdfIncludeTitle,
        includeArtist: pdfIncludeArtist,
      });
      const shared = await shareBlobFile({
        blob: result.blob,
        fileName: result.fileName,
        title: 'PDF de lista CifrasGo',
        text: `PDF da lista "${result.playlistName}" com ${result.songCount} musica${result.songCount === 1 ? '' : 's'}.`,
        fallbackMessage: 'O compartilhamento nao abriu, entao o PDF da lista foi baixado.',
      });
      if (shared) {
        const pdfNote = result.skippedPdfCount
          ? ` PDFs rapidos da lista nao entram nesta exportacao (${result.skippedPdfCount}).`
          : '';
        setRestoreMsg(`PDF da lista "${result.playlistName}" gerado com sucesso.${pdfNote}`);
        setPdfExportOpen(false);
      }
    } catch (error: any) {
      setRestoreMsg(error?.message ? `Erro: ${error.message}` : 'Erro ao gerar o PDF da lista.');
    } finally {
      setPdfExportLoading(false);
    }
  };

  const restoreZip = async (file: File) => {
    setRestoreMsg(null);
    setRestoreProgress(null);
    setRestoreLoading(true);
    try {
      const result = await restoreBackupZip(file, {
        onProgress: setRestoreProgress,
      });
      setRestoreMsg(result.message);
    } catch (error: any) {
      setRestoreMsg(error?.message ? `Erro: ${error.message}` : 'Erro ao restaurar o backup.');
    } finally {
      setRestoreLoading(false);
    }
  };

  const restoreFile = async (file: File) => {
    const isTxt = file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain';
    if (!isTxt) {
      await restoreZip(file);
      return;
    }

    setRestoreMsg(null);
    setRestoreProgress(null);
    setRestoreLoading(true);
    try {
      const result = await restoreCifrasGoSongTextFile(file);
      setRestoreMsg(result.message);
    } catch (error: any) {
      setRestoreMsg(error?.message ? `Erro: ${error.message}` : 'Erro ao importar a musica.');
    } finally {
      setRestoreLoading(false);
    }
  };

  const renderSearch = (value: string, onChangeText: (value: string) => void, placeholder: string) => (
    <View style={localStyles.searchBox}>
      <Search size={17} color="var(--app-muted-text)" />
      <TextInput
        style={localStyles.searchInput}
        placeholder={placeholder}
        placeholderTextColor="#777"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );

  const renderCheck = (selected: boolean) => (
    <View style={[localStyles.checkBox, selected && localStyles.checkBoxSelected]}>
      {selected ? <Check size={14} color="#000" /> : null}
    </View>
  );

  const renderAudioRecordingOption = (selected: boolean, onPress: () => void) => {
    const approximateMb = backupStats.audioBase64Chars / (1024 * 1024);
    const audioSummary = backupStats.audioRecordings
      ? backupStats.audioFileRecordings > 0
        ? `${backupStats.audioRecordings} gravacao${backupStats.audioRecordings === 1 ? '' : 'oes'} - tamanho calculado ao gerar`
        : `${backupStats.audioRecordings} gravacao${backupStats.audioRecordings === 1 ? '' : 'oes'} - aproximadamente ${approximateMb.toFixed(1).replace('.', ',')} MB`
      : 'Nenhuma gravacao encontrada';
    return (
      <TouchableOpacity style={localStyles.audioOption} onPress={onPress} activeOpacity={0.82}>
        {renderCheck(selected)}
        <View style={localStyles.audioOptionText}>
          <Text style={localStyles.audioOptionTitle}>Incluir gravacoes de audio</Text>
          <Text style={localStyles.audioOptionSubtitle}>
            Inclui as gravacoes feitas nas musicas. O arquivo sera maior.
          </Text>
          <Text style={localStyles.audioOptionMeta}>{audioSummary}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = (icon: ReactNode, title: string, subtitle: string) => (
    <View style={localStyles.emptyState}>
      <View style={localStyles.emptyIcon}>{icon}</View>
      <Text style={localStyles.emptyTitle}>{title}</Text>
      <Text style={localStyles.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  const renderRows = () => {
    if (customDataLoading) {
      return (
        <View style={localStyles.loadingBox}>
          <ActivityIndicator color="var(--app-accent)" />
          <Text style={localStyles.mutedText}>Carregando itens do backup...</Text>
        </View>
      );
    }

    if (customTab === 'songs') {
      return (
        <>
          {renderSearch(songQuery, setSongQuery, 'Buscar musica ou artista...')}
          <ScrollView style={localStyles.optionScroll} contentContainerStyle={localStyles.optionList}>
            {filteredSongs.length ? filteredSongs.map((song) => {
              const selected = selectedSongIds.includes(song.id);
              return (
                <TouchableOpacity
                  key={song.id}
                  style={[localStyles.optionCard, selected && localStyles.optionCardSelected]}
                  onPress={() => setSelectedSongIds((current) => toggleValue(current, song.id))}
                >
                  <View style={localStyles.optionIcon}><Music size={17} color="var(--app-accent)" /></View>
                  <View style={localStyles.optionText}>
                    <Text style={localStyles.optionTitle} numberOfLines={1}>{song.title || 'Sem titulo'}</Text>
                    <Text style={localStyles.optionSubtitle} numberOfLines={1}>{song.artist || 'Sem artista'}</Text>
                  </View>
                  {renderCheck(selected)}
                </TouchableOpacity>
              );
            }) : renderEmptyState(
              <Music size={20} color="var(--app-accent)" />,
              'Nenhuma musica encontrada',
              'Tente outro termo de busca ou escolha outra categoria.'
            )}
          </ScrollView>
        </>
      );
    }

    if (customTab === 'artists') {
      return (
        <>
          {renderSearch(artistQuery, setArtistQuery, 'Buscar artista...')}
          <ScrollView style={localStyles.optionScroll} contentContainerStyle={localStyles.optionList}>
            {filteredArtists.length ? filteredArtists.map((artist) => {
              const selected = selectedArtistNames.includes(artist.name);
              return (
                <TouchableOpacity
                  key={artist.name}
                  style={[localStyles.optionCard, selected && localStyles.optionCardSelected]}
                  onPress={() => setSelectedArtistNames((current) => toggleValue(current, artist.name))}
                >
                  <View style={localStyles.optionIcon}><UserRound size={17} color="var(--app-accent)" /></View>
                  <View style={localStyles.optionText}>
                    <Text style={localStyles.optionTitle} numberOfLines={1}>{artist.name}</Text>
                    <Text style={localStyles.optionSubtitle} numberOfLines={1}>{artist.count} musica{artist.count === 1 ? '' : 's'}</Text>
                  </View>
                  {renderCheck(selected)}
                </TouchableOpacity>
              );
            }) : renderEmptyState(
              <UserRound size={20} color="var(--app-accent)" />,
              'Nenhum artista encontrado',
              'Artistas aparecem aqui quando ha musicas cadastradas com esse campo.'
            )}
          </ScrollView>
        </>
      );
    }

    if (customTab === 'playlists') {
      return (
        <>
          {renderSearch(playlistQuery, setPlaylistQuery, 'Buscar lista ou pasta...')}
          <ScrollView style={localStyles.optionScroll} contentContainerStyle={localStyles.optionList}>
            {filteredPlaylists.length ? filteredPlaylists.map((playlist) => {
              const selected = selectedPlaylistIds.includes(playlist.id);
              const path = getFolderPath(playlist.folderId);
              const count = getPlaylistSongIds(playlist).length;
              return (
                <TouchableOpacity
                  key={playlist.id}
                  style={[localStyles.optionCard, selected && localStyles.optionCardSelected]}
                  onPress={() => setSelectedPlaylistIds((current) => toggleValue(current, playlist.id))}
                >
                  <View style={localStyles.optionIcon}><ListMusic size={17} color="#ffd166" /></View>
                  <View style={localStyles.optionText}>
                    <Text style={localStyles.optionTitle} numberOfLines={1}>{playlist.name}</Text>
                    <Text style={localStyles.optionSubtitle} numberOfLines={1}>{count} musica{count === 1 ? '' : 's'} - {path}</Text>
                  </View>
                  {renderCheck(selected)}
                </TouchableOpacity>
              );
            }) : renderEmptyState(
              <ListMusic size={20} color="#ffd166" />,
              'Nenhuma lista encontrada',
              'Use a busca por nome da lista ou pelo caminho da pasta.'
            )}
          </ScrollView>
        </>
      );
    }

    return (
      <>
        {renderSearch(folderQuery, setFolderQuery, 'Buscar pasta ou caminho...')}
        <ScrollView style={localStyles.optionScroll} contentContainerStyle={localStyles.optionList}>
          {filteredFolders.length ? filteredFolders.map((folder) => {
            const selected = selectedFolderIds.includes(folder.id);
            const stats = getFolderStats(folder.id);
            return (
              <TouchableOpacity
                key={folder.id}
                style={[localStyles.optionCard, selected && localStyles.optionCardSelected]}
                onPress={() => setSelectedFolderIds((current) => toggleValue(current, folder.id))}
              >
                <View style={localStyles.optionIcon}><Folder size={17} color="#4FC3F7" /></View>
                <View style={localStyles.optionText}>
                  <Text style={localStyles.optionTitle} numberOfLines={1}>{folder.name}</Text>
                  <Text style={localStyles.optionSubtitle} numberOfLines={1}>
                    {getFolderPath(folder.id)} - {stats.playlistCount} listas / {stats.subfolderCount} subpastas / {stats.songCount} musicas
                  </Text>
                </View>
                {renderCheck(selected)}
              </TouchableOpacity>
            );
          }) : renderEmptyState(
            <Folder size={20} color="#4FC3F7" />,
            'Nenhuma pasta encontrada',
            'Pastas e subpastas selecionadas preservam a estrutura no backup.'
          )}
        </ScrollView>
      </>
    );
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <ScrollView style={localStyles.pageScroll} contentContainerStyle={localStyles.pageContent}>
          <View style={[localStyles.heroCard, isLightTheme && localStyles.heroCardLight]}>
            <View style={[localStyles.heroIcon, isLightTheme && localStyles.heroIconLight]}>
              <ShieldCheck size={26} color="#4FC3F7" />
            </View>
            <View style={localStyles.heroTextBlock}>
              <Text style={localStyles.heroTitle}>Backup/Restauração</Text>
              <Text style={localStyles.heroSubtitle}>Proteja suas musicas, listas e configuracoes.</Text>
            </View>
          </View>

          <View style={[localStyles.statsCard, isLightTheme && localStyles.statsCardLight]}>
            {[
              { label: 'Musicas', value: backupStats.songs, icon: <Music size={18} color="#38bdf8" />, tone: '#38bdf8' },
              { label: 'Listas', value: backupStats.playlists, icon: <ListMusic size={18} color="#a855f7" />, tone: '#a855f7' },
              { label: 'Pastas', value: backupStats.folders, icon: <Folder size={18} color="#facc15" />, tone: '#facc15' },
              { label: 'Backup local', value: 'Pronto', icon: <ShieldCheck size={18} color="#22c55e" />, tone: '#22c55e' },
            ].map((item) => (
              <View key={item.label} style={localStyles.statItem}>
                <View style={[localStyles.statIcon, { backgroundColor: `${item.tone}16`, borderColor: `${item.tone}38` }]}>
                  {item.icon}
                </View>
                <Text style={localStyles.statValue}>{item.value}</Text>
                <Text style={localStyles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={localStyles.secondaryGrid}>
            <View style={[localStyles.featuredCard, isLightTheme && localStyles.featuredCardLight]}>
              <View style={localStyles.featuredTopRow}>
                <View style={localStyles.featuredIcon}>
                  <Database size={26} color="#38bdf8" />
                </View>
                <View style={localStyles.featuredTextBlock}>
                  <View style={localStyles.badgeRecommended}>
                    <Text style={localStyles.badgeText}>RECOMENDADO</Text>
                  </View>
                  <Text style={localStyles.featuredTitle}>Backup completo</Text>
                  <Text style={localStyles.featuredSubtitle}>
                    Exporte todas as suas musicas, listas, pastas, subpastas, vinculos, generos e configuracoes.
                  </Text>
                </View>
              </View>
              {renderAudioRecordingOption(
                includeFullBackupAudio,
                () => setIncludeFullBackupAudio((current) => !current)
              )}
              <TouchableOpacity
                style={[localStyles.featuredButton, busy && localStyles.actionDisabled]}
                onPress={() => void exportFullBackup()}
                disabled={busy}
              >
                {exportLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <UploadCloud size={18} color="#ffffff" />
                    <Text style={localStyles.featuredButtonText}>Gerar backup completo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={[localStyles.actionCard, localStyles.actionCardPurple, isLightTheme && localStyles.actionCardPurpleLight]}>
              <View style={localStyles.actionIconPurple}>
                <SlidersHorizontal size={22} color="#c084fc" />
              </View>
              <Text style={localStyles.actionTitle}>Backup personalizado</Text>
              <Text style={localStyles.actionSubtitle}>
                Escolha musicas, artistas, listas e pastas especificas para backup.
              </Text>
              <TouchableOpacity
                style={[localStyles.actionButtonPurple, busy && localStyles.actionDisabled]}
                onPress={openCustomBackupModal}
                disabled={busy}
              >
                <Text style={localStyles.actionButtonText}>Configurar backup</Text>
              </TouchableOpacity>
            </View>

            <View style={[localStyles.restoreCard, isLightTheme && localStyles.restoreCardLight]}>
              <View style={localStyles.restoreIcon}>
                <Archive size={24} color="#f59e0b" />
              </View>
              <View style={localStyles.restoreTextBlock}>
                <Text style={localStyles.actionTitle}>Importar / Restaurar</Text>
                <Text style={localStyles.actionSubtitle}>
                  Restaure backups legados, listas exportadas ou musicas em .zip ou .txt do CifrasGo.
                </Text>
              </View>
              <TouchableOpacity
                style={[localStyles.restoreButton, busy && localStyles.actionDisabled]}
                onPress={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                {restoreLoading ? (
                  <ActivityIndicator color="#facc15" />
                ) : (
                  <>
                    <UploadCloud size={16} color="#facc15" />
                    <Text style={localStyles.restoreButtonText}>Selecionar arquivo (.zip / .txt)</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {backupStats.legacyAudioRecordings > 0 ? (
              <View style={[localStyles.restoreCard, isLightTheme && localStyles.restoreCardLight]}>
                <View style={localStyles.restoreIcon}>
                  <HardDrive size={24} color="#f59e0b" />
                </View>
                <View style={localStyles.restoreTextBlock}>
                  <Text style={localStyles.actionTitle}>Converter gravacoes antigas</Text>
                  <Text style={localStyles.actionSubtitle}>
                    {backupStats.legacyAudioRecordings} gravacao{backupStats.legacyAudioRecordings === 1 ? '' : 'oes'} antiga{backupStats.legacyAudioRecordings === 1 ? '' : 's'} para converter.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[localStyles.restoreButton, busy && localStyles.actionDisabled]}
                  onPress={openRecordingMigrationModal}
                  disabled={busy}
                >
                  <Text style={localStyles.restoreButtonText}>Revisar conversao</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={[localStyles.restoreCard, isLightTheme && localStyles.restoreCardLight]}>
              <View style={localStyles.restoreIcon}>
                <ScanSearch size={24} color="#38bdf8" />
              </View>
              <View style={localStyles.restoreTextBlock}>
                <Text style={localStyles.actionTitle}>Manutencao das gravacoes</Text>
                <Text style={localStyles.actionSubtitle}>
                  Verifique arquivos, referencias ausentes e gravacoes antigas.
                </Text>
              </View>
              <TouchableOpacity
                style={[localStyles.restoreButton, busy && localStyles.actionDisabled]}
                onPress={openRecordingMaintenance}
                disabled={busy}
              >
                <Text style={localStyles.restoreButtonText}>Verificar gravacoes</Text>
              </TouchableOpacity>
            </View>

            <View style={[localStyles.actionCard, localStyles.actionCardGreen, isLightTheme && localStyles.actionCardGreenLight]}>
              <View style={localStyles.newBadge}>
                <Text style={localStyles.newBadgeText}>NOVO</Text>
              </View>
              <View style={localStyles.actionIconGreen}>
                <FileText size={22} color="#22c55e" />
              </View>
              <Text style={localStyles.actionTitle}>Exportar PDF</Text>
              <Text style={localStyles.actionSubtitle}>
                Gere um PDF com musicas de uma lista para imprimir ou compartilhar.
              </Text>
              <TouchableOpacity
                style={[localStyles.actionButtonGreen, busy && localStyles.actionDisabled]}
                onPress={openPlaylistPdfExportModal}
                disabled={busy}
              >
                <Text style={localStyles.actionButtonText}>Exportar PDF</Text>
              </TouchableOpacity>
            </View>
          </View>

          <input
            ref={(element) => {
              fileInputRef.current = element;
            }}
            type="file"
            accept=".zip,.txt,application/zip,text/plain"
            disabled={busy}
            onChange={(event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) void restoreFile(file);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            style={{ display: 'none' }}
          />
          {restoreProgress || restoreMsg ? (
            <View style={localStyles.statusCard}>
              {restoreProgress ? (
                <Text style={localStyles.statusText}>
                  Processando {restoreProgress.done}/{restoreProgress.total}...
                </Text>
              ) : null}
              {restoreMsg ? <Text style={localStyles.statusText}>{restoreMsg}</Text> : null}
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      <AppModal
        visible={maintenanceOpen}
        title="Manutencao das gravacoes"
        onClose={() => {
          if (!maintenanceLoading) setMaintenanceOpen(false);
        }}
        icon={<ScanSearch size={16} color="var(--app-accent)" />}
        showCloseButton={!maintenanceLoading}
        footer={
          <>
            {!maintenanceLoading ? (
              <TouchableOpacity
                onPress={() => {
                  if (cleanupConfirmOpen) setCleanupConfirmOpen(false);
                  else setMaintenanceOpen(false);
                }}
              >
                <Text style={localStyles.footerGhostText}>{cleanupConfirmOpen ? 'Cancelar' : 'Fechar'}</Text>
              </TouchableOpacity>
            ) : null}
            {cleanupConfirmOpen && recordingAudit?.orphanFiles.length ? (
              <TouchableOpacity
                style={localStyles.footerPrimaryButton}
                onPress={() => void runOrphanCleanup()}
                disabled={maintenanceLoading}
              >
                <Text style={localStyles.footerPrimaryText}>Remover arquivos</Text>
              </TouchableOpacity>
            ) : null}
          </>
        }
      >
        <ScrollView style={localStyles.maintenanceScroll} contentContainerStyle={localStyles.maintenanceContent}>
          {maintenanceLoading ? (
            <View style={localStyles.loadingBox}>
              <ActivityIndicator color="var(--app-accent)" />
              <Text style={localStyles.mutedText}>
                {cleanupConfirmOpen ? 'Removendo arquivos nao utilizados...' : 'Verificando gravacoes...'}
              </Text>
            </View>
          ) : cleanupConfirmOpen && recordingAudit ? (
            <>
              <Text style={localStyles.modalIntro}>
                Encontramos {recordingAudit.orphanFiles.length} arquivo{recordingAudit.orphanFiles.length === 1 ? '' : 's'} de audio que nao {recordingAudit.orphanFiles.length === 1 ? 'esta' : 'estao'} mais associado{recordingAudit.orphanFiles.length === 1 ? '' : 's'} a nenhuma musica. Deseja remover?
              </Text>
              <Text style={localStyles.migrationWarning}>
                Gravacoes associadas a musicas nao serao removidas. As referencias serao verificadas novamente antes da limpeza.
              </Text>
            </>
          ) : recordingAudit ? (
            <>
              <View style={localStyles.auditGrid}>
                {[
                  ['Gravacoes em arquivo', recordingAudit.songsWithFile],
                  ['Arquivos fisicos', recordingAudit.physicalFiles],
                  ['Base64 restantes', recordingAudit.legacyBase64.total],
                  ['Arquivos nao utilizados', recordingAudit.orphanFiles.length],
                  ['Referencias ausentes', recordingAudit.brokenReferences.length],
                  ['Entradas ignoradas', recordingAudit.ignoredEntries.length],
                ].map(([label, value]) => (
                  <View key={String(label)} style={localStyles.auditItem}>
                    <Text style={localStyles.auditValue}>{value}</Text>
                    <Text style={localStyles.auditLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {recordingAudit.legacyBase64.total ? (
                <View style={localStyles.migrationFailureBox}>
                  <Text style={localStyles.optionTitle}>Gravacoes antigas</Text>
                  <Text style={localStyles.optionSubtitle}>Migraveis: {recordingAudit.legacyBase64.migratable}</Text>
                  <Text style={localStyles.optionSubtitle}>Sem tipo de arquivo: {recordingAudit.legacyBase64.missingMime}</Text>
                  <Text style={localStyles.optionSubtitle}>Formato invalido: {recordingAudit.legacyBase64.invalid}</Text>
                  <Text style={localStyles.optionSubtitle}>Arquivo + Base64: {recordingAudit.legacyBase64.withFile}</Text>
                </View>
              ) : null}

              {recordingAudit.brokenReferences.length ? (
                <View style={localStyles.migrationFailureBox}>
                  <Text style={localStyles.migrationWarning}>Referencias que precisam de revisao:</Text>
                  {recordingAudit.brokenReferences.slice(0, 5).map((item) => (
                    <Text key={`${item.songId}-${item.path}`} style={localStyles.optionSubtitle} numberOfLines={2}>
                      {item.title || 'Sem titulo'}{item.artist ? ` - ${item.artist}` : ''}: {item.reason === 'empty-file' ? 'arquivo vazio' : item.reason === 'invalid-path' ? 'caminho invalido' : 'arquivo nao encontrado'}
                    </Text>
                  ))}
                </View>
              ) : null}

              {cleanupResult ? (
                <Text style={localStyles.statusText}>
                  Limpeza: {cleanupResult.removed} removido{cleanupResult.removed === 1 ? '' : 's'}, {cleanupResult.failed.length} falha{cleanupResult.failed.length === 1 ? '' : 's'}, {cleanupResult.skippedReferenced.length} preservado{cleanupResult.skippedReferenced.length === 1 ? '' : 's'} por nova referencia.
                </Text>
              ) : null}

              {recordingAudit.orphanFiles.length ? (
                <TouchableOpacity style={localStyles.auditCleanupButton} onPress={() => setCleanupConfirmOpen(true)}>
                  <Text style={localStyles.auditCleanupButtonText}>
                    Limpar {recordingAudit.orphanFiles.length} arquivo{recordingAudit.orphanFiles.length === 1 ? '' : 's'} nao utilizado{recordingAudit.orphanFiles.length === 1 ? '' : 's'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={localStyles.optionSubtitle}>Nenhum arquivo nao utilizado foi encontrado.</Text>
              )}
            </>
          ) : (
            <Text style={localStyles.migrationWarning}>{maintenanceError || 'Nao foi possivel concluir a verificacao.'}</Text>
          )}
          {maintenanceError ? <Text style={localStyles.migrationWarning}>{maintenanceError}</Text> : null}
        </ScrollView>
      </AppModal>

      <AppModal
        visible={migrationOpen}
        title="Converter gravacoes antigas"
        onClose={() => {
          if (!migrationLoading) setMigrationOpen(false);
        }}
        icon={<HardDrive size={16} color="var(--app-accent)" />}
        showCloseButton={!migrationLoading}
        footer={
          <>
            {!migrationLoading ? (
              <TouchableOpacity onPress={() => setMigrationOpen(false)}>
                <Text style={localStyles.footerGhostText}>Fechar</Text>
              </TouchableOpacity>
            ) : null}
            {!migrationResult ? (
              <TouchableOpacity
                style={[localStyles.footerPrimaryButton, migrationLoading && localStyles.footerPrimaryButtonDisabled]}
                onPress={() => void runRecordingMigration()}
                disabled={migrationLoading}
              >
                {migrationLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={localStyles.footerPrimaryText}>Converter agora</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        }
      >
        <View style={localStyles.migrationBody}>
          {migrationLoading ? (
            <>
              <ActivityIndicator color="var(--app-accent)" />
              <Text style={localStyles.actionTitle}>Convertendo gravacoes...</Text>
              <Text style={localStyles.actionSubtitle}>
                {migrationProgress?.done || 0} de {migrationProgress?.total || backupStats.legacyAudioRecordings}
              </Text>
              {migrationProgress?.title ? (
                <Text style={localStyles.migrationCurrent} numberOfLines={1}>{migrationProgress.title}</Text>
              ) : null}
              <Text style={localStyles.migrationWarning}>Nao feche o app durante a conversao.</Text>
            </>
          ) : migrationResult ? (
            <>
              <Text style={localStyles.actionTitle}>
                {migrationResult.stoppedReason ? 'Conversao interrompida' : 'Conversao concluida'}
              </Text>
              <Text style={localStyles.actionSubtitle}>
                {migrationResult.migrated} convertida{migrationResult.migrated === 1 ? '' : 's'} de {migrationResult.total}.
              </Text>
              {migrationResult.failures.length ? (
                <View style={localStyles.migrationFailureBox}>
                  <Text style={localStyles.migrationWarning}>
                    {migrationResult.failures.length} gravacao{migrationResult.failures.length === 1 ? '' : 'oes'} preservada{migrationResult.failures.length === 1 ? '' : 's'} sem conversao:
                  </Text>
                  {migrationResult.failures.slice(0, 5).map((failure) => (
                    <Text key={failure.songId} style={localStyles.optionSubtitle} numberOfLines={2}>
                      {failure.title}: {failure.reason}
                    </Text>
                  ))}
                </View>
              ) : null}
              {migrationResult.stoppedReason ? (
                <Text style={localStyles.migrationWarning}>{migrationResult.stoppedReason}</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={localStyles.modalIntro}>
                As gravacoes antigas serao convertidas para arquivos, reduzindo o tamanho interno dos dados das musicas. O processo pode levar alguns segundos.
              </Text>
              <Text style={localStyles.migrationWarning}>
                Recomendamos gerar antes um backup completo com gravacoes de audio. O backup nao e obrigatorio para continuar.
              </Text>
              <Text style={localStyles.actionSubtitle}>
                Nao feche o app enquanto a conversao estiver em andamento.
              </Text>
            </>
          )}
        </View>
      </AppModal>

      <AppModal
        visible={customOpen}
        title="Backup personalizado"
        onClose={() => setCustomOpen(false)}
        icon={<Archive size={16} color="var(--app-accent)" />}
        maxWidth={760}
        footer={
          <>
            <TouchableOpacity onPress={() => setCustomOpen(false)} disabled={customLoading}>
              <Text style={localStyles.footerGhostText}>Fechar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearCustomSelection} disabled={customLoading || !hasCustomSelection}>
              <Text style={[localStyles.footerGhostText, !hasCustomSelection && localStyles.footerDisabledText]}>Limpar selecao</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[localStyles.footerPrimaryButton, (!hasCustomSelection || customLoading) && localStyles.footerPrimaryButtonDisabled]}
              onPress={() => void exportCustomBackup()}
              disabled={!hasCustomSelection || customLoading}
            >
              {customLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={localStyles.footerPrimaryText}>Gerar backup personalizado</Text>
              )}
            </TouchableOpacity>
          </>
        }
      >
        <ScrollView style={localStyles.customBodyScroll} contentContainerStyle={localStyles.customBodyContent}>
          <Text style={localStyles.modalIntro}>
            Monte um pacote sob medida combinando musicas, artistas, listas e pastas. O arquivo gerado restaura em modo mesclar.
          </Text>
          {renderAudioRecordingOption(
            includeCustomBackupAudio,
            () => setIncludeCustomBackupAudio((current) => !current)
          )}
          <View style={localStyles.tabRow}>
            {customTabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[localStyles.tabButton, customTab === tab.id && localStyles.tabButtonActive]}
                onPress={() => setCustomTab(tab.id)}
              >
                <Text style={[localStyles.tabText, customTab === tab.id && localStyles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={localStyles.counterRow}>
            <Text style={localStyles.counterText}>{selectedSongIds.length} musicas</Text>
            <Text style={localStyles.counterText}>{selectedArtistNames.length} artistas</Text>
            <Text style={localStyles.counterText}>{selectedPlaylistIds.length} listas</Text>
            <Text style={localStyles.counterText}>{selectedFolderIds.length} pastas</Text>
          </View>
          {renderRows()}
          <View style={localStyles.summaryBox}>
            <Text style={localStyles.summaryTitle}>Backup de:</Text>
            {summaryItems.length ? (
              <ScrollView style={localStyles.summaryScroll}>
                {summaryItems.map((item) => (
                  <Text key={item} style={localStyles.summaryItem} numberOfLines={1}>- {item}</Text>
                ))}
              </ScrollView>
            ) : (
              <Text style={localStyles.summaryEmpty}>Selecione pelo menos um item para gerar um backup personalizado.</Text>
            )}
          </View>
        </ScrollView>
      </AppModal>

      <AppModal
        visible={pdfExportOpen}
        title="Exportar PDF"
        onClose={() => setPdfExportOpen(false)}
        icon={<FileText size={16} color="var(--app-accent)" />}
        maxWidth={760}
        footer={
          <>
            <TouchableOpacity onPress={() => setPdfExportOpen(false)} disabled={pdfExportLoading}>
              <Text style={localStyles.footerGhostText}>Fechar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[localStyles.footerPrimaryButton, !canGeneratePdfExport && localStyles.footerPrimaryButtonDisabled]}
              onPress={() => void exportPlaylistPdf()}
              disabled={!canGeneratePdfExport}
            >
              {pdfExportLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={localStyles.footerPrimaryText}>Gerar PDF</Text>
              )}
            </TouchableOpacity>
          </>
        }
      >
        <ScrollView style={localStyles.customBodyScroll} contentContainerStyle={localStyles.customBodyContent}>
          <Text style={localStyles.modalIntro}>
            Escolha uma lista e gere um PDF unico para ensaio, celebracao ou vocalistas. O arquivo nao altera as musicas salvas.
          </Text>

          {pdfExportDataLoading ? (
            <View style={localStyles.loadingBox}>
              <ActivityIndicator color="var(--app-accent)" />
              <Text style={localStyles.mutedText}>Carregando listas...</Text>
            </View>
          ) : (
            <>
              {renderSearch(pdfExportQuery, setPdfExportQuery, 'Buscar lista...')}
              <ScrollView style={localStyles.pdfPlaylistScroll} contentContainerStyle={localStyles.optionList}>
                {filteredPdfExportPlaylists.length ? filteredPdfExportPlaylists.map((playlist) => {
                  const selected = selectedPdfPlaylistId === playlist.id;
                  const songCount = getPlaylistExportSongIds(playlist).length;
                  const pdfCount = getPlaylistExportPdfCount(playlist);
                  return (
                    <TouchableOpacity
                      key={playlist.id}
                      style={[localStyles.optionCard, selected && localStyles.optionCardSelected]}
                      onPress={() => setSelectedPdfPlaylistId(playlist.id)}
                    >
                      <View style={localStyles.optionIcon}><ListMusic size={17} color="#ffd166" /></View>
                      <View style={localStyles.optionText}>
                        <Text style={localStyles.optionTitle} numberOfLines={1}>{playlist.name || 'Lista'}</Text>
                        <Text style={localStyles.optionSubtitle} numberOfLines={1}>
                          {songCount} musica{songCount === 1 ? '' : 's'}
                          {pdfCount ? ` - ${pdfCount} PDF${pdfCount === 1 ? '' : 's'} fora da exportacao` : ''}
                        </Text>
                      </View>
                      {renderCheck(selected)}
                    </TouchableOpacity>
                  );
                }) : renderEmptyState(
                  <ListMusic size={20} color="#ffd166" />,
                  'Nenhuma lista encontrada',
                  'Crie uma lista com musicas para gerar um PDF.'
                )}
              </ScrollView>

              {selectedPdfPlaylistPdfCount ? (
                <Text style={localStyles.pdfHint}>
                  PDFs rapidos nao entram nesta exportacao. Apenas as musicas da lista serao adicionadas ao PDF.
                </Text>
              ) : null}

              <View style={localStyles.pdfSettingsBox}>
                <Text style={localStyles.summaryTitle}>Modo do PDF</Text>
                <View style={localStyles.pdfModeRow}>
                  <TouchableOpacity
                    style={[localStyles.pdfModeCard, pdfExportMode === 'chords' && localStyles.pdfModeCardActive]}
                    onPress={() => setPdfExportMode('chords')}
                  >
                    <Text style={[localStyles.pdfModeTitle, pdfExportMode === 'chords' && localStyles.pdfModeTitleActive]}>Com acordes</Text>
                    <Text style={localStyles.optionSubtitle}>Mantem a cifra completa.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[localStyles.pdfModeCard, pdfExportMode === 'vocal' && localStyles.pdfModeCardActive]}
                    onPress={() => setPdfExportMode('vocal')}
                  >
                    <Text style={[localStyles.pdfModeTitle, pdfExportMode === 'vocal' && localStyles.pdfModeTitleActive]}>Modo vocalista</Text>
                    <Text style={localStyles.optionSubtitle}>Remove acordes apenas no PDF.</Text>
                  </TouchableOpacity>
                </View>

                <View style={localStyles.pdfFormRow}>
                  <View style={localStyles.pdfFontBox}>
                    <Text style={localStyles.optionTitle}>Tamanho da fonte</Text>
                    <TextInput
                      style={localStyles.pdfFontInput}
                      value={pdfExportFontSize}
                      onChangeText={setPdfExportFontSize}
                      keyboardType="numeric"
                      placeholder="11"
                      placeholderTextColor="#777"
                    />
                  </View>
                  <View style={localStyles.pdfToggleColumn}>
                    {[
                      {
                        label: 'Quebra entre musicas',
                        value: pdfPageBreakBetweenSongs,
                        onPress: () => setPdfPageBreakBetweenSongs((current) => !current),
                      },
                      {
                        label: 'Incluir sumario',
                        value: pdfIncludeSummary,
                        onPress: () => setPdfIncludeSummary((current) => !current),
                      },
                      {
                        label: 'Incluir titulo',
                        value: pdfIncludeTitle,
                        onPress: () => setPdfIncludeTitle((current) => !current),
                      },
                      {
                        label: 'Incluir artista',
                        value: pdfIncludeArtist,
                        onPress: () => setPdfIncludeArtist((current) => !current),
                      },
                    ].map((item) => (
                      <TouchableOpacity key={item.label} style={localStyles.pdfToggleRow} onPress={item.onPress}>
                        {renderCheck(item.value)}
                        <Text style={localStyles.optionTitle}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {selectedPdfPlaylist ? (
                  <Text style={localStyles.pdfHint}>
                    PDF selecionado: {selectedPdfPlaylist.name} - {selectedPdfPlaylistSongCount} musica{selectedPdfPlaylistSongCount === 1 ? '' : 's'}.
                  </Text>
                ) : (
                  <Text style={localStyles.pdfHint}>Selecione uma lista para liberar a geracao.</Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </AppModal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  pageScroll: {
    flex: 1,
    backgroundColor: 'var(--app-bg)',
  },
  pageContent: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 14,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.24)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(79,195,247,0.14) 0%, rgba(15,23,42,0.46) 52%, rgba(255,255,255,0.025) 100%)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 18px 34px rgba(0,0,0,0.22)',
  },
  heroCardLight: {
    borderColor: 'rgba(15,131,201,0.18)',
    backgroundColor: '#fffdf8',
    backgroundImage: 'linear-gradient(135deg, rgba(255,253,248,0.98) 0%, rgba(238,244,248,0.92) 54%, rgba(214,232,241,0.52) 100%)',
    boxShadow: '0 18px 34px rgba(31,41,55,0.08)',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.30)',
    backgroundColor: 'rgba(79,195,247,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroIconLight: {
    borderColor: 'rgba(15,131,201,0.24)',
    backgroundColor: 'rgba(15,131,201,0.10)',
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: 'var(--app-text)',
    fontSize: 21,
    fontWeight: '900',
  },
  heroSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 4,
  },
  statsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(56,189,248,0.10) 0%, rgba(255,255,255,0.02) 100%)',
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    boxShadow: '0 12px 26px rgba(0,0,0,0.18)',
  },
  statsCardLight: {
    borderColor: 'rgba(15,131,201,0.12)',
    backgroundColor: '#fffdf8',
    backgroundImage: 'linear-gradient(135deg, rgba(15,131,201,0.055) 0%, rgba(255,253,248,0.96) 100%)',
    boxShadow: '0 12px 26px rgba(31,41,55,0.07)',
  },
  statItem: {
    flex: 1,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    color: 'var(--app-text)',
    fontSize: 16,
    fontWeight: '900',
  },
  statLabel: {
    color: 'var(--app-muted-text)',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  featuredCard: {
    flex: 1,
    minWidth: 280,
    minHeight: 190,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.30)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(29,78,216,0.24) 0%, rgba(8,25,50,0.78) 48%, rgba(255,255,255,0.025) 100%)',
    padding: 18,
    gap: 16,
    boxShadow: '0 20px 38px rgba(0,0,0,0.26)',
    justifyContent: 'space-between',
  },
  featuredCardLight: {
    borderColor: 'rgba(15,131,201,0.22)',
    backgroundColor: '#fffdf8',
    backgroundImage: 'linear-gradient(135deg, rgba(15,131,201,0.12) 0%, rgba(255,253,248,0.98) 50%, rgba(214,232,241,0.52) 100%)',
    boxShadow: '0 20px 38px rgba(31,41,55,0.09)',
  },
  featuredTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featuredIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.36)',
    backgroundColor: 'rgba(37,99,235,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 14px 28px rgba(37,99,235,0.24)',
  },
  featuredTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  badgeRecommended: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.26)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '900',
  },
  featuredTitle: {
    color: 'var(--app-text)',
    fontSize: 18,
    fontWeight: '900',
  },
  featuredSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  featuredButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    backgroundImage: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    boxShadow: '0 12px 26px rgba(37,99,235,0.28)',
    marginTop: 'auto',
  },
  featuredButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  audioOption: {
    minHeight: 68,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  audioOptionText: {
    flex: 1,
    minWidth: 0,
  },
  audioOptionTitle: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '900',
  },
  audioOptionSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  audioOptionMeta: {
    color: 'var(--app-accent)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  migrationBody: {
    gap: 10,
    alignItems: 'flex-start',
  },
  migrationCurrent: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '800',
    maxWidth: '100%',
  },
  migrationWarning: {
    color: '#f59e0b',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
  },
  migrationFailureBox: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.24)',
    backgroundColor: 'rgba(245,158,11,0.07)',
    padding: 10,
    gap: 5,
  },
  maintenanceScroll: {
    maxHeight: 520,
  },
  maintenanceContent: {
    gap: 12,
  },
  auditGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  auditItem: {
    flexGrow: 1,
    flexBasis: 130,
    minHeight: 70,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 10,
    justifyContent: 'center',
  },
  auditValue: {
    color: 'var(--app-text)',
    fontSize: 20,
    fontWeight: '900',
  },
  auditLabel: {
    color: 'var(--app-muted-text)',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  auditCleanupButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.34)',
    backgroundColor: 'rgba(245,158,11,0.11)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  auditCleanupButtonText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  secondaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: 230,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'var(--app-surface)',
    padding: 15,
    gap: 10,
    minHeight: 178,
    position: 'relative',
    boxShadow: '0 16px 30px rgba(0,0,0,0.2)',
  },
  actionCardPurple: {
    borderColor: 'rgba(168,85,247,0.32)',
    backgroundImage: 'linear-gradient(135deg, rgba(126,34,206,0.24) 0%, rgba(26,16,45,0.78) 55%, rgba(255,255,255,0.025) 100%)',
  },
  actionCardPurpleLight: {
    borderColor: 'rgba(168,85,247,0.22)',
    backgroundImage: 'linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(255,253,248,0.98) 55%, rgba(243,232,255,0.58) 100%)',
    boxShadow: '0 16px 30px rgba(88,28,135,0.08)',
  },
  actionCardGreen: {
    borderColor: 'rgba(34,197,94,0.30)',
    backgroundImage: 'linear-gradient(135deg, rgba(22,101,52,0.22) 0%, rgba(8,38,29,0.80) 55%, rgba(255,255,255,0.025) 100%)',
  },
  actionCardGreenLight: {
    borderColor: 'rgba(22,163,74,0.20)',
    backgroundImage: 'linear-gradient(135deg, rgba(22,163,74,0.10) 0%, rgba(255,253,248,0.98) 55%, rgba(220,252,231,0.48) 100%)',
    boxShadow: '0 16px 30px rgba(22,101,52,0.08)',
  },
  actionIconPurple: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.34)',
    backgroundColor: 'rgba(126,34,206,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconGreen: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.34)',
    backgroundColor: 'rgba(22,101,52,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '900',
  },
  actionSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  actionButtonPurple: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(126,34,206,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  actionButtonGreen: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(22,101,52,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  actionDisabled: {
    opacity: 0.55,
  },
  newBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  newBadgeText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '900',
  },
  restoreCard: {
    flex: 1,
    minWidth: 280,
    minHeight: 178,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.28)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(24,24,24,0.78) 54%, rgba(255,255,255,0.025) 100%)',
    padding: 14,
    alignItems: 'flex-start',
    gap: 12,
    boxShadow: '0 14px 28px rgba(0,0,0,0.18)',
    justifyContent: 'space-between',
  },
  restoreCardLight: {
    borderColor: 'rgba(215,154,33,0.26)',
    backgroundColor: '#fffdf8',
    backgroundImage: 'linear-gradient(135deg, rgba(215,154,33,0.13) 0%, rgba(255,253,248,0.98) 54%, rgba(254,243,199,0.50) 100%)',
    boxShadow: '0 14px 28px rgba(146,64,14,0.08)',
  },
  restoreIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.32)',
    backgroundColor: 'rgba(245,158,11,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  restoreTextBlock: {
    width: '100%',
    gap: 4,
  },
  restoreButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.32)',
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 'auto',
  },
  restoreButtonText: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '900',
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    padding: 12,
    gap: 4,
  },
  statusText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  customBodyScroll: {
    maxHeight: '100%',
  },
  customBodyContent: {
    paddingBottom: 2,
  },
  modalIntro: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-surface-alt)',
    borderRightWidth: 1,
    borderRightColor: 'var(--app-border-soft)',
  },
  tabButtonActive: {
    backgroundColor: 'var(--app-header)',
  },
  tabText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '900',
  },
  tabTextActive: {
    color: 'var(--app-text)',
  },
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  counterText: {
    color: 'var(--app-muted-text)',
    fontSize: 11,
    fontWeight: '900',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'var(--app-surface-alt)',
  },
  searchBox: {
    minHeight: 44,
    borderRadius: 10,
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
    color: 'var(--app-text)',
    fontSize: 14,
    outlineStyle: 'none',
  },
  optionScroll: {
    maxHeight: 220,
  },
  pdfPlaylistScroll: {
    maxHeight: 200,
  },
  optionList: {
    paddingBottom: 8,
  },
  optionCard: {
    minHeight: 60,
    borderRadius: 12,
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
  optionCardSelected: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-header)',
    boxShadow: '0 8px 22px rgba(0, 0, 0, 0.16)',
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-surface)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  optionSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-surface)',
  },
  checkBoxSelected: {
    backgroundColor: 'var(--app-accent)',
    borderColor: 'var(--app-accent)',
  },
  summaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-header)',
    padding: 12,
    marginTop: 10,
  },
  summaryTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
  },
  summaryScroll: {
    maxHeight: 72,
  },
  summaryItem: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  summaryEmpty: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  pdfHint: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 8,
  },
  pdfSettingsBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
    marginTop: 10,
    gap: 10,
  },
  pdfModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pdfModeCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    padding: 12,
    justifyContent: 'center',
    gap: 4,
  },
  pdfModeCardActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-header)',
  },
  pdfModeTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  pdfModeTitleActive: {
    color: 'var(--app-accent)',
  },
  pdfFormRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  pdfFontBox: {
    width: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    padding: 12,
    gap: 8,
  },
  pdfFontInput: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    color: 'var(--app-text)',
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '800',
    outlineStyle: 'none',
  },
  pdfToggleColumn: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  pdfToggleRow: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingBox: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
  },
  mutedText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 14,
  },
  emptyState: {
    minHeight: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 6,
  },
  emptyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-header)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    marginBottom: 2,
  },
  emptyTitle: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'center',
  },
  footerGhostText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  footerDisabledText: {
    opacity: 0.45,
  },
  footerPrimaryButton: {
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--app-accent)',
  },
  footerPrimaryButtonDisabled: {
    opacity: 0.5,
  },
  footerPrimaryText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
  },
});
