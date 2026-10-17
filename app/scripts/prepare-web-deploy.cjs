// Adds hosting config to the exported web build (dist/) before `vercel deploy`.
// Client-side routes like /note/abc fall back to index.html; real files (JS, wasm, fonts) are served first.
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'dist', 'vercel.json');
fs.writeFileSync(out, JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2));
console.log('wrote', out);
