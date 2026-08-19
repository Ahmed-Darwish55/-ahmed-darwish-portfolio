import { useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { useStore, raw, useStations } from '../store';
import {
  globeShape,
  pyramidsShape,
  skylineShape,
  gridShape,
  networkShape,
  techShape,
  medalShape,
  diplomaShape,
  textShape,
} from './shapes';

/* Phase → shape key. Sections drive `phase` from GSAP ScrollTrigger. */
export const PHASE_SHAPE = [
  'globe',    // 0 hero
  'globe',    // 1 route — Giza -> Dammam arc
  'pyramids', // 2 origin (Giza)
  'skyline',  // 3 Dammam
  'medal',    // 4 Esri award landmark
  'grid',     // 5 case studies — GIS terrain grid
  'network',  // 6 digital twin — immersive lattice
  'tech',     // 7 the stack — technology graph
  'diploma',  // 8 recognition
  'text',     // 9 contact — the name
];

/** Rotation that brings the Egypt→Saudi corridor to face the camera. */
export const ROUTE_ROTATION = { x: 0.42, y: Math.PI / 2 - ((40 + 180) * Math.PI) / 180 };

/** Rotation that centres one city on the globe. */
export function stationRotation(station) {
  return {
    x: (station.lat * Math.PI) / 180 * 0.82,
    y: Math.PI / 2 - ((station.lon + 180) * Math.PI) / 180,
  };
}

const vertexShader = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aEnd;
  attribute vec3 cStart;
  attribute vec3 cEnd;
  attribute vec3 aCtrl;
  attribute float aRnd;

  uniform float uProgress;
  uniform float uTime;
  uniform float uSize;
  uniform float uPix;
  uniform float uTurb;
  uniform float uBurst;

  varying vec3 vColor;
  varying float vGlow;

  void main() {
    float p = clamp(uProgress, 0.0, 1.0);
    // stagger: every particle leaves at its own moment -> the cloud flows
    float delay = aRnd * 0.4;
    float lp = clamp((p - delay) / (1.0 - delay), 0.0, 1.0);
    float e = lp * lp * (3.0 - 2.0 * lp);

    // quadratic bezier through a per-particle control point = swirling flight
    vec3 mid = mix(aStart, aEnd, 0.5) + aCtrl * uTurb;
    vec3 pos = mix(mix(aStart, mid, e), mix(mid, aEnd, e), e);

    float travel = sin(e * 3.14159265);

    // idle breathing so the field is never fully static
    pos += 0.018 * vec3(
      sin(uTime * 0.7 + aRnd * 40.0),
      cos(uTime * 0.63 + aRnd * 31.0),
      sin(uTime * 0.51 + aRnd * 22.0)
    );
    // pointer / scroll-velocity shockwave
    pos += normalize(pos + 0.001) * uBurst * (0.4 + aRnd);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    vColor = mix(cStart, cEnd, e) + travel * 0.45;
    vGlow = travel;
    gl_PointSize = uSize * uPix * (0.55 + aRnd * 0.9) * (1.0 + travel * 1.15) * (300.0 / max(-mv.z, 0.001));
  }
`;

/* uLight = 1 in light mode. The palette is built to glow additively on
   black, which on paper would wash out to nothing — additive blending
   only ever adds light. So on light ground the point is darkened and
   saturated into ink instead: same hue, inverted luminance. The
   blending mode is switched to match, below. */
const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform float uOpacity;
  uniform float uLight;
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.08, d);

    vec3 col = vColor;
    float alpha = a * uOpacity * (0.75 + vGlow * 0.5);

    if (uLight > 0.5) {
      // keep the hue, drop the luminance so it reads as ink on paper
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 hue = col / max(lum, 0.001);
      col = clamp(hue * 0.34, 0.0, 1.0);
      // the glow that additive blending gave for free now costs alpha
      alpha = a * uOpacity * (0.5 + vGlow * 0.35);
    }

    gl_FragColor = vec4(col, alpha);
  }
`;

export default function MorphField({ count }) {
  const phase = useStore((s) => s.phase);
  const hover = useStore((s) => s.hover);
  const focus = useStore((s) => s.focus);
  const lang = useStore((s) => s.lang);
  const entered = useStore((s) => s.entered);
  const STATIONS = useStations();
  const profileName = useStore((s) => s.content.profile.name);
  const points = useRef();
  const group = useRef();
  const matRef = useRef();
  const N = count;

  /* Build every target once. */
  const shapes = useMemo(() => {
    const s = {
      globe: globeShape(N, STATIONS),
      pyramids: pyramidsShape(N),
      skyline: skylineShape(N),
      grid: gridShape(N),
      network: networkShape(N),
      tech: typeof document === 'undefined' ? networkShape(N) : techShape(N),
      medal: typeof document === 'undefined' ? networkShape(N) : medalShape(N),
      diploma: typeof document === 'undefined' ? networkShape(N) : diplomaShape(N),
    };
    return s;
  }, [N, STATIONS]);

  const textTarget = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return lang === 'ar'
      ? textShape(N, profileName?.ar ?? 'أحمد درويش', { font: '700 150px "IBM Plex Sans Arabic", sans-serif', rtl: true })
      : textShape(N, (profileName?.en ?? 'Ahmed Darwish').toUpperCase(), { font: '700 150px "Space Grotesk", sans-serif' });
  }, [N, lang, profileName]);

  const getShape = (key) => (key === 'text' ? textTarget ?? shapes.network : shapes[key]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const start = getShape('globe');
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(start.positions), 3));
    g.setAttribute('aStart', new THREE.BufferAttribute(new Float32Array(start.positions), 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(new Float32Array(start.positions), 3));
    g.setAttribute('cStart', new THREE.BufferAttribute(new Float32Array(start.colors), 3));
    g.setAttribute('cEnd', new THREE.BufferAttribute(new Float32Array(start.colors), 3));
    const ctrl = new Float32Array(N * 3);
    const rnd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      rnd[i] = Math.random();
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(0.4 + Math.random() * 2.4);
      ctrl.set([v.x, v.y, v.z], i * 3);
    }
    g.setAttribute('aCtrl', new THREE.BufferAttribute(ctrl, 3));
    g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N, shapes]);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 1 },
      uTime: { value: 0 },
      // world-space size; multiplied by 300/-z in the shader → ~2-6px on screen
      uSize: { value: 0.085 },
      uPix: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
      uTurb: { value: 1 },
      uBurst: { value: 0 },
      uOpacity: { value: 0 },
      uLight: { value: 0 },
    }),
    []
  );

  /* Follow the theme without rebuilding the material: the uniform is
     read every frame, so writing it is enough. */
  const theme = useStore((s) => s.theme);
  useLayoutEffect(() => {
    uniforms.uLight.value = theme === 'light' ? 1 : 0;
    const mat = matRef.current;
    if (!mat) return;
    /* Additive blending cannot darken, so it can only ever wash out on
       paper. Normal blending lets the darkened points actually land. */
    mat.blending = theme === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending;
    mat.needsUpdate = true;
  }, [theme, uniforms]);

  /* Morph on every phase change. */
  const current = useRef('globe');
  const tween = useRef();

  useLayoutEffect(() => {
    const key = PHASE_SHAPE[phase] ?? 'globe';
    if (key === current.current) return;
    const target = getShape(key);
    if (!target) return;

    const g = geometry;
    const aStart = g.attributes.aStart.array;
    const aEnd = g.attributes.aEnd.array;
    const cStart = g.attributes.cStart.array;
    const cEnd = g.attributes.cEnd.array;
    const ctrl = g.attributes.aCtrl.array;
    const rnd = g.attributes.aRnd.array;
    const p = uniforms.uProgress.value;
    const turb = uniforms.uTurb.value;

    // freeze the field exactly where it is right now (mirrors the vertex shader)
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const delay = rnd[i] * 0.4;
      const lp = Math.min(1, Math.max(0, (p - delay) / (1 - delay)));
      const e = lp * lp * (3 - 2 * lp);
      for (let k = 0; k < 3; k++) {
        const s = aStart[i3 + k];
        const en = aEnd[i3 + k];
        const mid = (s + en) * 0.5 + ctrl[i3 + k] * turb;
        const a = s + (mid - s) * e;
        const b = mid + (en - mid) * e;
        aStart[i3 + k] = a + (b - a) * e;
        const cs = cStart[i3 + k];
        cStart[i3 + k] = cs + (cEnd[i3 + k] - cs) * e;
      }
    }
    aEnd.set(target.positions);
    cEnd.set(target.colors);

    // fresh flight paths for this transition
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      let x = Math.random() - 0.5;
      let y = Math.random() - 0.5;
      let z = Math.random() - 0.5;
      const len = Math.hypot(x, y, z) || 1;
      const m = (0.35 + Math.random() * 2.2) * (0.6 + Math.abs(y / len));
      ctrl[i3] = (x / len) * m;
      ctrl[i3 + 1] = (y / len) * m * 1.35;
      ctrl[i3 + 2] = (z / len) * m;
    }

    g.attributes.aStart.needsUpdate = true;
    g.attributes.aEnd.needsUpdate = true;
    g.attributes.cStart.needsUpdate = true;
    g.attributes.cEnd.needsUpdate = true;
    g.attributes.aCtrl.needsUpdate = true;

    current.current = key;
    uniforms.uProgress.value = 0;
    tween.current?.kill();
    tween.current = gsap.to(uniforms.uProgress, {
      value: 1,
      duration: 2.35,
      ease: 'power2.inOut',
      overwrite: true,
    });
    gsap.fromTo(uniforms.uSize, { value: 0.16 }, { value: 0.085, duration: 2.6, ease: 'power2.out' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, textTarget]);

  /* Fade the field in once the loader is done. */
  useEffect(() => {
    if (!entered) return;
    gsap.to(uniforms.uOpacity, { value: 1, duration: 2, ease: 'power2.out', delay: 0.15 });
  }, [entered, uniforms]);

  const tmpEuler = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.05);
    uniforms.uTime.value += d;
    // scroll velocity pushes the cloud outward a little
    uniforms.uBurst.value += (Math.min(Math.abs(raw.velocity) * 0.0016, 0.22) - uniforms.uBurst.value) * 0.08;

    if (!group.current) return;
    const key = PHASE_SHAPE[phase] ?? 'globe';

    if (phase === 0) {
      // free spin
      tmpEuler.current.y += d * 0.13;
      tmpEuler.current.x += (-0.1 + raw.pointer.y * 0.1 - tmpEuler.current.x) * 0.05;
    } else if (phase === 1) {
      // lock onto the corridor — or onto one city while it is hovered / picked
      const picked = focus ?? hover;
      const st = picked ? STATIONS.find((x) => x.id === picked) : null;
      const aim = st ? stationRotation(st) : ROUTE_ROTATION;
      const ease = st ? 0.075 : 0.06;
      const targetY = aim.y + raw.pointer.x * 0.1;
      const targetX = aim.x + raw.pointer.y * 0.06;
      const TWO_PI = Math.PI * 2;
      let dy = ((targetY - tmpEuler.current.y + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
      tmpEuler.current.y += dy * ease;
      tmpEuler.current.x += (targetX - tmpEuler.current.x) * ease;
    } else {
      const targetY = raw.pointer.x * 0.4 + (key === 'text' ? 0 : 0.12);
      const targetX = raw.pointer.y * 0.22;
      tmpEuler.current.y += (targetY - tmpEuler.current.y) * 0.045;
      tmpEuler.current.x += (targetX - tmpEuler.current.x) * 0.045;
    }
    group.current.rotation.y = tmpEuler.current.y;
    group.current.rotation.x = tmpEuler.current.x;
    raw.rot.x = tmpEuler.current.x;
    raw.rot.y = tmpEuler.current.y;
  });

  return (
    <group ref={group}>
      <points ref={points} geometry={geometry} frustumCulled={false}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
