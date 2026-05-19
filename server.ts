import express from "express";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import path from "path";

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

    try {
      const requestUrl = normalizeScrapeUrl(url);
      const isCifraClubUrl = new URL(requestUrl).hostname.endsWith("cifraclub.com.br");

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
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      let title = "";
      let artist = "";
      let content = "";

      if (isCifraClubUrl) {
        title = $("h1.t1").text().trim();
        artist = $("h2.t3").text().trim();
        content = $("pre").text().trim();
      } else {
        title = $("h1").first().text().trim() || "Música Desconhecida";
        artist = $("h2").first().text().trim() || "Artista Desconhecido";
        content =
          $("pre").text().trim() ||
          $("code").text().trim() ||
          "Conteúdo não encontrado";
      }

      return res.json({ title, artist, content });
    } catch (error) {
      console.error("Scraping error:", error);
      return res.status(500).json({
        error: error instanceof Error ? `Failed to scrape content. ${error.message}` : "Failed to scrape content",
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
