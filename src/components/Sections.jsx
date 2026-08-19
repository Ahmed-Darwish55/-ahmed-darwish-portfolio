import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Reveal from './Reveal';
import { useStore, setState, raw, t, useUI, useProfile, useStations } from '../store';

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/* Section shell — owns the phase hand-off to the 3D scene            */
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


/* ------------------------------------------------------------------ */
/* Buttons: the icon lifts off, spins and hovers above the button      */
/* ------------------------------------------------------------------ */
const IconMail = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <rect x="2.5" y="4.5" width="19" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="m3.5 7 7.3 5.2a2 2 0 0 0 2.4 0L20.5 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const IconDownload = () => (
  <svg viewBox="0 0 24 24" aria-hidden>
    <path d="M12 3.5v11m0 0 4-4m-4 4-4-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export function ActionButton({ href, download, primary, icon, children }) {
  return (
    <a className={`btn btn--fly ${primary ? 'btn--primary' : ''}`} href={href} download={download} data-cursor>
      <span className="btn__icon">{icon === 'mail' ? <IconMail /> : <IconDownload />}</span>
      <span className="btn__label">{children}</span>
    </a>
  );
}

function Eyebrow({ children, tone }) {
  return (
    <span className="eyebrow" style={tone ? { '--tone': tone } : undefined}>
      <i /> {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 0 · Hero                                                            */
/* ------------------------------------------------------------------ */
export function Hero() {
  const lang = useStore((s) => s.lang);
  const entered = useStore((s) => s.entered);
  const UI = useUI();
  const PROFILE = useProfile();
  const FACTS = useStore((s) => s.content.facts) ?? [];
  const ref = useRef();

  useLayoutEffect(() => {
    if (!entered) return;
    const ctx = gsap.context(() => {
      gsap.from('.hero__anim', {
        y: 40,
        opacity: 0,
        duration: 1.2,
        ease: 'power3.out',
        stagger: 0.12,
        delay: 0.35,
      });
    }, ref);
    return () => ctx.revert();
  }, [entered]);

  return (
    <Section id="hero" phase={0} className="section--scene section--hero">
      <div ref={ref} className="hero">
        <div className="hero__anim">
          <Eyebrow tone="#17D3A3">{t(UI.heroKicker, lang)}</Eyebrow>
        </div>
        <h1 className="hero__title">
          <Reveal as="span" className="hero__line" text={t(UI.heroLine1, lang)} delay={0.5} />
          <Reveal as="span" className="hero__line hero__line--accent" text={t(UI.heroLine2, lang)} delay={0.7} />
        </h1>
        <p className="hero__blurb hero__anim">{t(UI.heroBlurb, lang)}</p>
        <div className="hero__cta hero__anim">
          <ActionButton primary icon="mail" href={`mailto:${PROFILE.email}`}>
            {t(UI.emailMe, lang)}
          </ActionButton>
          <ActionButton icon="download" href={PROFILE.cv} download>
            {t(UI.downloadCv, lang)}
          </ActionButton>
        </div>
        <ul className="facts hero__anim">
          {FACTS.map((f) => (
            <li key={f.value}>
              <b>{f.value}</b>
              <span>{t(f.label, lang)}</span>
            </li>
          ))}
        </ul>
        <div className="scrollcue hero__anim">
          <span>{t(UI.scroll, lang)}</span>
          <i />
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 1 · Journey                                                         */
/* ------------------------------------------------------------------ */
export function Journey() {
  const lang = useStore((s) => s.lang);
  const hover = useStore((s) => s.hover);
  const focus = useStore((s) => s.focus);
  const UI = useUI();
  const STATIONS = useStations();
  const timer = useRef();

  /* hovering a card focuses that country on the globe */
  const enter = (id) => !focus && setState({ hover: id });
  const leave = () => !focus && setState({ hover: null });

  /* clicking one dives into it, then travels to its section */
  const open = (station) => {
    clearTimeout(timer.current);
    setState({ hover: station.id, focus: station.id });
    timer.current = setTimeout(() => {
      const el = document.getElementById(station.section);
      if (el) {
        if (raw.lenis) raw.lenis.scrollTo(el, { duration: 1.7, offset: 0 });
        else el.scrollIntoView({ behavior: 'smooth' });
      }
      setTimeout(() => setState({ focus: null, hover: null }), 1900);
    }, 1250);
  };

  useLayoutEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Section id="journey" phase={1} className="section--scene">
      <div className="col col--start">
        <Eyebrow tone="#4CC9F0">{t(UI.journeyTitle, lang)}</Eyebrow>
        <Reveal as="h2" className="h2" text={t(UI.journeySub, lang)} />
        <div className={`route ${hover ? 'is-picking' : ''}`}>
          {STATIONS.map((s, i) => (
            <article
              className={`route__item ${hover === s.id ? 'is-active' : ''}`}
              key={s.id}
              style={{ '--tone': s.color }}
              onMouseEnter={() => enter(s.id)}
              onMouseLeave={leave}
              onFocus={() => enter(s.id)}
              onBlur={leave}
              onClick={() => open(s)}
              tabIndex={0}
              role="button"
              data-cursor
            >
              <header>
                <span className="route__idx">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{t(s.city, lang)}</h3>
                  <p className="route__label">
                    {t(s.label, lang)} · {s.years}
                  </p>
                </div>
              </header>
              <p className="route__tag">{t(s.tagline, lang)}</p>
              <div className="route__foot">
                <code className="route__coords">
                  {s.lat.toFixed(4)}° N, {s.lon.toFixed(4)}° E
                </code>
                <span className="route__go">
                  {t(UI.openStation, lang)}
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 12h13m-6-6 6 6-6 6"
                    />
                  </svg>
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* 2 & 3 · Station sections (Giza / Dammam)                            */
/* ------------------------------------------------------------------ */
function StationSection({ id, phase, station, title, align }) {
  const lang = useStore((s) => s.lang);
  const timeline = useStore((s) => s.site.timeline) ?? [];
  const rows = timeline.filter((x) => x.station === station?.id);
  if (!station) return null;
  return (
    <Section id={id} phase={phase} className="section--scene">
      <div className={`col panel ${align === 'end' ? 'col--end' : 'col--start'}`}>
        <Eyebrow tone={station.color}>{t(title, lang)}</Eyebrow>
        <Reveal as="h2" className="h2" text={t(station.city, lang)} />
        <p className="lead">{t(station.tagline, lang)}</p>
        <ol className="timeline" style={{ '--tone': station.color }}>
          {rows.map((r, i) => (
            <li key={i}>
              <span className="timeline__period">{r.period}</span>
              <h3>{t(r.org, lang)}</h3>
              <p className="timeline__role">{t(r.role, lang)}</p>
              <ul>
                {t(r.bullets, lang).map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

export function Origin() {
  const UI = useUI();
  const STATIONS = useStations();
  return <StationSection id="origin" phase={2} station={STATIONS[0]} title={UI.originTitle} align="start" />;
}
export function Station() {
  const UI = useUI();
  const STATIONS = useStations();
  return <StationSection id="station" phase={3} station={STATIONS[1]} title={UI.stationTitle} align="end" />;
}

/* ------------------------------------------------------------------ */
/* Case studies, the stack, the award and recognition now live in      */
/* Atlas.jsx. Contact stays here.                                      */
/* ------------------------------------------------------------------ */

export function Contact() {
  const lang = useStore((s) => s.lang);
  const theme = useStore((s) => s.theme);
  const UI = useUI();
  const PROFILE = useProfile();
  const [copied, setCopied] = useState(false);

  /* Two portraits, one per theme. `portrait` alone still works: if only
     that key is set both themes use it. */
  const portrait = (theme === 'light' ? PROFILE.portraitLight : PROFILE.portraitDark) || PROFILE.portrait;
  const fallback = PROFILE.portrait || PROFILE.portraitDark || PROFILE.portraitLight;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PROFILE.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the mailto link still works */
    }
  };

  const links = [
    {
      label: 'LinkedIn',
      value: 'ahmed-darwish55',
      href: PROFILE.linkedin,
      tone: '#0A66C2',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0ZM.24 8.25h4.5V24H.24V8.25ZM8.02 8.25h4.31v2.15h.06c.6-1.14 2.07-2.34 4.26-2.34 4.56 0 5.4 3 5.4 6.9V24h-4.5v-7.9c0-1.88-.03-4.3-2.62-4.3-2.62 0-3.02 2.05-3.02 4.16V24h-4.5V8.25Z"
          />
        </svg>
      ),
    },
    {
      label: 'GitHub',
      value: 'Ahmed5510-Mac',
      href: PROFILE.github,
      tone: '#E9EEF7',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 .5C5.73.5.9 5.33.9 11.6c0 4.9 3.17 9.06 7.57 10.53.55.1.76-.24.76-.53v-2.06c-3.08.67-3.73-1.32-3.73-1.32-.5-1.29-1.23-1.63-1.23-1.63-1.01-.69.08-.67.08-.67 1.11.08 1.7 1.15 1.7 1.15.99 1.7 2.6 1.21 3.23.93.1-.72.39-1.21.7-1.49-2.46-.28-5.05-1.23-5.05-5.48 0-1.21.43-2.2 1.15-2.98-.12-.28-.5-1.41.11-2.94 0 0 .93-.3 3.05 1.14a10.6 10.6 0 0 1 5.56 0c2.12-1.44 3.05-1.14 3.05-1.14.61 1.53.23 2.66.11 2.94.72.78 1.15 1.77 1.15 2.98 0 4.26-2.6 5.2-5.07 5.47.4.35.76 1.03.76 2.08v3.08c0 .3.2.64.77.53A11.11 11.11 0 0 0 23.1 11.6C23.1 5.33 18.27.5 12 .5Z"
          />
        </svg>
      ),
    },
    {
      label: 'WhatsApp',
      value: PROFILE.phoneSa,
      href: PROFILE.whatsapp,
      tone: '#25D366',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12.04 2A9.9 9.9 0 0 0 2.1 11.9c0 1.75.46 3.45 1.34 4.95L2 22l5.3-1.38a9.9 9.9 0 0 0 4.74 1.2h.01A9.9 9.9 0 0 0 22 11.92 9.86 9.86 0 0 0 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.94 1.35-.5.05-.98.23-3.3-.69-2.77-1.09-4.53-3.9-4.67-4.08-.13-.18-1.1-1.47-1.1-2.8 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34h.52c.16 0 .39-.06.61.47l.83 2.02c.07.14.11.3.02.48-.35.7-.72.67-.53.99.7 1.2 1.4 1.62 2.46 2.15.18.09.29.08.4-.05l.57-.66c.15-.18.29-.13.48-.06l1.9.9c.19.09.31.13.36.2.04.09.04.5-.2 1.19Z"
          />
        </svg>
      ),
    },
    {
      label: 'CodePen',
      value: 'ahmed5510-mac',
      href: PROFILE.codepen,
      tone: '#8A94A6',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            d="M12 2.5 22 9v6l-10 6.5L2 15V9l10-6.5Zm0 0V9m0 6v6.5M2 9l10 6 10-6M2 15l10-6 10 6"
          />
        </svg>
      ),
    },
  ];

  return (
    <Section id="contact" phase={9} className="section--scene section--contact">
      <div className="col col--center contact">
        <div className="contact__card">
          {portrait && (
            <img
              className="contact__portrait"
              /* the key forces a fresh <img> on a theme switch, so the
                 error fallback below is re-evaluated for the new file */
              key={portrait}
              src={portrait}
              alt={t(PROFILE.fullName, lang)}
              width="112"
              height="112"
              loading="lazy"
              /* Fall back to the other portrait if this theme's file is
                 missing, and only then give up — a broken-image icon in
                 the middle of the card is worse than no photo. */
              onError={(e) => {
                const img = e.currentTarget;
                if (fallback && img.src !== new URL(fallback, location.href).href) {
                  img.src = fallback;
                  return;
                }
                img.style.display = 'none';
              }}
            />
          )}
          <span className="contact__status">
            <i /> {t(UI.contactCta, lang)}
          </span>
          <Reveal as="h2" className="h2 h2--center" text={t(UI.contactSub, lang)} />
          <p className="contact__where">{t(UI.basedIn, lang)}</p>

          <div className="mailrow">
            <a className="mailrow__mail" href={`mailto:${PROFILE.email}`} data-cursor>
              {PROFILE.email}
            </a>
            <button className="mailrow__copy" onClick={copy}>
              {copied ? t(UI.copied, lang) : t(UI.copyEmail, lang)}
            </button>
          </div>

          <div className="contact__actions">
            <ActionButton primary icon="mail" href={`mailto:${PROFILE.email}`}>
              {t(UI.emailMe, lang)}
            </ActionButton>
            <ActionButton icon="download" href={PROFILE.cv} download>
              {t(UI.downloadCv, lang)}
            </ActionButton>
          </div>

          <ul className="social">
            {links.map((l) => (
              <li key={l.label} style={{ '--tone': l.tone }}>
                <a href={l.href} target="_blank" rel="noreferrer" data-cursor>
                  <span className="social__icon">{l.icon}</span>
                  <span className="social__txt">
                    <b>{l.label}</b>
                    <em>{l.value}</em>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <footer className="footer">
          <span>
            © {new Date().getFullYear()} {t(PROFILE.fullName, lang)}
          </span>
          <span>{t(UI.rights, lang)}</span>
        </footer>
      </div>
    </Section>
  );
}

