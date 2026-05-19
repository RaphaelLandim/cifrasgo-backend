export type RootStackParamList = {
  Home: undefined;
  ChordView: { songId: string };
  Settings: undefined;
};

export type ManualRouteParamList = {
  Songs: undefined;
  HomeDashboard: { returnTo?: ManualRoute } | undefined;
  Artists: undefined;
  ArtistDetail: { artist: string };
  Settings: undefined;
  About: undefined;
  Folders: undefined;
  Import: { initialUrl?: string; autoImportKey?: number } | undefined;
  Backup: undefined;
  SongDetail: {
    id: string;
    returnTo?: ManualRoute;
    sourcePlaylistId?: string;
    sourcePlaylistName?: string;
  };
  SongEditor: {
    id?: string;
    returnTo?: ManualRoute;
    initialContentOverride?: string;
    editingTransposedFromKey?: string;
    editingTransposedToKey?: string;
  } | undefined;
  FolderDetail: { folderId: string; folderName?: string; returnTo?: ManualRoute; openAddOnEnter?: boolean };
  PlaylistDetail: {
    playlistId: string;
    playlistName?: string;
    folderId?: string | null;
    folderName?: string;
    openAddOnEnter?: boolean;
  };
  PlaylistStructure: {
    playlistId: string;
    playlistName?: string;
    folderId?: string | null;
    folderName?: string;
  };
};

export type ManualRouteName = keyof ManualRouteParamList;

export type ManualRoute = {
  [Name in ManualRouteName]: ManualRouteParamList[Name] extends undefined
    ? { name: Name; params?: undefined }
    : undefined extends ManualRouteParamList[Name]
      ? { name: Name; params?: Exclude<ManualRouteParamList[Name], undefined> }
      : { name: Name; params: ManualRouteParamList[Name] };
}[ManualRouteName];

export interface ManualNav {
  navigate: <T extends ManualRouteName>(name: T, params?: ManualRouteParamList[T]) => void;
  replace: <T extends ManualRouteName>(name: T, params?: ManualRouteParamList[T]) => void;
}

export interface SongEditorHeaderControls {
  onCancel: () => void;
  onOpenSource: () => void;
  onSave: () => void;
  canOpenSource: boolean;
}

export interface TopBarControls {
  showSearch?: boolean;
  searchActive?: boolean;
  onSearchPress?: () => void;
  showAdd?: boolean;
  onAddPress?: () => void;
}

export interface AppNavigation {
  navigate: <T extends keyof RootStackParamList>(name: T, params?: RootStackParamList[T]) => void;
  goBack: () => void;
  canGoBack: () => boolean;
  addListener: (event: 'focus', callback: () => void) => () => void;
}

export type RootStackScreenProps<T extends keyof RootStackParamList> = {
  navigation: AppNavigation;
  route: {
    name: T;
    params: RootStackParamList[T];
  };
};

export type StackEntry<T extends keyof RootStackParamList = keyof RootStackParamList> = {
  name: T;
  params: RootStackParamList[T];
};
