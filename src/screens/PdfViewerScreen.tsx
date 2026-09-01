import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { ExternalLink } from 'lucide-react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import type { ManualRoute } from '../navigation/manualTypes';
import { useManualNavigation } from '../contexts/ManualNavigationContext';
import { db } from '../services/storage';
import { getQuickPdfFilesystemUri, readQuickPdfFilesystemBytes } from '../services/quickPdfFiles';
import type { QuickPdfId, QuickPdfLink } from '../types/models';
import { QUICK_PDF_LABELS } from '../utils/playlistItems';
import { getQuickPdfSourceFingerprint, isLocalPdfPath, resolveHttpPdfUrl } from '../utils/quickPdfs';
import { sanitizeFileName, shareBlobFile } from '../services/share';
import { PdfJsViewer, type PdfJsViewerSource } from '../components/pdf/PdfJsViewer';
import { useDevScreenPerformance } from '../utils/devPerformance';

interface PdfViewerScreenProps {
  pdfId: QuickPdfId;
  returnTo?: ManualRoute;
  sourcePlaylistId?: string;
  sourcePlaylistName?: string;
}

const APP_HEADER_HEIGHT = 61;
const PDF_FOOTER_MIN_HEIGHT = 66;

const isAndroidCapacitor = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const dataUrlToBlob = (dataUrl: string): Blob | null => {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;

  const mime = match[1] || 'application/pdf';
  const isBase64 = !!match[2];
  const payload = match[3] || '';

  try {
    const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mime === 'application/octet-stream' ? 'application/pdf' : mime });
  } catch {
    return null;
  }
};

export function PdfViewerScreen({
  pdfId,
  returnTo,
  sourcePlaylistId,
  sourcePlaylistName,
}: PdfViewerScreenProps) {
  useDevScreenPerformance('PdfViewer');
  const nav = useManualNavigation();
  const [pdf, setPdf] = React.useState<QuickPdfLink | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pdfJsFailed, setPdfJsFailed] = React.useState(false);
  const [iframeFailed, setIframeFailed] = React.useState(false);
  const [fileObjectUrl, setFileObjectUrl] = React.useState<string | null>(null);
  const [filesystemBytes, setFilesystemBytes] = React.useState<Uint8Array | null>(null);
  const [filesystemLoading, setFilesystemLoading] = React.useState(false);
  const [openingPdf, setOpeningPdf] = React.useState(false);
  const [savedPageState, setSavedPageState] = React.useState<{
    pageNumber: number;
    zoom: number;
    pageOffsetRatio: number;
    sourceFingerprint: string;
  } | null>(null);
  const objectUrlRef = React.useRef<string | null>(null);
  const savePageTimeoutRef = React.useRef<number | null>(null);
  const pendingViewStateRef = React.useRef<{
    pdfId: QuickPdfId;
    pageNumber: number;
    zoom: number;
    pageOffsetRatio: number;
    sourceFingerprint: string;
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setPdfJsFailed(false);
    setIframeFailed(false);

    void Promise.all([db.getQuickPdfs(), db.getQuickPdfViewState()]).then(([rows, pageState]) => {
      if (!active) return;
      setPdf(rows.find((item) => item.id === pdfId) || null);
      const saved = pageState[pdfId];
      setSavedPageState(saved ? {
        pageNumber: saved.pageNumber,
        zoom: saved.zoom ?? 1,
        pageOffsetRatio: saved.pageOffsetRatio ?? 0,
        sourceFingerprint: saved.sourceFingerprint,
      } : null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [pdfId]);

  const fileData = pdf?.fileData?.trim() || '';
  const fileStorage = pdf?.fileStorage;
  const filesystemKey = fileStorage
    ? `${fileStorage.path}:${fileStorage.updatedAt}:${fileStorage.sizeBytes}`
    : '';

  React.useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setFileObjectUrl(null);

    if (isAndroidCapacitor() || !pdfJsFailed) return undefined;
    if (!fileData || typeof URL === 'undefined') return undefined;

    const blob = dataUrlToBlob(fileData);
    if (!blob) {
      setIframeFailed(true);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' }));
    objectUrlRef.current = objectUrl;
    setFileObjectUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
      if (objectUrlRef.current === objectUrl) objectUrlRef.current = null;
    };
  }, [fileData, pdfJsFailed]);

  const flushPendingViewState = React.useCallback(() => {
    if (savePageTimeoutRef.current !== null) {
      window.clearTimeout(savePageTimeoutRef.current);
      savePageTimeoutRef.current = null;
    }
    const pending = pendingViewStateRef.current;
    pendingViewStateRef.current = null;
    if (!pending) return;
    void db.saveQuickPdfViewState(pending.pdfId, {
      pageNumber: pending.pageNumber,
      zoom: pending.zoom,
      pageOffsetRatio: pending.pageOffsetRatio,
      sourceFingerprint: pending.sourceFingerprint,
    });
  }, []);

  React.useEffect(() => () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    flushPendingViewState();
  }, [flushPendingViewState]);

  React.useEffect(() => {
    let active = true;
    setFilesystemBytes(null);
    setFilesystemLoading(false);

    if (!fileStorage || !isAndroidCapacitor()) return undefined;

    setFilesystemLoading(true);
    setPdfJsFailed(false);

    void readQuickPdfFilesystemBytes(fileStorage)
      .then((bytes) => {
        if (!active) return;
        setFilesystemBytes(bytes);
      })
      .catch(() => {
        if (!active) return;
        setPdfJsFailed(true);
      })
      .finally(() => {
        if (!active) return;
        setFilesystemLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filesystemKey]);

  const pdfUrl = resolveHttpPdfUrl(pdf?.url);
  const sourceFingerprint = React.useMemo(() => getQuickPdfSourceFingerprint(pdf), [pdf]);
  const restoredInitialPage =
    sourceFingerprint && savedPageState?.sourceFingerprint === sourceFingerprint
      ? savedPageState.pageNumber
      : undefined;
  const restoredInitialZoom =
    sourceFingerprint && savedPageState?.sourceFingerprint === sourceFingerprint
      ? savedPageState.zoom
      : undefined;
  const restoredInitialPageOffsetRatio =
    sourceFingerprint && savedPageState?.sourceFingerprint === sourceFingerprint
      ? savedPageState.pageOffsetRatio
      : undefined;
  const isFileSource = !!fileData || !!fileStorage;
  const hasRawUrl = !!pdf?.url?.trim();
  const isLocalPath = isLocalPdfPath(pdf?.url);
  const androidFallback = isAndroidCapacitor();
  const viewerSource = fileData ? fileObjectUrl : pdfUrl;
  const canOpenPdf = !!pdfUrl || !!fileData || !!fileStorage;
  const viewerLoading = loading || filesystemLoading;
  const pdfJsSource = React.useMemo<PdfJsViewerSource | null>(() => {
    if (!canOpenPdf) return null;
    if (fileStorage && filesystemBytes) {
      return { type: 'bytes', data: filesystemBytes, cacheKey: filesystemKey };
    }
    if (isFileSource && fileData) return { type: 'dataUrl', dataUrl: fileData };
    if (pdfUrl) return { type: 'url', url: pdfUrl };
    return null;
  }, [canOpenPdf, fileData, fileStorage, filesystemBytes, filesystemKey, isFileSource, pdfUrl]);

  const pdfJsSourceKey = pdfJsSource
    ? pdfJsSource.type === 'url'
      ? `url:${pdfJsSource.url}`
      : pdfJsSource.type === 'dataUrl'
        ? `dataUrl:${pdfJsSource.dataUrl.length}:${sourceFingerprint}`
        : `bytes:${pdfJsSource.cacheKey}:${pdfJsSource.data.byteLength}`
    : '';

  React.useEffect(() => {
    setPdfJsFailed(false);
    setIframeFailed(false);
  }, [pdfJsSourceKey, viewerSource]);

  React.useEffect(() => {
    if (!savedPageState || !sourceFingerprint || savedPageState.sourceFingerprint === sourceFingerprint) return;
    setSavedPageState(null);
    void db.clearQuickPdfPageState(pdfId);
  }, [pdfId, savedPageState, sourceFingerprint]);

  const handlePdfViewChange = React.useCallback((viewState: {
    pageNumber: number;
    zoom: number;
    pageOffsetRatio: number;
  }) => {
    const { pageNumber, zoom, pageOffsetRatio } = viewState;
    if (!sourceFingerprint || pageNumber < 1) return;
    if (savePageTimeoutRef.current !== null) {
      window.clearTimeout(savePageTimeoutRef.current);
    }
    pendingViewStateRef.current = {
      pdfId,
      pageNumber,
      zoom,
      pageOffsetRatio,
      sourceFingerprint,
    };
    savePageTimeoutRef.current = window.setTimeout(() => {
      flushPendingViewState();
    }, 450);
  }, [flushPendingViewState, pdfId, sourceFingerprint]);

  const showOpenError = (message: string) => {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message);
    }
  };

  const openPdf = async () => {
    if (openingPdf) return;
    setOpeningPdf(true);

    try {
      const title = pdf?.name?.trim() || QUICK_PDF_LABELS[pdfId];

      if (pdfUrl) {
        if (androidFallback) {
          await Share.share({
            title,
            text: title,
            url: pdfUrl,
            dialogTitle: 'Abrir PDF',
          });
          return;
        }

        if (typeof window !== 'undefined') {
          window.open(pdfUrl, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      if (fileStorage) {
        const uri = await getQuickPdfFilesystemUri(fileStorage);
        await Share.share({
          title,
          text: title,
          files: [uri],
          dialogTitle: 'Abrir PDF',
        });
        return;
      }

      if (isFileSource && fileData) {
        const blob = dataUrlToBlob(fileData);
        if (!blob) {
          showOpenError('Não foi possível preparar este PDF. Tente escolher o arquivo novamente.');
          return;
        }

        const safeFileName = sanitizeFileName(pdf?.fileName || title || 'pdf');
        const pdfFileName = safeFileName.toLowerCase().endsWith('.pdf') ? safeFileName : `${safeFileName}.pdf`;

        await shareBlobFile({
          blob: blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' }),
          fileName: pdfFileName,
          title: 'Abrir PDF',
          text: title,
          fallbackMessage: 'PDF preparado para abrir fora do app.',
        });
      }
    } catch {
      showOpenError('Não foi possível abrir este PDF fora do app. Tente novamente ou escolha outro arquivo.');
    } finally {
      setOpeningPdf(false);
    }
  };

  const goBackToList = () => {
    if (returnTo) {
      nav.navigate(returnTo.name as never, returnTo.params as never);
      return;
    }

    if (sourcePlaylistId) {
      nav.navigate('PlaylistDetail', {
        playlistId: sourcePlaylistId,
        playlistName: sourcePlaylistName,
      });
      return;
    }

    nav.navigate('Folders');
  };

  const originText = isFileSource
    ? 'PDF salvo no app para uso offline'
    : 'PDF por link externo';

  return (
    <View style={localStyles.container}>
      <View style={localStyles.body}>
        {viewerLoading ? (
          <View style={localStyles.stateCard}>
            <Text style={localStyles.stateTitle}>Carregando PDF...</Text>
            <Text style={localStyles.stateText}>Buscando o PDF configurado em PDFs rápidos.</Text>
          </View>
        ) : !pdf ? (
          <View style={localStyles.stateCard}>
            <Text style={localStyles.stateTitle}>PDF não encontrado</Text>
            <Text style={localStyles.stateText}>Este slot não existe mais nas configurações locais.</Text>
          </View>
        ) : !isFileSource && !hasRawUrl ? (
          <View style={localStyles.stateCard}>
            <Text style={localStyles.stateTitle}>Slot sem PDF</Text>
            <Text style={localStyles.stateText}>Configure um link ou escolha um arquivo para {QUICK_PDF_LABELS[pdfId]} em Configurações.</Text>
          </View>
        ) : !isFileSource && isLocalPath ? (
          <View style={localStyles.stateCard}>
            <Text style={localStyles.stateTitle}>Caminho local não abre como link</Text>
            <Text style={localStyles.stateText}>
              Este caminho é local do computador e não pode ser aberto como link. Use Escolher PDF ou cole um link começando com http:// ou https://.
            </Text>
          </View>
        ) : pdfJsSource && !pdfJsFailed ? (
          <View style={localStyles.viewerWrap}>
            <PdfJsViewer
              key={pdfJsSourceKey}
              source={pdfJsSource}
              title={pdf?.name || QUICK_PDF_LABELS[pdfId]}
              initialPage={restoredInitialPage}
              initialZoom={restoredInitialZoom}
              initialPageOffsetRatio={restoredInitialPageOffsetRatio}
              onViewChange={handlePdfViewChange}
              onError={() => setPdfJsFailed(true)}
            />
          </View>
        ) : !viewerSource ? (
          <View style={localStyles.stateCard}>
            <Text style={localStyles.stateTitle}>{isFileSource ? 'Arquivo não renderizado' : 'Link inválido'}</Text>
            <Text style={localStyles.stateText}>
              Não foi possível exibir este PDF dentro do app. Tente abrir externamente ou escolha outro arquivo.
            </Text>
          </View>
        ) : (
          <>
            <View style={localStyles.viewerWrap}>
              <iframe
                key={viewerSource}
                src={viewerSource}
                title={pdf?.name || QUICK_PDF_LABELS[pdfId]}
                style={localStyles.iframe as React.CSSProperties}
                onError={() => setIframeFailed(true)}
              />
            </View>
            {iframeFailed ? (
              <View style={localStyles.fallbackCard}>
                <Text style={localStyles.fallbackTitle}>Não foi possível exibir este PDF dentro do app.</Text>
                <Text style={localStyles.fallbackText}>
                  {isFileSource
                    ? 'Tente escolher outro arquivo PDF menor ou use um link público.'
                    : 'Tente abrir externamente ou use outro link público.'}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={localStyles.footer}>
        <View style={localStyles.footerInner}>
          <Text style={localStyles.footerText} numberOfLines={2}>{originText}</Text>
          <View style={localStyles.actions}>
            <TouchableOpacity style={localStyles.secondaryButton} onPress={goBackToList}>
              <Text style={localStyles.secondaryButtonText}>Voltar para a lista</Text>
            </TouchableOpacity>
            {canOpenPdf ? (
              <TouchableOpacity
                style={[localStyles.primaryButton, openingPdf && localStyles.buttonDisabled]}
                disabled={openingPdf}
                onPress={openPdf}
              >
                <ExternalLink size={16} color="#201600" />
                <Text style={localStyles.primaryButtonText}>
                  {androidFallback ? 'Abrir PDF' : 'Compartilhar PDF'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
container: {
  position: Platform.OS === 'web' ? 'fixed' as any : 'absolute',
  top: APP_HEADER_HEIGHT,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'var(--app-bg)',
  overflow: 'hidden' as any,
},

body: {
  position: 'absolute' as any,
  top: 0,
  left: 0,
  right: 0,
  bottom: PDF_FOOTER_MIN_HEIGHT,
  paddingHorizontal: 4,
  paddingTop: 4,
  paddingBottom: 4,
  overflow: 'hidden' as any,
},

viewerWrap: {
  width: '100%',
  height: '100%',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: 'var(--app-border-soft)',
  backgroundColor: 'var(--app-surface-alt)',
  overflow: 'hidden',
},

iframe: {
  width: '100%',
  height: '100%',
  border: '0',
  backgroundColor: '#fff',
  display: 'block',
},

  androidFallbackCard: {
    height: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  androidFallbackIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.34)',
    backgroundColor: 'rgba(79,195,247,0.12)',
  },

  androidFallbackTitle: {
    color: 'var(--app-text)',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },

  androidFallbackText: {
    maxWidth: 440,
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },

  androidFallbackOrigin: {
    color: 'var(--app-subtle-text)',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  androidOpenButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: '#ffd166',
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 4,
  },

  androidOpenButtonText: {
    color: '#201600',
    fontSize: 15,
    fontWeight: '900',
  },

  fallbackCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(127,29,29,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  fallbackTitle: {
    color: '#ffb4b4',
    fontSize: 13,
    fontWeight: '900',
  },

  fallbackText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  stateCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    padding: 16,
  },

  stateTitle: {
    color: 'var(--app-text)',
    fontSize: 16,
    fontWeight: '900',
  },

  stateText: {
    color: 'var(--app-muted-text)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

 footer: {
  position: 'absolute' as any,
  left: 0,
  right: 0,
  bottom: 0,
  minHeight: PDF_FOOTER_MIN_HEIGHT,
  borderTopWidth: 1,
  borderColor: 'var(--app-border-soft)',
  backgroundColor: 'var(--app-header)',
  shadowColor: '#000',
  shadowOpacity: 0.18,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: -8 },
  zIndex: 10,
},

footerInner: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
  },
  
  footerText: {
    flex: 1,
    minWidth: 140,
    color: 'var(--app-muted-text)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: 'var(--app-text)',
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: '#ffd166',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#201600',
    fontSize: 13,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.62,
  },
});
