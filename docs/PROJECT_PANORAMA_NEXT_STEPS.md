# Panorama Tecnico e Proximos Passos - CifrasGo

Atualizado em: 2026-05-25

Documento panoramico criado a partir da leitura de:

- `docs/PROJETO_CONTEXTO.md`
- `docs/REFATORACAO.md`
- `docs/SONG_DETAIL_REFACTOR_PROGRESS.md`
- `docs/SONG_DETAIL_REFACTOR_PLAN.md`
- `docs/AUTO_SCROLL_DEBUG.md`
- `docs/MANUAL_USUARIO.md`
- `docs/README.md`
- `docs/DEPLOY_BACKEND_ANDROID.md`

Observacao: nao ha `README.md` na raiz do projeto nesta leitura. O README disponivel esta em `docs/README.md`.

## 1. Resumo executivo

O CifrasGo esta em estado beta funcional. O app e offline-first para organizar cifras, repertorios, pastas, listas, post-its, recursos de ensaio e apresentacao. A stack ativa e Vite/React com `react-native-web`, empacotada para Android via Capacitor, com backend Express no Render para importacao online por URL.

Os fluxos principais estao estabilizados: musicas, SongDetail, pastas/listas, backup/restauracao, importacao online, modo Play, auto-scroll e organizacao de playlists. A recomendacao central e continuar evoluindo em fatias pequenas, com validacao manual antes e depois de cada mudanca.

A `SongDetailScreen` foi reduzida por refatoracao incremental segura, mas ainda concentra areas sensiveis. Nao ha indicio de que uma reescrita ampla seja um bom proximo passo.

## 2. Estado atual do produto

O produto cobre o fluxo principal de repertorio:

- cadastro, edicao, busca e exclusao de musicas;
- visualizacao de cifra com acordes destacados e transposicao visual;
- modo Play com header compacto, lista atual, controles rapidos, swipe, auto-scroll e atalhos por teclado/pedal Bluetooth;
- post-it musical por musica, com autosave, cor, posicao e tamanho;
- metronomo por musica, com pulso visual e som via Web Audio API;
- gravacao/reproducao de referencia;
- link do YouTube por musica com player simples isolado no modal e abertura externa;
- pastas, subpastas, listas e modo roteiro de playlists;
- favoritos/estrelas e modos globais de exibicao de pastas/listas;
- PDFs rapidos configuraveis por link publico ou arquivo PDF escolhido, adicionaveis a playlists no Modo padrao como itens especiais e abertos em `PdfViewerScreen` com iframe leve e fallback externo quando houver link;
- backup/restauracao em modo mesclar;
- backup personalizado por musicas, artistas, listas e pastas;
- importacao online via backend Render.

A tela interna **Sobre / Guia do usuario** foi atualizada para refletir esse estado mais maduro: apresenta o CifrasGo como app offline-first para uso real em missa/palco/repertorio, destaca Modo Play, PDFs rapidos, backup, YouTube, pedal/teclado e registra a filosofia de estabilidade.

O preview experimental de acordes esta pausado. Os arquivos de registry, modal e diagrama permanecem no codigo, mas `ChordLine` nao registra clique/toque em acordes, porque a interacao apresentou conflito intermitente com toque, scroll, swipe e modo Play.

## 3. Estado atual da arquitetura

O `src/App.tsx` ainda e a casca/orquestrador principal. Ele monta providers, rota manual, header, drawer e renderizacao das telas. O `AppNavigator` existe, mas nao deve ser ativado agora.

As telas reais ja estao em `src/screens`, e os services/utils principais ja foram extraidos. Os providers ativos cobrem drawer, filtros globais, navegacao manual, playback, settings/tema, top bar e confirm dialog.

A `SongDetailScreen.tsx` esta com cerca de 2028 linhas. Ela ja possui 13 componentes extraidos em `src/screens/SongDetail/components/` e 2 hooks extraidos em `src/screens/SongDetail/hooks/`: `useAddToPlaylist` e `useCurrentPlaylistData`.

## 4. SongDetailScreen: situacao e limites

A refatoracao incremental da SongDetail foi bem-sucedida nas fatias visuais e nos hooks de menor risco. Ja foram extraidos headers, modais visuais, toolbar, mini player visual, post-it visual, bloco de observacao, bloco de linhas da cifra, picker de playlists reutilizavel, `useAddToPlaylist` e `useCurrentPlaylistData`.

A tela principal continua dona da orquestracao sensivel:

- container principal da cifra;
- refs de scroll, swipe, post-it e audio;
- auto-scroll baseado em `window.scrollY` e `window.scrollTo`;
- handlers pointer/touch;
- swipe entre musicas de playlist;
- transposicao/parser;
- modo Play;
- post-it drag/resize/autosave;
- audio, gravacao e metronomo.

O limite atual e claro: o ganho de extrair mais estrutura de SongDetail ficou menor que o risco imediato. A proxima fase deve priorizar validacao e estabilidade.

## 5. Areas congeladas/sensiveis

Nao mexer agora em:

- `SongContent` completo;
- container principal da cifra;
- `SongBodyContainer`;
- `PlaylistSwipeControls`;
- `useAutoScroll`;
- `useSwipeNavigation`;
- handlers pointer/touch;
- logica de swipe;
- `window.scrollY` e `window.scrollTo`;
- parser e transposicao;
- post-it, drag, resize e autosave;
- audio, gravacao e metronomo;
- modo Play;
- preview experimental de acordes.

Essas areas dependem de interacao entre DOM/WebView, refs, timers, gestos, layout e estado global. Qualquer mudanca nelas deve ser precedida por validacao manual real, especialmente Android/WebView.

## 6. Riscos atuais

Os principais riscos tecnicos sao:

- regressao em Android/WebView, especialmente em gestos, audio e scroll;
- auto-scroll dependente do `window`, nao de `scrollRef`;
- swipe dependente da arvore visual, `data-swipe-ignore`, refs e handlers de toque;
- post-it e audio com refs, timers, cleanup e estado sensivel;
- backend Render afetando importacao online quando indisponivel ou lento;
- preview de acordes ja demonstrou risco de eventos atrasados/conflito de toque;
- migracoes amplas podem quebrar fluxos que hoje estao funcionais.

O risco de maior impacto continua sendo mexer em SongDetail sem uma bateria manual de testes.

## 7. Proximos passos recomendados

Prioridade 1: validar manualmente o estado atual antes de novas refatoracoes estruturais.

Prioridade 2: fazer pequenas melhorias documentais e de UX sem tocar areas sensiveis. O objetivo e aumentar confianca, clareza e suporte ao uso real.

Prioridade 3: buscar refatoracoes seguras fora da SongDetail, preferindo componentes/modais isolados e helpers sem dependencia de gesto, scroll, audio ou storage sensivel.

Prioridade 4: so retomar estrutura sensivel depois de estabilidade confirmada em Android/WebView, com foco em uma unica fatia por vez.

## 8. Refatoracoes seguras sugeridas

Sugestoes seguras para curto prazo:

- organizar documentacao e criar indices de leitura, sem alterar comportamento;
- revisar pequenos modais locais antes de migra-los para `AppModal`;
- mapear modais que ainda nao usam `AppModal`, sem migrar todos juntos;
- melhorar componentes visuais fora do container da cifra;
- manter `PlaylistPickerModal` e helpers de pastas/listas como base para padronizacoes futuras;
- evitar novos hooks na SongDetail por enquanto.

Se uma refatoracao tocar scroll, swipe, audio, post-it, parser, modo Play ou Android back, ela deve sair da fila de "segura" e voltar para planejamento especifico.

## 9. Melhorias de UX/funcionalidade em fatias pequenas

Melhorias pequenas recomendadas:

- melhorar mensagens de erro da importacao online quando o backend estiver indisponivel;
- refinar textos do Modo Ajuda e do manual interno;
- manter a tela Sobre como resumo vivo do estado atual, evitando transformar o app em landing page ou marketing exagerado;
- validar o novo backup personalizado em bases reais antes de ampliar o fluxo;
- validar atalhos de palco com teclado fisico e pedal Bluetooth que emula teclado;
- criar um checklist interno de validacao Android/WebView;
- reforcar no guia que importacao online depende do backend Render;
- revisar fluxo de favoritos/estrelas em pastas/listas depois de testes reais;
- manter o preview de acordes pausado ate existir um plano especifico para evitar conflito com gestos.

Evitar melhorias que parecam pequenas mas puxem areas sensiveis, como gesto em acordes, alteracao do container da cifra ou interceptacao de toque no modo Play.

## 10. Validacoes manuais prioritarias

Validar em web e, quando possivel, em Android instalado:

- abrir musica normal e conferir cifra, transposicao, fonte e toolbar;
- entrar e sair do modo Play;
- usar auto-scroll com presets e velocidade personalizada;
- testar `Space`, `PageDown`/`PageUp`, setas e `Escape` no Modo Play com teclado fisico/pedal;
- confirmar que atalhos nao disparam dentro de campos de texto, busca, editor ou inputs de modal;
- rolar manualmente durante auto-scroll e confirmar sincronizacao;
- usar swipe entre musicas abertas por playlist;
- abrir lista atual e navegar por ela;
- abrir controles rapidos e testar acoes principais;
- abrir, mover, redimensionar, recolorir, ocultar e excluir post-it;
- testar metronomo visual e sonoro;
- testar gravacao/reproducao de referencia;
- adicionar/remover musica de listas pela SongDetail;
- testar pastas/listas com favoritos e modos de exibicao;
- configurar PDFs rapidos por link e por arquivo local, adicionar/remover item PDF em playlist no Modo padrao e abrir o PDF via `PdfViewer`;
- importar musica por URL no web e no APK;
- gerar e restaurar backup completo;
- gerar e restaurar backup personalizado misturando musicas, artistas, listas e pastas;
- compartilhar musica/lista/pasta quando aplicavel;
- tocar em acordes e confirmar que nenhum modal abre;
- entrar no modo Play depois de tocar em acordes e confirmar que nenhum modal atrasado aparece.

## 11. O que evitar agora

Evitar:

- reescrita ampla da SongDetail;
- ativar `AppNavigator`;
- retomar preview experimental de acordes;
- mexer no motor de auto-scroll;
- trocar `window.scrollY`/`window.scrollTo` por `scrollRef`;
- extrair swipe, gestos ou container principal;
- alterar parser/transposicao;
- alterar storage/modelos sem necessidade clara;
- adicionar dependencias pesadas;
- refatorar backup/importacao junto de UX;
- migrar varios modais de uma vez.

## 12. Ordem sugerida de execucao

1. Validar manualmente o estado atual da SongDetail e dos fluxos principais.
2. Corrigir apenas bugs pequenos encontrados nessa validacao.
3. Atualizar docs/indices se a equipe quiser facilitar navegacao da documentacao.
4. Fazer uma microfatia visual ou documental por vez.
5. Validar Android/WebView antes de qualquer refatoracao sensivel.
6. Reavaliar hooks medios somente depois da validacao.
7. Manter `useAutoScroll`, `useSwipeNavigation`, container da cifra e preview de acordes fora da fila imediata.

## 13. Checklist final

- [x] Codigo nao alterado nesta fatia documental.
- [x] Telas nao alteradas.
- [x] Storage/modelos nao alterados.
- [x] Documento panoramico criado.
- [x] README raiz ausente registrado como observacao.
- [x] Areas congeladas registradas.
- [x] Proximas prioridades documentadas.
- [x] Preview de acordes registrado como pausado.
- [x] Sugestao final: considerar depois incluir este arquivo em um indice documental, sem alterar indices nesta fatia.
