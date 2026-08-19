import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

/**
 * Files under public/ are copied verbatim by Vite, so viteSingleFile never
 * sees them and they stay as external references. This inlines the ones the
 * page actually points at (./media/…, ./favicon.svg) as data: URIs, and folds
 * public/data/*.json into a global the app reads instead of fetching — which
 * is what makes the result work from file:// with no server at all.
 */
function inlinePublicAssets() {
  return {
    name: 'inline-public-assets',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const publicDir = path.resolve('public');

        // 1 · inline every referenced public file as a data: URI
        html = html.replace(/(["'(])\.\/((?:media|)\/?[^"')]+?\.(?:svg|png|jpe?g|webp|gif))(["')])/g, (m, a, rel, z) => {
          const file = path.join(publicDir, rel);
          if (!fs.existsSync(file)) return m;
          const ext = path.extname(file).toLowerCase();
          const mime = MIME[ext];
          if (!mime) return m;
          const body =
            ext === '.svg'
              ? encodeURIComponent(fs.readFileSync(file, 'utf8')).replace(/'/g, '%27')
              : fs.readFileSync(file).toString('base64');
          const uri = ext === '.svg' ? `data:${mime},${body}` : `data:${mime};base64,${body}`;
          return a + uri + z;
        });

        // 2 · bake the JSON content in, so the runtime fetch is not needed.
        //     Image paths inside the JSON (./media/…) are inlined too, since
        //     nothing else would resolve them once the file stands alone.
        const toDataUri = (rel) => {
          const file = path.join(publicDir, rel.replace(/^\.?\//, ''));
          if (!fs.existsSync(file)) return null;
          const ext = path.extname(file).toLowerCase();
          const mime = MIME[ext];
          if (!mime) return null;
          return ext === '.svg'
            ? `data:${mime},${encodeURIComponent(fs.readFileSync(file, 'utf8')).replace(/'/g, '%27')}`
            : `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
        };
        const inlineDeep = (node) => {
          if (typeof node === 'string') {
            return /^\.?\/(media|)\/?[^/]*\.(svg|png|jpe?g|webp|gif)$/i.test(node)
              ? toDataUri(node) ?? node
              : node;
          }
          if (Array.isArray(node)) return node.map(inlineDeep);
          if (node && typeof node === 'object') {
            return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, inlineDeep(v)]));
          }
          return node;
        };

        const data = {};
        for (const name of ['content', 'site']) {
          const f = path.join(publicDir, 'data', `${name}.json`);
          if (fs.existsSync(f)) data[name] = inlineDeep(JSON.parse(fs.readFileSync(f, 'utf8')));
        }
        // 3 · the CV text the assistant reads — same reason, no fetch
        const cvFile = path.join(publicDir, 'data', 'cv.txt');
        const cv = fs.existsSync(cvFile) ? fs.readFileSync(cvFile, 'utf8') : '';

        const tag =
          `<script>window.__SITE_DATA__=${JSON.stringify(data).replace(/</g, '\\u003c')};` +
          `window.__CV_TEXT__=${JSON.stringify(cv).replace(/</g, '\\u003c')};</script>`;
        return html.replace('</head>', tag + '</head>');
      },
    },
  };
}

/**
 * Builds the whole site into ONE self-contained index.html
 * (`npm run build:single`) — opens straight from disk, no server needed.
 * The normal `npm run build` is what you deploy.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile(), inlinePublicAssets()],
  base: './',
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
  },
});
