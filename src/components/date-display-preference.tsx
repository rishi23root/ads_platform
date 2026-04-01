'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export type DateDisplayPreference = 'relative' | 'absolute';

/** Default: human-readable dates (“today at …”, etc.). */
export const DEFAULT_DATE_DISPLAY_PREFERENCE: DateDisplayPreference = 'relative';

const STORAGE_KEY = 'admin-dashboard-date-display';

function getStored(): DateDisplayPreference {
  if (typeof window === 'undefined') return DEFAULT_DATE_DISPLAY_PREFERENCE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'absolute' || raw === 'relative') return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_DATE_DISPLAY_PREFERENCE;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    listeners.delete(listener);
  };
}

function emitPreferenceChanged() {
  listeners.forEach((l) => l());
}

function getServerSnapshot(): DateDisplayPreference {
  return DEFAULT_DATE_DISPLAY_PREFERENCE;
}

type DateDisplayPreferenceContextValue = {
  preference: DateDisplayPreference;
  setPreference: (next: DateDisplayPreference) => void;
  toggle: () => void;
};

const DateDisplayPreferenceContext = createContext<DateDisplayPreferenceContextValue | null>(null);

export function DateDisplayPreferenceProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribe, getStored, getServerSnapshot);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== 'absolute' && raw !== 'relative') {
        window.localStorage.setItem(STORAGE_KEY, DEFAULT_DATE_DISPLAY_PREFERENCE);
        emitPreferenceChanged();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setPreference = useCallback((next: DateDisplayPreference) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    emitPreferenceChanged();
  }, []);

  const toggle = useCallback(() => {
    const next = preference === 'relative' ? 'absolute' : 'relative';
    setPreference(next);
  }, [preference, setPreference]);

  const value = useMemo(
    () => ({ preference, setPreference, toggle }),
    [preference, setPreference, toggle]
  );

  return (
    <DateDisplayPreferenceContext.Provider value={value}>{children}</DateDisplayPreferenceContext.Provider>
  );
}

export function useDateDisplayPreference(): DateDisplayPreferenceContextValue {
  const ctx = useContext(DateDisplayPreferenceContext);
  if (!ctx) {
    return {
      preference: DEFAULT_DATE_DISPLAY_PREFERENCE,
      setPreference: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}
