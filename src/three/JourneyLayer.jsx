import { useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import gsap from 'gsap';

import { useStore, raw, t, useStations } from '../store';
import { latLonToVec3, GLOBE_RADIUS } from './shapes';

/* ------------------------------------------------------------------ *
 * Everything that lives *on* the globe: atmosphere, the Giza → Dammam
 * flight arc, pulsing station markers and their labels.
 * Rotates in lock-step with the particle globe (raw.rot).
 * ------------------------------------------------------------------ */

const arcVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const arcFrag = /* glsl */ `
  precision mediump float;
  uniform float uDraw;
  uniform float uOpacity;
  uniform float uDim;
  uniform float uTime;
  uniform vec3 uFrom;
  uniform vec3 uTo;
  varying vec2 vUv;

  void main() {
    float x = vUv.x;
    if (x > uDraw) discard;
    vec3 col = mix(uFrom, uTo, x);
    // bright head at the drawing tip + a comet running the finished line
    float head = smoothstep(0.045, 0.0, uDraw - x);
    float comet = smoothstep(0.09, 0.0, abs(mod(uTime * 0.28, 1.0) - x)) * step(uDraw, 1.0001);
    float edge = smoothstep(0.0, 0.35, abs(vUv.y - 0.5) * 2.0);
    float a = (0.7 + head * 1.5 + comet * 1.0) * (1.0 - edge * 0.6);
    gl_FragColor = vec4(col + head * 0.6 + comet * 0.5, a * uOpacity * uDim);
  }
`;

function useArcCurve(from, to, lift = 0.62) {
  return useMemo(() => {
    if (!from || !to) return null;
    const a = latLonToVec3(from.lat, from.lon);
    const b = latLonToVec3(to.lat, to.lon);
    const pts = [];
    const STEPS = 90;
    for (let i = 0; i <= STEPS; i++) {
      const s = i / STEPS;
      const v = new THREE.Vector3().copy(a).lerp(b, s);
      const bump = Math.sin(s * Math.PI);
      v.normalize().multiplyScalar(GLOBE_RADIUS + 0.02 + bump * lift);
      pts.push(v);
    }
    return new THREE.CatmullRomCurve3(pts);
  }, [from, to, lift]);
}

function Marker({ station, lang, uOpacity, side, state }) {
  const group = useRef();
  const ring1 = useRef();
  const ring2 = useRef();
  const label = useRef();
  const pos = useMemo(() => latLonToVec3(station.lat, station.lon, GLOBE_RADIUS + 0.02), [station]);
  const color = useMemo(() => new THREE.Color(station.color), [station]);
  const worldPos = useRef(new THREE.Vector3());
  const camDir = useRef(new THREE.Vector3());
  const halo = useRef();
  const haloPivot = useRef();
  const haloU = useMemo(
    () => ({ uColor: { value: new THREE.Color(station.color) }, uOpacity: { value: 0 } }),
    [station.color]
  );
  /* 1 = normal, >1 = this city is hovered/picked, <1 = the other one is */
  const em = useRef({ v: 1, label: 1 });

  useEffect(() => {
    const active = state.active;
    const dimmed = state.dimmed;
    gsap.to(em.current, {
      v: active ? 1.75 : dimmed ? 0.3 : 1,
      label: active ? 1 : dimmed ? 0 : 1,
      duration: 0.55,
      ease: active ? 'back.out(2)' : 'power3.out',
      overwrite: true,
    });
  }, [state.active, state.dimmed]);

  useLayoutEffect(() => {
    if (!group.current) return;
    group.current.position.copy(pos);
    group.current.lookAt(pos.clone().multiplyScalar(2));
    // the cap is built around +Y, so swing that axis onto the station
    if (haloPivot.current) {
      haloPivot.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        pos.clone().normalize()
      );
    }
  }, [pos]);

  useFrame((frame) => {
    const time = frame.clock.elapsedTime;
    const E = em.current.v;
    for (const [i, r] of [ring1, ring2].entries()) {
      if (!r.current) continue;
      const k = (time * 0.5 + i * 0.5) % 1;
      const s = (0.35 + k * 2.1) * E;
      r.current.scale.set(s, s, s);
      r.current.material.opacity = (1 - k) * 0.75 * uOpacity.value * Math.min(1, E);
    }
    if (halo.current) {
      const h = Math.max(0, E - 1) / 0.75; // 0 → 1 as the city becomes active
      // the cap hugs the globe, so it only breathes — scaling it in 3D would
      // lift it off the surface and reintroduce the clipping.
      const s = 0.85 + h * 0.15 + Math.sin(time * 2) * 0.02 * h;
      halo.current.scale.set(s, s, s);
      haloU.uOpacity.value = h * uOpacity.value;
      halo.current.visible = h > 0.02;
    }
    // hide labels that rotated behind the planet
    if (label.current && group.current) {
      group.current.getWorldPosition(worldPos.current);
      frame.camera.getWorldDirection(camDir.current);
      const toCam = worldPos.current.clone().sub(frame.camera.position).normalize();
      const facing = worldPos.current.clone().normalize().dot(toCam.negate());
      label.current.style.opacity = String(
        Math.max(0, Math.min(1, (facing - 0.05) * 3)) * uOpacity.value * em.current.label
      );
      label.current.style.setProperty('--s', String(0.72 + em.current.label * 0.28 + Math.max(0, E - 1) * 0.18));
    }
  });

  return (
    <>
      {/* Soft glow that blooms over the country when it is picked.
          A flat disc tangent to the marker sank into the curved globe and got
          sliced by the body mesh, so this is a spherical cap centred on the
          globe (hence outside the marker group, which is offset to the
          surface) and aimed at the station, with depth testing off. */}
      <group ref={haloPivot}>
        <mesh ref={halo} visible={false} renderOrder={3}>
          <sphereGeometry args={[GLOBE_RADIUS + 0.012, 48, 48, 0, Math.PI * 2, 0, 0.42]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            depthTest={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            uniforms={haloU}
            vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
            fragmentShader={`precision mediump float; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
            void main() {
              // on a sphere cap, v runs 1 at the pole → 0 at the rim, so the
              // normalised distance from the marker is its complement.
              float d = clamp(1.0 - vUv.y, 0.0, 1.0);
              float core = pow(max(0.0, 1.0 - d), 2.6) * 0.28;
              float ring = smoothstep(0.62, 0.84, d) * smoothstep(1.0, 0.84, d) * 0.62;
              float fade = smoothstep(1.0, 0.92, d);
              gl_FragColor = vec4(uColor, (core + ring) * fade * uOpacity);
            }`}
          />
        </mesh>
      </group>

      <group ref={group}>
        <mesh>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} />
        </mesh>
        {[ring1, ring2].map((r, i) => (
          <mesh key={i} ref={r}>
            <ringGeometry args={[0.05, 0.062, 48]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
        <Html center distanceFactor={7} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={label} className={`globe-label globe-label--${side}`} style={{ '--c': station.color }}>
            <span className="globe-label__city">{t(station.city, lang)}</span>
            <span className="globe-label__meta">{station.years}</span>
          </div>
        </Html>
      </group>
    </>
  );
}

export default function JourneyLayer() {
  const phase = useStore((s) => s.phase);
  const lang = useStore((s) => s.lang);
  const entered = useStore((s) => s.entered);
  const hover = useStore((s) => s.hover);
  const focus = useStore((s) => s.focus);
  const picked = focus ?? hover;
  const STATIONS = useStations();
  const group = useRef();
  const curve = useArcCurve(STATIONS[0], STATIONS[1], 0.78);

  const uniforms = useMemo(
    () => ({
      uDraw: { value: 0 },
      uOpacity: { value: 0 },
      uDim: { value: 1 },
      uTime: { value: 0 },
      uFrom: { value: new THREE.Color(STATIONS[0]?.color ?? '#E8B14C') },
      uTo: { value: new THREE.Color(STATIONS[1]?.color ?? '#17D3A3') },
    }),
    [STATIONS]
  );
  const atmo = useMemo(() => ({ uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#1F6E9C') } }), []);
  const shared = useMemo(() => ({ value: 0 }), []); // markers + labels opacity

  const tubeGeo = useMemo(() => (curve ? new THREE.TubeGeometry(curve, 200, 0.034, 8, false) : null), [curve]);
  const bodyMat = useRef();

  useEffect(() => {
    gsap.to(uniforms.uDim, { value: picked ? 0.2 : 1, duration: 0.5, ease: 'power2.out' });
  }, [picked, uniforms]);

  useEffect(() => {
    const visible = entered && phase <= 1;
    gsap.to(uniforms.uOpacity, { value: visible ? 1 : 0, duration: 0.8, ease: 'power2.out' });
    gsap.to(atmo.uOpacity, { value: visible ? 1 : 0, duration: 0.8, ease: 'power2.out' });
    gsap.to(shared, { value: visible ? 1 : 0, duration: 0.8, ease: 'power2.out' });
    if (phase === 1) {
      gsap.fromTo(uniforms.uDraw, { value: 0 }, { value: 1, duration: 2.6, ease: 'power2.inOut', delay: 0.35 });
    } else if (phase === 0) {
      gsap.to(uniforms.uDraw, { value: 0.001, duration: 0.4 });
    }
  }, [phase, entered, uniforms, atmo, shared]);

  useFrame((state, delta) => {
    uniforms.uTime.value += Math.min(delta, 0.05);
    if (group.current) {
      group.current.rotation.x = raw.rot.x;
      group.current.rotation.y = raw.rot.y;
      group.current.visible = shared.value > 0.01;
    }
    if (bodyMat.current) bodyMat.current.opacity = shared.value * 0.95;
  });

  return (
    <group ref={group}>
      {/* atmosphere shell so the dotted land reads as a real sphere */}
      <mesh scale={1.03}>
        <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={atmo}
          vertexShader={`varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
          fragmentShader={`precision mediump float; uniform float uOpacity; uniform vec3 uColor; varying vec3 vN;
            void main(){ float f = pow(1.0 - abs(vN.z), 2.6); gl_FragColor = vec4(uColor, f * 0.85 * uOpacity); }`}
        />
      </mesh>
      {/* the inner body: keeps far-side dots from bleeding through */}
      <mesh scale={0.985} renderOrder={-2}>
        <sphereGeometry args={[GLOBE_RADIUS, 48, 48]} />
        <meshBasicMaterial ref={bodyMat} color="#04070e" transparent opacity={0} depthWrite />
      </mesh>

      {tubeGeo && (
        <mesh geometry={tubeGeo} renderOrder={2}>
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={uniforms}
            vertexShader={arcVert}
            fragmentShader={arcFrag}
          />
        </mesh>
      )}

      {STATIONS.map((s, i) => (
        <Marker
          key={s.id}
          station={s}
          lang={lang}
          uOpacity={shared}
          side={i === 0 ? 'a' : 'b'}
          state={{ active: picked === s.id, dimmed: !!picked && picked !== s.id }}
        />
      ))}
    </group>
  );
}
