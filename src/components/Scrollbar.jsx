import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { raw } from '../store';

/* ------------------------------------------------------------------ *
 * Scrollbar — a droplet running down a hidden track.
 *
 * The native WebKit thumb cannot carry this: a background on
 * ::-webkit-scrollbar-thumb can only size to the thumb's own box, and
 * `background-attachment: fixed` does nothing there because the
 * scrollbar is painted outside the viewport's painting model. A short
 * handle therefore squashes any gradient into a flat colour.
 *
 * So the native bar is hidden and this draws the real one: a bead whose
 * gradient is a full-height ramp it slides along, revealing more colour
 * the further down the page you are.
 *
 * Position is written straight to the transform from the scroll ticker,
 * never through React state — this updates every frame.
 * ------------------------------------------------------------------ */

export default function Scrollbar() {
  const track = useRef();
  const bead = useRef();

  useLayoutEffect(() => {
    const t = track.current;
    const b = bead.current;
    if (!t || !b) return;

    /* Coarse pointers overlay their own transient scrollbar and have no
       hover, so a permanent rail is noise there. */
    if (window.matchMedia('(pointer: coarse)').matches) {
      t.style.display = 'none';
      return;
    }

    let raf = 0;

    const draw = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;

      // nothing to scroll: no bar to show
      if (max <= 1) {
        t.style.opacity = '0';
        return;
      }
      t.style.opacity = '1';

      const y = window.scrollY;
      const p = Math.min(1, Math.max(0, y / max));

      /* The bead is sized in proportion to how much of the page fits on
         screen — the same contract a native thumb honours — with a floor
         so it never shrinks to a dot on a very long page. */
      const railH = t.clientHeight;
      const ratio = window.innerHeight / doc.scrollHeight;
      const beadH = Math.max(46, Math.round(railH * ratio));
      b.style.height = `${beadH}px`;

      /* Slide it down the rail, and slide its background the opposite
         way by the same amount: the gradient stays anchored to the rail
         while the bead moves over it, so the colour deepens as it
         descends instead of travelling with it. */
      const travel = railH - beadH;
      const offset = travel * p;
      b.style.transform = `translateY(${offset}px)`;
      b.style.backgroundPosition = `0 ${-offset}px`;
      b.style.backgroundSize = `100% ${railH}px`;
    };

    /* Lenis animates scroll on the GSAP ticker, so reading there keeps
       the bead in lock-step with the page rather than chasing it. */
    gsap.ticker.add(draw);

    // the rail's own length changes with the window and as content lands
    const ro = new ResizeObserver(() => draw());
    ro.observe(document.body);
    window.addEventListener('resize', draw);
    draw();

    return () => {
      gsap.ticker.remove(draw);
      ro.disconnect();
      window.removeEventListener('resize', draw);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="dropbar" ref={track} aria-hidden>
      <span className="dropbar__bead" ref={bead} />
    </div>
  );
}
