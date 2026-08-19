import { useSyncExternalStore } from 'react';
import { DEFAULT_CONTENT, DEFAULT_SITE } from './site';

/* The visitor's stored choice wins; otherwise follow the OS setting. Read
   synchronously at module load so the first paint is already correct —
   deciding this in an effect would flash the wrong theme. */
function initialTheme() {
  try {
    const saved = localStorage.getItem('ad-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* private mode: fall through to the system preference */
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

/** Reactive slice (rare updates: phase, language, loader). */
let state = {
  phase: 0,
  lang: 'en',
  theme: initialTheme(),
  ready: false,
  entered: false,
  progress: 0,
  hover: null,
  focus: null,
  content: DEFAULT_CONTENT,
  site: DEFAULT_SITE,
  dataErrors: [], // problems found in the fetched JSON, shown by <DataError />
  lightbox: null, // { images: [...], index }
  ask: false,     // the assistant panel
};
const listeners = new Set();

export function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getState = () => state;

/** Switch theme, remember the choice, and stamp the root element. */
export function setTheme(theme) {
  setState({ theme });
  try {
    localStorage.setItem('ad-theme', theme);
  } catch {
    /* nothing to do: the theme still applies for this session */
  }
  document.documentElement.dataset.theme = theme;
}

// stamp the initial value before React mounts, so there is no flash
if (typeof document !== 'undefined') document.documentElement.dataset.theme = state.theme;

const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useStore(selector) {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state)
  );
}

/** Non-reactive slice, read every frame by the 3D scene. */
export const raw = {
  scroll: 0, // 0..1 over the whole page
  pointer: { x: 0, y: 0 },
  velocity: 0,
  rot: { x: 0, y: 0 }, // live rotation of the globe, shared with the journey layer
  lenis: null, // smooth-scroll instance, so any component can scroll the page
};

export const t = (obj, lang) => (obj && typeof obj === 'object' ? obj[lang] ?? obj.en : obj);

/* ------------------------------------------------------------------ */
/* Convenience hooks — every component reads its copy through these    */
/* ------------------------------------------------------------------ */

/** UI labels: useUI() -> the `ui` object from content.json */
export const useUI = () => useStore((s) => s.content.ui);
/** Profile: name, email, phones, links. */
export const useProfile = () => useStore((s) => s.content.profile);
/** Journey stations — also drives the 3D globe markers and arc. */
export const useStations = () => useStore((s) => s.content.stations);

/**
 * Non-reactive readers for the 3D layer, which runs outside React's render
 * cycle and only needs the value at build-the-scene time.
 */
export const getStations = () => getState().content.stations;
export const getProfile = () => getState().content.profile;
