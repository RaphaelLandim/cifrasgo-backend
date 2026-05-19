# Deploy Backend Android - CifrasGo

Atualizado em: 2026-05-17

## Situacao Atual

O CifrasGo roda como frontend Vite dentro de uma WebView Capacitor. No web local, quando o app e aberto com `npm run dev`, o mesmo processo sobe:

- o frontend Vite;
- o backend Express em `server.ts`;
- a rota `/api/scrape`, usada para importar musicas do Cifra Club.

Por isso, no navegador do PC, `fetch('/api/scrape?...')` funciona: o browser esta acessando o servidor local do proprio computador.

No APK Android instalado, a situacao muda. O app empacotado contem apenas os arquivos estaticos do frontend dentro da WebView. O backend Express (`server.ts`) nao roda dentro do APK. Entao uma chamada relativa como `/api/scrape` pode cair no HTML do app (`index.html`) em vez de receber JSON. O sintoma classico e:

```txt
Unexpected token '<', "<!doctype"... is not valid JSON
```

Isso significa que o frontend esperava JSON, mas recebeu HTML.

## Regra Importante

`localhost` no Android nao e o `localhost` do PC.

- No PC: `localhost:3000` aponta para o proprio computador.
- No Android/tablet: `localhost:3000` aponta para o proprio aparelho.

Se o backend estiver rodando no PC, o Android precisa chamar o IP do PC na rede, por exemplo:

```txt
http://192.168.0.20:3000
```

## Frontend x Backend

Frontend:

- Vite + React + `react-native-web`;
- empacotado pelo Capacitor;
- fica dentro do APK;
- nao executa scraper sozinho.

Backend:

- `server.ts`;
- Express;
- rota `/api/scrape`;
- usa `fetch` nativo do Node + Cheerio para buscar e parsear o Cifra Club;
- precisa estar disponivel em algum servidor acessivel pelo app Android.

## VITE_API_BASE_URL

O service `src/services/scraper.ts` monta a URL da API a partir de:

```txt
VITE_API_BASE_URL
```

No web local, pode ficar vazio porque o navegador usa o mesmo host:

```txt
/api/scrape
```

No Android, deve ser uma URL absoluta:

```txt
VITE_API_BASE_URL=http://192.168.0.20:3000
```

ou, no futuro:

```txt
VITE_API_BASE_URL=https://api.seu-dominio.com
```

O projeto mantem um template versionado:

```txt
.env.production.example
```

Para gerar um APK com backend online, copie o template para um arquivo local nao versionado:

```powershell
Copy-Item .env.production.example .env.production
```

Depois edite `.env.production`:

```env
VITE_API_BASE_URL=https://URL-DO-BACKEND-ONLINE
```

Importante: a URL deve ser apenas a base do backend, sem `/api/scrape` no final. O service adiciona `/api/scrape` automaticamente.

Se o APK estiver sem `VITE_API_BASE_URL` absoluto, o app deve mostrar mensagem clara:

```txt
API de importacao indisponivel no Android. Configure VITE_API_BASE_URL com a URL do backend online de importacao.
```

## Teste Local Via IP Da Rede

1. Descobrir o IP do PC na rede Wi-Fi.
2. Rodar o backend local:

```powershell
npm run dev
```

3. Conferir no celular/tablet se abre no navegador:

```txt
http://IP_DO_PC:3000/api/scrape?url=https%3A%2F%2Fwww.cifraclub.com.br%2Ffelipe-rodrigues%2Ftudo-e-perda%2F
```

4. Gerar build do frontend apontando para esse IP:

```powershell
$env:VITE_API_BASE_URL="http://IP_DO_PC:3000"
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

5. Instalar o APK gerado e testar compartilhamento/importacao.

Observacao: o PC e o Android precisam estar na mesma rede e o firewall do Windows precisa permitir acesso na porta `3000`.

## Estado Pausado Temporariamente

A correcao estrutural do backend online ainda depende de publicar uma URL real, mas o projeto ja esta preparado para receber essa configuracao via `.env.production`. Hoje o app ja:

- evita tentar parsear HTML como JSON;
- mostra erro claro quando a API nao esta disponivel no Android;
- funciona no web local com `npm run dev`;
- pode funcionar no Android apontando `VITE_API_BASE_URL` para um backend acessivel;
- possui `.env.production.example` como template seguro.

O proximo passo real de produto e hospedar o backend e preencher `.env.production` localmente antes do build Android.

## Opcoes Futuras De Hospedagem

Render:

- simples para Express;
- bom para API pequena;
- pode dormir no plano gratuito.

Railway:

- deploy rapido;
- boa DX para Node;
- normalmente simples para variaveis de ambiente.

Vercel:

- boa para frontend/serverless;
- pode exigir adaptar o Express para rota serverless;
- avaliar limite/timeouts para scraping.

## Passo A Passo Futuro

1. Subir o projeto para GitHub.
2. Separar ou configurar o backend `server.ts` para deploy.
3. Fazer deploy em Render, Railway ou Vercel.
4. Testar endpoint publico:

```txt
https://sua-api.com/api/scrape?url=https%3A%2F%2Fwww.cifraclub.com.br%2Ffelipe-rodrigues%2Ftudo-e-perda%2F
```

5. Criar `.env.production` local a partir do template:

```powershell
Copy-Item .env.production.example .env.production
```

6. Editar `.env.production`:

```env
VITE_API_BASE_URL=https://sua-api.com
```

7. Gerar o APK com:

```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

8. Instalar no celular/tablet e testar:

- compartilhar link do Cifra Club para CifrasGo;
- abrir `ImportScreen`;
- auto-importar;
- abrir `SongDetail`;
- tentar importar a mesma musica novamente e confirmar modal de musica existente.

Endpoint de teste atual:

```txt
https://sua-api.com/api/scrape?url=https%3A%2F%2Fwww.cifraclub.com.br%2Fdiante-do-trono%2Fme-ama-%2F
```

## Scraper Cifra Club

O scraper atual em `server.ts`:

- normaliza URLs do Cifra Club para `https://www.cifraclub.com.br/...`;
- usa `fetch` nativo do Node, nao `axios`;
- envia headers de navegador para evitar 403 do Akamai;
- usa Cheerio para extrair titulo, artista e `<pre>`.

Link de teste validado localmente:

```txt
https://www.cifraclub.com.br/felipe-rodrigues/tudo-e-perda/
```

Resultado esperado:

- titulo: `Tudo É Perda`;
- artista: `Felipe Rodrigues`;
- conteudo da cifra com intro e acordes.
