import { App as CapacitorApp } from '@capacitor/app';
import { extractUrlFromSharedText } from '../utils/links';

interface IncomingImportUrl {
  url: string;
  requestedAt: number;
}

type IncomingImportUrlHandler = (payload: IncomingImportUrl) => void;

interface IncomingUrlOptions {
  duplicateWindowMs?: number;
}

type NativeSharedTextEvent = CustomEvent<{
  text?: string | null;
  url?: string | null;
  source?: string;
  receivedAt?: number;
}>;

type PendingNativeSharedText = NonNullable<NativeSharedTextEvent['detail']>;

const pendingImportStorageKey = 'cifrasgoPendingImportUrl';

export function subscribeToIncomingImportUrls(
  onImportUrl: IncomingImportUrlHandler,
  options: IncomingUrlOptions = {}
): () => void {
  const duplicateWindowMs = options.duplicateWindowMs ?? 6000;
  let isActive = true;
  let removeListener: (() => void) | null = null;
  let removeNativeSharedTextListener: (() => void) | null = null;
  let consumePendingTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRequest: IncomingImportUrl | null = null;

  const emit = (value?: string | null, source = 'unknown') => {
    if (value) {
      console.info('[CifrasGo linking] incoming value', { source, value });
    }

    const url = extractUrlFromSharedText(value);
    if (!url) {
      if (value) console.info('[CifrasGo linking] no importable URL found', { source });
      return;
    }

    const requestedAt = Date.now();
    if (lastRequest?.url === url && requestedAt - lastRequest.requestedAt < duplicateWindowMs) {
      console.info('[CifrasGo linking] duplicate import URL ignored', { source, url });
      return;
    }

    const payload = { url, requestedAt };
    lastRequest = payload;
    console.info('[CifrasGo linking] emitting import URL', { source, url, requestedAt });
    onImportUrl(payload);
  };

  const consumePendingNativeSharedText = () => {
    if (typeof window === 'undefined') return;

    const windowWithPending = window as Window & {
      __cifrasgoPendingImportUrl?: PendingNativeSharedText;
    };
    const pending = windowWithPending.__cifrasgoPendingImportUrl;
    if (pending) {
      delete windowWithPending.__cifrasgoPendingImportUrl;
      emit(pending.url ?? pending.text, pending.source ?? 'android-pending-window');
    }

    try {
      const stored = window.sessionStorage.getItem(pendingImportStorageKey);
      if (!stored) return;

      window.sessionStorage.removeItem(pendingImportStorageKey);
      const parsed = JSON.parse(stored) as PendingNativeSharedText;
      emit(parsed.url ?? parsed.text, parsed.source ?? 'android-pending-session');
    } catch (error) {
      console.info('[CifrasGo linking] pending native share read failed', error);
    }
  };

  if (typeof window !== 'undefined') {
    const handleNativeSharedText = (event: Event) => {
      const detail = (event as NativeSharedTextEvent).detail;
      emit(detail?.url ?? detail?.text, detail?.source ?? 'android-share-event');
    };

    window.addEventListener('cifrasgoIncomingImportUrl', handleNativeSharedText);
    removeNativeSharedTextListener = () => {
      window.removeEventListener('cifrasgoIncomingImportUrl', handleNativeSharedText);
    };
    consumePendingNativeSharedText();
    consumePendingTimer = setTimeout(consumePendingNativeSharedText, 1000);
  }

  void CapacitorApp.getLaunchUrl()
    .then((launchUrl) => {
      if (isActive) emit(launchUrl?.url, 'capacitor-launch-url');
    })
    .catch((error) => {
      console.info('[CifrasGo linking] getLaunchUrl failed', error);
    });

  void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    emit(url, 'capacitor-app-url-open');
  })
    .then((handle) => {
      if (!isActive) {
        void handle.remove();
        return;
      }
      removeListener = () => {
        void handle.remove();
      };
    })
    .catch((error) => {
      console.info('[CifrasGo linking] appUrlOpen listener failed', error);
    });

  return () => {
    isActive = false;
    removeListener?.();
    removeNativeSharedTextListener?.();
    if (consumePendingTimer) clearTimeout(consumePendingTimer);
  };
}
