import React from 'react';

type StorageMetric = {
  operation: 'get' | 'set' | 'remove';
  key: string;
  durationMs: number;
  size: number;
  at: number;
};

type RouteMetric = {
  route: string;
  durationMs: number;
  at: number;
};

type LongTaskMetric = {
  durationMs: number;
  startTime: number;
};

interface CifrasGoPerformanceStore {
  enabled: true;
  appStartedAt: number;
  renders: Record<string, number>;
  storage: StorageMetric[];
  routes: RouteMetric[];
  longTasks: LongTaskMetric[];
}

declare global {
  interface Window {
    __CIFRASGO_PERF__?: CifrasGoPerformanceStore;
  }
}

const PERF_STORAGE_KEY = '@cifrasgo_perf_enabled';
const MAX_METRICS_PER_GROUP = 200;
const routeStarts = new Map<string, number>();
let longTaskObserver: PerformanceObserver | null = null;
let performanceEnabled: boolean | null = null;

const isEnabled = () => {
  if (performanceEnabled !== null) return performanceEnabled;
  if (typeof window === 'undefined' || typeof performance === 'undefined') return false;
  if (import.meta.env.DEV) {
    performanceEnabled = true;
    return true;
  }
  try {
    performanceEnabled = window.localStorage.getItem(PERF_STORAGE_KEY) === 'true';
  } catch {
    performanceEnabled = false;
  }
  return performanceEnabled;
};

const getStore = (): CifrasGoPerformanceStore | null => {
  if (!isEnabled()) return null;
  if (!window.__CIFRASGO_PERF__) {
    window.__CIFRASGO_PERF__ = {
      enabled: true,
      appStartedAt: performance.now(),
      renders: {},
      storage: [],
      routes: [],
      longTasks: [],
    };
  }
  return window.__CIFRASGO_PERF__;
};

const appendLimited = <T,>(items: T[], item: T) => {
  items.push(item);
  if (items.length > MAX_METRICS_PER_GROUP) {
    items.splice(0, items.length - MAX_METRICS_PER_GROUP);
  }
};

export const startDevPerformanceMonitoring = () => {
  const store = getStore();
  if (!store || longTaskObserver || typeof PerformanceObserver === 'undefined') return;

  try {
    longTaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        appendLimited(store.longTasks, {
          durationMs: Number(entry.duration.toFixed(2)),
          startTime: Number(entry.startTime.toFixed(2)),
        });
      });
    });
    longTaskObserver.observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
  } catch {
    longTaskObserver = null;
  }
};

export const markDevRouteStart = (route: string) => {
  if (!getStore()) return;
  routeStarts.set(route, performance.now());
};

export const recordDevStorageOperation = (
  operation: StorageMetric['operation'],
  key: string,
  startedAt: number,
  size: number,
) => {
  const store = getStore();
  if (!store) return;
  appendLimited(store.storage, {
    operation,
    key,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    size,
    at: Date.now(),
  });
};

export const useDevScreenPerformance = (route: string) => {
  React.useEffect(() => {
    const store = getStore();
    if (!store) return;
    store.renders[route] = (store.renders[route] || 0) + 1;
  });

  React.useEffect(() => {
    const currentStore = getStore();
    if (!currentStore) return undefined;

    const startedAt = routeStarts.get(route) ?? currentStore.appStartedAt;
    const frame = requestAnimationFrame(() => {
      appendLimited(currentStore.routes, {
        route,
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        at: Date.now(),
      });
      routeStarts.delete(route);
    });

    return () => cancelAnimationFrame(frame);
  }, [route]);
};
