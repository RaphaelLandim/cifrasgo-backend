import React from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Text, TouchableOpacity, View } from 'react-native-web';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type PdfJsViewerSource =
  | { type: 'url'; url: string }
  | { type: 'dataUrl'; dataUrl: string }
  | { type: 'bytes'; data: Uint8Array; cacheKey: string };

interface PdfJsViewerProps {
  source: PdfJsViewerSource;
  title?: string;
  initialPage?: number;
  initialZoom?: number;
  initialPageOffsetRatio?: number;
  onViewChange?: (state: PdfJsViewerViewState) => void;
  onError?: (message: string) => void;
}

export interface PdfJsViewerViewState {
  pageNumber: number;
  pageCount: number;
  zoom: number;
  pageOffsetRatio: number;
}

interface ReadingAnchor {
  pageNumber: number;
  verticalRatio: number;
  horizontalRatio: number;
  viewportAnchorOffset: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const PAGE_WINDOW_RADIUS = 4;
const DEFAULT_PAGE_ASPECT_RATIO = 595 / 842;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getTouchDistance = (touches: React.TouchList) => {
  if (touches.length < 2) return 0;
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
};

const dataUrlToBytes = (dataUrl: string): Uint8Array => {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) throw new Error('Data URL invalido.');

  const isBase64 = !!match[2];
  const payload = match[3] || '';
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

function PdfPageCanvas({
  document,
  pageNumber,
  containerWidth,
  zoomFactor,
  onAspectRatio,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  containerWidth: number;
  zoomFactor: number;
  onAspectRatio: (pageNumber: number, aspectRatio: number) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let page: PDFPageProxy | null = null;
    const canvas = canvasRef.current;

    const renderPage = async () => {
      setFailed(false);
      if (!canvas || containerWidth <= 0) return;

      try {
        page = await document.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        onAspectRatio(pageNumber, baseViewport.width / baseViewport.height);
        const availableWidth = Math.max(containerWidth - 8, 1);
        const baseScale = availableWidth / baseViewport.width;
        const cssScale = Math.max(baseScale * zoomFactor, 0.01);
        const viewport = page.getViewport({ scale: cssScale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas indisponivel.');

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
          setFailed(true);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      page?.cleanup();
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [containerWidth, document, onAspectRatio, pageNumber, zoomFactor]);

  return (
    <>
      {failed ? (
        <View style={viewerStyles.pageError}>
          <Text style={viewerStyles.pageErrorText}>Nao foi possivel renderizar esta pagina.</Text>
        </View>
      ) : null}
      <canvas ref={canvasRef} aria-label={`Pagina ${pageNumber}`} style={viewerStyles.canvas} />
    </>
  );
}

export function PdfJsViewer({
  source,
  title,
  initialPage,
  initialZoom,
  initialPageOffsetRatio,
  onViewChange,
  onError,
}: PdfJsViewerProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);
  const documentRef = React.useRef<PDFDocumentProxy | null>(null);
  const onErrorRef = React.useRef(onError);
  const onViewChangeRef = React.useRef(onViewChange);
  const reportedPageRef = React.useRef(0);
  const restoreCompletedRef = React.useRef(false);
  const restoreFrameRef = React.useRef(0);
  const layoutFrameRef = React.useRef(0);
  const pendingAnchorRef = React.useRef<ReadingAnchor | null>(null);
  const scrollFrameRef = React.useRef(0);
  const pageElementsRef = React.useRef<HTMLElement[]>([]);
  const pinchRef = React.useRef({
    active: false,
    startDistance: 0,
    startZoom: 1,
    lastZoom: 1,
    frame: 0,
  });
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [document, setDocument] = React.useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [defaultPageAspectRatio, setDefaultPageAspectRatio] = React.useState(DEFAULT_PAGE_ASPECT_RATIO);
  const [pageAspectRatios, setPageAspectRatios] = React.useState<Record<number, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [zoomFactor, setZoomFactor] = React.useState(1);
  const [pinchPreviewScale, setPinchPreviewScale] = React.useState(1);
  const [initialView] = React.useState(() => ({
    pageNumber: Math.max(1, Math.floor(initialPage || 1)),
    zoom: clamp(Number(initialZoom) || 1, MIN_ZOOM, MAX_ZOOM),
    pageOffsetRatio: clamp(Number(initialPageOffsetRatio) || 0, 0, 1),
  }));
  const sourceKey = source.type === 'url'
    ? `url:${source.url}`
    : source.type === 'dataUrl'
      ? `data:${source.dataUrl.length}:${source.dataUrl.slice(0, 128)}`
      : `bytes:${source.cacheKey}:${source.data.byteLength}`;

  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  React.useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  React.useEffect(() => () => {
    if (pinchRef.current.frame) cancelAnimationFrame(pinchRef.current.frame);
    if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
    if (restoreFrameRef.current) cancelAnimationFrame(restoreFrameRef.current);
    if (layoutFrameRef.current) cancelAnimationFrame(layoutFrameRef.current);
  }, []);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const updateWidth = () => setContainerWidth(node.clientWidth || 0);
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    const loadPdf = async () => {
      setLoading(true);
      setErrorMessage('');
      setDocument(null);
      setPageCount(0);
      setCurrentPage(initialView.pageNumber);
      setDefaultPageAspectRatio(DEFAULT_PAGE_ASPECT_RATIO);
      setPageAspectRatios({});
      setZoomFactor(initialView.zoom);
      setPinchPreviewScale(1);
      reportedPageRef.current = 0;
      restoreCompletedRef.current = false;
      pendingAnchorRef.current = null;
      pinchRef.current.active = false;

      if (documentRef.current) {
        void documentRef.current.destroy();
        documentRef.current = null;
      }

      try {
        loadingTask = pdfjsLib.getDocument(
          source.type === 'url'
            ? { url: source.url }
            : source.type === 'dataUrl'
              ? { data: dataUrlToBytes(source.dataUrl) }
              : { data: new Uint8Array(source.data) }
        );
        const loadedDocument = await loadingTask.promise;
        if (cancelled) {
          void loadedDocument.destroy();
          return;
        }

        try {
          const firstPage = await loadedDocument.getPage(1);
          const firstViewport = firstPage.getViewport({ scale: 1 });
          if (!cancelled && firstViewport.width > 0 && firstViewport.height > 0) {
            setDefaultPageAspectRatio(firstViewport.width / firstViewport.height);
          }
        } catch {
          // The default A4 ratio keeps placeholders stable if metadata is unavailable.
        }

        if (cancelled) {
          void loadedDocument.destroy();
          return;
        }

        documentRef.current = loadedDocument;
        setDocument(loadedDocument);
        setPageCount(loadedDocument.numPages);
        setCurrentPage(clamp(initialView.pageNumber, 1, loadedDocument.numPages));
      } catch {
        if (!cancelled) {
          const message = 'Não foi possivel exibir este PDF dentro do app.';
          setErrorMessage(message);
          onErrorRef.current?.(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
      if (documentRef.current) {
        void documentRef.current.destroy();
        documentRef.current = null;
      }
    };
  }, [initialView, source, sourceKey]);

  React.useEffect(() => {
    if (!document || pageCount <= 0) {
      pageElementsRef.current = [];
      return undefined;
    }

    const frame = requestAnimationFrame(() => {
      const scrollArea = scrollAreaRef.current;
      pageElementsRef.current = scrollArea
        ? Array.from(scrollArea.querySelectorAll<HTMLElement>('[data-pdf-page]'))
        : [];
    });

    return () => cancelAnimationFrame(frame);
  }, [document, pageCount]);

  const getPageElements = React.useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return [];
    if (pageElementsRef.current.length !== pageCount) {
      pageElementsRef.current = Array.from(
        scrollArea.querySelectorAll<HTMLElement>('[data-pdf-page]'),
      );
    }
    return pageElementsRef.current;
  }, [pageCount]);

  const captureReadingAnchor = React.useCallback((): ReadingAnchor | null => {
    const scrollArea = scrollAreaRef.current;
    const pageElements = getPageElements();
    if (!scrollArea || !pageElements.length) return null;

    const viewportAnchorOffset = Math.min(160, Math.max(80, scrollArea.clientHeight * 0.25));
    const anchorPosition = scrollArea.scrollTop + viewportAnchorOffset;
    let low = 0;
    let high = pageElements.length - 1;
    let matchingIndex = 0;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (pageElements[middle].offsetTop <= anchorPosition) {
        matchingIndex = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    const pageElement = pageElements[matchingIndex];
    return {
      pageNumber: clamp(Number(pageElement.dataset.pdfPage || '1'), 1, pageCount),
      verticalRatio: clamp(
        (anchorPosition - pageElement.offsetTop) / Math.max(pageElement.offsetHeight, 1),
        0,
        1,
      ),
      horizontalRatio: clamp(
        (scrollArea.scrollLeft + scrollArea.clientWidth / 2 - pageElement.offsetLeft)
          / Math.max(pageElement.offsetWidth, 1),
        0,
        1,
      ),
      viewportAnchorOffset,
    };
  }, [getPageElements, pageCount]);

  const scheduleAnchorRestore = React.useCallback((anchor: ReadingAnchor) => {
    if (layoutFrameRef.current) cancelAnimationFrame(layoutFrameRef.current);
    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutFrameRef.current = requestAnimationFrame(() => {
        layoutFrameRef.current = 0;
        const scrollArea = scrollAreaRef.current;
        const pageElement = getPageElements()[anchor.pageNumber - 1];
        if (!scrollArea || !pageElement) return;

        const top = pageElement.offsetTop
          + pageElement.offsetHeight * anchor.verticalRatio
          - anchor.viewportAnchorOffset;
        const left = pageElement.offsetLeft
          + pageElement.offsetWidth * anchor.horizontalRatio
          - scrollArea.clientWidth / 2;
        scrollArea.scrollTo({
          top: Math.max(0, top),
          left: Math.max(0, left),
          behavior: 'auto',
        });
      });
    });
  }, [getPageElements]);

  const handlePageAspectRatio = React.useCallback((pageNumber: number, aspectRatio: number) => {
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return;
    setPageAspectRatios((current) => {
      if (Math.abs((current[pageNumber] || 0) - aspectRatio) < 0.0001) return current;
      if (restoreCompletedRef.current && !pendingAnchorRef.current) {
        pendingAnchorRef.current = captureReadingAnchor();
      }
      return { ...current, [pageNumber]: aspectRatio };
    });
  }, [captureReadingAnchor]);

  React.useEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor || !restoreCompletedRef.current) return;
    pendingAnchorRef.current = null;
    scheduleAnchorRestore(anchor);
  }, [containerWidth, pageAspectRatios, scheduleAnchorRestore, zoomFactor]);

  const detectCurrentPage = React.useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea || pageCount <= 0 || !restoreCompletedRef.current) return;
    const anchor = captureReadingAnchor();
    if (!anchor) return;
    const safePage = anchor.pageNumber;
    setCurrentPage((current) => (current === safePage ? current : safePage));
    reportedPageRef.current = safePage;
    onViewChangeRef.current?.({
      pageNumber: safePage,
      pageCount,
      zoom: zoomFactor,
      pageOffsetRatio: anchor.verticalRatio,
    });
  }, [captureReadingAnchor, pageCount, zoomFactor]);

  const handleScroll = React.useCallback(() => {
    if (scrollFrameRef.current) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = 0;
      detectCurrentPage();
    });
  }, [detectCurrentPage]);

  React.useEffect(() => {
    if (
      !document
      || loading
      || pageCount <= 0
      || containerWidth <= 0
      || restoreCompletedRef.current
      || restoreFrameRef.current
    ) return undefined;
    const targetPage = clamp(initialView.pageNumber, 1, pageCount);
    setCurrentPage(targetPage);

    restoreFrameRef.current = requestAnimationFrame(() => {
      restoreFrameRef.current = requestAnimationFrame(() => {
        restoreFrameRef.current = 0;
        const scrollArea = scrollAreaRef.current;
        const pageElement = getPageElements()[targetPage - 1];
        if (!scrollArea || !pageElement) return;

        const targetRatio = initialView.pageOffsetRatio;
        const viewportAnchorOffset = Math.min(160, Math.max(80, scrollArea.clientHeight * 0.25));
        const targetTop = targetRatio <= 0
          ? pageElement.offsetTop
          : pageElement.offsetTop + pageElement.offsetHeight * targetRatio - viewportAnchorOffset;
        scrollArea.scrollTo({ top: Math.max(0, targetTop), left: 0, behavior: 'auto' });
        reportedPageRef.current = targetPage;
        restoreCompletedRef.current = true;
      });
    });

    return () => {
      if (restoreFrameRef.current) {
        cancelAnimationFrame(restoreFrameRef.current);
        restoreFrameRef.current = 0;
      }
    };
  }, [containerWidth, document, getPageElements, initialView, loading, pageCount]);

  const schedulePreviewScale = (nextScale: number) => {
    const pinch = pinchRef.current;
    if (pinch.frame) return;

    pinch.frame = requestAnimationFrame(() => {
      pinch.frame = 0;
      setPinchPreviewScale(nextScale);
    });
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !document) return;

    const distance = getTouchDistance(event.touches);
    if (distance <= 0) return;

    event.preventDefault();
    pinchRef.current.active = true;
    pinchRef.current.startDistance = distance;
    pinchRef.current.startZoom = zoomFactor;
    pinchRef.current.lastZoom = zoomFactor;
    setPinchPreviewScale(1);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const pinch = pinchRef.current;
    if (!pinch.active || event.touches.length !== 2) return;

    const distance = getTouchDistance(event.touches);
    if (distance <= 0 || pinch.startDistance <= 0) return;

    event.preventDefault();
    const nextZoom = clamp(pinch.startZoom * (distance / pinch.startDistance), MIN_ZOOM, MAX_ZOOM);
    pinch.lastZoom = nextZoom;
    schedulePreviewScale(clamp(nextZoom / pinch.startZoom, 0.6, MAX_ZOOM));
  };

  const commitZoom = React.useCallback((value: number) => {
    if (!restoreCompletedRef.current || pageCount <= 0) return;
    const nextZoom = clamp(Number(value.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(nextZoom - zoomFactor) < 0.001) return;
    const anchor = captureReadingAnchor();
    if (anchor) {
      pendingAnchorRef.current = anchor;
      setCurrentPage(anchor.pageNumber);
    }
    setZoomFactor(nextZoom);
    onViewChangeRef.current?.({
      pageNumber: anchor?.pageNumber || currentPage,
      pageCount,
      zoom: nextZoom,
      pageOffsetRatio: anchor?.verticalRatio || 0,
    });
  }, [captureReadingAnchor, currentPage, pageCount, zoomFactor]);

  const finishPinch = () => {
    const pinch = pinchRef.current;
    if (!pinch.active) return;

    if (pinch.frame) {
      cancelAnimationFrame(pinch.frame);
      pinch.frame = 0;
    }

    const finalZoom = clamp(Number(pinch.lastZoom.toFixed(2)), MIN_ZOOM, MAX_ZOOM);
    pinch.active = false;
    pinch.startDistance = 0;
    pinch.startZoom = finalZoom;
    pinch.lastZoom = finalZoom;
    setPinchPreviewScale(1);
    commitZoom(finalZoom);
  };

  const renderedPageNumbers = React.useMemo(() => {
    const pages = new Set<number>();
    const firstPage = Math.max(1, currentPage - PAGE_WINDOW_RADIUS);
    const lastPage = Math.min(pageCount, currentPage + PAGE_WINDOW_RADIUS);
    for (let pageNumber = firstPage; pageNumber <= lastPage; pageNumber += 1) {
      pages.add(pageNumber);
    }
    return pages;
  }, [currentPage, pageCount]);

  const pinchPagesStyle = {
    transform: [{ scale: pinchPreviewScale }],
    transformOrigin: 'top center',
  } as unknown as React.ComponentProps<typeof View>['style'];
  const pagesStyle = pinchPreviewScale === 1
    ? viewerStyles.pages
    : [viewerStyles.pages, pinchPagesStyle];
  const zoomPercent = Math.round(zoomFactor * 100);
  const canZoomOut = zoomFactor > MIN_ZOOM + 0.001;
  const canZoomIn = zoomFactor < MAX_ZOOM - 0.001;
  const canResetZoom = Math.abs(zoomFactor - 1) > 0.001;

  return (
    <div ref={containerRef} style={viewerStyles.root}>
      {document && !loading ? (
        <View style={viewerStyles.zoomToolbar}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Diminuir zoom"
            disabled={!canZoomOut}
            onPress={() => commitZoom(zoomFactor - ZOOM_STEP)}
            style={[viewerStyles.zoomButton, !canZoomOut && viewerStyles.zoomButtonDisabled]}
          >
            <Minus size={18} color="var(--app-text)" />
          </TouchableOpacity>
          <Text style={viewerStyles.zoomValue}>{zoomPercent}%</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Aumentar zoom"
            disabled={!canZoomIn}
            onPress={() => commitZoom(zoomFactor + ZOOM_STEP)}
            style={[viewerStyles.zoomButton, !canZoomIn && viewerStyles.zoomButtonDisabled]}
          >
            <Plus size={18} color="var(--app-text)" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Restaurar zoom para 100%"
            disabled={!canResetZoom}
            onPress={() => commitZoom(1)}
            style={[viewerStyles.resetZoomButton, !canResetZoom && viewerStyles.zoomButtonDisabled]}
          >
            <RotateCcw size={15} color="var(--app-muted-text)" />
            <Text style={viewerStyles.resetZoomText}>100%</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <div
        ref={scrollAreaRef}
        style={viewerStyles.scrollArea}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={finishPinch}
        onTouchCancel={finishPinch}
      >
        {loading ? (
          <View style={viewerStyles.stateCard}>
            <Text style={viewerStyles.stateTitle}>Carregando PDF...</Text>
            <Text style={viewerStyles.stateText}>{title || 'Preparando visualizacao dentro do app.'}</Text>
          </View>
        ) : errorMessage ? (
          <View style={viewerStyles.stateCard}>
            <Text style={viewerStyles.stateTitle}>{errorMessage}</Text>
            <Text style={viewerStyles.stateText}>Tente abrir externamente ou use outro link/arquivo PDF.</Text>
          </View>
        ) : document ? (
          <View style={pagesStyle}>
            {Array.from({ length: pageCount }, (_, index) => {
              const pageNumber = index + 1;
              const aspectRatio = pageAspectRatios[pageNumber] || defaultPageAspectRatio;
              const pageWidth = Math.max(containerWidth - 8, 1) * zoomFactor;
              const pageHeight = pageWidth / aspectRatio;
              const shouldRender = renderedPageNumbers.has(pageNumber);

              return (
                <div
                  key={`${sourceKey}-${pageNumber}`}
                  data-pdf-page={pageNumber}
                  style={{
                    ...viewerStyles.pageSlot,
                    width: `${Math.floor(pageWidth)}px`,
                    height: `${Math.floor(pageHeight)}px`,
                  }}
                >
                  {shouldRender ? (
                    <PdfPageCanvas
                      document={document}
                      pageNumber={pageNumber}
                      containerWidth={containerWidth}
                      zoomFactor={zoomFactor}
                      onAspectRatio={handlePageAspectRatio}
                    />
                  ) : (
                    <div aria-hidden="true" style={viewerStyles.pagePlaceholder} />
                  )}
                </div>
              );
            })}
          </View>
        ) : null}
      </div>
    </div>
  );
}

const viewerStyles = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'var(--app-bg)',
  } as React.CSSProperties,
  scrollArea: {
    flex: '1 1 0%',
    height: 0,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-x pan-y',
    backgroundColor: 'var(--app-bg)',
  } as React.CSSProperties,
  zoomToolbar: {
    minHeight: 48,
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface)',
  },
  zoomButton: {
    width: 38,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
  },
  zoomButtonDisabled: {
    opacity: 0.38,
  },
  zoomValue: {
    width: 58,
    color: 'var(--app-text)',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  resetZoomButton: {
    minWidth: 70,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'var(--app-border-soft)',
    backgroundColor: 'var(--app-surface-soft)',
  },
  resetZoomText: {
    color: 'var(--app-muted-text)',
    fontSize: 12,
    fontWeight: '900',
  },
  pages: {
    width: 'max-content',
    minWidth: '100%',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  pageSlot: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    flexShrink: 0,
  } as React.CSSProperties,
  pagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: 'rgba(148,163,184,0.08)',
  } as React.CSSProperties,
  canvas: {
    display: 'block',
    borderRadius: 6,
    backgroundColor: '#fff',
    boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
  } as React.CSSProperties,
  pageError: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(127,29,29,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pageErrorText: {
    color: '#ffb4b4',
    fontSize: 12,
    fontWeight: '800',
  },
  stateCard: {
    margin: 12,
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
};
