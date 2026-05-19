import type { ManualRoute } from './manualTypes';

export function getManualRouteTitle(route: ManualRoute): string {
  switch (route.name) {
    case 'Songs':
      return 'Músicas';
    case 'HomeDashboard':
      return 'Tela inicial';
    case 'Artists':
      return 'Artistas';
    case 'ArtistDetail':
      return 'Músicas do artista';
    case 'Settings':
      return 'Configurações';
    case 'About':
      return 'Sobre / Guia';
    case 'Folders':
      return 'Pastas/Listas';
    case 'Import':
      return 'Importar';
    case 'Backup':
      return 'Backup/Restauração';
    case 'FolderDetail':
      return route.params?.folderName || 'Pasta';
    case 'PlaylistDetail':
      return route.params?.playlistName ? `Lista - ${route.params.playlistName}` : 'Lista';
    case 'PlaylistStructure':
      return 'Organizar lista';
    case 'SongDetail':
      return 'Música';
    case 'SongEditor':
      return 'Editor';
    default:
      return 'App';
  }
}

export function getManualBackTarget(route: ManualRoute): ManualRoute | null {
  switch (route.name) {
    case 'ArtistDetail':
      return { name: 'Artists' };
    case 'HomeDashboard':
      return (route.params?.returnTo as ManualRoute | undefined) ?? null;
    case 'About':
      return { name: 'Settings' };
    case 'FolderDetail':
      return (route.params?.returnTo as ManualRoute | undefined) ?? { name: 'Folders' };
    case 'PlaylistDetail':
      return route.params?.folderId
        ? { name: 'FolderDetail', params: { folderId: route.params.folderId, folderName: route.params.folderName } }
        : { name: 'Folders' };
    case 'PlaylistStructure':
      return {
        name: 'PlaylistDetail',
        params: {
          playlistId: route.params.playlistId,
          playlistName: route.params.playlistName,
          folderId: route.params.folderId,
          folderName: route.params.folderName,
        },
      };
    case 'SongDetail':
      return (route.params?.returnTo as ManualRoute | undefined) ?? { name: 'Songs' };
    case 'SongEditor':
      return (
        (route.params?.returnTo as ManualRoute | undefined) ??
        (route.params?.id && route.params.id !== 'new'
          ? { name: 'SongDetail', params: { id: route.params.id } }
          : { name: 'Songs' })
      );
    default:
      return null;
  }
}
