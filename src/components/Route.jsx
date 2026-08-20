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
   colour the road happens to be where it passes. Read from the theme
   tokens rather than hard-coded, so the outline follows light mode. */
const STOP_AT = [0, 0.55, 1];
const STOP_VAR = ['--gold', '--cyan', '--teal'];

function readStops() {
  const cs = getComputedStyle(document.documentElement);
  return STOP_VAR.map((name) => {
    const v = cs.getPropertyValue(name).trim();
    // tokens are hex; fall back to mid-grey if one is ever missing
    const m = /^#([0-9a-f]{6})$/i.exec(v);
    if (!m) return [128, 128, 128];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
}

function roadColour(t, stops) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    const p1 = STOP_AT[i - 1];
    const p2 = STOP_AT[i];
    if (x > p2) continue;
    const k = (x - p1) / (p2 - p1);
    const mix = stops[i - 1].map((c, j) => Math.round(c + (stops[i][j] - c) * k));
    return `rgb(${mix.join(',')})`;
  }
  return `rgb(${stops[stops.length - 1].join(',')})`;
}

export default function Route() {
  const wrap = useRef();
  const pathRef = useRef();
  const headRef = useRef();
  const clipRef = useRef();
  const onScrollRef = useRef(() => {});
  const refreshRef = useRef(() => {});
  const [geom, setGeom] = useState(null);
  // the globe swaps sides in Arabic, so the road has to be re-measured
  const lang = useStore((s) => s.lang);
  // the road's colours are theme tokens, so a switch has to re-read them
  const theme = useStore((s) => s.theme);

  /* Measure every section and build a path that weaves between them. */
  const measure = useCallback(() => {
    const sections = [...document.querySelectorAll('.section[id]')];
    if (sections.length < 2) return;

    const docTop = window.scrollY;
    const width = document.documentElement.clientWidth;

    /* The road sets off from under the globe on the *second* section (the
       route section), leaving the hero clear — starting it on the hero put
       a line across the opening screen before there was any journey. */
    const second = sections[1] ?? sections[0];
    const secondBox = second.getBoundingClientRect();
    const start = secondBox.top + docTop + secondBox.height * 0.82;

    const stops = sections
      .map((el, i) => {
        const r = el.getBoundingClientRect();
        /* A blind fraction of the section height drops the pin straight
           onto a card — on the tall Recognition section it landed on the
           Conferences row and vanished behind it. Aim just above the
           section's first card instead, so the pin always sits in the
           clear band under the heading. */
        const first = el.querySelector(
          '.route__item, .card, .proof__item, .stack__layer, .case, .panel, .contact__card'
        );
        let y = r.top + docTop + Math.min(r.height * 0.42, 320);
        if (first) {
          const f = first.getBoundingClientRect();
          y = Math.min(y, f.top + docTop - 26);
        }
        return { id: el.id, y, x: LANES[i % LANES.length] * width };
      })
      // a stop above the start would make the road double back on itself
      .filter((s) => s.y > start + 40);

    if (!stops.length) return;

    /* The road stops just short of its final pin rather than running on
       to the foot of the page: it arrives at the last place and ends
       there. The gap is what keeps the line from striking through the
       pin — the pin is the destination, not something to drive over. */
    const ARRIVE = 34;
    const last = stops[stops.length - 1];

    /* The SVG box has to stay taller than the road so the pin, which is
       drawn upward from its anchor and rippled around, is not clipped by
       the edge of the wrapper. */
    const height = last.y + 90;

    /* A smooth road: each leg leaves a stop heading straight down, then
       curves into the next one, so the joins never kink. */
    // the globe sits to one side on the hero, and swaps sides in Arabic
    const rtl = document.documentElement.dir === 'rtl';
    const startX = width * (rtl ? 0.38 : 0.62);
    let d = `M ${startX} ${start}`;
    for (let i = 0; i < stops.length; i++) {
      const b = stops[i];
      // pull the very last leg up short so it never crosses the final pin
      const endY = i === stops.length - 1 ? b.y - ARRIVE : b.y;
      if (i === 0) {
        const gap = endY - start;
        d += ` C ${startX} ${start + gap * 0.42}, ${b.x} ${endY - gap * 0.42}, ${b.x} ${endY}`;
        continue;
      }
      const a = stops[i - 1];
      const gap = endY - a.y;
      d += ` C ${a.x} ${a.y + gap * 0.42}, ${b.x} ${endY - gap * 0.42}, ${b.x} ${endY}`;
    }
    setGeom({ d, stops, height, width, start, arrive: ARRIVE });
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
    const stops = readStops();
    /* The reveal rides a clip rectangle rather than the stroke's dash
       offset, which leaves strokeDasharray free to carry the dot pattern.
       Trying to do both on one stroke is what kept the line solid. */
    const clip = clipRef.current;

    const ctx = gsap.context(() => {
      /* Map the drawn length to where the reader actually is, not to raw
         scroll progress: the path is as tall as the document, so scrubbing
         0→1 across the whole scroll left the tip far above the viewport.
         Drawing to a line just below the middle of the screen keeps the
         head next to whatever is being read. */
      const wrapTop = () => wrap.current.getBoundingClientRect().top + window.scrollY;

      const endY = path.getPointAtLength(len).y;

      const sample = () => {
        // walk the path to find the length at a given y — the path bends, so
        // length and height are not proportional
        let targetY = window.scrollY + window.innerHeight * 0.62 - wrapTop();

        /* The reader's line sits 38% of a viewport above the fold, so at
           maximum scroll it still stops short of the page bottom — on a
           short page the last pin fell below it and never planted. As the
           scroll runs out, walk the line down to the foot of the window
           so the road arrives properly instead of popping at the end. */
        const remaining =
          document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
        const closing = Math.min(1, Math.max(0, 1 - remaining / (window.innerHeight * 0.5)));
        targetY += window.innerHeight * 0.38 * closing;

        /* Past the end of the road, return the full length exactly. The
           search below converges from underneath and would otherwise stop
           a little short forever, so the road never quite completed. */
        if (targetY >= endY) return len;
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
        .map((stop, i) => {
          const el = wrap.current?.querySelector(`[data-stop="${stop.id}"]`);
          if (!el) return null;
          /* The road deliberately stops short of the final pin, so the tip
             never reaches that pin's own y. Trigger it off the end of the
             road instead, or the last marker would never plant at all. */
          const trigger = i === geom.stops.length - 1 ? stop.y - geom.arrive : stop.y;
          return { el, y: trigger, rings: el.querySelectorAll('.route-map__ring'), planted: false };
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
        const p = path.getPointAtLength(v);
        // reveal everything above the tip
        if (clip) clip.setAttribute('height', String(Math.max(0, p.y)));
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
          if (lit) c.el.style.setProperty('--road', roadColour(v / len, stops));
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
        const gap = target - v;
        if (Math.abs(gap) < 0.4) {
          /* Snap and run one final apply rather than returning early:
             easing only ever approaches the target, so the last fraction
             of a pixel was never covered — which left the final pin,
             whose trigger sits at the very end of the road, unplanted. */
          if (v !== target) {
            v = target;
            apply();
          }
          return;
        }
        v += gap * 0.22;
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
  }, [geom, theme]);

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
          {/* The road takes its colours from the theme tokens: the bright
              dark-mode stops are close to invisible on paper. */}
          <linearGradient id="routeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" />
            <stop offset="55%" stopColor="var(--cyan)" />
            <stop offset="100%" stopColor="var(--teal)" />
          </linearGradient>
          {/* The reveal: everything above the tip is shown. Keeping it on a
              clip leaves the stroke's own dasharray free for the dots. */}
          <clipPath id="routeReveal">
            <rect ref={clipRef} x="0" y="0" width={geom.width} height="0" />
          </clipPath>
        </defs>

        {/* the road ahead, dashed and faint */}
        <path className="route-map__ghost" d={geom.d} />
        {/* The road travelled: the same dotted pattern as the ghost, in
            colour, clipped to whatever the tip has reached. */}
        <path
          className="route-map__line"
          ref={pathRef}
          d={geom.d}
          stroke="url(#routeGrad)"
          clipPath="url(#routeReveal)"
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
