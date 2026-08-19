import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useStore, setState, getState, t, useUI, useProfile } from '../store';

export default function Loader() {
  const lang = useStore((s) => s.lang);
  const ready = useStore((s) => s.ready);
  const UI = useUI();
  const PROFILE = useProfile();
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const root = useRef();
  const barRef = useRef();

  useEffect(() => {
    const obj = { v: 0 };
    const tween = gsap.to(obj, {
      v: 100,
      duration: 2.6,
      ease: 'power2.inOut',
      onUpdate: () => setPct(Math.round(obj.v)),
      onComplete: () => setDone(true),
    });
    return () => tween.kill();
  }, []);

  const enter = () => {
    if (getState().entered) return;
    setState({ entered: true });
    gsap.to(root.current, {
      opacity: 0,
      duration: 1,
      ease: 'power2.inOut',
      onComplete: () => root.current && (root.current.style.display = 'none'),
    });
    document.body.classList.remove('is-locked');
  };

  useEffect(() => {
    document.body.classList.add('is-locked');
  }, []);

  useEffect(() => {
    if (done && ready) {
      const id = setTimeout(enter, 450);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, ready]);

  /* Failsafe: never trap the visitor behind the loader if WebGL is slow
     to start (or unavailable). The site still works without the scene. */
  useEffect(() => {
    const id = setTimeout(() => {
      if (!getState().entered) enter();
    }, 7000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="loader" ref={root}>
      <div className="loader__inner">
        <div className="loader__name">{t(PROFILE.name, lang)}</div>
        <div className="loader__label">{t(UI.loading, lang)}</div>
        <div className="loader__bar">
          <span ref={barRef} style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <div className="loader__pct">{String(pct).padStart(3, '0')}</div>
      </div>
    </div>
  );
}
