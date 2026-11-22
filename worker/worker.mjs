// 知音配对 · Cloudflare Worker 版（Workers + D1）
// 静态页面由 [assets] 直接发，这个 worker 只处理 /api/*
// 注意：免费档单次请求 CPU 只有 10ms，所以密码用 PBKDF2-10k（不能用 scrypt）

const SESSION_DAYS = 30;
const PBKDF2_ITER = 10000;
const ROLES = ['teacher', 'family'];
const LEVELS = ['零基础', '入门', '进阶', '高级', '艺考 / 专业'];
const MODES = ['线下', '线上', '线上 + 线下'];

const ERR = {
  role_required: '请选择身份：老师 或 家长/学生',
  name_short: '名字至少 2 个字',
  email_invalid: '邮箱格式不对',
  password_short: '密码至少 8 位',
  email_taken: '这个邮箱已经注册过了',
  bad_credentials: '邮箱或密码不对',
  not_logged_in: '请先登录',
  role_mismatch: '需要一位老师 + 一位家长/学生 才能配对',
  self_match: '不能和自己配对',
  already_matched: '你们已经配上了',
  already_pending: '已经有一条待回复的请求了',
  not_found: '找不到这条记录',
  not_recipient: '只有收到邀请的一方能回复',
  already_handled: '这条请求已经处理过了',
  rate_limited: '操作太频繁了，请稍后再试',
};

// ---------------------------------------------------------------- 基础工具
const enc = new TextEncoder();

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

const fail = (status, code) => json({ error: ERR[code] || code, code }, status);

function str(v, max = 200) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}

function num(v, min, max, fallback = null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

function listOf(v, max = 8, itemMax = 30) {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : String(v).split(/[,，、/|;；]/);
  const out = [];
  for (const item of arr) {
    const s = str(item, itemMax);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const now = () => Date.now();

function uid(bytes = 12) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, bytes * 2);
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => new Uint8Array(s.match(/.{2}/g).map((h) => parseInt(h, 16)));

async function pbkdf2(password, saltBytes, iterations = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' }, key, 256
  );
  return hex(bits);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return { salt: hex(salt), hash: `${PBKDF2_ITER}$${hash}` };
}

async function verifyPassword(password, saltHex, stored) {
  const [iterStr, hash] = String(stored).split('$');
  const iterations = Number(iterStr) || PBKDF2_ITER;
  const calc = await pbkdf2(password, unhex(saltHex), iterations);
  if (calc.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < calc.length; i++) diff |= calc.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------- 输入清洗
function cleanProfile(role, p = {}) {
  if (role === 'teacher') {
    return {
      instruments: listOf(p.instruments, 6),
      styles: str(p.styles, 120),
      levels: listOf(p.levels, 5),
      years: num(p.years, 0, 60, 0),
      rate: num(p.rate, 0, 5000, 0),
      mode: oneOf(str(p.mode, 20), MODES, '线上 + 线下'),
      city: str(p.city, 40),
      education: str(p.education, 120),
      intro: str(p.intro, 1200),
    };
  }
  return {
    instruments: listOf(p.instruments, 6),
    level: oneOf(str(p.level, 20), LEVELS, '零基础'),
    studentAge: str(p.studentAge, 40),
    goal: str(p.goal, 160),
    budget: num(p.budget, 0, 5000, 0),
    mode: oneOf(str(p.mode, 20), MODES, '线上 + 线下'),
    city: str(p.city, 40),
    intro: str(p.intro, 1200),
  };
}

const rowUser = (r) => ({
  id: r.id, role: r.role, name: r.name, email: r.email,
  salt: r.salt, hash: r.hash, city: r.city || '',
  profile: (() => { try { return JSON.parse(r.profile || '{}'); } catch { return {}; } })(),
  createdAt: Number(r.created_at),
});

const rowReq = (r) => ({
  id: r.id, fromId: r.from_id, toId: r.to_id, message: r.message || '',
  status: r.status, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
});

const publicProfile = (u) => {
  const p = u.profile || {};
  return { id: u.id, role: u.role, name: u.name, city: u.city || p.city || '', profile: p, createdAt: u.createdAt };
};

// ---------------------------------------------------------------- D1
let schemaReady = null;

function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`create table if not exists users (
        id text primary key, role text not null, name text not null, email text not null unique,
        salt text not null, hash text not null, city text, profile text not null default '{}',
        created_at integer not null)`),
      env.DB.prepare(`create table if not exists match_requests (
        id text primary key, from_id text not null, to_id text not null, message text not null default '',
        status text not null default 'pending', created_at integer not null, updated_at integer not null)`),
      env.DB.prepare('create index if not exists idx_req_to on match_requests(to_id, status)'),
      env.DB.prepare('create index if not exists idx_req_from on match_requests(from_id)'),
      env.DB.prepare(`create table if not exists sessions (
        token text primary key, user_id text not null, exp integer not null)`),
      env.DB.prepare('create index if not exists idx_sess_user on sessions(user_id)'),
    ]).catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

const one = async (env, sql, ...args) => env.DB.prepare(sql).bind(...args).first();
const all = async (env, sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results || [];
const run = async (env, sql, ...args) => env.DB.prepare(sql).bind(...args).run();

// ---------------------------------------------------------------- 会话
function parseCookies(request) {
  const out = {};
  const raw = request.headers.get('cookie');
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(token, secure = true) {
  return `mm_sid=${token}; Path=/; HttpOnly; SameSite=Lax;${secure ? ' Secure;' : ''} Max-Age=${SESSION_DAYS * 24 * 3600}`;
}
function clearCookieFor(secure = true) {
  return `mm_sid=; Path=/; HttpOnly; SameSite=Lax;${secure ? ' Secure;' : ''} Max-Age=0`;
}
const isHttps = (request) => new URL(request.url).protocol === 'https:';

async function currentUser(request, env) {
  const token = parseCookies(request).mm_sid;
  if (!token) return null;
  const s = await one(env, 'select * from sessions where token = ?', token);
  if (!s) return null;
  if (Number(s.exp) < now()) {
    await run(env, 'delete from sessions where token = ?', token);
    return null;
  }
  const u = await one(env, 'select * from users where id = ?', s.user_id);
  return u ? rowUser(u) : null;
}

// 限流：每个 isolate 内存计数（够挡住手滑，不保证跨节点）
const buckets = new Map();
function rateLimit(request, key, max = 30, windowMs = 10 * 60 * 1000) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const k = `${key}:${ip}`;
  const t = now();
  const rec = buckets.get(k) || { t, n: 0 };
  if (t - rec.t > windowMs) { rec.t = t; rec.n = 0; }
  rec.n++;
  buckets.set(k, rec);
  return rec.n <= max;
}

// ---------------------------------------------------------------- 配对关系
async function listRequests(env) {
  return (await all(env, 'select * from match_requests order by created_at desc')).map(rowReq);
}

async function matchState(env, aId, bId, cache) {
  const rows = cache || (await listRequests(env));
  const rel = rows.filter((r) => (r.fromId === aId && r.toId === bId) || (r.fromId === bId && r.toId === aId));
  if (rel.some((r) => r.status === 'accepted')) return 'accepted';
  if (rel.some((r) => r.status === 'pending')) return 'pending';
  return rel.length ? 'declined' : 'none';
}

// ---------------------------------------------------------------- API
export async function handleApi(request, env, url) {
  await ensureSchema(env);
  const p = url.pathname.replace(/^\/api/, '') || '/';
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': url.origin,
        'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-credentials': 'true',
      },
    });
  }

  // ---- 健康检查 ----
  if (p === '/health') {
    const users = await all(env, 'select role from users');
    const reqs = await all(env, 'select status from match_requests');
    return json({
      ok: true,
      storage: 'd1',
      users: users.length,
      teachers: users.filter((u) => u.role === 'teacher').length,
      families: users.filter((u) => u.role === 'family').length,
      accepted: reqs.filter((r) => r.status === 'accepted').length,
    });
  }

  // ---- 注册 ----
  if (p === '/register' && method === 'POST') {
    if (!rateLimit(request, 'register', 20)) return fail(429, 'rate_limited');
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON 格式错误' }, 400); }

    const role = oneOf(str(body.role, 10), ROLES, '');
    if (!role) return fail(400, 'role_required');
    const name = str(body.name, 40);
    const email = str(body.email, 120).toLowerCase();
    const password = String(body.password ?? '');
    if (name.length < 2) return fail(400, 'name_short');
    if (!EMAIL_RE.test(email)) return fail(400, 'email_invalid');
    if (password.length < 8) return fail(400, 'password_short');
    if (await one(env, 'select id from users where email = ?', email)) return fail(409, 'email_taken');

    const { salt, hash } = await hashPassword(password);
    const profile = cleanProfile(role, body.profile || {});
    const id = uid(8);
    const createdAt = now();
    const city = str(body.city, 40) || profile.city || '';
    await run(
      env,
      `insert into users (id, role, name, email, salt, hash, city, profile, created_at)
       values (?,?,?,?,?,?,?,?,?)`,
      id, role, name, email, salt, hash, city, JSON.stringify(profile), createdAt
    );

    const token = uid(24);
    await run(env, 'insert into sessions (token, user_id, exp) values (?,?,?)',
      token, id, createdAt + SESSION_DAYS * 86400000);

    return json(
      { user: publicProfile({ id, role, name, city, profile, createdAt }) },
      201,
      { 'set-cookie': sessionCookie(token, isHttps(request)) }
    );
  }

  // ---- 登录 ----
  if (p === '/login' && method === 'POST') {
    if (!rateLimit(request, 'login', 40)) return fail(429, 'rate_limited');
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON 格式错误' }, 400); }
    const email = str(body.email, 120).toLowerCase();
    const password = String(body.password ?? '');
    const row = await one(env, 'select * from users where email = ?', email);
    if (!row || !(await verifyPassword(password, row.salt, row.hash))) {
      return fail(401, 'bad_credentials');
    }
    const token = uid(24);
    await run(env, 'insert into sessions (token, user_id, exp) values (?,?,?)',
      token, row.id, now() + SESSION_DAYS * 86400000);
    return json({ user: publicProfile(rowUser(row)) }, 200, { 'set-cookie': sessionCookie(token, isHttps(request)) });
  }

  // ---- 登出 ----
  if (p === '/logout' && method === 'POST') {
    const token = parseCookies(request).mm_sid;
    if (token) await run(env, 'delete from sessions where token = ?', token);
    return json({ ok: true }, 200, { 'set-cookie': clearCookieFor(isHttps(request)) });
  }

  // ---- 我是谁 ----
  if (p === '/me' && method === 'GET') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    const reqs = await listRequests(env);
    return json({
      user: { ...publicProfile(user), email: user.email },
      stats: {
        incoming: reqs.filter((r) => r.toId === user.id && r.status === 'pending').length,
        accepted: reqs.filter((r) => r.status === 'accepted' && (r.toId === user.id || r.fromId === user.id)).length,
      },
    });
  }

  // ---- 改资料 ----
  if (p === '/profile' && method === 'PATCH') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON 格式错误' }, 400); }

    let name = user.name;
    let city = user.city;
    let profile = user.profile;
    if (body.name !== undefined) {
      name = str(body.name, 40);
      if (name.length < 2) return fail(400, 'name_short');
    }
    if (body.city !== undefined) city = str(body.city, 40);
    if (body.profile !== undefined) {
      profile = cleanProfile(user.role, body.profile);
      if (!city) city = profile.city || '';
    }
    await run(env, 'update users set name = ?, city = ?, profile = ? where id = ?',
      name, city, JSON.stringify(profile), user.id);
    return json({ user: { ...publicProfile({ ...user, name, city, profile }), email: user.email } });
  }

  // ---- 浏览 ----
  if (p === '/browse' && method === 'GET') {
    const user = await currentUser(request, env);
    const want = url.searchParams.get('role');
    const role = oneOf(want, ROLES, user ? (user.role === 'teacher' ? 'family' : 'teacher') : 'teacher');
    const needle = str(url.searchParams.get('q') || '', 60).toLowerCase();
    const instrument = str(url.searchParams.get('instrument') || '', 30);
    const city = str(url.searchParams.get('city') || '', 30);
    const mode = str(url.searchParams.get('mode') || '', 20);
    const rateParam = url.searchParams.get('maxRate');
    const maxRate = rateParam === null || rateParam.trim() === '' ? null : num(rateParam, 0, 5000, null);

    const myReqs = user ? await listRequests(env) : [];
    const rows = await all(env, 'select * from users where role = ? order by created_at desc', role);
    const items = [];
    for (const r of rows) {
      const u = rowUser(r);
      if (user && u.id === user.id) continue;
      const pub = publicProfile(u);
      if (user) {
        pub.matchState = await matchState(env, user.id, u.id, myReqs);
        if (pub.matchState === 'accepted') pub.email = u.email;
      } else {
        pub.matchState = 'none';
      }
      const prof = pub.profile || {};
      const hay = [pub.name, pub.city, prof.intro, prof.goal, prof.styles, prof.education,
        (prof.instruments || []).join(' '), (prof.levels || []).join(' '), prof.level, prof.studentAge]
        .filter(Boolean).join(' ').toLowerCase();
      if (needle && !hay.includes(needle)) continue;
      if (instrument && !(prof.instruments || []).some((i) => i.toLowerCase().includes(instrument.toLowerCase()))) continue;
      if (city && !(pub.city || '').includes(city)) continue;
      if (mode && prof.mode && prof.mode !== mode) continue;
      if (maxRate != null && role === 'teacher' && (prof.rate || 0) > maxRate) continue;
      items.push(pub);
    }
    return json({ role, items, total: items.length });
  }

  // ---- 发起配对 ----
  if (p === '/requests' && method === 'POST') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    if (!rateLimit(request, 'match', 60)) return fail(429, 'rate_limited');
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON 格式错误' }, 400); }

    const toId = str(body.toUserId, 30);
    const targetRow = await one(env, 'select * from users where id = ?', toId);
    if (!targetRow) return fail(404, 'not_found');
    const target = rowUser(targetRow);
    if (target.id === user.id) return fail(400, 'self_match');
    if (target.role === user.role) return fail(400, 'role_mismatch');

    const state = await matchState(env, user.id, target.id);
    if (state === 'accepted') return fail(409, 'already_matched');
    if (state === 'pending') return fail(409, 'already_pending');

    const req = {
      id: uid(6), fromId: user.id, toId: target.id,
      message: str(body.message, 500), status: 'pending',
      createdAt: now(), updatedAt: now(),
    };
    await run(
      env,
      `insert into match_requests (id, from_id, to_id, message, status, created_at, updated_at)
       values (?,?,?,?,?,?,?)`,
      req.id, req.fromId, req.toId, req.message, req.status, req.createdAt, req.updatedAt
    );
    return json({ request: req }, 201);
  }

  // ---- 我的配对 ----
  if (p === '/requests' && method === 'GET') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    const reqs = await listRequests(env);
    const users = await all(env, 'select * from users');
    const byId = new Map(users.map((u) => [u.id, rowUser(u)]));
    const decorate = (r, otherId) => {
      const other = byId.get(otherId);
      return {
        ...r,
        peer: other ? publicProfile(other) : { id: otherId, name: '（已注销）', profile: {} },
        peerEmail: r.status === 'accepted' && other ? other.email : null,
      };
    };
    const incoming = reqs.filter((r) => r.toId === user.id).map((r) => decorate(r, r.fromId));
    const outgoing = reqs.filter((r) => r.fromId === user.id).map((r) => decorate(r, r.toId));
    return json({ incoming, outgoing });
  }

  // ---- 回复配对 ----
  const m = p.match(/^\/requests\/([\w-]{4,40})\/(accept|decline)$/);
  if (m && method === 'POST') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    const row = await one(env, 'select * from match_requests where id = ?', m[1]);
    if (!row) return fail(404, 'not_found');
    const r = rowReq(row);
    if (r.toId !== user.id) return fail(403, 'not_recipient');
    if (r.status !== 'pending') return fail(409, 'already_handled');
    const status = m[2] === 'accept' ? 'accepted' : 'declined';
    await run(env, 'update match_requests set status = ?, updated_at = ? where id = ?', status, now(), r.id);
    return json({ request: { ...r, status } });
  }

  // ---- 撤销 ----
  const dm = p.match(/^\/requests\/([\w-]{4,40})$/);
  if (dm && method === 'DELETE') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    const row = await one(env, 'select * from match_requests where id = ?', dm[1]);
    if (!row) return fail(404, 'not_found');
    const r = rowReq(row);
    if (r.fromId !== user.id) return fail(404, 'not_found');
    await run(env, 'delete from match_requests where id = ?', r.id);
    return json({ ok: true });
  }

  return json({ error: 'API 不存在: ' + p }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      return new Response('Not found', { status: 404 });
    } catch (e) {
      console.error('[err]', request.method, url.pathname, e?.stack || e);
      return json({ error: e?.message || '服务出错了' }, 500);
    }
  },
};
