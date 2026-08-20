import { useMemo } from 'react';
import LAND from '../data/land.json';

/* ------------------------------------------------------------------ *
 * MapField — a real coastline used as a section backdrop.
 *
 * The same land sample that builds the 3D globe, projected flat and
 * clipped to a window around the Gulf, so the section the GIS work
 * sits in is registered against the ground it was actually made for
 * rather than a decorative squiggle.
 * ------------------------------------------------------------------ */

/* A window on the Arabian peninsula and its neighbours: wide enough to
   read as a region, tight enough that the dots are not a world map. */
const VIEW = { lon0: 24, lon1: 68, lat0: 8, lat1: 42 };

const W = 1000;
const H = Math.round((W * (VIEW.lat1 - VIEW.lat0)) / (VIEW.lon1 - VIEW.lon0));

export default function MapField({ className = 'mapfield' }) {
  const dots = useMemo(() => {
    const out = [];
    for (const [lon, lat] of LAND) {
      if (lon < VIEW.lon0 || lon > VIEW.lon1 || lat < VIEW.lat0 || lat > VIEW.lat1) continue;
      const x = ((lon - VIEW.lon0) / (VIEW.lon1 - VIEW.lon0)) * W;
      // y is flipped: latitude climbs north, screen space climbs down
      const y = ((VIEW.lat1 - lat) / (VIEW.lat1 - VIEW.lat0)) * H;
      out.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }
    return out;
  }, []);

  /* The graticule is drawn at whole-degree steps so it reads as a real
     grid of parallels and meridians, not an arbitrary rule pattern. */
  const lines = useMemo(() => {
    const v = [];
    for (let lon = Math.ceil(VIEW.lon0 / 8) * 8; lon <= VIEW.lon1; lon += 8) {
      v.push({ x: ((lon - VIEW.lon0) / (VIEW.lon1 - VIEW.lon0)) * W });
    }
    const h = [];
    for (let lat = Math.ceil(VIEW.lat0 / 8) * 8; lat <= VIEW.lat1; lat += 8) {
      h.push({ y: ((VIEW.lat1 - lat) / (VIEW.lat1 - VIEW.lat0)) * H });
    }
    return { v, h };
  }, []);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g className="mapfield__grat">
        {lines.v.map((l, i) => (
          <line key={`v${i}`} x1={l.x} y1="0" x2={l.x} y2={H} />
        ))}
        {lines.h.map((l, i) => (
          <line key={`h${i}`} x1="0" y1={l.y} x2={W} y2={l.y} />
        ))}
      </g>
      <g className="mapfield__land">
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.1" />
        ))}
      </g>
    </svg>
  );
}
