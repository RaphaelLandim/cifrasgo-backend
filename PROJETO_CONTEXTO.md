# Memoria Tecnica - Cifras Vite

Atualizado em: 2026-05-17

Este documento e a referencia rapida para qualquer IA ou pessoa entender o projeto aberto em `C:\Projetos_Prog\Cifras_Vite`.

## 1. Objetivo do app

O CifrasGo e um gerenciador de repertorio musical para cifras e letras. O usuario consegue:

- cadastrar, editar e excluir musicas;
- buscar musicas por titulo, artista e genero;
- visualizar cifras com acordes destacados;
- transpor tom;
- escolher preferência de escrita da transposição entre sustenidos, bemóis e misto/popular;
- ajustar tamanho da fonte por musica;
- usar modo de execucao (`isPlaying`) com tela mais limpa;
- configurar metronomo por musica, com BPM, compasso, beep visual e beep sonoro;
- auto-rolagem/rollover foi retomada no modo Play usando `window.scrollY`/`window.scrollTo`; historico em `docs/AUTO_SCROLL_DEBUG.md`;
- organizar musicas por artistas, pastas e listas;
- organizar listas em Modo padrao ou Modo roteiro com secoes liturgicas, drag/drop e cores por secao;
- navegar por swipe entre musicas abertas a partir de playlist no modo Play/apresentacao;
- cadastrar generos e aplicar filtro global;
- importar cifras por URL do Cifra Club;
- restaurar backups `.zip` com arquivos `.cfs`;
- compartilhar musica em `.txt` e lista em `.zip`.
- consultar a tela interna **Sobre / Guia do usuario** e o `MANUAL_USUARIO.md`.

O foco de distribuicao continua sendo Android/iOS via Capacitor e web para testes. Este projeto nao e React Native CLI/Expo puro; ele roda como app web com `react-native-web` e e empacotado em WebView nativa pelo Capacitor.

Estado atual: pronto para producao beta, com uma primeira fatia de metronomo em validacao. O fluxo principal esta estabilizado, as telas reais estao extraidas, backup/restauracao completo CifrasGo funciona em modo mesclar, restore legado continua separado, reset de fabrica existe para testes/uso real, HomeDashboard e opcional, modo Play/apresentacao esta ativo e auto-rolagem foi retomada via `window`.

## 2. Stack tecnica

- **Core:** React 19 + TypeScript.
- **UI:** `react-native-web`.
- **Build:** Vite.
- **Mobile:** Capacitor Android; iOS pode ser adicionado pelo fluxo normal do Capacitor.
- **Backend local:** `server.ts` com Express, usado principalmente para `/api/scrape`.
- **Scraper:** `fetch` nativo do Node + Cheerio no backend.
- **Backup/restore:** `JSZip` + `pako`, encapsulados em `src/services/backup.ts`.
- **Icones:** `lucide-react`.
- **Persistencia:** `localStorage`, encapsulado por `src/services/storage.ts`.
- **Navegacao futura:** `@react-navigation/native` com adapter local em `src/navigation/AppNavigator.tsx`.

## 3. Como rodar

- `npm run dev`: sobe Express + Vite. Use quando precisar testar `/api/scrape`.
- `npm run dev:web`: sobe apenas Vite. Bom para teste rapido de UI.
- `npm run build`: roda `tsc -b` e `vite build`.
- `npm run android:sync`: build web e sincroniza Android.
- `npm run android:run`: build web e roda via Capacitor.
- `Gerar_Apk.bat`: automatiza build + sync + Gradle e move o APK para a raiz como `CifrasGo.apk`.

Ultima verificacao conhecida: `npm run build`, `npx cap sync android` e `assembleDebug` passaram em 2026-05-15 apos corrigir importacao Android/HTML, deduplicacao de musicas importadas, modal de link no editor e scraper Cifra Club com `fetch` nativo.

## 4. Estado atual da refatoracao

A estrategia atual e **refatoracao incremental fiel**. O app ainda usa a navegacao manual original dentro de `src/App.tsx`, porque ela preserva todos os fluxos completos.

O `src/App.tsx` nao esta mais totalmente monolitico: ele ja importa telas, services, utils e componentes extraidos. Mesmo assim, ele ainda e o orquestrador principal de:

- estado de rota manual;
- montagem do `DrawerProvider` e repasse dos dados finais para `AppHeader`/`AppDrawer`;
- montagem do `TopBarProvider` e repasse dos controles finais para `AppHeader`;
- montagem do `PlaybackProvider` e uso de `isPlaying` para header, botao voltar e reset ao sair da cifra;
- montagem do `GenreFilterProvider`, que agora controla o estado real e a persistencia dos filtros globais;
- montagem do `SettingsProvider`, que agora controla display/tema e aplica variaveis CSS;
- controller do confirm dialog para o botao voltar;
- reacao de navegacao para URL importavel recebida pelo service de linking;
- styles globais ainda centralizados no final do arquivo.

O calculo de `title` e `backTarget` do fluxo manual ja nao fica inline no `App.tsx`; ele fica em `src/navigation/manualRouteHelpers.ts`. O voltar principal agora usa `routeHistory` real em `App.tsx`; `backTarget` e `returnTo` continuam existindo como fallback de seguranca.

Tamanho atual aproximado do `src/App.tsx`: 1243 linhas.

Backup do app completo:

- `src/legacy/LegacyApp.tsx`

## 5. Estrutura importante de pastas

```txt
src/
  App.tsx
  components/
    AppButton.tsx
    AppDrawer.tsx
    AppHeader.tsx
    AppModal.tsx
    ChordLine.tsx
    ConfirmDialog.tsx
    DrawerItem.tsx
    ScreenHeader.tsx
    SearchBar.tsx
    SongActionsModal.tsx
    SongMetaLine.tsx
  contexts/
    DrawerContext.tsx
    GenreFilterContext.tsx
    ManualNavigationContext.tsx
    PlaybackContext.tsx
    SettingsContext.tsx
    TopBarContext.tsx
  legacy/
    LegacyApp.tsx
  lib/
    chords.ts
  navigation/
    AppNavigator.tsx
    manualRouteHelpers.ts
    manualTypes.ts
    types.ts
  screens/
    ArtistDetailScreen.tsx
    ArtistsScreen.tsx
    AboutScreen.tsx
    BackupScreen.tsx
    ChordViewScreen.tsx
    FolderDetailScreen.tsx
    FoldersScreen.tsx
    HomeDashboardScreen.tsx
    HomeScreen.tsx
    ImportScreen.tsx
    PlaylistDetailScreen.tsx
    PlaylistStructureScreen.tsx
    SettingsScreen.tsx
    SongDetailScreen.tsx
    SongEditorScreen.tsx
    SongsScreen.tsx
  services/
    backup.ts
    linking.ts
    scraper.ts
    share.ts
    songTextFormat.ts
    storage.ts
  theme/
    theme.ts
  types/
    models.ts
    react-native.d.ts
    react-native-web.d.ts
  utils/
    chordKeys.ts
    genres.ts
    links.ts
```

## 5.1. Arquivos-chave do projeto

- `src/App.tsx`: casca principal atual, providers, rota manual, header, drawer e render das telas extraidas.
- `src/components/AppDrawer.tsx`: menu lateral com logo, filtro global e KPIs.
- `src/components/AppHeader.tsx`: top bar com drawer, voltar, busca, adicionar e acoes do editor.
- `src/components/AppModal.tsx`: padrao visual de modal moderno do app.
- `src/screens/SongsScreen.tsx`: lista principal de musicas.
- `src/screens/SongDetailScreen.tsx`: visualizacao da cifra, transposicao, modo Play/apresentacao e metronomo.
- `src/screens/SongDetailScreen.tsx`: quando aberta por playlist, tambem permite swipe horizontal no modo Play para anterior/proxima musica, usando `nav.replace` para nao inflar historico.
- `src/lib/chords.ts` e `src/utils/chordKeys.ts`: parser/transposicao, incluindo preferencia persistida de escrita dos acordes (`sharp`, `flat`, `mixed`).
- `src/screens/SongEditorScreen.tsx`: criacao/edicao de musica, generos, metronomo, link de origem e editor expandido.
- `src/screens/FoldersScreen.tsx`: raiz de pastas/listas e segmented control `Tudo/Listas/Pastas`.
- `src/screens/FolderDetailScreen.tsx`: subpastas, listas e musicas dentro de pasta.
- `src/screens/PlaylistDetailScreen.tsx`: detalhe de lista, incluindo renderizacao agrupada quando a playlist esta em Modo roteiro.
- `src/screens/PlaylistStructureScreen.tsx`: tela grande de organizacao de lista; controla Modo padrao, Modo roteiro, secoes, drag/drop, cores por secao e fallbacks manuais.
- `src/screens/ImportScreen.tsx`: importacao manual, auto-import por share/deep link e deduplicacao de musica existente.
- `src/screens/BackupScreen.tsx`: importacao/restauracao e backup completo.
- `src/screens/AboutScreen.tsx`: guia interno do usuario, com secoes objetivas sobre recursos e fluxos principais.
- `src/screens/SettingsScreen.tsx`: tema, generos, filtro global, home inicial e reset de fabrica.
- `src/screens/SettingsScreen.tsx`: inclui tambem `Acordes e transposição`, com preferencia de grafia dos acordes.
- `src/contexts/SettingsContext.tsx`: tambem aplica defaults seguros de `lyricsColor`/`chordColor` ao alternar entre tema escuro e claro, sem interferir no tema personalizado.
- `src/services/scraper.ts`: cliente frontend da API `/api/scrape`; valida JSON e trata HTML no Android.
- `src/services/linking.ts`: deep link/share Android e deduplicacao de URLs recebidas.
- `src/services/share.ts`: compartilhamento/download web e Android nativo.
- `src/services/backup.ts`: backup/restauracao CifrasGo e restore legado.
- `src/services/storage.ts`: DAO unico do `localStorage`.
- `server.ts`: backend Express e scraper Cifra Club.
- `docs/DEPLOY_BACKEND_ANDROID.md`: guia especifico para backend de importacao no APK Android.
- `MANUAL_USUARIO.md`: manual oficial do usuario e documentacao viva das funcionalidades finais.

## 5.2. Documentacao viva

O projeto agora trata documentacao como parte do fluxo oficial. Toda feature relevante deve atualizar:

- `PROJETO_CONTEXTO.md`, quando mudar arquitetura, fluxos, arquivos-chave ou estado tecnico;
- `docs/REFATORACAO.md`, quando mudar a estrutura/refatoracao ativa;
- `MANUAL_USUARIO.md`, quando mudar o comportamento do usuario;
- `src/screens/AboutScreen.tsx`, quando a mudanca afetar o guia interno do app.

A rota manual `About` exibe o titulo `Sobre / Guia`, tem fallback de retorno para `Settings`, aparece no drawer abaixo de `Backup/Restauração` e tambem possui card de acesso em Configuracoes. O conteudo e mantido em secoes para facilitar expansao futura sem refatorar a tela.

## 6. Telas e status

Telas extraidas e ativas, chamadas pelo `App.tsx` com props temporarias:

- `src/screens/SongsScreen.tsx`: lista principal, busca, filtro global e modal de acoes da musica.
- `src/screens/SongDetailScreen.tsx`: visualizacao da cifra, transposicao, fonte por musica, controles rapidos, lista atual, modo Play/apresentacao, auto-rolagem via `window` e indicadores do metronomo. Investigacao em `docs/AUTO_SCROLL_DEBUG.md`.
- `src/screens/SongEditorScreen.tsx`: criacao/edicao de musica, metadados, generos, source URL com modal de copiar/abrir link, configuracao de metronomo, textarea web, input mobile e editor expandido.
- `src/screens/ArtistsScreen.tsx`: agrupamento por artista, busca e filtro global.
- `src/screens/ArtistDetailScreen.tsx`: lista de musicas do artista, abertura da cifra e modal de acoes.
- `src/screens/ImportScreen.tsx`: importacao por URL usando `src/services/scraper.ts`, auto-import por share/deep link, deduplicacao por artista/titulo e modal para abrir musica ja existente.
- `src/screens/BackupScreen.tsx`: restauracao `.zip` legado e importacao `.txt` de musica CifrasGo usando `src/services/backup.ts`.
- `src/screens/AboutScreen.tsx`: Sobre / Guia do usuario, com manual rapido dentro do app e versao inicial `0.0.0`.
- `src/screens/FoldersScreen.tsx`: raiz de pastas/listas, busca, filtro por tipo, criar pasta/lista, mover/renomear/excluir e compartilhar lista.
- `src/screens/FolderDetailScreen.tsx`: detalhe de pasta, subpastas, listas, musicas vinculadas, adicionar/remover musicas e modais de acoes de itens.
- `src/screens/PlaylistDetailScreen.tsx`: detalhe de lista, adicionar/remover musicas, renderizacao de Modo roteiro com secoes coloridas e acesso a organizacao da lista.
- `src/screens/PlaylistStructureScreen.tsx`: organizacao de playlists em Modo padrao ou Modo roteiro. No Modo padrao, preserva a lista simples e permite reordenar musicas por drag/drop ou botoes. No Modo roteiro, permite criar secoes liturgicas/titulos, associar musicas a secoes, arrastar musicas entre secoes, dentro da mesma secao e de/para "Sem secao", arrastar secoes inteiras e definir cor opcional por secao.
- `src/screens/SettingsScreen.tsx`: configuracoes reais do app, tema, cores de acordes/letras/pauta, generos cadastrados e filtro global.

Telas auxiliares e rascunhos:

- `src/screens/HomeScreen.tsx`
- `src/screens/ChordViewScreen.tsx`
- `src/screens/HomeDashboardScreen.tsx`: dashboard musical premium; usa `/CifrasGo.png`, `db.getSongs()`, `db.getPlaylists()`, `db.getGenres()`, `useGenreFilter()` e `useManualNavigation()`. Pode abrir como boas-vindas opcional ao iniciar o app ou manualmente por Configuracoes.

`HomeScreen` e `ChordViewScreen` foram criadas na primeira tentativa de navegacao, mas ainda nao contem tudo que o fluxo real extraido tem. `HomeDashboardScreen` nao e rascunho: e uma home/dashboard opcional ativa. Quando `@show_home_dashboard_on_start` esta ativo, abre sem `AppHeader` ao iniciar; ao tocar em qualquer atalho, o app entra no fluxo normal e nao volta automaticamente para ela. A `SettingsScreen` deixou de ser rascunho: agora e a tela fiel ativa, chamada pelo `App.tsx`.

## 7. Navegacao

Hoje a navegacao real e manual:

- `route` fica em estado local dentro de `src/App.tsx`.
- `routeHistory` tambem fica em `src/App.tsx` e guarda o caminho real percorrido pelo usuario.
- `nav.navigate(name, params)` passa por `navigateToRoute`, empilha a rota atual e troca para a proxima.
- `replaceRoute` e usado apenas para trocar a raiz inicial sem empilhar historico.
- `ManualRouteParamList` fica em `src/navigation/types.ts` e descreve os params reais do fluxo manual legado.
- `HomeDashboard` e uma rota manual usada pela tela inicial opcional e pela abertura manual via Configuracoes. Quando `@show_home_dashboard_on_start` esta ativo, ela vira a raiz final do historico; quando esta inativo, a raiz final continua sendo `Songs`.
- `RouteName`, `ManualRoute`, `ManualNav`, `SongEditorHeaderControls` e `TopBarControls` sao reexportados por `src/navigation/manualTypes.ts` para manter imports estaveis durante a transicao.
- `src/navigation/manualRouteHelpers.ts` concentra `getManualRouteTitle(route)` e `getManualBackTarget(route)`.
- O `backTarget` do `SongEditor` respeita `returnTo`; se estiver editando e houver `id`, volta para `SongDetail`; se for musica nova sem `returnTo`, volta para `Songs`.
- `FolderDetail` aceita `returnTo` opcional nos params; ao abrir uma subpasta, esse `returnTo` aponta para a pasta pai, e pastas raiz continuam voltando para `Folders`.
- Telas extraidas nao recebem mais `nav` por props; elas usam `useManualNavigation()`.
- O botao voltar do `AppHeader` e o voltar Android chamam o mesmo fluxo: primeiro fecha confirm dialog, depois drawer, depois encerra `isPlaying`, depois desempilha `routeHistory`; so entao usa `getManualBackTarget(route)` e a raiz final.
- Fluxos profundos devem voltar pelo caminho real. Exemplo esperado: `Songs -> Folders -> Pasta -> Subpasta -> Lista -> Musica` volta como `Musica -> Lista -> Subpasta -> Pasta -> Folders -> Songs`. Com Home ativa, troca o ultimo `Songs` por `HomeDashboard`.

Existe uma preparacao para React Navigation:

- `src/navigation/AppNavigator.tsx`
- `src/navigation/types.ts`
- dependencia `@react-navigation/native`

Observacao: `src/navigation/types.ts` hoje tem dois mundos:

- `RootStackParamList`: rascunho do navigator futuro (`Home`, `ChordView`, `Settings`).
- `ManualRouteParamList`: fluxo real atual (`Songs`, `SongDetail`, `SongEditor`, `Folders`, `PlaylistDetail`, etc.).

Importante: neste projeto Vite + `react-native-web` + Capacitor, `@react-navigation/native-stack` e `@react-navigation/stack` puxaram dependencias nativas que quebraram o build web (`react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler`). Por isso o projeto usa um stack adapter local enquanto o alvo principal for Capacitor/webview.

Nao ativar `AppNavigator` ainda. As telas principais ja foram extraidas com fidelidade, mas o app ainda depende da casca atual para drawer, header, provider de confirmacao, tema, filtros globais, `isPlaying`, deep links e `styles`. O `AppNavigator` compila, mas a rota `Settings` nele esta com placeholder enquanto essa casca nao for migrada.

## 8. Storage e modelos

Tipos principais ficam em:

- `src/types/models.ts`

Chaves centralizadas ficam em:

- `src/services/storage.ts`

Chaves atuais:

- `@songs`
- `@folders`
- `@playlists`
- `@folder_songs`
- `@display_settings`
- `@global_filters`
- `@genres`
- `@theme_settings`
- `@show_home_dashboard_on_start`

Existe uma chave antiga `cifras_vite_songs` em `src/lib/storage.ts`, mas ela nao e usada pelo fluxo ativo atual.

Modelo `Song`:

- `id`
- `title`
- `artist`
- `genre?`: texto legado/compatibilidade.
- `genres?`: array normalizado em lowercase.
- `observation?`
- `content`
- `sourceUrl?`
- `updatedAt`
- `preferredFontSize?`
- `bpm?`: BPM salvo para o metronomo da musica.
- `compasso?`: `2/4`, `3/4`, `4/4` ou `6/8`.
- `beepVisualEnabled?`: liga/desliga o pulso visual do metronomo.
- `beepSoundEnabled?`: liga/desliga o beep sonoro do metronomo.

Os campos de metronomo sao opcionais para nao quebrar musicas antigas. Quando ausentes, as telas usam fallback seguro: BPM 120, compasso 4/4 e beeps desligados.

Modelo `Folder`:

- `id`
- `name`
- `parentId`
- `updatedAt`

Modelo `Playlist`:

- `id`
- `name`
- `songIds`
- `folderId`
- `updatedAt`
- `viewMode?`: `default` ou `script`; ausente equivale a `default`, garantindo compatibilidade com playlists antigas.
- `sections?`: lista opcional de secoes do Modo roteiro. Cada secao tem `id`, `title`, `songIds` e `color?`.

Observacao de compatibilidade: o DAO normaliza playlists lidas do `localStorage` para garantir `songIds: []` e `sections[].songIds: []` quando dados antigos, externos ou parcialmente corrompidos nao trouxerem esses arrays. Isso evita crashes no restore, listagens e organizacao de listas.

Modelo `PlaylistSection`:

- `id`
- `title`
- `songIds`
- `color?`: cor opcional da secao. Aceita valores antigos simples (`blue`, `green`, `gold`, `purple`, `red`, `gray`) e tambem HEX personalizado, por exemplo `#4FC3F7`. Se ausente, a secao usa o visual padrao.

Modelo `Genre`:

- `id`
- `name`
- `updatedAt`

`DisplaySettings`:

- `chordColor`
- `lyricsColor`
- `chordBold`
- `lyricsBold`
- `staffLineColor`

`ThemeSettings`:

- `mode`: `dark`, `light` ou `custom`
- `custom`: paleta customizada baseada em `ThemePalette`
- `ThemePalette.header`: cor da top bar/header, exposta como `--app-header`.

## 9. Services

`src/services/storage.ts`

- Exporta `AsyncStorage`, `STORAGE_KEYS` e `db`.
- E o unico lugar onde telas devem acessar `localStorage`.
- Contem CRUD de musicas, generos, pastas, playlists, filtros globais, tema e settings visuais.
- Tambem contem vinculos `@folder_songs`.
- `db.removeFolderSongLinks(folderIds)` limpa os vinculos de varias pastas quando uma pasta/subarvore e excluida.
- `db.clearAllData()` remove todas as chaves locais do app: musicas, pastas, listas, vinculos, generos, filtros, display settings e theme settings.

`src/services/scraper.ts`

- Exporta `scrapeSongFromUrl(url)`.
- Chama `${VITE_API_BASE_URL || ''}/api/scrape`.
- Usado pela tela de importacao.
- Antes de parsear JSON, confere `content-type` e corpo da resposta.
- Se o Android receber HTML em vez de JSON, mostra erro claro sobre API de importacao indisponivel.
- No APK Android, `VITE_API_BASE_URL` precisa ser absoluto e apontar para um backend acessivel. Use `.env.production.example` como template e crie `.env.production` local, sem versionar a URL real. Ver `docs/DEPLOY_BACKEND_ANDROID.md`.

`server.ts`

- Sobe Express e Vite em desenvolvimento.
- Expoe `/api/scrape`.
- Normaliza URLs do Cifra Club para `https://www.cifraclub.com.br/...`.
- Usa `fetch` nativo do Node com headers de navegador para evitar 403 do Akamai.
- Usa Cheerio para extrair titulo, artista e conteudo de `<pre>`.
- Link de teste validado: `https://www.cifraclub.com.br/felipe-rodrigues/tudo-e-perda/`.

`src/services/backup.ts`

- Processa `.zip` com `.cfs`.
- Tenta descompactar via `pako` e cai para texto plano quando necessario.
- Deduplica por artista/titulo.
- Cria/atualiza playlists quando backup contem listas.
- Exporta `buildCifrasGoFullBackupZip()`, que gera um ZIP proprio versionado do CifrasGo.
- Exporta `buildCifrasGoFolderBackupZip(folderId)`, que gera um ZIP proprio para compartilhar/restaurar pasta, subpasta ou sub-subpasta.
- O backup completo exportado contem `cifrasgo-backup.json`, JSONs canonicos em `data/` e copias legiveis em `readable/`.
- O backup de pasta usa manifest `cifrasgo-folder.json` e inclui `data/songs.json`, `data/folders.json`, `data/playlists.json` e `data/folder-songs.json`.
- `restoreBackupZip` detecta `cifrasgo-backup.json` e restaura backup completo CifrasGo em modo mesclar.
- `restoreBackupZip` detecta `cifrasgo-folder.json` antes do manifest de lista e restaura a arvore exportada em modo mesclar.
- O merge inteligente do restore completo remapeia IDs para musicas, pastas, listas e vinculos `@folder_songs`, sem sobrescrever configuracoes.
- Musicas sao deduplicadas por artista/titulo; generos por nome normalizado; pastas por caminho completo; listas por pasta+nome; vinculos sao reconstruidos com maps de IDs.
- O restore de playlists e tolerante a formatos antigos/incompletos: `songIds`, `sections`, `section.songIds` e mapas `folder_songs` sao normalizados antes de qualquer acesso.
- Playlists antigas sem `viewMode`/`sections` continuam como Modo padrao; playlists em Modo roteiro preservam secoes, ordem, `section.color` e musicas remapeadas quando esses dados existem.
- Se uma playlist/secao vier parcialmente invalida, o restore ignora apenas a parte problematica e continua restaurando o restante do backup.
- Exportacoes de pasta/subpasta preservam musicas diretas, listas, subpastas, vinculos, Modo roteiro, cores de secoes, post-its, audio de referencia, metronomo, fonte, `sourceUrl` e generos.
- ZIP de lista individual CifrasGo usa manifest `cifrasgo-playlist.json`; o restore preserva a ordem das musicas e deduplica por artista/titulo.
- Manifests antigos de lista CifrasGo sem `playlist.songIds` usam a ordem de `songs` como fallback.
- ZIP sem manifest proprio continua seguindo restore legado `.cfs`; arquivos antigos `[List]-*.cfs` sao importados como listas e nao como musicas.

`src/services/share.ts`

- `sanitizeFileName`
- `buildSongTextFile`
- `downloadBlobFile`
- `shareBlobFile`
- `buildPlaylistZip`
- No Android/Capacitor, `shareBlobFile` usa `@capacitor/filesystem` para salvar o Blob em `Directory.Cache`, resolve o arquivo com `Filesystem.getUri` e chama `@capacitor/share` com `files: [uri]`.
- Se o compartilhamento nativo falhar no Android, mostra `window.alert` com detalhes legiveis no WebView.
- `SongActionsModal` compartilha TXT de musica por `shareBlobFile`; `FoldersScreen` e `FolderDetailScreen` compartilham ZIP de lista pelo mesmo service.

`src/services/songTextFormat.ts`

- Define o formato TXT proprio de musica individual do CifrasGo.
- Usa os marcadores `[CIFRASGO_SONG_V1]` e `[/CIFRASGO_SONG_V1]`.
- Dentro do bloco fica um JSON com titulo, artista, genero legado, generos, observacao, sourceUrl e preferredFontSize.
- A cifra/letra fica apos o bloco versionado, para preservar o conteudo como texto.
- Exporta `buildCifrasGoSongTextFile(song)` e `parseCifrasGoSongTextFile(text)`.

`src/services/linking.ts`

- Exporta `subscribeToIncomingImportUrls(onImportUrl)`.
- Usa `CapacitorApp.getLaunchUrl()` para URL inicial.
- Usa `CapacitorApp.addListener('appUrlOpen', ...)` para deep links enquanto o app esta aberto.
- No Android, tambem consome evento nativo `cifrasgoIncomingImportUrl` disparado pela `MainActivity`.
- Consome pendencia salva em `window.__cifrasgoPendingImportUrl`/`sessionStorage` para nao perder share recebido antes do React registrar listener.
- Chama `extractUrlFromSharedText` para aceitar tanto uma URL pura quanto texto compartilhado contendo URL.
- Deduplica eventos repetidos em janela curta para evitar import duplo.
- Retorna uma funcao de cleanup para remover o listener do Capacitor.

## 10. Utils e dominio musical

`src/lib/chords.ts`

- Contem regex e regras de acorde.
- Exporta `transposeContent`.
- E usado por `ChordLine` e `SongDetailScreen`.

`src/utils/chordKeys.ts`

- `KEY_OPTIONS`
- `detectTomFromContent`
- `getTransposeBetweenKeys`

`src/utils/genres.ts`

- `normalizeGenreName`
- `getSongGenreKeys`
- `getSongGenreDisplay`
- `matchesGenreFilter`
- `playlistMatchesGenreFilter`
- `getDescendantFolderIds`
- constantes `NO_GENRE_KEY` e `NO_GENRE_LABEL`

`src/utils/links.ts`

- `extractUrlFromSharedText`, usado por `src/services/linking.ts` e pela tela de importacao para URLs recebidas por texto/deep link.

## 11. Contextos e componentes extraidos

`src/contexts/DrawerContext.tsx`

- Exporta `DrawerProvider` e `useDrawer`.
- Mantem `drawerOpen` e `drawerStats` fora do `App.tsx`.
- Expoe `openDrawer` e `closeDrawer` como callbacks estaveis.
- Carrega estatisticas com `db.getSongs()` e `db.getPlaylists()` sempre que o drawer abre.
- `App.tsx` ainda consome `useDrawer()` e passa as props finais para `AppHeader` e `AppDrawer`, preservando o comportamento visual.
- O botao voltar Android e os deep links continuam chamando `closeDrawer()` antes de navegar/sair.

`src/contexts/GenreFilterContext.tsx`

- Exporta `GenreFilterProvider`, `useGenreFilter` e `GenreFilterContextValue`.
- Carrega `@global_filters` no inicio, normaliza com `uniqueGenres` e persiste alteracoes no `localStorage`.
- Mantem `globalFilters` e `updateGlobalFilters` fora do `App.tsx`.
- As telas extraidas consomem `globalFilters` e `updateGlobalFilters` por `useGenreFilter`.

`src/contexts/ManualNavigationContext.tsx`

- Exporta `ManualNavigationProvider` e `useManualNavigation`.
- O estado de rota ainda fica no `App.tsx`, mas as telas extraidas ja navegam pelo hook, sem prop `nav`.
- Ajuda a preparar a troca futura para `AppNavigator` sem espalhar `nav` manual por props.

`src/contexts/PlaybackContext.tsx`

- Exporta `PlaybackProvider` e `usePlayback`.
- Mantem `isPlaying` e `setIsPlaying` fora do `App.tsx`.
- Expoe `isPlaying`, `setIsPlaying`, `startPlaying` e `stopPlaying`.
- `App.tsx` ainda consome `usePlayback()` para esconder o header, encerrar o modo execucao no botao voltar Android e desligar `isPlaying` ao sair de `SongDetail`.
- `SongDetailScreen` usa `window` como scroll real para auto-rolagem. Nao voltar para `scrollRef`, `getScrollableNode` ou `getNativeScrollRef` para dirigir o rollover; ver `docs/AUTO_SCROLL_DEBUG.md`.

`src/contexts/SettingsContext.tsx`

- Exporta `SettingsProvider` e `useSettings`.
- Carrega `@display_settings` e `@theme_settings` no inicio.
- Expoe `displaySettings`, `updateDisplaySettings`, `themeSettings` e `updateThemeSettings`.
- Persiste alteracoes no `localStorage` usando as chaves centralizadas de `STORAGE_KEYS`.
- Aplica as variaveis CSS do tema no `document.documentElement` e atualiza fundo/cor do `document.body`.
- `SettingsScreen`, `SongDetailScreen` e `SongEditorScreen` consomem esse contexto diretamente.

`src/contexts/TopBarContext.tsx`

- Exporta `TopBarProvider`, `useTopBarState`, `useTopBarControls` e `useSongEditorHeaderControls`.
- Mantem `topBarControls` e `songEditorHeaderControls` fora do `App.tsx`.
- `App.tsx` ainda consome `useTopBarState()` e passa as props finais para `AppHeader`, reduzindo risco visual.
- `SongsScreen`, `ArtistsScreen`, `FoldersScreen`, `FolderDetailScreen` e `PlaylistDetailScreen` registram busca/adicionar por `useTopBarControls`.
- `SongEditorScreen` registra cancelar, abrir fonte e salvar por `useSongEditorHeaderControls`.
- Cada tela mantem cleanup no `useEffect` para evitar controles presos ao trocar de rota.

- `AppHeader`: renderiza o cabecalho/top bar. Recebe `title`, `canGoBack`, controles do editor, controles de busca/adicionar, `onOpenDrawer`, `onBackPress` e `styles`; ele nao calcula destino, apenas dispara o voltar central do `App.tsx`.
- `AppDrawer`: renderiza o menu lateral. Recebe `visible`, estatisticas de musicas/listas, `onClose`, `onNavigate` e `styles`.
- `ChordLine`: renderiza uma linha de cifra, separando acorde e letra em tempo real.
- `SongMetaLine`: mostra artista, generos e observacao em listas.
- `SongActionsModal`: abrir, editar, adicionar em lista, compartilhar e excluir musica.
- `DrawerItem`: item do menu lateral.
- `ConfirmDialog`: provider completo, contexto, hook, modal e controller para confirmacoes destrutivas. O estado `confirmDialog` e o `confirmResolveRef` vivem nesse componente, nao mais no `App.tsx`.
- `AppModal`: modal base reutilizavel. Usa `--app-overlay` no fundo, `--app-header` no cabecalho, `--app-surface` no corpo, `--app-border-soft` nas bordas, titulo em `--app-text`, icone opcional, botao X e rodape opcional. Primeiro uso aplicado no modal "Selecionar tom".
- Usos atuais de `AppModal`: selecionar tom, controles rapidos do modo Play, metronomo, musica ja existente na importacao e link de origem no editor.
- `AppButton`, `ScreenHeader`, `SearchBar`: componentes criados para os rascunhos/navigator futuro.

## 12. Tema e estilos

Tokens compartilhados ficam em:

- `src/theme/theme.ts`

Esse arquivo contem:

- `DARK_THEME`
- `LIGHT_THEME`
- `DEFAULT_DISPLAY_SETTINGS`
- `DEFAULT_THEME_SETTINGS`
- opcoes de cores para acordes/letras/pauta
- token `header`/`--app-header` para diferenciar a top bar do fundo
- tokens `surface`, `surfaceAlt`, `surfaceSoft`, `borderSoft`, `overlay`, `accent`, `accentSoft`, `danger` e textos usados por telas, drawer, cards e modais
- variaveis CSS usadas pelo tema customizado
- helper `resolveThemePalette`

O estado real de display/tema fica em `src/contexts/SettingsContext.tsx`. O `theme.ts` continua sendo apenas a fonte de tokens, defaults, opcoes de cor e helpers. Temas customizados antigos sem `header` recebem fallback via `DARK_THEME`/`resolveThemePalette`.

O `StyleSheet.create` grande ainda fica no final de `src/App.tsx`. As telas ja extraidas recebem `styles` por prop temporaria para manter visual identico. So mover estilos para arquivos separados depois que as telas estiverem fora e equivalentes.

Padronizacoes visuais estabilizadas:

- Top bar/header usa `--app-header`, diferente do fundo principal.
- Drawer mostra logo, filtro/genero global atual e KPIs coerentes com o filtro quando possivel.
- Icones de pasta/lista/musica estao padronizados: pasta azul/ciano, lista amarelo/dourado, musica azul/ciano.
- `AppModal` e o padrao para novos modais e migracoes futuras, mas os modais antigos devem ser trocados aos poucos.
- Segmented control `Tudo/Listas/Pastas` em `FoldersScreen` e unificado, sem gaps entre botoes, com bordas externas e divisorias internas sutis.
- HomeDashboard usa visual premium dark/light via tokens, logo existente `public/CifrasGo.png`, cards de estatisticas, atalhos, recomendacoes e CTAs visuais.

## 13. Fluxos criticos

Visualizacao da cifra:

- `SongDetailScreen` carrega a musica por `id`.
- Detecta tom base com `detectTomFromContent`.
- Calcula distancia com `getTransposeBetweenKeys`.
- Reescreve acordes com `transposeContent`.
- Renderiza cada linha com `ChordLine`.
- Salva `preferredFontSize` em `db.updateSong`.
- Modo Play/apresentacao usa `PlaybackContext`: esconde o `AppHeader`, mantem titulo e artista no topo, mostra botao menu, botao X para sair, cifra em foco e controles rapidos/lista atual.
- Mostra indicadores discretos do metronomo no topo da musica: pulso visual e som.

Metronomo:

- Primeira fatia implementada em `src/screens/SongEditorScreen.tsx`, `src/screens/SongDetailScreen.tsx` e `src/types/models.ts`.
- A configuracao fica por musica: `bpm`, `compasso`, `beepVisualEnabled` e `beepSoundEnabled`.
- No editor, um botao pequeno de metronomo ao lado da selecao de generos abre `AppModal` com BPM, compasso (`2/4`, `3/4`, `4/4`, `6/8`), beep visual e beep sonoro.
- Na visualizacao da cifra, dois indicadores quadrados ficam no topo: um para pulso visual e outro para som.
- O pulso visual pisca no tempo do BPM; o primeiro tempo do compasso usa intensidade maior.
- O beep sonoro usa Web Audio API no web/Capacitor WebView, sem dependencia nova.
- O audio pode depender de uma interacao do usuario quando o navegador/WebView bloquear som automatico.
- Timers e audio devem ser limpos ao sair/trocar de musica.
- A feature nao altera auto-rolagem, navegacao, backup ou importacao.
- Pendencias: validar beep no Android instalado, melhorar mensagem/UX para audio bloqueado e decidir se os campos de metronomo entram em export/import CifrasGo.

Auto-rolagem:

- Retomada em `SongDetailScreen` dentro do modal `Controles Rapidos` do modo Play.
- Usa presets `V1` a `V8` em `px/s` e opcao `Personalizado` para valores locais entre 5 e 150 px/s.
- O scroll real confirmado e `window`; a implementacao usa `window.scrollY` e `window.scrollTo`.
- Nao usar `scrollRef`, `getScrollableNode` ou `getNativeScrollRef` como motor de auto-scroll.
- Investigacao completa em `docs/AUTO_SCROLL_DEBUG.md`.

Editor:

- `SongEditorScreen` usa `textarea` no web para preservar ergonomia.
- Em mobile usa `TextInput multiline`.
- Permite configurar metronomo por musica em modal `AppModal`: BPM, compasso, beep visual e beep sonoro.
- O botao de link/fonte da top bar abre um `AppModal` com URL da musica, botao "Copiar link", feedback "Link copiado" e botao "Abrir link da musica".
- O cabecalho do salvar/cancelar/abrir fonte e renderizado por `AppHeader`; os callbacks sao registrados por `SongEditorScreen` via `useSongEditorHeaderControls`.
- O botao voltar Android prioriza o `routeHistory` real. O `backTarget` do helper ainda cobre fallback: `returnTo` quando existir, `SongDetail` ao editar uma musica existente, ou `Songs` ao criar musica nova sem origem explicita.

Importacao:

- `src/services/linking.ts` escuta URL inicial/deep link via Capacitor e entrega `{ url, requestedAt }`.
- Android nativo recebe `ACTION_SEND`/`text/plain` na `MainActivity`, extrai `EXTRA_TEXT`, `EXTRA_HTML_TEXT`, `EXTRA_SUBJECT`, `EXTRA_TITLE`, `dataString` ou `ClipData`, e repassa para o JS.
- `App.tsx` chama `closeDrawer()` do `DrawerProvider` e navega para `Import` com `initialUrl` e `autoImportKey`.
- `ImportScreen` esta em `src/screens/ImportScreen.tsx`.
- `scrapeSongFromUrl` esta em `src/services/scraper.ts`.
- A tela recebe `initialUrl` e `autoImportKey` do roteamento manual para autoimportar links compartilhados.
- Ao importar com sucesso, navega automaticamente para `SongDetail`.
- Se ja existir musica com mesmo artista/titulo, nao duplica; mostra `AppModal` "Musica ja existente no app" com botao "Abrir musica".
- No web local, `/api/scrape` funciona quando `npm run dev` esta rodando.
- No APK Android, a API nao existe dentro do app; e preciso configurar `VITE_API_BASE_URL` em `.env.production` para um backend online ou IP acessivel. O arquivo `.env.production` fica ignorado pelo Git; `.env.production.example` documenta o formato. Ver `docs/DEPLOY_BACKEND_ANDROID.md`.

Backup:

- `BackupScreen` esta em `src/screens/BackupScreen.tsx`.
- Logica pesada esta em `src/services/backup.ts`.
- A tela so controla loading, progresso, input de arquivo web e mensagem final.
- O botao "Gerar backup completo" chama `buildCifrasGoFullBackupZip()` e compartilha/baixa o arquivo com `shareBlobFile`.
- O ZIP de backup completo inclui musicas, pastas, subpastas por `parentId`, listas, vinculos `@folder_songs`, generos, display settings, theme settings e filtros globais.
- Pastas e subpastas tambem podem ser compartilhadas como ZIP proprio com manifest `cifrasgo-folder.json`.
- A exportacao de pasta inclui toda a arvore abaixo da pasta escolhida: musicas diretas, subpastas, listas, musicas das listas e vinculos `@folder_songs`.
- Ao importar uma pasta exportada, o restore mescla por artista/titulo, caminho de pasta e pasta+nome de lista, preservando modo roteiro, `sections`, `section.color`, post-its, audio de referencia e metronomo.
- Ao selecionar um ZIP com `cifrasgo-backup.json`, a restauracao completa roda em modo mesclar: musicas por artista/titulo, generos por nome, pastas por caminho completo, listas por pasta+nome e vinculos por maps de IDs.
- Settings dentro de `data/settings.json` sao lidos como parte do formato exportado, mas nao sao sobrescritos na restauracao atual.
- `.zip` continua indo para `restoreBackupZip`, preservando o restore legado `.cfs`.
- `.txt` vai para `restoreCifrasGoSongTextFile`, que aceita apenas TXT versionado `CIFRASGO_SONG_V1`.
- Textos livres antigos sem marcador claro nao sao importados como CifrasGo.
- Na importacao de musica individual, a deduplicacao usa artista/titulo: se existir, atualiza a musica; se nao existir, cria uma nova.
- O ZIP de lista individual continua separado e usa `cifrasgo-playlist.json`; ZIP sem manifest proprio continua seguindo o restore legado `.cfs`.

Pastas e listas:

- `FoldersScreen`, `FolderDetailScreen` e `PlaylistDetailScreen` estao em `src/screens`.
- `PlaylistStructureScreen` e a tela dedicada para organizar listas, substituindo a experiencia antiga de "Ordenar lista" por uma tela grande e mais manutenivel.
- Ainda recebem `styles` por props temporarias.
- Consomem `nav` por `useManualNavigation`, filtros por `useGenreFilter` e controles da top bar por `useTopBarControls`.
- Usam `db.getFolders`, `db.getPlaylists`, `db.byFolder`, `db.byPlaylist`, `db.getFolderSongIds`, `db.addSongToFolder`, `db.removeSongFromFolder`, `db.addSongToPlaylist` e `db.removeSongFromPlaylist`.
- `FoldersScreen` e `FolderDetailScreen` limpam vinculos de pastas via `db.removeFolderSongLinks`; elas nao acessam mais `AsyncStorage`/`STORAGE_KEYS.folderSongs` diretamente.
- `FolderDetailScreen` passa `returnTo` ao abrir subpastas para que Android back/header voltem para a pasta pai em vez de pular para `Folders`.
- `PlaylistDetailScreen` abre `PlaylistStructureScreen` pelo comando "Organizar lista".
- Playlists antigas continuam compativeis: se nao tiverem `viewMode` ou `sections`, aparecem como Modo padrao.
- Modo padrao preserva a lista simples e permite reordenar musicas por drag/drop no web ou por botoes de subir/descer.
- Modo roteiro usa `sections` para criar secoes/titulos, como ENTRADA, ATO PENITENCIAL, GLORIA e outras partes liturgicas.
- No Modo roteiro, musicas podem ser arrastadas entre secoes, dentro da mesma secao e de/para "Sem secao"; secoes tambem podem ser arrastadas para mudar a ordem do roteiro.
- Os botoes de subir/descer, excluir e "Adicionar musica a secao" permanecem como fallback manual caso drag/drop falhe em algum ambiente.
- Cada secao pode ter `section.color`; a cor aparece como fundo suave no bloco/header da secao e marcador discreto, tanto em `PlaylistStructureScreen` quanto na visualizacao em `PlaylistDetailScreen`.
- A escolha de cor tem opcoes prontas e cor personalizada HEX, com validacao, exibicao do valor atual e acao de copiar cor.
- A simplificacao visual recente removeu a sensacao de "card dentro de card": as secoes usam blocos limpos, e as musicas dentro delas usam linhas/mini-cards compactos com drag/icone/titulo a esquerda e controles a direita.

Configuracoes:

- `SettingsScreen` esta em `src/screens/SettingsScreen.tsx`.
- Recebe apenas `songs` e `styles` do `App.tsx`.
- Inclui a opcao "Tela inicial", que abre um modal para ativar/desativar `@show_home_dashboard_on_start` e abrir `HomeDashboard` manualmente.
- Consome `globalFilters` e `updateGlobalFilters` por `useGenreFilter`.
- Consome `displaySettings`, `updateDisplaySettings`, `themeSettings` e `updateThemeSettings` por `useSettings`.
- Carrega generos cadastrados pelo `db.getGenres`.
- Permite criar, editar e excluir generos.
- Ao excluir genero, remove a chave normalizada das musicas e atualiza o filtro global.
- Controla filtro global de generos, incluindo `NO_GENRE_KEY` para musicas sem genero.
- Controla cores de acordes, letras, pauta e paleta do tema customizado.
- Inclui "Restaurar padrão de fábrica", com duas confirmacoes destrutivas; ao confirmar, apaga todos os dados locais por `db.clearAllData()` e recarrega o app.

Compartilhamento:

- Musica em `.txt` e lista em `.zip` passam por `src/services/share.ts`.
- Web continua usando Web Share API quando disponivel e download como fallback.
- Android instalado usa os plugins nativos `@capacitor/filesystem` e `@capacitor/share`; o arquivo temporario fica no cache do app e e entregue ao Android por FileProvider.
- `android/app/src/main/AndroidManifest.xml` ja declara o FileProvider `${applicationId}.fileprovider`.
- `android/app/src/main/res/xml/file_paths.xml` inclui `cache-path`, necessario para compartilhar arquivos gerados em `Directory.Cache`.
- Depois de alterar esse fluxo, sempre rodar `npm run build` e `npx cap sync android` antes de testar no celular.

Home/dashboard:

- `HomeDashboardScreen` esta em `src/screens/HomeDashboardScreen.tsx`.
- E renderizada por `App.tsx` pela rota manual `HomeDashboard`; nao esta no `AppNavigator`.
- Se `@show_home_dashboard_on_start` estiver ativo, o `App.tsx` abre essa rota na inicializacao e esconde o `AppHeader`.
- Ao tocar em atalhos da dashboard, o app navega para `Songs`, `Artists`, `Folders`, `Import`, `Backup` ou `Settings` e segue o fluxo normal.
- Usa a logo existente `public/CifrasGo.png`; nao adiciona imagens, assets ou dependencias.
- Monta bloco de saudacao, badge do filtro/genero global atual, cards de estatisticas filtradas, atalhos rapidos, musicas recentes/sugeridas e CTAs visuais sem acao por enquanto.
- Usa apenas `react-native-web`, `lucide-react`, `db`, `useGenreFilter`, `useManualNavigation` e tokens de `theme.ts`.
- A preferencia de abertura inicial fica em `src/services/storage.ts`, com padrao `false` para manter seguranca em testes.

## 14. Estado beta estabilizado

O app esta pronto para producao beta com estas decisoes finais:

- Navegacao manual permanece ativa; `AppNavigator` nao deve ser ativado ainda.
- Todas as telas reais do fluxo atual estao em `src/screens` e sao chamadas pelo `App.tsx`.
- Providers ativos: drawer, filtros globais, navegacao manual, playback, settings/theme, top bar e confirm dialog.
- Backup completo CifrasGo exporta e restaura em modo mesclar sem apagar dados existentes.
- Restore legado do app antigo continua isolado e nao deve ser misturado aos manifests proprios.
- Reset de fabrica esta disponivel para limpar dados locais com confirmacao dupla.
- HomeDashboard e opcional e nao substitui permanentemente a lista de musicas.
- Modo Play/apresentacao esta ativo; auto-rolagem esta disponivel no modal `Controles Rapidos` com presets `V1` a `V8` em `px/s`, opcao `Personalizado`, e usa `window.scrollY`/`window.scrollTo`.
- Metronomo por musica esta em primeira fatia: configuracao no editor e indicadores visual/sonoro na cifra, com Web Audio API.
- Visual de icones, segmented controls e modal base (`AppModal`) foram padronizados.
- Importacao web esta funcional; Android/share recebe URL, mas importacao no APK depende de backend acessivel via `VITE_API_BASE_URL`. Sem `.env.production` com URL absoluta, o APK mantem erro amigavel orientando configurar o backend online.
- Tema claro/escuro/customizado usa CSS variables aplicadas pelo `SettingsContext`.
- Proximas mudancas devem ser pequenas, com `npm run build` depois de cada fatia.

## 15. Regras para continuar a refatoracao

- A referencia visual e funcional e sempre o fluxo atual do `src/App.tsx`.
- Nao ativar uma tela rascunho se ela tiver menos recurso que a original.
- Extrair uma tela por vez.
- Manter `styles` por props enquanto o estilo global ainda estiver no `App.tsx`.
- Manter a navegacao manual por `ManualNavigationProvider` enquanto `AppNavigator` nao estiver pronto.
- Depois de cada extracao, rodar `npm run build`.
- Nao recriar acesso direto a `localStorage` dentro de telas.
- Nao duplicar parser de backup, scraper, ZIP/TXT ou filtro de generos dentro de telas.
- Usar `AppModal` como padrao para novos modais e migracoes pontuais, sem reescrever todos de uma vez.
- Para Android/iOS via Capacitor, evitar dependencias nativas de React Native que quebrem Vite.

## 16. Melhorias futuras separadas

Estas melhorias nao bloqueiam a beta e devem ser feitas como fatias separadas:

1. Migrar modais locais aos poucos para `AppModal`.
2. Hospedar o backend scraper, copiar `.env.production.example` para `.env.production`, preencher `VITE_API_BASE_URL` publico e gerar APK; ver `docs/DEPLOY_BACKEND_ANDROID.md`.
3. Testar visualmente a abertura inicial opcional da `HomeDashboardScreen` em mobile/web e os atalhos de entrada no fluxo normal.
4. Validar auto-rolagem em Android/WebView real com musicas longas, ja que a implementacao ativa usa `window` como scroll real; ver `docs/AUTO_SCROLL_DEBUG.md`.
5. Validar o metronomo no Android instalado: Web Audio API, desbloqueio por toque, pulso visual, estados por musica e limpeza ao navegar.
6. Decidir se os campos de metronomo devem entrar em TXT/ZIP CifrasGo e backup completo.
7. Mapear modais locais antes de qualquer tentativa de interceptar Android back dentro das telas.
8. Avaliar retorno explicito para `Import`, `Backup` e `Settings` quando abertos pelo drawer, se a UX desejada for voltar para a tela anterior.
9. Planejar um `StylesContext` ou dividir `styles` por componente/tela para remover o prop `styles` gradualmente.
10. Aproximar `AppNavigator` do fluxo real usando os tipos manuais ja definidos.
11. Depois que a casca estiver pronta, ligar `src/navigation/AppNavigator.tsx`.

Guia detalhado da refatoracao:

- `docs/REFATORACAO.md`
