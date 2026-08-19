import { useLayoutEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { useStore } from '../store';

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ *
 * A survey route drawn down the page: one wandering line that crosses
 * the full width, planting a map pin at every section — the scroll
 * read as a journey across a map rather than a progress bar.
 *
 * The path is measured from the real sections, so it stays correct
 * when copy reflows, the language flips to RTL, or the window resizes.
 * ------------------------------------------------------------------ */

/* Where each successive stop sits across the width. Hand-picked rather
   than alternating, so the road wanders like a real one instead of
   zig-zagging on a metronome. */
const LANES = [0.5, 0.16, 0.82, 0.3, 0.7, 0.12, 0.6, 0.86, 0.24, 0.74, 0.4];

/* The same three stops as the SVG gradient, so a card lights up in the
   colour the road happens to be where it passes. */
const STOPS = [
  [0.0, [232, 177, 76]],
  [0.55, [34, 179, 214]],
  [1.0, [23, 211, 163]],
];

function roadColour(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, c1] = STOPS[i - 1];
    const [p2, c2] = STOPS[i];
    if (x > p2) continue;
    const k = (x - p1) / (p2 - p1);
    const mix = c1.map((c, j) => Math.round(c + (c2[j] - c) * k));
    return `rgb(${mix.join(',')})`;
  }
  return `rgb(${STOPS[STOPS.length - 1][1].join(',')})`;
}

export default function Route() {
  const wrap = useRef();
  const pathRef = useRef();
  const headRef = useRef();
  const onScrollRef = useRef(() => {});
  const refreshRef = useRef(() => {});
  const [geom, setGeom] = useState(null);
  // the globe swaps sides in Arabic, so the road has to be re-measured
  const lang = useStore((s) => s.lang);

  /* Measure every section and build a path that weaves between them. */
  const measure = useCallback(() => {
    const sections = [...document.querySelectorAll('.section[id]')];
    if (sections.length < 2) return;

    const docTop = window.scrollY;
    const width = document.documentElement.clientWidth;

    /* The road leaves from the foot of the globe, not its centre, so it
       reads as setting off from the planet rather than out of its middle. */
    const hero = document.getElementById('hero');
    const heroBox = hero?.getBoundingClientRect();
    const start = heroBox ? heroBox.top + docTop + heroBox.height * 0.82 : 0;

    const stops = sections
      .map((el, i) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.id,
          // plant the pin inside the section rather than on its seam
          y: r.top + docTop + Math.min(r.height * 0.42, 320),
          x: LANES[i % LANES.length] * width,
        };
      })
      // a stop above the start would make the road double back on itself
      .filter((s) => s.y > start + 40);

    if (!stops.length) return;

    /* Run the road to the true bottom of the page, not just past the last
       pin — otherwise it stops short and the final section has no road. */
    const pageEnd = document.documentElement.scrollHeight;
    const height = Math.max(stops[stops.length - 1].y + 220, pageEnd);

    /* A smooth road: each leg leaves a stop heading straight down, then
       curves into the next one, so the joins never kink. */
    // the globe sits to one side on the hero, and swaps sides in Arabic
    const rtl = document.documentElement.dir === 'rtl';
    const startX = width * (rtl ? 0.38 : 0.62);
    let d = `M ${startX} ${start}`;
    for (let i = 0; i < stops.length; i++) {
      const b = stops[i];
      if (i === 0) {
        const gap = b.y - start;
        d += ` C ${startX} ${start + gap * 0.42}, ${b.x} ${b.y - gap * 0.42}, ${b.x} ${b.y}`;
        continue;
      }
      const a = stops[i - 1];
      const gap = b.y - a.y;
      d += ` C ${a.x} ${a.y + gap * 0.42}, ${b.x} ${b.y - gap * 0.42}, ${b.x} ${b.y}`;
    }
    // the tail keeps wandering rather than dropping straight down
    const last = stops[stops.length - 1];
    const tailX = last.x > width * 0.5 ? width * 0.3 : width * 0.7;
    const tailGap = height - last.y;
    d += ` C ${last.x} ${last.y + tailGap * 0.45}, ${tailX} ${height - tailGap * 0.35}, ${tailX} ${height}`;

    setGeom({ d, stops, height, width, start });
  }, [lang]);

  useLayoutEffect(() => {
    measure();

    // sections settle after fonts and images land, so re-measure then
    const ro = new ResizeObserver(() => measure());
    ro.observe(document.body);
    const onLoad = () => measure();
    window.addEventListener('load', onLoad);
    // the path is laid out in real pixels, so width changes matter too
    window.addEventListener('resize', onLoad);

    return () => {
      ro.disconnect();
      window.removeEventListener('load', onLoad);
      window.removeEventListener('resize', onLoad);
    };
  }, [measure]);

  /* Draw the line, run a bright head along it, ripple each pin on arrival. */
  useLayoutEffect(() => {
    if (!geom || !pathRef.current) return;

    const path = pathRef.current;
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);

    const ctx = gsap.context(() => {
      /* Map the drawn length to where the reader actually is, not to raw
         scroll progress: the path is as tall as the document, so scrubbing
         0→1 across the whole scroll left the tip far above the viewport.
         Drawing to a line just below the middle of the screen keeps the
         head next to whatever is being read. */
      const wrapTop = () => wrap.current.getBoundingClientRect().top + window.scrollY;

      const sample = () => {
        // walk the path to find the length at a given y — the path bends, so
        // length and height are not proportional
        const targetY = window.scrollY + window.innerHeight * 0.62 - wrapTop();
        let lo = 0;
        let hi = len;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          if (path.getPointAtLength(mid).y < targetY) lo = mid;
          else hi = mid;
        }
        return lo;
      };

      /* Every card the road can light up, with its page position cached
         so the per-frame pass is a number comparison, not a layout read. */
      const CARD_SEL = '.route__item, .card, .proof__item, .stack__layer, .case, .panel, .contact__card';
      let cards = [];
      const indexCards = () => {
        const top = wrapTop();
        cards = [...document.querySelectorAll(CARD_SEL)].map((el) => {
          const r = el.getBoundingClientRect();
          return { el, top: r.top + window.scrollY - top, bottom: r.bottom + window.scrollY - top, lit: false };
        });
      };
      indexCards();

      /* Pins stay at zero size until the tip of the road actually reaches
         them — a scroll trigger fired too early and showed the pin before
         the line got there. */
      const pins = geom.stops
        .map((stop) => {
          const el = wrap.current?.querySelector(`[data-stop="${stop.id}"]`);
          if (!el) return null;
          return { el, y: stop.y, rings: el.querySelectorAll('.route-map__ring'), planted: false };
        })
        .filter(Boolean);

      const plant = (pin) => {
        pin.planted = true;
        gsap.fromTo(
          pin.el,
          { opacity: 0, scale: 0, y: -18 },
          { opacity: 1, scale: 1, y: 0, duration: 0.62, ease: 'back.out(3)' }
        );
        gsap.fromTo(
          pin.rings,
          { scale: 0.15, opacity: 0.9 },
          { scale: 3.6, opacity: 0, duration: 1.9, ease: 'power2.out', stagger: 0.32, repeat: -1, repeatDelay: 0.5 }
        );
      };

      const pull = (pin) => {
        pin.planted = false;
        gsap.killTweensOf(pin.rings);
        gsap.set(pin.rings, { opacity: 0 });
        gsap.to(pin.el, { opacity: 0, scale: 0, y: -14, duration: 0.28, ease: 'power2.in' });
      };

      let v = sample();
      const apply = () => {
        path.style.strokeDashoffset = String(len - v);
        const p = path.getPointAtLength(v);
        if (headRef.current) {
          headRef.current.setAttribute('cx', p.x);
          headRef.current.setAttribute('cy', p.y);
          headRef.current.style.opacity = v > 4 && v < len - 4 ? '1' : '0';
        }
        /* A card is lit only while the tip is level with it, so the outline
           sweeps down the page with the road and clears behind it — and
           does exactly the same in reverse when scrolling back up. */
        for (const c of cards) {
          const lit = p.y >= c.top - 40 && p.y <= c.bottom + 40;
          if (lit === c.lit) continue;
          c.lit = lit;
          if (lit) c.el.style.setProperty('--road', roadColour(v / len));
          c.el.classList.toggle('is-onroute', lit);
        }

        // the pin is planted the moment the road's tip passes its spot
        for (const pin of pins) {
          const reached = p.y >= pin.y;
          if (reached === pin.planted) continue;
          reached ? plant(pin) : pull(pin);
        }
      };

      /* Driven from GSAP's ticker rather than a scroll listener: Lenis
         animates scroll on that same ticker, so this stays in lock-step
         with it instead of chasing native scroll events. The easing
         below is a short catch-up, not a delay. */
      const tick = () => {
        const target = sample();
        if (Math.abs(target - v) < 0.4) return;
        v += (target - v) * 0.22;
        apply();
      };

      apply();
      gsap.ticker.add(tick);
      onScrollRef.current = tick;

      // card positions shift when the sheet reflows
      ScrollTrigger.addEventListener('refresh', indexCards);
      refreshRef.current = indexCards;
    }, wrap);

    return () => {
      gsap.ticker.remove(onScrollRef.current);
      ScrollTrigger.removeEventListener('refresh', refreshRef.current);
      document
        .querySelectorAll('.is-onroute')
        .forEach((el) => el.classList.remove('is-onroute'));
      ctx.revert();
    };
  }, [geom]);

  if (!geom) return <div className="route-map" ref={wrap} aria-hidden />;

  return (
    <div className="route-map" ref={wrap} aria-hidden>
      {/* No preserveAspectRatio="none": stretching the viewBox scales the
          dash pattern but not the head's coordinates, which made the gap
          between the drawn line and the head grow as you scrolled. The
          viewBox is the real pixel box, so one unit is one pixel. */}
      <svg
        className="route-map__svg"
        viewBox={`0 0 ${geom.width} ${geom.height}`}
        width={geom.width}
        height={geom.height}
      >
        <defs>
          <linearGradient id="routeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8B14C" />
            <stop offset="55%" stopColor="#22B3D6" />
            <stop offset="100%" stopColor="#17D3A3" />
          </linearGradient>
          {/* The colour rides on top of the dotted ghost, lighting the very
              same dots. The mask therefore repeats the ghost's own dash
              pattern exactly — the drawn line cannot carry it itself,
              since its strokeDasharray is spent on the scroll reveal. */}
          <mask id="routeDashes" maskUnits="userSpaceOnUse">
            <path d={geom.d} fill="none" stroke="#fff" strokeWidth="8" strokeDasharray="2 9" strokeLinecap="round" />
          </mask>
        </defs>

        {/* the road ahead, dashed and faint */}
        <path className="route-map__ghost" d={geom.d} />
        {/* the road travelled, drawn by scroll */}
        <path
          className="route-map__line"
          ref={pathRef}
          d={geom.d}
          stroke="url(#routeGrad)"
          mask="url(#routeDashes)"
        />
        {/* the surveyor's head, riding the tip */}
        <circle className="route-map__head" ref={headRef} r="5" cx="0" cy="0" />
      </svg>

      {geom.stops.map((s) => (
        <span
          key={s.id}
          className="route-map__pin"
          data-stop={s.id}
          style={{ top: s.y, left: s.x }}
        >
          <span className="route-map__ring" />
          <span className="route-map__ring" />
          <span className="route-map__ring" />
          {/* a real map pin, not a dot */}
          <svg className="route-map__glyph" viewBox="0 0 24 32" aria-hidden>
            <path
              d="M12 1.6c-5.1 0-9.2 4.1-9.2 9.2 0 6.7 8.2 19 9.2 19s9.2-12.3 9.2-19c0-5.1-4.1-9.2-9.2-9.2z"
              className="route-map__glyphBody"
            />
            <circle cx="12" cy="10.6" r="3.4" className="route-map__glyphEye" />
          </svg>
        </span>
      ))}
    </div>
  );
}
