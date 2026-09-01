# RELEASE_STABLE_CHECKLIST

Atualizado em: 2026-05-25

## 1. Objetivo da checklist

O CifrasGo esta em beta funcional/maduro. O foco atual e estabilizar releases, reduzir regressao e manter evolucoes pequenas, seguras e bem validadas.

Toda versao candidata a APK/release deve passar por esta checklist antes de ser considerada estavel.

- [ ] Confirmar que a mudanca da release foi pequena e bem delimitada.
- [ ] Confirmar que nao houve refatoracao ampla sem planejamento especifico.
- [ ] Confirmar que os fluxos principais seguem funcionais.
- [ ] Confirmar que Android/WebView foi validado quando houver mudanca visual, gesto, audio, importacao, backup ou compartilhamento.
- [ ] Registrar qualquer warning conhecido que nao bloqueia release.

## 2. Build e validacao tecnica

- [ ] Rodar `npx tsc -b`.
- [ ] Confirmar que o TypeScript terminou sem erros.
- [ ] Rodar `npm run build`.
- [ ] Confirmar que o build terminou sem erros criticos.
- [ ] Registrar warnings conhecidos, como chunk grande do Vite, quando aplicavel.
- [ ] Gerar APK pelo fluxo atual do projeto.
- [ ] Confirmar que o APK foi criado no local esperado.
- [ ] Instalar o APK em Android real.
- [ ] Abrir o app instalado e confirmar que a tela inicial carrega.
- [ ] Confirmar que nao houve alteracao inesperada em storage, modelos ou formato de backup.

## 3. Fluxos criticos

### SongDetail

- [ ] Abrir uma musica existente.
- [ ] Confirmar titulo, artista, genero e observacao quando existirem.
- [ ] Confirmar renderizacao da cifra.
- [ ] Alterar tom/transposicao.
- [ ] Aumentar e diminuir fonte.
- [ ] Usar toolbar normal.
- [ ] Abrir editor a partir da musica.
- [ ] Confirmar que a tela nao apaga enquanto a musica esta aberta, quando o Android/WebView permitir Wake Lock.
- [ ] Voltar para a tela anterior sem perder contexto.

### Modo Play

- [ ] Entrar no Modo Play.
- [ ] Sair do Modo Play.
- [ ] Confirmar header compacto.
- [ ] Abrir Controles Rapidos.
- [ ] Abrir Lista Atual quando a musica veio de playlist.
- [ ] Confirmar overlays/modais sem travar a tela.
- [ ] Confirmar que o app volta ao modo normal corretamente.

### Auto-scroll

- [ ] Ativar auto-scroll.
- [ ] Testar presets `V1` a `V8`.
- [ ] Testar velocidade personalizada.
- [ ] Rolar manualmente durante o auto-scroll.
- [ ] Confirmar que a posicao manual e sincronizada.
- [ ] Confirmar parada automatica no fim da musica.
- [ ] Confirmar que sair do Modo Play interrompe o auto-scroll.
- [ ] Confirmar que o motor continua baseado em `window.scrollY`/`window.scrollTo`.

### Swipe

- [ ] Abrir musica a partir de uma playlist.
- [ ] Entrar no Modo Play.
- [ ] Usar swipe para proxima musica.
- [ ] Usar swipe para musica anterior.
- [ ] Confirmar que os botoes anterior/proxima continuam funcionando.
- [ ] Confirmar que toque em botoes e modais nao dispara swipe indevido.

### Post-it

- [ ] Abrir post-it da musica.
- [ ] Editar texto.
- [ ] Confirmar autosave.
- [ ] Mover post-it.
- [ ] Redimensionar post-it.
- [ ] Trocar cor.
- [ ] Ocultar com X.
- [ ] Reabrir e confirmar conteudo/posicao.
- [ ] Excluir anotacao.
- [ ] Confirmar que drag/resize nao dispara swipe.

### Audio e metronomo

- [ ] Gravar audio de referencia.
- [ ] Reproduzir audio gravado.
- [ ] Pausar audio.
- [ ] Buscar trecho no mini player.
- [ ] Fechar/ocultar mini player.
- [ ] Ativar metronomo visual.
- [ ] Ativar metronomo sonoro.
- [ ] Confirmar BPM e compasso configurados.
- [ ] Confirmar limpeza ao trocar de musica ou sair da tela.

### Pastas/Listas

- [ ] Abrir Pastas/Listas.
- [ ] Testar favoritos/estrelas.
- [ ] Testar modo `Pastas primeiro`.
- [ ] Testar modo `Listas primeiro`.
- [ ] Testar modo `Misturado por nome`.
- [ ] Abrir pasta, subpasta e sub-subpasta.
- [ ] Criar lista.
- [ ] Adicionar musica a lista.
- [ ] Remover musica de lista.
- [ ] Mover/adicionar lista existente.
- [ ] Mover/adicionar subpasta existente.
- [ ] Abrir playlist em Modo padrao.
- [ ] Abrir playlist em Modo roteiro.
- [ ] Configurar PDF rapido por link publico.
- [ ] Configurar PDF rapido por arquivo local escolhido.
- [ ] Confirmar bloqueio amigavel para PDF local acima de 5 MB.
- [ ] Confirmar mensagem amigavel para caminho local digitado, como `E:\arquivo.pdf`.
- [ ] Adicionar/remover PDF em playlist no Modo padrao.
- [ ] Abrir PDF por `PdfViewer`.
- [ ] Confirmar que o header do `PdfViewer` mostra `PDF1 - Nome` ou `PDF1`.
- [ ] Confirmar que PDF local salvo renderiza apos fechar/reabrir app.
- [ ] Confirmar que a tela nao apaga durante leitura do PDF, quando o Android/WebView permitir Wake Lock.
- [ ] Confirmar `Abrir externo` para link publico e desabilitado para arquivo local.

### Backup

- [ ] Gerar backup completo.
- [ ] Confirmar ZIP valido.
- [ ] Gerar backup personalizado.
- [ ] Selecionar musicas individuais.
- [ ] Selecionar artistas.
- [ ] Selecionar listas.
- [ ] Selecionar pastas.
- [ ] Misturar categorias no backup personalizado.
- [ ] Confirmar deduplicacao de musicas no pacote.
- [ ] Restaurar backup completo em base de teste.
- [ ] Restaurar backup personalizado em base de teste.
- [ ] Confirmar restore em modo mesclar.
- [ ] Confirmar que backup/restore nao apaga dados existentes indevidamente.
- [ ] Abrir Exportar PDF na tela Backup/Restauracao.
- [ ] Selecionar uma playlist pequena.
- [ ] Selecionar uma playlist grande.
- [ ] Gerar PDF com acordes.
- [ ] Gerar PDF em Modo vocalista.
- [ ] Confirmar que acordes inline somem no PDF vocalista.
- [ ] Confirmar que PDFs rapidos da lista nao entram na exportacao.
- [ ] Confirmar que o PDF fica legivel, com margens e quebras corretas.
- [ ] Compartilhar/baixar PDF no web.
- [ ] Compartilhar PDF no Android/Capacitor.

### Importacao

- [ ] Importar musica por URL.
- [ ] Confirmar backend online quando estiver em Android/APK.
- [ ] Confirmar mensagem amigavel se o backend falhar.
- [ ] Confirmar deduplicacao por artista/titulo.
- [ ] Abrir musica importada.
- [ ] Importar TXT CifrasGo quando aplicavel.

### Player YouTube

- [ ] Abrir modal do YouTube em musica com link.
- [ ] Abrir player inline.
- [ ] Confirmar que controles padrao do YouTube aparecem.
- [ ] Fechar modal e confirmar que o player desmonta.
- [ ] Trocar de musica e confirmar que nao fica audio/video escondido.
- [ ] Abrir no YouTube externo.
- [ ] Copiar link.
- [ ] Confirmar que musica sem `youtubeUrl` nao mostra acao indevida.

### Pedal/Teclado

- [ ] Entrar no Modo Play.
- [ ] Usar `Space` para iniciar/parar auto-scroll.
- [ ] Usar `PageDown`.
- [ ] Usar `ArrowDown`.
- [ ] Usar `PageUp`.
- [ ] Usar `ArrowUp`.
- [ ] Usar `Escape` para fechar overlay/modal seguro ou sair do Play.
- [ ] Confirmar que atalhos nao disparam dentro de input, busca, textarea, editor ou area editavel.

## 4. Android/WebView

- [ ] Instalar APK em Android real.
- [ ] Abrir app sem tela branca ou crash.
- [ ] Confirmar scroll normal nas listas.
- [ ] Confirmar scroll normal na cifra.
- [ ] Confirmar swipe no Modo Play.
- [ ] Abrir e fechar modais principais.
- [ ] Testar seletor de arquivo PDF local.
- [ ] Testar protecao contra descanso de tela em SongDetail, Modo Play e PdfViewer.
- [ ] Testar teclado fisico/pedal Bluetooth quando disponivel.
- [ ] Testar gravacao/reproducao de audio.
- [ ] Testar metronomo visual e sonoro.
- [ ] Testar compartilhamento/download de arquivos.
- [ ] Testar importacao online por URL.
- [ ] Testar backup completo.
- [ ] Testar backup personalizado.
- [ ] Testar restore em base de teste.
- [ ] Confirmar que navegacao voltar do Android nao prende modal/tela.

Release estavel exige validacao em Android real quando a mudanca envolver WebView, gesto, audio, compartilhamento, importacao, backup, player YouTube ou SongDetail.

## 5. Regressoes conhecidas a observar

- [ ] Preview experimental de acordes continua pausado.
- [ ] Tocar em acordes nao abre modal.
- [ ] Entrar no Modo Play depois de tocar em acordes nao abre modal atrasado.
- [ ] Auto-scroll nao trava.
- [ ] Auto-scroll nao volta a depender de `scrollRef` como motor.
- [ ] Swipe nao perde gesto.
- [ ] Swipe nao interfere com botoes, modais, post-it ou inputs.
- [ ] Player YouTube nao continua tocando escondido apos fechar modal.
- [ ] Player YouTube nao interfere com scroll, swipe ou Modo Play.
- [ ] Post-it nao dispara swipe durante mover/redimensionar.
- [ ] Atalhos de teclado nao disparam em campos editaveis.

## 6. O que NAO mexer sem planejamento

Estas areas exigem plano proprio antes de qualquer alteracao:

- [ ] `SongContent` completo.
- [ ] Container principal da cifra.
- [ ] `SongBodyContainer`.
- [ ] `PlaylistSwipeControls`.
- [ ] `useAutoScroll`.
- [ ] `useSwipeNavigation`.
- [ ] Parser/transposicao.
- [ ] `ChordLine` em fluxo de toque/preview.
- [ ] Handlers pointer/touch.
- [ ] Logica de swipe.
- [ ] `window.scrollY`/`window.scrollTo`.
- [ ] Post-it drag/resize/autosave.
- [ ] Audio/gravacao.
- [ ] Metronomo/timers/audio context.
- [ ] Modo Play.
- [ ] Storage/models/migrations.
- [ ] Restore/backup format.

## 7. Criterio de release estavel

Uma release pode ser considerada estavel quando:

- [ ] `npx tsc -b` passou.
- [ ] `npm run build` passou.
- [ ] APK foi gerado.
- [ ] APK abriu em Android real.
- [ ] Fluxos principais passaram na validacao manual.
- [ ] Android/WebView passou nos pontos relevantes.
- [ ] Backup completo passou.
- [ ] Backup personalizado passou.
- [ ] Restore em modo mesclar passou.
- [ ] SongDetail nao teve regressao.
- [ ] Auto-scroll nao teve regressao.
- [ ] Swipe nao teve regressao.
- [ ] Post-it nao teve regressao.
- [ ] Audio/metronomo nao tiveram regressao.
- [ ] Player YouTube desmonta corretamente.
- [ ] Atalhos de palco funcionam sem capturar inputs.
- [ ] Nao ha regressao conhecida aberta para o escopo da release.

## 8. Filosofia atual do projeto

**Estabilidade > refatoracao infinita**

Diretrizes atuais:

- [ ] Preferir pequenas fatias.
- [ ] Preferir melhorias isoladas.
- [ ] Validar manualmente antes de nova refatoracao sensivel.
- [ ] Evitar reescrita ampla.
- [ ] Evitar dependencias pesadas sem necessidade clara.
- [ ] Priorizar confiabilidade em Android/WebView.
- [ ] Priorizar UX discreta e previsivel.
- [ ] Documentar decisoes relevantes.
- [ ] Manter SongDetail sensivel protegida ate nova validacao ampla.
