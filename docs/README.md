# CifrasGo

CifrasGo e um app offline-first para organizar cifras, repertorios, listas, pastas e recursos de apoio para ensaio, igreja e palco.

O projeto roda como frontend Vite/React com `react-native-web`, empacotado para Android via Capacitor. A importacao online usa um backend Express (`server.ts`) publicado no Render.

## Estado atual

- Biblioteca local de musicas com busca, generos, transposicao e preferencias de escrita de acordes.
- Pastas, subpastas e sub-subpastas com visual de hierarquia, busca, mover/adicionar itens existentes e selecao multipla.
- Playlists em modo padrao ou modo roteiro, com secoes, cores, organizacao e compartilhamento.
- SongDetail com modo Play, lista atual em AppModal, swipe entre musicas da lista, auto-scroll V1-V8/personalizado e intervencao manual sincronizada.
- Post-it musical com autosave, posicao/tamanho/cor/visibilidade por musica.
- Gravacao de referencia com mini player e seek.
- Metronomo por musica com preview no editor, beep visual e beep sonoro.
- Backup/restauracao defensivos, exportacao de listas/pastas e compatibilidade com formatos antigos, `.cfs` e `.txt`.
- Importacao online por URL via backend Render, funcionando em web e Android quando `VITE_API_BASE_URL` aponta para o backend.

## Desenvolvimento

```powershell
npm install
npm run dev
```

`npm run dev` sobe o Express e o Vite middleware no mesmo processo. A rota `/api/scrape` fica disponivel localmente.

Build web:

```powershell
npm run build
```

Android:

```powershell
npm run android:sync
npx cap open android
```

## Backend de importacao

No APK Android o backend nao roda dentro do app. Para importacao online, crie `.env.production` a partir de `.env.production.example`:

```env
VITE_API_BASE_URL=https://cifrasgo-backend.onrender.com
```

A URL deve ser a base do backend, sem `/api/scrape` no final.

Fluxo atual:

- GitHub hospeda o codigo.
- Render publica o backend Express.
- UptimeRobot monitora a disponibilidade do endpoint.

Veja `docs/DEPLOY_BACKEND_ANDROID.md`.

## Documentacao

- `MANUAL_USUARIO.md`: manual vivo do app.
- `PROJETO_CONTEXTO.md`: contexto tecnico e estado atual.
- `docs/REFATORACAO.md`: historico da extracao/refatoracao incremental.
- `docs/AUTO_SCROLL_DEBUG.md`: historico e contrato tecnico do auto-scroll.
- `docs/DEPLOY_BACKEND_ANDROID.md`: deploy do backend online e build Android.

Toda feature relevante deve atualizar o manual, a tela Sobre/Guia e a documentacao tecnica afetada.
