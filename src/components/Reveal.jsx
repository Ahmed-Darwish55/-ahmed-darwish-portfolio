import { Fragment, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

/** Word-by-word masked reveal, wired to ScrollTrigger. */
export default function Reveal({ text, as: Tag = 'p', className = '', delay = 0, stagger = 0.035 }) {
  const ref = useRef();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = el.querySelectorAll('.rv-w > i');
    const tween = gsap.fromTo(
      words,
      { yPercent: 115, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 1.05,
        ease: 'power3.out',
        stagger,
        delay,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [text, delay, stagger]);

  return (
    <Tag ref={ref} className={className}>
      {String(text)
        .split(' ')
        .map((w, i) => (
          <Fragment key={`${w}-${i}`}>
            <span className="rv-w">
              <i>{w}</i>
            </span>{' '}
          </Fragment>
        ))}
    </Tag>
  );
}
