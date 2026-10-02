import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const publicPath = path.join(root, 'public');
const read = name => fs.readFileSync(path.join(publicPath, name), 'utf8');
const worklet = `${read('assets/audio-utils.js').replace(/^export /gm, '')}\n${read('assets/mic-worklet.js').replace(/^import .*\n/, '')}`;
const bundle = await build({ entryPoints: [path.join(publicPath, 'assets/app.js')], bundle: true, format: 'iife', target: ['es2022'], write: false, minify: false,
  define: { 'import.meta.url': 'document.baseURI' } });
const iconURL = 'data:image/svg+xml;base64,' + Buffer.from(read('assets/icon.svg')).toString('base64');
const bootstrap = `globalThis.__ORDELY_PHONE__ = true;\nglobalThis.__ORDELY_SEED__ = ${read('demo-data.json')};\nglobalThis.__ORDELY_WORKLET_URL__ = URL.createObjectURL(new Blob([${JSON.stringify(worklet)}], {type: 'application/javascript'}));\n`;
let html = read('index.html').replace(/<link rel="manifest"[^>]*>\s*/, '')
  .replace('<link rel="stylesheet" href="./assets/styles.css">', `<style>${read('assets/styles.css')}</style>`)
  .replaceAll('./assets/icon.svg', iconURL)
  .replace('<script type="module" src="./assets/app.js"></script>', `<script>\n${(bootstrap + bundle.outputFiles[0].text).replace(/<\/script/gi, '<\\/script')}\n</script>`);
const destination = path.join(root, 'telephone');
fs.mkdirSync(destination, { recursive: true }); fs.writeFileSync(path.join(destination, 'index.html'), html);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`Version téléphone autonome créée : index.html et telephone/index.html (${Math.ceil(Buffer.byteLength(html) / 1024)} Ko).`);
