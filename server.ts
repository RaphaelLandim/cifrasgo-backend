import express from "express";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import path from "path";

type JsonLdRecord = Record<string, unknown>;

class ScrapeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly type: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isRecord(value: unknown): value is JsonLdRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getJsonLdTypes(value: unknown): string[] {
  const types = isRecord(value) ? value["@type"] : undefined;
  if (typeof types === "string") return [types];
  return Array.isArray(types) ? types.filter((type): type is string => typeof type === "string") : [];
}

function parseJsonLd($: cheerio.CheerioAPI): JsonLdRecord[] {
  const entries: JsonLdRecord[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const parsed: unknown = JSON.parse($(element).text());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];

      for (const candidate of candidates) {
        if (!isRecord(candidate)) continue;
        entries.push(candidate);

        const graph = candidate["@graph"];
        if (Array.isArray(graph)) {
          entries.push(...graph.filter(isRecord));
        }
      }
    } catch {
      // Ignore malformed third-party metadata and continue through the fallbacks.
    }
  });

  return entries;
}

function getNestedName(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(getNestedName).find(Boolean) || "";
  }
  return isRecord(value) ? normalizeText(value.name) : "";
}

function parseSeoSongLabel(value: string): { title: string; artist: string } | null {
  const normalized = normalizeText(value).replace(/\s+(?:-|\|)\s+Cifra Club$/i, "");
  const separatorIndex = normalized.lastIndexOf(" - ");
  if (separatorIndex <= 0) return null;

  const title = normalizeText(normalized.slice(0, separatorIndex));
  const artist = normalizeText(normalized.slice(separatorIndex + 3));
  return title && artist ? { title, artist } : null;
}

function extractCifraClubSong($: cheerio.CheerioAPI): {
  title: string;
  artist: string;
  content: string;
} {
  const jsonLd = parseJsonLd($);
  const composition = jsonLd.find((entry) => getJsonLdTypes(entry).includes("MusicComposition"));
  const recording = jsonLd.find((entry) => getJsonLdTypes(entry).includes("MusicRecording"));
  const article = jsonLd.find((entry) => getJsonLdTypes(entry).includes("Article"));

  const seoCandidates = [
    $('meta[property="og:title"]').attr("content"),
    $('meta[name="twitter:title"]').attr("content"),
    $("title").first().text(),
  ];
  const seoSong = seoCandidates.map((value) => parseSeoSongLabel(value || "")).find(Boolean);

  const title =
    normalizeText(composition?.name) ||
    normalizeText(recording?.headline) ||
    normalizeText(article?.headline) ||
    seoSong?.title ||
    normalizeText($("h1").first().text()) ||
    normalizeText($("h1.t1").first().text());

  const artist =
    getNestedName(recording?.byArtist) ||
    getNestedName(recording?.author) ||
    getNestedName(article?.author) ||
    seoSong?.artist ||
    normalizeText($("h2.t3").first().text());

  return {
    title,
    artist,
    // Preserve spacing because chord alignment depends on the original preformatted text.
    content: $("pre").first().text().trim(),
  };
}

function isBlockedOrChallengePage($: cheerio.CheerioAPI, html: string): boolean {
  const pageTitle = normalizeText($("title").first().text()).toLowerCase();
  const sample = `${pageTitle}\n${html.slice(0, 20000)}`.toLowerCase();
  return [
    "site bloqueado",
    "access denied",
    "request blocked",
    "verify you are human",
    "captcha",
    "cf-chl-",
  ].some((marker) => sample.includes(marker));
}

function normalizeScrapeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (parsed.hostname.toLowerCase().endsWith("cifraclub.com.br")) {
    parsed.protocol = "https:";
    parsed.hostname = "www.cifraclub.com.br";
    parsed.hash = "";
  }

  return parsed.toString();
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use((_, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
  });
  app.use(express.json());

  app.get("/api/scrape", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    let scrapeHostname = "unknown";
    try {
      let requestUrl: string;
      try {
        requestUrl = normalizeScrapeUrl(url);
      } catch {
        return res.status(400).json({ error: "URL inválida." });
      }
      const requestHostname = new URL(requestUrl).hostname.toLowerCase();
      scrapeHostname = requestHostname;
      const isCifraClubUrl = requestHostname.endsWith("cifraclub.com.br");

      const response = await fetch(requestUrl, {
        redirect: "follow",
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Referer: "https://www.cifraclub.com.br/",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        console.warn("Scrape upstream request failed", {
          hostname: requestHostname,
          status: response.status,
          type: "upstream_http_error",
        });
        throw new ScrapeError("O site da cifra não respondeu corretamente.", 502, "upstream_http_error", {
          upstreamStatus: response.status,
        });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      if (isBlockedOrChallengePage($, html)) {
        console.warn("Scrape blocked by upstream", {
          hostname: requestHostname,
          status: response.status,
          type: "upstream_blocked",
        });
        throw new ScrapeError(
          "O site da cifra bloqueou temporariamente a consulta.",
          502,
          "upstream_blocked",
        );
      }

      let title = "";
      let artist = "";
      let content = "";

      if (isCifraClubUrl) {
        ({ title, artist, content } = extractCifraClubSong($));
      } else {
        title = normalizeText($("h1").first().text());
        artist = normalizeText($("h2").first().text());
        content = $("pre").first().text().trim() || $("code").first().text().trim();
      }

      const missing = [
        !title && "title",
        !artist && "artist",
        !content && "content",
      ].filter((field): field is string => Boolean(field));

      if (missing.length > 0) {
        console.warn("Scrape extraction incomplete", {
          hostname: requestHostname,
          status: response.status,
          missing,
          type: "incomplete_extraction",
        });
        return res.status(422).json({
          error: "Não foi possível extrair todos os dados da cifra.",
          missing,
        });
      }

      return res.json({ title, artist, content });
    } catch (error) {
      const status = error instanceof ScrapeError ? error.status : 500;
      console.error("Scraping error", {
        hostname: scrapeHostname,
        type: error instanceof ScrapeError ? error.type : "unexpected_error",
        message: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof ScrapeError ? error.details : undefined,
      });
      return res.status(status).json({
        error: error instanceof Error ? error.message : "Não foi possível importar esta cifra.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get(/.*/, (_, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
