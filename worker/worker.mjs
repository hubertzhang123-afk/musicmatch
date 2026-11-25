// 知音配对 · Cloudflare Worker 版（Workers + D1）
// 三级账号：admin（管理分配）/ teacher（作品集 + 我的学生）/ student（申请表）
// 静态页面由 [assets] 直接发，这个 worker 只处理 /api/*
// 注意：免费档单次请求 CPU 只有 10ms，所以密码用 PBKDF2-10k（不能用 scrypt）

const SESSION_DAYS = 30;
const PBKDF2_ITER = 10000;
const ROLES = ['teacher', 'student'];          // 可自助注册的角色（admin 只能内部创建）
const ALL_ROLES = ['admin', 'teacher', 'student'];
const LEVELS = ['零基础', '入门', '进阶', '高级', '艺考 / 专业'];
const MODES = ['线下', '线上', '线上 + 线下'];

const ERR = {
  role_required: '请选择身份：老师 或 学生',
  name_short: '名字至少 2 个字',
  email_invalid: '邮箱格式不对',
  password_short: '密码至少 8 位',
  email_taken: '这个邮箱已经注册过了',
  bad_credentials: '邮箱或密码不对',
  not_logged_in: '请先登录',
  forbidden: '这个操作你的身份没有权限',
  not_found: '找不到这条记录',
  rate_limited: '操作太频繁了，请稍后再试',
  request_incomplete: '请把乐器、学生姓名、联系方式填完',
  bad_teacher: '选中的不是一位老师',
  no_request: '还没有提交申请表',
  request_exists: '已经提交过了，可以直接修改',
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

const oneOf = (v, l, fallback) => (l.includes(v) ? v : fallback);

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

// ---------------------------------------------------------------- 资料清洗
function cleanProfile(role, p = {}) {
  if (role === 'teacher') {
    return {
      instruments: listOf(p.instruments, 6),
      levels: listOf(p.levels, 5),
      years: num(p.years, 0, 60, 0),
      rate: num(p.rate, 0, 5000, 0),
      mode: oneOf(str(p.mode, 20), MODES, '线上 + 线下'),
      styles: str(p.styles, 120),
      education: str(p.education, 160),
      qualifications: str(p.qualifications, 600),   // 各乐器的资质
      nationality: str(p.nationality, 40),
      languages: listOf(p.languages, 6, 20),
      city: str(p.city, 40),
      intro: str(p.intro, 1200),
    };
  }
  if (role === 'student') {
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
  return { city: str(p.city, 40), intro: str(p.intro, 400) };   // admin：简单资料
}

const rowUser = (r) => ({
  id: r.id, role: r.role, name: r.name, email: r.email,
  salt: r.salt, hash: r.hash, city: r.city || '',
  profile: (() => { try { return JSON.parse(r.profile || '{}'); } catch { return {}; } })(),
  createdAt: Number(r.created_at),
});

const publicProfile = (u) => {
  const p = u.profile || {};
  return { id: u.id, role: u.role, name: u.name, city: u.city || p.city || '', profile: p, createdAt: u.createdAt };
};

const rowReq = (r) => ({
  id: r.id, studentId: r.student_id, instrument: r.instrument || '', times: r.times || '',
  studentName: r.student_name || '', contact: r.contact || '', note: r.note || '',
  status: r.status || 'pending', teacherId: r.teacher_id || null,
  createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
});

// ---------------------------------------------------------------- D1
let schemaReady = null;

function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`create table if not exists users (
        id text primary key, role text not null, name text not null, email text not null unique,
        salt text not null, hash text not null, city text, profile text not null default '{}',
        created_at integer not null)`),
      env.DB.prepare(`create table if not exists requests (
        id text primary key,
        student_id text not null unique,
        instrument text not null default '',
        times text not null default '',
        student_name text not null default '',
        contact text not null default '',
        note text not null default '',
        status text not null default 'pending',
        teacher_id text,
        created_at integer not null,
        updated_at integer not null)`),
      env.DB.prepare('create index if not exists idx_req_status on requests(status)'),
      env.DB.prepare('create index if not exists idx_req_teacher on requests(teacher_id)'),
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

// 限流：每个 isolate 内存计数
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

// ---------------------------------------------------------------- 分配/排序
/**
 * 给一条学生申请排老师：乐器命中 > 同城 > 预算内 > 授课方式一致 > 目前带的少
 * 返回按分数降序的候选列表（管理员用来一键分配）
 */
function rankTeachers(request, teachers, loadByTeacher) {
  const want = (request.instrument || '').toLowerCase();
  return teachers
    .map((t) => {
      const p = t.profile || {};
      const instruments = (p.instruments || []).map((s) => s.toLowerCase());
      const load = loadByTeacher.get(t.id) || 0;
      let score = 0;
      const reasons = [];
      const hit = want && instruments.some((i) => i.includes(want) || want.includes(i));
      if (hit) { score += 100; reasons.push('instrument'); }
      // 城市在 user 表上（注册时填的），不在 profile 里
      const tCity = t.city || p.city || '';
      if (request.city && tCity && request.city.includes(tCity)) { score += 30; reasons.push('city'); }
      if (request.budget && p.rate) {
        if (p.rate <= request.budget) { score += 20; reasons.push('budget'); }
        else score -= 10;
      }
      if (request.mode && p.mode) {
        if (p.mode === request.mode || p.mode === '线上 + 线下') { score += 10; reasons.push('mode'); }
      }
      score += Math.max(0, 5 - load) * 2;
      if (load === 0) reasons.push('free');
      return { teacher: publicProfile(t), score, reasons, load };
    })
    .sort((a, b) => b.score - a.score || a.load - b.load);
}

async function teacherLoad(env) {
  const rows = await all(env, "select teacher_id, count(*) as n from requests where teacher_id is not null group by teacher_id");
  const map = new Map();
  for (const r of rows) map.set(r.teacher_id, Number(r.n));
  return map;
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

  const readJson = async () => {
    try { return await request.json(); } catch { return null; }
  };

  // ---- 健康检查 ----
  if (p === '/health') {
    const users = await all(env, 'select role from users');
    const reqs = await all(env, 'select status, teacher_id from requests');
    return json({
      ok: true,
      storage: 'd1',
      users: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      teachers: users.filter((u) => u.role === 'teacher').length,
      students: users.filter((u) => u.role === 'student').length,
      requests: reqs.length,
      pending: reqs.filter((r) => r.status === 'pending').length,
      assigned: reqs.filter((r) => r.teacher_id).length,
    });
  }

  // ---- 注册（只有老师 / 学生）----
  if (p === '/register' && method === 'POST') {
    if (!rateLimit(request, 'register', 20)) return fail(429, 'rate_limited');
    const body = await readJson();
    if (!body) return json({ error: 'JSON 格式错误' }, 400);

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
    const body = await readJson();
    if (!body) return json({ error: 'JSON 格式错误' }, 400);
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
    const mine = await one(env, 'select * from requests where student_id = ?', user.id);
    let assignment = null;
    if (mine && mine.teacher_id) {
      const t = await one(env, 'select * from users where id = ?', mine.teacher_id);
      if (t) assignment = { ...publicProfile(rowUser(t)), email: t.email };
    }
    const counts = { assignedStudents: 0, pendingRequests: 0 };
    if (user.role === 'teacher') {
      counts.assignedStudents = Number((await one(env, 'select count(*) as n from requests where teacher_id = ?', user.id)).n);
    }
    if (user.role === 'admin') {
      const reqs = await all(env, 'select status from requests');
      counts.pendingRequests = reqs.filter((r) => r.status === 'pending').length;
      counts.totalRequests = reqs.length;
    }
    return json({
      user: { ...publicProfile(user), email: user.email },
      request: mine ? rowReq(mine) : null,
      assignment,
      counts,
    });
  }

  // ---- 改资料 ----
  if (p === '/profile' && method === 'PATCH') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    const body = await readJson();
    if (!body) return json({ error: 'JSON 格式错误' }, 400);

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

  // ---- 浏览（老师看学生 / 学生看老师）----
  if (p === '/browse' && method === 'GET') {
    const user = await currentUser(request, env);
    const want = url.searchParams.get('role');
    const role = oneOf(want, ['teacher', 'student'], user && user.role !== 'admin' ? (user.role === 'teacher' ? 'student' : 'teacher') : 'teacher');
    const needle = str(url.searchParams.get('q') || '', 60).toLowerCase();
    const instrument = str(url.searchParams.get('instrument') || '', 30);
    const city = str(url.searchParams.get('city') || '', 30);
    const mode = str(url.searchParams.get('mode') || '', 20);
    const rateParam = url.searchParams.get('maxRate');
    const maxRate = rateParam === null || rateParam.trim() === '' ? null : num(rateParam, 0, 5000, null);

    const rows = await all(env, 'select * from users where role = ? order by created_at desc', role);
    const items = [];
    for (const r of rows) {
      const u = rowUser(r);
      if (user && u.id === user.id) continue;
      const pub = publicProfile(u);
      const prof = pub.profile || {};
      const hay = [pub.name, pub.city, prof.intro, prof.goal, prof.styles, prof.education, prof.qualifications,
        prof.nationality, (prof.languages || []).join(' '),
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

  // ---- 学生：提交 / 修改申请表 ----
  if (p === '/student/request' && method === 'POST') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    if (user.role !== 'student') return fail(403, 'forbidden');
    if (!rateLimit(request, 'req', 40)) return fail(429, 'rate_limited');
    const body = await readJson();
    if (!body) return json({ error: 'JSON 格式错误' }, 400);

    const instrument = str(body.instrument, 60);
    const studentName = str(body.studentName, 40) || user.name;
    const contact = str(body.contact, 120);
    if (instrument.length < 2 || studentName.length < 2 || contact.length < 3) {
      return fail(400, 'request_incomplete');
    }
    const times = str(body.times, 200);
    const note = str(body.note, 500);
    const exist = await one(env, 'select * from requests where student_id = ?', user.id);
    if (exist) {
      await run(
        env,
        `update requests set instrument = ?, times = ?, student_name = ?, contact = ?, note = ?, updated_at = ?
         where student_id = ?`,
        instrument, times, studentName, contact, note, now(), user.id
      );
      return json({ request: rowReq(await one(env, 'select * from requests where student_id = ?', user.id)) });
    }
    const rec = {
      id: uid(6), studentId: user.id, instrument, times, studentName, contact, note,
      status: 'pending', teacherId: null, createdAt: now(), updatedAt: now(),
    };
    await run(
      env,
      `insert into requests (id, student_id, instrument, times, student_name, contact, note, status, teacher_id, created_at, updated_at)
       values (?,?,?,?,?,?,?,?,?,?,?)`,
      rec.id, rec.studentId, rec.instrument, rec.times, rec.studentName, rec.contact, rec.note,
      rec.status, null, rec.createdAt, rec.updatedAt
    );
    return json({ request: rec }, 201);
  }

  if (p === '/student/request' && method === 'GET') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    if (user.role !== 'student') return fail(403, 'forbidden');
    const row = await one(env, 'select * from requests where student_id = ?', user.id);
    if (!row) return json({ request: null, teacher: null });
    let teacher = null;
    if (row.teacher_id) {
      const t = await one(env, 'select * from users where id = ?', row.teacher_id);
      if (t) teacher = { ...publicProfile(rowUser(t)), email: t.email };
    }
    return json({ request: rowReq(row), teacher });
  }

  // ---- 老师：我分配到的学生 ----
  if (p === '/teacher/students' && method === 'GET') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    if (user.role !== 'teacher') return fail(403, 'forbidden');
    const rows = await all(env, 'select * from requests where teacher_id = ? order by updated_at desc', user.id);
    const students = [];
    for (const r of rows) {
      const u = await one(env, 'select * from users where id = ?', r.student_id);
      students.push({
        ...rowReq(r),
        student: u ? publicProfile(rowUser(u)) : null,
        studentEmail: u ? u.email : null,
      });
    }
    return json({ students });
  }

  // ---- 管理员：总览 ----
  if (p === '/admin/overview' && method === 'GET') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    if (user.role !== 'admin') return fail(403, 'forbidden');
    const users = await all(env, 'select role from users');
    const reqs = await all(env, 'select * from requests');
    const teachers = await all(env, "select id, name from users where role = 'teacher'");
    const load = await teacherLoad(env);
    return json({
      totals: {
        admins: users.filter((u) => u.role === 'admin').length,
        teachers: users.filter((u) => u.role === 'teacher').length,
        students: users.filter((u) => u.role === 'student').length,
        requests: reqs.length,
        pending: reqs.filter((r) => !r.teacher_id).length,
        assigned: reqs.filter((r) => r.teacher_id).length,
      },
      teachers: teachers.map((t) => ({ id: t.id, name: t.name, load: load.get(t.id) || 0 })),
    });
  }

  // ---- 管理员：申请列表（含学生与老师信息）----
  if (p === '/admin/requests' && method === 'GET') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    if (user.role !== 'admin') return fail(403, 'forbidden');
    const rows = await all(env, 'select * from requests order by created_at desc');
    const users = await all(env, 'select * from users');
    const byId = new Map(users.map((u) => [u.id, rowUser(u)]));
    const items = rows.map((r) => {
      const s = byId.get(r.student_id);
      const t = r.teacher_id ? byId.get(r.teacher_id) : null;
      return {
        ...rowReq(r),
        student: s ? { ...publicProfile(s), email: s.email } : null,
        teacher: t ? { ...publicProfile(t), email: t.email } : null,
      };
    });
    return json({ items });
  }

  // ---- 管理员：某条申请的推荐老师（排序）----
  if (p === '/admin/candidates' && method === 'GET') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    if (user.role !== 'admin') return fail(403, 'forbidden');
    const id = str(url.searchParams.get('requestId') || '', 40);
    const row = await one(env, 'select * from requests where id = ?', id);
    if (!row) return fail(404, 'not_found');
    const teachers = (await all(env, "select * from users where role = 'teacher'")).map(rowUser);
    const load = await teacherLoad(env);
    const req = rowReq(row);
    const student = await one(env, 'select * from users where id = ?', row.student_id);
    const sp = student ? rowUser(student).profile || {} : {};
    const shaped = { ...req, city: student ? (student.city || sp.city || '') : '', budget: sp.budget || 0, mode: sp.mode || '' };
    return json({ candidates: rankTeachers(shaped, teachers, load) });
  }

  // ---- 管理员：分配 / 取消分配 ----
  if (p === '/admin/assign' && method === 'POST') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    if (user.role !== 'admin') return fail(403, 'forbidden');
    const body = await readJson();
    if (!body) return json({ error: 'JSON 格式错误' }, 400);
    const requestId = str(body.requestId, 40);
    const teacherId = str(body.teacherId, 40);
    const row = await one(env, 'select * from requests where id = ?', requestId);
    if (!row) return fail(404, 'not_found');
    const t = await one(env, 'select * from users where id = ?', teacherId);
    if (!t || t.role !== 'teacher') return fail(400, 'bad_teacher');
    await run(env, 'update requests set teacher_id = ?, status = ?, updated_at = ? where id = ?',
      t.id, 'assigned', now(), requestId);
    return json({ ok: true, request: rowReq(await one(env, 'select * from requests where id = ?', requestId)) });
  }

  if (p === '/admin/unassign' && method === 'POST') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    if (user.role !== 'admin') return fail(403, 'forbidden');
    const body = await readJson();
    if (!body) return json({ error: 'JSON 格式错误' }, 400);
    const requestId = str(body.requestId, 40);
    const row = await one(env, 'select * from requests where id = ?', requestId);
    if (!row) return fail(404, 'not_found');
    await run(env, "update requests set teacher_id = null, status = 'pending', updated_at = ? where id = ?", now(), requestId);
    return json({ ok: true });
  }

  // ---- 管理员：用户列表（不含密码字段）----
  if (p === '/admin/users' && method === 'GET') {
    const user = await currentUser(request, env);
    if (!user) return fail(401, 'not_logged_in');
    if (user.role !== 'admin') return fail(403, 'forbidden');
    const rows = await all(env, 'select * from users order by created_at desc');
    return json({
      items: rows.map((r) => {
        const u = rowUser(r);
        return { ...publicProfile(u), email: u.email };
      }),
    });
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
