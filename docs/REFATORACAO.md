# Guia de Refatoracao - CifrasGo

Atualizado em: 2026-05-17

## Objetivo

Manter o app facil de evoluir separando responsabilidades:

- `src/screens`: telas de fluxo.
- `src/components`: UI reutilizavel.
- `src/navigation`: rotas, parametros e stack.
- `src/services`: acesso a dados, APIs e storage.
- `src/theme`: cores, espacamentos e tokens visuais.
- `src/utils`: funcoes puras sem estado de UI.
- `src/types`: modelos compartilhados.

Nota importante: o app ativo voltou a usar o `src/App.tsx` completo, porque a primeira separacao de telas simplificou a interface e deixou muita coisa fora. A regra daqui para frente e refatorar por extracao fiel: copiar a tela original para um arquivo proprio, mover dependencias para services/utils, validar build e so entao ligar a rota.

Estado validado em 2026-05-15: a refatoracao incremental abaixo esta ativa no `App.tsx` original, `npm run build`, `npx cap sync android` e `assembleDebug` passaram. O app esta em estado de producao beta: fluxo principal estabilizado, backup/restauracao completo em modo mesclar, reset local disponivel, HomeDashboard opcional, modo apresentacao preservado, metronomo em primeira fatia e auto-rolagem retomada via `window`. A importacao no APK Android depende de backend acessivel via `VITE_API_BASE_URL`; ver `docs/DEPLOY_BACKEND_ANDROID.md`.

## Extracoes ja ativas

- `src/services/storage.ts`: `AsyncStorage`, `STORAGE_KEYS` e `db` completo para musicas, generos, filtros, tema, pastas, playlists e vinculos `@folder_songs`.
- `src/services/scraper.ts`: chamada para `/api/scrape` usada pela tela de importacao, validacao de JSON/content-type e erro claro quando o APK Android nao tem backend configurado.
- `src/services/backup.ts`: leitura de `.zip`/`.cfs`, deduplicacao, restauracao e exportacao de backup completo CifrasGo.
- `src/services/share.ts`: nomes de arquivo, TXT da musica, ZIP de playlist e compartilhamento/download, incluindo compartilhamento nativo Android via Capacitor.
- `src/services/songTextFormat.ts`: formato TXT proprio de musica (`CIFRASGO_SONG_V1`), builder e parser puro.
- `src/services/linking.ts`: URL inicial/deep link do Capacitor, extracao de URL importavel, suporte ao evento nativo Android de share e deduplicacao de eventos repetidos.
- `src/utils/genres.ts`: normalizacao, exibicao e filtros de genero, incluindo pastas/listas.
- `src/utils/chordKeys.ts`: tons, deteccao de tom e calculo de transposicao.
- `src/utils/chordKeys.ts`: tambem expoe opcoes de tom por preferencia de grafia (`sharp`, `flat`, `mixed`), mantendo calculo interno por semitom.
- `src/utils/links.ts`: extracao de URL recebida por texto/deep link.
- `src/theme/theme.ts`: paletas, opcoes de cores e settings visuais padrao, incluindo `header`/`--app-header` para a top bar.
- `src/components/AppHeader.tsx`: cabecalho/top bar extraido, incluindo drawer, voltar, busca, adicionar e acoes do editor.
- `src/components/AppDrawer.tsx`: menu lateral extraido, com logo, estatisticas e rotas principais.
- `src/components/AppModal.tsx`: modal base reutilizavel com header em `--app-header`, titulo, icone opcional, botao X, corpo e rodape opcional.
- `src/components/ChordLine.tsx`: renderizacao de acordes/letra.
- `src/components/SongMetaLine.tsx`: linha de artista/generos/observacao.
- `src/components/SongActionsModal.tsx`: modal de abrir, editar, adicionar a lista, compartilhar e excluir musica.
- `src/components/DrawerItem.tsx`: item do menu lateral.
- `src/components/ConfirmDialog.tsx`: provider completo, contexto/hook/modal de confirmacao destrutiva e controller usado pelo botao voltar.
- `src/contexts/DrawerContext.tsx`: provider/hook para abertura, fechamento e estatisticas do drawer, mantendo `AppHeader`/`AppDrawer` recebendo props finais pelo `App.tsx`.
- `src/contexts/GenreFilterContext.tsx`: provider/hook com estado real dos filtros globais de genero, leitura inicial de `@global_filters` e persistencia.
- `src/contexts/ManualNavigationContext.tsx`: provider/hook para `ManualNav`, removendo `nav` das props das telas.
- `src/contexts/PlaybackContext.tsx`: provider/hook para `isPlaying`, `setIsPlaying`, `startPlaying` e `stopPlaying`, mantendo o `App.tsx` controlando header, back button e reset ao sair da cifra.
- `src/contexts/SettingsContext.tsx`: provider/hook para `displaySettings`, `themeSettings`, updates persistidos e aplicacao das variaveis CSS do tema.
- `src/contexts/SettingsContext.tsx`: ao alternar entre tema escuro e claro, aplica defaults seguros de letra/acorde para manter a cifra legivel, preservando o tema personalizado e a edicao manual posterior.
- `src/contexts/TopBarContext.tsx`: provider/hook para controles da top bar e acoes do header do editor, removendo callbacks dessas telas.
- `src/navigation/types.ts`: tambem define `ManualRouteParamList`, com params reais do fluxo manual legado, incluindo `HomeDashboard` opcional e `returnTo` opcional em `FolderDetail`.
- `src/navigation/manualTypes.ts`: reexport temporario dos tipos manuais (`RouteName`, `ManualRoute`, `ManualNav`, top bar e header do editor) para manter imports estaveis durante a migracao.
- `src/navigation/manualRouteHelpers.ts`: helpers puros `getManualRouteTitle(route)` e `getManualBackTarget(route)`, removendo o calculo inline de titulo/voltar do `App.tsx` e cobrindo retornos minimos de `SongEditor` e subpastas.
- `src/App.tsx`: mantem a navegacao manual ativa, agora com `routeHistory` real. `nav.navigate` empilha a rota atual, o botao voltar desempilha o caminho percorrido e `getManualBackTarget(route)` fica como fallback quando nao ha historico.
- `src/screens/SongsScreen.tsx`: lista principal de musicas extraida do `App.tsx`, ainda usando `styles` e navegacao manual por props temporarias.
- `src/screens/SongDetailScreen.tsx`: visualizacao da cifra extraida fielmente, com transposicao, fonte por musica, lista atual, modo Play/apresentacao, auto-rolagem via `window` e primeira fatia do metronomo visual/sonoro. Historico da investigacao em `docs/AUTO_SCROLL_DEBUG.md`.
- `src/screens/SongDetailScreen.tsx`: no modo Play, musicas abertas por playlist aceitam swipe horizontal para anterior/proxima e mostram indicador discreto de proxima musica.
- `src/lib/chords.ts`: transposicao respeita a preferencia persistida de escrita dos acordes, preservando slash chords e extensoes/alteracoes entre parenteses.
- `src/screens/SongEditorScreen.tsx`: editor extraido fielmente, com metadados, generos, source URL em modal de copiar/abrir, editor expandido, pauta visual e configuracao de metronomo por musica.
- `src/screens/ArtistsScreen.tsx`: agrupamento por artista com busca e filtro global.
- `src/screens/ArtistDetailScreen.tsx`: musicas do artista, abrindo cifra e modal de acoes.
- `src/screens/ImportScreen.tsx`: importacao por URL usando `src/services/scraper.ts`, auto-import via share/deep link, deduplicacao por artista/titulo e modal para abrir musica ja existente.
- `src/screens/BackupScreen.tsx`: restauracao `.zip` legado e importacao `.txt` de musica CifrasGo usando `src/services/backup.ts`.
- `src/screens/FoldersScreen.tsx`: raiz de pastas/listas, filtros, busca, criar, mover, renomear, excluir e compartilhar listas.
- `src/screens/FolderDetailScreen.tsx`: detalhe de pasta, subpastas, listas, musicas vinculadas, adicionar/remover musicas e acoes internas.
- `src/screens/PlaylistDetailScreen.tsx`: detalhe de lista, adicionar/remover musicas, renderizacao de Modo roteiro com secoes coloridas e acesso a tela de organizacao.
- `src/screens/PlaylistStructureScreen.tsx`: tela grande de organizacao de playlists, com Modo padrao, Modo roteiro, secoes liturgicas, drag/drop, cores opcionais por secao e fallbacks manuais por botoes.
- `src/screens/SettingsScreen.tsx`: configuracoes reais extraidas do legado, com tema, cores de acordes/letras/pauta, generos cadastrados e filtro global.
- `src/screens/SettingsScreen.tsx`: tambem oferece `Acordes e transposição`, permitindo escolher escrita em sustenidos, bemois ou misto/popular.
- `src/screens/HomeDashboardScreen.tsx`: dashboard/home premium usando `/CifrasGo.png`, `db`, filtros globais e navegacao manual; pode abrir como boas-vindas sem header quando `@show_home_dashboard_on_start` estiver ativo, ou manualmente por Configuracoes.
- `src/screens/AboutScreen.tsx`: tela interna `Sobre / Guia do usuario`, organizada por array de secoes para manter o guia funcional dentro do app.
- `MANUAL_USUARIO.md`: manual oficial e documentacao viva do uso final do CifrasGo.

## Arquivos-chave do projeto

- `src/App.tsx`: orquestrador atual, providers, rota manual e render das telas.
- `src/components/AppHeader.tsx`: top bar/header.
- `src/components/AppDrawer.tsx`: drawer lateral com logo, filtro e KPIs.
- `src/components/AppModal.tsx`: padrao visual de modal moderno.
- `src/screens/SongDetailScreen.tsx`: cifra, transposicao, modo Play e metronomo.
- `src/screens/SongEditorScreen.tsx`: edicao, generos, metronomo, link de origem e editor expandido.
- `src/screens/FoldersScreen.tsx`: pastas/listas e segmented control `Tudo/Listas/Pastas`.
- `src/screens/ImportScreen.tsx`: importacao manual e automatica.
- `src/screens/BackupScreen.tsx`: backup/restauracao.
- `src/screens/AboutScreen.tsx`: guia do usuario dentro do app.
- `src/services/scraper.ts`: cliente da API de importacao.
- `src/services/linking.ts`: deep link/share Android e web.
- `src/services/storage.ts`: DAO do `localStorage`.
- `server.ts`: backend Express e scraper Cifra Club.
- `docs/AUTO_SCROLL_DEBUG.md`: historico completo da auto-rolagem e decisao final de usar `window` como scroll real.
- `docs/DEPLOY_BACKEND_ANDROID.md`: guia para backend de importacao no APK Android.
- `MANUAL_USUARIO.md`: manual oficial do usuario e referencia viva das funcionalidades.

## Documentacao viva

Toda feature relevante deve atualizar, na mesma fatia ou em uma fatia imediatamente documentacional:

- documentacao tecnica (`PROJETO_CONTEXTO.md` e este guia);
- `MANUAL_USUARIO.md`;
- `src/screens/AboutScreen.tsx`, quando a mudanca afetar o fluxo ou a experiencia do usuario final.

A rota manual `About` usa titulo `Sobre / Guia`, fallback de retorno para `Settings` e tambem aparece no drawer logo abaixo de `Backup/Restauração`. O objetivo e evitar perda de contexto e deixar o proprio app explicar seus principais fluxos.

## Estrutura atual sugerida

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
  utils/
    chordKeys.ts
    genres.ts
    links.ts
```

Hoje, todas as telas principais do fluxo legado ja sao chamadas pelo `App.tsx` ativo. Elas ainda recebem `styles` e alguns params/callbacks temporarios, mas `drawerOpen`, `drawerStats`, `globalFilters`, `nav`, `displaySettings`, `themeSettings`, `topBarControls`, `songEditorHeaderControls` e `isPlaying` ja sairam das props/estado direto do `App.tsx` e agora vem de contexts. O calculo de `title` e `backTarget` da navegacao manual tambem saiu do miolo do `App.tsx` e fica em `src/navigation/manualRouteHelpers.ts`; o `backTarget` agora e fallback, porque o caminho principal do botao voltar usa `routeHistory` real mantido pelo `App.tsx`. O `App.tsx` apenas monta `GenreFilterProvider`, sem guardar o estado real dos filtros. `src/screens/HomeScreen.tsx` e `src/screens/ChordViewScreen.tsx` continuam como rascunhos do navigator futuro; `src/screens/HomeDashboardScreen.tsx` funciona como tela inicial/boas-vindas opcional, sem substituir `SongsScreen` no fluxo normal apos qualquer atalho. `src/screens/SettingsScreen.tsx` agora e a tela real extraida e ativa.

## Estado beta estabilizado

O projeto esta pronto para uma rodada de producao beta com as seguintes decisoes consolidadas:

- Navegacao manual continua ativa e nao deve ser substituida pelo `AppNavigator` ainda.
- A navegacao manual agora preserva historico real de rotas: fluxos profundos como `Songs -> Folders -> Pasta -> Subpasta -> Lista -> Musica` voltam pelo mesmo caminho antes de cair no fallback.
- `App.tsx` segue como orquestrador principal, mas estados globais sensiveis ja vivem em providers.
- Todas as telas reais do fluxo legado foram extraidas para `src/screens`.
- Backup completo proprio CifrasGo ja exporta e restaura em modo mesclar.
- Restore legado `.zip`/`.cfs` do app antigo continua preservado e separado por deteccao de manifest.
- Importacao de musica individual TXT CifrasGo e lista ZIP CifrasGo estao separadas dos formatos legados.
- Reset de fabrica apaga as chaves locais com confirmacao dupla.
- HomeDashboard e opcional, persistida por `@show_home_dashboard_on_start`, e nao prende o usuario fora do fluxo normal.
- Quando `@show_home_dashboard_on_start` esta ativo, `HomeDashboard` vira a raiz final do historico manual; quando esta inativo, a raiz final continua sendo `Songs`.
- Modo Play/apresentacao da cifra esta ativo; ele esconde o header do app, mostra titulo/artista, menu, botao X e cifra em foco.
- Primeira fatia do metronomo esta integrada: cada musica pode salvar BPM, compasso, beep visual e beep sonoro; a cifra mostra indicadores discretos no topo.
- PlaylistStructureScreen esta integrado como nova organizacao de listas: playlists antigas continuam em Modo padrao, e novas listas podem usar Modo roteiro com secoes, drag/drop e cores por secao.
- Auto-rolagem esta disponivel no modo Play pelo modal `Controles Rapidos`, com presets `V1` a `V8` em `px/s`, velocidade personalizada e motor baseado em `window`.
- Visual de icones em musicas, pastas e listas foi padronizado: pasta azul/ciano, lista amarelo/dourado, musica azul/ciano.
- Segmented control de `FoldersScreen` esta unificado: `[Tudo][Listas][Pastas]`, sem gaps entre botoes.
- `AppModal` ja cobre modais modernos importantes: tom, controles rapidos, metronomo, musica existente e link de origem.
- Tema claro/escuro/customizado usa CSS variables aplicadas por `SettingsContext`.
- Importacao web funciona com backend local; APK Android precisa de `VITE_API_BASE_URL` absoluto apontando para backend acessivel. O projeto possui `.env.production.example` como template e `.env.production` deve ser criado localmente, sem versionar a URL real.

## Como criar uma nova tela

1. Criar arquivo em `src/screens/NomeScreen.tsx`.
2. Adicionar a rota em `src/navigation/types.ts`.
3. Renderizar a tela em `src/navigation/AppNavigator.tsx`.
4. Passar parametros pela rota, nunca por variavel global.

Exemplo:

```ts
export type RootStackParamList = {
  Home: undefined;
  ChordView: { songId: string };
  Settings: undefined;
  Import: { initialUrl?: string } | undefined;
};
```

## Como mover funcoes do App antigo

Antes de mover uma tela, confira estes criterios:

- A tela nova precisa ter os mesmos botoes e modais da original.
- Os fluxos de voltar/abrir editor/importar/adicionar/remover precisam continuar iguais.
- O storage precisa continuar usando as mesmas chaves.
- O build precisa passar antes de ativar a tela no navigator.
- Se a tela ficou mais simples que a original, ela ainda nao esta pronta para entrar.

### Storage e salvar musica

Tudo que le ou grava `localStorage` deve ir para `src/services/storage.ts`.

Exemplos ja migrados:

- `db.getSongs`
- `db.saveSongs`
- `db.addSong`
- `db.updateSong`
- `db.deleteSong`
- `db.byFolder`
- `db.byPlaylist`
- `db.getGenres`
- `db.saveGenres`
- `db.addGenre`
- `db.deleteGenre`
- `db.getDisplaySettings`
- `db.saveDisplaySettings`
- `db.getThemeSettings`
- `db.saveThemeSettings`
- `db.getGlobalFilters`
- `db.saveGlobalFilters`
- `db.getFolders`
- `db.saveFolders`
- `db.addFolder`
- `db.updateFolder`
- `db.deleteFolder`
- `db.getSubfolders`
- `db.getPlaylists`
- `db.savePlaylists`
- `db.addPlaylist`
- `db.updatePlaylist`
- `db.deletePlaylist`
- `db.addSongToPlaylist`
- `db.removeSongFromPlaylist`
- `db.getFolderSongIds`
- `db.addSongToFolder`
- `db.removeSongFromFolder`
- `db.removeFolderSongLinks`

Ao migrar uma funcao, a tela deve chamar o service:

```ts
const created = await db.addSong({
  title,
  artist,
  content,
  observation: '',
});
navigation.navigate('ChordView', { songId: created.id });
```

### Capturar links e deep links

A extracao pura de URL ja foi para:

- `src/utils/links.ts`

Ja criado:

- `src/services/linking.ts`

Ja migrado do `App.tsx`:

- `CapacitorApp.getLaunchUrl()`;
- `CapacitorApp.addListener('appUrlOpen', ...)`;
- chamada para `extractUrlFromSharedText`;
- deduplicacao de eventos repetidos em janela curta;
- retorno de cleanup do listener.

Uso atual:

```ts
useEffect(() => subscribeToIncomingImportUrls(handleIncomingImportUrl), [handleIncomingImportUrl]);
```

O `App.tsx` ainda decide a navegacao para `Import`, passando `{ initialUrl, autoImportKey }` pela rota manual.

### Scraper/importacao

Ja criado:

- `src/services/scraper.ts`

Ja migrado do `ImportScreen` legado:

- montagem da URL `${API_BASE_URL}/api/scrape`;
- `fetch`;
- tratamento de erro;
- retorno `{ title, artist, content }`.
- validacao de `content-type` antes de parsear JSON;
- erro claro quando Android recebe HTML/index em vez de JSON;
- deduplicacao de musica ja existente em `ImportScreen`.

A tela `ImportScreen` deve ficar responsavel apenas por input, loading e navegacao.

Status atual: `src/screens/ImportScreen.tsx` ja foi extraida e segue esse limite. Ao receber `initialUrl`/`autoImportKey`, autoimporta uma unica vez por chave/URL. Ao encontrar musica existente por artista/titulo, mostra `AppModal` "Musica ja existente no app" e permite abrir a musica local.

Backend de importacao:

- `server.ts` normaliza URLs do Cifra Club para `https://www.cifraclub.com.br/...`.
- O request do scraper usa `fetch` nativo do Node, nao `axios`, porque `axios`/`curl` recebiam 403 do Akamai neste ambiente.
- Headers de navegador foram adicionados para reduzir 403.
- Link de teste validado: `https://www.cifraclub.com.br/felipe-rodrigues/tudo-e-perda/`.
- No APK Android, o backend nao roda dentro do app; e preciso configurar `VITE_API_BASE_URL` absoluto em `.env.production`. O template versionado e `.env.production.example`, e a URL nao deve incluir `/api/scrape`. Guia: `docs/DEPLOY_BACKEND_ANDROID.md`.

### Backup/restore

Ja criado:

- `src/services/backup.ts`
- `src/services/songTextFormat.ts`

Ja migrado do `BackupScreen` legado:

- `parseCfs`;
- `parseListCfs`;
- restauracao do zip;
- deduplicacao por artista/titulo;
- criacao/atualizacao de playlists.

A tela deve receber progresso e mensagens do service, sem conhecer detalhes de `.cfs`.

Status atual: `src/screens/BackupScreen.tsx` ja foi extraida e delega a restauracao de `.zip` legado para `restoreBackupZip`.

Exportacao de backup completo CifrasGo:

- `buildCifrasGoFullBackupZip()` gera um `.zip` proprio versionado para backup completo.
- O ZIP contem `cifrasgo-backup.json`, `data/songs.json`, `data/folders.json`, `data/playlists.json`, `data/folder-songs.json`, `data/genres.json`, `data/settings.json`, `readable/musicas/*.txt` e `readable/listas/*.txt`.
- Os arquivos em `data/` sao a fonte canonica futura; `readable/` serve para leitura humana e usa TXT de musica importavel.
- `BackupScreen` tem o botao "Gerar backup completo" e compartilha/baixa o ZIP via `shareBlobFile`.
- `restoreBackupZip` detecta `cifrasgo-backup.json` e restaura o backup completo em modo mesclar.
- Merge do backup completo: musicas por artista/titulo, generos por nome normalizado, pastas por caminho completo, listas por pasta+nome, e `folder_songs` com remapeamento de IDs.
- O restore completo e defensivo para compatibilidade retroativa: playlists sem `songIds`, sem `sections`, secoes sem `songIds` e mapas `folder_songs` incompletos sao normalizados antes do uso.
- Playlists em Modo roteiro preservam `viewMode`, `sections` e `section.color` quando esses campos existem; listas antigas sem esses campos continuam como Modo padrao.
- Uma playlist ou secao parcialmente invalida nao deve abortar o restore inteiro; o service ignora apenas a parte invalida e restaura o restante possivel.
- Configuracoes salvas em `data/settings.json` ainda nao sao sobrescritas na restauracao completa.
- Se nao houver `cifrasgo-backup.json`, o restore legado `.zip`/`.cfs`, importacao de musica `.txt` e importacao de lista `.zip` permanecem separados.

Exportacao/restauracao de pasta CifrasGo:

- `buildCifrasGoFolderBackupZip(folderId)` gera um `.zip` proprio para uma pasta, subpasta ou sub-subpasta.
- O ZIP usa manifest `cifrasgo-folder.json` e arquivos canonicos `data/songs.json`, `data/folders.json`, `data/playlists.json` e `data/folder-songs.json`.
- A exportacao inclui a pasta escolhida, todas as subpastas descendentes, musicas vinculadas diretamente, listas dentro da arvore, musicas dessas listas e vinculos `folder_songs`.
- Ao exportar uma subpasta, ela vira a raiz relativa do pacote; ao importar, e mesclada por caminho/nome como uma arvore normal.
- O restore detecta `cifrasgo-folder.json` antes de `cifrasgo-playlist.json` e reaproveita a mesma rotina defensiva do backup completo.
- Dados novos de musica, como post-it, posicao/tamanho/cor/visibilidade do post-it, audio de referencia, metronomo, fonte, `sourceUrl` e generos, viajam dentro de `data/songs.json`.

Restore legado preservado:

- ZIP sem `cifrasgo-backup.json` e sem `cifrasgo-playlist.json` continua seguindo o fluxo antigo `.cfs`.
- Arquivos `[List]-*.cfs` sao tratados como listas antigas e nao devem virar musicas.
- O parser legado nao deve ser simplificado junto com os formatos proprios CifrasGo.

Importacao/exportacao de lista CifrasGo:

- ZIP de lista individual usa manifest `cifrasgo-playlist.json`.
- O restore detecta esse manifest antes de tentar o legado `.cfs`.
- A ordem das musicas da lista e preservada.
- Musicas sao deduplicadas por artista/titulo e a playlist aponta para os IDs locais resultantes.
- Manifests antigos de lista CifrasGo que nao trazem `playlist.songIds` usam a ordem dos objetos em `songs` como fallback.

Importacao individual de musica CifrasGo:

- TXT versionado com marcador `[CIFRASGO_SONG_V1]` e fechamento `[/CIFRASGO_SONG_V1]`.
- Metadados JSON preservam titulo, artista, genero legado, generos, observacao, sourceUrl e tamanho de fonte preferido.
- O conteudo da cifra fica apos o bloco versionado para preservar quebras de linha.
- `restoreCifrasGoSongTextFile(file)` detecta/parseriza o TXT proprio; textos livres antigos sem marcador nao sao tratados como CifrasGo.
- Deduplicacao por artista/titulo: se existir, atualiza a musica; se nao existir, cria uma nova.
- O restore legado `.zip`/`.cfs` permanece inalterado.

### Compartilhamento

Ja criado:

- `src/services/share.ts`

Ja migrado do legado:

- `sanitizeFileName`;
- `buildSongTextFile`;
- `downloadBlobFile`;
- `shareBlobFile`;
- `buildPlaylistZip`.

Comportamento Android/Capacitor:

- `@capacitor/share` e `@capacitor/filesystem` estao instalados e sincronizados.
- `shareBlobFile` detecta Android com `Capacitor.isNativePlatform()` + `Capacitor.getPlatform()`.
- O Blob e convertido para base64, salvo em `Directory.Cache` e resolvido com `Filesystem.getUri`.
- O arquivo e enviado ao plugin nativo por `Share.share({ files: [uri] })`, nao mais como `url`.
- Falhas nativas mostram `window.alert` com erro legivel no WebView Android.
- `SongActionsModal` usa `shareBlobFile` para TXT de musica; listas continuam usando `shareBlobFile` para ZIP.

### Reset de fabrica

Ja criado:

- `db.clearAllData()` em `src/services/storage.ts`.
- Acao "Restaurar padrao de fabrica" em `src/screens/SettingsScreen.tsx`.

Comportamento:

- exige duas confirmacoes;
- remove `@songs`, `@folders`, `@playlists`, `@folder_songs`, `@genres`, `@display_settings`, `@global_filters`, `@theme_settings` e `@show_home_dashboard_on_start`;
- recarrega o app para voltar ao estado inicial limpo.

Esse fluxo e util para testar backup/restauracao antes de gerar builds beta.

### Metronomo por musica

Primeira fatia criada:

- Tipos adicionados em `src/types/models.ts`: `SongCompasso` e campos opcionais em `Song`/`SongInput`.
- Campos persistidos por musica: `bpm`, `compasso`, `beepVisualEnabled` e `beepSoundEnabled`.
- `SongEditorScreen` ganhou um botao pequeno de metronomo ao lado da selecao de generos.
- O botao abre `AppModal` com configuracoes de BPM, compasso (`2/4`, `3/4`, `4/4`, `6/8`), beep visual e beep sonoro.
- Musicas antigas continuam compativeis porque todos os campos novos sao opcionais e recebem fallback seguro.
- `SongDetailScreen` mostra dois indicadores quadrados no topo da musica: pulso visual e som.
- O beep visual pisca conforme o BPM/compasso; o primeiro tempo do compasso usa intensidade maior.
- O beep sonoro usa Web Audio API no web/WebView, sem biblioteca nova.
- O som depende de interacao do usuario quando o navegador/WebView bloquear audio automatico.
- Timers e audio sao limpos ao trocar/sair da musica.
- A auto-rolagem foi retomada depois do diagnostico confirmar que o scroll real da cifra e `window`, nao `scrollRef`.

Pendencias futuras:

- Validar visual e audio no Android instalado, porque Web Audio pode depender de gesto do usuario no WebView.
- Melhorar UX de audio bloqueado, caso o Android/WebView silencie o primeiro toque.
- Avaliar se o metronomo deve aparecer tambem dentro do modo Play em posicao propria.
- Avaliar export/import desses campos em formatos CifrasGo, se o backup/listas/musicas precisarem preservar metronomo fora do storage local.
- Criar testes manuais documentados para BPM, compassos e limpeza de timers ao navegar.

### Padroes visuais atuais

- Usar CSS variables do tema: `--app-bg`, `--app-surface`, `--app-surface-alt`, `--app-header`, `--app-text`, `--app-muted-text`, `--app-border-soft`, `--app-accent`, `--app-overlay`.
- Novos modais devem usar `src/components/AppModal.tsx`.
- `AppModal` deve ter titulo curto, icone opcional e rodape para acoes principais.
- Segmented controls devem ser grupos continuos, sem gaps internos, com bordas externas arredondadas e divisorias sutis.
- Icones de pasta/lista/musica seguem padrao: pasta azul/ciano, lista amarelo/dourado, musica azul/ciano.
- Evitar redesign amplo dentro de uma fatia funcional; manter melhorias visuais controladas e testaveis.

## Como migrar telas e integrar o navigator

### Telas ja migradas

Estao em `src/screens` e ativos no roteamento manual original:

- `SongsScreen`: recebe `styles`; calcula `returnTo` localmente e usa `useManualNavigation`/`useGenreFilter`/`useTopBarControls`.
- `SongDetailScreen`: recebe `id`, `returnTo`, dados opcionais da playlist de origem e `styles`; usa `useManualNavigation`/`useGenreFilter`/`useSettings`/`usePlayback`.
- `SongEditorScreen`: recebe `id`, `returnTo` e `styles`; usa `useManualNavigation`/`useSettings`/`useSongEditorHeaderControls`.
- `ArtistsScreen`: recebe `styles`; usa `useManualNavigation`/`useGenreFilter`/`useTopBarControls`.
- `ArtistDetailScreen`: recebe `artist` e `styles`; calcula `returnTo` localmente e usa `useManualNavigation`/`useGenreFilter`.
- `ImportScreen`: recebe `initialUrl`, `autoImportKey` e `styles`; usa `useManualNavigation` e calcula `returnTo` localmente.
- `BackupScreen`: recebe apenas `styles`.
- `FoldersScreen`: recebe `styles`; usa `useManualNavigation`/`useGenreFilter`/`useTopBarControls`.
- `FolderDetailScreen`: recebe `folderId`, `currentFolderName` e `styles`; calcula `returnTo` localmente, passa esse `returnTo` ao abrir subpastas e usa `useManualNavigation`/`useGenreFilter`/`useTopBarControls`.
- `PlaylistDetailScreen`: recebe `playlistId`, `playlistName`, `folderId`, `folderName` e `styles`; calcula `returnTo` localmente e usa `useManualNavigation`/`useGenreFilter`/`useTopBarControls`.
- `SettingsScreen`: recebe `songs` e `styles`; usa `useGenreFilter` para filtros globais e `useSettings` para display/tema.

As props temporarias restantes existem para preservar comportamento enquanto o `App.tsx` ainda controla estado global, cabecalho e estilos. Quando o `AppNavigator` for ativado, aproveitar `ManualRouteParamList` para migrar os params reais com menos risco.

### ArtistsScreen

Ja migrado:

- `src/screens/ArtistsScreen.tsx`
- `src/screens/ArtistDetailScreen.tsx`

Dependencias:

- `db.getSongs`
- `matchesGenreFilter`
- `SongActionsModal`
- `SongMetaLine`

Rotas sugeridas:

```ts
Artists: undefined;
ArtistDetail: { artist: string };
```

### Folders e playlists

Ja migrado:

- `src/screens/FoldersScreen.tsx`
- `src/screens/FolderDetailScreen.tsx`
- `src/screens/PlaylistDetailScreen.tsx`
- `src/screens/PlaylistStructureScreen.tsx`

O `src/services/storage.ts` ja contem:

- `getFolders`
- `saveFolders`
- `addFolder`
- `getSubfolders`
- `addPlaylist`
- `byFolder`
- `byPlaylist`
- `addSongToPlaylist`
- `removeSongFromPlaylist`
- `getFolderSongIds`
- `addSongToFolder`
- `removeSongFromFolder`

Observacao: `FoldersScreen` e `FolderDetailScreen` nao acessam mais `AsyncStorage`/`STORAGE_KEYS.folderSongs` diretamente para limpar vinculos. Esse fluxo agora passa por `db.removeFolderSongLinks`.

### Modo roteiro de playlists

Implementado em:

- `src/screens/PlaylistStructureScreen.tsx`
- `src/screens/PlaylistDetailScreen.tsx`
- `src/types/models.ts`

Dados:

- `Playlist.viewMode?: 'default' | 'script'`
- `Playlist.sections?: PlaylistSection[]`
- `PlaylistSection.id`
- `PlaylistSection.title`
- `PlaylistSection.songIds`
- `PlaylistSection.color?`

Compatibilidade:

- Playlists antigas sem `viewMode` e sem `sections` continuam funcionando como Modo padrao.
- `sections` e `section.color` sao opcionais.
- `section.color` aceita os valores prontos antigos (`blue`, `green`, `gold`, `purple`, `red`, `gray`) e HEX personalizado, como `#4FC3F7`.
- O backup/importacao nao foi alterado nessa fatia; a compatibilidade local vem dos campos opcionais no modelo.

Modo padrao:

- Mantem a lista simples.
- Permite reordenar musicas por drag/drop.
- Mantem botoes de subir/descer e excluir como fallback manual.
- Preserva a experiencia das listas antigas.

Modo roteiro:

- Permite criar secoes/titulos dentro da lista, pensadas para roteiro liturgico ou ordem de ensaio, como ENTRADA, ATO PENITENCIAL, GLORIA, COMUNHAO e FINAL.
- Permite associar musicas a uma secao.
- Mostra musicas sem secao no bloco "Sem secao".
- Permite arrastar musicas entre secoes, dentro da mesma secao e de/para "Sem secao".
- Permite arrastar secoes inteiras para mudar a ordem do roteiro.
- Mantem botoes de subir/descer, excluir e "Adicionar musica a secao" como fallback quando drag/drop nao estiver ergonomico no ambiente.

Cores por secao:

- Cada secao pode ter cor opcional.
- A cor e aplicada como fundo suave/transparente e marcador discreto, evitando visual berrante.
- A cor aparece tanto na tela de organizacao (`PlaylistStructureScreen`) quanto na visualizacao da playlist (`PlaylistDetailScreen`).
- A UI de cor tem opcoes prontas, opcao personalizada por HEX, validacao simples, exibicao do valor atual e botao "Copiar cor" com feedback.

Visual:

- As secoes foram simplificadas para evitar "card dentro de card".
- O bloco/header da secao usa fundo suave baseado na cor escolhida.
- Musicas dentro das secoes usam linhas/mini-cards compactos, com drag/icone/titulo/artista a esquerda e controles a direita.
- O objetivo visual e manter clareza de onde cada musica comeca/termina sem ocupar espaco excessivo.

### Modais destrutivos

Ja criado:

- `src/components/ConfirmDialog.tsx`

O arquivo ja exporta contexto, hook e modal. As telas podem chamar algo como:

```ts
const confirmed = await confirm({
  title: 'Excluir musica?',
  message: 'Esta acao nao podera ser desfeita.',
});
```

## Navegacao e plataforma

O pedido original era React Navigation com Stack Navigator. Em React Native puro, o caminho natural seria `@react-navigation/native-stack`. Neste projeto, por ser Vite + `react-native-web` + Capacitor, os stacks oficiais com dependencias nativas quebraram o build.

Decisao atual:

- usar `@react-navigation/native` para container/tema/linking;
- manter um stack adapter local em `AppNavigator.tsx`;
- preservar API familiar: `navigation.navigate('ChordView', { songId })` e `navigation.goBack()`.
- manter `AppNavigator` compilando, mas ainda inativo; a rota `Settings` nele esta com placeholder enquanto a tela real depende da casca atual (`styles`, filtros globais e callbacks de tema).
- o fluxo manual ativo ja tem `ManualRouteParamList` tipado em `src/navigation/types.ts`; `manualTypes.ts` apenas reexporta esses tipos para reduzir churn nos imports.
- a rota manual `HomeDashboard` permite abrir `HomeDashboardScreen` como boas-vindas opcional ao iniciar o app, sem `AppHeader`, ou manualmente a partir de Configuracoes.
- a preferencia `@show_home_dashboard_on_start` fica em `src/services/storage.ts`, com padrao `false`.
- quando `HomeDashboard` esta habilitada no inicio, ela entra como raiz final do `routeHistory`; se a preferencia estiver desligada, a raiz final e `Songs`.
- `nav.navigate` e o `AppDrawer` passam por `navigateToRoute`, que empilha a rota atual antes de trocar de tela e evita loops quando a rota destino e igual a rota anterior.
- o botao voltar do `AppHeader` e o voltar Android chamam `handleBackPress`, com prioridade: confirm dialog, drawer, modo Play/isPlaying, historico real, `getManualBackTarget(route)` e raiz final.
- quando `HomeDashboard` abre sem `returnTo`, `getManualBackTarget` retorna `null`; quando abre por Configuracoes, recebe `returnTo: Settings`. Esse valor continua util como fallback, nao como fonte principal do historico.
- os helpers `getManualRouteTitle` e `getManualBackTarget` ficam em `src/navigation/manualRouteHelpers.ts` para manter os titulos e destinos de voltar testaveis fora do JSX principal.
- o `backTarget` do `SongEditor` segue a regra minima: respeita `returnTo`, volta para `SongDetail` quando edita uma musica com `id`, e volta para `Songs` quando cria musica nova sem `returnTo`.
- o `backTarget` de `FolderDetail` respeita `returnTo` quando a pasta foi aberta a partir de uma subpasta; pastas raiz continuam voltando para `Folders`.

Quando/se o projeto virar Expo ou React Native CLI:

1. instalar `@react-navigation/native-stack`, `react-native-screens` e `react-native-safe-area-context`;
2. substituir o adapter por `createNativeStackNavigator`;
3. remover o alias web caso o build nativo deixe de depender do Vite.

## Checklist para nao baguncar de novo

- Objetivo final: `App.tsx` deve apenas montar providers/navigator. Hoje ele ainda segue grande de proposito, ate as telas ficarem fieis.
- Tela nao deve conhecer chave de `localStorage`.
- Tela nao deve compactar/descompactar backup.
- Tela nao deve montar arquivo ZIP/TXT.
- Tela pode controlar estado visual local: modal aberto, busca, loading.
- Regra reutilizavel deve ir para `services` ou `utils`.
- Estilo compartilhado deve usar `theme.ts`.
- Novo modal deve usar `src/components/AppModal.tsx` quando a migracao nao aumentar risco.
- Ao migrar uma tela do legado, rode `npm run build`.

## Validacoes recentes

- 2026-05-14: `npm run build` passou apos extrair `SongDetailScreen`.
- 2026-05-14: `npm run build` passou apos extrair `SongEditorScreen` e corrigir os checkmarks dos filtros de genero.
- 2026-05-14: `npm run build` passou apos extrair `ArtistsScreen` e `ArtistDetailScreen`.
- 2026-05-14: `npm run build` passou apos extrair `ImportScreen` e `BackupScreen`.
- 2026-05-14: `npm run build` passou apos extrair `FoldersScreen`.
- 2026-05-14: `npm run build` passou apos extrair `FolderDetailScreen`.
- 2026-05-14: `npm run build` passou apos extrair `PlaylistDetailScreen`.
- 2026-05-14: `npm run build` passou apos extrair `SettingsScreen` real e ajustar o placeholder do `AppNavigator`.
- 2026-05-14: `npm run build` passou apos mover `GenreFilterContext` para `src/contexts` e centralizar tipos da navegacao manual.
- 2026-05-14: `npm run build` passou apos criar `db.removeFolderSongLinks` e remover acesso direto a `@folder_songs` das telas de pastas.
- 2026-05-14: `npm run build` passou apos extrair `AppHeader` e `AppDrawer`.
- 2026-05-14: `npm run build` passou apos mover URL inicial/deep link para `src/services/linking.ts`.
- 2026-05-14: `npm run build` passou apos extrair `ConfirmDialogProvider` completo e remover `confirmDialog`/`confirmResolveRef` do `App.tsx`.
- 2026-05-14: `npm run build` passou apos adicionar `ManualRouteParamList` em `src/navigation/types.ts` e tipar `ManualNav`/`SongActionsModal`.
- 2026-05-14: `npm run build` passou apos mover `globalFilters` para `useGenreFilter` nas telas.
- 2026-05-14: `npm run build` passou apos criar `ManualNavigationProvider`/`useManualNavigation` e remover `nav` das props das telas.
- 2026-05-14: `npm run build` passou apos mover `returnTo` derivavel para dentro de `SongsScreen`, `ArtistDetailScreen`, `ImportScreen`, `FolderDetailScreen` e `PlaylistDetailScreen`.
- 2026-05-14: `npm run build` passou apos criar `SettingsProvider`/`useSettings`, mover leitura/update de `@display_settings` e `@theme_settings`, e mover a aplicacao de variaveis CSS do tema para `src/contexts/SettingsContext.tsx`.
- 2026-05-14: `npm run build` passou apos criar `TopBarProvider`/hooks, mover `topBarControls` e `songEditorHeaderControls`, e remover `onTopBarControlsChange`/`onHeaderControlsChange` das telas.
- 2026-05-14: `npm run build` passou apos criar `DrawerProvider`/`useDrawer`, mover `drawerOpen`, `drawerStats` e o carregamento de estatisticas do drawer para `src/contexts/DrawerContext.tsx`.
- 2026-05-14: `npm run build` passou apos criar `PlaybackProvider`/`usePlayback`, mover `isPlaying`/`setIsPlaying` para `src/contexts/PlaybackContext.tsx` e remover essas props de `SongDetailScreen`.
- 2026-05-14: `npm run build` passou apos mover o estado real de `globalFilters`, leitura de `@global_filters` e persistencia para `src/contexts/GenreFilterContext.tsx`.
- 2026-05-14: `npm run build` passou apos extrair `getManualRouteTitle` e `getManualBackTarget` para `src/navigation/manualRouteHelpers.ts`.
- 2026-05-14: `npm run build` passou apos corrigir o `backTarget` minimo do `SongEditor` em `src/navigation/manualRouteHelpers.ts`.
- 2026-05-14: `npm run build` passou apos adicionar `returnTo` opcional em `FolderDetail` e corrigir o retorno de subpastas para a pasta pai.
- 2026-05-14: `npm run build` passou apos criar `HomeDashboardScreen` como tela visual isolada usando a logo existente `public/CifrasGo.png`.
- 2026-05-14: `npm run build` passou apos adicionar rota manual temporaria `HomeDashboard`, opcao "Visualizar tela inicial" em `SettingsScreen` e token `header`/`--app-header` para diferenciar a top bar.
- 2026-05-15: `npm run build` passou e `npx cap sync android` concluiu apos corrigir compartilhamento nativo Android em `src/services/share.ts` e fazer TXT de musica usar `shareBlobFile`.
- 2026-05-15: `npm run build` passou apos criar importacao individual de musica TXT `CIFRASGO_SONG_V1`, parser puro em `src/services/songTextFormat.ts`, restore em `src/services/backup.ts` e aceitar `.txt` na `BackupScreen`.
- 2026-05-15: `npm run build` passou apos criar exportacao de backup completo em `buildCifrasGoFullBackupZip()` e adicionar o botao "Gerar backup completo" na `BackupScreen`.
- 2026-05-15: `npm run build` passou apos implementar restauracao de backup completo CifrasGo em modo mesclar, mantendo o restore legado `.cfs` atras dos manifests proprios.
- 2026-05-15: `npm run build` passou apos adicionar "Restaurar padrão de fábrica" em `SettingsScreen`, com duas confirmacoes e limpeza das chaves locais via `db.clearAllData()`.
- 2026-05-15: `npm run build` passou apos transformar `HomeDashboardScreen` em tela inicial opcional, adicionar modal "Tela inicial" em `SettingsScreen`, persistir `@show_home_dashboard_on_start`, esconder `AppHeader` na dashboard e filtrar KPIs por genero global.
- 2026-05-15: auto-rolagem de `SongDetailScreen` pausada temporariamente. Investigacao completa registrada em `docs/AUTO_SCROLL_DEBUG.md`; evitar reiniciar debug do zero.
- 2026-05-15: `npm run build` passou apos restaurar/estabilizar o modo Play/apresentacao de `SongDetailScreen`, mantendo titulo, artista, menu, botao X e cifra em foco sem auto-rolagem.
- 2026-05-18: auto-rolagem retomada no modo Play usando `window.scrollY` e `window.scrollTo`, apos diagnostico confirmar `[scroll-candidate-active]` no `window`. Controles ficam no modal `Controles Rapidos` com presets `V1` a `V8` em `px/s` e opcao personalizada.
- 2026-05-15: `npm run build` passou apos criar `src/components/AppModal.tsx` e aplicar a prova no modal "Selecionar tom".
- 2026-05-15: `npm run build` passou apos primeira fatia do metronomo em `src/types/models.ts`, `src/screens/SongEditorScreen.tsx` e `src/screens/SongDetailScreen.tsx`.
- 2026-05-15: `npm run build`, `npx cap sync android` e `assembleDebug` passaram apos suporte Android a `ACTION_SEND`/`text/plain`, evento nativo `cifrasgoIncomingImportUrl` e auto-import por share/deep link.
- 2026-05-15: `npm run build` passou apos corrigir scraper Cifra Club: normalizacao para `https://www.cifraclub.com.br/...`, troca de `axios` por `fetch` nativo do Node e headers de navegador contra 403.
- 2026-05-15: `npm run build`, `npx cap sync android` e `assembleDebug` passaram apos validar resposta JSON em `src/services/scraper.ts`, exibir erro claro no APK sem backend, deduplicar musicas importadas e trocar link do editor para `AppModal` com copiar/abrir.
- 2026-05-17: `npx tsc -b` passou apos adicionar `routeHistory` real no `App.tsx`, trocar `AppHeader` para `onBackPress()` centralizado e manter `getManualBackTarget` como fallback.
- 2026-05-17: `npx tsc -b` passou apos tornar o restore de backups CifrasGo defensivo para playlists/sections/folder_songs incompletos, preservando Modo roteiro, cores de secoes, formatos antigos, `.cfs` legado e `.txt`.
- 2026-05-17: `npx tsc -b` passou apos adicionar exportacao/restauracao de pasta/subpasta com manifest `cifrasgo-folder.json`, compartilhamento via `shareBlobFile` e titulos de opcoes por profundidade.
- Tamanho atual aproximado do `src/App.tsx`: 1243 linhas.

## Proxima fatia recomendada

1. Migrar modais locais aos poucos para `AppModal`, com uma tela/fluxo por vez.
2. Hospedar/configurar backend de importacao para Android, criar `.env.production` a partir de `.env.production.example` e gerar APK com `VITE_API_BASE_URL`; ver `docs/DEPLOY_BACKEND_ANDROID.md`.
3. Testar visualmente a abertura inicial opcional da `HomeDashboardScreen` em web/Android, incluindo atalhos para entrar no fluxo normal.
4. Validar auto-rolagem em Android/WebView real com musicas longas; a implementacao ativa usa `window`, nao `scrollRef`; ver `docs/AUTO_SCROLL_DEBUG.md`.
5. Validar o metronomo no Android instalado: beep sonoro, beep visual, estado por musica e limpeza ao navegar.
6. Decidir se campos de metronomo entram em TXT/ZIP CifrasGo e backup completo.
7. Mapear modais locais antes de interceptar Android back dentro das telas; a stack global ja cobre rotas, mas nao estados internos de modal.
8. Validar manualmente em Android real o fluxo profundo `HomeDashboard/Songs -> Folders -> Pasta -> Subpasta -> Lista -> Musica` com o novo historico real.
9. Planejar um `StylesContext` ou dividir `styles` por componente/tela para remover o prop `styles` gradualmente.
10. Aproximar `AppNavigator` do fluxo real usando os tipos manuais ja definidos.
11. Rodar `npm run build` depois de cada fatia.
12. So ligar `AppNavigator` quando a casca atual tiver providers/tema/styles suficientes para renderizar todas as telas sem props temporarias.
