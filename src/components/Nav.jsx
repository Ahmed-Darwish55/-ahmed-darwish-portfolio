import { useEffect, useState } from 'react';
import { useStore, setState, setTheme, t, useUI, useProfile } from '../store';

/* Sun and moon, drawn rather than imported, so the button carries no
   font or icon dependency. Each shows the theme you would switch *to*. */
const ThemeIcon = ({ light }) =>
  light ? (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
      {/* moon: switching to dark */}
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
      {/* sun: switching to light */}
      <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M12 2.4v2.3M12 19.3v2.3M2.4 12h2.3M19.3 12h2.3" />
        <path d="M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
      </g>
    </svg>
  );

export default function Nav({ lenis }) {
  const lang = useStore((s) => s.lang);
  const theme = useStore((s) => s.theme);
  const phase = useStore((s) => s.phase);
  const entered = useStore((s) => s.entered);
  const NAV = useStore((s) => s.content.nav) ?? [];
  const PROFILE = useProfile();
  const UI = useUI();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body.dataset.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  /* Follow the OS if the visitor has never chosen for themselves — once
     they press the button their choice is stored and this stops. */
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: light)');
    const onChange = (e) => {
      try {
        if (localStorage.getItem('ad-theme')) return;
      } catch {
        /* no storage: following the system is the sensible default */
      }
      setState({ theme: e.matches ? 'light' : 'dark' });
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const go = (id) => {
    setOpen(false);
    const el = document.getElementById(id);
    if (!el) return;
    if (lenis?.current) lenis.current.scrollTo(el, { offset: -10 });
    else el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* The section index is a sibling of the bar, not a child: the bar is
          masked, and a mask clips fixed descendants. */}
      <nav className={`nav__links ${open ? 'is-open' : ''}`}>
        {NAV.map((item, i) => (
          <button
            key={item.id}
            className={`nav__link ${phase === i ? 'is-active' : ''}`}
            onClick={() => go(item.id)}
          >
            <span className="nav__num">{String(i + 1).padStart(2, '0')}</span>
            <span className="nav__label">{t(item, lang)}</span>
          </button>
        ))}
      </nav>

      <header className={`nav ${entered ? 'is-in' : ''} ${open ? 'is-open' : ''}`}>
      <button className="nav__brand" onClick={() => go('hero')}>
        <span className="nav__mark">AD</span>
        <span className="nav__brandtxt">{t(PROFILE.name, lang)}</span>
      </button>

      <div className="nav__side">
        <button
          className="theme-btn"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
        >
          <ThemeIcon light={theme === 'light'} />
        </button>
        <button
          className="lang-btn"
          onClick={() => setState({ lang: lang === 'en' ? 'ar' : 'en' })}
          aria-label="Switch language"
        >
          {t(UI.langBtn, lang)}
        </button>
        <button className="nav__burger" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          <span />
          <span />
        </button>
      </div>
      </header>
    </>
  );
}
