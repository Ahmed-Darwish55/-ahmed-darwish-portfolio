import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useStore, setState } from '../store';

/** Full-screen photo viewer for the conference galleries and certificates. */
export default function Lightbox() {
  const box = useStore((s) => s.lightbox);
  const root = useRef();
  const figure = useRef();

  const close = () => setState({ lightbox: null });
  const step = (dir) =>
    box &&
    setState({
      lightbox: { ...box, index: (box.index + dir + box.images.length) % box.images.length },
    });

  useEffect(() => {
    if (!box) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box]);

  useEffect(() => {
    if (!box || !root.current) return;
    gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    gsap.fromTo(
      figure.current,
      { scale: 0.92, y: 24, opacity: 0 },
      { scale: 1, y: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.4)' }
    );
  }, [box?.images, box?.index, box]);

  if (!box) return null;
  const src = box.images[box.index];

  return (
    <div className="lb" ref={root} onClick={close} role="dialog" aria-modal="true">
      <button className="lb__close" onClick={close} aria-label="Close">
        <svg viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {box.images.length > 1 && (
        <>
          <button
            className="lb__nav lb__nav--prev"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Previous"
          >
            <svg viewBox="0 0 24 24">
              <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            className="lb__nav lb__nav--next"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Next"
          >
            <svg viewBox="0 0 24 24">
              <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}

      <figure className="lb__fig" ref={figure} onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={box.caption ?? ''} />
        {(box.caption || box.images.length > 1) && (
          <figcaption>
            <span>{box.caption}</span>
            {box.images.length > 1 && (
              <em>
                {box.index + 1} / {box.images.length}
              </em>
            )}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
