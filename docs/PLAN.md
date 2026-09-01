# Plano Atual do CifrasGo

Atualizado em: 2026-05-20

## Estado do produto

O CifrasGo esta em estado funcional de producao beta. A navegacao manual original segue ativa em `src/App.tsx`, mas as telas principais ja foram extraidas e estabilizadas em `src/screens`.

Recursos atuais principais:

- repertorio local de musicas com busca, generos e transposicao;
- pastas, subpastas e sub-subpastas com mover/adicionar itens existentes e selecao multipla;
- playlists em modo padrao e modo roteiro;
- modo Play com swipe, lista atual em AppModal, controles rapidos e auto-scroll;
- auto-scroll baseado em `window.scrollY`/`window.scrollTo`, com presets V1-V8, personalizado e sincronizacao apos intervencao manual;
- post-it musical com autosave;
- metronomo e gravacao de referencia por musica;
- backup/restauracao defensivos e compartilhamento de listas/pastas;
- importacao online por backend Express no Render;
- fluxo GitHub + Render + UptimeRobot para backend.

## Estrategia tecnica

- Manter a refatoracao incremental fiel: nao ativar `AppNavigator` enquanto a casca manual for a fonte real de drawer, header, back Android, providers e rotas.
- Preservar compatibilidade Android/WebView antes de grandes refatores.
- Preferir ajustes pequenos e testados por `npx tsc -b`/`npm run build`.
- Toda feature relevante deve atualizar `MANUAL_USUARIO.md`, `PROJETO_CONTEXTO.md`, `docs/REFATORACAO.md` e `AboutScreen` quando afetar uso final.

## Prioridades proximas

1. Validar em Android real os fluxos de modo Play, auto-scroll manual, swipe e modais sobrepostos.
2. Manter backend Render monitorado e sincronizado com `.env.production` dos builds Android.
3. Revisar textos e UX em telas pequenas apos cada mudanca grande de modal.
4. Continuar reduzindo acoplamento do `App.tsx` apenas por extracoes fieis.
5. Criar testes manuais documentados para backup/restore, importacao online e organizacao de repertorio.

## Comandos de validacao

```powershell
npx tsc -b
npm run build
npx cap sync android
```

Para backend local:

```powershell
npm run dev
```
