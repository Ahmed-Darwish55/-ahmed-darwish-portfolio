import { useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, AdaptiveDpr, Preload } from '@react-three/drei';
import gsap from 'gsap';
import MorphField from './MorphField';
import JourneyLayer from './JourneyLayer';
import { useStore, raw, setState } from '../store';

/* Where the 3D object sits (and how close the camera is) per phase. */
const DESKTOP_CAM = [
  { gx: 1.85, gy: 0.0, cz: 8.0 },   // 0 hero — globe on the right
  { gx: 1.6, gy: 0.05, cz: 7.0 },   // 1 route — closer, arc drawing
  { gx: 0.55, gy: -0.25, cz: 7.6 }, // 2 origin — Giza pyramids
  { gx: -0.5, gy: -0.15, cz: 7.8 }, // 3 Dammam landmarks
  { gx: 0.0, gy: 0.55, cz: 7.2 },   // 4 award — the medal, centred and close
  { gx: 0.1, gy: 0.35, cz: 6.4 },   // 5 case studies — GIS terrain behind the cases
  { gx: -1.5, gy: 0.1, cz: 7.0 },   // 6 digital twin — lattice off to one side
  { gx: -1.7, gy: 0.0, cz: 7.4 },   // 7 the stack — technology graph
  { gx: 0.0, gy: 0.5, cz: 7.4 },    // 8 recognition — the diploma
  { gx: 0.0, gy: 0.05, cz: 6.0 },   // 9 contact — the name
];

function Rig({ mobile, count }) {
  const phase = useStore((s) => s.phase);
  const hover = useStore((s) => s.hover);
  const focus = useStore((s) => s.focus);
  const lang = useStore((s) => s.lang);
  // in RTL the copy sits on the right, so the 3D object mirrors to the left
  const side = lang === 'ar' ? -1 : 1;
  const { camera } = useThree();
  const group = useRef();
  const proxy = useMemo(
    () => ({ gx: mobile ? 0 : DESKTOP_CAM[0].gx, gy: 0, cz: mobile ? DESKTOP_CAM[0].cz * 1.55 : DESKTOP_CAM[0].cz }),
    [mobile]
  );

  useEffect(() => {
    const cfg = DESKTOP_CAM[phase] ?? DESKTOP_CAM[0];
    /* hovering a route card leans in; clicking one dives at the country */
    const lean = phase === 1 && hover && !focus ? 0.86 : 1;
    const dive = phase === 1 && focus ? 0.66 : 1;
    gsap.to(proxy, {
      gx: mobile ? 0 : cfg.gx * side * (focus ? 0.45 : 1),
      gy: mobile ? cfg.gy * 0.4 : cfg.gy,
      cz: (mobile ? cfg.cz * 1.55 : cfg.cz) * lean * dive,
      duration: focus ? 1.35 : 1.9,
      ease: focus ? 'power2.inOut' : 'power3.inOut',
      overwrite: true,
    });
  }, [phase, proxy, mobile, side, hover, focus]);

  useFrame(() => {
    if (group.current) {
      group.current.position.x += (proxy.gx - group.current.position.x) * 0.12;
      group.current.position.y += (proxy.gy - group.current.position.y) * 0.12;
    }
    const px = raw.pointer.x * (mobile ? 0.05 : 0.28);
    const py = raw.pointer.y * (mobile ? 0.05 : 0.2);
    camera.position.x += (px - camera.position.x) * 0.045;
    camera.position.y += (-py - camera.position.y) * 0.045;
    camera.position.z += (proxy.cz - camera.position.z) * 0.05;
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={group}>
      <MorphField count={count} />
      <JourneyLayer />
    </group>
  );
}

/** ?q=low  → fewer particles (weak GPUs, remote desktops, screenshot runs). */
function quality() {
  if (typeof window === 'undefined') return 'high';
  const q = new URLSearchParams(window.location.search).get('q');
  if (q === 'low' || q === 'high') return q;
  const cores = navigator.hardwareConcurrency ?? 4;
  return cores <= 4 ? 'low' : 'high';
}

export default function Scene() {
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches;
  const q = quality();
  const count = q === 'low' ? (mobile ? 4500 : 7000) : mobile ? 9000 : 18000;
  const stars = q === 'low' ? 350 : mobile ? 500 : 1400;

  return (
    <div className="scene">
      <Canvas
        dpr={q === 'low' ? 1 : [1, 1.8]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, mobile ? 12.4 : 8], fov: 45, near: 0.1, far: 200 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          setState({ ready: true });
        }}
      >
        <Suspense fallback={null}>
          <Stars radius={70} depth={40} count={stars} factor={3.2} saturation={0} fade speed={0.35} />
          <Rig mobile={mobile} count={count} />
          <Preload all />
        </Suspense>
        <AdaptiveDpr pixelated />
      </Canvas>
    </div>
  );
}
