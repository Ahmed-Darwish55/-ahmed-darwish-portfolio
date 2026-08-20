import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

/* ------------------------------------------------------------------ *
 * Scrollbar — a bloom of light bleeding in from the edge.
 *
 * Not a bar on a track: a soft glow that rides the scroll, brightest
 * hard against the side of the screen and dying out inward, feathered
 * top and bottom so it has no ends to notice.
 *
 * The native bar is hidden because it cannot be made to look like this:
 * a background on ::-webkit-scrollbar-thumb can only size to the
 * thumb's own box, and the scrollbar is painted outside the viewport's
 * painting model, so neither a long gradient nor a blur will take.
 *
 * Position is written straight to the transform from the scroll ticker,
 * never through React state — this updates every frame.
 * ------------------------------------------------------------------ */

export default function Scrollbar() {
  const track = useRef();
  const glow = useRef();

  useLayoutEffect(() => {
    const t = track.current;
    const g = glow.current;
    if (!t || !g) return;

    /* Coarse pointers overlay their own transient scrollbar, so a
       permanent glow is noise there. */
    if (window.matchMedia('(pointer: coarse)').matches) {
      t.style.display = 'none';
      return;
    }

    const draw = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;

      // nothing to scroll: nothing to show
      if (max <= 1) {
        t.style.opacity = '0';
        return;
      }
      t.style.opacity = '1';

      const p = Math.min(1, Math.max(0, window.scrollY / max));

      /* Sized in proportion to how much of the page fits on screen, the
         same contract a native thumb honours, with a floor so it never
         shrinks to a dash and a cap so it never fills the rail. */
      const railH = t.clientHeight;
      const ratio = window.innerHeight / doc.scrollHeight;
      const glowH = Math.min(railH * 0.5, Math.max(120, Math.round(railH * ratio * 2.4)));
      g.style.height = `${glowH}px`;

      g.style.transform = `translateY(${Math.round((railH - glowH) * p)}px)`;
    };

    /* Lenis animates scroll on the GSAP ticker, so reading there keeps
       the glow in lock-step with the page rather than chasing it. */
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
    };
  }, []);

  return (
    <div className="dropbar" ref={track} aria-hidden>
      <span className="dropbar__bead" ref={glow} />
    </div>
  );
}
