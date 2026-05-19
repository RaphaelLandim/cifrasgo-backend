# Auto-scroll / rollover - investigacao tecnica

## Status

Atualizado em 2026-05-18: a investigacao identificou que o scroll real da cifra, no web, e o `window`. A implementacao retomada em `SongDetailScreen` usa `window.scrollY` e `window.scrollTo`, nao `scrollRef`, `getScrollableNode` ou `getNativeScrollRef`.

O historico abaixo permanece para evitar voltar aos caminhos que nao funcionaram.

## Conclusao da retomada 2026-05-18

Diagnostico confirmado no console:

```txt
[scroll-candidate-active]
{ label: 'window', scrollHeight: 5137, clientHeight: 913 }
```

Decisao tecnica:

- o elemento real que recebe a rolagem e `window`;
- `scrollRef` continua util para contexto/diagnostico, mas nao deve dirigir o auto-scroll;
- o loop usa `requestAnimationFrame`;
- a posicao atual vem de `window.scrollY`;
- o destino e aplicado com `window.scrollTo({ top, behavior: 'auto' })`, com fallback para `window.scrollTo(0, top)`;
- o limite usa `document.documentElement.scrollHeight - window.innerHeight`.

UI retomada:

- controle visivel apenas no modal `Controles Rapidos` do modo Play;
- presets `Lento`, `Medio` e `Rapido`;
- botao `Iniciar` / `Parar`;
- parada automatica ao chegar no fim, sair da musica ou sair do modo Play.

O objetivo deste documento e evitar novas tentativas no escuro e deixar registrado tudo que ja foi investigado. Se a feature voltar a falhar, nao retomar os caminhos baseados em `scrollRef`; comecar pelo contrato atual baseado em `window`.

## Problema original

Na visualizacao da cifra, o usuario conseguia ativar a auto-rolagem, mas a tela nao rolava ou rolava de forma inconsistente.

O comportamento esperado era:

- abrir uma musica em `SongDetailScreen`;
- ativar modo execucao/auto-rolagem;
- esconder o header pelo fluxo de `PlaybackContext`;
- usar `requestAnimationFrame` para avancar o scroll vertical;
- respeitar velocidades predefinidas;
- permitir velocidade personalizada numerica;
- funcionar em web para testes e em Android via Capacitor.

## Arquitetura envolvida

Arquivo principal:

- `src/screens/SongDetailScreen.tsx`

Elementos envolvidos:

- `scrollRef`: referencia do container da cifra;
- `scrollPosRef`: posicao vertical conhecida;
- `requestAnimationFrame`: loop de animacao;
- `autoScrollLastTimeRef`: timestamp do ultimo frame;
- `autoScrollSpeed`: velocidade selecionada;
- `customAutoScrollSpeed`: velocidade personalizada;
- `usePlayback`: usado anteriormente para esconder header quando `isPlaying` ficava ativo.

O scroll da cifra era renderizado originalmente com `ScrollView` de `react-native-web`.

## Tentativas realizadas

### 1. `ScrollView` do `react-native-web`

Primeira implementacao usava:

- `ref={scrollRef}`;
- `scrollRef.current.scrollTo(...)`;
- `scrollRef.current.getScrollableNode?.()`;
- `scrollRef.current.getNativeScrollRef?.()`.

Suspeita: o `ref` nao apontava para o elemento DOM que realmente recebia o scroll, mas para uma abstracao/wrapper do `react-native-web`.

### 2. `getScrollableNode`

Foi tentado buscar o no interno via:

```ts
scrollRef.current?.getScrollableNode?.()
```

Resultado: em alguns casos retornava um no, mas a leitura/escrita de `scrollTop` nao produzia movimento visivel.

### 3. `getNativeScrollRef`

Tambem foi tentado:

```ts
scrollRef.current?.getNativeScrollRef?.()
```

Resultado: nao resolveu de forma confiavel no web.

### 4. `scrollTo`

Foram testados caminhos:

```ts
target.scrollTo({ x: 0, y: nextY, animated: false })
target.scrollTo(0, nextY)
node.scrollTo({ left: 0, top: nextY, behavior: 'auto' })
node.scrollTo(0, nextY)
```

Os logs mostraram que `target.scrollTo(object)` era chamado, mas `nextY` continuava chegando como `0` em uma fase da investigacao.

### 5. `scrollTop`

Depois foi dada prioridade a:

```ts
node.scrollTop = nextY
```

Mesmo assim, o web continuou parado.

### 6. `maxScroll`

Foi identificado um caso em que:

```ts
maxScroll = scrollHeight - clientHeight
```

voltava `0`, travando:

```ts
nextY = Math.min(valorCrescente, 0)
```

Foi tentado fallback para `Number.POSITIVE_INFINITY` quando `maxScroll` vinha `0`. Isso impediu o calculo de prender `nextY` em zero, mas nao resolveu o movimento real.

### 7. DOM node real

O container da cifra foi trocado de `ScrollView` para `div` DOM real, com:

```ts
overflowY: 'auto'
overflowX: 'hidden'
WebkitOverflowScrolling: 'touch'
```

Tambem foi tentado localizar candidatos internos com `querySelectorAll('*')`.

Resultado: o elemento era DOM real, mas ainda nao aceitava scroll efetivo.

### 8. Flex, `height: 0`, `minHeight: 0`

Foi tentado forcar o container da cifra a ser area scrollavel em layout flex:

```ts
flex: '1 1 0%'
height: 0
minHeight: 0
overflowY: 'auto'
```

Isso e uma tecnica comum para impedir que um filho flex cresca com o conteudo e permitir que `overflowY: auto` crie a area rolavel.

Resultado: ainda nao confirmou funcionamento no web.

### 9. Botao temporario `TESTE SCROLL +300`

Foi criado temporariamente um botao que executava diretamente:

```ts
scrollRef.current.scrollTop += 300
```

ou equivalente no DOM real encontrado.

Logs recebidos:

- `refIsDomNode: true`
- `nodeIsDomNode: true`
- `scrollHeight: 1313`
- `after targetScrollTop: 0`
- `after nodeScrollTop: 0`
- `windowScrollY: 0`

Conclusao desse teste: o elemento encontrado tinha conteudo (`scrollHeight`), mas nao era efetivamente rolavel, ou nao aceitava alteracao de `scrollTop` naquele layout.

## Logs importantes

Durante a investigacao, os logs mostraram repetidamente:

```txt
scrollToPosition chamado { requestedY: 0, nextY: 0 }
scrollToPosition path: target.scrollTo(object)
```

Depois, com o botao de teste:

```txt
refIsDomNode: true
nodeIsDomNode: true
scrollHeight: 1313
after targetScrollTop: 0
after nodeScrollTop: 0
windowScrollY: 0
```

Esses logs indicam que o problema nao era apenas ausencia de `ref`. O no existia, mas nao se comportava como area scrollavel efetiva.

## Conclusao atual

- A auto-rolagem nao esta confiavel no web.
- `scrollHeight` existe.
- `scrollTop` nao altera corretamente no elemento encontrado.
- em uma etapa anterior, `window.scrollY` tambem permaneceu `0`; o diagnostico posterior mostrou que o scroll real ativo e `window`.
- O problema parece estar na composicao de layout/elemento rolavel real, nao apenas no `requestAnimationFrame`.
- A feature foi retomada em 2026-05-18 com implementacao simples baseada em `window`.

## Estado atual do codigo

Em `SongDetailScreen`:

- a UI mostra auto-scroll apenas no modal `Controles Rapidos` do modo Play;
- o controle antigo de velocidade continua removido; a retomada usa presets simples;
- o modal de velocidade ficou desativado;
- o container da cifra permanece como `div` DOM real com `overflowY: auto`;
- existe comentario apontando para este documento.

## Proximos caminhos recomendados

1. Criar um componente isolado para a area da cifra com DOM puro, fora de `react-native-web`, e testar scroll manual antes de religar `requestAnimationFrame`.
2. Testar Android/Capacitor separadamente, porque o comportamento do WebView pode diferir do browser desktop.
3. Considerar biblioteca especifica de auto-scroll/virtual scroll apenas se ela nao quebrar Vite + Capacitor.
4. Inspecionar no DevTools qual elemento muda quando o usuario rola manualmente com mouse/toque.
5. Adicionar um teste manual controlado antes da retomada:
   - clicar um botao interno temporario;
   - confirmar que `scrollTop += 300` move a cifra;
   - so entao religar o loop com `requestAnimationFrame`.
6. Evitar reintroduzir `ScrollView` do `react-native-web` para essa area antes de confirmar o elemento real de scroll.

## Regra para retomada futura

Antes de reativar a feature na UI, provar primeiro:

```ts
element.scrollTop += 300
```

Se isso nao mover a cifra visivelmente, nao vale mexer no loop, velocidade ou `requestAnimationFrame`.
