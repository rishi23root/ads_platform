'use client';

import { createContext, useContext } from 'react';

/** Lets filter UIs (chips, clear buttons) collapse the page layout filter panel. */
export const CloseFilterPanelContext = createContext<(() => void) | null>(null);

export function useCloseFilterPanel() {
  return useContext(CloseFilterPanelContext);
}
