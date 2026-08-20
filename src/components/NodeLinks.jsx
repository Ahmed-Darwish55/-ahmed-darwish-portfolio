import { useLayoutEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { useStore } from '../store';

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ *
 * NodeLinks — the wiring behind a diagram section.
 *
 * Given a container and a selector for the cards inside it, this draws
 * orthogonal traces between them the way a circuit diagram or a transit
 * map does: out of the source, along a channel, into the target. The
 * traces draw themselves when the section is scrolled to, and a pulse
 * then runs along each one.
 *
 * It measures the real cards rather than taking coordinates, so the
 * wiring survives reflow, RTL and a change of language.
 * ------------------------------------------------------------------ */

/* An orthogonal path from a to b: leave horizontally, turn once in the
   channel between the two, arrive horizontally. Corners are rounded so
   the trace reads as a drawn line rather than a staircase. */
function trace(a, b, r = 12) {
  const midX = (a.x + b.x) / 2;
  const dy = Math.sign(b.y - a.y);
  const dx = Math.sign(b.x - a.x);

  // a straight shot needs no corners at all
  if (Math.abs(b.y - a.y) < 2) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;

  const rr = Math.min(r, Math.abs(b.y - a.y) / 2, Math.abs(midX - a.x) || r);
  return [
    `M ${a.x} ${a.y}`,
    `L ${midX - rr * dx} ${a.y}`,
    `Q ${midX} ${a.y} ${midX} ${a.y + rr * dy}`,
    `L ${midX} ${b.y - rr * dy}`,
    `Q ${midX} ${b.y} ${midX + rr * dx} ${b.y}`,
    `L ${b.x} ${b.y}`,
  ].join(' ');
}

export default function NodeLinks({ containerRef, links, tone = 'var(--cyan)' }) {
  const svgRef = useRef();
  const [geom, setGeom] = useState(null);
  const lang = useStore((s) => s.lang);
  const theme = useStore((s) => s.theme);

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    if (!box.width) return;

    /* Anchor points are taken from the cards' own edges, so a link always
       leaves and lands on a real border rather than a guessed offset. */
    const port = (sel, side) => {
      const el = root.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const y = r.top - box.top + r.height / 2;
      if (side === 'left') return { x: r.left - box.left, y };
      if (side === 'right') return { x: r.right - box.left, y };
      if (side === 'top') return { x: r.left - box.left + r.width / 2, y: r.top - box.top };
      return { x: r.left - box.left + r.width / 2, y: r.bottom - box.top };
    };

    const paths = links
      .map((l) => {
        const a = port(l.from, l.fromSide ?? 'right');
        const b = port(l.to, l.toSide ?? 'left');
        if (!a || !b) return null;
        return { d: trace(a, b), tone: l.tone ?? tone, a, b };
      })
      .filter(Boolean);

    if (paths.length) setGeom({ w: box.width, h: box.height, paths });
  }, [containerRef, links, tone]);

  useLayoutEffect(() => {
    measure();
    const root = containerRef.current;
    if (!root) return;

    // cards settle after fonts land and when the layout reflows
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    const onLoad = () => measure();
    window.addEventListener('load', onLoad);
    window.addEventListener('resize', onLoad);
    return () => {
      ro.disconnect();
      window.removeEventListener('load', onLoad);
      window.removeEventListener('resize', onLoad);
    };
  }, [measure, lang, theme, containerRef]);

  /* Draw the traces on arrival, then run a pulse down each one. */
  useLayoutEffect(() => {
    if (!geom || !svgRef.current) return;
    const svg = svgRef.current;

    const ctx = gsap.context(() => {
      const wires = [...svg.querySelectorAll('.nodelink__wire')];
      const dots = [...svg.querySelectorAll('.nodelink__pulse')];

      wires.forEach((w, i) => {
        const len = w.getTotalLength();
        gsap.set(w, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(w, {
          strokeDashoffset: 0,
          duration: 0.9,
          ease: 'power2.inOut',
          delay: i * 0.07,
          scrollTrigger: { trigger: svg, start: 'top 84%', once: true },
        });
      });

      /* The pulse only starts once its own wire is drawn, so a dot never
         travels along a line that is not there yet. */
      dots.forEach((dot, i) => {
        const wire = wires[i];
        if (!wire) return;
        gsap.set(dot, { opacity: 0 });
        const len = wire.getTotalLength();
        const state = { t: 0 };
        gsap.to(state, {
          t: 1,
          duration: 2.4,
          ease: 'none',
          repeat: -1,
          delay: 0.9 + i * 0.07,
          repeatDelay: 0.6,
          scrollTrigger: { trigger: svg, start: 'top 84%', once: true },
          onStart: () => gsap.set(dot, { opacity: 1 }),
          onUpdate: () => {
            const p = wire.getPointAtLength(state.t * len);
            dot.setAttribute('cx', p.x);
            dot.setAttribute('cy', p.y);
          },
        });
      });
    }, svg);

    return () => ctx.revert();
  }, [geom]);

  if (!geom) return <svg className="nodelink" ref={svgRef} aria-hidden />;

  return (
    <svg
      className="nodelink"
      ref={svgRef}
      viewBox={`0 0 ${geom.w} ${geom.h}`}
      width={geom.w}
      height={geom.h}
      aria-hidden
    >
      {geom.paths.map((p, i) => (
        <g key={i} style={{ '--wire': p.tone }}>
          <path className="nodelink__wire" d={p.d} />
          <circle className="nodelink__pulse" r="3" cx="0" cy="0" />
          {/* the port each trace leaves from and lands on */}
          <circle className="nodelink__port" r="2.6" cx={p.a.x} cy={p.a.y} />
          <circle className="nodelink__port" r="2.6" cx={p.b.x} cy={p.b.y} />
        </g>
      ))}
    </svg>
  );
}
