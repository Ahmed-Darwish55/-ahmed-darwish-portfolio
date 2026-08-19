import { useLayoutEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Reveal from './Reveal';
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

export function Cases() {
  const lang = useStore((s) => s.lang);
  const UI = useUI();
  const cases = useStore((s) => s.site.cases) ?? [];
  const ref = useRef();

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

              <div className="case__meta">
                <span className="case__period">{twin.period}</span>
                {twin.team && <span className="case__teamtag">{t(UI.caseTeam, lang)}</span>}
              </div>

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
export function Stack() {
  const lang = useStore((s) => s.lang);
  const UI = useUI();
  const layers = useStore((s) => s.site.stack) ?? [];
  const cases = useStore((s) => s.site.cases) ?? [];
  const [exploded, setExploded] = useState(true);
  const ref = useRef();

  /* Titles for the evidence links, resolved from the case list. */
  const titleOf = useCallback(
    (id) => {
      if (id === 'twin') return null; // handled by the twin section
      const c = cases.find((x) => x.id === id);
      return c ? t(c.title, lang) : null;
    },
    [cases, lang]
  );

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.stack__layer', {
        y: 36,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.09,
        scrollTrigger: { trigger: ref.current, start: 'top 80%', once: true },
        /* GSAP leaves an inline `transform` behind, and inline styles beat the
           stylesheet — which would silently kill the exploded-layer rule.
           Clearing the props hands control back to CSS. */
        onComplete() {
          gsap.set(this.targets(), { clearProps: 'transform,translate,rotate,scale' });
        },
      });
    }, ref);
    return () => ctx.revert();
  }, [lang, layers.length]);

  return (
    <Section id="stack" phase={7} className="section--sheet">
      <div ref={ref} className="col col--atlas">
        <div className="secthead">
          <Survey>{t(UI.stackTitle, lang)}</Survey>
          <Reveal as="h2" className="h2" text={t(UI.stackSub, lang)} />
        </div>

        <button
          className="stack__toggle"
          onClick={() => setExploded((v) => !v)}
          aria-pressed={exploded}
        >
          {exploded ? t(UI.stackCollapse, lang) : t(UI.stackExplode, lang)}
        </button>

        <div className={`stack ${exploded ? 'is-exploded' : ''}`}>
          {layers.map((l, i) => (
            <div
              className="stack__layer"
              key={l.id}
              style={{ '--tone': l.accent, '--i': layers.length - 1 - i }}
            >
              <span className="stack__z">Z{String(l.z).padStart(2, '0')}</span>
              <h3 className="stack__name">{t(l.title, lang)}</h3>
              <p className="stack__blurb">{t(l.blurb, lang)}</p>
              <div className="stack__side">
                <div className="stack__tech">
                  {(l.tech ?? []).map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                </div>
                <div className="stack__evidence">
                  <b>{t(UI.stackEvidence, lang)}</b>
                  {(l.evidence ?? []).map((id) => {
                    const label = titleOf(id);
                    const target = id === 'twin' ? 'twin' : 'work';
                    return (
                      <button key={id} className="stack__ev" onClick={() => goTo(target)}>
                        {label ?? t(UI.twinTitle, lang)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
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

        <div className="proof">
          {!!confs.length && (
            <div className="proof__group proof__group--conf">
              <h3 className="proof__title">{t(UI.confLabel, lang)}</h3>
              <div className="proof__row">
                {confs.map((c) => (
                  <Item
                    key={c.id}
                    year={c.date}
                    name={t(c.title, lang)}
                    note={t(c.place, lang)}
                    link={c.link}
                    gallery={c.gallery?.length ? c.gallery : c.cover ? [c.cover] : null}
                    caption={t(c.title, lang)}
                  />
                ))}
              </div>
            </div>
          )}

          {!!awards.length && (
            <div className="proof__group proof__group--award">
              <h3 className="proof__title">{t(UI.awardsLabel, lang)}</h3>
              <div className="proof__row">
                {awards.map((a) => (
                  <Item
                    key={a.id}
                    year={a.year}
                    name={t(a.title, lang)}
                    note={t(a.place, lang)}
                    gallery={a.image ? [a.image] : null}
                    caption={t(a.title, lang)}
                  />
                ))}
              </div>
            </div>
          )}

          {!!certs.length && (
            <div className="proof__group proof__group--cert">
              <h3 className="proof__title">{t(UI.certsLabel, lang)}</h3>
              <div className="proof__row">
                {certs.map((c) => (
                  <Item
                    key={c.id}
                    year={c.year}
                    name={t(c.title, lang)}
                    note={c.issuer}
                    link={c.link}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
