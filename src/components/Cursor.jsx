import { useEffect, useRef } from 'react';

/** A soft trailing cursor that grows over interactive elements. */
export default function Cursor() {
  const dot = useRef();
  const ring = useRef();

  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return;
    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    const ringPos = { ...pos };
    let scale = 1;
    let targetScale = 1;
    let raf;

    const onMove = (e) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      const hit = e.target.closest('a, button, [data-cursor]');
      targetScale = hit ? 2.1 : 1;
    };

    const loop = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.16;
      ringPos.y += (pos.y - ringPos.y) * 0.16;
      scale += (targetScale - scale) * 0.12;
      if (dot.current) dot.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      if (ring.current)
        ring.current.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) scale(${scale})`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="cursor-dot" ref={dot} />
      <div className="cursor-ring" ref={ring} />
    </>
  );
}
