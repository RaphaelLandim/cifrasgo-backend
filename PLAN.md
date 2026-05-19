# Plano de Refatoração Fiel do App.tsx

## Resumo
- Estratégia escolhida: **incremental fiel**. O `src/App.tsx` original continua ativo até cada parte extraída ficar funcionalmente igual.
- As telas já criadas em `src/screens` serão **reaproveitadas**, mas completadas para espelhar o comportamento original antes de serem ativadas.
- O foco é manter **Android/iOS via Capacitor** e **web para testes**, evitando dependências nativas que quebram o build Vite.

## Implementação
- **Fase 1: Base sem mudar UI**
  - Completar `src/services/storage.ts` com todo o `db` atual do `App.tsx`: músicas, gêneros, pastas, playlists e vínculos `@folder_songs`.
  - Mover helpers puros para módulos existentes/novos: `genres`, `chordKeys`, `links`, `share`, `backup`, `scraper`.
  - Atualizar o `App.tsx` para importar esses módulos, removendo duplicações só depois que o build passar.

- **Fase 2: Componentes reutilizáveis**
  - Extrair sem alterar visual: `ChordLine`, `SongMetaLine`, `SongActionsModal`, `DrawerItem`, `ConfirmDialog`.
  - Manter os mesmos estilos inicialmente, mesmo que ainda venham de um arquivo grande.
  - Só depois mover tokens de cor/tema para `src/theme/theme.ts`.

- **Fase 3: Telas por fatias fiéis**
  - Primeiro migrar o núcleo musical: `SongsScreen`, `SongDetailScreen`, `SongEditorScreen`.
  - Completar os rascunhos `HomeScreen`, `ChordViewScreen`, `SettingsScreen` até terem todos os botões, modais, fluxos e estados do original.
  - Depois migrar `ArtistsScreen`, `ArtistDetailScreen`, `FoldersScreen`, `FolderDetailScreen`, `PlaylistDetailScreen`, `ImportScreen`, `BackupScreen`.

- **Fase 4: Navegação**
  - Enquanto a migração não estiver completa, manter a navegação manual original ativa.
  - Quando as telas principais estiverem fiéis, ligar `src/navigation/AppNavigator.tsx` ao app.
  - Usar o adapter local com `@react-navigation/native`, sem `native-stack`, porque `native-stack`/`stack` quebraram o build Vite neste projeto Capacitor.

## Interfaces e Tipos
- `src/types/models.ts` será a fonte única para `Song`, `Folder`, `Playlist`, `Genre`, `DisplaySettings`, `ThemeSettings`.
- `src/navigation/types.ts` definirá todas as rotas e params antes de cada tela ser ativada.
- `src/services/storage.ts` preservará as mesmas chaves atuais: `@songs`, `@folders`, `@playlists`, `@folder_songs`, `@genres`, `@display_settings`, `@global_filters`, `@theme_settings`.

## Testes e Aceite
- Após cada extração: rodar `npm run build`.
- Testar manualmente no web:
  - listar/buscar músicas;
  - abrir cifra, transpor tom, mudar fonte, auto-rolagem;
  - criar/editar/deletar música;
  - gêneros e filtro global;
  - pastas/listas/adicionar/remover/reordenar;
  - importar URL;
  - restaurar backup `.zip`.
- Antes de gerar APK: `npm run android:sync` ou `Gerar_Apk.bat`.

## Assumptions
- O app completo atual em `src/App.tsx` é a referência visual e funcional.
- As telas em `src/screens` não devem substituir o original até ficarem equivalentes.
- A prioridade é manutenção sem regressão, mesmo que a refatoração leve mais etapas.
