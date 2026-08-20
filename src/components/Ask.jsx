import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, setState, raw, t, useUI } from '../store';
import { buildKB } from '../ai/kb';
import { index } from '../ai/search';
import { answerLocal, answerRemote } from '../ai/answer';
import Eve from './Eve';

/* ==================================================================
   ASK — an assistant that only knows what the site knows
   ------------------------------------------------------------------
   The knowledge base is rebuilt whenever the data or the language
   changes, so editing public/data/*.json changes the answers with no
   rebuild — the same contract the rest of the page already follows.
   ================================================================== */


const IconSend = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M4 12h14m0 0-5-5m5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

function goTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (raw.lenis) raw.lenis.scrollTo(el, { offset: -10 });
  else el.scrollIntoView({ behavior: 'smooth' });
}

export default function Ask() {
  const lang = useStore((s) => s.lang);
  const open = useStore((s) => s.ask);
  const content = useStore((s) => s.content);
  const site = useStore((s) => s.site);
  const UI = useUI();

  const [cv, setCv] = useState('');
  const [q, setQ] = useState('');
  const [thread, setThread] = useState([]);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  const AI = UI?.ask ?? {};
  const endpoint = site?.assistant?.endpoint || null;

  /* the CV is plain text next to the JSON, so it stays editable too */
  useEffect(() => {
    const base = import.meta.env.BASE_URL ?? './';
    const baked = typeof window !== 'undefined' && window.__CV_TEXT__;
    if (baked) return setCv(baked);
    let alive = true;
    fetch(`${base}data/cv.txt`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((txt) => alive && setCv(txt))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const docs = useMemo(() => buildKB(content, site, cv, lang), [content, site, cv, lang]);
  const idx = useMemo(() => index(docs), [docs]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 260);
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread, busy]);

  /* "/" opens it, Escape closes it */
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target?.tagName ?? '');
      if (e.key === 'Escape') setState({ ask: false });
      else if (e.key === '/' && !typing) {
        e.preventDefault();
        setState({ ask: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ask = async (question) => {
    const text = String(question ?? q).trim();
    if (!text || busy) return;
    setQ('');
    setThread((prev) => [...prev, { role: 'you', text }]);
    setBusy(true);

    let result = null;
    if (endpoint) result = await answerRemote(text, idx, lang, endpoint);
    if (!result) result = answerLocal(text, idx, docs, lang);

    setThread((prev) => [...prev, { role: 'ai', ...result }]);
    setBusy(false);
  };

  const suggestions = t(AI.suggestions, lang) ?? [];

  return (
    /* One stage holds the robot, its beam and the dialog, so the three
       share a coordinate space: the panel hangs off the same drift that
       carries the robot instead of being pinned to the viewport. */
    <div className={`evestage ${open ? 'is-open' : ''}`}>
      {/* The cone of light the dialog is carried on. It belongs to the
          stage rather than the button so it can widen from the lamp all
          the way out to the panel. */}
      <span className="evebeam" aria-hidden />

      {/* The assistant is a robot that keeps station on the page; its
          chest lamp is the control, and the dialog is projected from it. */}
      <Eve
        open={open}
        onToggle={() => setState({ ask: !open })}
        label={t(AI.open, lang) || 'Ask'}
      />

      <aside className={`ask ask--proj ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <header className="ask__head">
          <span className="survey survey--plain">{t(AI.title, lang) || 'Ask about Ahmed'}</span>
          <button className="ask__x" onClick={() => setState({ ask: false })} aria-label="Close">
            <IconClose />
          </button>
        </header>

        <div className="ask__body" ref={bodyRef}>
          {!thread.length && (
            <div className="ask__intro">
              <p>{t(AI.intro, lang)}</p>
              <div className="ask__chips">
                {suggestions.map((s) => (
                  <button key={s} className="ask__chip" onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {thread.map((m, i) =>
            m.role === 'you' ? (
              <p className="ask__you" key={i}>
                {m.text}
              </p>
            ) : (
              <div className="ask__ai" key={i}>
                <p className={`ask__lead ${m.prose ? 'is-prose' : ''}`}>{m.lead}</p>

                {!m.prose &&
                  m.cards.map((c) => (
                    <article className="ask__card" key={c.id}>
                      <h4>{c.title}</h4>
                      {c.meta && <span className="ask__meta">{c.meta}</span>}
                      {c.body && <p>{c.body}</p>}
                      {!!c.links?.length && (
                        <ul className="ask__links">
                          {c.links.map((l) => (
                            <li key={l.label}>
                              <span>{l.label}</span>
                              <a
                                href={l.href}
                                download={l.download || undefined}
                                target={l.href?.startsWith('http') ? '_blank' : undefined}
                                rel="noreferrer"
                              >
                                {l.value}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      {c.section && (
                        <button className="ask__jump" onClick={() => { goTo(c.section); setState({ ask: false }); }}>
                          {t(AI.jump, lang) || 'Open section'}
                        </button>
                      )}
                    </article>
                  ))}

                {m.prose && !!m.cards.length && (
                  <div className="ask__srcs">
                    <b>{t(AI.sources, lang) || 'Sources'}</b>
                    {m.cards.map((c) => (
                      <button key={c.id} onClick={() => { goTo(c.section); setState({ ask: false }); }}>
                        {c.title}
                      </button>
                    ))}
                  </div>
                )}

                {m.note && <span className="ask__note">{m.note}</span>}
              </div>
            )
          )}

          {busy && <p className="ask__busy">{t(AI.thinking, lang) || '…'}</p>}
        </div>

        <form
          className="ask__form"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(AI.placeholder, lang) || 'Ask anything about Ahmed…'}
            aria-label={t(AI.placeholder, lang) || 'Ask'}
          />
          <button type="submit" disabled={!q.trim() || busy} aria-label="Send">
            <IconSend />
          </button>
        </form>
      </aside>
    </div>
  );
}
