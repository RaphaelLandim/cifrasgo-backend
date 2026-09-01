# Manual do Usuario - CifrasGo

Atualizado em: 2026-05-31

Este manual e a documentacao viva do CifrasGo. Sempre que uma funcionalidade relevante mudar a forma de usar o app, este arquivo, a tela **Sobre / Guia do usuario** e a documentacao tecnica devem ser revisados.

## 1. O que e o CifrasGo

O CifrasGo e um app para organizar repertorio musical, cifras, listas, pastas e anotacoes de ensaio. Ele foi pensado para musicos, ministerios, igreja, apresentacoes e estudo pessoal.

O app e offline-first: o repertorio salvo fica no aparelho/navegador. A internet e usada principalmente para importar cifras por URL e para compartilhar/baixar arquivos quando o ambiente exigir.

## 2. Guia rapido

- Use **Musicas** para ver e buscar todas as cifras.
- Use **Importar Cifras** para trazer uma musica por URL com o backend online do CifrasGo.
- Use **Pastas/Listas** para organizar repertorios por evento, grupo ou celebracao.
- Use **Modo Play** para tocar um repertorio com cifra em foco, swipe, lista atual e auto-scroll.
- Use **Configuracoes** para tema, filtros, aparencia, backup e guia.

## 3. Musicas e SongDetail

Cada musica pode conter titulo, artista, cifra/letra, generos, observacao, URL de origem, link do YouTube, fonte visual, metronomo, gravacao de referencia e post-it musical.

No editor, o link do YouTube fica no icone dedicado ao lado dos recursos da musica, perto de gravacao e metronomo. O icone fica neutro quando nao ha link e vermelho quando a musica ja tem uma referencia cadastrada.

Na tela da musica e possivel:

- transpor tom;
- ajustar fonte;
- ativar **Modo Vocalista**, que oculta acordes durante a leitura sem alterar a musica original salva;
- entrar no modo Play;
- abrir o editor;
- adicionar a musica atual a uma lista existente;
- abrir o link do YouTube vinculado no player do app ou externamente, quando cadastrado;
- ocultar/exibir botoes inferiores;
- ouvir gravacao de referencia;
- abrir e editar post-it musical.

O link do YouTube pode abrir um player simples dentro do modal da musica ou ser aberto externamente no YouTube. O CifrasGo nao baixa video, nao baixa audio, nao faz cache e nao reproduz em background. A disponibilidade depende da internet, do YouTube e do WebView/navegador.

Enquanto a tela da musica estiver aberta, o app tenta manter a tela acordada usando o recurso de Wake Lock do navegador/WebView, quando disponivel. Ao sair da musica, o comportamento normal de descanso da tela volta.

Se a musica foi aberta a partir de uma lista, o modo Play mantem o contexto da lista.

## 4. Transposicao e acordes

A transposicao visual altera o tom exibido sem reescrever automaticamente o conteudo salvo.

Em **Configuracoes > Acordes e transposicao**, escolha a preferencia de escrita:

- **Sustenidos:** prefere `#`, como `A#`, `C#`, `D#`, `F#`, `G#`;
- **Bemois:** prefere `b`, como `Bb`, `Db`, `Eb`, `Gb`, `Ab`;
- **Misto / Popular:** usa uma grafia comum no repertorio popular.

O parser reconhece acordes simples, slash chords e extensoes com parenteses, como `G7(b9)`, `C7(#9)` e `F#m7(b5)`, evitando falsos positivos em frases comuns.

## 5. Pastas e subpastas

A estrutura oficial usa ate tres niveis:

- Pasta;
- Subpasta;
- Sub-subpasta.

Na tela Pastas/Listas, as abas mostram itens de todos os niveis para evitar que listas ou subpastas fiquem escondidas. Itens aninhados mostram contexto no subtitulo.

Em **Configuracoes > Ajustes de pastas/listas e PDF**, e possivel ativar estrelas para priorizar acesso rapido. Itens marcados aparecem primeiro, mantendo ordem alfabetica entre marcados e nao marcados. A estrela nao altera conteudo, vinculos ou estrutura.

No mesmo ajuste, a ordem visual de pastas/listas pode ser escolhida:

- **Pastas primeiro:** pastas marcadas A-Z, pastas normais A-Z, listas marcadas A-Z e listas normais A-Z;
- **Listas primeiro:** listas marcadas A-Z, listas normais A-Z, pastas marcadas A-Z e pastas normais A-Z;
- **Misturado por nome:** itens marcados primeiro A-Z e, depois, pastas e listas juntas em ordem alfabetica.

No modo **Misturado por nome**, pastas e listas realmente se misturam pelo nome. Por exemplo, uma pasta "Adoracao" pode aparecer antes de uma lista "Banda Base", seguida de uma pasta "Celula Jovem", independentemente do tipo.

A prioridade por estrela tambem aparece nos principais modais de escolha de pastas/listas, como adicionar musica a lista, enviar musica para lista e selecionar destinos de pasta.

Dentro de uma pasta e possivel:

- criar subpasta/sub-subpasta dentro do limite;
- criar lista;
- adicionar musicas;
- mover/adicionar listas existentes;
- mover/adicionar subpastas existentes sem copiar e sem criar ciclos;
- usar selecao multipla para adicionar/mover varios itens;
- compartilhar/exportar a pasta completa;
- remover vinculos de musicas da pasta.

Ao compartilhar uma pasta, o CifrasGo exporta a arvore interna, incluindo subpastas, listas, musicas e vinculos.

## 6. Playlists / Listas

Listas organizam sequencias de musicas. Existem dois modos:

- **Modo padrao:** lista simples com ordem de musicas.
- **Modo roteiro:** lista com secoes, cores e organizacao por momentos.

Na tela da lista e possivel:

- buscar musicas dentro da lista;
- adicionar musicas individualmente ou por selecao multipla;
- adicionar PDFs rapidos cadastrados em Configuracoes como itens especiais no Modo padrao;
- remover musica com confirmacao;
- reorganizar musicas;
- abrir musica preservando o contexto da lista;
- compartilhar a lista.
- exportar listas para PDF, com acordes ou em **Modo Vocalista** sem acordes, para imprimir ou compartilhar repertorios.

PDFs rapidos:

- em **Configuracoes > Ajustes de pastas/listas e PDF > PDFs rapidos**, cadastre ate 3 PDFs por link publico ou por arquivo escolhido no aparelho;
- os slots PDF1, PDF2 e PDF3 aparecem recolhidos; toque em um slot para editar nome, link, arquivo ou limpar;
- caminhos locais digitados, como `E:\amissa.pdf`, nao funcionam como link; use **Escolher PDF** para arquivos do aparelho;
- arquivos escolhidos ficam salvos apenas neste app e podem ocupar espaco; o limite atual e 5 MB por PDF;
- em uma lista no Modo padrao, use **Opcoes da lista > Adicionar PDF** para incluir um PDF configurado;
- ao tocar no item PDF, o app abre uma tela propria com visualizacao inline em melhor esforco e botao **Abrir externo**;
- a tela do PDF usa o titulo real no topo e prioriza a area de leitura do documento;
- no Android/WebView, alguns links podem nao renderizar dentro do app por bloqueio do servidor; nesse caso, use **Abrir externo**;
- para PDFs escolhidos como arquivo local, o botao **Abrir externo** fica indisponivel porque nao ha link publico externo.
- enquanto a tela de PDF estiver aberta, o app tenta manter a tela acordada quando o navegador/WebView permitir.

No Modo roteiro, e possivel criar secoes, mover musicas entre secoes, reorganizar secoes e aplicar cores opcionais.

## 7. Modo Play e Auto-scroll

O modo Play e voltado para execucao ao vivo:

- header compacto com titulo, artista, metronomo e controles;
- cifra em foco;
- Controles Rapidos;
- Lista atual em AppModal;
- swipe horizontal para musica anterior/proxima quando a musica veio de uma lista.

Auto-scroll:

- usa presets `V1` a `V8` em `px/s`;
- aceita velocidade personalizada de 5 a 150 px/s;
- usa `window.scrollY`/`window.scrollTo` como motor;
- para automaticamente no fim da musica;
- ao rolar manualmente durante o auto-scroll, sincroniza a posicao e continua a partir de onde o usuario deixou.

Atalhos de palco:

- pedais Bluetooth que funcionam como teclado fisico podem controlar o Modo Play;
- `Space` liga/desliga o auto-scroll;
- `PageDown` ou `ArrowDown` avanca para a proxima musica da lista;
- `PageUp` ou `ArrowUp` volta para a musica anterior da lista;
- `Escape` fecha modais/menus do Play ou sai do modo Play quando nao houver nada aberto;
- os atalhos nao sao capturados dentro de campos de texto, busca, editor ou areas editaveis.

## 8. Post-it musical

O post-it e um lembrete rapido por musica. Ele pode ser criado, editado, movido, redimensionado, colorido, ocultado e excluido.

O texto salva automaticamente. O X apenas esconde a nota; para apagar de verdade, use **Excluir anotacao** no menu interno.

## 9. Gravacao de referencia

A gravacao de referencia permite salvar um trecho curto de audio por musica para lembrar melodia, entrada, ritmo ou conducao.

Na tela da musica, o mini player permite play/pause, progresso, tempo atual, duracao e busca por posicao.

No Android/Capacitor, o app precisa da permissao de microfone concedida pelo usuario.

## 10. Metronomo

O metronomo e configurado por musica no editor:

- BPM;
- compasso;
- beep visual;
- beep sonoro.

O modal do editor permite testar o metronomo antes de salvar. Na tela da musica, indicadores no topo mostram e controlam o estado. O som usa Web Audio API quando disponivel.

## 11. Temas, aparencia e filtros

Em Configuracoes, o usuario pode ajustar tema escuro, tema claro, tema personalizado, cores de cifra/editor, acordes e letra.

Ao alternar entre claro e escuro, o app aplica cores seguras para manter a cifra legivel.

Em **Configuracoes > Generos**, alem de filtrar e gerenciar generos cadastrados, existe a tela **Organizar musicas por genero**. Ela permite fazer um mutirao de classificacao: filtrar musicas por titulo, artista, genero ou sem genero, selecionar varias musicas e adicionar, remover ou substituir generos em lote. A musica original nao e duplicada; apenas os generos das musicas selecionadas sao atualizados apos confirmacao.

Tambem e possivel configurar os ajustes de pastas/listas:

- **Nao marcar listas/pastas:** mantem a ordenacao alfabetica normal;
- **Marcar apenas uma:** permite uma pasta marcada e uma lista marcada;
- **Marcar varias:** permite varios itens marcados no topo.
- **Pastas primeiro, Listas primeiro ou Misturado por nome:** controla a ordem visual em Pastas/Listas e dentro das pastas.

O filtro global de generos afeta musicas e listas, mas preserva estruturas vazias para que o usuario nao perca itens recem-criados.

## 12. Backup e restauracao

O CifrasGo possui backup/restauracao em modo mesclar. Isso preserva o que ja existe e deduplica dados sempre que possivel.

Existem duas formas principais de gerar backup:

- **Backup completo:** exporta todo o acervo, incluindo musicas, listas, pastas, vinculos, generos e configuracoes uteis.
- **Backup personalizado:** permite montar um pacote sob medida escolhendo musicas individuais, artistas inteiros, listas, pastas ou uma mescla dessas categorias.

No backup personalizado, listas incluem suas musicas, artistas incluem todas as musicas daquele artista, e pastas incluem a arvore selecionada com subpastas, listas, musicas vinculadas e vinculos necessarios. O app deduplica musicas no pacote final para evitar copias repetidas.

Na mesma tela existe **Exportar PDF**, um fluxo separado do backup ZIP. Ele gera um PDF unico a partir de uma lista/playlist para imprimir ou compartilhar em ensaios, celebracoes e uso de vocalistas.

Ao exportar PDF, escolha:

- lista/playlist;
- **Com acordes** ou **Modo vocalista**;
- tamanho da fonte;
- quebra de pagina entre musicas;
- incluir ou ocultar titulo;
- incluir ou ocultar artista.

No **Modo vocalista**, os acordes sao removidos apenas no PDF gerado. A musica original continua salva com acordes, sem duplicacao e sem alterar storage. PDFs rapidos que estejam misturados na lista nao entram nesta exportacao nesta fase; o PDF gerado contem apenas as musicas.

Formatos aceitos:

- backup completo CifrasGo;
- backup personalizado CifrasGo;
- backup/lista CifrasGo antigo;
- exportacao de lista;
- exportacao de pasta/subpasta;
- musica TXT CifrasGo;
- TXT simples;
- ZIP legado com `.cfs`;
- listas antigas com prefixo `[List]-`.

O restore e defensivo: normaliza playlists/secoes, tolera campos ausentes e ignora partes invalidas sem abortar tudo.

## 13. Importacao online

No web local, `npm run dev` sobe o frontend e o backend Express juntos. No APK Android, o backend nao roda dentro do app.

Para Android, o build usa `VITE_API_BASE_URL` em `.env.production`, apontando para o backend online no Render. O endpoint esperado e:

```txt
https://cifrasgo-backend.onrender.com/api/scrape
```

A importacao online exige internet, mas as musicas importadas ficam salvas localmente para uso offline.

O fluxo atual usa GitHub para codigo, Render para deploy do backend e UptimeRobot para monitoramento.

## 14. Tela inicial

A HomeDashboard e uma tela opcional de boas-vindas com estatisticas, atalhos, sugestoes e resumo de filtros. Ela pode ser ativada ou desativada nas Configuracoes.

## 15. Restaurar padrao de fabrica

Em Configuracoes existe a opcao de apagar todos os dados locais. Ela exige confirmacao e limpa musicas, listas, pastas, generos, filtros e configuracoes.

Use apenas depois de gerar backup.

PDFs rápidos são recursos auxiliares opcionais.

Os slots PDF1, PDF2 e PDF3 não fazem parte do backup.

Após restaurar um backup, os PDFs rápidos precisam ser configurados novamente em Configurações.

Itens PDF podem desaparecer das playlists restauradas sem afetar músicas, pastas, listas ou estrutura principal do repertório.

## 16. Dicas de uso

- Crie uma lista por celebracao, apresentacao ou ensaio.
- Use Modo roteiro para organizar Entrada, Gloria, Comunhao e outros momentos.
- Use post-it para lembretes que precisam aparecer durante a execucao.
- Use gravacao de referencia para lembrar melodia ou conducao.
- Use pastas para separar grupos, eventos ou repertorios recorrentes.
- Faca backup completo com frequencia.

## 17. Sobre / Guia do usuario

A tela **Sobre / Guia do usuario** apresenta o CifrasGo de forma resumida e madura: foco offline-first, uso real em missa/palco/repertorio, Modo Play, PDFs rapidos, backup, importacao, ajustes e filosofia do projeto.

Ela tambem reforca a diretriz atual: **Estabilidade > refatoracao infinita**. O objetivo e evoluir por fatias pequenas, mantendo o app leve, confiavel e util durante celebracoes, ensaios e apresentacoes.

## 18. Estatísticas



## 19. Documentacao viva

Toda feature relevante deve atualizar:

- `MANUAL_USUARIO.md`;
- `PROJETO_CONTEXTO.md`;
- `docs/REFATORACAO.md`;
- a tela `src/screens/AboutScreen.tsx`, quando a mudanca impactar o uso final.

Essa regra evita perda de contexto e mantem o app pronto para continuidade por outra pessoa ou IA.
