export const extractUrlFromSharedText = (value?: string | null): string | null => {
  const text = (value || '').trim();
  if (!text) return null;

  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  const raw = (match?.[0] || text).trim().replace(/[)\].,;!?]+$/g, '');
  if (!/^https?:\/\//i.test(raw)) return null;

  try {
    return new URL(raw).toString();
  } catch {
    return raw;
  }
};
