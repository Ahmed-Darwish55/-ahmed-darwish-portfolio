/* ==================================================================
   ANSWERING
   ------------------------------------------------------------------
   Two engines behind one call:
     local  — intent rules over the retrieved documents. Offline, free,
              and structurally unable to make anything up.
     remote — an LLM behind a proxy the owner deploys. Used only when
              site.json names an endpoint, and it falls back to local
              on any failure, so the page never ends up with no answer.
   ================================================================== */

import { search, normalise } from './search';

const has = (q, ...words) => words.some((w) => q.includes(normalise(w)));

const COPY = {
  en: {
    nothing:
      "I could not find that in Ahmed's data. Try asking about his projects, the Esri award, his stack, where he works, or how to reach him.",
    contact: 'Here is how to reach Ahmed:',
    where: 'Where Ahmed is based:',
    exp: "Ahmed's experience, most recent first:",
    skills: 'The stack, layer by layer:',
    projects: 'Shipped projects:',
    award: 'Recognition:',
    edu: 'Education and certificates:',
    found: 'From the site data:',
    sources: 'Sources',
    offline: 'Answered from the site data.',
    who: 'Ahmed in short:',
    available:
      'Ahmed is open to frontend, GIS and creative-web roles — remote or on site in the Gulf. The fastest route is email:',
    years: (n, since) => `About ${n} years building for the web, since ${since}.`,
  },
  ar: {
    nothing:
      'ما لقيت هذي المعلومة في بيانات أحمد. جرّب تسأل عن مشاريعه، جائزة Esri، أدواته التقنية، مكان عمله، أو طريقة التواصل معه.',
    contact: 'طرق التواصل مع أحمد:',
    where: 'مقر أحمد:',
    exp: 'خبرة أحمد، من الأحدث للأقدم:',
    skills: 'الأدوات والتقنيات، طبقة طبقة:',
    projects: 'المشاريع المنفَّذة:',
    award: 'التكريم والجوائز:',
    edu: 'الدراسة والشهادات:',
    found: 'من بيانات الموقع:',
    sources: 'المصادر',
    offline: 'الإجابة مبنية على بيانات الموقع.',
    who: 'أحمد باختصار:',
    available:
      'أحمد منفتح على أدوار الواجهات الأمامية و GIS والويب الإبداعي — عن بُعد أو داخل الخليج. أسرع طريقة هي البريد:',
    years: (n, since) => `حوالي ${n} سنوات في تطوير الويب، منذ ${since}.`,
  },
};

const pick = (docs, kind) => docs.filter((d) => d.kind === kind);

/** Formats a document as a compact card the panel can render. */
const card = (d) => ({
  id: d.id,
  title: d.title,
  meta: d.meta,
  body: d.body,
  links: d.links ?? null,
  section: d.section,
});

/* ------------------------------------------------------------------ */
/* Intents — the questions a recruiter actually asks, answered exactly */
/* ------------------------------------------------------------------ */
function intent(q, docs, lang) {
  const c = COPY[lang] ?? COPY.en;

  /* "who is he" / "من هو" — the summary, not a keyword match */
  if (has(q, 'who is', 'who s', 'about him', 'about ahmed', 'introduce', 'summary', 'profile', 'bio',
          'من هو', 'مين هو', 'عن احمد', 'نبذه', 'تعريف', 'ملخص'))
    return { lead: c.who, cards: pick(docs, 'profile').map(card) };

  /* "how many years" — computed from the first year in the facts */
  if (has(q, 'how many years', 'years of experience', 'how long has', 'كم سنه', 'كم سنوات', 'كم سنة', 'عدد سنوات')) {
    const since = docs
      .filter((d) => d.kind === 'fact')
      .map((d) => (d.title.match(/\b(19|20)\d{2}\b/) || [])[0])
      .find(Boolean);
    if (since) {
      const n = new Date().getFullYear() - Number(since);
      return { lead: c.years(n, since), cards: pick(docs, 'role').slice().reverse().map(card) };
    }
  }

  if (has(q, 'available', 'availability', 'open to', 'hiring', 'looking for', 'freelance', 'notice period',
          'متاح', 'متفرغ', 'يبحث عن', 'فرصه', 'يقبل', 'توظيف حاليا'))
    return { lead: c.available, cards: pick(docs, 'profile').map(card) };

  if (has(q, 'email', 'contact', 'reach', 'hire', 'phone', 'whatsapp', 'linkedin', 'github',
          'ايميل', 'بريد', 'تواصل', 'اتصال', 'رقم', 'جوال', 'توظيف'))
    return { lead: c.contact, cards: pick(docs, 'profile').map(card) };

  if (has(q, 'where', 'based', 'live', 'location', 'city', 'country', 'relocate', 'remote',
          'وين', 'اين', 'مقر', 'يسكن', 'مدينه', 'دوله', 'بلد', 'عن بعد'))
    return { lead: c.where, cards: [...pick(docs, 'station'), ...pick(docs, 'profile')].slice(0, 3).map(card) };

  if (has(q, 'experience', 'years', 'worked', 'career', 'job', 'employer', 'company', 'history',
          'خبره', 'خبرات', 'سنوات', 'وظيفه', 'وظائف', 'شركه', 'شركات', 'عمل'))
    return { lead: c.exp, cards: pick(docs, 'role').slice().reverse().map(card) };

  if (has(q, 'skill', 'stack', 'tech', 'technolog', 'tool', 'language', 'framework', 'angular', 'react',
          'مهاره', 'مهارات', 'تقني', 'تقنيات', 'ادوات', 'لغه', 'لغات', 'يستخدم'))
    return { lead: c.skills, cards: pick(docs, 'skill').map(card) };

  if (has(q, 'project', 'portfolio', 'built', 'shipped', 'case study', 'work on',
          'مشروع', 'مشاريع', 'اعمال', 'شغل', 'بنى', 'نفذ'))
    return { lead: c.projects, cards: pick(docs, 'project').map(card) };

  if (has(q, 'award', 'esri', 'recognition', 'prize', 'honour', 'honor',
          'جائزه', 'جوائز', 'تكريم', 'تقدير'))
    return { lead: c.award, cards: [...pick(docs, 'award'), ...pick(docs, 'conference')].map(card) };

  if (has(q, 'education', 'degree', 'university', 'study', 'certificate', 'diploma', 'course',
          'دراسه', 'شهاده', 'شهادات', 'جامعه', 'بكالوريوس', 'دبلوم', 'دوره', 'دورات'))
    return { lead: c.edu, cards: pick(docs, 'certificate').map(card) };

  return null;
}

/**
 * Answers locally.
 * @returns {{lead:string, cards:Array, note:string}}
 */
export function answerLocal(question, idx, allDocs, lang) {
  const c = COPY[lang] ?? COPY.en;
  const q = normalise(question);
  const byIntent = intent(q, allDocs, lang);

  /* An intent gives the complete, ordered set — but only if the words
     the person used also appear somewhere, so "award" in a sentence
     about something else does not hijack the answer. */
  if (byIntent?.cards?.length) return { ...byIntent, note: c.offline };

  const hits = search(idx, question, 5);
  if (!hits.length) {
    const profile = allDocs.filter((d) => d.kind === 'profile').map(card);
    return { lead: c.nothing, cards: profile, note: '' };
  }

  return { lead: c.found, cards: hits.map((h) => card(h.doc)), note: c.offline };
}

/**
 * Asks the owner's LLM proxy, with the retrieved documents as context.
 * Any failure returns null so the caller can fall back to local.
 */
export async function answerRemote(question, idx, lang, endpoint, signal) {
  const hits = search(idx, question, 8);
  const context = hits.map((h) => `## ${h.doc.title}\n${h.doc.meta ?? ''}\n${h.doc.body ?? ''}`).join('\n\n');
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, lang, context }),
      signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const text = data?.answer ?? data?.text ?? data?.content;
    if (!text) throw new Error('empty answer');
    return {
      lead: String(text).trim(),
      cards: hits.slice(0, 3).map((h) => ({ id: h.doc.id, title: h.doc.title, section: h.doc.section })),
      note: '',
      prose: true,
    };
  } catch {
    return null;
  }
}
