# Manual do Usuário - CifrasGo

Atualizado em: 2026-05-17

Este manual é a documentação viva do CifrasGo. Sempre que uma funcionalidade relevante mudar a forma de usar o app, este arquivo, a tela **Sobre / Guia do usuário** e a documentação técnica devem ser revisados.

## 1. O que é o CifrasGo

O CifrasGo é um app para organizar repertório musical, cifras, listas, pastas e anotações de ensaio. Ele foi pensado para músicos, ministérios, igreja, apresentações e estudo pessoal.

O app funciona com dados locais no aparelho/navegador e oferece recursos de leitura, organização, backup, importação, compartilhamento e apoio durante a execução.

## 2. Guia rápido

- Use **Músicas** para ver e buscar todas as cifras.
- Use **Importar Cifras** para trazer uma música por URL quando o backend de importação estiver disponível.
- Use **Pastas/Listas** para organizar repertórios por evento, grupo ou celebração.
- Use **Configurações** para tema, filtros, aparência da cifra, backup e guia.
- Use **Sobre / Guia do usuário** para consultar este resumo dentro do app.

## 3. Músicas e edição

Cada música pode conter:

- título;
- artista;
- conteúdo da cifra/letra;
- gêneros;
- observação;
- URL de origem;
- fonte/tamanho visual;
- metrônomo;
- gravação de referência;
- post-it musical.

Na tela da música, é possível:

- transpor tom;
- ajustar tamanho da fonte;
- entrar no modo apresentação;
- quando aberta por uma lista, usar swipe no modo apresentação para ir à próxima música ou voltar à anterior;
- editar a música;
- ocultar/exibir a barra inferior de controles;
- ouvir gravação de referência, quando existir;
- abrir e editar o post-it musical.

## 4. Transposição

A transposição visual altera o tom exibido sem mudar imediatamente o conteúdo salvo. Se você abrir o editor a partir de uma música transposta, o editor pode receber a cifra no tom atualmente exibido. Ao salvar, esse conteúdo passa a ser a nova base da música.

Em **Configurações > Acordes e transposição**, escolha a preferência de escrita dos acordes:

- **Sustenidos:** prefere `#`, como `A#`, `C#`, `D#`, `F#`, `G#`;
- **Bemóis:** prefere `b`, como `Bb`, `Db`, `Eb`, `Gb`, `Ab`;
- **Misto / Popular:** usa uma grafia comum no repertório popular, como `A Bb B C C# D D# E F F# G G#`.

A preferência afeta a transposição visual e o seletor de tom. Ela não reescreve automaticamente o texto salvo da cifra.

## 5. Pastas e subpastas

Pastas ajudam a agrupar repertórios. A estrutura oficial usa até três níveis:

- Pasta;
- Subpasta;
- Sub-subpasta.

Dentro de uma pasta é possível:

- criar subpastas até o limite permitido;
- criar listas;
- adicionar músicas diretamente à pasta;
- mover listas;
- renomear;
- compartilhar/exportar a pasta completa;
- remover vínculos de músicas da pasta.

Ao compartilhar uma pasta, o CifrasGo exporta a estrutura interna abaixo dela, incluindo subpastas, listas, músicas e vínculos.

## 6. Playlists / Listas

Listas organizam sequências de músicas. Existem dois modos:

- **Modo padrão:** lista simples com ordem de músicas.
- **Modo roteiro:** lista com seções, útil para celebrações, cultos, apresentações e ensaios.

No Modo roteiro, é possível:

- criar seções;
- mover músicas entre seções;
- reorganizar músicas;
- reorganizar seções;
- aplicar cores opcionais por seção;
- manter fallback por botões quando drag/drop não for ideal.

Listas antigas continuam compatíveis mesmo sem campos novos como `viewMode`, `sections` ou `section.color`.

Ao abrir uma música a partir de uma lista e entrar no modo apresentação, o rodapé mostra a próxima música. Deslize para a esquerda para avançar e para a direita para voltar, sem perder o contexto da lista.

No modo apresentação, o modal **Controles Rápidos** também oferece **Auto-scroll**. Escolha uma velocidade de `V1` a `V8`, exibida em `px/s` (pixels por segundo), ou use `Personalizado` para informar um valor entre 5 e 150 px/s. Toque em `Iniciar` para a cifra rolar automaticamente e em `Parar` para interromper; ao chegar no fim da música, a rolagem para sozinha.

## 7. Post-it musical

O post-it musical é um lembrete rápido por música, ideal para observações de performance:

- "Entrar suave no refrão";
- "Solo após a ponte";
- "Parar bateria no final";
- "Começar só voz e teclado".

Na tela da música, o post-it pode ser:

- criado pelo botão de post-it na barra inferior;
- editado diretamente na tela da música;
- movido;
- redimensionado;
- colorido;
- escondido com X;
- excluído pelo menu interno.

O X apenas oculta a nota. Para apagar de verdade, use **Excluir anotação** no menu do post-it.

## 8. Gravação de referência

A gravação de referência permite salvar um trecho curto de áudio por música para lembrar melodia, entrada, ritmo ou condução.

No editor:

- toque no botão REC;
- permita o microfone;
- grave até 30 segundos;
- ouça a prévia;
- salve ou apague a gravação.

Na tela da música:

- quando existir gravação, aparece um botão de áudio na barra inferior;
- ao tocar, abre um mini player;
- o mini player tem play/pause, progresso, tempo atual, duração e busca por posição.

No Android/Capacitor, o app precisa da permissão de microfone no manifesto e da permissão concedida pelo usuário.

## 9. Metrônomo

O metrônomo é configurado por música. No editor, é possível salvar:

- BPM;
- compasso;
- beep visual;
- beep sonoro.

Na tela da música, os indicadores no topo mostram o estado do metrônomo. O som usa Web Audio API quando disponível. Navegadores/WebViews podem exigir interação do usuário antes de liberar áudio.

## 10. Gêneros e filtro global

O app possui gêneros padrão e permite gêneros personalizados. O filtro global afeta listas e músicas, mas preserva listas e pastas vazias para que o usuário não perca itens recém-criados.

Gêneros padrão:

- Forró;
- Funk;
- Gospel;
- MPB;
- Pop;
- Rock;
- Samba;
- Sertanejo;
- Sem gênero.

## 11. Tela inicial

A HomeDashboard é uma tela opcional de boas-vindas. Ela pode mostrar:

- saudação personalizada;
- estatísticas;
- músicas recentes/sugeridas;
- atalhos rápidos;
- resumo do filtro de gênero;
- ações visuais para escolher gênero e criar lista.

Nas Configurações, é possível ativar ou desativar a tela inicial ao abrir o app.

## 12. Temas e aparência

Em Configurações, o usuário pode ajustar:

- tema escuro;
- tema claro;
- tema personalizado;
- cores principais;
- aparência de acordes;
- aparência da letra;
- aparência do editor;
- visibilidade global da barra inferior da música.

Ao alternar entre tema escuro e tema claro, o app aplica defaults seguros para a cifra: letra clara e acorde amarelo no escuro; letra preta e acorde azul no claro. Depois da troca, o usuário ainda pode personalizar as cores manualmente.

O app usa variáveis CSS como `--app-bg`, `--app-surface`, `--app-header`, `--app-accent` e `--app-border-soft` para manter consistência visual.

## 13. Backup e importação

O CifrasGo possui backup/restauração em modo mesclar. Isso significa que importar um backup tenta preservar o que já existe e deduplicar dados.

Formatos aceitos:

- backup completo CifrasGo;
- backup/lista CifrasGo antigo;
- exportação de lista;
- exportação de pasta/subpasta;
- música TXT híbrida CifrasGo;
- TXT simples;
- ZIP legado com `.cfs`;
- listas antigas com prefixo `[List]-`.

O restore é defensivo:

- não assume que arrays existem;
- normaliza playlists e seções;
- preserva o máximo possível;
- ignora partes inválidas sem abortar todo o restore.

Antes de resetar ou trocar de aparelho, gere um backup completo.

## 14. Restaurar padrão de fábrica

Em Configurações existe a opção de apagar todos os dados locais. Ela exige duas confirmações e limpa músicas, listas, pastas, gêneros, filtros e configurações.

Use essa opção apenas depois de gerar backup, pois a ação não tem volta.

## 15. Importação por URL e Android

No web local, a importação por Cifra Club depende do servidor Express local (`server.ts`). No Android instalado, o APK precisa de um backend online configurado por `VITE_API_BASE_URL`; `localhost` no celular não é o computador.

Veja `docs/DEPLOY_BACKEND_ANDROID.md` para o plano de backend online.

## 16. Dicas de uso

- Crie uma lista por celebração, apresentação ou ensaio.
- Use Modo roteiro para organizar Entrada, Ato Penitencial, Glória, Comunhão e outros momentos.
- Use post-it para lembretes que precisam aparecer durante a execução.
- Use gravação de referência para lembrar uma melodia ou condução.
- Use pastas para separar grupos, eventos ou repertórios recorrentes.
- Faça backup completo com frequência.

## 17. Documentação viva

Toda feature relevante deve atualizar:

- `MANUAL_USUARIO.md`;
- `PROJETO_CONTEXTO.md`;
- `docs/REFATORACAO.md`;
- a tela `src/screens/AboutScreen.tsx`, quando a mudança impactar o uso final.

Essa regra evita perda de contexto e mantém o app pronto para continuidade por outra pessoa ou IA.
