import { useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Reveal from './Reveal';
import NodeLinks from './NodeLinks';
import MapField from './MapField';
import { useStore, setState, raw, t, useUI } from '../store';
import { img } from '../site';

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/* Shared shell — owns the phase hand-off to the 3D scene              */
/* ------------------------------------------------------------------ */
function Section({ id, phase, className = '', children }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const st = ScrollTrigger.create({
      trigger: ref.current,
      start: 'top 60%',
      end: 'bottom 40%',
      onToggle: (self) => self.isActive && setState({ phase }),
    });
    return () => st.kill();
  }, [phase]);
  return (
    <section id={id} ref={ref} className={`section ${className}`}>
      <div className="section__inner">{children}</div>
    </section>
  );
}

/** Mono metadata line with a survey tick. */
function Survey({ children, plain }) {
  return <span className={`survey ${plain ? 'survey--plain' : ''}`}>{children}</span>;
}

function openLightbox(images, caption, index = 0) {
  const list = images.map(img).filter(Boolean);
  if (list.length) setState({ lightbox: { images: list, caption, index } });
}

/** Scrolls to a section by id, through Lenis when it is available. */
function goTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (raw.lenis) raw.lenis.scrollTo(el, { offset: -10 });
  else el.scrollIntoView({ behavior: 'smooth' });
}

/* ================================================================== */
/* 4 · Esri Award — a landmark interruption, not an awards card        */
/* ================================================================== */
export function Award() {
  const lang = useStore((s) => s.lang);
  const UI = useUI();
  const ref = useRef();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.award-land', {
        y: 50,
        opacity: 0,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: ref.current, start: 'top 76%', once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <Section id="award" phase={4} className="section--sheet section--award">
      <div ref={ref} className="col col--atlas">
        <div className="award-land">
          <Survey>{t(UI.awardEyebrow, lang)}</Survey>
          <div className="award-land__year">{t(UI.awardYear, lang)}</div>
          <h2 className="award-land__name">{t(UI.awardName, lang)}</h2>

          <div className="award-land__to">
            <Survey plain>{t(UI.awardTo, lang)}</Survey>
            <div className="award-land__project">{t(UI.awardProject, lang)}</div>
          </div>

          <div className="award-land__role">
            <Survey plain>{t(UI.awardRoleLabel, lang)}</Survey>
            <p>{t(UI.awardRole, lang)}</p>
          </div>

          {/* States plainly that the platform won, not Ahmed personally. */}
          <p className="award-land__note">{t(UI.awardNote, lang)}</p>
          <Survey>{t(UI.awardWhere, lang)}</Survey>
        </div>
      </div>
    </Section>
  );
}

/* ================================================================== */
/* 5 · Case studies — one environment per project                      */
/* ================================================================== */
function Case({ c, lang, UI }) {
  const did = t(c.did, lang) ?? [];
  const src = img(c.image);
  return (
    <article className="case" style={{ '--tone': c.accent }} data-env={c.env}>
      <div className="case__visual">
        {src && (
          <img
            src={src}
            alt={`${t(c.title, lang)} — ${t(c.kind, lang)}`}
            loading="lazy"
            decoding="async"
          />
        )}
        {c.placeholder && <span className="case__badge">{t(UI.placeholderNote, lang)}</span>}
      </div>

      <div className="case__body">
        <div className="case__meta">
          <span className="case__kind">{t(c.kind, lang)}</span>
          <span className="case__period">{c.period}</span>
          {c.team && <span className="case__teamtag">{t(UI.caseTeam, lang)}</span>}
        </div>

        <h3 className="case__title">{t(c.title, lang)}</h3>
        <p className="case__context">{t(c.context, lang)}</p>

        <div className="case__block">
          <span className="case__label">{t(UI.caseRole, lang)}</span>
          <p className="case__role">{t(c.role, lang)}</p>
        </div>

        <div className="case__block">
          <span className="case__label">{t(UI.caseDid, lang)}</span>
          <ul className="case__did">
            {did.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>

        <div className="case__block">
          <span className="case__label">{t(UI.caseTech, lang)}</span>
          <div className="case__tech">
            {(c.tech ?? []).map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        </div>

        {c.outcome && <p className="case__outcome">{t(c.outcome, lang)}</p>}
      </div>
    </article>
  );
}

/* A counter that runs up to its value when it is scrolled into view. */
function Metric({ value, label, tone, suffix = '' }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const n = { v: 0 };
      gsap.to(n, {
        v: value,
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: () => {
          el.textContent = Math.round(n.v) + suffix;
        },
      });
    }, el);
    return () => ctx.revert();
  }, [value, suffix]);

  return (
    <div className="metric" style={tone ? { '--tone': tone } : undefined}>
      {/* the final value is the markup, so it is right with JS disabled
          and for a screen reader; the tween only animates up to it */}
      <span className="metric__num" ref={ref}>
        {value}
        {suffix}
      </span>
      <span className="metric__label">{label}</span>
    </div>
  );
}

/* A distribution bar: one row per environment, width by share. */
function EnvBars({ cases, UI, lang }) {
  const rows = useMemo(() => {
    const by = new Map();
    for (const c of cases) by.set(c.env, (by.get(c.env) ?? 0) + 1);
    const max = Math.max(...by.values(), 1);
    return [...by.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([env, n]) => ({ env, n, pct: (n / max) * 100 }));
  }, [cases]);

  const ref = useRef();
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.envbar__fill', {
        scaleX: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: 'top 88%', once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, [rows.length]);

  return (
    <div className="envbars" ref={ref}>
      <span className="envbars__title">{t(UI.workEnvLabel, lang)}</span>
      {rows.map((r) => (
        <div className="envbar" key={r.env} data-env={r.env}>
          <span className="envbar__name">{r.env}</span>
          <span className="envbar__track">
            <span className="envbar__fill" style={{ width: `${r.pct}%` }} />
          </span>
          <span className="envbar__n">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export function Cases() {
  const lang = useStore((s) => s.lang);
  const UI = useUI();
  const cases = useStore((s) => s.site.cases) ?? [];
  const ref = useRef();

  /* Every figure here is counted from the case list, so the panel can
     never drift out of step with the work below it. */
  const stats = useMemo(() => {
    const orgs = new Set(cases.map((c) => c.org).filter(Boolean));
    const tech = new Set(cases.flatMap((c) => c.tech ?? []));
    return { platforms: cases.length, orgs: orgs.size, tech: tech.size };
  }, [cases]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.case').forEach((el) => {
        gsap.from(el, {
          y: 48,
          opacity: 0,
          duration: 0.95,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 84%', once: true },
        });
      });
    }, ref);
    return () => ctx.revert();
  }, [lang, cases.length]);

  return (
    <Section id="work" phase={5} className="section--sheet">
      <div ref={ref} className="col col--atlas">
        <div className="secthead">
          <Survey>{t(UI.workTitle, lang)}</Survey>
          <Reveal as="h2" className="h2" text={t(UI.workSub, lang)} />
        </div>

        {/* A read-out of the work below, counted from the same list. */}
        <div className="readout">
          <div className="readout__metrics">
            <Metric value={stats.platforms} label={t(UI.workStatPlatforms, lang)} tone="var(--teal)" />
            <Metric value={stats.orgs} label={t(UI.workStatOrgs, lang)} tone="var(--cyan)" />
            <Metric value={stats.tech} label={t(UI.workStatTech, lang)} tone="var(--gold)" />
          </div>
          <EnvBars cases={cases} UI={UI} lang={lang} />
        </div>

        <div className="cases">
          {cases.map((c) => (
            <Case key={c.id} c={c} lang={lang} UI={UI} />
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ================================================================== */
/* 6 · Digital Twin — promoted out of the conference list              */
/* ================================================================== */
export function Twin() {
  const lang = useStore((s) => s.lang);
  const UI = useUI();
  const twin = useStore((s) => s.site.twin);
  const ref = useRef();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.twin', {
        y: 50,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: ref.current, start: 'top 78%', once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, [lang]);

  if (!twin) return null;
  const shots = (twin.gallery ?? []).map(img).filter(Boolean);
  const did = t(twin.did, lang) ?? [];

  /* The panel reads only what the record actually holds — a row is
     dropped rather than filled with a placeholder. */
  const specs = [
    { k: t(UI.caseSubject, lang), v: t(twin.subject, lang) },
    { k: t(UI.caseClient, lang), v: twin.org },
    { k: t(UI.casePeriod, lang), v: twin.period },
    twin.team ? { k: t(UI.caseTeamLabel, lang), v: t(UI.caseTeam, lang) } : null,
  ].filter((s) => s && s.v);

  return (
    <Section id="twin" phase={6} className="section--sheet">
      <div ref={ref} className="col col--atlas">
        <div className="twin" style={{ '--tone': twin.accent }}>
          <div className="twin__grid">
            <div className="twin__body">
              <Survey>{t(UI.twinEyebrow, lang)}</Survey>
              <h2 className="twin__title">{t(UI.twinTitle, lang)}</h2>
              <p className="twin__sub">{t(UI.twinSub, lang)}</p>

              <div className="case__block">
                <span className="case__label" style={{ '--tone': twin.accent }}>
                  {t(UI.caseDid, lang)}
                </span>
                <ul className="case__did">
                  {did.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              {/* A spec panel rather than a metadata line: the same facts,
                  read the way an instrument panel is read. */}
              <dl className="spec">
                {specs.map((s) => (
                  <div className="spec__row" key={s.k}>
                    <dt className="spec__k">{s.k}</dt>
                    <dd className="spec__v">{s.v}</dd>
                  </div>
                ))}
              </dl>

              <div className="case__tech">
                {(twin.tech ?? []).map((x) => (
                  <span key={x}>{x}</span>
                ))}
              </div>
            </div>

            <div className="twin__gallery">
              {shots.map((src, i) => (
                <button
                  key={src}
                  className="twin__shot"
                  onClick={() => openLightbox(twin.gallery, t(twin.title, lang), i)}
                  aria-label={`${t(twin.title, lang)} — ${i + 1}/${shots.length}`}
                >
                  <img src={src} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ================================================================== */
/* 7 · The Stack — five layers of one system                           */
/* ================================================================== */

/* One layer, drawn as a node on the board. */
function StackNode({ l, lang, UI, titleOf, goTo }) {
  return (
    <article className="wnode" data-node={l.id} style={{ '--tone': l.accent }}>
      <header className="wnode__head">
        <span className="wnode__z">Z{String(l.z).padStart(2, '0')}</span>
        <h3 className="wnode__name">{t(l.title, lang)}</h3>
      </header>
      <p className="wnode__blurb">{t(l.blurb, lang)}</p>
      <div className="case__tech wnode__tech">
        {(l.tech ?? []).map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      {!!(l.evidence ?? []).length && (
        <footer className="wnode__ev">
          <b>{t(UI.stackEvidence, lang)}</b>
          {(l.evidence ?? []).map((id) => (
            <button key={id} onClick={() => goTo(id === 'twin' ? 'twin' : 'work')}>
              {titleOf(id) ?? t(UI.twinTitle, lang)}
            </button>
          ))}
        </footer>
      )}
    </article>
  );
}

export function Stack() {
  const lang = useStore((s) => s.lang);
  const UI = useUI();
  const layers = useStore((s) => s.site.stack) ?? [];
  const cases = useStore((s) => s.site.cases) ?? [];
  const ref = useRef();
  const wireRef = useRef();

  /* Titles for the evidence links, resolved from the case list. */
  const titleOf = useCallback(
    (id) => {
      if (id === 'twin') return null; // handled by the twin section
      const c = cases.find((x) => x.id === id);
      return c ? t(c.title, lang) : null;
    },
    [cases, lang]
  );

  /* Split the layers either side of the core, and build the wiring in
     the same pass: `layers` is a fresh array on every store read, so
     slicing it inline would hand <NodeLinks> a new `links` identity each
     render and restart its measure effect forever. */
  const { left, right, wireLinks } = useMemo(() => {
    const half = Math.ceil(layers.length / 2);
    const a = layers.slice(0, half);
    const b = layers.slice(half);
    return {
      left: a,
      right: b,
      /* Every layer wires into the core, each in its own accent. */
      wireLinks: [
        ...a.map((l) => ({
          from: `[data-node="${l.id}"]`,
          fromSide: 'right',
          to: '[data-node="core"]',
          toSide: 'left',
          tone: l.accent,
        })),
        ...b.map((l) => ({
          from: '[data-node="core"]',
          fromSide: 'right',
          to: `[data-node="${l.id}"]`,
          toSide: 'left',
          tone: l.accent,
        })),
      ],
    };
  }, [layers]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.wnode', {
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: 'top 80%', once: true },
      });
      gsap.from('.wiremap__core', {
        scale: 0.7,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(2)',
        scrollTrigger: { trigger: ref.current, start: 'top 80%', once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, [lang, layers.length]);

  return (
    <Section id="stack" phase={7} className="section--sheet section--gis">
      {/* the ground these layers describe: real coastline, the same
          land sample the globe is built from, projected flat */}
      <div className="gisbase" aria-hidden>
        <MapField />
      </div>

      <div ref={ref} className="col col--atlas">
        <div className="secthead">
          <Survey>{t(UI.stackTitle, lang)}</Survey>
          <Reveal as="h2" className="h2" text={t(UI.stackSub, lang)} />
        </div>

        {/* The stack is a set of layers that talk to each other, so it is
            drawn as one: nodes either side of a core, wired into it. */}
        <div className="wiremap" ref={wireRef}>
          <NodeLinks containerRef={wireRef} links={wireLinks} />

          <div className="wiremap__col">
            {left.map((l) => (
              <StackNode key={l.id} l={l} lang={lang} UI={UI} titleOf={titleOf} goTo={goTo} />
            ))}
          </div>

          <div className="wiremap__core" data-node="core">
            <div className="wiremap__ring" />
            <div className="wiremap__ring" />
            <div className="wiremap__disc">
              <span className="wiremap__num">{layers.length}</span>
              <span className="wiremap__unit">{t(UI.stackTitle, lang)}</span>
            </div>
          </div>

          <div className="wiremap__col">
            {right.map((l) => (
              <StackNode key={l.id} l={l} lang={lang} UI={UI} titleOf={titleOf} goTo={goTo} />
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ================================================================== */
/* 8 · Recognition — conferences, awards and certificates, condensed   */
/* ================================================================== */
export function Proof() {
  const lang = useStore((s) => s.lang);
  const UI = useUI();
  const site = useStore((s) => s.site);
  const confs = site.conferences ?? [];
  const awards = site.awards ?? [];
  const certs = site.certificates ?? [];
  const ref = useRef();
  const wireRef = useRef();

  /* The three kinds of proof, each a hub on the board. Built as one list
     so the markup below does not repeat itself three times. */
  const groups = useMemo(
    () =>
      [
        {
          key: 'conf',
          label: t(UI.confLabel, lang),
          tone: 'var(--cyan)',
          items: confs.map((c) => ({
            key: c.id,
            year: c.date,
            name: t(c.title, lang),
            note: t(c.place, lang),
            link: c.link,
            gallery: c.gallery?.length ? c.gallery : c.cover ? [c.cover] : null,
            caption: t(c.title, lang),
          })),
        },
        {
          key: 'award',
          label: t(UI.awardsLabel, lang),
          tone: 'var(--gold)',
          items: awards.map((a) => ({
            key: a.id,
            year: a.year,
            name: t(a.title, lang),
            note: t(a.place, lang),
            gallery: a.image ? [a.image] : null,
            caption: t(a.title, lang),
          })),
        },
        {
          key: 'cert',
          label: t(UI.certsLabel, lang),
          tone: 'var(--teal)',
          items: certs.map((c) => ({
            key: c.id,
            year: c.year,
            name: t(c.title, lang),
            note: c.issuer,
            link: c.link,
          })),
        },
      ].filter((g) => g.items.length),
    [confs, awards, certs, lang, UI]
  );

  const proofLinks = useMemo(
    () =>
      groups.map((g) => ({
        from: '[data-node="proof-core"]',
        fromSide: 'right',
        to: `[data-node="${g.key}"]`,
        toSide: 'left',
        tone: g.tone,
      })),
    [groups]
  );

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.proof__item', {
        y: 26,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.05,
        scrollTrigger: { trigger: ref.current, start: 'top 82%', once: true },
      });
      gsap.from('.constel__core', {
        scale: 0.7,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(2)',
        scrollTrigger: { trigger: ref.current, start: 'top 82%', once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, [lang, confs.length, certs.length]);

  const Item = ({ year, name, note, link, gallery, caption }) => {
    const inner = (
      <>
        <span className="proof__year">{year}</span>
        <span className="proof__name">{name}</span>
        {note && <span className="proof__note">{note}</span>}
      </>
    );
    if (gallery?.length) {
      return (
        <button className="proof__item" onClick={() => openLightbox(gallery, caption)}>
          {inner}
        </button>
      );
    }
    if (link) {
      return (
        <a className="proof__item" href={link} target="_blank" rel="noreferrer">
          {inner}
        </a>
      );
    }
    return (
      <div className="proof__item">
        {inner}
      </div>
    );
  };

  return (
    <Section id="proof" phase={8} className="section--sheet">
      <div ref={ref} className="col col--atlas">
        <div className="secthead">
          <Survey>{t(UI.proofTitle, lang)}</Survey>
          <Reveal as="h2" className="h2" text={t(UI.proofSub, lang)} />
        </div>

        {/* Three hubs wired to one core: the shape says "these are the
            three kinds of proof" before a single item is read. */}
        <div className="constel" ref={wireRef}>
          <NodeLinks containerRef={wireRef} links={proofLinks} />

          <div className="constel__core" data-node="proof-core">
            <div className="wiremap__ring" />
            <div className="wiremap__ring" />
            <div className="wiremap__disc">
              <span className="wiremap__num">{confs.length + awards.length + certs.length}</span>
              <span className="wiremap__unit">{t(UI.proofCoreLabel, lang)}</span>
            </div>
          </div>

          <div className="constel__groups">
            {groups.map((g) => (
              <section
                className="constel__group"
                key={g.key}
                data-node={g.key}
                style={{ '--tone': g.tone }}
              >
                <header className="constel__head">
                  <h3 className="constel__title">{g.label}</h3>
                  <span className="constel__count">{g.items.length}</span>
                </header>
                <div className="proof__row">
                  {g.items.map((it) => (
                    <Item key={it.key} {...it} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
