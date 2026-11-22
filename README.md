# 知音配对 · MusicMatch

学生 / 家长 ↔ 音乐老师 的双向配对小站。老师写清自己怎么教，学生和家长写清想学什么，
双方都看得见，看顺眼了互相点一次「想认识」，**双方都同意之后才交换邮箱**。

零依赖：只用 Node 内置模块（`node:http` + `node:crypto` + JSON 文件），不需要 npm install。

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

## 功能

- **两种身份，字段完全不同**
  - 老师：教的乐器、可教级别、教龄、课时费、授课方式（线上 / 线下 / 都可）、风格、院校资质、课程介绍
  - 家长 / 学生：想学的乐器、当前水平、学生年龄、预算、授课方式、目标诉求、补充说明
- **注册 / 登录 / 退出**：邮箱 + 密码，密码 scrypt 加盐哈希，会话 cookie（HttpOnly，30 天）
- **找配对**：按乐器、城市、授课方式、关键词筛；老师默认看学生需求，学生默认看老师，也可以自己切
- **配对请求**：只能「一位老师 + 一位家长/学生」，不能自己配自己，不能重复发；对方同意后双方才看到邮箱
- **我的配对**：收到的请求可同意 / 谢绝；自己发出的可撤回；已配对的直接显示对方邮箱
- **我的资料**：随时改，改完立刻在别人那边生效
- **中英切换**：顶栏「中 / EN」，记住选择（localStorage），整站文案即时切换，不刷新页面；
  用户自己填的内容（名字、简介、乐器）保持原样，只有界面文案和「零基础 / 线上」这类枚举会翻译。
  默认语言跟着浏览器走（`navigator.language`），服务端错误也带 `code`，前端按 code 说对应语言。

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

### 存储有两种模式

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
