import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import {
  Activity,
  BarChart3,
  Download,
  Folder,
  Guitar,
  HeartPulse,
  ListMusic,
  Mic2,
  Music,
 
  PlayCircle,
  Settings,
  ShieldCheck,
  StickyNote,
  Tags,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { useSettings } from '../contexts/SettingsContext';
import { getRenderableChordMatches } from '../lib/chords';
import { db } from '../services/storage';
import type { Folder as FolderModel, Genre, Playlist, Song } from '../types/models';
import { getGenreDisplayName, getSongGenreKeys, NO_GENRE_KEY } from '../utils/genres';
import { getPlaylistItems } from '../utils/playlistItems';
import { useDevScreenPerformance } from '../utils/devPerformance';

type RankedItem = {
  label: string;
  value: number;
  percent: number;
  color?: string;
};

type DonutSegment = {
  label: string;
  value: number;
  percent: number;
  color: string;
};

const TOP_LIMIT = 5;

const CHART_COLORS = ['#7dd3fc', '#22c55e', '#14b8a6', '#fbbf24', '#a855f7', '#64748b'];

const normalizeArtist = (artist?: string) => artist?.trim() || 'Sem artista';

const isMinorChord = (suffix?: string) => {
  const value = suffix || '';
  return /^m(?!aj)/.test(value) || /^min/i.test(value);
};

const getChordToneLabel = (root?: string, suffix?: string) => {
  if (!root) return null;
  return `${root}${isMinorChord(suffix) ? 'm' : ''}`;
};

const buildRanking = (entries: Array<[string, number]>, total: number, limit = TOP_LIMIT): RankedItem[] =>
  entries
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, limit)
    .map(([label, value], index) => ({
      label,
      value,
      percent: total > 0 ? Math.round((value / total) * 100) : 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

const getPlaylistSongCount = (playlist: Playlist) =>
  getPlaylistItems(playlist).filter((item) => item.type === 'song').length;

const deriveToneRanking = (songs: Song[]) => {
  const counts = new Map<string, number>();
  let chordCount = 0;

  songs.forEach((song) => {
    song.content.split(/\r?\n/).forEach((line) => {
      getRenderableChordMatches(line).forEach((match) => {
        const label = getChordToneLabel(match.root, match.suffix);
        if (!label) return;
        chordCount += 1;
        counts.set(label, (counts.get(label) || 0) + 1);
      });
    });
  });

  return buildRanking([...counts.entries()], chordCount, 10);
};

const buildDonutSegments = (ranking: RankedItem[], totalSongs: number): DonutSegment[] => {
  const top = ranking.slice(0, 4);
  const topTotal = top.reduce((sum, item) => sum + item.value, 0);
  const rest = Math.max(0, totalSongs - topTotal);

  const segments = top.map((item, index) => ({
    label: item.label,
    value: item.value,
    percent: totalSongs > 0 ? Math.round((item.value / totalSongs) * 100) : 0,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (rest > 0) {
    segments.push({
      label: 'Outros',
      value: rest,
      percent: totalSongs > 0 ? Math.round((rest / totalSongs) * 100) : 0,
      color: '#64748b',
    });
  }

  return segments.filter((item) => item.value > 0);
};

const buildConicGradient = (segments: DonutSegment[]) => {
  if (!segments.length) return 'conic-gradient(rgba(148,163,184,0.32) 0deg 360deg)';

  let current = 0;
  const parts = segments.map((segment, index) => {
    const degrees =
      index === segments.length - 1
        ? 360 - current
        : Math.max(8, Math.round((segment.percent / 100) * 360));
    const start = current;
    const end = Math.min(360, current + degrees);
    current = end;
    return `${segment.color} ${start}deg ${end}deg`;
  });

  return `conic-gradient(${parts.join(', ')})`;
};

function CompactStatCard({
  icon,
  value,
  label,
  hint,
  tone,
  isLightTheme,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  hint: string;
  tone: string;
  isLightTheme: boolean;
}) {
  return (
    <View
      style={[
        localStyles.statCard,
        isLightTheme && localStyles.statCardLight,
        {
          borderColor: `${tone}33`,
          backgroundImage: isLightTheme
            ? `linear-gradient(135deg, ${tone}12 0%, rgba(255,253,248,0.98) 58%, rgba(241,245,247,0.96) 100%)`
            : `linear-gradient(135deg, ${tone}14 0%, rgba(15,23,42,0.82) 55%, rgba(255,255,255,0.025) 100%)`,
        },
      ]}
    >
      <View
        style={[
          localStyles.statIcon,
          {
            borderColor: `${tone}55`,
            backgroundColor: `${tone}16`,
            boxShadow: `0 0 24px ${tone}25`,
          },
        ]}
      >
        {icon}
      </View>
      <View style={localStyles.statText}>
        <Text style={localStyles.statValue}>{value}</Text>
        <Text style={localStyles.statLabel}>{label}</Text>
        <Text style={localStyles.statHint}>{hint}</Text>
      </View>
    </View>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
  isLightTheme,
}: {
  title: string;
  icon: React.ReactNode;
  action?: string;
  children: React.ReactNode;
  isLightTheme: boolean;
}) {
  return (
    <View style={[localStyles.panel, isLightTheme && localStyles.panelLight]}>
      <View style={localStyles.panelHeader}>
        <View style={localStyles.panelTitleWrap}>
          {icon}
          <Text style={localStyles.panelTitle}>{title}</Text>
        </View>
        {action ? <Text style={localStyles.panelAction}>{action}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function RankingRows({
  items,
  emptyText,
  valueLabel,
  fallbackTone,
}: {
  items: RankedItem[];
  emptyText: string;
  valueLabel: string;
  fallbackTone: string;
}) {
  if (!items.length) {
    return (
      <View style={localStyles.emptyMini}>
        <Text style={localStyles.emptyMiniText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={localStyles.rankingList}>
      {items.map((item, index) => {
        const tone = item.color || fallbackTone;
        return (
          <View key={`${item.label}-${index}`} style={localStyles.rankingRow}>
            <View style={localStyles.rankingTop}>
              <Text style={localStyles.rankingIndex}>{index + 1}</Text>
              <Text style={localStyles.rankingLabel} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={localStyles.rankingValue}>
                {item.value} {valueLabel}
              </Text>
            </View>
            <View style={localStyles.rankingTrack}>
              <View
                style={[
                  localStyles.rankingFill,
                  {
                    width: `${Math.max(item.percent, 5)}%`,
                    backgroundColor: tone,
                    backgroundImage: `linear-gradient(90deg, ${tone} 0%, rgba(255,255,255,0.38) 100%)`,
                    boxShadow: `0 0 18px ${tone}55`,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function DonutPanel({
  segments,
  total,
  isLightTheme,
}: {
  segments: DonutSegment[];
  total: number;
  isLightTheme: boolean;
}) {
  const gradient = buildConicGradient(segments);

  return (
    <Panel
      title="Gêneros mais usados"
      icon={<Guitar size={18} color="#22c55e" />}
      isLightTheme={isLightTheme}
    >
      <View style={localStyles.donutContent}>
        <View
          style={[
            localStyles.donut,
            {
              backgroundImage: gradient,
              boxShadow: isLightTheme
                ? '0 14px 28px rgba(31,41,55,0.12)'
                : '0 18px 42px rgba(56,189,248,0.18)',
            },
          ]}
        >
          <View style={[localStyles.donutHole, isLightTheme && localStyles.donutHoleLight]}>
            <Text style={localStyles.donutNumber}>{total}</Text>
            <Text style={localStyles.donutText}>músicas</Text>
          </View>
        </View>

        <View style={localStyles.legend}>
          {segments.length ? (
            segments.map((segment) => (
              <View key={segment.label} style={localStyles.legendRow}>
                <View style={[localStyles.legendDot, { backgroundColor: segment.color }]} />
                <Text style={localStyles.legendLabel} numberOfLines={1}>
                  {segment.label}
                </Text>
                <Text style={localStyles.legendValue}>{segment.percent}%</Text>
              </View>
            ))
          ) : (
            <Text style={localStyles.emptyMiniText}>Sem gêneros suficientes.</Text>
          )}
        </View>
      </View>
    </Panel>
  );
}

function ToneChart({ items }: { items: RankedItem[] }) {
  if (!items.length) {
    return (
      <View style={localStyles.emptyMini}>
        <Text style={localStyles.emptyMiniText}>Não há acordes suficientes para estimar os tons.</Text>
      </View>
    );
  }

  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <View style={localStyles.toneChart}>
      {items.map((item, index) => {
        const height = Math.max(22, Math.round((item.value / maxValue) * 86));
        return (
          <View key={`${item.label}-${index}`} style={localStyles.toneItem}>
            <Text style={localStyles.tonePercent}>{item.percent}%</Text>
            <View style={localStyles.toneTrack}>
              <View style={[localStyles.toneFill, { height }]} />
            </View>
            <Text style={localStyles.toneLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function SmallInfoCard({
  icon,
  label,
  value,
  hint,
  tone,
  onPress,
  isLightTheme,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
  tone: string;
  onPress?: () => void;
  isLightTheme: boolean;
}) {
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      onPress={onPress}
      style={[
        localStyles.smallInfoCard,
        isLightTheme && localStyles.smallInfoCardLight,
        {
          borderColor: `${tone}30`,
          backgroundImage: isLightTheme
            ? `linear-gradient(135deg, ${tone}10 0%, rgba(255,253,248,0.98) 62%, rgba(241,245,247,0.94) 100%)`
            : `linear-gradient(135deg, ${tone}12 0%, rgba(15,23,42,0.80) 70%, rgba(255,255,255,0.02) 100%)`,
        },
      ]}
    >
      <View style={[localStyles.smallIcon, { backgroundColor: `${tone}16`, borderColor: `${tone}42` }]}>
        {icon}
      </View>
      <View style={localStyles.smallInfoText}>
        <Text style={localStyles.smallHint}>{hint}</Text>
        <View style={localStyles.smallValueLine}>
          <Text style={localStyles.smallValue}>{value}</Text>
          <Text style={localStyles.smallLabel}>{label}</Text>
        </View>
      </View>
    </Component>
  );
}

function Shortcut({
  icon,
  label,
  active,
  tone,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  tone: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        localStyles.shortcut,
        active && {
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.12)',
          boxShadow: '0 0 26px rgba(245,158,11,0.24)',
        },
      ]}
    >
      <View
        style={[
          localStyles.shortcutIcon,
          {
            borderColor: `${tone}45`,
            backgroundColor: `${tone}13`,
          },
        ]}
      >
        {icon}
      </View>
      <Text style={localStyles.shortcutLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export function RepertoireStatsScreen() {
  useDevScreenPerformance('RepertoireStats');
  const nav = useManualNavigation();
  const { themeSettings } = useSettings();
  const isLightTheme = themeSettings.mode === 'light';

  const [songs, setSongs] = React.useState<Song[]>([]);
  const [playlists, setPlaylists] = React.useState<Playlist[]>([]);
  const [folders, setFolders] = React.useState<FolderModel[]>([]);
  const [genres, setGenres] = React.useState<Genre[]>([]);

  React.useEffect(() => {
    let active = true;

    void Promise.all([db.getSongs(), db.getPlaylists(), db.getFolders(), db.ensureDefaultGenres()]).then(
      ([nextSongs, nextPlaylists, nextFolders, nextGenres]) => {
        if (!active) return;
        setSongs(nextSongs);
        setPlaylists(nextPlaylists);
        setFolders(nextFolders);
        setGenres(nextGenres);
      }
    );

    return () => {
      active = false;
    };
  }, []);

  const artistsCount = React.useMemo(
    () => new Set(songs.map((song) => normalizeArtist(song.artist))).size,
    [songs]
  );

  const genreRanking = React.useMemo(() => {
    const counts = new Map<string, number>();

    songs.forEach((song) => {
      const keys = getSongGenreKeys(song).filter((key) => key !== NO_GENRE_KEY);
      keys.forEach((key) => {
        const displayName = getGenreDisplayName(key, genres);
        counts.set(displayName, (counts.get(displayName) || 0) + 1);
      });
    });

    return buildRanking([...counts.entries()], songs.length);
  }, [genres, songs]);

  const genreDonutSegments = React.useMemo(
    () => buildDonutSegments(genreRanking, songs.length),
    [genreRanking, songs.length]
  );

  const artistRanking = React.useMemo(() => {
    const counts = new Map<string, number>();

    songs.forEach((song) => {
      const artist = normalizeArtist(song.artist);
      if (artist === 'Sem artista') return;
      counts.set(artist, (counts.get(artist) || 0) + 1);
    });

    return buildRanking([...counts.entries()], songs.length);
  }, [songs]);

  const playlistRanking = React.useMemo(() => {
    const entries = playlists.map((playlist) => [playlist.name || 'Lista', getPlaylistSongCount(playlist)] as [string, number]);
    const max = Math.max(0, ...entries.map(([, value]) => value));
    return buildRanking(entries, max || 1);
  }, [playlists]);

  const toneRanking = React.useMemo(() => deriveToneRanking(songs), [songs]);

  const songsWithoutGenre = React.useMemo(
    () => songs.filter((song) => getSongGenreKeys(song).includes(NO_GENRE_KEY)).length,
    [songs]
  );

  const songsWithoutArtist = React.useMemo(
    () => songs.filter((song) => !song.artist?.trim()).length,
    [songs]
  );

  const emptyPlaylists = React.useMemo(
    () => playlists.filter((playlist) => getPlaylistSongCount(playlist) === 0).length,
    [playlists]
  );

  const songsWithYoutube = React.useMemo(
    () => songs.filter((song) => !!song.youtubeUrl?.trim()).length,
    [songs]
  );

  const songsWithMetronome = React.useMemo(
    () => songs.filter((song) => !!song.bpm || !!song.compasso || song.beepSoundEnabled || song.beepVisualEnabled).length,
    [songs]
  );

  const songsWithPostIt = React.useMemo(
    () => songs.filter((song) => !!song.performanceNote?.trim()).length,
    [songs]
  );

  return (
    <ScrollView style={localStyles.container} contentContainerStyle={localStyles.content}>


      <View style={localStyles.summaryGrid}>
        <CompactStatCard
          icon={<Music size={25} color="#facc15" />}
          value={songs.length}
          label="Músicas"
          hint="no repertório"
          tone="#facc15"
          isLightTheme={isLightTheme}
        />
        <CompactStatCard
          icon={<ListMusic size={25} color="#38bdf8" />}
          value={playlists.length}
          label="Listas"
          hint="para tocar"
          tone="#38bdf8"
          isLightTheme={isLightTheme}
        />
        <CompactStatCard
          icon={<Users size={25} color="#22c55e" />}
          value={artistsCount}
          label="Artistas"
          hint="catalogados"
          tone="#22c55e"
          isLightTheme={isLightTheme}
        />
        <CompactStatCard
          icon={<Folder size={25} color="#a855f7" />}
          value={folders.length}
          label="Pastas"
          hint="organizadas"
          tone="#a855f7"
          isLightTheme={isLightTheme}
        />
      </View>

      <View style={localStyles.mainGrid}>
        <Panel
          title="Artistas com mais músicas"
          action="Top 5"
          icon={<Music size={18} color="#facc15" />}
          isLightTheme={isLightTheme}
        >
          <RankingRows
            items={artistRanking}
            emptyText="Nenhum artista catalogado ainda."
            valueLabel="músicas"
            fallbackTone="#facc15"
          />
        </Panel>

        <DonutPanel segments={genreDonutSegments} total={songs.length} isLightTheme={isLightTheme} />

        <Panel
          title="Listas maiores"
          action="Top 5"
          icon={<ListMusic size={18} color="#38bdf8" />}
          isLightTheme={isLightTheme}
        >
          <RankingRows
            items={playlistRanking}
            emptyText="Nenhuma lista com músicas ainda."
            valueLabel="músicas"
            fallbackTone="#38bdf8"
          />
        </Panel>

        <Panel
          title="Saúde do repertório"
          icon={<HeartPulse size={18} color="#f97316" />}
          isLightTheme={isLightTheme}
        >
          <View style={localStyles.healthInlineGrid}>
            <SmallInfoCard
              icon={<Tags size={18} color="#f97316" />}
              value={songsWithoutGenre}
              label="sem gênero"
              hint="Músicas"
              tone="#f97316"
              onPress={() => nav.navigate('BulkGenreOrganizer')}
              isLightTheme={isLightTheme}
            />
            <SmallInfoCard
              icon={<Mic2 size={18} color="#38bdf8" />}
              value={songsWithoutArtist}
              label="sem artista"
              hint="Músicas"
              tone="#38bdf8"
              onPress={() => nav.navigate('Songs')}
              isLightTheme={isLightTheme}
            />
            <SmallInfoCard
              icon={<ListMusic size={18} color="#a855f7" />}
              value={emptyPlaylists}
              label="vazias"
              hint="Listas"
              tone="#a855f7"
              onPress={() => nav.navigate('Folders')}
              isLightTheme={isLightTheme}
            />
          </View>
        </Panel>
      </View>

      <View style={localStyles.smallCardsGrid}>
        <SmallInfoCard
          icon={<PlayCircle size={20} color="#ef4444" />}
          value={songsWithYoutube}
          label="com YouTube"
          hint="Referências"
          tone="#ef4444"
          isLightTheme={isLightTheme}
        />
        <SmallInfoCard
          icon={<Activity size={20} color="#22c55e" />}
          value={songsWithMetronome}
          label="com metrônomo"
          hint="Preparação"
          tone="#22c55e"
          isLightTheme={isLightTheme}
        />
        <SmallInfoCard
          icon={<StickyNote size={20} color="#facc15" />}
          value={songsWithPostIt}
          label="com post-it"
          hint="Anotações"
          tone="#facc15"
          isLightTheme={isLightTheme}
        />
        <SmallInfoCard
          icon={<ShieldCheck size={20} color="#22c55e" />}
          value="Não identificado"
          label=""
          hint="Último backup"
          tone="#22c55e"
          isLightTheme={isLightTheme}
        />
      </View>

      <View style={[localStyles.tonePanel, isLightTheme && localStyles.tonePanelLight]}>
        <View style={localStyles.panelHeader}>
          <View style={localStyles.panelTitleWrap}>
            <Guitar size={18} color="#a855f7" />
            <Text style={localStyles.panelTitle}>Distribuição por tom</Text>
          </View>
          <Text style={localStyles.panelAction}>Estimado</Text>
        </View>
        <ToneChart items={toneRanking} />
      </View>

      <View style={[localStyles.shortcutBar, isLightTheme && localStyles.shortcutBarLight]}>
        <Shortcut
          icon={<Music size={22} color="#facc15" />}
          label="Músicas"
          tone="#facc15"
          onPress={() => nav.navigate('Songs')}
        />
        <Shortcut
          icon={<Mic2 size={22} color="#22c55e" />}
          label="Artistas"
          tone="#22c55e"
          onPress={() => nav.navigate('Artists')}
        />
        <Shortcut
          icon={<Folder size={22} color="#38bdf8" />}
          label="Listas"
          tone="#38bdf8"
          onPress={() => nav.navigate('Folders')}
        />
        <Shortcut
          icon={<UploadCloud size={22} color="#a855f7" />}
          label="Importar"
          tone="#a855f7"
          onPress={() => nav.navigate('Import')}
        />
        <Shortcut
          icon={<Download size={22} color="#06b6d4" />}
          label="Backup"
          tone="#06b6d4"
          onPress={() => nav.navigate('Backup')}
        />
        <Shortcut
          icon={<BarChart3 size={22} color="#f59e0b" />}
          label="Estatísticas"
          tone="#f59e0b"
          active
          onPress={() => undefined}
        />
        <Shortcut
          icon={<Settings size={22} color="#94a3b8" />}
          label="Config."
          tone="#94a3b8"
          onPress={() => nav.navigate('Settings')}
        />
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'var(--app-bg)',
  },
  content: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 72,
    gap: 14,
  },
  topHeader: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  screenTitle: {
    color: 'var(--app-text)',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  screenSubtitle: {
    color: 'var(--app-muted-text)',
    fontSize: 15,
    lineHeight: 20,
    marginTop: 4,
    textAlign: 'center',
  },
  periodBox: {
    minWidth: 142,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.30)',
    backgroundColor: 'rgba(15,23,42,0.72)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  periodBoxLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(15,131,201,0.16)',
  },
  periodLabel: {
    color: 'var(--app-subtle-text)',
    fontSize: 11,
    fontWeight: '800',
  },
  periodValue: {
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 190,
    minHeight: 112,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    backgroundColor: 'rgba(15,23,42,0.78)',
    boxShadow: '0 18px 34px rgba(0,0,0,0.16)',
  },
  statCardLight: {
    backgroundColor: '#ffffff',
    boxShadow: '0 12px 24px rgba(31,41,55,0.07)',
  },
  statIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statText: {
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    color: 'var(--app-text)',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
  },
  statLabel: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  statHint: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    marginTop: 2,
  },
  mainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  panel: {
    flex: 1,
    minWidth: 320,
    minHeight: 248,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.20)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(15,23,42,0.20) 0%, rgba(14,165,233,0.06) 100%)',
    padding: 18,
    gap: 14,
    boxShadow: '0 16px 34px rgba(0,0,0,0.14)',
  },
  panelLight: {
    backgroundColor: '#ffffff',
    backgroundImage: 'linear-gradient(135deg, rgba(255,253,248,0.98) 0%, rgba(241,245,247,0.92) 100%)',
    borderColor: 'rgba(15,131,201,0.13)',
    boxShadow: '0 12px 24px rgba(31,41,55,0.07)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  panelTitle: {
    color: 'var(--app-text)',
    fontSize: 19,
    fontWeight: '900',
  },
  panelAction: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
  },
  rankingList: {
    gap: 13,
  },
  rankingRow: {
    gap: 7,
  },
  rankingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankingIndex: {
    width: 24,
    color: 'var(--app-muted-text)',
    fontSize: 14,
    fontWeight: '900',
  },
  rankingLabel: {
    flex: 1,
    minWidth: 0,
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '800',
  },
  rankingValue: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  rankingTrack: {
    height: 10,
    borderRadius: 99,
    backgroundColor: 'var(--app-surface-soft)',
    overflow: 'hidden',
  },
  rankingFill: {
    height: '100%',
    borderRadius: 99,
  },
  donutContent: {
    flex: 1,
    minHeight: 176,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  donut: {
    width: 164,
    height: 164,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  donutHole: {
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutHoleLight: {
    backgroundColor: '#fffdf8',
    borderColor: 'rgba(15,131,201,0.12)',
  },
  donutNumber: {
    color: 'var(--app-text)',
    fontSize: 25,
    fontWeight: '900',
  },
  donutText: {
    color: 'var(--app-muted-text)',
    fontSize: 10,
    fontWeight: '800',
  },
  legend: {
    flex: 1,
    minWidth: 130,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  legendDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
  },
  legendLabel: {
    flex: 1,
    minWidth: 0,
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  legendValue: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '900',
  },
  healthInlineGrid: {
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  smallCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  smallInfoCard: {
    flex: 1,
    minWidth: 220,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: 'var(--app-surface)',
  },
  smallInfoCardLight: {
    backgroundColor: '#ffffff',
    boxShadow: '0 10px 20px rgba(31,41,55,0.06)',
  },
  smallIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallInfoText: {
    flex: 1,
    minWidth: 0,
  },
  smallHint: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '700',
  },
  smallValueLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
    marginTop: 2,
  },
  smallValue: {
    color: 'var(--app-text)',
    fontSize: 24,
    fontWeight: '900',
  },
  smallLabel: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  tonePanel: {
    minHeight: 220,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.30)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(168,85,247,0.13) 0%, rgba(15,23,42,0.70) 56%, rgba(56,189,248,0.08) 100%)',
    padding: 18,
    gap: 16,
    boxShadow: '0 18px 40px rgba(168,85,247,0.12)',
  },
  tonePanelLight: {
    backgroundColor: '#ffffff',
    backgroundImage: 'linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(255,253,248,0.98) 60%, rgba(241,245,247,0.92) 100%)',
  },
  toneChart: {
    minHeight: 142,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  toneItem: {
    flex: 1,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  tonePercent: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '900',
  },
  toneTrack: {
    width: '100%',
    maxWidth: 50,
    height: 96,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.12)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  toneFill: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    backgroundImage: 'linear-gradient(180deg, #a855f7 0%, #7c3aed 55%, #4f46e5 100%)',
    boxShadow: '0 -8px 20px rgba(168,85,247,0.30)',
  },
  toneLabel: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  shortcutBar: {
    minHeight: 110,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.18)',
    backgroundColor: 'var(--app-surface)',
    backgroundImage: 'linear-gradient(135deg, rgba(15,23,42,0.38) 0%, rgba(56,189,248,0.06) 100%)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 8,
  },
  shortcutBarLight: {
    backgroundColor: '#ffffff',
    backgroundImage: 'linear-gradient(135deg, rgba(255,253,248,0.98) 0%, rgba(241,245,247,0.92) 100%)',
  },
  shortcut: {
    flex: 1,
    minWidth: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyMini: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
  },
  emptyMiniText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 18,
  },
});
