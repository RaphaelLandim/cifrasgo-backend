# Plano futuro de refatoracao da SongDetailScreen

Atualizado em: 2026-05-20

## Objetivo

Reduzir o tamanho e o risco de manutencao de `src/screens/SongDetailScreen.tsx` sem mudar comportamento. A tela funciona e concentra fluxos sensiveis; portanto a refatoracao futura deve ser fiel, incremental e validada em cada fatia.

A meta nao e redesenhar a tela nem reescrever a experiencia. A meta e separar responsabilidades para que cada recurso possa evoluir com menos risco.

## Pre-requisitos antes de iniciar

- Criar backup do projeto.
- Garantir que `main` esteja em estado funcional.
- Fazer commit limpo antes de iniciar cada fatia.
- Não iniciar uma nova fatia se a anterior ainda não foi testada.
- Preferir commits pequenos e descritivos, por exemplo:
  - `extrai indicadores do metronomo da SongDetail`
  - `extrai modal de lista atual da SongDetail`
  - `extrai barra inferior da SongDetail`

## Regras de seguranca

- Nao refatorar tudo de uma vez.
- Nao mudar `storage`, modelos, chaves persistidas ou formato de dados.
- Nao mudar parser, transposicao ou renderizacao de acordes.
- Nao mudar o motor do auto-scroll: ele usa `window.scrollY` e `window.scrollTo`.
- Nao mudar comportamento de swipe, post-it, modo Play, metronomo, gravacao ou modais.
- Nao ativar navigator novo como parte desta refatoracao.
- Nao adicionar dependencias.
- Nao misturar redesign visual com extracao estrutural grande.
- Cada fatia precisa passar `npx tsc -b`.
- Cada fatia precisa ser testada no web e, quando envolver gesto/scroll/audio/overlay, tambem no Android/WebView.

## Estado atual da tela

`SongDetailScreen.tsx` tem cerca de 3442 linhas e concentra:

- carregamento da musica e listas relacionadas;
- renderizacao da cifra com `ChordLine`;
- transposicao visual e selecao de tom;
- ajuste de fonte por musica;
- modo Play/apresentacao;
- header compacto do modo Play;
- auto-scroll com presets `V1` a `V8`, velocidade personalizada e intervencao manual;
- swipe horizontal entre musicas da lista;
- Controles Rapidos;
- modal de lista atual;
- modal de adicionar musica a lista;
- post-it musical com autosave, cor, drag e resize;
- gravacao de referencia e mini player;
- metronomo visual/sonoro;
- modo ajuda interativo;
- integracao com `TopBarContext` e `AppHeader`;
- compatibilidades importantes para Android/WebView.

## Estrutura futura sugerida

Esta estrutura e uma sugestao para orientar a migracao. Ela nao deve ser tratada como contrato rigido.

```txt
src/screens/SongDetail/
  SongDetailScreen.tsx
  components/
    SongContent.tsx
    SongBottomToolbar.tsx
    PlayModeHeader.tsx
    QuickControlsModal.tsx
    CurrentPlaylistModal.tsx
    AddToPlaylistModal.tsx
    HelpModeOverlay.tsx
    PerformanceNote.tsx
    RecordingMiniPlayer.tsx
    MetronomeIndicators.tsx
  hooks/
    useAutoScroll.ts
    useSongHelpMode.ts
    useSwipeNavigation.ts
    usePerformanceNote.ts
    useSongRecording.ts
    useAddToPlaylist.ts
    useCurrentPlaylist.ts
  helpers/
    songDetailHelpers.ts
    autoScrollHelpers.ts
    helpItems.ts
  styles/
    songDetailStyles.ts
```

Se for util para compatibilidade de imports, o arquivo antigo pode virar um wrapper somente ao final da migracao:

```ts
export { default } from './SongDetail/SongDetailScreen';
```

Nao fazer esse wrapper antes da tela nova estar ativa e validada.

## Estrategia recomendada

Usar extracao fiel:

1. Escolher um trecho pequeno e funcional.
2. Copiar o JSX/logica para um componente, hook ou helper novo.
3. Passar props explicitas, mesmo que parecam muitas no inicio.
4. Manter nomes e comportamento o mais proximos possivel.
5. Rodar `npx tsc -b`.
6. Testar o fluxo manual relacionado.
7. So depois partir para a proxima fatia.

Evitar "melhorar" comportamento durante a extracao. Melhorias de UX devem ser feitas em commits/fatias separadas, antes ou depois da refatoracao.

## Ordem sugerida das fatias

### Fase 1 - Componentes visuais simples

Extrair primeiro partes com menor risco e poucas dependencias:

- `RecordingMiniPlayer`;
- `MetronomeIndicators`;
- `SongBottomToolbar`;
- `CurrentPlaylistModal`;
- `AddToPlaylistModal`.

Essas partes podem receber handlers e estado por props, sem mover ainda a logica principal.

### Fase 2 - Modais e UX

Depois de estabilizar componentes simples:

- `QuickControlsModal`;
- `HelpModeOverlay`;
- `PerformanceNote`.

Essas areas envolvem mais overlay, z-index, modais e interacao, entao devem ser extraidas uma por vez.

### Fase 3 - Hooks de dados e navegacao

Quando os componentes visuais estiverem menores:

- `useCurrentPlaylist`;
- `useAddToPlaylist`;
- `useSwipeNavigation`;
- `useSongRecording`.

Os hooks devem preservar as mesmas entradas e saidas observaveis da tela atual. Se um hook ficar grande demais, dividir apenas depois de validado.

### Fase 4 - Auto-scroll

Extrair `useAutoScroll` por ultimo entre os hooks sensiveis.

Motivo: o auto-scroll depende do scroll real do `window`, acumulador de posicao, `requestAnimationFrame`, pausa por interacao manual e comportamento de Android/WebView. Qualquer alteracao aqui precisa ser testada com musicas longas no web e no Android.

Regras especificas:

- manter `window.scrollY`/`window.scrollTo`;
- nao voltar a usar `scrollRef`, `getScrollableNode` ou `getNativeScrollRef` como motor;
- manter acumulador de posicao;
- manter sincronizacao apos scroll manual;
- manter limpeza de `requestAnimationFrame` e timers.

### Fase 5 - Limpeza final

Somente depois das extracoes principais:

- mover estilos para `styles/songDetailStyles.ts`;
- reduzir props com tipos locais quando ficar claro;
- revisar imports;
- remover helpers mortos;
- decidir se `src/screens/SongDetailScreen.tsx` vira wrapper;
- atualizar `PROJETO_CONTEXTO.md`, `docs/REFATORACAO.md` e `MANUAL_USUARIO.md`, se a estrutura final mudar.

## Riscos principais

- Auto-scroll no Android/WebView: regressao pode fazer a cifra parar, pular ou brigar com o gesto manual.
- Swipe: pode interferir com scroll vertical, post-it, mini player e botoes.
- Overlays e modais: ordem visual, z-index e toque em Android podem mudar.
- TopBar/AppHeader: ajuda, olho, voltar e menu dependem de ponte com contexto/header global.
- Post-it: drag/resize/autosave podem ficar pesados ou salvar em momentos errados.
- Gravacao e audio: Web Audio/HTMLAudio pode depender de gesto do usuario e permissao.
- Metronomo: timers e audio precisam ser limpos ao navegar.
- Transposicao/parser: nao deve ser misturado com refatoracao da tela.

## Criterios de aceite por fatia

Cada fatia deve:

- manter comportamento identico ao fluxo anterior;
- passar `npx tsc -b`;
- funcionar no web;
- funcionar no Android/WebView quando envolver gesto, audio, scroll ou modal;
- nao alterar storage/model;
- nao alterar dados salvos;
- nao criar dependencia nova;
- nao introduzir novo fluxo de navegacao;
- deixar a tela em estado utilizavel mesmo se a proxima fatia nunca acontecer.

## Checklist de testes manuais

Antes de considerar uma fatia concluida, testar os fluxos afetados e, nas fatias maiores, rodar a lista completa:

- abrir musica pela lista de musicas;
- abrir musica a partir de uma playlist;
- transpor tom;
- usar A- e A+;
- entrar e sair do modo Play;
- navegar por swipe entre musicas;
- abrir Controles Rapidos;
- abrir Lista atual;
- iniciar/parar auto-scroll;
- trocar V1 a V8;
- usar velocidade personalizada;
- rolar manualmente durante auto-scroll;
- abrir, editar, mover, redimensionar, ocultar e excluir post-it;
- tocar gravacao de referencia;
- buscar posicao no mini player;
- abrir metronomo visual/sonoro;
- adicionar musica a lista pela SongDetail;
- retirar musica de lista quando aplicavel;
- abrir e fechar modais sem overlay preso;
- usar Modo Ajuda;
- tocar menu, voltar e olho no header;
- sair da musica e voltar;
- testar em Android/WebView quando houver mudanca de gesto, audio, scroll ou overlay.

## O que nao fazer

- Nao reescrever a tela do zero.
- Nao ativar `AppNavigator` como parte desta refatoracao.
- Nao mudar UI junto com uma extracao grande.
- Nao trocar motor de auto-scroll.
- Nao mexer no parser de acordes.
- Nao alterar `storage`, modelos ou backup.
- Nao criar dependencias novas.
- Nao mover muitas responsabilidades na mesma fatia.
- Nao remover comentarios/documentacao de investigacao sem substituir por informacao equivalente.
