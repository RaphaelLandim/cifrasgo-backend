import { useEffect } from 'react';

type WakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
  removeEventListener?: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

let activeRequestCount = 0;
let wakeLockSentinel: WakeLockSentinelLike | null = null;
let acquiringWakeLock = false;

const canUseWakeLock = () =>
  typeof navigator !== 'undefined' &&
  typeof document !== 'undefined' &&
  !!(navigator as WakeLockNavigator).wakeLock?.request;

const acquireWakeLock = async () => {
  if (!canUseWakeLock() || acquiringWakeLock || wakeLockSentinel || activeRequestCount <= 0) return;
  if (document.visibilityState !== 'visible') return;

  acquiringWakeLock = true;
  try {
    const sentinel = await (navigator as WakeLockNavigator).wakeLock!.request('screen');
    wakeLockSentinel = sentinel;
    const onRelease = () => {
      wakeLockSentinel?.removeEventListener?.('release', onRelease);
      if (wakeLockSentinel === sentinel) wakeLockSentinel = null;
    };
    sentinel.addEventListener?.('release', onRelease);
  } catch {
    wakeLockSentinel = null;
  } finally {
    acquiringWakeLock = false;
  }
};

const releaseWakeLock = async () => {
  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  if (!sentinel || sentinel.released) return;

  try {
    await sentinel.release();
  } catch {
    // Wake Lock is best-effort; unsupported/revoked states should not break the app.
  }
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    void acquireWakeLock();
  }
};

export function useKeepAwake(enabled = true) {
  useEffect(() => {
    if (!enabled || !canUseWakeLock()) return undefined;

    activeRequestCount += 1;
    void acquireWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activeRequestCount = Math.max(0, activeRequestCount - 1);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (activeRequestCount === 0) {
        void releaseWakeLock();
      }
    };
  }, [enabled]);
}
