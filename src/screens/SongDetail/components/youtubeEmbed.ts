const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

const cleanVideoId = (value?: string | null) => {
  const candidate = value?.trim().split(/[?&#]/)[0] ?? '';
  return YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
};

export const getYoutubeVideoId = (youtubeUrl: string) => {
  const value = youtubeUrl.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (hostname === 'youtu.be') {
      return cleanVideoId(url.pathname.split('/').filter(Boolean)[0]);
    }

    const isYoutubeHost =
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com') ||
      hostname === 'youtube-nocookie.com' ||
      hostname.endsWith('.youtube-nocookie.com');

    if (!isYoutubeHost) return null;

    const queryId = cleanVideoId(url.searchParams.get('v'));
    if (queryId) return queryId;

    const parts = url.pathname.split('/').filter(Boolean);
    const markerIndex = parts.findIndex((part) => part === 'embed' || part === 'shorts' || part === 'live');
    return markerIndex >= 0 ? cleanVideoId(parts[markerIndex + 1]) : null;
  } catch {
    return cleanVideoId(value);
  }
};

export const getYoutubeEmbedUrl = (youtubeUrl: string) => {
  const videoId = getYoutubeVideoId(youtubeUrl);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
};
