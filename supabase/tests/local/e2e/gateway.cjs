// Local stand-in for the Supabase API gateway, for end-to-end tests only.
// - /rest/v1/*  -> the real PostgREST 12 in front of the replayed database (RLS applies)
// - /auth/v1/*  -> a minimal password sign-in that mints HS256 JWTs PostgREST accepts
// - everything else -> the exported web app (single-page fallback)
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 54321);
const REST = { host: '127.0.0.1', port: Number(process.env.REST_PORT || 54330) };
// Must match jwt-secret in postgrest.conf. A throwaway value for a local test database only.
const SECRET = 'e2e-local-jwt-secret-only-for-this-test-run-0123456789';
const DIST = process.env.DIST;
if (!DIST) throw new Error('Set DIST to the exported web app (npx expo export --platform web --output-dir <DIST>)');
const PASSWORD = 'Maktabi-e2e-pass-1';
const users = {
  'p249900000011@phone.maktabi.invalid': '00000000-0000-4000-8000-000000000011',
  'p249900000012@phone.maktabi.invalid': '00000000-0000-4000-8000-000000000012',
  'p249900000013@phone.maktabi.invalid': '00000000-0000-4000-8000-000000000013',
  'p249900000021@phone.maktabi.invalid': '00000000-0000-4000-8000-000000000021',
};
const refresh = new Map();
const log = [];

const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
function jwt(sub, email) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, session_id: crypto.randomUUID() });
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function session(email) {
  const id = users[email];
  const token = crypto.randomUUID();
  refresh.set(token, email);
  const now = Math.floor(Date.now() / 1000);
  return { access_token: jwt(id, email), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: token,
    user: { id, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: '2026-09-29T00:00:00Z', updated_at: '2026-09-29T00:00:00Z' } };
}
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))); });

async function auth(req, res, url) {
  const body = await readBody(req);
  if (url.pathname === '/auth/v1/token') {
    const data = body.length ? JSON.parse(body.toString()) : {};
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      if (!users[data.email] || data.password !== PASSWORD) return json(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(res, 200, session(data.email));
    }
    if (grant === 'refresh_token' && refresh.has(data.refresh_token)) return json(res, 200, session(refresh.get(data.refresh_token)));
    return json(res, 400, { code: 400, error_code: 'invalid_grant', msg: 'Invalid grant' });
  }
  if (url.pathname === '/auth/v1/logout') { res.writeHead(204); return res.end(); }
  if (url.pathname === '/auth/v1/user') {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    try { const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); return json(res, 200, session(claims.email).user); }
    catch { return json(res, 401, { msg: 'invalid token' }); }
  }
  return json(res, 404, { msg: 'not implemented in e2e gateway' });
}

function rest(req, res, url) {
  const headers = { ...req.headers, host: `${REST.host}:${REST.port}` };
  const upstream = http.request({ ...REST, method: req.method, path: url.pathname.replace(/^\/rest\/v1/, '') + url.search, headers }, (up) => {
    log.push(`${req.method} ${url.pathname}${url.search.slice(0, 120)} -> ${up.statusCode}`);
    res.writeHead(up.statusCode, up.headers); up.pipe(res);
  });
  upstream.on('error', (e) => json(res, 502, { message: String(e) }));
  req.pipe(upstream);
}

const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
function serveApp(res, url) {
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/__log') return json(res, 200, log.splice(0));
  if (url.pathname.startsWith('/rest/v1/')) return rest(req, res, url);
  if (url.pathname.startsWith('/auth/v1/')) return void auth(req, res, url);
  if (url.pathname.startsWith('/functions/v1/')) return json(res, 501, { message: 'functions are not part of this test' });
  serveApp(res, url);
}).listen(PORT, '127.0.0.1', () => console.log(`gateway on http://localhost:${PORT} serving ${DIST}`));
