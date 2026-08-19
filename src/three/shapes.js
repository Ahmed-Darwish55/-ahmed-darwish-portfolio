import * as THREE from 'three';
import LAND from '../data/land.json';

/* ------------------------------------------------------------------ *
 * Point-cloud "targets" for the morphing particle field.
 * Every generator returns { positions, colors } as Float32Array(N*3),
 * all roughly inside a radius-3 sphere so morphs stay balanced.
 * ------------------------------------------------------------------ */

export const GLOBE_RADIUS = 2.05;

/** Deterministic RNG so every reload looks identical. */
function rng(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function latLonToVec3(lat, lon, radius = GLOBE_RADIUS) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

const c = new THREE.Color();
function writeColor(arr, i, hex, mul = 1) {
  c.set(hex);
  arr[i * 3] = c.r * mul;
  arr[i * 3 + 1] = c.g * mul;
  arr[i * 3 + 2] = c.b * mul;
}

function alloc(n) {
  return { positions: new Float32Array(n * 3), colors: new Float32Array(n * 3) };
}

/* ------------------------------------------------------------------ */
/* 1. The dotted Earth — real Natural Earth landmasses                 */
/* ------------------------------------------------------------------ */
export function globeShape(N, stations = []) {
  const out = alloc(N);
  const rand = rng(7);
  const v = new THREE.Vector3();

  for (let i = 0; i < N; i++) {
    const src = LAND[i % LAND.length];
    // jitter duplicates so repeated land points don't stack
    const dup = Math.floor(i / LAND.length);
    const jl = dup === 0 ? 0 : (rand() - 0.5) * 1.1;
    const jt = dup === 0 ? 0 : (rand() - 0.5) * 1.1;
    v.copy(latLonToVec3(src[1] + jt, src[0] + jl, GLOBE_RADIUS + (rand() - 0.5) * 0.012));
    out.positions[i * 3] = v.x;
    out.positions[i * 3 + 1] = v.y;
    out.positions[i * 3 + 2] = v.z;

    // highlight the two stations on the globe itself
    let hex = '#2E8FA8';
    let mul = 0.55 + rand() * 0.35;
    for (const s of stations) {
      const d = Math.hypot(src[1] - s.lat, (src[0] - s.lon) * 0.85);
      if (d < 7) {
        hex = s.color;
        mul = 1.25 - d / 14;
        break;
      }
    }
    writeColor(out.colors, i, hex, mul);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* helpers: area-weighted triangle sampling                            */
/* ------------------------------------------------------------------ */
function triSampler(tris, rand) {
  const areas = tris.map((t) => {
    const ab = new THREE.Vector3().subVectors(t[1], t[0]);
    const ac = new THREE.Vector3().subVectors(t[2], t[0]);
    return ab.cross(ac).length() * 0.5;
  });
  const total = areas.reduce((a, b) => a + b, 0);
  const cdf = [];
  let acc = 0;
  for (const a of areas) {
    acc += a / total;
    cdf.push(acc);
  }
  const p = new THREE.Vector3();
  return () => {
    const r = rand();
    let idx = cdf.findIndex((x) => x >= r);
    if (idx < 0) idx = tris.length - 1;
    const [a, b, cc] = tris[idx];
    let u = rand();
    let w = rand();
    if (u + w > 1) {
      u = 1 - u;
      w = 1 - w;
    }
    p.copy(a)
      .addScaledVector(new THREE.Vector3().subVectors(b, a), u)
      .addScaledVector(new THREE.Vector3().subVectors(cc, a), w);
    return p;
  };
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------------ */
/* 2. Giza — three pyramids on the sand                                */
/* ------------------------------------------------------------------ */
export function pyramidsShape(N) {
  const out = alloc(N);
  const rand = rng(21);
  const pyr = [
    { x: -0.15, z: 0.1, b: 2.5, h: 1.85 },
    { x: 1.75, z: -1.0, b: 1.95, h: 1.45 },
    { x: 3.0, z: -1.85, b: 1.25, h: 0.95 },
  ];
  const base = -1.25;
  const tris = [];
  for (const p of pyr) {
    const h = p.b / 2;
    const c0 = V(p.x - h, base, p.z + h);
    const c1 = V(p.x + h, base, p.z + h);
    const c2 = V(p.x + h, base, p.z - h);
    const c3 = V(p.x - h, base, p.z - h);
    const apex = V(p.x, base + p.h, p.z);
    tris.push([c0, c1, apex], [c1, c2, apex], [c2, c3, apex], [c3, c0, apex]);
  }
  const sample = triSampler(tris, rand);
  const bodyCount = Math.floor(N * 0.74);

  for (let i = 0; i < N; i++) {
    if (i < bodyCount) {
      const p = sample();
      // subtle stone-block quantisation: the pyramids read as masonry courses
      const y = Math.round((p.y - base) / 0.055) * 0.055 + base;
      out.positions[i * 3] = p.x - 1.2;
      out.positions[i * 3 + 1] = y;
      out.positions[i * 3 + 2] = p.z;
      const t = (y - base) / 2.0;
      writeColor(out.colors, i, t > 0.72 ? '#FFE9AE' : '#E8B14C', 0.55 + t * 0.85);
    } else {
      // desert floor + a faint horizon haze
      const a = rand() * Math.PI * 2;
      const r = 1.5 + Math.pow(rand(), 0.55) * 5.2;
      out.positions[i * 3] = Math.cos(a) * r - 1.2;
      out.positions[i * 3 + 1] = base - rand() * 0.05;
      out.positions[i * 3 + 2] = Math.sin(a) * r * 0.62;
      writeColor(out.colors, i, '#B8823A', 0.18 + rand() * 0.3);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. Dammam — a gulf skyline on the corniche                          */
/* ------------------------------------------------------------------ */
export function skylineShape(N) {
  const out = alloc(N);
  const rand = rng(33);
  const base = -1.35;
  let i = 0;

  const put = (x, y, z, hex, mul) => {
    if (i >= N) return;
    out.positions[i * 3] = x;
    out.positions[i * 3 + 1] = y;
    out.positions[i * 3 + 2] = z;
    writeColor(out.colors, i, hex, mul);
    i++;
  };
  const budget = (frac) => Math.floor(N * frac);

  /* --- 1. Al Khobar water tower: the Eastern Province landmark ------ */
  {
    const cx = -1.55;
    const cz = 0;
    const stemH = 2.25;
    const n = budget(0.15);
    for (let k = 0; k < n; k++) {
      const t = rand();
      if (t < 0.42) {
        // tapered stem
        const h = rand();
        const r = 0.2 - h * 0.1;
        const a = rand() * Math.PI * 2;
        put(cx + Math.cos(a) * r, base + h * stemH, cz + Math.sin(a) * r, '#9FE8D8', 0.35 + h * 0.5);
      } else if (t < 0.9) {
        // the bulb
        const u = rand() * Math.PI * 2;
        const v = Math.acos(2 * rand() - 1);
        const R = 0.5;
        put(
          cx + R * Math.sin(v) * Math.cos(u),
          base + stemH + 0.32 + R * Math.cos(v) * 0.86,
          cz + R * Math.sin(v) * Math.sin(u),
          rand() > 0.7 ? '#FFFFFF' : '#17D3A3',
          0.75 + rand() * 0.6
        );
      } else {
        // crown mast
        put(cx + (rand() - 0.5) * 0.05, base + stemH + 0.86 + rand() * 0.38, cz + (rand() - 0.5) * 0.05, '#EAFFF8', 1.1);
      }
    }
  }

  /* --- 2. Mosque: dome + minaret ------------------------------------ */
  {
    const cx = 0.45;
    const cz = -0.25;
    const n = budget(0.17);
    for (let k = 0; k < n; k++) {
      const t = rand();
      if (t < 0.3) {
        // prayer hall walls (outline of a box)
        const s = rand() * 4;
        const side = Math.floor(s);
        const f = s - side;
        const w = 0.72;
        const d = 0.42;
        const xs = [-1, 1, 1, -1][side];
        const zs = [-1, -1, 1, 1][side];
        const xe = [1, 1, -1, -1][side];
        const ze = [-1, 1, 1, -1][side];
        const y = base + rand() * 0.62;
        put(cx + (xs + (xe - xs) * f) * w, y, cz + (zs + (ze - zs) * f) * d, '#17D3A3', 0.5 + rand() * 0.5);
      } else if (t < 0.68) {
        // gold dome
        const u = rand() * Math.PI * 2;
        const v = Math.acos(rand());
        const R = 0.5;
        put(
          cx + R * Math.sin(v) * Math.cos(u),
          base + 0.62 + R * Math.cos(v) * 1.05,
          cz + R * Math.sin(v) * Math.sin(u) * 0.85,
          rand() > 0.75 ? '#FFE9AE' : '#E8B14C',
          0.7 + rand() * 0.7
        );
      } else if (t < 0.95) {
        // minaret
        const h = rand();
        const a = rand() * Math.PI * 2;
        const r = 0.1 - h * 0.03;
        put(cx - 1.05 + Math.cos(a) * r, base + h * 2.05, cz + Math.sin(a) * r, '#EAFFF8', 0.4 + h * 0.7);
      } else {
        // minaret cap
        const a = rand() * Math.PI * 2;
        const h = rand();
        put(cx - 1.05 + Math.cos(a) * 0.11 * (1 - h), base + 2.05 + h * 0.34, cz + Math.sin(a) * 0.11 * (1 - h), '#E8B14C', 1.1);
      }
    }
  }

  /* --- 3. Oil derrick: the Eastern Province runs on it --------------- */
  {
    const cx = -3.05;
    const cz = -0.35;
    const H = 1.85;
    const n = budget(0.12);
    for (let k = 0; k < n; k++) {
      const t = rand();
      const h = rand();
      const spread = 0.42 - h * 0.3;
      if (t < 0.62) {
        const leg = Math.floor(rand() * 4);
        const sx = [-1, 1, 1, -1][leg];
        const sz = [-1, -1, 1, 1][leg];
        put(cx + sx * spread, base + h * H, cz + sz * spread, '#4CC9F0', 0.35 + h * 0.8);
      } else if (t < 0.9) {
        // cross braces
        const level = Math.floor(rand() * 5) / 4;
        const sp = 0.42 - level * 0.3;
        const s = rand() * 4;
        const side = Math.floor(s);
        const f = s - side;
        const xs = [-1, 1, 1, -1][side];
        const zs = [-1, -1, 1, 1][side];
        const xe = [1, 1, -1, -1][side];
        const ze = [-1, 1, 1, -1][side];
        put(cx + (xs + (xe - xs) * f) * sp, base + level * H, cz + (zs + (ze - zs) * f) * sp, '#2E86C7', 0.3 + rand() * 0.4);
      } else {
        put(cx + (rand() - 0.5) * 0.22, base + H + rand() * 0.16, cz + (rand() - 0.5) * 0.22, '#EAFFF8', 1.0);
      }
    }
  }

  /* --- 4. Palms along the corniche ---------------------------------- */
  {
    const palms = [
      { x: 1.55, z: 0.55, h: 1.15 },
      { x: -2.6, z: 0.8, h: 0.95 },
      { x: -0.5, z: 1.0, h: 0.8 },
      { x: -4.4, z: 0.65, h: 1.0 },
    ];
    const n = budget(0.12);
    for (let k = 0; k < n; k++) {
      const p = palms[Math.floor(rand() * palms.length)];
      if (rand() < 0.34) {
        const h = rand();
        put(p.x + Math.sin(h * 1.1) * 0.09, base + h * p.h, p.z, '#B08A46', 0.45 + rand() * 0.4);
      } else {
        // fronds: arcs falling away from the crown
        const frond = Math.floor(rand() * 7);
        const a = (frond / 7) * Math.PI * 2;
        const t = rand();
        const reach = 0.62 * t;
        put(
          p.x + Math.sin(p.h * 1.1) * 0.09 + Math.cos(a) * reach,
          base + p.h + 0.16 - t * t * 0.5,
          p.z + Math.sin(a) * reach * 0.55,
          '#2AE08C',
          0.55 + (1 - t) * 0.85
        );
      }
    }
  }

  /* --- 5. Background city blocks ------------------------------------ */
  {
    const towers = [];
    for (let k = 0; k < 14; k++) {
      const x = -5.2 + k * 0.6 + (rand() - 0.5) * 0.2;
      if (Math.abs(x + 1.55) < 0.85 || Math.abs(x - 0.45) < 1.0 || Math.abs(x + 3.05) < 0.8) continue; // keep landmarks clear
      towers.push({ x, z: -1.15 - rand() * 0.5, w: 0.16 + rand() * 0.12, h: 0.5 + Math.pow(rand(), 1.7) * 1.5 });
    }
    const n = budget(0.24);
    for (let k = 0; k < n; k++) {
      const t = towers[Math.floor(rand() * towers.length)];
      if (!t) break;
      const edge = rand() < 0.7;
      const hh = rand();
      if (edge) {
        const cxs = rand() < 0.5 ? -1 : 1;
        const czs = rand() < 0.5 ? -1 : 1;
        put(t.x + cxs * t.w, base + hh * t.h, t.z + czs * t.w * 0.8, '#12A88A', 0.25 + hh * 0.6);
      } else {
        const lit = rand() > 0.7;
        put(
          t.x + (rand() - 0.5) * 2 * t.w,
          base + 0.06 + Math.floor(rand() * 8) / 8 * t.h,
          t.z + (rand() < 0.5 ? -t.w : t.w) * 0.8,
          lit ? '#FFF3CF' : '#0E8F76',
          lit ? 0.9 : 0.25
        );
      }
    }
  }

  /* --- 6. The Gulf --------------------------------------------------- */
  while (i < N) {
    const x = (rand() - 0.5) * 9.5 - 1.1;
    const z = 1.35 + Math.pow(rand(), 0.75) * 2.6;
    put(x, base - 0.02 + Math.sin(x * 2.4 + z * 3.2) * 0.05, z, rand() > 0.9 ? '#7FD8F0' : '#1E7FA6', 0.16 + rand() * 0.45);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 4. The GIS grid — a contoured terrain mesh, my day job              */
/* ------------------------------------------------------------------ */
export function gridShape(N) {
  const out = alloc(N);
  const rand = rng(45);
  const S = 4.6;
  const elev = (x, z) =>
    Math.sin(x * 1.15) * 0.34 + Math.cos(z * 0.95) * 0.3 + Math.sin((x + z) * 0.55) * 0.22;

  const lineCount = 26;
  for (let i = 0; i < N; i++) {
    const onX = i % 2 === 0;
    const line = Math.floor(rand() * lineCount) / (lineCount - 1);
    const along = rand();
    const a = -S + line * S * 2;
    const b = -S + along * S * 2;
    const x = onX ? b : a;
    const z = onX ? a : b;
    const y = elev(x, z) - 0.55;
    out.positions[i * 3] = x;
    out.positions[i * 3 + 1] = y;
    out.positions[i * 3 + 2] = z * 0.85;
    const t = (y + 1.1) / 1.9;
    const node = rand() > 0.955;
    writeColor(out.colors, i, node ? '#FFFFFF' : t > 0.62 ? '#8AE9FF' : '#2E86C7', node ? 1.3 : 0.3 + t * 0.85);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 5. Skills — a node/edge sphere, like a dependency graph             */
/* ------------------------------------------------------------------ */
export function networkShape(N) {
  const out = alloc(N);
  const rand = rng(57);
  const R = 2.15;
  const NODES = 38;
  const nodes = [];
  for (let i = 0; i < NODES; i++) {
    const y = 1 - (i / (NODES - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * Math.PI * (3 - Math.sqrt(5));
    nodes.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(R));
  }
  const edges = [];
  for (let i = 0; i < NODES; i++) {
    const sorted = nodes
      .map((n, j) => ({ j, d: n.distanceTo(nodes[i]) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const s of sorted) edges.push([nodes[i], nodes[s.j]]);
  }
  const tmp = new THREE.Vector3();
  const clusterCount = Math.floor(N * 0.34);

  for (let i = 0; i < N; i++) {
    if (i < clusterCount) {
      const n = nodes[Math.floor(rand() * NODES)];
      tmp.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.19);
      tmp.add(n);
      writeColor(out.colors, i, rand() > 0.5 ? '#B388FF' : '#4CC9F0', 0.7 + rand() * 0.6);
    } else {
      const e = edges[Math.floor(rand() * edges.length)];
      const t = rand();
      tmp.lerpVectors(e[0], e[1], t).multiplyScalar(1 + Math.sin(t * Math.PI) * 0.045);
      writeColor(out.colors, i, '#3E6FA8', 0.22 + rand() * 0.35);
    }
    out.positions[i * 3] = tmp.x;
    out.positions[i * 3 + 1] = tmp.y;
    out.positions[i * 3 + 2] = tmp.z;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 6. Text — sampled from a 2D canvas, so it works in Arabic too       */
/* ------------------------------------------------------------------ */
export function textShape(N, text, { font = '700 150px "Space Grotesk", sans-serif', rtl = false } = {}) {
  const rand = rng(69);
  const out = alloc(N);
  const canvas = document.createElement('canvas');
  const W = 1024;
  const H = 320;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  let size = 150;
  ctx.font = font;
  while (ctx.measureText(text).width > W * 0.92 && size > 24) {
    size -= 6;
    ctx.font = font.replace(/\d+px/, `${size}px`);
  }
  ctx.fillText(text, W / 2, H / 2);
  const data = ctx.getImageData(0, 0, W, H).data;

  const hits = [];
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 128) hits.push([x, y]);
    }
  }
  if (!hits.length) return networkShape(N);

  for (let i = 0; i < N; i++) {
    const h = hits[Math.floor(rand() * hits.length)];
    const x = ((h[0] + (rand() - 0.5) * 2) / W - 0.5) * 7.0;
    const y = -((h[1] + (rand() - 0.5) * 2) / H - 0.5) * 2.15;
    out.positions[i * 3] = x;
    out.positions[i * 3 + 1] = y;
    out.positions[i * 3 + 2] = (rand() - 0.5) * 0.28;
    const t = x / 7.0 + 0.5;
    // dimmer than the other shapes: this one sits behind live text
    writeColor(out.colors, i, t < 0.5 ? '#E8B14C' : '#17D3A3', 0.42 + rand() * 0.4);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 7. Canvas sampling helper                                           */
/*    Draw anything on a 2D canvas, get a coloured point cloud back.   */
/* ------------------------------------------------------------------ */
function sampleCanvas(N, { width, height, worldWidth, depth = 0.22, seed = 91, step = 2 }, draw) {
  const rand = rng(seed);
  const out = alloc(N);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  draw(ctx);
  const data = ctx.getImageData(0, 0, width, height).data;

  const hits = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 110) hits.push(idx);
    }
  }
  if (!hits.length) return out;

  const scale = worldWidth / width;
  for (let i = 0; i < N; i++) {
    const idx = hits[Math.floor(rand() * hits.length)];
    const px = (idx / 4) % width;
    const py = Math.floor(idx / 4 / width);
    out.positions[i * 3] = (px + (rand() - 0.5) * step - width / 2) * scale;
    out.positions[i * 3 + 1] = -(py + (rand() - 0.5) * step - height / 2) * scale;
    out.positions[i * 3 + 2] = (rand() - 0.5) * depth;
    const mul = 0.75 + rand() * 0.55;
    out.colors[i * 3] = (data[idx] / 255) * mul;
    out.colors[i * 3 + 1] = (data[idx + 1] / 255) * mul;
    out.colors[i * 3 + 2] = (data[idx + 2] / 255) * mul;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 8. The toolkit — real technology marks, wired together              */
/* ------------------------------------------------------------------ */
const ICONS = {
  react(ctx, r, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.13;
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.rotate((k * Math.PI) / 3);
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.19, 0, Math.PI * 2);
    ctx.fill();
  },
  shield(ctx, r, color, label) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.82, -r * 0.66);
    ctx.lineTo(r * 0.62, r * 0.62);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.62, r * 0.62);
    ctx.lineTo(-r * 0.82, -r * 0.66);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0b0f18';
    ctx.font = `800 ${r * 0.95}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, r * 0.06);
  },
  square(ctx, r, color, label, ink = '#0b0f18') {
    ctx.fillStyle = color;
    const s = r * 0.92;
    ctx.beginPath();
    ctx.roundRect(-s, -s, s * 2, s * 2, r * 0.22);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = `800 ${r * 0.82}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, r * 0.08);
  },
  hexagon(ctx, r, color, label) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      const fn = k ? 'lineTo' : 'moveTo';
      ctx[fn](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0b0f18';
    ctx.font = `800 ${r * 0.62}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, r * 0.05);
  },
  globe(ctx, r, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    for (const k of [0.42, 0.82]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * k, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const y of [-r * 0.5, 0, r * 0.5]) {
      const w = Math.sqrt(Math.max(0, r * r - y * y));
      ctx.beginPath();
      ctx.moveTo(-w, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // a pin dropped on it
    ctx.fillStyle = '#E8B14C';
    ctx.beginPath();
    ctx.arc(r * 0.3, -r * 0.32, r * 0.17, 0, Math.PI * 2);
    ctx.fill();
  },
  cube(ctx, r, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.11;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 6;
      const fn = k ? 'lineTo' : 'moveTo';
      ctx[fn](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 - Math.PI / 6;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.stroke();
  },
  whale(ctx, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-r, -r * 0.1, r * 1.75, r * 0.62, r * 0.14);
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.roundRect(-r * 0.85 + k * r * 0.42, -r * 0.62, r * 0.34, r * 0.44, r * 0.06);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.roundRect(-r * 0.43, -r * 1.1, r * 0.34, r * 0.44, r * 0.06);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.arc(-r * 1.05, r * 0.2, r * 0.42, -Math.PI * 0.55, Math.PI * 0.15);
    ctx.stroke();
  },
  branch(ctx, r, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.14;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 0.8);
    ctx.lineTo(-r * 0.55, -r * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 0.05);
    ctx.quadraticCurveTo(-r * 0.55, -r * 0.5, r * 0.5, -r * 0.62);
    ctx.stroke();
    ctx.fillStyle = color;
    for (const p of [
      [-r * 0.55, -r * 0.8],
      [-r * 0.55, r * 0.8],
      [r * 0.5, -r * 0.62],
    ]) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], r * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  leaf(ctx, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.85, -r * 0.2, r * 0.55, r * 0.72, 0, r);
    ctx.bezierCurveTo(-r * 0.55, r * 0.72, -r * 0.85, -r * 0.2, 0, -r);
    ctx.fill();
    ctx.strokeStyle = '#0b0f18';
    ctx.lineWidth = r * 0.1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    ctx.lineTo(0, r * 0.9);
    ctx.stroke();
  },
  swirl(ctx, r, color, label) {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, Math.PI * 0.25, Math.PI * 1.85);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `800 ${r * 0.62}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, r * 0.05);
  },
  figma(ctx, r, color) {
    const c1 = ['#F24E1E', '#FF7262', '#A259FF', '#1ABCFE', '#0ACF83'];
    const w = r * 0.52;
    ctx.fillStyle = c1[0];
    ctx.beginPath();
    ctx.roundRect(-w, -r, w, r * 0.66, [w, 0, 0, w]);
    ctx.fill();
    ctx.fillStyle = c1[2];
    ctx.beginPath();
    ctx.roundRect(0, -r, w, r * 0.66, [0, w, w, 0]);
    ctx.fill();
    ctx.fillStyle = c1[1];
    ctx.beginPath();
    ctx.roundRect(-w, -r * 0.32, w, r * 0.66, [w, 0, 0, w]);
    ctx.fill();
    ctx.fillStyle = c1[3];
    ctx.beginPath();
    ctx.arc(w * 0.5, r * 0.01, w * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c1[4];
    ctx.beginPath();
    ctx.roundRect(-w, r * 0.34, w, r * 0.66, [w, 0, w, w]);
    ctx.fill();
  },
};

export function techShape(N) {
  const W = 1180;
  const H = 1020;
  /* one core (the map) with the stack orbiting it */
  const nodes = [
    { x: 0.5, y: 0.5, r: 118, draw: (c, r) => ICONS.globe(c, r, '#17D3A3') },
    { x: 0.5, y: 0.12, r: 92, draw: (c, r) => ICONS.react(c, r, '#61DAFB') },
    { x: 0.83, y: 0.27, r: 84, draw: (c, r) => ICONS.shield(c, r, '#DD0031', 'A') },
    { x: 0.9, y: 0.62, r: 80, draw: (c, r) => ICONS.square(c, r, '#3178C6', 'TS', '#ffffff') },
    { x: 0.68, y: 0.88, r: 80, draw: (c, r) => ICONS.square(c, r, '#F7DF1E', 'JS') },
    { x: 0.32, y: 0.88, r: 84, draw: (c, r) => ICONS.hexagon(c, r, '#83CD29', 'NODE') },
    { x: 0.1, y: 0.62, r: 80, draw: (c, r) => ICONS.whale(c, r, '#2496ED') },
    { x: 0.17, y: 0.27, r: 82, draw: (c, r) => ICONS.swirl(c, r, '#88CE02', 'G') },
    { x: 0.26, y: 0.55, r: 62, draw: (c, r) => ICONS.cube(c, r, '#E8ECF3') },
    { x: 0.74, y: 0.55, r: 62, draw: (c, r) => ICONS.figma(c, r) },
  ];
  const ring = [1, 2, 3, 4, 5, 6, 7];
  const links = ring.map((k) => [0, k]).concat(ring.map((k, i) => [k, ring[(i + 1) % ring.length]]));
  links.push([0, 8], [0, 9]);

  return sampleCanvas(N, { width: W, height: H, worldWidth: 4.95, depth: 0.34, seed: 57, step: 2 }, (ctx) => {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,175,225,0.95)';
    ctx.lineWidth = 4;
    for (const [a, b] of links) {
      const A = nodes[a];
      const B = nodes[b];
      ctx.beginPath();
      ctx.moveTo(A.x * W, A.y * H);
      ctx.lineTo(B.x * W, B.y * H);
      ctx.stroke();
    }
    for (const n of nodes) {
      ctx.save();
      ctx.translate(n.x * W, n.y * H);
      // clear a socket in the wiring so each mark stands on its own
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 0, n.r * 1.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      n.draw(ctx, n.r);
      ctx.restore();
    }
  });
}

/* ------------------------------------------------------------------ */
/* 9. Credentials — an award medal between two certificates            */
/* ------------------------------------------------------------------ */
export function medalShape(N) {
  const W = 1500;
  const H = 820;
  return sampleCanvas(N, { width: W, height: H, worldWidth: 6.2, depth: 0.28, seed: 123, step: 2 }, (ctx) => {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H * 0.46;
    const R = 165;

    // certificates on both sides
    const sheet = (x, y, rot, tone) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.strokeStyle = tone;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.roundRect(-150, -110, 300, 220, 12);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(200,215,235,0.75)';
      for (let k = 0; k < 5; k++) {
        const w = k === 0 ? 150 : 200 - (k % 3) * 40;
        ctx.beginPath();
        ctx.moveTo(-110, -60 + k * 34);
        ctx.lineTo(-110 + w, -60 + k * 34);
        ctx.stroke();
      }
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.arc(95, 62, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    sheet(cx - 415, cy + 120, -0.19, '#4CC9F0');
    sheet(cx + 415, cy + 120, 0.19, '#B388FF');

    // ribbons
    ctx.fillStyle = '#17D3A3';
    ctx.beginPath();
    ctx.moveTo(cx - 90, cy + 90);
    ctx.lineTo(cx - 30, cy + 90);
    ctx.lineTo(cx - 55, cy + 310);
    ctx.lineTo(cx - 130, cy + 250);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0FA98A';
    ctx.beginPath();
    ctx.moveTo(cx + 90, cy + 90);
    ctx.lineTo(cx + 30, cy + 90);
    ctx.lineTo(cx + 55, cy + 310);
    ctx.lineTo(cx + 130, cy + 250);
    ctx.closePath();
    ctx.fill();

    // laurel
    ctx.strokeStyle = '#9BE7C9';
    ctx.lineWidth = 6;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy + 10, R + 70, dir > 0 ? -Math.PI * 0.42 : Math.PI * 0.58, dir > 0 ? Math.PI * 0.42 : Math.PI * 1.42);
      ctx.stroke();
      for (let k = 0; k < 7; k++) {
        const a = (-Math.PI * 0.36 + (k / 6) * Math.PI * 0.72) * 1;
        const ax = cx + dir * Math.cos(a) * (R + 70);
        const ay = cy + 10 + Math.sin(a) * (R + 70);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a + (dir > 0 ? 0 : Math.PI));
        ctx.fillStyle = '#3FD8A8';
        ctx.beginPath();
        ctx.ellipse(22, 0, 26, 12, -0.5 * dir, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // medal disc + star
    ctx.strokeStyle = '#E8B14C';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,233,174,0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#FFD98A';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = k % 2 === 0 ? R * 0.66 : R * 0.28;
      const fn = k ? 'lineTo' : 'moveTo';
      ctx[fn](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  });
}

/* ------------------------------------------------------------------ */
/* 10. Certificates — a diploma with a wax seal and a ribbon           */
/* ------------------------------------------------------------------ */
export function diplomaShape(N) {
  const W = 1400;
  const H = 900;
  return sampleCanvas(N, { width: W, height: H, worldWidth: 6.4, depth: 0.26, seed: 321, step: 2 }, (ctx) => {
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H * 0.46;

    // two sheets behind, fanned out
    for (const [dx, rot, tone] of [
      [-46, -0.075, 'rgba(120,170,220,0.55)'],
      [46, 0.075, 'rgba(160,140,220,0.55)'],
    ]) {
      ctx.save();
      ctx.translate(cx + dx, cy + 16);
      ctx.rotate(rot);
      ctx.strokeStyle = tone;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(-380, -250, 760, 500, 16);
      ctx.stroke();
      ctx.restore();
    }

    // the front sheet
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#EAF2FF';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-390, -258, 780, 516, 18);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232,177,76,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-360, -228, 720, 456, 12);
    ctx.stroke();

    // header rule + title lines
    ctx.strokeStyle = 'rgba(190,210,240,0.9)';
    ctx.lineCap = 'round';
    const line = (y, w, weight, alpha) => {
      ctx.lineWidth = weight;
      ctx.strokeStyle = `rgba(210,225,250,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(w / 2, y);
      ctx.stroke();
    };
    line(-150, 300, 18, 0.95); // the name
    line(-100, 180, 8, 0.6);
    line(-40, 560, 9, 0.5);
    line(-8, 520, 9, 0.5);
    line(24, 480, 9, 0.5);
    line(56, 300, 9, 0.4);

    // signature scribble
    ctx.strokeStyle = 'rgba(140,235,205,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-330, 175);
    ctx.bezierCurveTo(-280, 130, -250, 205, -205, 165);
    ctx.bezierCurveTo(-175, 140, -160, 195, -120, 168);
    ctx.stroke();
    line(190, 260, 4, 0.35);
    ctx.restore();

    // wax seal with a star + ribbons
    ctx.save();
    ctx.translate(cx + 250, cy + 150);
    ctx.fillStyle = '#E8B14C';
    ctx.beginPath();
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2;
      const r = 58 + (k % 2 ? -6 : 6);
      const fn = k ? 'lineTo' : 'moveTo';
      ctx[fn](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0b0f18';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const r = k % 2 === 0 ? 30 : 13;
      const fn = k ? 'lineTo' : 'moveTo';
      ctx[fn](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#17D3A3';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * 18, 40);
      ctx.lineTo(dir * 48, 46);
      ctx.lineTo(dir * 40, 160);
      ctx.lineTo(dir * 6, 118);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });
}
