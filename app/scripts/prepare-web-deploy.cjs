// Prepares the exported web build (dist/) for `vercel deploy`:
// 1. The Vercel CLI never uploads folders named `node_modules`, but Expo exports fonts/icons to
//    dist/assets/node_modules/... — so move them to dist/assets/_nm/ and rewrite the references in the JS.
// 2. Client-side routes like /note/abc fall back to index.html (real files are served first).
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const from = path.join(dist, 'assets', 'node_modules');
const to = path.join(dist, 'assets', '_nm');

if (fs.existsSync(from)) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
  let files = 0;
  let refs = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(js|html|css|json)$/.test(entry.name)) {
        const src = fs.readFileSync(p, 'utf8');
        const n = src.split('/assets/node_modules/').length - 1;
        if (n) {
          fs.writeFileSync(p, src.split('/assets/node_modules/').join('/assets/_nm/'));
          files++;
          refs += n;
        }
      }
    }
  };
  walk(dist);
  console.log(`moved assets/node_modules -> assets/_nm (${refs} references in ${files} files)`);
}

fs.writeFileSync(path.join(dist, 'vercel.json'), JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2));
console.log('wrote dist/vercel.json');
