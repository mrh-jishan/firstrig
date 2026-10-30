'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Prefs = { lowGfx: boolean; flat: boolean; labels: boolean; sound: boolean };
type Ctx = Prefs & { set: (p: Partial<Prefs>) => void };

const DEFAULTS: Prefs = { lowGfx: false, flat: false, labels: true, sound: true };
const PrefsCtx = createContext<Ctx>({ ...DEFAULTS, set: () => {} });

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  useEffect(() => {
    const stored = load<Partial<Prefs>>('fr:prefs', {});
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    setPrefs({ ...DEFAULTS, lowGfx: !!touch, ...stored });
  }, []);
  const set = (p: Partial<Prefs>) => setPrefs((cur) => { const next = { ...cur, ...p }; save('fr:prefs', next); return next; });
  return <PrefsCtx.Provider value={{ ...prefs, set }}>{children}</PrefsCtx.Provider>;
}

export const usePrefs = () => useContext(PrefsCtx);
