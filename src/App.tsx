/* eslint-disable @typescript-eslint/no-explicit-any,react-hooks/exhaustive-deps,react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
} from 'react-native-web';
import { App as CapacitorApp } from '@capacitor/app';
import { AppDrawer } from './components/AppDrawer';
import { AppHeader } from './components/AppHeader';
import {
  ConfirmDialogProvider,
  useConfirmDialogController,
} from './components/ConfirmDialog';
import { DrawerProvider, useDrawer } from './contexts/DrawerContext';
import { GenreFilterProvider } from './contexts/GenreFilterContext';
import { ManualNavigationProvider } from './contexts/ManualNavigationContext';
import { PlaybackProvider, usePlayback } from './contexts/PlaybackContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { TopBarProvider, useTopBarState } from './contexts/TopBarContext';
import type {
  ManualNav,
  RouteName,
  ManualRoute,
} from './navigation/manualTypes';
import { getManualBackTarget, getManualRouteTitle } from './navigation/manualRouteHelpers';
import { subscribeToIncomingImportUrls } from './services/linking';
import { db } from './services/storage';
import { SongsScreen } from './screens/SongsScreen';
import { SongDetailScreen } from './screens/SongDetailScreen';
import { SongEditorScreen } from './screens/SongEditorScreen';
import { ArtistsScreen } from './screens/ArtistsScreen';
import { ArtistDetailScreen } from './screens/ArtistDetailScreen';
import { ImportScreen } from './screens/ImportScreen';
import { BackupScreen } from './screens/BackupScreen';
import { FoldersScreen } from './screens/FoldersScreen';
import { FolderDetailScreen } from './screens/FolderDetailScreen';
import { PlaylistDetailScreen } from './screens/PlaylistDetailScreen';
import { PlaylistStructureScreen } from './screens/PlaylistStructureScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HomeDashboardScreen } from './screens/HomeDashboardScreen';
import { AboutScreen } from './screens/AboutScreen';

const SONG_DETAIL_CONTROLS_VISIBLE_KEY = '@song_detail_controls_visible';
const ROUTE_HISTORY_LIMIT = 80;

function makeManualRoute(name: RouteName, params?: any): ManualRoute {
  return params === undefined ? ({ name } as ManualRoute) : ({ name, params } as ManualRoute);
}

function getRootRoute(showHomeDashboardOnStart: boolean): ManualRoute {
  return showHomeDashboardOnStart ? { name: 'HomeDashboard' } : { name: 'Songs' };
}

function getManualRouteIdentity(route: ManualRoute): string {
  switch (route.name) {
    case 'ArtistDetail':
      return `${route.name}:${route.params.artist}`;
    case 'FolderDetail':
      return `${route.name}:${route.params.folderId}`;
    case 'PlaylistDetail':
      return `${route.name}:${route.params.playlistId}`;
    case 'PlaylistStructure':
      return `${route.name}:${route.params.playlistId}`;
    case 'SongDetail':
      return `${route.name}:${route.params.id}`;
    case 'SongEditor':
      return `${route.name}:${route.params?.id ?? 'new'}`;
    case 'Import':
      return `${route.name}:${route.params?.initialUrl ?? ''}:${route.params?.autoImportKey ?? ''}`;
    default:
      return route.name;
  }
}

function isSameManualRoute(a: ManualRoute | null | undefined, b: ManualRoute | null | undefined): boolean {
  if (!a || !b) return false;
  return getManualRouteIdentity(a) === getManualRouteIdentity(b);
}

export default function App() {
  return (
    <ConfirmDialogProvider styles={styles}>
      <SettingsProvider>
        <GenreFilterProvider>
          <TopBarProvider>
            <DrawerProvider>
              <PlaybackProvider>
                <AppContent />
              </PlaybackProvider>
            </DrawerProvider>
          </TopBarProvider>
        </GenreFilterProvider>
      </SettingsProvider>
    </ConfirmDialogProvider>
  );
}

function AppContent() {
  const [route, setRoute] = useState<ManualRoute>({ name: 'Songs' });
  const [routeHistory, setRouteHistory] = useState<ManualRoute[]>([]);
  const [homeDashboardOnStart, setHomeDashboardOnStart] = useState(false);
  const [startupReady, setStartupReady] = useState(false);
  const [songDetailControlsVisible, setSongDetailControlsVisible] = useState(true);
  const [folderHeaderMeta, setFolderHeaderMeta] = useState<{ title?: string; subtitle?: string }>({});
  const routeRef = React.useRef(route);
  const routeHistoryRef = React.useRef(routeHistory);
  const startupRouteOverriddenRef = React.useRef(false);
  const { drawerOpen, drawerStats, openDrawer, closeDrawer } = useDrawer();
  const { topBarControls, songEditorHeaderControls } = useTopBarState();
  const { isPlaying, stopPlaying } = usePlayback();
  const { isDialogOpen, closeConfirmation } = useConfirmDialogController();

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    routeHistoryRef.current = routeHistory;
  }, [routeHistory]);

  const replaceRoute = React.useCallback((nextRoute: ManualRoute, options?: { clearHistory?: boolean }) => {
    routeRef.current = nextRoute;
    if (options?.clearHistory) {
      routeHistoryRef.current = [];
      setRouteHistory([]);
    }
    setRoute(nextRoute);
  }, []);

  const navigateToRoute = React.useCallback((nextRoute: ManualRoute) => {
    const currentRoute = routeRef.current;
    startupRouteOverriddenRef.current = true;

    if (isSameManualRoute(currentRoute, nextRoute)) {
      return;
    }

    const currentHistory = routeHistoryRef.current;
    const previousRoute = currentHistory[currentHistory.length - 1];
    const routeToApply = isSameManualRoute(previousRoute, nextRoute) ? previousRoute : nextRoute;
    const nextHistory = isSameManualRoute(previousRoute, nextRoute)
      ? currentHistory.slice(0, -1)
      : [...currentHistory, currentRoute].slice(-ROUTE_HISTORY_LIMIT);

    routeHistoryRef.current = nextHistory;
    setRouteHistory(nextHistory);
    routeRef.current = routeToApply;
    setRoute(routeToApply);
  }, []);

  const navigate = React.useCallback(
    (name: RouteName, params?: any) => {
      navigateToRoute(makeManualRoute(name, params));
    },
    [navigateToRoute]
  );

  const replace = React.useCallback(
    (name: RouteName, params?: any) => {
      startupRouteOverriddenRef.current = true;
      replaceRoute(makeManualRoute(name, params));
    },
    [replaceRoute]
  );

  const nav = React.useMemo<ManualNav>(() => ({ navigate, replace }), [navigate, replace]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SONG_DETAIL_CONTROLS_VISIBLE_KEY);
      if (saved === 'false') setSongDetailControlsVisible(false);
      if (saved === 'true') setSongDetailControlsVisible(true);
    } catch {
      setSongDetailControlsVisible(true);
    }
  }, []);

  const toggleSongDetailControls = React.useCallback(() => {
    setSongDetailControlsVisible((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SONG_DETAIL_CONTROLS_VISIBLE_KEY, String(next));
      } catch {
        // Preferencia visual: se o storage falhar, o estado da sessao ainda alterna.
      }
      return next;
    });
  }, []);

  const handleIncomingImportUrl = React.useCallback(({ url, requestedAt }: { url: string; requestedAt: number }) => {
    console.info('[CifrasGo App] navigating to Import from incoming URL', { url, requestedAt });
    closeDrawer();
    navigateToRoute({
      name: 'Import',
      params: {
        initialUrl: url,
        autoImportKey: requestedAt,
      },
    });
  }, [closeDrawer, navigateToRoute]);

  useEffect(() => subscribeToIncomingImportUrls(handleIncomingImportUrl), [handleIncomingImportUrl]);

  useEffect(() => {
    let isActive = true;
    void db.getShowHomeDashboardOnStart().then((showHomeDashboard) => {
      if (!isActive) return;
      setHomeDashboardOnStart(showHomeDashboard);
      const rootRoute = getRootRoute(showHomeDashboard);
      if (showHomeDashboard && !startupRouteOverriddenRef.current) {
        replaceRoute(rootRoute, { clearHistory: true });
      } else if (startupRouteOverriddenRef.current && !isSameManualRoute(routeRef.current, rootRoute)) {
        setRouteHistory((currentHistory) => {
          if (currentHistory.some((historyRoute) => isSameManualRoute(historyRoute, rootRoute))) {
            routeHistoryRef.current = currentHistory;
            return currentHistory;
          }
          if (showHomeDashboard) {
            const nextHistory = [
              rootRoute,
              ...currentHistory.filter((historyRoute) => historyRoute.name !== 'Songs'),
            ].slice(-ROUTE_HISTORY_LIMIT);
            routeHistoryRef.current = nextHistory;
            return nextHistory;
          }
          const nextHistory = currentHistory.length > 0 ? currentHistory : [rootRoute];
          routeHistoryRef.current = nextHistory;
          return nextHistory;
        });
      }
      setStartupReady(true);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const title = getManualRouteTitle(route);
  useEffect(() => {
    let active = true;

    if (route.name !== 'FolderDetail') {
      setFolderHeaderMeta({});
      return () => {
        active = false;
      };
    }

    void db.getFolders().then((folders) => {
      if (!active) return;
      const byId = new Map(folders.map((folder) => [folder.id, folder]));
      const current = byId.get(route.params.folderId);
      if (!current) {
        setFolderHeaderMeta({ title: route.params.folderName });
        return;
      }

      const parents: string[] = [];
      const visited = new Set<string>();
      let parentId = current.parentId || null;
      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        const parent = byId.get(parentId);
        if (!parent) break;
        parents.unshift(parent.name);
        parentId = parent.parentId || null;
      }

      setFolderHeaderMeta({
        title: route.params.folderName || current.name,
        subtitle: parents.join(' / ') || undefined,
      });
    });

    return () => {
      active = false;
    };
  }, [route]);
  const headerTitle = route.name === 'FolderDetail' ? folderHeaderMeta.title || title : title;
  const headerSubtitle = route.name === 'FolderDetail' ? folderHeaderMeta.subtitle : undefined;
  const rootRoute = React.useMemo(() => getRootRoute(homeDashboardOnStart), [homeDashboardOnStart]);

  const backTarget: ManualRoute | null = React.useMemo(
    () => getManualBackTarget(route),
    [route.name, route.params]
  );

  const goBackThroughRouteStack = React.useCallback(() => {
    const currentHistory = routeHistoryRef.current;
    const previousRoute = currentHistory[currentHistory.length - 1];
    if (previousRoute) {
      const nextHistory = currentHistory.slice(0, -1);
      routeHistoryRef.current = nextHistory;
      setRouteHistory(nextHistory);
      routeRef.current = previousRoute;
      setRoute(previousRoute);
      return true;
    }

    if (backTarget && !isSameManualRoute(route, backTarget)) {
      routeRef.current = backTarget;
      setRoute(backTarget);
      return true;
    }

    if (!isSameManualRoute(route, rootRoute)) {
      routeRef.current = rootRoute;
      setRoute(rootRoute);
      return true;
    }

    return false;
  }, [backTarget, rootRoute, route]);

  const handleBackPress = React.useCallback(() => {
    if (isDialogOpen) {
      closeConfirmation(false);
      return true;
    }

    if (drawerOpen) {
      closeDrawer();
      return true;
    }

    if (isPlaying) {
      stopPlaying();
      return true;
    }

    return goBackThroughRouteStack();
  }, [
    closeConfirmation,
    closeDrawer,
    drawerOpen,
    goBackThroughRouteStack,
    isDialogOpen,
    isPlaying,
    stopPlaying,
  ]);

  const canNavigateBack = routeHistory.length > 0 || !!backTarget || !isSameManualRoute(route, rootRoute);

  useEffect(() => {
    let isActive = true;
    let removeListener: (() => void) | null = null;

    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (handleBackPress()) {
        return;
      }

      if (canGoBack || window.history.length > 1) {
        window.history.back();
        return;
      }

      void CapacitorApp.exitApp();
    }).then((handle) => {
      if (!isActive) {
        void handle.remove();
        return;
      }
      removeListener = () => {
        void handle.remove();
      };
    });

    return () => {
      isActive = false;
      removeListener?.();
    };
  }, [handleBackPress]);

  useEffect(() => {
    if (route.name !== 'SongDetail' && isPlaying) {
      stopPlaying();
    }
  }, [route.name, isPlaying, stopPlaying]);

  return (
    <ManualNavigationProvider nav={nav}>
    <SafeAreaView style={styles.container}>
      {!startupReady ? null : (
      <>
      <AppHeader
        visible={!isPlaying && route.name !== 'HomeDashboard'}
        title={headerTitle}
        subtitle={headerSubtitle}
        isEditor={route.name === 'SongEditor'}
        canGoBack={canNavigateBack}
        songEditorHeaderControls={songEditorHeaderControls}
        topBarControls={topBarControls}
        songDetailControlsVisible={songDetailControlsVisible}
        onToggleSongDetailControls={route.name === 'SongDetail' ? toggleSongDetailControls : undefined}
        onOpenDrawer={openDrawer}
        onBackPress={handleBackPress}
        styles={styles}
      />

      <AppDrawer
        visible={drawerOpen}
        stats={drawerStats}
        onClose={closeDrawer}
        onNavigate={navigateToRoute}
        styles={styles}
      />

      {route.name === 'Songs' && (
        <SongsScreen
          styles={styles}
        />
      )}
      {route.name === 'HomeDashboard' && (
        <HomeDashboardScreen />
      )}
      {route.name === 'Artists' && (
        <ArtistsScreen
          styles={styles}
        />
      )}
      {route.name === 'ArtistDetail' && (
        <ArtistDetailScreen
          artist={route.params.artist}
          styles={styles}
        />
      )}
      {route.name === 'Settings' && (
        <SettingsScreen
          songs={[]}
          styles={styles}
        />
      )}
      {route.name === 'About' && (
        <AboutScreen />
      )}
      {route.name === 'Folders' && (
        <FoldersScreen
          styles={styles}
        />
      )}
      {route.name === 'Import' && (
        <ImportScreen
          initialUrl={route.params?.initialUrl}
          autoImportKey={route.params?.autoImportKey}
          styles={styles}
        />
      )}
      {route.name === 'Backup' && <BackupScreen styles={styles} />}
      {route.name === 'SongDetail' && (
        <SongDetailScreen
          id={route.params.id}
          returnTo={route.params?.returnTo as ManualRoute | undefined}
          sourcePlaylistId={route.params?.sourcePlaylistId}
          sourcePlaylistName={route.params?.sourcePlaylistName}
          controlsVisible={songDetailControlsVisible}
          styles={styles}
        />
      )}
      {route.name === 'SongEditor' && (
        <SongEditorScreen
          id={route.params?.id || 'new'}
          returnTo={route.params?.returnTo as ManualRoute | undefined}
          initialContentOverride={route.params?.initialContentOverride}
          editingTransposedFromKey={route.params?.editingTransposedFromKey}
          editingTransposedToKey={route.params?.editingTransposedToKey}
          styles={styles}
        />
      )}
      {route.name === 'FolderDetail' && route.params?.folderId && (
        <FolderDetailScreen
          folderId={route.params.folderId}
          currentFolderName={route.params.folderName}
          openAddOnEnter={route.params.openAddOnEnter}
          styles={styles}
        />
      )}
      {route.name === 'PlaylistDetail' && (
        <PlaylistDetailScreen
          playlistId={route.params.playlistId}
          playlistName={route.params.playlistName}
          folderId={route.params.folderId}
          folderName={route.params.folderName}
          openAddOnEnter={route.params.openAddOnEnter}
          styles={styles}
        />
      )}
      {route.name === 'PlaylistStructure' && (
        <PlaylistStructureScreen
          playlistId={route.params.playlistId}
          playlistName={route.params.playlistName}
          folderId={route.params.folderId}
          folderName={route.params.folderName}
          styles={styles}
        />
      )}
      </>
      )}
    </SafeAreaView>
    </ManualNavigationProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'var(--app-bg)' },
  songDetailContainer: { minHeight: 0, overflow: 'hidden' as any },
  songDetailScroll: { flex: 1, minHeight: 0, paddingHorizontal: 12 },
  header: {
    position: Platform.OS === 'web' ? 'sticky' as any : 'relative',
    top: 0,
    zIndex: 60,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'var(--app-border)',
    backgroundColor: 'var(--app-header)',
  },
  headerTitleBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0, minHeight: 40, position: 'relative' },
  headerTitle: { color: 'var(--app-text)', fontSize: 18, fontWeight: '800', textAlign: 'center', maxWidth: '100%' },
  headerSubtitle: {
    position: 'absolute',
    top: 35,
    color: 'var(--app-muted-text)',
    fontSize: 10.5,
    lineHeight: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: '100%',
  },
  headerActionGroup: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--app-surface)', borderWidth: 1, borderColor: 'var(--app-border)' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  foldersTopControls: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  filterBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  filterBtnText: { color: 'var(--app-subtle-text)', fontSize: 13, fontWeight: '700' },
  filterBtnTextActive: { color: 'var(--app-accent)' },
  genreChipRow: { maxHeight: 44, marginBottom: 6 },
  genreChipScroll: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  genreChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    marginRight: 8,
  },
  genreChipActive: { borderColor: 'var(--app-accent)', backgroundColor: 'var(--app-accent-soft)' },
  genreChipText: { color: 'var(--app-subtle-text)', fontSize: 12, fontWeight: '700' },
  genreChipTextActive: { color: 'var(--app-accent)' },
  songGenreBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden' as any,
    fontSize: 12,
    fontWeight: '600',
    color: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  search: { margin: 12, borderColor: 'var(--app-border)', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'var(--app-surface)' },
  playlistPickerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  playlistPickerSearch: { marginHorizontal: 0, marginTop: 0, marginBottom: 10 },
  inputSearch: { color: 'var(--app-text)', flex: 1, height: 42 },
  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listRow: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-bg)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listRowActive: {
    backgroundColor: 'rgba(79, 195, 247, 0.08)',
  },
  fullscreenActionRow: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    gap: 10,
  },
  fullscreenActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  fullscreenActionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  listRowText: { flex: 1, paddingRight: 10, minWidth: 0 },
  listTitle: { marginBottom: 2 },
  songMetaLine: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  songArtistText: { flexShrink: 1, minWidth: 0 },
  songMetaSeparator: { color: 'var(--app-subtle-text)', fontSize: 13, marginHorizontal: 5, flexShrink: 0 },
  songGenreInline: { color: 'var(--app-accent)', fontSize: 13, flexShrink: 1, minWidth: 0 },
  listActionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  cardMainPress: { flex: 1, paddingRight: 10 },
  cardActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: 'var(--app-text)', fontSize: 16, fontWeight: '600' },
  subtitle: { color: 'var(--app-muted-text)', fontSize: 13 },
  settingsContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 120 },
  settingsCategoryCard: {
    minHeight: 70,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsCategoryIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingsCategoryText: { flex: 1, minWidth: 0 },
  settingsCategoryTitle: { color: 'var(--app-text)', fontSize: 17, fontWeight: '800' },
  settingsCategorySubtitle: { color: 'var(--app-subtle-text)', fontSize: 12, marginTop: 3 },
  settingsModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '86%',
    alignSelf: 'center',
    backgroundColor: 'var(--app-surface)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    padding: 16,
  },
  settingsModalLarge: { minHeight: 240 },
  orderModal: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: 'var(--app-bg)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    padding: 14,
  },
  orderHintBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderHintText: { color: 'var(--app-muted-text)', fontSize: 12, flex: 1 },
  orderScroll: { maxHeight: 430 },
  orderRow: {
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    userSelect: 'none',
  },
  orderIndex: { color: 'var(--app-accent)', fontSize: 13, fontWeight: '900', width: 24, textAlign: 'center' },
  orderSongInfo: { flex: 1, minWidth: 0 },
  orderSongTitle: { color: 'var(--app-text)', fontSize: 14, fontWeight: '800' },
  orderSongArtist: { color: 'var(--app-subtle-text)', fontSize: 12, marginTop: 2 },
  orderIconButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIconButtonDisabled: { opacity: 0.45 },
  orderDragHandle: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'var(--app-surface-soft)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    flexShrink: 0,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  settingsModalTitle: { color: 'var(--app-text)', fontSize: 19, fontWeight: '900' },
  settingsCloseText: { color: 'var(--app-accent)', fontSize: 13, fontWeight: '800' },
  settingsModalScroll: { maxHeight: 420 },
  settingsInlineAction: {
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsControlBlock: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
    marginBottom: 10,
  },
  settingsControlRow: {
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsControlTitle: { color: 'var(--app-text)', fontSize: 15, fontWeight: '800' },
  settingsControlHint: { color: 'var(--app-subtle-text)', fontSize: 12, marginTop: 3 },
  settingsModalSubhead: { color: 'var(--app-subtle-text)', fontSize: 12, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
  registeredGenreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  registeredGenreChip: {
    maxWidth: '48%',
    minWidth: 128,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  registeredGenreChipText: { flex: 1, minWidth: 0 },
  registeredGenreName: { color: 'var(--app-text)', fontSize: 13, fontWeight: '800' },
  registeredGenreCount: { color: 'var(--app-subtle-text)', fontSize: 11, marginTop: 2 },
  settingsEmptyText: { color: 'var(--app-subtle-text)', fontSize: 13, marginBottom: 12 },
  themeModeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  themeModeCard: {
    flex: 1,
    minWidth: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
  },
  themeModeCardActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  themeModeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-bg)',
    marginBottom: 8,
  },
  themeModeDotLight: { backgroundColor: '#f5f7fb', borderColor: '#c5d2e0' },
  themeModeDotCustom: { backgroundColor: 'var(--app-accent)', borderColor: '#f59e0b' },
  themeModeTitle: { color: 'var(--app-text)', fontSize: 14, fontWeight: '900' },
  themeModeTitleActive: { color: 'var(--app-accent)' },
  themeModeHint: { color: 'var(--app-subtle-text)', fontSize: 11, marginTop: 3 },
  themeCustomGrid: { marginTop: 12, gap: 8 },
  themeColorRow: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  themeColorLabel: { color: 'var(--app-text)', fontSize: 13, fontWeight: '800' },
  themeColorValue: { color: 'var(--app-subtle-text)', fontSize: 11, marginTop: 2 },
  themeColorButton: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeColorPreview: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  themeColorEditText: {
    color: 'var(--app-text)',
    fontSize: 12,
    fontWeight: '800',
  },
  themeColorInput: {
    width: 42,
    height: 34,
    border: 'none',
    padding: 0,
    background: 'transparent',
    cursor: 'pointer',
  },
  themePickerBody: {
    alignItems: 'center',
    gap: 14,
  },
  themePickerPreview: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themePickerColorBox: {
    width: 58,
    height: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  themePickerCodes: {
    flex: 1,
    minWidth: 0,
  },
  themePickerCodeLine: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    marginTop: 4,
  },
  themePickerCodeLabel: {
    color: 'var(--app-subtle-text)',
    fontWeight: '800',
  },
  themePickerCodeValue: {
    color: 'var(--app-text)',
    fontWeight: '900',
  },
  colorSwatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: 'var(--app-accent)',
  },
  customColorButton: {
    backgroundColor: '#2a2a2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customColorButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  colorPickerContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'var(--app-bg-secondary)',
    borderRadius: 8,
    alignItems: 'center',
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'var(--app-surface-soft)',
  },
  statusPillActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  statusPillText: { color: 'var(--app-subtle-text)', fontSize: 12, fontWeight: '800' },
  statusPillTextActive: { color: 'var(--app-accent)' },
  settingsInput: {
    backgroundColor: 'var(--app-surface-soft)',
    borderColor: 'var(--app-border-soft)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'var(--app-text)',
    marginTop: 12,
    marginBottom: 12,
  },
  settingsModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  modalGhostBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalGhostText: { color: 'var(--app-text)', fontSize: 13, fontWeight: '800' },
  modalSpeedChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'var(--app-surface-alt)',
  },
  modalOptionBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  modalOptionBtnActive: {
    borderColor: '#4FC3F7',
    backgroundColor: '#4FC3F7',
  },
  modalOptionText: {
    color: 'var(--app-text)',
    fontSize: 15,
    fontWeight: '800',
  },
  modalPrimaryBtn: {
    borderRadius: 999,
    backgroundColor: 'var(--app-accent)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalPrimaryText: { color: '#051014', fontSize: 13, fontWeight: '900' },
  genreFilterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genreFilterCell: {
    width: '47%',
    minWidth: 132,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  genreFilterCellActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  genreFilterBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  genreFilterBoxActive: { borderColor: 'var(--app-accent)', backgroundColor: 'var(--app-accent)' },
  genreFilterCheck: { color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 16 },
  genreFilterLabel: { color: 'var(--app-muted-text)', fontSize: 13, flex: 1, minWidth: 0 },
  genreFilterLabelActive: { color: 'var(--app-text)', fontWeight: '800' },
  genreFilterFixedBlock: {
    borderTopWidth: 1,
    borderTopColor: 'var(--app-border-soft)',
    marginTop: 12,
    paddingTop: 12,
  },
  genreFilterCellFixed: {
    width: '100%',
  },
  genreFilterTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  genreFilterHint: {
    color: 'var(--app-subtle-text)',
    fontSize: 11,
    marginTop: 2,
  },
  songObservation: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    marginHorizontal: 12,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  screenTitle: { color: 'var(--app-text)', fontSize: 20, fontWeight: '700', marginHorizontal: 12, marginBottom: 8 },
  back: { color: 'var(--app-accent)', margin: 12 },
  input: { marginHorizontal: 12, marginVertical: 6, backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', borderWidth: 1, borderRadius: 8, padding: 10, color: 'var(--app-text)' },
  genrePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42 },
  primaryBtn: { marginHorizontal: 12, marginTop: 8, backgroundColor: 'var(--app-accent)', borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  editorForm: { flex: 1, paddingBottom: 0 },
  editorActionLabel: { color: 'var(--app-accent)', fontWeight: '800' },
  editorSectionHeader: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorSectionTitle: { color: 'var(--app-text)', fontSize: 15, fontWeight: '900' },
  editorExpandBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorContentWrap: { flex: 1, minHeight: 0, marginHorizontal: 12, marginTop: 6, marginBottom: 0 },
  editorContentInput: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 0,
    lineHeight: 32,
    borderRadius: 6,
    borderWidth: 0,
    backgroundColor: 'var(--app-bg)',
    color: 'var(--app-text)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  expandedEditorModal: { flex: 1, backgroundColor: 'var(--app-bg)' },
  expandedEditorHeader: {
    minHeight: 62,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'var(--app-border)',
    backgroundColor: 'var(--app-bg)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expandedEditorTitle: {
    flex: 1,
    color: 'var(--app-text)',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  expandedEditorBody: { flex: 1, backgroundColor: 'var(--app-bg)' },
  expandedEditorInput: { height: '100%', borderRadius: 0, paddingHorizontal: 12, paddingVertical: 14 },
  modalBg: { flex: 1, backgroundColor: 'var(--app-overlay)', justifyContent: 'center', padding: 18 },
  modal: { backgroundColor: 'var(--app-surface)', borderRadius: 12, borderWidth: 1, borderColor: 'var(--app-border)', padding: 16 },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.74)',
    justifyContent: 'center',
    padding: 18,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.32)',
    backgroundColor: 'var(--app-surface)',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.36)',
    backgroundColor: 'rgba(127,29,29,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmTitle: { color: 'var(--app-text)', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  confirmMessage: { color: 'var(--app-muted-text)', fontSize: 14, lineHeight: 21 },
  confirmDetail: {
    color: '#ffb4b4',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.22)',
    backgroundColor: 'rgba(127,29,29,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  confirmCancelBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  confirmCancelText: { color: 'var(--app-text)', fontSize: 14, fontWeight: '800' },
  confirmDeleteBtn: {
    borderRadius: 10,
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmDeleteText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  createHint: { color: 'var(--app-subtle-text)', fontSize: 12, marginTop: 4, marginBottom: 10 },
  createOptionCard: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  modalActionBtn: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  songActionOptionBtn: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalActionText: { color: 'var(--app-text)', fontSize: 14, fontWeight: '600' },
  modalDangerBtn: {
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(127,29,29,0.28)',
  },
  modalDangerText: { color: '#ff7a7a', fontSize: 14, fontWeight: '700' },
  chord: { color: 'var(--app-accent)', fontSize: 17, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  lyrics: { color: 'var(--app-muted-text)', fontSize: 17, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  panel: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: 'var(--app-border-soft)',
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: 'var(--app-header)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -8 },
    boxShadow: '0 -10px 28px rgba(0,0,0,0.28)',
  },
  panelBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelBtnActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent)',
  },
  transpose: {
    color: 'var(--app-accent)',
    fontWeight: '900',
    minWidth: 42,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
  },
  importBanner: { marginHorizontal: 12, marginVertical: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)', alignItems: 'center', gap: 6 },
  importTitle: { color: 'var(--app-text)', fontSize: 18, fontWeight: '700' },
  importDesc: { color: 'var(--app-muted-text)', fontSize: 13, textAlign: 'center' },
  drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--app-overlay)' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 280, backgroundColor: 'var(--app-bg)', borderRightWidth: 1, borderRightColor: 'var(--app-border)', paddingTop: 50, paddingHorizontal: 14 },
  drawerBottom: { paddingBottom: 16, borderTopWidth: 1, borderTopColor: 'var(--app-border)', paddingTop: 10 },
  drawerTitle: { color: 'var(--app-text)', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  drawerBrand: { alignItems: 'center', marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'var(--app-border)' },
  drawerLogo: { width: 176, height: 92, objectFit: 'contain', marginBottom: 10 },
  drawerStatsRow: { flexDirection: 'row', gap: 8, width: '100%' },
  drawerStatPill: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerStatNumber: { color: 'var(--app-text)', fontSize: 17, fontWeight: '900' },
  drawerStatLabel: { color: 'var(--app-subtle-text)', fontSize: 11, marginTop: 2 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'var(--app-surface)', borderWidth: 1, borderColor: 'var(--app-border)', marginBottom: 10 },
  drawerItemText: { color: 'var(--app-text)', fontSize: 15, fontWeight: '700' },
  genreCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-alt)',
  },
  genreCheckItemActive: {
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-accent-soft)',
  },
  genreCheckBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'var(--app-accent)',
    backgroundColor: 'var(--app-bg)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
