# 知音配对 · MusicMatch

学生 / 家长 ↔ 音乐老师 的双向配对小站。老师写清自己怎么教，学生和家长写清想学什么，
双方都看得见，看顺眼了互相点一次「想认识」，**双方都同意之后才交换邮箱**。

零依赖：只用 Node 内置模块（`node:http` + `node:crypto` + JSON 文件），不需要 npm install。

## 线上地址

**https://musicmatch.huberzhang.workers.dev**

跑在 Cloudflare Workers 上（`worker/worker.mjs`），静态页面由 CDN 直接发，数据在 D1（APAC 区）。
不绑卡、不休眠、关机也不影响。

```bash
# 改完代码重新部署
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy
```

- 数据库：`musicmatch`（id `d319e4de-8599-4083-98f7-1d79ad7cea04`）
- 免费额度：10 万请求/天、D1 500 万行读/天 + 10 万行写/天
- 看线上日志：`npx wrangler tail`


## 线上地址

**https://dafiyu.tailf44e1d.ts.net:8443**

走的是这台机器已有的 Tailscale Funnel（8443 端口独立映射，没动原来 443 → 3200 那条），
站点本身仍然由 `node server.mjs` 在本机 8787 端口提供。

```powershell
# 站点（必须开着，Funnel 只是把外面的人接进来）
npm start

# 查 / 关掉公网入口
tailscale funnel status
tailscale funnel --https=8443 off
```

> Funnel 的映射记在 tailscaled 服务里，重启电脑后仍在；但 `node server.mjs` 需要重新启动。

---

## 跑起来

```bash
cd musicmatch
node server.mjs          # 默认 http://localhost:8787
PORT=8080 node server.mjs
```

Windows PowerShell：

```powershell
cd musicmatch
$env:PORT=8080; node server.mjs
```

数据落在 `data/db.json`（首次启动自动创建）。想清空重来：停服务 → 删掉 `data/db.json` → 重启。

## 目录

```
musicmatch/
├─ server.mjs        零依赖后端：注册 / 登录 / 资料 / 浏览 / 配对 / 会话
├─ public/
│  ├─ index.html     单页界面（首页 / 登录 / 注册 / 找配对 / 我的配对 / 我的资料）
│  ├─ styles.css     样式
│  ├─ i18n.js        中英词典 + 切换逻辑（约 180 条文案）
│  └─ app.js         前端逻辑（原生 JS，无框架）
└─ data/db.json      运行时生成的数据文件
```

## 三级账号（当前版本）

| 角色 | 能做什么 |
|---|---|
| **学生** `student` | 填**申请表**（乐器 / 上课时间 / 学生姓名 / 联系方式 / 备注），提交进管理台；被分配后能看到老师的资料和邮箱；可以随时改申请 |
| **老师** `teacher` | 维护**作品集**（姓名、国籍、教学语言、各乐器资质、级别、课时费、授课方式、风格、院校）；看到**分配给自己**的学生的资料、时间、备注、联系方式 |
| **管理员** `admin` | 管理台看全部申请 / 老师 / 分配情况；点「分配老师」看**排序后的候选**（乐器匹配 +100、同城 +30、预算内 +20、授课方式一致 +10、带得少 +2×剩余名额），一键分配、换人、取消分配；查看全站账号与每位老师的工作量 |

管理员账号**不开放注册**，由内部创建：

```bash
# 生成 SQL（线上用）
node tools/seed-admin.mjs admin@example.com 你的密码

# 本地库直接写
node tools/seed-admin.mjs admin@example.com 你的密码 --local
```

## 功能

- **注册**：只能选学生或老师；两套资料字段完全不一样，注册后不可改
- **登录 / 退出**：邮箱 + 密码，线上 PBKDF2-10k（Workers 10ms CPU 限制），会话 cookie（HttpOnly / Secure / 30 天）
- **学生提单**：一张表进系统，`requests` 表里每位学生一条（`student_id` 唯一），可反复修改
- **排序**：`/api/admin/candidates` 给每条申请排老师，返回分数和命中理由
- **分配**：`/api/admin/assign` / `unassign`；分配后老师立刻能看到学生，学生立刻能看到老师
- **浏览**：老师可翻学生申请、学生可翻老师资料（按乐器 / 城市 / 授课方式 / 预算 / 关键词筛）
- **我的资料**：随时改，改完立刻生效
- **中英切换**：顶栏「中 / EN」，记住选择；界面文案与枚举翻译，用户填的内容保持原样

> 旧版本「学生 ↔ 老师 互相点想认识」的自助配对已被管理员分配取代；旧表 `match_requests` 仍留在库里但不再使用。


## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 站点统计（公开） |
| POST | `/api/register` | `{role, name, email, password, city, profile}`，role = `teacher` / `family` |
| POST | `/api/login` | `{email, password}` |
| POST | `/api/logout` | 清会话 |
| GET | `/api/me` | 当前用户 + 待处理 / 已配对计数 |
| PATCH | `/api/profile` | 改名字、城市、资料 |
| GET | `/api/browse?role=teacher&instrument=钢琴&city=杭州&mode=线上&q=爵士` | 浏览 |
| POST | `/api/requests` | `{toUserId, message}` 发起配对 |
| GET | `/api/requests` | 收到的 / 发出的 |
| POST | `/api/requests/:id/accept` · `/decline` | 回复（只有收到的一方能操作） |
| DELETE | `/api/requests/:id` | 撤回自己发出的 |

## 部署到公网

### 方案一：Cloudflare Workers + D1（推荐，不需要信用卡）

线上跑的是 `worker/worker.mjs`，静态页面由 Cloudflare 直接发，数据在 D1（SQLite）里。
`server.mjs` 只用于本地开发，不参与线上。

```bash
# 一次性：登录 + 建库
npx wrangler login
npx wrangler d1 create musicmatch        # 把返回的 database_id 填进 wrangler.toml

# 部署
npx wrangler deploy                      # 之后 https://musicmatch.<你的子域>.workers.dev
```

细节：

- 表结构不用手建，worker 第一次收到请求会自己 `create table if not exists`；
- 免费档单次请求 CPU 只有 10ms，所以密码用 **PBKDF2-10k**（不是 scrypt）；
- 本地调试 worker：`node tools/dev-worker.mjs 8788`（用 `node:sqlite` 模拟 D1，跑的就是线上那份代码）；
- 也可以在 Cloudflare 后台 **Workers & Pages → Connect to Git** 绑这个仓库，以后 push 自动部署。

### 方案二：Render（免费档要验证信用卡）

#### 存储有两种模式

| 环境变量 | 用哪套存储 | 什么时候用 |
|---|---|---|
| 没有 `DATABASE_URL` | 本地 `data/db.json` | 本机开发 |
| 有 `DATABASE_URL` | Postgres（自动建表） | 线上，数据不会因为重部署/休眠而丢 |

第一次连上 Postgres 会自动 `create table if not exists`，不用手动跑 SQL。

### Render（推荐，免费档）

**方式一：Blueprint（最省事，表格全自动填好）**

仓库里已经带了 `render.yaml`，它同时创建一个免费 Postgres 并把 `DATABASE_URL` 注入服务：

1. 把本目录推到 GitHub 仓库（根目录就是 `render.yaml`）
2. Render → **New → Blueprint** → 选中仓库 → **Apply**
3. 等两三分钟，拿到 `https://xxx.onrender.com`

**方式二：手动建 Web Service**

- Source：Public Git Repository（公开仓库不用连 GitHub）
- Runtime `Node`，Build `npm install`，Start `node server.mjs`，Instance `Free`
- 再单独建一个 **Postgres（Free）**，把 **Internal Database URL** 填进 Web Service 的
  Environment → `DATABASE_URL`，保存后会自动重新部署

> ⚠️ Render 免费档的两个限制：15 分钟没人访问会休眠（下次访问约 1 分钟冷启动）；
> 免费 **Postgres 在创建 30 天后会过期**，到期前把 `DATABASE_URL` 换成 [Neon](https://neon.tech/) 免费库即可，代码不用改。

### 其它地方

1. **一台 VPS / 树莓派**：`npm install && node server.mjs` + nginx 反代 80/443，前面套 Caddy / certbot 拿证书。
2. **Docker**：`docker build -t musicmatch . && docker run -p 8787:8787 -e DATABASE_URL=... musicmatch`
3. **临时给别人看**（隧道，不用买服务器，但电脑关机就断）：
   ```bash
   cloudflared tunnel --url http://127.0.0.1:8787   # 需要先装 cloudflared
   ```

反代后面跑的话，记得传 `X-Forwarded-Proto: https` —— 代码靠它决定 cookie 要不要加 `Secure`。

## 已知边界（老实说）

- 没有邮箱验证、没有找回密码、没有验证码：这是最小可用版，真要开放注册建议自己加一层（邮件服务 + 图形验证码）。
- 限流是按 IP 的内存计数（重启即清零），够挡手滑，不够挡有备而来。
- 没有图片上传和站内消息；配对成功之后靠邮箱自己联系。
- 数据默认是单文件 JSON（本机）；线上走 Postgres，索引和表结构随服务启动自动建。
