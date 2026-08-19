import { useEffect, useState } from 'react';
import { useStore, setState, t, useUI, useProfile } from '../store';

export default function Nav({ lenis }) {
  const lang = useStore((s) => s.lang);
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
