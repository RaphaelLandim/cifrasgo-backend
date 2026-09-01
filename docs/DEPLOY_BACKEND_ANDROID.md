# Deploy Backend Android - CifrasGo

Atualizado em: 2026-05-20

## Situacao atual

O CifrasGo roda como frontend Vite dentro de uma WebView Capacitor. A importacao por URL precisa de um backend Express porque o scraper do Cifra Club nao roda dentro do APK.

Estado atual do fluxo:

- o codigo fica no GitHub;
- o backend Express em `server.ts` esta preparado para deploy no Render;
- o endpoint publico atual usa a base `https://cifrasgo-backend.onrender.com`;
- o UptimeRobot monitora disponibilidade para reduzir surpresa em apresentacoes;
- o Android usa `VITE_API_BASE_URL` no build de producao.

## Por que o backend nao roda no APK

No web local, `npm run dev` sobe:

- frontend Vite;
- backend Express;
- rota `/api/scrape`.

No Android instalado, o APK contem apenas os arquivos estaticos do frontend. O `server.ts` nao e executado no aparelho. Por isso o app Android precisa chamar uma URL absoluta de backend.

`localhost` no Android aponta para o proprio aparelho, nao para o computador.

## Variavel VITE_API_BASE_URL

O cliente `src/services/scraper.ts` monta a API usando:

```txt
VITE_API_BASE_URL
```

No web local, ela pode ficar vazia e o app usa:

```txt
/api/scrape
```

No Android/producao, crie `.env.production` a partir do template:

```powershell
Copy-Item .env.production.example .env.production
```

Conteudo esperado:

```env
VITE_API_BASE_URL=https://cifrasgo-backend.onrender.com
```

Importante: nao incluir `/api/scrape` no final. O service adiciona esse caminho automaticamente.

## Build Android com backend online

```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

Depois instale o APK e teste:

- compartilhar um link do Cifra Club para o CifrasGo;
- abrir Importar Cifras;
- importar por URL;
- abrir a musica importada;
- importar novamente e confirmar que a deduplicacao mostra a musica existente.

## Endpoint de teste

```txt
https://cifrasgo-backend.onrender.com/api/scrape?url=https%3A%2F%2Fwww.cifraclub.com.br%2Ffelipe-rodrigues%2Ftudo-e-perda%2F
```

Resposta esperada:

- `title`;
- `artist`;
- `content`.

## Backend Express

O `server.ts`:

- normaliza URLs do Cifra Club para `https://www.cifraclub.com.br/...`;
- usa `fetch` nativo do Node;
- envia headers de navegador para reduzir bloqueios;
- usa Cheerio para extrair titulo, artista e `<pre>`;
- serve o frontend em producao com fallback SPA compativel com Express 5.

Observacao importante: em Express 5, `app.get("*")` quebra com `path-to-regexp`. O fallback de producao deve usar regex, por exemplo `app.get(/.*/, ...)`.

## Monitoramento

O UptimeRobot deve monitorar a URL publica do backend ou o endpoint `/api/scrape` com uma URL de teste. Se o plano Render dormir, o primeiro acesso pode demorar, mas o monitoramento ajuda a manter a API acordada conforme a politica do plano.

## Teste local por IP da rede

Ainda e possivel testar sem Render:

1. Rodar `npm run dev` no PC.
2. Descobrir o IP do PC na rede.
3. Abrir no celular:

```txt
http://IP_DO_PC:3000/api/scrape?url=https%3A%2F%2Fwww.cifraclub.com.br%2Ffelipe-rodrigues%2Ftudo-e-perda%2F
```

4. Gerar build temporario apontando `VITE_API_BASE_URL` para esse IP.

Esse modo depende da mesma rede Wi-Fi e do firewall permitir acesso.
