# PDF por link em listas

Atualizado em: 2026-05-26

## 1. Resumo da feature

A feature permite cadastrar ate 3 PDFs globais por link publico ou arquivo escolhido nas Configuracoes e adicionar esses PDFs como itens especiais dentro de listas/playlists.

Para link publico, o PDF nao deve ser baixado, cacheado ou convertido. Para arquivo escolhido, a implementacao atual salva uma copia local em Data URL/base64 dentro do storage do app, limitada a 5 MB por slot.

- identificador fixo do slot (`PDF1`, `PDF2`, `PDF3`);
- nome opcional;
- link publico do PDF ou arquivo PDF local salvo no app.

Na playlist, o PDF deve aparecer misturado entre as musicas, com visual proprio, e abrir uma tela isolada de visualizacao de PDF por link, com fallback para abrir externo.

Recomendacao central: implementar, mas em fases pequenas. A feature exige evolucao do modelo de playlist; nao deve ser feita colocando PDF como "musica falsa" em `songIds`.

## 2. Casos de uso

- Folheto da missa de domingo cadastrado como `PDF1`.
- Celebracao de Corpus Christi cadastrada como `PDF2`.
- Um roteiro, cifra extra, folha de resposta ou documento liturgico cadastrado como `PDF3`.
- Playlist de missa com musicas e PDFs misturados na ordem real de uso.
- Modo roteiro/lista com item PDF destacado para o usuario abrir durante a celebracao ou ensaio.

Exemplo:

```txt
Lista: Missa Devota Santa Rita 2026

1. Canto de entrada
2. PDF1 - Folheto da Missa de Domingo
3. Gloria
4. Aclamacao
5. PDF2 - Celebracao de Corpus Christi
```

## 3. Modelo de dados recomendado

### PDFs rapidos

Criar tipos futuros em `src/types/models.ts`:

```ts
export type QuickPdfId = 'pdf1' | 'pdf2' | 'pdf3';

export interface QuickPdfLink {
  id: QuickPdfId;
  sourceType?: 'url' | 'file';
  name?: string;
  url?: string;
  fileName?: string;
  fileData?: string;
  fileSize?: number;
  fileMimeType?: string;
  updatedAt?: number;
}
```

Regras:

- sempre normalizar para exatamente tres slots;
- `id` nao deve ser editavel pelo usuario;
- `name` e opcional;
- `url` vazio significa slot nao disponivel para adicionar em listas;
- `sourceType: 'url'` usa `url`;
- `sourceType: 'file'` usa `fileData` em Data URL/base64;
- arquivos locais sao limitados a 5 MB por slot para reduzir risco de estourar storage;
- `updatedAt` ajuda backup/restore futuro e debug.

### Itens mistos de playlist

Adicionar tipo futuro:

```ts
export type PlaylistItem =
  | { id: string; type: 'song'; songId: string }
  | { id: string; type: 'pdf'; pdfId: QuickPdfId };
```

Evoluir `Playlist` de forma opcional:

```ts
export interface Playlist {
  id: string;
  folderId: string | null;
  name: string;
  songIds: string[];
  items?: PlaylistItem[];
  isStarred?: boolean;
  genres?: string[];
  viewMode?: PlaylistViewMode;
  sections?: PlaylistSection[];
}
```

Evoluir `PlaylistSection` de forma opcional:

```ts
export interface PlaylistSection {
  id: string;
  title: string;
  songIds: string[];
  itemIds?: string[];
  color?: string;
}
```

Racional:

- `songIds` continua sendo a lista de musicas, para compatibilidade;
- `items` preserva a ordem visual mista entre musicas e PDFs;
- `itemIds` permite que secoes do Modo roteiro apontem para itens mistos sem quebrar `songIds`;
- playlists antigas sem `items` podem derivar `items` a partir de `songIds`.

## 4. Impacto em playlists

Hoje playlists dependem de:

- `playlist.songIds` para ordem simples;
- `playlist.sections[].songIds` para Modo roteiro;
- `db.addSongToPlaylist` e `db.removeSongFromPlaylist`;
- `PlaylistDetailScreen`;
- `PlaylistStructureScreen`;
- backup/restore e exportacao.

Para PDFs:

- manter `songIds` apenas para musicas;
- adicionar PDFs em `items`;
- quando a playlist nao tiver `items`, derivar visualmente:

```ts
playlist.songIds.map((songId) => ({
  id: `song:${songId}`,
  type: 'song',
  songId,
}))
```

- ao adicionar musica nova, garantir que ela entre em `songIds` e tambem em `items`;
- ao adicionar PDF, inserir apenas em `items`;
- ao remover musica, remover de `songIds`, `items` e secoes;
- ao remover PDF, remover de `items` e secoes;
- na v1, evitar duplicar o mesmo `pdfId` na mesma playlist.

Essa abordagem preserva compatibilidade com dados existentes e evita misturar IDs de PDF em APIs que esperam IDs de musica.

## 5. Impacto em storage

Criar storage dedicado futuro:

```ts
quickPdfs: '@quick_pdfs'
```

Adicionar metodos futuros no `db`:

```ts
getQuickPdfs(): Promise<QuickPdfLink[]>
saveQuickPdfs(rows: QuickPdfLink[]): Promise<void>
```

Normalizacao recomendada:

- aceitar arrays incompletos ou corrompidos;
- sempre retornar tres objetos, `pdf1`, `pdf2`, `pdf3`;
- descartar IDs desconhecidos;
- trim em `name`, `url`, `fileName`, `fileData` e `fileMimeType`;
- para arquivos locais, preservar apenas `fileData`, `fileName`, `fileSize` e `fileMimeType`;
- nao validar rede no storage;
- `clearAllData` deve limpar `@quick_pdfs` quando a feature for implementada.

`normalizePlaylistRow` tambem precisara normalizar:

- `items`;
- `sections[].itemIds`;
- fallback de `items` a partir de `songIds`;
- remocao de itens invalidos.

## 6. Impacto em navegacao

Criar uma rota manual futura:

```ts
PdfViewer: {
  pdfId: QuickPdfId;
  returnTo?: ManualRoute;
  sourcePlaylistId?: string;
  sourcePlaylistName?: string;
}
```

Criar tela isolada:

```txt
src/screens/PdfViewerScreen.tsx
```

Nao reutilizar `SongDetailScreen`.

Motivo:

- PDF nao tem cifra;
- nao tem transposicao;
- nao tem auto-scroll;
- nao tem swipe;
- nao tem post-it;
- nao tem audio/metronomo;
- nao deve contaminar a tela mais sensivel do app.

Back target:

- se aberto por playlist, voltar para `PlaylistDetail`;
- se aberto de outro contexto futuro, respeitar `returnTo`;
- titulo da rota pode ser `PDF`.

## 7. Impacto em backup/restore

Nao alterar backup/restore na primeira etapa.

Risco atual:

- `@quick_pdfs` nao sera exportado/restaurado, incluindo arquivos locais salvos em Data URL;
- `playlist.items` pode ser preservado no backup completo por JSON cru, mas restore atual normaliza playlists focando `songIds` e `sections[].songIds`;
- `sections[].itemIds` nao sera tratado corretamente pelo restore atual;
- exportacao de lista/pasta nao conhece PDFs;
- backups legados nao devem receber PDFs sem planejamento.

Plano futuro:

- versionar ou estender o formato de backup completo;
- incluir `data/quick-pdfs.json`;
- preservar `playlist.items` e `sections[].itemIds`;
- remapear itens de musica quando IDs mudarem no restore;
- preservar itens PDF por `pdfId`;
- decidir se backup personalizado deve incluir PDFs usados por playlists selecionadas;
- atualizar arquivos legiveis para listar PDFs como itens especiais.

Enquanto isso nao for feito, documentar claramente que a v1 local de PDFs pode nao ser portavel por backup/restore.

## 8. UX proposta

### Configuracoes

Adicionar secao:

```txt
PDFs rapidos
```

Conteudo:

- `PDF1`
  - Nome
  - Link publico
  - Escolher PDF
  - Limpar
- `PDF2`
  - Nome
  - Link publico
  - Escolher PDF
  - Limpar
- `PDF3`
  - Nome
  - Link publico
  - Escolher PDF
  - Limpar

Texto de apoio:

```txt
O CifrasGo pode abrir um PDF por link publico ou por arquivo escolhido no aparelho. Arquivos locais ficam salvos apenas neste app e podem ocupar espaco.
```

### Lista / PlaylistDetail

Em `Opcoes da lista`, adicionar:

```txt
Adicionar PDF
Escolha um dos PDFs rapidos cadastrados em Configuracoes.
```

Ao tocar:

- abrir `AppModal`;
- listar somente PDFs com `url` preenchido ou `fileData` salvo;
- mostrar `PDF1 - Nome` ou apenas `PDF1`;
- mostrar subtitulo com link, dominio ou nome do arquivo salvo;
- bloquear PDFs ja adicionados na mesma playlist;
- se nenhum PDF tiver link/arquivo, mostrar estado vazio orientando cadastrar em Configuracoes.

### Item PDF na lista

Visual:

- icone diferente, por exemplo `FileText`;
- cor distinta e discreta;
- label pequeno `PDF`;
- titulo `PDF1 - Nome` ou `PDF1`;
- subtitulo `PDF por link` ou `PDF salvo no app`;
- acao principal abre `PdfViewer`.

O item deve aparecer misturado com musicas na ordem de `playlist.items`.

### Tela PDF

Tela nova:

- header/titulo `PDF1 - Nome` ou `PDF1`;
- texto discreto avisando que o PDF vem de link externo ou foi escolhido no aparelho;
- area 16:9 ou full-height responsiva com `iframe`/embed;
- botao `Abrir externo` apenas quando houver link publico;
- estado de fallback quando o link estiver vazio/invalido, quando for caminho local digitado ou quando o slot estiver sem arquivo;
- sem controles de cifra.

## 9. Riscos

- Android WebView pode nao renderizar PDF inline.
- Alguns servidores bloqueiam embed por `X-Frame-Options` ou CORS/politicas do navegador.
- Links do Google Drive/Dropbox podem exigir formato publico especifico.
- Arquivos locais em Data URL consomem storage local e podem falhar se forem grandes.
- Dualidade `songIds` + `items` precisa helpers claros para evitar regressao.
- `PlaylistStructureScreen` hoje usa apenas `songIds`; adaptar drag/drop para itens mistos exige cuidado.
- Modo roteiro usa `sections[].songIds`; precisa `itemIds` ou uma estrutura equivalente.
- Backup/restore atual nao esta pronto para PDFs.
- Exportacao de lista/pasta e arquivos legiveis ainda nao representam PDFs.
- Se PDF for tratado como musica falsa, pode quebrar SongDetail, parser, filtros, backup e estatisticas.

## 10. Plano de implementacao em fases

### Fase 1 - Storage e Configuracoes

- Status: implementada.
- Tipos `QuickPdfId` e `QuickPdfLink` adicionados.
- Storage `@quick_pdfs` criado.
- `db.getQuickPdfs` e `db.saveQuickPdfs` adicionados.
- Secao `PDFs rapidos` integrada ao modal `Ajustes de pastas/listas e PDF` em `SettingsScreen`, com PDF1/PDF2/PDF3 recolhidos por slot.
- Edicao de nome/link, escolha de arquivo local e limpeza por slot disponiveis.
- Arquivos locais sao aceitos apenas como PDF e limitados a 5 MB por slot.

### Fase 2 - Adicionar PDF em PlaylistDetail

- Status: implementada.
- `PlaylistItem` e `Playlist.items` opcionais adicionados ao modelo.
- Helper `src/utils/playlistItems.ts` criado para derivar itens de playlists antigas, normalizar itens mistos e criar itens de musica/PDF.
- `PlaylistDetailScreen` ganhou opcao `Adicionar PDF` em `Opcoes da lista`.
- Modal de escolha mostra apenas PDFs rapidos com link ou arquivo configurado.
- O PDF escolhido entra no fim da lista como item especial e nao altera `songIds`.
- O modo padrao renderiza PDFs destacados junto das musicas, na ordem de `playlist.items`.
- Modo roteiro e `PlaylistStructureScreen` seguem fora de escopo; quando uma lista com PDFs esta em roteiro, a tela mostra aviso de que PDFs aparecem no modo padrao nesta fase.

### Fase 3 - Tela de PDF

- Status: implementada.
- Rota manual `PdfViewer` adicionada.
- `src/screens/PdfViewerScreen.tsx` criado como tela isolada, sem reutilizar `SongDetailScreen`.
- A tela carrega o PDF pelo `pdfId` usando `db.getQuickPdfs()`.
- O header da rota recebe o titulo real (`PDF1 - Nome` ou `PDF1`) quando aberto pela playlist.
- Renderizacao inline usa `iframe` simples com link publico; arquivos locais salvos em Data URL/base64 sao convertidos para Blob/objectURL antes de renderizar.
- O objectURL e revogado ao trocar de PDF ou desmontar a tela.
- A tela usa `useKeepAwake(true)` para tentar manter a tela acordada durante leitura quando a Screen Wake Lock API estiver disponivel.
- Botao `Abrir externo` fica disponivel quando o link e valido; para arquivo salvo no app ele fica desabilitado.
- Estados amigaveis cobrem PDF inexistente, slot sem link/arquivo, caminho local digitado e link invalido.
- O clique principal no item PDF da `PlaylistDetailScreen` abre `PdfViewer`; a acao lateral continua reservada para opcoes/remocao do item.
- Em Android/WebView, a renderizacao inline continua sendo melhor esforco; links que bloqueiam embed devem ser abertos externamente.

### Fase 4 - Organizacao e Modo roteiro

- Adaptar `PlaylistStructureScreen` para trabalhar com itens mistos.
- Permitir reordenar musicas e PDFs.
- Permitir colocar PDFs em secoes.
- Manter fallback manual por botoes.
- Validar muito bem em web e Android.

### Fase 5 futura - Backup/restore/exportacao

- Adicionar `quick-pdfs` ao backup completo.
- Preservar `items` e `itemIds`.
- Atualizar restore em modo mesclar.
- Atualizar backup personalizado.
- Atualizar exportacao de lista/pasta.
- Atualizar arquivos legiveis.

### Fase 6 futura - Polimento Android/WebView

- Validar tipos de links publicos.
- Melhorar mensagem quando PDF nao renderizar inline.
- Considerar abrir externo como caminho principal em Android se inline falhar frequentemente.
- So considerar PDF.js/biblioteca se a validacao real justificar o peso.

## 11. Validacoes Android/WebView

Validar em Android real:

- cadastrar PDF1 com link publico;
- cadastrar PDF2 com arquivo escolhido no aparelho;
- deixar PDF3 vazio;
- abrir lista;
- adicionar PDF1;
- confirmar que PDF3 nao aparece no picker;
- colar `E:\amissa.pdf` e confirmar mensagem amigavel orientando usar Escolher PDF;
- tentar arquivo acima de 5 MB e confirmar bloqueio;
- confirmar que PDF1 nao duplica na mesma lista;
- abrir item PDF;
- renderizar inline quando o WebView permitir;
- confirmar que a tela nao apaga durante leitura quando o WebView permitir Wake Lock;
- abrir externo;
- voltar para a playlist;
- trocar de tela e voltar;
- confirmar que SongDetail nao mudou;
- confirmar que auto-scroll nao mudou;
- confirmar que swipe nao mudou;
- confirmar que post-it/audio/modo Play nao mudaram.

Validar links:

- PDF direto publico;
- link que bloqueia embed;
- link invalido;
- link sem `https`;
- link que abre em navegador externo.
- arquivo local escolhido e salvo no app.

## 12. O que NAO fazer agora

- Nao salvar PDF no app.
- Nao baixar PDF.
- Nao criar cache offline.
- Excecao implementada: arquivo escolhido pelo usuario pode ser salvo como Data URL/base64 em `@quick_pdfs`, limitado a 5 MB, sem backup/restore nesta fase.
- Nao usar PDF como musica falsa.
- Nao inserir `pdfId` em `songIds`.
- Nao reutilizar `SongDetailScreen`.
- Nao mexer em auto-scroll.
- Nao mexer em swipe.
- Nao mexer em parser/transposicao.
- Nao mexer em post-it.
- Nao mexer em audio/gravacao/metronomo.
- Nao mexer em modo Play.
- Nao alterar backup/restore na primeira fase.
- Nao adicionar biblioteca pesada sem validacao real.
- Nao tentar resolver Google Drive/Dropbox complexos nesta v1.

## 13. Recomendacao final

Recomendacao: implementar a feature, mas somente com modelo de itens mistos em playlist.

Nao implementar se a alternativa for enfiar PDF em `songIds` ou criar musicas falsas, porque isso tende a quebrar parser, SongDetail, backup, filtros, estatisticas e fluxos de playlist.

Ordem recomendada:

1. Configuracoes + storage dos 3 PDFs.
2. `Playlist.items` opcional + adicionar/renderizar PDF em `PlaylistDetail`.
3. Tela isolada `PdfViewer`.
4. Organizacao/Modo roteiro.
5. Backup/restore/exportacoes.

A primeira entrega real deve ser pequena e explicitamente sem backup/restore. O app pode aceitar essa limitacao temporaria se ela estiver documentada ate a fase de portabilidade.

## Testes e aceite futuros

- [ ] `npx tsc -b`.
- [ ] `npm run build`.
- [ ] Configurar PDF1, PDF2 e PDF3.
- [ ] Limpar slot de PDF.
- [ ] Adicionar PDF a playlist.
- [ ] Confirmar que PDFs sem link nao aparecem.
- [ ] Confirmar que PDF ja adicionado nao duplica na mesma playlist.
- [ ] Confirmar que musicas e PDFs aparecem misturados na ordem correta.
- [ ] Abrir PDF em tela propria.
- [ ] Usar `Abrir externo`.
- [ ] Voltar para a lista.
- [ ] Confirmar que SongDetail, auto-scroll, swipe, post-it, audio e modo Play nao mudaram.
- [ ] Validar Android/WebView real.

## Assumptions

- A v1 permite cada slot PDF no maximo uma vez por playlist.
- A renderizacao inline e melhor esforco; fallback externo e obrigatorio.
- PDFs configurados podem nao entrar em backup/restore ate a fase futura.
- Links devem ser fornecidos pelo usuario e precisam ser publicos para funcionar bem.
- A feature deve continuar isolada de SongDetail e dos motores sensiveis.




Estado Atual Confirmado

- PDFs rápidos funcionam como slots globais.
- Não são copiados para playlists.
- Playlists armazenam apenas referências (pdfId).
- Backup não inclui PDFs rápidos.
- Restore não recria PDFs rápidos.
- Este comportamento é intencional para evitar crescimento excessivo dos backups.