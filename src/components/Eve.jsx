import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { raw } from '../store';

/* ------------------------------------------------------------------ *
 * Eve — the assistant, drawn rather than imported.
 *
 * A small robot that keeps station in the corner while the page moves
 * under it: it drifts on a slow idle bob, leans into the direction of
 * travel as you scroll, and blinks now and then. The lamp on its chest
 * is the button — pressing it opens the projector beam that the answer
 * panel is thrown onto.
 *
 * Everything is inline SVG so it inherits the theme tokens and needs
 * no asset, and every moving part is a transform on its own group so
 * the browser can keep it on the compositor.
 * ------------------------------------------------------------------ */

export default function Eve({ open, onToggle, label }) {
  const root = useRef();
  const body = useRef();
  const head = useRef();
  const eyes = useRef();
  const lamp = useRef();

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      /* The idle: a slow hover, with the head trailing a beat behind the
         body so the whole thing reads as floating rather than sliding. */
      gsap.to(body.current, {
        y: -7,
        duration: 2.4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
      gsap.to(head.current, {
        y: -4,
        duration: 2.4,
        delay: 0.18,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });

      /* The lamp breathes so the button reads as live even at rest. */
      gsap.to(lamp.current, {
        opacity: 0.55,
        duration: 1.5,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });

      /* A blink on an uneven schedule — a metronome blink looks broken. */
      const blink = () => {
        gsap.timeline({ onComplete: () => gsap.delayedCall(2 + Math.random() * 4, blink) })
          .to(eyes.current, { scaleY: 0.08, duration: 0.07, ease: 'power2.in' })
          .to(eyes.current, { scaleY: 1, duration: 0.11, ease: 'power2.out' });
      };
      gsap.delayedCall(1.6, blink);

      /* Lean into the scroll. Driven from the shared ticker rather than a
         scroll listener so it stays in step with the smooth-scroll loop
         that owns the page. */
      const tilt = { v: 0 };
      const tick = () => {
        // raw.velocity is signed page velocity, set by the scroll driver
        const target = Math.max(-1, Math.min(1, (raw.velocity ?? 0) / 26));
        if (Math.abs(target - tilt.v) < 0.002) return;
        tilt.v += (target - tilt.v) * 0.08;
        gsap.set(root.current, { rotation: tilt.v * -9, y: tilt.v * 5 });
      };
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <button
      className={`eve ${open ? 'is-open' : ''}`}
      onClick={onToggle}
      aria-label={label}
      aria-expanded={open}
    >
      {/* the beam the answer panel is projected along */}
      <span className="eve__beam" aria-hidden />

      <span className="eve__rig" ref={root}>
        <svg className="eve__svg" viewBox="0 0 120 150" aria-hidden>
          <defs>
            <linearGradient id="eveShell" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#eef2f9" />
              <stop offset="100%" stopColor="#c9d3e2" />
            </linearGradient>
            <linearGradient id="eveVisor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a2233" />
              <stop offset="100%" stopColor="#0b1220" />
            </linearGradient>
            <radialGradient id="eveLamp">
              <stop offset="0%" stopColor="#9ff5ff" />
              <stop offset="45%" stopColor="var(--teal)" />
              <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* arms: they float free of the body, as the reference does */}
          <g className="eve__arm eve__arm--l">
            <rect x="6" y="74" width="13" height="30" rx="6.5" fill="url(#eveShell)" />
          </g>
          <g className="eve__arm eve__arm--r">
            <rect x="101" y="74" width="13" height="30" rx="6.5" fill="url(#eveShell)" />
          </g>

          {/* body */}
          <g ref={body}>
            <rect x="26" y="62" width="68" height="76" rx="34" fill="url(#eveShell)" />
            {/* the chest lamp — this is what opens the projection */}
            <circle cx="60" cy="99" r="15" fill="#0b1220" opacity="0.85" />
            <circle className="eve__lamp" ref={lamp} cx="60" cy="99" r="13" fill="url(#eveLamp)" />
            <circle cx="60" cy="99" r="5" fill="#dffcff" />
          </g>

          {/* head */}
          <g ref={head}>
            <rect x="22" y="10" width="76" height="52" rx="26" fill="url(#eveShell)" />
            <rect x="27" y="15" width="66" height="40" rx="20" fill="url(#eveVisor)" />
            <g className="eve__eyes" ref={eyes}>
              <ellipse cx="47" cy="35" rx="6.5" ry="8" fill="var(--teal)" />
              <ellipse cx="73" cy="35" rx="6.5" ry="8" fill="var(--teal)" />
            </g>
          </g>
        </svg>
      </span>

      <span className="eve__label">{label}</span>
    </button>
  );
}
