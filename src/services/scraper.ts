import { Capacitor } from '@capacitor/core';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const getScrapeEndpoint = (url: string): string => {
  if (Capacitor.isNativePlatform() && !isAbsoluteHttpUrl(API_BASE_URL)) {
    throw new Error('API de importacao indisponivel no Android. Configure VITE_API_BASE_URL com a URL do backend online de importacao.');
  }

  return `${API_BASE_URL}/api/scrape?url=${encodeURIComponent(url)}`;
};

export interface ScrapedSong {
  title: string;
  artist: string;
  content: string;
}

export const scrapeSongFromUrl = async (url: string): Promise<ScrapedSong> => {
  const response = await fetch(getScrapeEndpoint(url));
  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();

  if (!contentType.toLowerCase().includes('application/json')) {
    const looksLikeHtml = rawBody.trimStart().startsWith('<');
    if (looksLikeHtml && Capacitor.isNativePlatform()) {
      throw new Error('API de importacao indisponivel no Android. Configure VITE_API_BASE_URL com a URL do backend online de importacao.');
    }
    throw new Error(`Resposta inesperada da API de importação (${contentType || 'sem content-type'}).`);
  }

  let data: Partial<ScrapedSong> & { error?: string };
  try {
    data = JSON.parse(rawBody) as Partial<ScrapedSong> & { error?: string };
  } catch {
    throw new Error('Resposta inválida da API de importação.');
  }

  if (data.error) throw new Error(data.error);
  if (!data.title || !data.artist || !data.content) {
    throw new Error('A resposta da importação veio incompleta.');
  }

  return {
    title: data.title,
    artist: data.artist,
    content: data.content,
  };
};
