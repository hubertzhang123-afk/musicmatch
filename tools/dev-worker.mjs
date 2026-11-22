// 本地跑 worker 本体：用 node:sqlite 模拟 D1，用 node:http 模拟 Cloudflare 的 Request/Response
// 用法：node tools/dev-worker.mjs [port]
// 目的：不改一行生产代码，就能在本地验证 worker/worker.mjs 的完整行为
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../worker/worker.mjs';

const PORT = Number(process.argv[2] || 8788);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, '.wrangler', 'state');
mkdirSync(DATA, { recursive: true });

const sqlite = new DatabaseSync(path.join(DATA, 'd1-local.sqlite'));

// ---------------- D1 兼容层 ----------------
class Stmt {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.sql, args.map((a) => (a === undefined ? null : a))); }
  async first() {
    const row = sqlite.prepare(this.sql).get(...this.args);
    return row === undefined ? null : row;
  }
  async all() {
    return { results: sqlite.prepare(this.sql).all(...this.args) };
  }
  async run() {
    const info = sqlite.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: info.changes } };
  }
}

class D1 {
  prepare(sql) { return new Stmt(sql); }
  async batch(stmts) {
    const out = [];
    for (const s of stmts) out.push(await s.run());
    return out;
  }
}

const env = { DB: new D1() };

// ---------------- 请求/响应桥 ----------------
function toRequest(nodeReq, url) {
  const method = nodeReq.method || 'GET';
  const headers = new Headers();
  for (const [k, v] of Object.entries(nodeReq.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    nodeReq.on('data', (c) => chunks.push(c));
    nodeReq.on('error', reject);
    nodeReq.on('end', () => {
      const body = ['GET', 'HEAD'].includes(method) ? undefined : Buffer.concat(chunks);
      resolve(new Request(url, { method, headers, body }));
    });
  });
}

async function send(res, response) {
  const headers = {};
  for (const [k, v] of response.headers) headers[k] = v;
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (cookies.length) headers['set-cookie'] = cookies;
  const buf = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, headers);
  res.end(buf);
}

const server = createServer(async (req, res) => {
  const url = `http://127.0.0.1:${PORT}${req.url}`;
  try {
    const request = await toRequest(req, url);
    const response = await worker.fetch(request, env);
    await send(res, response);
  } catch (e) {
    console.error('[dev]', e);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('dev server error: ' + e.message);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`worker 本地运行中: http://127.0.0.1:${PORT}/api/health`);
  console.log(`D1 模拟库文件: ${path.join(DATA, 'd1-local.sqlite')}`);
});
