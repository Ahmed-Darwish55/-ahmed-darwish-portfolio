/* ==================================================================
   RETRIEVAL
   ------------------------------------------------------------------
   A small bilingual BM25-ish ranker. No model, no network, no keys —
   it runs in the page and cannot invent anything, because every word
   it returns came out of the JSON.
   ================================================================== */

/* Arabic needs normalising before it can be compared: strip the
   diacritics and tatweel, and fold the alef/ya/ta-marbuta variants. */
const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function normalise(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(AR_MARKS, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٪-٬]/g, '')
    .replace(/[^\p{L}\p{N}\s+#.@]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Words that carry no signal in either language. */
const STOP = new Set(
  ('a an the of in on at to for and or is are was were be been do does did what which who whom whose ' +
    'how when where why can could would should tell me about your you he his him with from that this ' +
    'have has had it its as by more most any some there their they i my mine please give show ' +
    'ما مالذي ماهي ماهو من في على عن الى إلى هل كيف متى اين أين لماذا هو هي هم انت أنت انا أنا و ثم' +
    ' الذي التي مع كان كانت يكون له لها عند عندك لديك ايه إيه وش وشو كم اي أي ال هذا هذه ذلك تلك')
    .split(/\s+/)
);

const tokenise = (s) =>
  normalise(s)
    .split(' ')
    .filter((w) => w && w.length > 1 && !STOP.has(w));

/** Light stemming: drop the Arabic definite article and common plurals. */
const stem = (w) => {
  let x = w;
  if (x.length > 4 && x.startsWith('ال')) x = x.slice(2);
  if (x.length > 4 && /(s|ing|ed)$/.test(x) && !/ss$/.test(x)) x = x.replace(/(ing|ed|s)$/, '');
  return x;
};

/** Precomputes term frequencies and document frequencies. */
export function index(docs) {
  const df = new Map();
  const prepared = docs.map((d) => {
    const words = tokenise(d.text).map(stem);
    const titleWords = new Set(tokenise(d.title).map(stem));
    const tf = new Map();
    words.forEach((w) => tf.set(w, (tf.get(w) ?? 0) + 1));
    tf.forEach((_, w) => df.set(w, (df.get(w) ?? 0) + 1));
    return { doc: d, tf, titleWords, len: words.length || 1, norm: normalise(d.text) };
  });
  const avg = prepared.reduce((a, p) => a + p.len, 0) / (prepared.length || 1);
  return { prepared, df, avg, n: prepared.length || 1 };
}

const K1 = 1.4;
const B = 0.6;

/**
 * @returns {Array<{doc, score}>} best matches, highest first
 */
export function search(idx, query, limit = 5) {
  const qWords = [...new Set(tokenise(query).map(stem))];
  if (!qWords.length) return [];
  const phrase = normalise(query);

  const scored = idx.prepared.map((p) => {
    let score = 0;
    for (const w of qWords) {
      const f = p.tf.get(w) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + (idx.n - (idx.df.get(w) ?? 0) + 0.5) / ((idx.df.get(w) ?? 0) + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * p.len) / idx.avg)));
      if (p.titleWords.has(w)) score += idf * 0.9; // a title hit is a strong signal
    }
    if (phrase.length > 6 && p.norm.includes(phrase)) score += 4;
    return { doc: p.doc, score: score * (p.doc.weight ?? 1) };
  });

  return scored
    .filter((s) => s.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
