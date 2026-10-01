// Live smoke test with one disposable office. Supply a manifest outside the repository.
// Provision with `create`, approve ONLY this office separately, then run `approved`.
// The manifest contains a temporary password; remove it after fixture cleanup.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const [mode, manifest] = process.argv.slice(2);
if (!['create', 'pending', 'approved'].includes(mode) || !manifest) throw new Error('Usage: verify-trial-api.mjs create|pending|approved <temporary-manifest-path>');
const env = Object.fromEntries(fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(line => line.includes('=')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
const base = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
async function request(path, body, token) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json().catch(() => null) };
}
let fixture;
if (mode === 'create') {
  if (fs.existsSync(manifest)) throw new Error('Manifest exists; do not overwrite test identity');
  const id = crypto.randomUUID();
  fixture = { marker: 'TEMP Trial Integration ' + id, phone: '+2499' + Date.now().toString().slice(-8), password: crypto.randomBytes(24).toString('base64url') };
  fs.writeFileSync(manifest, JSON.stringify(fixture), { mode: 0o600 });
  const settings = await request('/auth/v1/settings');
  assert.equal(settings.body.disable_signup, true, 'Public signup must be disabled');
  const invalid = await request('/functions/v1/manage-users', null);
  assert.equal(invalid.status, 400);
  assert.equal((await request('/functions/v1/manage-users', { action: 'review_office_request', office_id: id, approve: true })).status, 401);
  const body = { action: 'request_office', office_name: fixture.marker, admin_name: 'Trial Integration Tester', admin_phone: fixture.phone, admin_password: fixture.password, note: 'Disposable verification fixture; no real client data.' };
  const first = await request('/functions/v1/manage-users', body);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const repeated = await request('/functions/v1/manage-users', body);
  assert.deepEqual(repeated, first, 'Duplicate phone must have the same public response');
  console.log('PASS: signup disabled, malformed/unauthorized requests rejected, duplicate response uniform');
} else fixture = JSON.parse(fs.readFileSync(manifest, 'utf8'));
const login = await request('/auth/v1/token?grant_type=password', { email: 'p' + fixture.phone.slice(1) + '@phone.maktabi.invalid', password: fixture.password });
assert.equal(login.status, 200, 'Fixture login failed');
const token = login.body.access_token;
const access = await request('/rest/v1/rpc/my_access', {}, token);
fixture.userId = login.body.user.id;
fixture.officeId = access.body.office?.id;
assert.ok(fixture.officeId, 'Fixture office missing');
assert.equal(access.body.office.name, fixture.marker);
fs.writeFileSync(manifest, JSON.stringify(fixture), { mode: 0o600 });
if (mode !== 'approved') {
  assert.equal(access.body.office.status, 'pending');
  assert.deepEqual((await request('/rest/v1/clients?select=id', undefined, token)).body, []);
  assert.equal((await request('/rest/v1/rpc/log_login_success', {}, token)).status, 403);
  console.log('PASS: real pending session isolated; login audit denied');
} else {
  assert.equal(access.body.office.status, 'active');
  assert.equal(access.body.role, 'admin');
  const membership = await request('/rest/v1/office_members?select=role,status&user_id=eq.' + fixture.userId, undefined, token);
  assert.deepEqual(membership.body, [{ role: 'admin', status: 'active' }]);
  assert.equal((await request('/rest/v1/rpc/log_login_success', {}, token)).status, 204);
  console.log('PASS: approved session has active office membership and accepted audit');
}
await request('/auth/v1/logout?scope=global', {}, token);
console.log(JSON.stringify({ marker: fixture.marker, officeId: fixture.officeId, userId: fixture.userId }));
