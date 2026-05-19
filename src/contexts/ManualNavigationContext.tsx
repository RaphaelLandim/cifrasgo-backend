import React from 'react';
import type { ManualNav } from '../navigation/manualTypes';

const ManualNavigationContext = React.createContext<ManualNav | null>(null);

export function ManualNavigationProvider({
  nav,
  children,
}: {
  nav: ManualNav;
  children: React.ReactNode;
}) {
  return <ManualNavigationContext.Provider value={nav}>{children}</ManualNavigationContext.Provider>;
}

export function useManualNavigation() {
  const nav = React.useContext(ManualNavigationContext);
  if (!nav) throw new Error('ManualNavigationContext not available');
  return nav;
}
