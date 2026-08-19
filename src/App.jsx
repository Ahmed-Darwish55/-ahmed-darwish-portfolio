import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Scene from './three/Scene';
import Nav from './components/Nav';
import Loader from './components/Loader';
import Cursor from './components/Cursor';
import Lightbox from './components/Lightbox';
import DataError from './components/DataError';
import Ask from './components/Ask';
import { Hero, Journey, Origin, Station, Contact } from './components/Sections';
import { Award, Cases, Twin, Stack, Proof } from './components/Atlas';
import { raw, setState } from './store';
import { validate, merge, DEFAULT_CONTENT, DEFAULT_SITE } from './site';

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const lenis = useRef(null);

  /* Smooth scroll, wired into GSAP's ticker so ScrollTrigger stays in sync. */
  useEffect(() => {
    const l = new Lenis({ lerp: 0.085, wheelMultiplier: 1, touchMultiplier: 1.6 });
    lenis.current = l;
    raw.lenis = l;
    l.on('scroll', (e) => {
      ScrollTrigger.update();
      raw.velocity = e.velocity ?? 0;
      raw.scroll = e.progress ?? 0;
    });
    const raf = (time) => l.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      raw.lenis = null;
      l.destroy();
    };
  }, []);

  /* Live data: public/data/*.json wins over the bundled copy, so the deployed
     site can be edited without a rebuild. Each file is validated and merged
     over the bundled copy, so a broken or partial edit degrades to the last
     good content instead of blanking the page — and says so on screen. */
  useEffect(() => {
    /* The single-file build bakes the JSON into the page, because file:// has
       no origin to fetch from. When it is present, use it and skip the fetch. */
    const baked = typeof window !== 'undefined' && window.__SITE_DATA__;
    if (baked && baked.content && baked.site) {
      setState({
        content: merge(DEFAULT_CONTENT, baked.content),
        site: merge(DEFAULT_SITE, baked.site),
        dataErrors: [],
      });
      return;
    }

    const base = import.meta.env.BASE_URL ?? './';
    const load = (kind) =>
      fetch(`${base}data/${kind}.json`, { cache: 'no-cache' })
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          try {
            return { kind, data: await r.json() };
          } catch {
            throw new Error('invalid JSON — check for a trailing comma');
          }
        })
        .catch((e) => ({ kind, error: e.message }));

    let alive = true;
    Promise.all([load('content'), load('site')]).then((results) => {
      if (!alive) return;
      const patch = {};
      const errors = [];
      const offline = results.every((r) => r.error);

      for (const { kind, data, error } of results) {
        if (error) {
          /* file:// or offline — the bundled copy is already in place, and a
             warning about it would be noise. Only report real content bugs. */
          if (!offline) errors.push(`${kind}.json — ${error}`);
          continue;
        }
        const problems = validate(kind, data);
        if (problems.length) errors.push(...problems);
        else patch[kind] = merge(kind === 'content' ? DEFAULT_CONTENT : DEFAULT_SITE, data);
      }
      setState({ ...patch, dataErrors: errors });
    });

    return () => {
      alive = false;
    };
  }, []);

  /* Pointer parallax. */
  useEffect(() => {
    const onMove = (e) => {
      raw.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      raw.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <>
      <Cursor />
      <Lightbox />
      <DataError />
      <Loader />
      <Scene />
      <div className="vignette" />
      <div className="grain" />
      <Nav lenis={lenis} />
      <Ask />
      <main className="main">
        <Hero />
        <Journey />
        <Origin />
        <Station />
        {/* One continuous survey sheet: the 3D field is absent behind it,
            so dense reading happens on solid ground instead of a scrim. */}
        <div className="sheet">
          <Award />
          <Cases />
          <Twin />
          <Stack />
          <Proof />
        </div>
        <Contact />
      </main>
    </>
  );
}
