// Bakes a dotted world-land point cloud (lat/lon) from Natural Earth 110m land data.
import fs from 'node:fs';
import path from 'node:path';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';

const topoPath = path.resolve('node_modules/world-atlas/land-110m.json');
const topo = JSON.parse(fs.readFileSync(topoPath, 'utf8'));
const land = feature(topo, topo.objects.land);

const points = [];
// ~1.05 degree grid, skewed by latitude so density stays even on the sphere
const STEP = 1.05;
for (let lat = -83; lat <= 84; lat += STEP) {
  const ring = Math.max(1, Math.round(360 / (STEP / Math.cos((lat * Math.PI) / 180) || 360)));
  const lonStep = 360 / ring;
  for (let i = 0; i < ring; i++) {
    const lon = -180 + i * lonStep;
    if (geoContains(land, [lon, lat])) points.push([+lon.toFixed(2), +lat.toFixed(2)]);
  }
}

console.log('land points:', points.length);
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/land.json', JSON.stringify(points));
