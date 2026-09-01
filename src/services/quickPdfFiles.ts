import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { QuickPdfFilesystemStorage, QuickPdfId } from '../types/models';
import { MAX_QUICK_PDF_FILESYSTEM_FILE_BYTES } from '../utils/quickPdfs';

const QUICK_PDF_FILESYSTEM_DIR = Directory.Data;
const QUICK_PDF_FILESYSTEM_DIRECTORY_LABEL: QuickPdfFilesystemStorage['directory'] = 'Data';

export { MAX_QUICK_PDF_FILESYSTEM_FILE_BYTES };

export const isNativeFilesystemQuickPdfAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const getQuickPdfFilesystemPath = (slotId: QuickPdfId) => `quick-pdfs/${slotId}.pdf`;

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const base64ToBytes = (base64: string): Uint8Array => {
  const payload = base64.includes(',') ? base64.split(',').pop() || '' : base64;
  const clean = payload.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const saveQuickPdfFileToFilesystem = async (
  slotId: QuickPdfId,
  file: File
): Promise<QuickPdfFilesystemStorage> => {
  const path = getQuickPdfFilesystemPath(slotId);
  const data = await blobToBase64(file);
  await Filesystem.writeFile({
    path,
    data,
    directory: QUICK_PDF_FILESYSTEM_DIR,
    recursive: true,
  });

  return {
    kind: 'filesystem',
    path,
    directory: QUICK_PDF_FILESYSTEM_DIRECTORY_LABEL,
    fileName: file.name,
    mimeType: file.type || 'application/pdf',
    sizeBytes: file.size,
    updatedAt: Date.now(),
  };
};

export const readQuickPdfFilesystemBytes = async (storage: QuickPdfFilesystemStorage): Promise<Uint8Array> => {
  const result = await Filesystem.readFile({
    path: storage.path,
    directory: QUICK_PDF_FILESYSTEM_DIR,
  });

  if (typeof result.data === 'string') {
    return base64ToBytes(result.data);
  }

  const buffer = await result.data.arrayBuffer();
  return new Uint8Array(buffer);
};

export const getQuickPdfFilesystemUri = async (storage: QuickPdfFilesystemStorage): Promise<string> => {
  const result = await Filesystem.getUri({
    path: storage.path,
    directory: QUICK_PDF_FILESYSTEM_DIR,
  });
  return result.uri;
};

export const deleteQuickPdfFilesystemFile = async (storage?: QuickPdfFilesystemStorage): Promise<void> => {
  if (!storage) return;
  try {
    await Filesystem.deleteFile({
      path: storage.path,
      directory: QUICK_PDF_FILESYSTEM_DIR,
    });
  } catch {
    // Missing files are harmless; the metadata cleanup is the source of truth.
  }
};
