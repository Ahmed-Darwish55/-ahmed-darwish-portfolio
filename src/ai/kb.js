/* ==================================================================
   KNOWLEDGE BASE
   ------------------------------------------------------------------
   Turns content.json + site.json + cv.txt into a flat list of small,
   self-describing documents. Everything the assistant can say comes
   from here — nothing is written into the assistant itself, so editing
   the JSON is enough to change what it knows.
   ================================================================== */

const T = (v, lang) => (v && typeof v === 'object' && !Array.isArray(v) ? v[lang] ?? v.en ?? '' : v ?? '');
const L = (v, lang) => {
  const x = v && typeof v === 'object' && !Array.isArray(v) ? v[lang] ?? v.en : v;
  return Array.isArray(x) ? x : x ? [x] : [];
};
const join = (...parts) => parts.filter(Boolean).join(' · ');

/**
 * @param {object} content  content.json
 * @param {object} site     site.json
 * @param {string} cv       plain text of the CV (may be empty)
 * @param {'en'|'ar'} lang
 * @returns {Array<{id,kind,section,title,meta,body,text}>}
 */
export function buildKB(content, site, cv, lang) {
  const docs = [];
  const add = (d) => {
    /* `text` is what the ranker reads; `body` is what the panel shows.
       Keeping them separate lets contact details be searchable without
       being dumped into the visible answer as raw URLs. */
    const text = [d.title, d.meta, d.body, d.searchOnly].filter(Boolean).join('\n');
    if (text.trim()) docs.push({ ...d, text });
  };

  const p = content?.profile ?? {};
  const ui = content?.ui ?? {};

  /* --- who / how to reach --------------------------------------- */
  add({
    id: 'profile',
    kind: 'profile',
    section: 'hero',
    title: T(p.fullName, lang) || T(p.name, lang),
    meta: join(T(p.role, lang), T(ui.basedIn, lang)),
    /* rendered as real links by the panel, so nobody has to copy a URL
       out of a paragraph */
    links: [
      p.email && { label: 'Email', value: p.email, href: `mailto:${p.email}` },
      p.phoneSa && { label: 'WhatsApp', value: p.phoneSa, href: p.whatsapp },
      p.phoneEg && { label: 'Phone (EG)', value: p.phoneEg, href: `tel:${String(p.phoneEg).replace(/\s/g, '')}` },
      p.linkedin && { label: 'LinkedIn', value: 'ahmed-darwish55', href: p.linkedin },
      p.github && { label: 'GitHub', value: 'Ahmed5510-Mac', href: p.github },
      p.codepen && { label: 'CodePen', value: 'ahmed5510-mac', href: p.codepen },
      p.cv && { label: 'CV', value: 'Ahmed-Darwish-CV.pdf', href: p.cv, download: true },
    ].filter(Boolean),
    body: T(ui.heroBlurb, lang),
    searchOnly: [
      `email ${p.email}`,
      p.phoneSa ? `phone Saudi Arabia ${p.phoneSa}` : '',
      p.phoneEg ? `phone Egypt ${p.phoneEg}` : '',
      p.linkedin ? `LinkedIn ${p.linkedin}` : '',
      p.github ? `GitHub ${p.github}` : '',
      p.codepen ? `CodePen ${p.codepen}` : '',
      p.whatsapp ? `WhatsApp ${p.whatsapp}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  /* --- headline numbers ------------------------------------------ */
  (content?.facts ?? []).forEach((f, i) =>
    add({
      id: `fact-${i}`,
      kind: 'fact',
      section: 'hero',
      title: `${f.value} — ${T(f.label, lang)}`,
      body: '',
    })
  );

  /* --- the two cities -------------------------------------------- */
  (content?.stations ?? []).forEach((s) =>
    add({
      id: `station-${s.id}`,
      kind: 'station',
      section: s.section ?? 'journey',
      title: T(s.city, lang),
      meta: join(T(s.label, lang), s.years),
      body: [T(s.tagline, lang), s.lat != null ? `${s.lat}, ${s.lon}` : ''].filter(Boolean).join('\n'),
    })
  );

  /* --- career timeline ------------------------------------------- */
  (site?.timeline ?? []).forEach((r, i) =>
    add({
      id: `role-${i}`,
      kind: 'role',
      section: r.station === 'giza' ? 'origin' : 'station',
      title: T(r.org, lang),
      meta: join(T(r.role, lang), r.period),
      body: L(r.bullets, lang).join('\n'),
    })
  );

  /* --- projects --------------------------------------------------- */
  (site?.cases ?? []).forEach((c) =>
    add({
      id: `case-${c.id}`,
      kind: 'project',
      section: 'work',
      title: T(c.title, lang),
      meta: join(T(c.kind, lang), c.period, (c.tech ?? []).join(', ')),
      body: [T(c.context, lang), T(c.role, lang), ...L(c.did, lang), T(c.outcome, lang)]
        .filter(Boolean)
        .join('\n'),
    })
  );

  /* --- the digital twin ------------------------------------------ */
  if (site?.twin) {
    const w = site.twin;
    add({
      id: 'twin',
      kind: 'project',
      section: 'twin',
      title: T(w.title, lang) || T(ui.twinTitle, lang),
      meta: join(w.period, (w.tech ?? []).join(', ')),
      body: [T(ui.twinSub, lang), ...L(w.did, lang)].filter(Boolean).join('\n'),
    });
  }

  /* --- skill layers ----------------------------------------------- */
  (site?.stack ?? []).forEach((l) =>
    add({
      id: `stack-${l.id}`,
      kind: 'skill',
      section: 'stack',
      title: T(l.title, lang),
      meta: (l.tech ?? []).join(', '),
      body: T(l.blurb, lang),
    })
  );

  /* --- recognition ------------------------------------------------ */
  (site?.conferences ?? []).forEach((c) =>
    add({
      id: `conf-${c.id}`,
      kind: 'conference',
      section: 'proof',
      title: T(c.title, lang),
      meta: join(c.date, T(c.place, lang)),
      body: T(c.desc, lang),
    })
  );

  (site?.awards ?? []).forEach((a) =>
    add({
      id: `award-${a.id}`,
      kind: 'award',
      section: 'award',
      title: T(a.title, lang),
      meta: join(a.year, T(a.place, lang)),
      body: T(a.desc, lang),
    })
  );

  add({
    id: 'award-main',
    kind: 'award',
    section: 'award',
    title: T(ui.awardName, lang),
    meta: join(T(ui.awardYear, lang), T(ui.awardWhere, lang)),
    body: [T(ui.awardProject, lang), T(ui.awardRole, lang), T(ui.awardNote, lang)].filter(Boolean).join('\n'),
  });

  (site?.certificates ?? []).forEach((c) =>
    add({
      id: `cert-${c.id}`,
      kind: 'certificate',
      section: 'proof',
      title: T(c.title, lang),
      meta: join(c.year, c.issuer),
      body: '',
    })
  );

  /* --- the CV, in paragraph-sized pieces -------------------------- */
  String(cv || '')
    .split(/\n{2,}|\n(?=[A-Z][a-z]+ [A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40)
    .forEach((chunk, i) => {
      const [head, ...rest] = chunk.split('\n');
      add({
        id: `cv-${i}`,
        kind: 'cv',
        section: 'hero',
        title: head.length < 70 ? head : 'CV',
        meta: 'CV',
        body: rest.join('\n') || chunk,
        /* the JSON is the maintained source; the CV is corroboration,
           so it only wins when nothing else matches */
        weight: 0.55,
      });
    });

  return docs;
}
