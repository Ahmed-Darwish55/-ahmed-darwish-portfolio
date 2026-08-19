import CONTENT from '../public/data/content.json';
import SITE from '../public/data/site.json';

/**
 * ALL site data lives in two JSON files under public/data:
 *
 *   content.json — profile, nav, ui copy, stations, stats
 *   site.json    — timeline, projects, skills, conferences, awards, certificates
 *
 * Both are imported here (so the bundle always has a copy and the single-file
 * build works offline) and re-fetched at runtime by App.jsx, so editing the
 * deployed files and refreshing is enough — no rebuild.
 */
export const DEFAULT_CONTENT = CONTENT;
export const DEFAULT_SITE = SITE;

/* Photos shipped with the source live in src/media and get hashed (or inlined
   in the single-file build). Anything that looks like a path is used as-is. */
const bundled = import.meta.glob('./media/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function img(src) {
  if (!src) return null;
  if (/^(https?:|data:|blob:|\.{0,2}\/)/.test(src)) return src;
  return bundled[`./media/${src}`] ?? null;
}

/* ------------------------------------------------------------------ */
/* Validation — what each file must contain to be usable               */
/* ------------------------------------------------------------------ */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isArr = Array.isArray;

/** Shape rules per file. Keys not listed here are merged but not checked. */
const SCHEMA = {
  content: {
    profile: isObj,
    nav: isArr,
    ui: isObj,
    stations: isArr,
    facts: isArr,
  },
  site: {
    timeline: isArr,
    cases: isArr,
    twin: isObj,
    stack: isArr,
    conferences: isArr,
    awards: isArr,
    certificates: isArr,
  },
};

/**
 * Checks a freshly fetched file against its schema.
 * Returns an array of human-readable problems — empty means it is good.
 */
export function validate(kind, data) {
  const rules = SCHEMA[kind];
  const problems = [];
  if (!isObj(data)) return [`${kind}.json must be a JSON object`];
  for (const [key, ok] of Object.entries(rules)) {
    if (!(key in data)) continue; // absent is fine — the bundled value is kept
    if (!ok(data[key])) {
      problems.push(`${kind}.json → "${key}" must be ${ok === isArr ? 'an array' : 'an object'}`);
    }
  }
  return problems;
}

/**
 * Deep-merges a fetched file over the bundled copy, so a missing or partial
 * key keeps working instead of blanking a whole section. Arrays replace
 * wholesale (that is what you want when editing a list); plain objects merge
 * key by key.
 */
export function merge(base, patch) {
  if (!isObj(patch)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isObj(v) && isObj(base?.[k]) ? merge(base[k], v) : v;
  }
  return out;
}
