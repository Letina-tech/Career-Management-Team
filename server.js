// Career Management Team: small local server (no dependencies, Node 18+).
// Run:  node server.js        Then open http://localhost:3000
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'cmt-admin';   // editor passcode: CHANGE THIS
const DATA = path.join(__dirname, 'data.json');
const PUB = path.join(__dirname, 'public');
const COLLECTIONS = new Set(['tasks', 'cards', 'users']);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json'};

let db, server_port = PORT;
function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  return out;
}
function save() {
  const text = JSON.stringify(db, null, 1), tmp = DATA + '.tmp';
  try { fs.writeFileSync(tmp, text); fs.renameSync(tmp, DATA); }
  catch (e) { fs.writeFileSync(DATA, text); }   // fallback if the rename is blocked (e.g. antivirus on Windows)
}
function load() {
  try { db = JSON.parse(fs.readFileSync(DATA, 'utf8')); }
  catch {
    db = { tasks: {}, cards: {}, users: {} };
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-tasks.json'), 'utf8'));
    for (const t of seed) { const { id, ...body } = t; db.tasks[id] = body; }
    save();
    console.log('Created data.json with', seed.length, 'starter tasks.');
  }
  for (const c of COLLECTIONS) db[c] = db[c] || {};
}
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function merge(target, patch) {
  for (const k of Object.keys(patch)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (isObj(patch[k]) && isObj(target[k])) merge(target[k], patch[k]); else target[k] = patch[k];
  }
  return target;
}
function isAdmin(req) {
  const given = Buffer.from(String(req.headers['x-admin-key'] || ''));
  const want = Buffer.from(ADMIN_KEY);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}
function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > 262144) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function api(req, res, parts) {
  if (parts[0] === 'health') return send(res, 200, { ok: true, tasks: Object.keys(db.tasks).length, cards: Object.keys(db.cards).length });
  if (parts[0] === 'info') return send(res, 200, {
    node: process.version, folder: __dirname, data: DATA, port: server_port,
    tasks: Object.keys(db.tasks).length, cards: Object.keys(db.cards).length,
    indexExists: fs.existsSync(path.join(PUB, 'index.html')), shimExists: fs.existsSync(path.join(PUB, 'local-shim.js')),
    addresses: lanIPs().map(ip => 'http://' + ip + ':' + server_port)
  });
  if (parts[0] === 'auth') return isAdmin(req) ? send(res, 200, { ok: true }) : send(res, 401, { error: 'wrong passcode' });
  const [col, id] = parts;
  if (!COLLECTIONS.has(col)) return send(res, 404, { error: 'unknown collection' });
  if (req.method === 'GET' && !id) return send(res, 200, Object.entries(db[col]).map(([k, v]) => ({ id: k, data: v })));
  if (!id || !ID_RE.test(id)) return send(res, 400, { error: 'bad id' });

  // Only editors may create, replace or delete tasks. Anyone may update a task (status, ticks).
  const needsAdmin = col === 'tasks' && (req.method === 'PUT' || req.method === 'DELETE');
  if (needsAdmin && !isAdmin(req)) return send(res, 401, { error: 'editor passcode needed' });

  if (req.method === 'PUT') {
    const body = await readBody(req);
    if (!isObj(body)) return send(res, 400, { error: 'object expected' });
    db[col][id] = body; save(); return send(res, 200, { ok: true });
  }
  if (req.method === 'PATCH') {
    const body = await readBody(req);
    if (!db[col][id]) return send(res, 404, { error: 'not found' });
    if (!isObj(body)) return send(res, 400, { error: 'object expected' });
    merge(db[col][id], body); save(); return send(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') { delete db[col][id]; save(); return send(res, 200, { ok: true }); }
  return send(res, 405, { error: 'method not allowed' });
}

function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/check') p = '/check.html';
  const file = path.join(PUB, path.normalize(p));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    let body = buf;
    if (path.extname(file) === '.html' && path.basename(file) !== 'check.html') {   // add the local saving support to the page, even if you edited it
      let t = buf.toString('utf8');
      if (!t.includes('local-shim.js')) {
        const i = t.search(/<script[\s>]/i), tag = '<script src="/local-shim.js"></script>\n';
        t = i >= 0 ? t.slice(0, i) + tag + t.slice(i) : t + tag;
      }
      body = Buffer.from(t, 'utf8');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });
}

async function handler(req, res) {
  try {
    if (req.url.startsWith('/api/')) return await api(req, res, req.url.split('?')[0].slice(5).split('/').filter(Boolean));
    return serveStatic(req, res);
  } catch (e) { send(res, 400, { error: String(e.message || e) }); }
}
process.on('uncaughtException', e => console.error('Unexpected error (the server keeps running):', e.message));

function start(port, triesLeft) {
  const srv = http.createServer(handler);
  srv.once('error', e => {
    if (e.code === 'EADDRINUSE' && triesLeft > 0) {
      console.log('Port ' + port + ' is already in use by another program. Trying ' + (port + 1) + '...');
      start(port + 1, triesLeft - 1);
    } else { console.error('Could not start the server: ' + e.message); process.exit(1); }
  });
  srv.listen(port, '0.0.0.0', () => {
    server_port = port;
    console.log('');
    console.log('  Career Management Team is running.');
    console.log('  OPEN THIS ADDRESS IN YOUR BROWSER:  http://localhost:' + port);
    const ips = lanIPs();
    console.log('  Teammates on your network:          ' + (ips.length ? ips.map(i => 'http://' + i + ':' + port).join('   ') : 'http://<your-computer-ip>:' + port));
    console.log('  Something not working? Open:        http://localhost:' + port + '/check');
    console.log('  Data file: ' + DATA);
    if (ADMIN_KEY === 'cmt-admin') console.log('  WARNING: default editor passcode in use. Set ADMIN_KEY before sharing.');
    console.log('');
  });
}
load();
start(PORT, 10);
