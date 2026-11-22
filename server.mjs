// 知音配对 · MusicMatch — 零依赖 Node 服务
// 存储：有 DATABASE_URL 走 Postgres，没有就走本地 data/db.json（本地开发用）
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_DAYS = 30;
const USE_PG = !!process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// 存储层：两种实现，对外同一套 async 接口
// ---------------------------------------------------------------------------
const mem = { users: [], requests: [], sessions: {} };
let saveTimer = null;
let saving = Promise.resolve();
let pool = null;

async function loadJson() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(DB_FILE, 'utf8');
    Object.assign(mem, JSON.parse(raw));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[db] 读取失败，使用空库:', e.message);
  }
  mem.users ||= [];
  mem.requests ||= [];
  mem.sessions ||= {};
  const t = Date.now();
  for (const [k, v] of Object.entries(mem.sessions)) if (!v || v.exp < t) delete mem.sessions[k];
}

function saveJson() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const snapshot = JSON.stringify(mem);
    saving = saving
      .then(async () => {
        const tmp = DB_FILE + '.tmp';
        await writeFile(tmp, snapshot, 'utf8');
        await rename(tmp, DB_FILE);
      })
      .catch((e) => console.error('[db] 写入失败:', e.message));
  }, 30);
  return saving;
}

const rowUser = (r) => ({
  id: r.id, role: r.role, name: r.name, email: r.email,
  salt: r.salt, hash: r.hash, city: r.city || '',
  profile: typeof r.profile === 'string' ? JSON.parse(r.profile) : (r.profile || {}),
  createdAt: Number(r.created_at),
});

const rowReq = (r) => ({
  id: r.id, fromId: r.from_id, toId: r.to_id, message: r.message || '',
  status: r.status, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
});

const store = {
  async init() {
    if (!USE_PG) { await loadJson(); return; }
    const { default: pg } = await import('pg');
    const connectionString = process.env.DATABASE_URL;
    const mk = (ssl) => new pg.Pool({ connectionString, ssl, max: 5 });
    // 先按带 SSL 连（Neon / 外部库都要），连不上就退回不带 SSL（Render 内网库）
    let p = mk(process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false });
    try {
      await p.query('select 1');
    } catch (e) {
      if (process.env.PGSSL === 'off') throw e;
      console.warn('[db] 带 SSL 连接失败，改试不带 SSL：', e.message);
      try { await p.end(); } catch {}
      p = mk(false);
      await p.query('select 1');
    }
    pool = p;
    await pool.query(`
      create table if not exists users (
        id text primary key,
        role text not null,
        name text not null,
        email text unique not null,
        salt text not null,
        hash text not null,
        city text,
        profile jsonb not null default '{}'::jsonb,
        created_at bigint not null
      );
      create table if not exists match_requests (
        id text primary key,
        from_id text not null,
        to_id text not null,
        message text not null default '',
        status text not null default 'pending',
        created_at bigint not null,
        updated_at bigint not null
      );
      create index if not exists match_requests_to_idx on match_requests (to_id, status);
      create index if not exists match_requests_from_idx on match_requests (from_id);
      create table if not exists sessions (
        token text primary key,
        user_id text not null,
        exp bigint not null
      );
      create index if not exists sessions_user_idx on sessions (user_id);
    `);
    await pool.query('delete from sessions where exp < $1', [Date.now()]);
  },

  // ---- 用户 ----
  async listUsers() {
    if (USE_PG) return (await pool.query('select * from users order by created_at desc')).rows.map(rowUser);
    return mem.users;
  },
  async getUser(id) {
    if (!id) return null;
    if (USE_PG) return rowUser((await pool.query('select * from users where id = $1', [id])).rows[0] || {});
    return mem.users.find((u) => u.id === id) || null;
  },
  async getUserByEmail(email) {
    if (USE_PG) return rowUser((await pool.query('select * from users where email = $1', [email])).rows[0] || {});
    return mem.users.find((u) => u.email === email) || null;
  },
  async addUser(u) {
    if (USE_PG) {
      await pool.query(
        `insert into users (id, role, name, email, salt, hash, city, profile, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [u.id, u.role, u.name, u.email, u.salt, u.hash, u.city, JSON.stringify(u.profile), u.createdAt]
      );
      return u;
    }
    mem.users.push(u);
    await saveJson();
    return u;
  },
  async updateUser(id, patch) {
    const cur = await this.getUser(id);
    if (!cur || !cur.id) return null;
    const next = { ...cur, ...patch };
    if (USE_PG) {
      await pool.query(
        'update users set name=$2, city=$3, profile=$4 where id=$1',
        [id, next.name, next.city, JSON.stringify(next.profile)]
      );
      return next;
    }
    const item = mem.users.find((u) => u.id === id);
    Object.assign(item, patch);
    await saveJson();
    return item;
  },

  // ---- 配对请求 ----
  async listRequests() {
    if (USE_PG) return (await pool.query('select * from match_requests order by created_at desc')).rows.map(rowReq);
    return mem.requests;
  },
  async getRequest(id) {
    if (!id) return null;
    if (USE_PG) return rowReq((await pool.query('select * from match_requests where id = $1', [id])).rows[0] || {});
    return mem.requests.find((r) => r.id === id) || null;
  },
  async addRequest(r) {
    if (USE_PG) {
      await pool.query(
        `insert into match_requests (id, from_id, to_id, message, status, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [r.id, r.fromId, r.toId, r.message, r.status, r.createdAt, r.updatedAt]
      );
      return r;
    }
    mem.requests.push(r);
    await saveJson();
    return r;
  },
  async setRequestStatus(id, status) {
    const ts = Date.now();
    if (USE_PG) {
      await pool.query('update match_requests set status=$2, updated_at=$3 where id=$1', [id, status, ts]);
      return this.getRequest(id);
    }
    const r = mem.requests.find((x) => x.id === id);
    if (!r) return null;
    r.status = status;
    r.updatedAt = ts;
    await saveJson();
    return r;
  },
  async deleteRequest(id) {
    if (USE_PG) { await pool.query('delete from match_requests where id=$1', [id]); return true; }
    const i = mem.requests.findIndex((r) => r.id === id);
    if (i < 0) return false;
    mem.requests.splice(i, 1);
    await saveJson();
    return true;
  },

  // ---- 会话 ----
  async getSession(token) {
    if (!token) return null;
    if (USE_PG) {
      const r = (await pool.query('select * from sessions where token=$1', [token])).rows[0];
      if (!r) return null;
      if (Number(r.exp) < Date.now()) {
        await pool.query('delete from sessions where token=$1', [token]);
        return null;
      }
      return { userId: r.user_id, exp: Number(r.exp) };
    }
    const s = mem.sessions[token];
    if (!s) return null;
    if (s.exp < Date.now()) { delete mem.sessions[token]; return null; }
    return s;
  },
  async addSession(token, rec) {
    if (USE_PG) {
      await pool.query('insert into sessions (token, user_id, exp) values ($1,$2,$3)', [token, rec.userId, rec.exp]);
      return;
    }
    mem.sessions[token] = rec;
    await saveJson();
  },
  async deleteSession(token) {
    if (USE_PG) { await pool.query('delete from sessions where token=$1', [token]); return; }
    delete mem.sessions[token];
    await saveJson();
  },
};

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
const uid = (n = 12) => crypto.randomBytes(n).toString('base64url').slice(0, n);
const now = () => Date.now();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const calc = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return calc.length === known.length && crypto.timingSafeEqual(calc, known);
}

function str(v, max = 200) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}

function num(v, min, max, fallback = null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function oneOf(v, list_, fallback) {
  return list_.includes(v) ? v : fallback;
}

function list(v, max = 8, itemMax = 30) {
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

// ---------------------------------------------------------------------------
// 输入清洗（按角色）
// ---------------------------------------------------------------------------
const ROLES = ['teacher', 'family'];      // family = 家长 / 学生
const LEVELS = ['零基础', '入门', '进阶', '高级', '艺考 / 专业'];
const MODES = ['线下', '线上', '线上 + 线下'];

function cleanProfile(role, p = {}) {
  if (role === 'teacher') {
    return {
      instruments: list(p.instruments, 6),
      styles: str(p.styles, 120),
      levels: list(p.levels, 5),
      years: num(p.years, 0, 60, 0),
      rate: num(p.rate, 0, 5000, 0),
      mode: oneOf(str(p.mode, 20), MODES, '线上 + 线下'),
      city: str(p.city, 40),
      education: str(p.education, 120),
      intro: str(p.intro, 1200),
    };
  }
  return {
    instruments: list(p.instruments, 6),
    level: oneOf(str(p.level, 20), LEVELS, '零基础'),
    studentAge: str(p.studentAge, 40),
    goal: str(p.goal, 160),
    budget: num(p.budget, 0, 5000, 0),
    mode: oneOf(str(p.mode, 20), MODES, '线上 + 线下'),
    city: str(p.city, 40),
    intro: str(p.intro, 1200),
  };
}

function publicProfile(u) {
  const p = u.profile || {};
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    city: u.city || p.city || '',
    profile: p,
    createdAt: u.createdAt,
  };
}

// ---------------------------------------------------------------------------
// HTTP 辅助
// ---------------------------------------------------------------------------
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

// 错误码 → 中文默认文案（前端按 code 翻译成英文，不认 code 才回落到这里）
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

function fail(res, status, code) {
  return sendJson(res, status, { error: ERR[code] || code, code });
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON 格式错误'));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
}

function setSessionCookie(req, res, token) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
  const parts = [
    `mm_sid=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_DAYS * 24 * 3600}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'mm_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

async function currentUser(req) {
  const token = parseCookies(req).mm_sid;
  if (!token) return null;
  const sess = await store.getSession(token);
  if (!sess) return null;
  const user = await store.getUser(sess.userId);
  return user && user.id ? user : null;
}

// 简单限流：每个 IP 每 10 分钟最多 N 次敏感调用
const buckets = new Map();
function rateLimit(req, res, key, max = 30, windowMs = 10 * 60 * 1000) {
  const k = key + ':' + clientIp(req);
  const t = now();
  const rec = buckets.get(k) || { t, n: 0 };
  if (t - rec.t > windowMs) { rec.t = t; rec.n = 0; }
  rec.n++;
  buckets.set(k, rec);
  if (rec.n > max) {
    fail(res, 429, 'rate_limited');
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 配对关系
// ---------------------------------------------------------------------------
async function requestsBetween(aId, bId, all) {
  const list_ = all || (await store.listRequests());
  return list_.filter((r) => (r.fromId === aId && r.toId === bId) || (r.fromId === bId && r.toId === aId));
}

async function matchState(userId, otherId, all) {
  const rs = await requestsBetween(userId, otherId, all);
  if (rs.some((r) => r.status === 'accepted')) return 'accepted';
  if (rs.some((r) => r.status === 'pending')) return 'pending';
  if (rs.length) return 'declined';
  return 'none';
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
async function handleApi(req, res, url) {
  const p = url.pathname.replace(/^\/api/, '') || '/';
  const method = req.method;

  // ---- 健康检查 ----
  if (p === '/health') {
    const users = await store.listUsers();
    const reqs = await store.listRequests();
    return sendJson(res, 200, {
      ok: true,
      storage: USE_PG ? 'postgres' : 'json',
      users: users.length,
      teachers: users.filter((u) => u.role === 'teacher').length,
      families: users.filter((u) => u.role === 'family').length,
      accepted: reqs.filter((r) => r.status === 'accepted').length,
    });
  }

  // ---- 注册 ----
  if (p === '/register' && method === 'POST') {
    if (!rateLimit(req, res, 'register', 20)) return;
    const body = await readBody(req);
    const role = oneOf(str(body.role, 10), ROLES, '');
    if (!role) return fail(res, 400, 'role_required');

    const name = str(body.name, 40);
    const email = str(body.email, 120).toLowerCase();
    const password = String(body.password ?? '');
    if (name.length < 2) return fail(res, 400, 'name_short');
    if (!EMAIL_RE.test(email)) return fail(res, 400, 'email_invalid');
    if (password.length < 8) return fail(res, 400, 'password_short');
    if (await store.getUserByEmail(email)) return fail(res, 409, 'email_taken');

    const { salt, hash } = hashPassword(password);
    const profile = cleanProfile(role, body.profile || {});
    const user = {
      id: uid(10), role, name, email, salt, hash,
      city: str(body.city, 40) || profile.city || '',
      profile, createdAt: now(),
    };
    await store.addUser(user);

    const token = uid(32);
    await store.addSession(token, { userId: user.id, exp: now() + SESSION_DAYS * 86400000 });
    setSessionCookie(req, res, token);
    return sendJson(res, 201, { user: publicProfile(user) });
  }

  // ---- 登录 ----
  if (p === '/login' && method === 'POST') {
    if (!rateLimit(req, res, 'login', 40)) return;
    const body = await readBody(req);
    const email = str(body.email, 120).toLowerCase();
    const password = String(body.password ?? '');
    const user = await store.getUserByEmail(email);
    if (!user || !user.hash || !verifyPassword(password, user.salt, user.hash)) {
      return fail(res, 401, 'bad_credentials');
    }
    const token = uid(32);
    await store.addSession(token, { userId: user.id, exp: now() + SESSION_DAYS * 86400000 });
    setSessionCookie(req, res, token);
    return sendJson(res, 200, { user: publicProfile(user) });
  }

  // ---- 登出 ----
  if (p === '/logout' && method === 'POST') {
    const token = parseCookies(req).mm_sid;
    if (token) await store.deleteSession(token);
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  // ---- 我是谁 ----
  if (p === '/me' && method === 'GET') {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, 'not_logged_in');
    const reqs = await store.listRequests();
    const incoming = reqs.filter((r) => r.toId === user.id && r.status === 'pending').length;
    const accepted = reqs.filter((r) => r.status === 'accepted' && (r.toId === user.id || r.fromId === user.id)).length;
    return sendJson(res, 200, {
      user: { ...publicProfile(user), email: user.email },
      stats: { incoming, accepted },
    });
  }

  // ---- 改资料 ----
  if (p === '/profile' && method === 'PATCH') {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, 'not_logged_in');
    const body = await readBody(req);
    const patch = {};
    if (body.name !== undefined) {
      const name = str(body.name, 40);
      if (name.length < 2) return fail(res, 400, 'name_short');
      patch.name = name;
    }
    if (body.city !== undefined) patch.city = str(body.city, 40);
    if (body.profile !== undefined) {
      patch.profile = cleanProfile(user.role, body.profile);
      if (!patch.city) patch.city = user.city || patch.profile.city || '';
    }
    const updated = await store.updateUser(user.id, patch);
    return sendJson(res, 200, { user: { ...publicProfile(updated), email: updated.email } });
  }

  // ---- 浏览 ----
  if (p === '/browse' && method === 'GET') {
    const user = await currentUser(req);
    const want = url.searchParams.get('role');
    const role = oneOf(want, ROLES, user ? (user.role === 'teacher' ? 'family' : 'teacher') : 'teacher');
    const needle = str(url.searchParams.get('q') || '', 60).toLowerCase();
    const instrument = str(url.searchParams.get('instrument') || '', 30);
    const city = str(url.searchParams.get('city') || '', 30);
    const mode = str(url.searchParams.get('mode') || '', 20);
    // 注意：没传参数时 Number(null) === 0，必须先判断参数是否存在
    const rateParam = url.searchParams.get('maxRate');
    const maxRate = rateParam === null || rateParam.trim() === '' ? null : num(rateParam, 0, 5000, null);
    const myReqs = user ? await store.listRequests() : [];

    const all = (await store.listUsers()).filter((u) => u.role === role && (!user || u.id !== user.id));
    const items = [];
    for (const u of all) {
      const pub = publicProfile(u);
      if (user) {
        pub.matchState = await matchState(user.id, u.id, myReqs);
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

    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return sendJson(res, 200, { role, items, total: items.length });
  }

  // ---- 发起配对 ----
  if (p === '/requests' && method === 'POST') {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, 'not_logged_in');
    if (!rateLimit(req, res, 'match', 60)) return;
    const body = await readBody(req);
    const toId = str(body.toUserId, 30);
    const target = await store.getUser(toId);
    if (!target || !target.id) return fail(res, 404, 'not_found');
    if (target.id === user.id) return fail(res, 400, 'self_match');
    if (target.role === user.role) return fail(res, 400, 'role_mismatch');
    const state = await matchState(user.id, target.id);
    if (state === 'accepted') return fail(res, 409, 'already_matched');
    if (state === 'pending') return fail(res, 409, 'already_pending');

    const request = {
      id: uid(8), fromId: user.id, toId: target.id,
      message: str(body.message, 500), status: 'pending',
      createdAt: now(), updatedAt: now(),
    };
    await store.addRequest(request);
    return sendJson(res, 201, { request });
  }

  // ---- 我的配对 ----
  if (p === '/requests' && method === 'GET') {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, 'not_logged_in');
    const all = await store.listRequests();
    const users = await store.listUsers();
    const byId = new Map(users.map((u) => [u.id, u]));
    const decorate = (r, otherId) => {
      const other = byId.get(otherId);
      return {
        ...r,
        peer: other ? publicProfile(other) : { id: otherId, name: '（已注销）', profile: {} },
        peerEmail: r.status === 'accepted' && other ? other.email : null,
      };
    };
    const incoming = all.filter((r) => r.toId === user.id).map((r) => decorate(r, r.fromId));
    const outgoing = all.filter((r) => r.fromId === user.id).map((r) => decorate(r, r.toId));
    incoming.sort((a, b) => b.createdAt - a.createdAt);
    outgoing.sort((a, b) => b.createdAt - a.createdAt);
    return sendJson(res, 200, { incoming, outgoing });
  }

  // ---- 回复配对 ----
  const m = p.match(/^\/requests\/([\w-]{4,40})\/(accept|decline)$/);
  if (m && method === 'POST') {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, 'not_logged_in');
    const r = await store.getRequest(m[1]);
    if (!r || !r.id) return fail(res, 404, 'not_found');
    if (r.toId !== user.id) return fail(res, 403, 'not_recipient');
    if (r.status !== 'pending') return fail(res, 409, 'already_handled');
    const updated = await store.setRequestStatus(r.id, m[2] === 'accept' ? 'accepted' : 'declined');
    return sendJson(res, 200, { request: updated });
  }

  // ---- 撤销自己发出的请求 ----
  const dm = p.match(/^\/requests\/([\w-]{4,40})$/);
  if (dm && method === 'DELETE') {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, 'not_logged_in');
    const r = await store.getRequest(dm[1]);
    if (!r || r.fromId !== user.id) return fail(res, 404, 'not_found');
    await store.deleteRequest(r.id);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'API 不存在: ' + p });
}

// ---------------------------------------------------------------------------
// 静态文件
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel.includes('..')) { res.writeHead(400); return res.end('Bad path'); }
  const file = path.join(PUBLIC_DIR, rel);
  if (!path.normalize(file).startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    const buf = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': buf.length,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(buf);
  } catch {
    try {
      const buf = await readFile(path.join(PUBLIC_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
      res.end(buf);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}

// ---------------------------------------------------------------------------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': url.origin,
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
      });
      return res.end();
    }
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (e) {
    console.error('[err]', req.method, url.pathname, e.message);
    if (!res.headersSent) sendJson(res, 500, { error: e.message || '服务出错了' });
    else res.end();
  }
});

await store.init();
server.listen(PORT, HOST, () => {
  console.log(`知音配对已启动  http://localhost:${PORT}`);
  console.log(`存储：${USE_PG ? 'Postgres（DATABASE_URL）' : '本地 JSON ' + DB_FILE}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    try { await saving; } catch {}
    if (pool) { try { await pool.end(); } catch {} }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500);
  });
}
