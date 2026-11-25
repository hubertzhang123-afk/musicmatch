// 生成/写入管理员账号
// 用法：
//   node tools/seed-admin.mjs <email> <password>            → 打印可直接执行的 SQL（线上用）
//   node tools/seed-admin.mjs <email> <password> --local     → 直接写进本地 D1 模拟库
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [, , emailArg, passwordArg, flag] = process.argv;
if (!emailArg || !passwordArg) {
  console.error('用法: node tools/seed-admin.mjs <email> <password> [--local]');
  process.exit(2);
}
const email = emailArg.trim().toLowerCase();
const password = passwordArg;
if (password.length < 8) { console.error('密码至少 8 位'); process.exit(2); }

const ITER = 10000;
async function hash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, key, 256);
  const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  return { salt: hex(salt), hash: `${ITER}$${hex(bits)}` };
}

const { salt, hash: h } = await hash(password);
const id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
const createdAt = Date.now();
const profile = JSON.stringify({ city: '', intro: '' });

const sql = `INSERT INTO users (id, role, name, email, salt, hash, city, profile, created_at)
VALUES ('${id}', 'admin', '站长', '${email}', '${salt}', '${h}', '', '${profile}', ${createdAt})
ON CONFLICT(email) DO UPDATE SET role='admin', salt='${salt}', hash='${h}';`;

if (flag === '--local') {
  const dbPath = path.join(ROOT, '.wrangler', 'state', 'd1-local.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec(`create table if not exists users (
    id text primary key, role text not null, name text not null, email text not null unique,
    salt text not null, hash text not null, city text, profile text not null default '{}',
    created_at integer not null)`);
  db.exec(sql.replace(/ON CONFLICT[\s\S]*$/, 'ON CONFLICT(email) DO UPDATE SET role=\'admin\', salt=\'' + salt + '\', hash=\'' + h + '\''));
  console.log('本地库已写入管理员:', email, '/', password);
  db.close();
} else {
  console.log(sql);
}
