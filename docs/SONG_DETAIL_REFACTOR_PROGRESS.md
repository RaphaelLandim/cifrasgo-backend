# Progresso da refatoracao da SongDetailScreen

Atualizado em: 2026-05-25

Atualizacao estrutural em 2026-05-22: a micro-refatoracao do ecossistema de playlists consolidou os fluxos principais de adicionar/enviar/retirar musicas de listas no componente reutilizavel `src/components/modals/PlaylistPickerModal.tsx`.

Atualizacao estrutural em 2026-05-24: a microfatia `SongNormalHeader` extraiu o header normal da musica, mantendo metronomo, ajuda, observacao e toda a logica na `SongDetailScreen`.

Atualizacao estrutural em 2026-05-24: a microfatia `YoutubeOptionsModal` extraiu o modal visual do YouTube, mantendo abertura externa, clipboard, fallback e estados na `SongDetailScreen`.

Atualizacao estrutural em 2026-05-24: a microfatia `SongLyricsBlock` extraiu apenas o map visual das linhas da cifra, mantendo container, scroll, swipe, transposicao e motor de auto-scroll na `SongDetailScreen`.

Atualizacao estrutural em 2026-05-24: a microfatia `SongObservationBlock` extraiu apenas o bloco visual da observacao da musica, mantendo a regra de exibicao na `SongDetailScreen`.

Atualizacao estrutural em 2026-05-24: revisao pos-microfatias classificou os hooks restantes por risco e recomendou pausa antes de `SongContent`/container. Na mesma rodada, a microfatia `TomSelectorModal` extraiu apenas o modal visual de selecao de tom, mantendo estado e transposicao na `SongDetailScreen`.

Atualizacao estrutural em 2026-05-24: `useAddToPlaylist` foi extraido como primeiro hook da refatoracao da SongDetail, movendo a orquestracao do modal de adicionar/remover musicas em playlists sem tocar em scroll, swipe, auto-scroll, parser, audio, metronomo ou post-it.

Atualizacao estrutural em 2026-05-24: `useCurrentPlaylistData` foi extraido como hook estritamente de dados, movendo carregamento da playlist de origem e derivados de lista/indice/anterior/proxima sem mover navegacao, swipe, layout, refs ou gestos.

Atualizacao paralela em 2026-05-24: foi criado o ajuste global de exibicao de Pastas/Listas (`folderPlaylistDisplayMode`) com helper central `src/utils/folderPlaylistDisplay.ts`. A mudanca ficou fora da refatoracao da SongDetail: `FoldersScreen` e `FolderDetailScreen` foram migradas; `SongDetail`, `PlaylistPickerModal`, modais complexos, swipe e auto-scroll nao foram alterados.

Atualizacao experimental em 2026-05-25: `ChordLine` ganhou preview para acordes cadastrados em `src/lib/chordShapes.ts`, abrindo `src/components/modals/ChordPreviewModal.tsx`. A modelagem foi corrigida: `frets` sao casas/trastes e `fingers` sao dedos da mao. O diagrama agora usa renderer visual leve em `src/components/chords/ChordDiagram.tsx`, com labels E A D G B e, `baseFret` ordinal e pestana com casa real em `barres.fret`, sem SVG/canvas e renderizado apenas no modal. O experimento nao altera parser, transposicao, `SongLyricsBlock`, scroll, swipe, auto-scroll ou storage.

Pausa urgente em 2026-05-25: a interacao do preview experimental de acordes foi desativada por conflito intermitente de toque/gestos. `ChordLine` voltou a renderizar acordes sem `onPress`, sem estado `selectedShape` e sem `ChordPreviewModal`. Os arquivos experimentais de registry, modal e diagrama permanecem no codigo, mas nao sao acionados pela cifra.

Atualizacao paralela em 2026-05-25: foi adicionado `src/hooks/useStageKeyboardControls.ts` para atalhos de teclado fisico/pedal Bluetooth no Modo Play. A fatia reutiliza callbacks existentes da `SongDetailScreen` para auto-scroll, navegacao por playlist e Escape, sem extrair motor de auto-scroll, swipe, parser, post-it, audio ou storage.

## Status geral

A refatoracao da `SongDetailScreen` foi iniciada seguindo o plano em `docs/SONG_DETAIL_REFACTOR_PLAN.md`.

A estrategia adotada continua sendo de extracao fiel e incremental: mover uma parte pequena, manter a logica na tela principal, validar o build e seguir apenas depois de confirmar que nao houve regressao perceptivel.

Micro-refatoracao relacionada: `PlaylistPickerModal` centraliza visual, busca, estrelas, estado "Ja esta nesta lista", acao `Retirar` e estados de adicionar/remover. Os fluxos principais migrados sao `SongDetailScreen`, `SongActionsModal` (Músicas/Artistas), `PlaylistDetailScreen` e `FolderDetailScreen`.

Feature paralela relacionada a Pastas/Listas: o ajuste global `folderPlaylistDisplayMode` permite `Pastas primeiro`, `Listas primeiro` e `Misturado por nome`. Ele compoe com favoritos/estrelas usando o helper central `src/utils/folderPlaylistDisplay.ts`: em `mixed`, itens marcados aparecem primeiro A-Z e depois pastas/listas realmente misturadas A-Z. Telas ja migradas: `FoldersScreen` e `FolderDetailScreen`. Pendentes de proposito: `SongDetail`, `PlaylistPickerModal`, modais complexos de mover/enviar/adicionar, swipe e auto-scroll.

Experimento relacionado a acordes: pausado temporariamente. Acordes renderizados nao ficam clicaveis/tocaveis e nao abrem modal. O registry, `ChordPreviewModal` e `ChordDiagram` permanecem preservados para uma retomada futura, mas a prioridade agora e nao interferir com scroll, swipe, modo Play e Android/WebView. Fora do registry, como slash chords, 9, 11, 13, maj7, add e sus, o comportamento tambem segue normal e sem clique.

Validacao tecnica do ajuste de pausa: `npx tsc -b` passou em 2026-05-25. Confirmar manualmente que tocar em acordes nao abre modal, que nao aparece modal atrasado ao entrar no modo Play e que scroll/swipe seguem normais.

## Estado real confirmado

Leitura feita em 2026-05-24 nos arquivos reais:

- `src/screens/SongDetailScreen.tsx`;
- `src/screens/SongDetail/components/`;
- `docs/SONG_DETAIL_REFACTOR_PLAN.md`;
- `docs/REFATORACAO.md`;
- `docs/PROJETO_CONTEXTO.md`.

Fotografia atual:

- `src/screens/SongDetailScreen.tsx` esta com cerca de `2028` linhas.
- Existem 13 componentes extraidos em `src/screens/SongDetail/components/`.
- A tela ainda concentra cerca de 36 estados, 31 refs, 18 effects e 32 callbacks.
- Existem 2 hooks extraidos em `src/screens/SongDetail/hooks/`.
- Nao ha hooks sensiveis extraidos ainda.
- Os itens simples previstos no plano original ja foram extraidos.

| Fatia | Status | Arquivo | Observacao |
|------|--------|---------|------------|
| `MetronomeIndicators` | concluida | `src/screens/SongDetail/components/MetronomeIndicators.tsx` | Componente visual puro ja importado e usado pela `SongDetailScreen`; logica/timers/audio continuam na tela principal. |
| `RecordingMiniPlayer` | concluida | `src/screens/SongDetail/components/RecordingMiniPlayer.tsx` | Mini player visual extraido; audio, refs, estado, seek, play/pause e helpMode continuam coordenados pela `SongDetailScreen`. |
| `SongBottomToolbar` | concluida | `src/screens/SongDetail/components/SongBottomToolbar.tsx` | Barra inferior normal ja extraida; handlers, estados e highlights continuam na `SongDetailScreen`. |
| `CurrentPlaylistModal` | concluida | `src/screens/SongDetail/components/CurrentPlaylistModal.tsx` | Modal de lista atual ja extraido; navegacao e estado continuam na `SongDetailScreen`. |
| `Adicionar a lista` | hook + componente comum | `src/screens/SongDetail/hooks/useAddToPlaylist.ts` e `src/components/modals/PlaylistPickerModal.tsx` | O modal visual continua reutilizavel; busca, regras, adicionar/retirar, estrelas e persistencia foram movidos para `useAddToPlaylist`; `helpMode` continua na tela. |
| `QuickControlsModal` | concluida | `src/screens/SongDetail/components/QuickControlsModal.tsx` | Modal visual de controles rapidos ja extraido; engine do auto-scroll e handlers continuam na `SongDetailScreen`. |
| `HelpModeOverlay` | concluida | `src/screens/SongDetail/components/HelpModeOverlay.tsx` | Overlay/card visual da ajuda ja extraido; itens, estado, interceptacoes e TopBar continuam na `SongDetailScreen`. |
| `PlayModeHeader` | concluida | `src/screens/SongDetail/components/PlayModeHeader.tsx` | Header compacto do modo Play extraido; sair do Play, auto-scroll, Controles Rapidos, helpMode e metronomo continuam coordenados pela `SongDetailScreen`. |
| `PerformanceNote` | concluida | `src/screens/SongDetail/components/PerformanceNote.tsx` | Post-it visual extraido; drag, resize, autosave, refs, persistencia e helpMode continuam coordenados pela `SongDetailScreen`. |
| `SongNormalHeader` | concluida | `src/screens/SongDetail/components/SongNormalHeader.tsx` | Header normal da musica extraido; titulo, artista, genero e slot do metronomo foram movidos, enquanto logica do metronomo/helpMode e observacao continuam na `SongDetailScreen`. |
| `YoutubeOptionsModal` | concluida | `src/screens/SongDetail/components/YoutubeOptionsModal.tsx` | Modal visual do YouTube extraido; abertura externa, clipboard, fallback, estado de copia e helpMode continuam na `SongDetailScreen`. |
| `SongLyricsBlock` | concluida | `src/screens/SongDetail/components/SongLyricsBlock.tsx` | Renderizacao visual das linhas da cifra extraida; recebe texto ja transposto, fonte e settings, enquanto container, scroll, swipe e transposicao continuam na `SongDetailScreen`. |
| `SongObservationBlock` | concluida | `src/screens/SongDetail/components/SongObservationBlock.tsx` | Bloco visual da observacao extraido; condicao de exibicao e texto trimado continuam na `SongDetailScreen`. |
| `TomSelectorModal` | concluida | `src/screens/SongDetail/components/TomSelectorModal.tsx` | Modal visual de selecao de tom extraido; `tomOpen`, `selectedTom`, `keyOptions`, fechamento e transposicao continuam na `SongDetailScreen`. |
| `useCurrentPlaylistData` | concluida | `src/screens/SongDetail/hooks/useCurrentPlaylistData.ts` | Hook de dados da lista atual; carrega playlist de origem e deriva lista, nome, indice e anterior/proxima, enquanto `navigateToIndex`, swipe, layout e gestos continuam na tela. |
| `SongContent` | pendente sensivel | - | Ainda deve aguardar: envolve container com `scrollRef`, scroll real da cifra, eventos de swipe e sincronizacao visual. |

## Checklist da refatoracao SongDetail

- [x] MetronomeIndicators
- [x] SongBottomToolbar
- [x] CurrentPlaylistModal
- [x] Adicionar a lista via PlaylistPickerModal
- [x] QuickControlsModal
- [x] HelpModeOverlay
- [x] RecordingMiniPlayer
- [x] PlayModeHeader
- [x] PerformanceNote
- [x] SongNormalHeader
- [x] YoutubeOptionsModal
- [x] SongLyricsBlock
- [x] SongObservationBlock
- [x] TomSelectorModal
- [ ] SongContent
- [x] useCurrentPlaylistData
- [x] useAddToPlaylist
- [ ] useSwipeNavigation
- [ ] useSongRecording
- [ ] useAutoScroll

### Proxima recomendacao

Recomendacao atual: validar `useAddToPlaylist`, `useCurrentPlaylistData` e as microfatias visuais recentes; depois, pausar antes de novos hooks sensiveis ou container principal.

Motivo:

- `SongLyricsBlock` foi visual e isolado, mas fica dentro do container sensivel da cifra;
- `SongObservationBlock` e visual e fora do scroll, mas precisa ser conferido em musicas com/sem observacao;
- `TomSelectorModal` e visual, mas toca o fluxo de tom/transposicao por callback;
- `useAddToPlaylist` toca storage e estado de modal/listas, mas nao toca scroll, swipe, auto-scroll, audio, parser ou post-it;
- `useCurrentPlaylistData` toca dados derivados da playlist atual, mas nao controla navegacao, swipe, layout, refs ou gestos;
- `SongContent` completo ainda concentra container com `scrollRef`, scroll real, eventos de swipe e sincronizacao visual;
- hooks como `useAutoScroll` e `useSwipeNavigation` ainda devem aguardar por serem areas sensiveis;
- uma microfatia opcional como `PlaylistSwipeControls` poderia reduzir JSX, mas toca a area de swipe, portanto nao e a recomendacao padrao.

Validacao recomendada antes da proxima extracao:

- modo Play;
- auto-scroll com intervencao manual;
- swipe entre musicas de playlist;
- mini player de gravacao;
- Controles Rapidos;
- Modo Ajuda;
- post-it extraido, incluindo abrir, mover, redimensionar, trocar cor, ocultar, excluir e autosave;
- Android/WebView, principalmente por envolver scroll, overlays, audio e gestos.

Depois dessa validacao, a recomendacao estrategica e pausar a refatoracao estrutural. O nome `useCurrentPlaylistData` deve ser preservado para deixar claro que navegacao, swipe e gestos nao pertencem a esse hook. `SongContent`, `SongBodyContainer`, `PlaylistSwipeControls`, `useAutoScroll`, `useSwipeNavigation` e hooks sensiveis continuam fora ate a validacao manual confirmar que as microfatias recentes seguem estaveis.

Arquivos envolvidos na proxima fatia:

- `src/screens/SongDetailScreen.tsx`;
- arquivo do proximo componente a ser definido apos validacao;
- `docs/SONG_DETAIL_REFACTOR_PROGRESS.md`;

Riscos da proxima fatia:

- nao alterar renderizacao de `ChordLine`;
- nao alterar scroll real da cifra;
- nao alterar eventos de swipe/touch/pointer;
- nao alterar container principal ou padding dinamico;
- nao alterar parser, transposicao, armazenamento ou modelos;
- nao alterar clipboard, link externo, parser, transposicao, swipe, auto-scroll, audio ou storage.

## Primeira fatia concluida

Fatia concluida: `MetronomeIndicators`.

Novo componente:

```txt
src/screens/SongDetail/components/MetronomeIndicators.tsx
```

### O que foi movido

- JSX visual dos indicadores discretos do metronomo.
- Estilos locais dos indicadores.
- Renderizacao do indicador visual.
- Renderizacao do botao de beep sonoro.
- Props explicitas para estados e handlers.
- Handlers recebidos por props, sem acesso direto a estado global, storage ou contexto.

### O que nao foi movido

- Timers do metronomo.
- Audio e desbloqueio de audio.
- Estados `metronomeVisualOn`, `metronomeSoundOn` e `metronomePulse`.
- Refs do metronomo.
- Logica de toggle.
- `useEffect` do metronomo.
- Persistencia em storage.
- Logica de `helpMode`.

### Validacao

- `npx tsc -b` passou.
- Indicadores continuam renderizados no modo normal e no modo Play pelo mesmo ponto visual.

## Segunda fatia concluida

Fatia concluida: `SongBottomToolbar`.

Novo componente:

```txt
src/screens/SongDetail/components/SongBottomToolbar.tsx
```

### O que foi movido

- JSX visual da barra inferior normal da musica.
- Organizacao visual dos botoes da toolbar.
- Estilos locais da toolbar, incluindo container, botoes, estado ativo do post-it, botao vermelho do YouTube e botao de tom.
- Icones da toolbar.
- Props explicitas para estados, flags, handlers e highlights do Modo Ajuda.

### O que nao foi movido

- Logica de Play.
- Logica de gravacao e mini player.
- Logica do YouTube e modal de opcoes.
- Logica de transposicao e fonte.
- Logica de adicionar a lista.
- Logica de post-it.
- `runOrExplain`, `helpMode` e textos de ajuda.
- Navegacao e abertura do editor.

### Resultado

- `SongDetailScreen.tsx` ficou menor.
- A ordem dos botoes foi preservada.
- O comportamento esperado da toolbar permaneceu equivalente.
- A extracao nao alterou storage, model, parser, auto-scroll, swipe, post-it, modo Play, gravacao ou YouTube.
- Nenhuma regressao de build foi encontrada na validacao executada.

### Validacao

- `npx tsc -b` passou.
- A toolbar continua renderizada somente fora do modo Play e quando `controlsVisible` esta ativo.
- Testes manuais recomendados para confirmar em app/web:
  - abrir musica;
  - tocar Play;
  - tocar gravacao quando houver audio;
  - abrir modal do YouTube quando houver link;
  - usar A- e A+;
  - abrir selecao de tom;
  - adicionar a lista;
  - abrir post-it;
  - abrir editor;
  - testar Modo Ajuda na toolbar.

## Terceira fatia concluida

Fatia concluida: `CurrentPlaylistModal`.

Novo componente:

```txt
src/screens/SongDetail/components/CurrentPlaylistModal.tsx
```

### O que foi movido

- JSX visual do modal de lista atual.
- Estrutura `AppModal`, `ScrollView` e `FlatList`.
- Renderizacao das linhas da lista atual.
- Destaque visual da musica atual.
- Textos, botao `Fechar` e estado vazio.
- Estilos locais do modal e das linhas da lista.

### O que nao foi movido

- Estado `listModalOpen`.
- Nome/lista atual calculados pela `SongDetailScreen`.
- Navegacao ao tocar em uma musica.
- `navigateToIndex`.
- Regras de playlist, swipe ou modo Play.
- `helpMode` e regra de ocultar modal durante ajuda.

### Resultado

- `SongDetailScreen.tsx` ficou menor.
- O modal continua sendo controlado pela tela principal.
- A ordem da lista e o destaque da musica atual foram preservados.
- A extracao nao alterou storage, model, parser, auto-scroll, swipe, post-it, modo Play, gravacao ou YouTube.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir `Lista atual`;
  - fechar modal;
  - selecionar musica na lista;
  - confirmar destaque da musica atual;
  - abrir pelo modo Play;
  - validar scroll do modal em lista longa.

## Quarta fatia concluida e posteriormente consolidada

Fatia original concluida: `AddToPlaylistModal`.

Estado atual apos a micro-refatoracao de playlists:

```txt
src/components/modals/PlaylistPickerModal.tsx
```

O componente local `src/screens/SongDetail/components/AddToPlaylistModal.tsx` foi removido quando o fluxo da `SongDetailScreen` passou a usar o componente comum `PlaylistPickerModal`.

### O que ficou padronizado

- JSX visual do modal `Adicionar a lista`.
- Estrutura `AppModal`, busca e `ScrollView`.
- Renderizacao dos cards de playlists.
- Estado visual `Ja esta nesta lista`.
- Acao visual `Retirar`.
- Botao/texto `Adicionar` ou `Enviar`, conforme contexto.
- Icones, textos e estados visuais locais.
- Estilos locais do modal.

### O que nao foi movido

- Estado de abertura do modal.
- Query de busca.
- Lista de playlists e pastas carregadas.
- Filtro `visibleAddToPlaylistOptions`.
- Regras para saber se a playlist ja contem a musica.
- Handlers de adicionar e retirar musica da lista.
- Persistencia em storage.
- `helpMode` e regra de ocultar modal durante ajuda.

### Resultado

- `SongDetailScreen.tsx` ficou menor.
- O modal continua sendo controlado pela tela principal, mas agora compartilha o mesmo componente usado por `SongActionsModal`, `PlaylistDetailScreen` e `FolderDetailScreen`.
- Busca, adicionar, retirar e estado visual de playlist ja adicionada foram preservados.
- A extracao nao alterou storage, model, parser, auto-scroll, swipe, post-it, modo Play, gravacao ou YouTube.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir `Adicionar a lista`;
  - buscar lista;
  - adicionar musica em uma lista;
  - confirmar que nao duplica;
  - retirar musica de uma lista;
  - fechar modal;
  - testar com lista em modo roteiro quando aplicavel.

## Quinta fatia concluida

Fatia concluida: `QuickControlsModal`.

Novo componente:

```txt
src/screens/SongDetail/components/QuickControlsModal.tsx
```

### O que foi movido

- JSX visual do modal `Controles Rapidos`.
- Estrutura `AppModal` e `ScrollView` do modal.
- Grupos visuais de navegacao, lista atual, exibicao, auto-scroll e gravacao.
- Renderizacao dos presets `V1` a `V8`.
- Botao visual de velocidade personalizada.
- Botao `Ver Lista Atual`.
- Controles visuais `A-`, `A+`, tom atual e mostrar/ocultar botoes.
- Area visual do mini player de gravacao quando ha audio.
- Estilos locais do modal de controles rapidos.

### O que nao foi movido

- Engine do auto-scroll.
- `requestAnimationFrame`, refs, timers e sincronizacao manual do scroll.
- Estado de velocidade, preset e velocidade personalizada.
- Handlers `selectAutoScrollPreset`, `openCustomAutoScroll` e `saveCustomAutoScroll`.
- Logica de navegacao entre musicas.
- Logica do mini player/audio.
- Estado e logica de `helpMode`.
- Modal separado de velocidade personalizada.
- Qualquer persistencia, storage, parser, swipe, post-it ou modo Play.

### Resultado

- `SongDetailScreen.tsx` ficou menor.
- O modal continua sendo controlado pela tela principal.
- O auto-scroll permanece com a mesma implementacao e os mesmos handlers.
- A extracao nao alterou storage, model, parser, auto-scroll, swipe, post-it, modo Play, gravacao ou YouTube.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir `Controles Rapidos`;
  - navegar para anterior/proxima;
  - abrir `Lista atual`;
  - usar `A-`, `A+` e tom atual;
  - alternar mostrar/ocultar botoes;
  - selecionar presets `V1` a `V8`;
  - abrir velocidade personalizada;
  - confirmar mini player quando houver gravacao.

## Sexta fatia concluida

Fatia concluida: `HelpModeOverlay`.

Novo componente:

```txt
src/screens/SongDetail/components/HelpModeOverlay.tsx
```

### O que foi movido

- Visual do overlay escuro do Modo Ajuda.
- Card centralizado de explicacao.
- Renderizacao de icone, titulo e descricao do item ativo.
- Botao `Entendi`.
- Botao `X` para fechar apenas o card.
- Botao `Sair da ajuda`.
- Estilos locais do overlay, card e botoes da ajuda.

### O que nao foi movido

- Estado `helpMode`.
- Estado `activeHelpTarget`.
- Mapa `SONG_DETAIL_HELP_ITEMS`.
- Helper `runOrExplain`.
- Logica de entrar/sair da ajuda.
- Fechamento de modais ao entrar na ajuda.
- Integracao com `TopBarContext`/`AppHeader`.
- Interceptacao dos botoes reais.
- Highlights de botoes ajudaveis.

### Resultado

- `SongDetailScreen.tsx` ficou menor.
- A tela principal continua dona de toda a logica do Modo Ajuda.
- O componente novo recebe somente props explicitas.
- A extracao nao alterou AppHeader, TopBarContext, storage, model, parser, auto-scroll, swipe, post-it, modo Play, gravacao ou YouTube.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - ativar ajuda;
  - tocar em botoes inferiores;
  - tocar em menu/voltar/olho no header;
  - confirmar card centralizado;
  - confirmar que `Entendi` e `X` fecham apenas o card;
  - confirmar que `Sair da ajuda` encerra o modo ajuda;
  - confirmar que o botao `?` do header alterna ajuda.

## Setima fatia concluida

Fatia concluida: `RecordingMiniPlayer`.

Novo componente:

```txt
src/screens/SongDetail/components/RecordingMiniPlayer.tsx
```

### O que foi movido

- JSX visual do mini player de gravacao.
- Container visual fixo e inline.
- Botao play/pause.
- Linha de titulo e tempo atual/duracao.
- Barra visual de progresso.
- Input range visual para seek.
- Botao de fechar/ocultar mini player.
- Icones e estilos locais do mini player.
- Formatacao visual do tempo exibido.

### O que nao foi movido

- Estado do audio.
- `audioNoteRef` e `audioContextRef`.
- Criacao/preparo do `HTMLAudioElement`.
- Handlers `toggleAudioNote`, `seekAudioNote` e `closeAudioNotePlayer`.
- Calculo de progresso, duracao segura e visibilidade.
- Integracao com `helpMode`.
- Qualquer permissao, audio real, storage, timers ou listeners.

### Resultado

- `SongDetailScreen.tsx` ficou menor.
- O mini player continua controlado pela tela principal.
- O componente novo recebe estados, valores calculados, callbacks e highlights por props explicitas.
- A extracao nao alterou gravacao, audio, storage, model, parser, auto-scroll, swipe, post-it, modo Play ou YouTube.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir musica sem gravacao e confirmar ausencia do mini player;
  - abrir musica com gravacao e confirmar mini player;
  - tocar play/pause;
  - usar seek;
  - fechar/ocultar mini player;
  - testar Modo Ajuda no mini player;
  - validar no Android/WebView por envolver audio.

## Oitava fatia concluida

Fatia concluida: `PlayModeHeader`.

Novo componente:

```txt
src/screens/SongDetail/components/PlayModeHeader.tsx
```

### O que foi movido

- JSX visual do header compacto do modo Play.
- Container/header fixo superior.
- Titulo e artista da musica atual.
- Area de acoes do header.
- Botao visual de auto-scroll com estado ativo.
- Botao visual de `Controles Rapidos`.
- Botao visual de sair do modo Play.
- Estilos locais do header compacto e botoes.

### O que nao foi movido

- Estado `isPlaying`.
- `startPlaying`/`stopPlaying`.
- Engine e handlers do auto-scroll.
- Estado e logica dos Controles Rapidos.
- Estado e logica de `helpMode`.
- Indicadores/logica do metronomo.
- Swipe, timers, refs ou navegacao.
- Header global, `AppHeader` ou `TopBarContext`.

### Resultado

- `SongDetailScreen.tsx` ficou menor.
- A tela principal continua dona da logica do modo Play.
- O componente novo recebe titulo, artista, slot de metronomo, callbacks e highlights por props explicitas.
- A extracao nao alterou modo Play, swipe, auto-scroll, controles rapidos, helpMode, post-it, gravacao ou Android/WebView.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - entrar no modo Play;
  - sair do modo Play;
  - acionar auto-scroll;
  - abrir `Controles Rapidos`;
  - ativar Modo Ajuda e tocar nos botoes do header compacto;
  - confirmar swipe e auto-scroll sem regressao.

## Nona fatia concluida

Fatia concluida: `PerformanceNote`.

Novo componente:

```txt
src/screens/SongDetail/components/PerformanceNote.tsx
```

### O que foi movido

- JSX visual do post-it.
- Overlay fixo do post-it.
- Card com pin, menu, botao ocultar, header arrastavel, textarea, status de autosave e resize handle.
- Menu de cores e botao `Excluir anotacao`.
- Icones do post-it.
- Estilos locais do post-it.
- Helpers visuais de card, overlay, textarea e botoes de cor.

### O que nao foi movido

- Estados do post-it.
- Refs de card, texto, posicao, tamanho, drag e resize.
- Autosave e persistencia.
- Normalizacao de cor, posicao e tamanho.
- Clamp de posicao/tamanho.
- Handlers de drag e resize.
- Callbacks de ocultar, excluir, trocar cor e editar texto.
- Integracao com `helpMode`, swipe e auto-scroll.

### Resultado

- `SongDetailScreen.tsx` ficou menor, com cerca de `2287` linhas apos a extracao.
- A tela principal continua dona da logica sensivel do post-it.
- O componente novo recebe estado, refs, callbacks e highlights por props explicitas.
- A extracao nao alterou storage, model, autosave, drag, resize, swipe, auto-scroll, modo Play ou Android/WebView.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir post-it;
  - editar texto e observar autosave;
  - mover;
  - redimensionar;
  - trocar cor;
  - ocultar com X;
  - excluir anotacao;
  - entrar/sair modo Play;
  - ligar/desligar auto-scroll;
  - confirmar que swipe nao dispara durante drag/resize;
  - ativar Modo Ajuda e confirmar que explica sem executar acoes reais;
  - validar no Android/WebView por envolver overlay, pointer/touch, drag, resize e textarea.

## Decima fatia concluida

Fatia concluida: `SongNormalHeader`.

Novo componente:

```txt
src/screens/SongDetail/components/SongNormalHeader.tsx
```

### O que foi movido

- JSX visual do header normal da musica, fora do modo Play.
- Titulo, artista e badge de genero.
- Layout horizontal do header normal.
- Estilos locais do header normal.
- Slot visual para os indicadores do metronomo.

### O que nao foi movido

- Logica/timers/audio do metronomo.
- Estados `metronomeVisualOn`, `metronomeSoundOn` e `metronomePulse`.
- Handlers `toggleMetronomeVisual` e `toggleMetronomeSound`.
- `runOrExplain`, `helpMode` e highlights da ajuda.
- Observacao da musica.
- `ChordLine`, scroll, swipe, auto-scroll, post-it, audio, storage ou navegacao.

### Resultado

- `SongDetailScreen.tsx` ficou menor, com cerca de `2283` linhas apos a extracao.
- A tela principal continua dona da logica sensivel do metronomo e da ajuda.
- O componente novo recebe textos, estilos e slot de metronomo por props explicitas.
- A extracao nao alterou storage, model, parser, renderizacao da cifra, auto-scroll, swipe, post-it, modo Play, gravacao ou YouTube.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir musica fora do modo Play;
  - confirmar titulo, artista e genero;
  - confirmar observacao da musica abaixo do header quando existir;
  - alternar pulso visual e beep do metronomo;
  - ativar Modo Ajuda nos botoes do metronomo.

## Decima primeira fatia concluida

Fatia concluida: `YoutubeOptionsModal`.

Novo componente:

```txt
src/screens/SongDetail/components/YoutubeOptionsModal.tsx
```

### O que foi movido

- JSX visual do modal `YouTube da musica`.
- Estrutura `AppModal`, cabecalho, icone e rodape `Fechar`.
- Bloco visual de titulo/artista da musica.
- Bloco visual com URL do YouTube.
- Botao visual `Player no app` desabilitado.
- Botao visual `Abrir no YouTube`.
- Botao visual `Copiar link da musica`.
- Estilos locais do modal.

### O que nao foi movido

- Estado `youtubeModalOpen`.
- Estado `youtubeLinkCopied`.
- Validacao de URL disponivel para abrir o modal.
- Handler `openYoutubeLink`, incluindo `window.open` e fallback.
- Handler `copyYoutubeLink`, incluindo clipboard e fallback por textarea.
- Fechamento/reset do modal.
- Integracao com `helpMode`.
- Qualquer regra Android/WebView, navegacao, storage ou modelo.

### Resultado

- `SongDetailScreen.tsx` ficou menor, com cerca de `2158` linhas apos a extracao.
- A tela principal continua dona de toda a logica do YouTube.
- O componente novo recebe texto, URL, estado de copia e callbacks por props explicitas.
- A extracao nao alterou storage, model, parser, renderizacao da cifra, auto-scroll, swipe, post-it, modo Play, gravacao ou playlists.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir modal do YouTube em musica com link;
  - confirmar que musica sem `youtubeUrl` continua sem botao na toolbar;
  - tocar `Player no app` e confirmar que segue desabilitado;
  - abrir no YouTube;
  - copiar link;
  - fechar modal;
  - ativar Modo Ajuda e confirmar que o modal continua oculto durante a ajuda;
  - validar no Android/WebView por envolver link externo e clipboard.

## Analise de SongContent

Analise feita em 2026-05-24 antes da primeira subfatia do conteudo.

### Estrutura atual confirmada

- O header normal ja esta fora em `SongNormalHeader`.
- A observacao da musica permanece fora do container de scroll, logo abaixo do header normal.
- O container sensivel da cifra e o `div` com `ref={scrollRef}`, `style={songScrollStyle}`, `onScroll` e handlers `onPointer*`/`onTouch*`.
- A renderizacao das linhas da cifra agora esta em `SongLyricsBlock`, dentro do mesmo `div`, sem wrapper adicional.
- Os botoes anterior/proxima da playlist continuam fora do `div`, com `data-swipe-ignore` e `runOrExplain('swipe')`.

### Dependencias acopladas

- Auto-scroll depende de `window.scrollY`, `window.scrollTo`, acumuladores, timers e listeners globais.
- O reset/posicionamento auxiliar ainda usa `scrollRef`, `getScrollNode`, `getScrollableDomNode` e `scrollToPosition`.
- Swipe depende da arvore visual, dos handlers pointer/touch no `div`, de `playlistSwipeRef`, de `noteDragRef` e de `noteResizeRef`.
- O padding do container depende de `isPlaying`, `showPlaylistControls`, `controlsVisible` e `audioNotePlayerVisible`.
- `text` ja chega transposto por `transposeContent`; parser, tom e transposicao permanecem na tela principal.

### Subfatias possiveis

- `SongLyricsBlock`: concluida como primeira subfatia segura; move apenas o map das linhas e importa `ChordLine`.
- `SongObservationBlock`: possivel microfatia futura de baixo risco, mas nao reduz o acoplamento do conteudo sensivel.
- `SongBodyContainer`, `SongContent` completo e `PlaylistSwipeControls`: devem aguardar porque tocam refs, scroll, swipe, padding, overlays ou `data-swipe-ignore`.

## Decima segunda fatia concluida

Fatia concluida: `SongLyricsBlock`.

Novo componente:

```txt
src/screens/SongDetail/components/SongLyricsBlock.tsx
```

### O que foi movido

- Map visual de `text.split('\n')`.
- Import e uso de `ChordLine`.
- Props explicitas para `text`, `fontSize` e `settings`.
- Renderizacao das linhas da cifra sem wrapper DOM adicional.

### O que nao foi movido

- Container `div` da cifra.
- `scrollRef`, `scrollPosRef` e `songScrollStyle`.
- `onScroll`, handlers pointer/touch e swipe.
- `window.scrollY`, `window.scrollTo`, requestAnimationFrame, timers ou listeners globais.
- Transposicao, parser, tom, `ChordLine` internals, post-it, overlays, helpMode, storage ou playlists.

### Resultado

- `SongDetailScreen.tsx` ficou menor, com cerca de `2156` linhas apos a extracao.
- A tela principal continua dona de todo o motor sensivel de scroll, swipe, auto-scroll e transposicao.
- A extracao nao alterou a arvore do container de scroll nem adicionou wrapper ao redor das linhas.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir musica normal e conferir a cifra;
  - transpor tom e conferir acordes;
  - alterar A-/A+;
  - entrar no modo Play;
  - usar auto-scroll com intervencao manual;
  - usar swipe entre musicas de playlist;
  - confirmar post-it, mini player e Modo Ajuda sem regressao;
  - validar Android/WebView antes de mexer no container do conteudo.

## Decima terceira fatia concluida

Fatia concluida: `SongObservationBlock`.

Novo componente:

```txt
src/screens/SongDetail/components/SongObservationBlock.tsx
```

### O que foi movido

- JSX visual da observacao da musica.
- Estilos locais da observacao.
- Texto visual em italico com o mesmo spacing anterior.

### O que nao foi movido

- Condicao `song.observation?.trim()`.
- Calculo/texto trimado enviado para exibicao.
- Header normal, modo Play, `SongLyricsBlock`, `ChordLine` ou container da cifra.
- Scroll, swipe, auto-scroll, pointer/touch handlers, parser, transposicao, overlays, playlists, post-it ou helpMode.

### Resultado

- `SongDetailScreen.tsx` esta com cerca de `2157` linhas apos a extracao.
- A tela principal continua dona da regra de quando mostrar observacao.
- A posicao visual permanece a mesma: abaixo do `SongNormalHeader`, fora do modo Play e fora do container de scroll da cifra.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir musica com observacao;
  - abrir musica sem observacao;
  - entrar no modo Play e confirmar ausencia do bloco normal;
  - ativar Modo Ajuda;
  - conferir scroll e swipe sem regressao;
  - validar Android/WebView basico.

## Revisao estrutural pos-microfatias

Revisao feita em 2026-05-24 depois das extracoes visuais seguras.

### Fotografia atual

- `SongDetailScreen.tsx` esta com cerca de `2028` linhas.
- A tela ainda concentra aproximadamente 36 estados, 31 refs, 18 effects e 32 callbacks.
- As partes visuais simples principais ja foram extraidas.
- O que sobra e majoritariamente orquestracao: dados, storage, timers, refs, DOM/window, audio, navegacao e integracao entre recursos.

### Blocos ainda acoplados

- Container principal da cifra: `scrollRef`, `songScrollStyle`, `onScroll`, pointer/touch e padding dinamico.
- Auto-scroll: `window.scrollY`, `window.scrollTo`, `requestAnimationFrame`, timers, listeners globais e sincronizacao manual.
- Swipe: `playlistSwipeRef`, `data-swipe-ignore`, `helpMode`, `nav.replace` e interacao com drag/resize do post-it.
- Post-it: autosave, persistencia, drag, resize, refs e clamp de posicao/tamanho.
- Audio/metronomo: `HTMLAudioElement`, `AudioContext`, timers, permissao/gesto do usuario e cleanup.

### Risco dos hooks

| Hook | Risco | Justificativa |
|------|-------|---------------|
| `useAddToPlaylist` | concluido | Primeiro hook extraido; toca storage e estado do modal, mas nao toca scroll, swipe, audio, parser ou Android/WebView sensivel. |
| `useCurrentPlaylistData` | concluido | Hook limitado a dados; carrega a playlist de origem e deriva lista atual, nome, indice, anterior/proxima e disabled, sem controlar navegacao ou swipe. |
| Hook amplo de playlist atual | adiado/alto | Nao deve ser criado agora sem o sufixo `Data`, para evitar misturar dados com `navigateToIndex`, `nav.replace`, swipe e gestos. |
| `useSongRecording` | medio/alto | Envolve `HTMLAudioElement`, eventos de audio, gesto do usuario e cleanup. |
| `useSwipeNavigation` | alto | Depende de pointer/touch, `data-swipe-ignore`, post-it drag/resize, helpMode e `nav.replace`. |
| `useAutoScroll` | critico | Motor usa `window.scrollY`/`window.scrollTo`, RAF, timers, listeners globais e sincronizacao manual. |

### Recomendacao estrategica

- Vale pausar a refatoracao estrutural depois de validar as microfatias visuais.
- `useCurrentPlaylistData` ja cobre a parte segura de dados; qualquer hook que puxe navegacao ou swipe deve ficar congelado.
- `SongContent` completo, container principal, swipe e auto-scroll devem permanecer congelados temporariamente.

## Decima quarta fatia concluida

Fatia concluida: `TomSelectorModal`.

Novo componente:

```txt
src/screens/SongDetail/components/TomSelectorModal.tsx
```

### O que foi movido

- JSX visual do modal `Selecionar tom`.
- Grid visual dos tons disponiveis.
- Botao visual `Fechar`.
- Estilos locais do modal de tom.

### O que nao foi movido

- Estado `tomOpen`.
- Estado `selectedTom`.
- Calculo de `keyOptions`.
- Callback que seleciona o tom e fecha o modal.
- Transposicao, parser, `ChordLine`, storage, swipe, auto-scroll, helpMode ou Android/WebView.

### Resultado

- `SongDetailScreen.tsx` ficou menor, com cerca de `2135` linhas apos a extracao.
- A tela principal continua dona da logica de tom/transposicao.
- A extracao nao alterou layout, textos, ordem visual ou comportamento do modal.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir modal de tom;
  - selecionar tom;
  - fechar modal;
  - confirmar transposicao visual da cifra;
  - testar com preferencia de grafia de acordes;
  - confirmar Modo Ajuda e modo Play sem regressao.

## Decima quinta fatia concluida

Fatia concluida: `useAddToPlaylist`.

Novo hook:

```txt
src/screens/SongDetail/hooks/useAddToPlaylist.ts
```

### O que foi movido

- Estados de abertura, busca, playlists, pastas e loading de adicionar/remover.
- Carregamento de playlists e folders ao abrir o modal.
- Fechamento/reset do modal.
- Filtro e ordenacao das playlists visiveis.
- Helpers de caminho da pasta, subtitulo e contagem de musicas.
- Regras `playlistAlreadyHasSong`, adicionar, remover e alternar estrela.
- Persistencia existente via `db.addSongToPlaylist`, `db.removeSongFromPlaylist` e `db.savePlaylists`.

### API atual do hook

- Entrada: `song` e `favoriteMode`.
- Saida: `open`, `query`, `visiblePlaylists`, `addingToPlaylistId`, `removingFromPlaylistId`, `contextText`, `showStars`, `setQuery`, `openModal`, `closeModal`, `playlistAlreadyHasSong`, `getPlaylistSubtitle`, `addCurrentSongToPlaylist`, `removeCurrentSongFromPlaylist` e `togglePlaylistStar`.

### O que nao foi movido

- `PlaylistPickerModal`.
- `helpMode` e a regra `visible={addToPlaylist.open && !helpMode}`.
- Textos/labels do modal.
- Storage/model ou metodos de `db`.
- Scroll, swipe, auto-scroll, parser, audio, metronomo, post-it, modo Play ou Android/WebView.

### Resultado

- `SongDetailScreen.tsx` ficou menor, com cerca de `2045` linhas apos a extracao.
- A tela principal continua dona da integracao visual com `PlaylistPickerModal` e do bloqueio por `helpMode`.
- `useAddToPlaylist` se tornou o primeiro hook extraido da SongDetail.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados para confirmar em app/web:
  - abrir modal `Adicionar a lista`;
  - buscar playlist;
  - adicionar musica a playlist;
  - remover musica de playlist;
  - alternar estrela de playlist;
  - confirmar que musica ja adicionada nao duplica;
  - fechar e reabrir com busca limpa;
  - testar `favoriteMode` desativado, unico e multiplo;
  - confirmar que `helpMode` continua ocultando o modal.

## Proximas fatias sugeridas

- Validar manualmente `SongLyricsBlock`, `SongObservationBlock`, `TomSelectorModal`, `useAddToPlaylist` e `useCurrentPlaylistData`.
- Pausar a refatoracao estrutural se o ganho imediato nao justificar o risco.
- Se continuar em hooks, evitar nome amplo sem `Data`; a parte segura ja ficou em `useCurrentPlaylistData`.
- `SongContent`, `SongBodyContainer`, `PlaylistSwipeControls`, `useAutoScroll`, `useSwipeNavigation` e hooks sensiveis continuam congelados.

## Observacao importante

As dezesseis primeiras fatias confirmam que a estrategia de extracao fiel e incremental pode reduzir a `SongDetailScreen` sem mudar o comportamento observavel dos recursos extraidos.

## Decima sexta fatia concluida

Fatia concluida: `useCurrentPlaylistData`.

Novo hook:

```txt
src/screens/SongDetail/hooks/useCurrentPlaylistData.ts
```

### O que foi movido

- Estado interno da playlist de origem.
- Estado interno do indice atual.
- Carregamento de `db.byPlaylist(sourcePlaylistId)`.
- Derivados `currentSongList`, `currentListName`, `previousPlaylistIndex`, `nextPlaylistIndex`, `previousPlaylistSong`, `nextPlaylistSong`, `previousDisabled` e `nextDisabled`.

### O que nao foi movido

- `navigateToIndex`.
- `nav.replace`.
- Fechamento de modais antes da navegacao.
- `playlistSwipeEnabled`, `showPlaylistControls` e visibilidade dos controles.
- `playlistSwipeRef`, `data-swipe-ignore` e handlers pointer/touch.
- `runOrExplain('swipe', ...)`.
- `songScrollStyle`, padding dinamico, auto-scroll, post-it, timers, refs e layout sensivel.

### Resultado

- `SongDetailScreen.tsx` ficou com cerca de `2028` linhas.
- O nome final ficou `useCurrentPlaylistData` para deixar explicito que o hook nao controla navegacao, swipe ou gestos.
- A tela principal continua dona da navegacao por indice e da integracao com QuickControls, CurrentPlaylistModal e swipe.

### Validacao

- `npx tsc -b` passou.
- Testes manuais recomendados:
  - abrir musica fora de playlist;
  - abrir musica a partir de playlist;
  - conferir `Lista Atual` e destaque da musica;
  - navegar via `CurrentPlaylistModal`;
  - navegar via anterior/proxima no `QuickControlsModal`;
  - testar swipe no modo Play;
  - confirmar auto-scroll, post-it e padding sem regressao.
