import type { QuickPdfLink } from '../types/models';

export const MAX_QUICK_PDF_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_QUICK_PDF_DATA_URL_CHARS = 4.25 * 1024 * 1024;
export const MAX_QUICK_PDF_FILESYSTEM_FILE_BYTES = 10 * 1024 * 1024;

export const formatQuickPdfFileLimit = () => `${MAX_QUICK_PDF_FILE_BYTES / (1024 * 1024)} MB`;
export const formatQuickPdfFilesystemFileLimit = () => `${MAX_QUICK_PDF_FILESYSTEM_FILE_BYTES / (1024 * 1024)} MB`;

export const estimateQuickPdfDataUrlSize = (fileSize: number, mimeType = 'application/pdf') => {
  const prefix = `data:${mimeType || 'application/pdf'};base64,`;
  return prefix.length + Math.ceil(fileSize / 3) * 4;
};

export const isQuickPdfDataUrlTooLarge = (value: string) =>
  value.length > MAX_QUICK_PDF_DATA_URL_CHARS;

export const getQuickPdfTooLargeMessage = () =>
  `Este PDF fica grande demais para salvar dentro do app depois de ser preparado. Use um link publico ou escolha um arquivo menor. Limite recomendado: ate ${formatQuickPdfFileLimit()}.`;

export const getQuickPdfFilesystemTooLargeMessage = () =>
  `Este PDF e grande demais para salvar dentro do app neste aparelho. Use um link publico ou escolha um arquivo menor. Limite recomendado: ate ${formatQuickPdfFilesystemFileLimit()}.`;

export const isLocalPdfPath = (value?: string | null) => {
  const raw = value?.trim();
  if (!raw) return false;
  return /^file:\/\//i.test(raw) || /^[a-zA-Z]:[\\/]/.test(raw);
};

export const resolveHttpPdfUrl = (value?: string | null) => {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
};

export const resolveQuickPdfSource = (pdf: QuickPdfLink) => {
  if (pdf.fileStorage) return { kind: 'filesystem' as const, storage: pdf.fileStorage };
  if (pdf.fileData?.trim()) return { kind: 'dataUrl' as const, dataUrl: pdf.fileData.trim() };
  const url = resolveHttpPdfUrl(pdf.url);
  if (url) return { kind: 'url' as const, url };
  return null;
};

export const getQuickPdfSourceFingerprint = (pdf?: QuickPdfLink | null) => {
  if (!pdf) return '';
  const source = resolveQuickPdfSource(pdf);
  if (!source) return '';

  if (source.kind === 'filesystem') {
    const storage = source.storage;
    return [
      'filesystem',
      storage.path,
      storage.updatedAt,
      storage.sizeBytes,
      storage.fileName,
      storage.mimeType,
    ].join(':');
  }

  if (source.kind === 'dataUrl') {
    return [
      'dataUrl',
      pdf.fileName || '',
      pdf.fileSize || 0,
      pdf.fileMimeType || '',
      source.dataUrl.length,
      pdf.updatedAt || 0,
    ].join(':');
  }

  return ['url', source.url].join(':');
};

export const hasQuickPdfSource = (pdf: QuickPdfLink) =>
  !!resolveQuickPdfSource(pdf);

export const getQuickPdfSourceLabel = (pdf: QuickPdfLink) =>
  pdf.fileStorage
    ? `PDF salvo no app${pdf.fileStorage.fileName ? ` - ${pdf.fileStorage.fileName}` : ''}`
    : pdf.fileData?.trim()
      ? `Arquivo salvo no app${pdf.fileName ? ` - ${pdf.fileName}` : ''}`
      : pdf.url?.trim()
        ? pdf.url.trim()
        : 'Sem PDF configurado';

export const isPdfFileLike = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
