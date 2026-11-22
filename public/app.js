/* 知音配对 · MusicMatch 前端 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { t, apply, setLang, levelLabel, modeLabel, errText } = window.I18N;

  const state = {
    me: null,
    view: 'home',
    browseRole: null,
    regRole: null,
    pendingTarget: null,
    filters: {},
    lastItems: null,
    lastRequests: null,
  };

  const roleLabel = (r) => (r ? t('role.' + r) : '');

  // ------------------------------------------------------------------ 工具
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  let toastTimer;
  function toast(msg, isErr = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('err', isErr);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
  }

  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch { /* 空响应 */ }
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.code = data.code;
      throw err;
    }
    return data;
  }

  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // ------------------------------------------------------------------ 语言
  function bindLangSwitch() {
    $('#langswitch').addEventListener('click', (e) => {
      const b = e.target.closest('[data-lang]');
      if (b) switchLang(b.dataset.lang);
    });
  }

  function switchLang(next) {
    if (window.I18N.lang === next) return;
    setLang(next);          // 内部会 apply() 静态文案
    // 动态部分全部重画（含当前没显示的视图，回来时不会是旧语言）
    if (state.me) {
      $('#chipRole').textContent = roleLabel(state.me.role);
      renderProfile();
    }
    if (state.lastItems) renderCards(state.lastItems, state.browseRole || 'teacher');
    if (state.lastRequests) renderRequests(state.lastRequests);
    if (state.stats) renderStats(state.stats);
    if (state.regRole) {
      $('#regSubmit').textContent = t(state.regRole === 'teacher' ? 'auth.submit.teacher' : 'auth.submit.family');
    }
  }

  // ------------------------------------------------------------------ 路由
  const VIEWS = ['home', 'login', 'register', 'browse', 'requests', 'profile'];
  const NEED_AUTH = new Set(['browse', 'requests', 'profile']);

  function go(view, opts = {}) {
    if (!VIEWS.includes(view)) view = 'home';
    if (NEED_AUTH.has(view) && !state.me) {
      toast(t('toast.loginFirst'));
      view = 'login';
    }
    state.view = view;
    VIEWS.forEach((v) => { $('#view-' + v).hidden = v !== view; });
    $$('.navlink').forEach((b) => b.classList.toggle('on', b.dataset.go === view));
    if (view === 'register' && opts.role) pickRole(opts.role);
    if (view === 'browse') loadBrowse();
    if (view === 'requests') loadRequests();
    if (view === 'profile') renderProfile();
    if (view === 'home') loadStats();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-go]');
    if (!btn) return;
    e.preventDefault();
    go(btn.dataset.go, { role: btn.dataset.role });
  });

  // ------------------------------------------------------------------ 会话
  function paintAuth() {
    const logged = !!state.me;
    $('#topactions').hidden = logged;
    $('#userchip').hidden = !logged;
    $('#topnav').hidden = !logged;
    if (logged) {
      const u = state.me;
      $('#chipName').textContent = u.name;
      $('#chipRole').textContent = roleLabel(u.role);
      $('#chipAvatar').textContent = (u.name || '音').slice(0, 1);
    }
  }

  async function refreshMe() {
    try {
      const { user, stats } = await api('/me');
      state.me = user;
      const badge = $('#reqBadge');
      if (stats.incoming > 0) { badge.hidden = false; badge.textContent = stats.incoming; }
      else badge.hidden = true;
    } catch {
      state.me = null;
    }
    paintAuth();
    return state.me;
  }

  // ------------------------------------------------------------------ 注册
  function pickRole(role) {
    if (!['teacher', 'family'].includes(role)) return;
    state.regRole = role;
    $$('#rolepick .roleopt').forEach((b) => b.classList.toggle('on', b.dataset.role === role));
    $$('.rolefields').forEach((f) => { f.hidden = f.dataset.for !== role; });
    $('#registerForm').hidden = false;
    const submit = $('#regSubmit');
    submit.disabled = false;
    submit.textContent = t(role === 'teacher' ? 'auth.submit.teacher' : 'auth.submit.family');
    $('#regErr').hidden = true;
  }

  $('#rolepick').addEventListener('click', (e) => {
    const b = e.target.closest('.roleopt');
    if (b) pickRole(b.dataset.role);
  });

  function collectFields(scope) {
    const out = {};
    $$('[data-k]', scope).forEach((el) => {
      if (el.closest('[hidden]')) return;
      const k = el.dataset.k;
      if (el.type === 'number') out[k] = el.value === '' ? 0 : Number(el.value);
      else if (el.dataset.multi === '1') out[k] = el.value ? [el.value] : [];
      else out[k] = el.value;
    });
    return out;
  }

  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const errBox = $('#regErr');
    errBox.hidden = true;
    if (!state.regRole) return;
    const fd = new FormData(form);
    const body = {
      role: state.regRole,
      name: fd.get('name'),
      email: fd.get('email'),
      password: fd.get('password'),
      city: fd.get('city'),
      profile: collectFields(form),
    };
    try {
      $('#regSubmit').disabled = true;
      await api('/register', { method: 'POST', body });
      await refreshMe();
      toast(t('toast.registered'));
      go('browse');
    } catch (err) {
      errBox.textContent = errText(err);
      errBox.hidden = false;
    } finally {
      $('#regSubmit').disabled = false;
    }
  });

  // ------------------------------------------------------------------ 登录
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = $('#loginErr');
    errBox.hidden = true;
    const fd = new FormData(e.currentTarget);
    try {
      await api('/login', {
        method: 'POST',
        body: { email: fd.get('email'), password: fd.get('password') },
      });
      await refreshMe();
      toast(t('toast.welcome', { name: state.me?.name || '' }));
      go('browse');
    } catch (err) {
      errBox.textContent = errText(err);
      errBox.hidden = false;
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/logout', { method: 'POST' }); } catch {}
    state.me = null;
    paintAuth();
    toast(t('toast.loggedOut'));
    go('home');
  });

  // ------------------------------------------------------------------ 首页统计
  function renderStats(s) {
    $('#homeStats').innerHTML = `
      <span><b>${s.teachers}</b> ${t('home.stat.teachers')}</span>
      <span><b>${s.families}</b> ${t('home.stat.families')}</span>
      <span><b>${s.accepted}</b> ${t('home.stat.pairs')}</span>`;
  }

  async function loadStats() {
    try {
      state.stats = await api('/health');
      renderStats(state.stats);
    } catch { /* 忽略 */ }
  }

  // ------------------------------------------------------------------ 浏览
  function wantRoleForBrowse() {
    if (state.browseRole) return state.browseRole;
    return state.me?.role === 'teacher' ? 'family' : 'teacher';
  }

  async function loadBrowse() {
    const role = wantRoleForBrowse();
    state.browseRole = role;
    $$('#browseSwitch button').forEach((b) => b.classList.toggle('on', b.dataset.role === role));
    $('#browseTitle').dataset.i18n = role === 'teacher' ? 'browse.title.teacher' : 'browse.title.family';
    $('#browseSub').dataset.i18n = role === 'teacher' ? 'browse.sub.teacher' : 'browse.sub.family';
    apply();

    const qs = new URLSearchParams({ role, ...state.filters });
    const box = $('#cards');
    box.innerHTML = `<p class="mini">${t('browse.loading')}</p>`;
    try {
      const { items } = await api('/browse?' + qs.toString());
      state.lastItems = items;
      renderCards(items, role);
    } catch (err) {
      box.innerHTML = '';
      toast(errText(err), true);
    }
  }

  function renderCards(items, role) {
    const box = $('#cards');
    const empty = $('#cardsEmpty');
    if (!items.length) {
      box.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    box.innerHTML = items.map((it) => cardHTML(it, role)).join('');
  }

  function cardHTML(it, role) {
    const p = it.profile || {};
    const tags = [];
    (p.instruments || []).forEach((i) => tags.push(`<span class="tag">${esc(i)}</span>`));
    if (role === 'teacher') {
      if (p.levels?.length) tags.push(`<span class="tag">${esc(p.levels.map(levelLabel).join(' / '))}</span>`);
      if (p.rate) tags.push(`<span class="tag price">${esc(t('card.rate', { n: p.rate }))}</span>`);
      if (p.years) tags.push(`<span class="tag">${esc(t('card.years', { n: p.years }))}</span>`);
    } else {
      if (p.level) tags.push(`<span class="tag">${esc(levelLabel(p.level))}</span>`);
      if (p.studentAge) tags.push(`<span class="tag">${esc(p.studentAge)}</span>`);
      if (p.budget) tags.push(`<span class="tag price">${esc(t('card.budget', { n: p.budget }))}</span>`);
      if (p.goal) tags.push(`<span class="tag">${esc(p.goal.slice(0, 16))}</span>`);
    }
    if (p.mode) tags.push(`<span class="tag mode">${esc(modeLabel(p.mode))}</span>`);

    const bits = [];
    if (role === 'teacher') {
      if (p.styles) bits.push(esc(p.styles));
      if (p.education) bits.push(esc(p.education));
    }
    const desc = esc((p.intro || '').slice(0, 400));

    // 名字下面那行只放乐器，其余信息交给下面的标签（避免和标签重复）
    const subtitle = (p.instruments || []).join(' / ');

    let foot;
    const st = it.matchState || 'none';
    if (st === 'accepted') {
      foot = `<span class="state accepted">${esc(t('card.accepted'))}</span>
        <span class="emailpill">${esc(it.email || '')}</span>`;
    } else if (st === 'pending') {
      foot = `<span class="state pending">${esc(t('card.pending'))}</span>`;
    } else {
      const label = st === 'declined' ? t('card.retry') : t('card.match');
      foot = `<button class="btn solid sm" data-match="${esc(it.id)}" data-name="${esc(it.name)}">${esc(label)}</button>
        <span class="mini">${esc(it.city || t('card.cityMissing'))}</span>`;
    }

    return `<article class="card ${role === 'family' ? 'family' : ''}">
      <div class="card-top">
        <span class="avatar">${esc((it.name || '音').slice(0, 1))}</span>
        <div class="who">
          <b>${esc(it.name)}</b>
          <i>${esc(subtitle)}</i>
        </div>
        <span class="role-tag">${esc(roleLabel(role))}</span>
      </div>
      <div class="tags">${tags.join('')}</div>
      ${bits.length ? `<p class="tagline">${bits.join(' · ')}</p>` : ''}
      ${desc ? `<p class="desc">${desc}</p>` : `<p class="mini">${esc(t('card.noIntro'))}</p>`}
      <div class="card-foot">${foot}</div>
    </article>`;
  }

  $('#cards').addEventListener('click', (e) => {
    const b = e.target.closest('[data-match]');
    if (!b) return;
    state.pendingTarget = { id: b.dataset.match, name: b.dataset.name };
    $('#modalTitle').textContent = t('modal.title', { name: b.dataset.name });
    $('#modalSub').textContent = t('modal.sub');
    $('#modalMsg').value = '';
    $('#modal').hidden = false;
    $('#modalMsg').focus();
  });

  $('#browseSwitch').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.browseRole = b.dataset.role;
    loadBrowse();
  });

  $('#filterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    state.filters = {};
    for (const [k, v] of fd.entries()) {
      if (String(v).trim()) state.filters[k] = String(v).trim();
    }
    loadBrowse();
  });
  $('#resetFilter').addEventListener('click', () => {
    state.filters = {};
    setTimeout(loadBrowse, 0);
  });

  // ------------------------------------------------------------------ 弹窗
  $('#modalCancel').addEventListener('click', () => { $('#modal').hidden = true; });
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; });
  $('#modalSend').addEventListener('click', async () => {
    if (!state.pendingTarget) return;
    try {
      await api('/requests', {
        method: 'POST',
        body: { toUserId: state.pendingTarget.id, message: $('#modalMsg').value },
      });
      $('#modal').hidden = true;
      toast(t('toast.sent'));
      loadBrowse();
      refreshMe();
    } catch (err) {
      toast(errText(err), true);
    }
  });

  // ------------------------------------------------------------------ 我的配对
  async function loadRequests() {
    try {
      const data = await api('/requests');
      state.lastRequests = data;
      renderRequests(data);
    } catch (err) {
      toast(errText(err), true);
    }
  }

  function renderRequests({ incoming, outgoing }) {
    renderReqList($('#incoming'), incoming, true);
    renderReqList($('#outgoing'), outgoing, false);
    $('#incomingEmpty').hidden = incoming.length > 0;
    $('#outgoingEmpty').hidden = outgoing.length > 0;
  }

  function profileLine(peer) {
    const p = peer.profile || {};
    const parts = [];
    if (p.instruments?.length) parts.push(p.instruments.join(' / '));
    if (peer.role === 'teacher') {
      if (p.rate) parts.push(t('card.rate', { n: p.rate }));
      if (p.levels?.length) parts.push(p.levels.map(levelLabel).join(' / '));
    } else {
      if (p.level) parts.push(levelLabel(p.level));
      if (p.budget) parts.push(t('card.budget', { n: p.budget }));
    }
    if (p.mode) parts.push(modeLabel(p.mode));
    return parts.join(' · ');
  }

  function renderReqList(box, list, isIncoming) {
    box.innerHTML = list.map((r) => {
      const peer = r.peer || {};
      const statusText = t('req.status.' + r.status);
      let actions;
      if (isIncoming && r.status === 'pending') {
        actions = `<button class="btn solid sm" data-req="${esc(r.id)}" data-act="accept">${esc(t('req.accept'))}</button>
                   <button class="btn ghost" data-req="${esc(r.id)}" data-act="decline">${esc(t('req.decline'))}</button>`;
      } else if (!isIncoming && r.status === 'accepted') {
        actions = `<span class="statuspill accepted">${esc(t('req.status.accepted'))}</span>
                   <span class="emailpill">${esc(r.peerEmail || '')}</span>`;
      } else if (!isIncoming && r.status === 'pending') {
        actions = `<button class="btn ghost" data-del="${esc(r.id)}">${esc(t('req.withdraw'))}</button>`;
      } else {
        actions = `<span class="statuspill ${r.status}">${esc(statusText)}</span>`;
      }

      return `<div class="req">
        <span class="avatar">${esc((peer.name || '音').slice(0, 1))}</span>
        <div class="body">
          <b>${esc(peer.name || '—')}</b>
          <span class="mini"> · ${esc(roleLabel(peer.role))} · ${fmtDate(r.createdAt)}</span>
          <div class="mini">${esc(profileLine(peer))}</div>
          ${r.message ? `<p class="msg">“${esc(r.message)}”</p>` : ''}
          ${r.status === 'accepted' && isIncoming
            ? `<p class="mini">${esc(t('req.contact'))}：<span class="emailpill">${esc(r.peerEmail || '')}</span></p>` : ''}
        </div>
        <div class="actions">${actions}</div>
      </div>`;
    }).join('');
  }

  $('#view-requests').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      try {
        await api(`/requests/${act.dataset.req}/${act.dataset.act}`, { method: 'POST' });
        toast(act.dataset.act === 'accept' ? t('toast.matched') : t('toast.declined'));
        loadRequests();
        refreshMe();
      } catch (err) { toast(errText(err), true); }
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      try {
        await api(`/requests/${del.dataset.del}`, { method: 'DELETE' });
        toast(t('toast.withdrawn'));
        loadRequests();
      } catch (err) { toast(errText(err), true); }
    }
  });

  // ------------------------------------------------------------------ 我的资料
  function teacherFieldsHTML() {
    return `
    <div class="grid2">
      <label><span>${esc(t('auth.instruments.teacher'))}</span>
        <input name="instruments" data-k="instruments" placeholder="${esc(t('auth.instruments.teacher.ph'))}" /></label>
      <label><span>${esc(t('auth.levels'))}</span>
        <select name="levels" data-k="levels" data-multi="1">
          <option value="零基础">${esc(t('level.zero'))}</option>
          <option value="入门">${esc(t('level.beginner'))}</option>
          <option value="进阶">${esc(t('level.intermediate'))}</option>
          <option value="高级">${esc(t('level.advanced'))}</option>
          <option value="艺考 / 专业">${esc(t('level.pro'))}</option>
        </select></label>
    </div>
    <div class="grid2">
      <label><span>${esc(t('auth.years'))}</span>
        <input type="number" name="years" data-k="years" min="0" max="60" /></label>
      <label><span>${esc(t('auth.rate'))}</span>
        <input type="number" name="rate" data-k="rate" min="0" max="5000" step="10" /></label>
    </div>
    <div class="grid2">
      <label><span>${esc(t('auth.mode'))}</span>
        <select name="mode" data-k="mode">
          <option value="线上 + 线下">${esc(t('mode.both'))}</option>
          <option value="线下">${esc(t('mode.offline'))}</option>
          <option value="线上">${esc(t('mode.online'))}</option>
        </select></label>
      <label><span>${esc(t('auth.styles'))}</span>
        <input name="styles" data-k="styles" placeholder="${esc(t('auth.styles.ph'))}" /></label>
    </div>
    <label><span>${esc(t('auth.education'))}</span>
      <input name="education" data-k="education" placeholder="${esc(t('auth.education.ph'))}" /></label>
    <label><span>${esc(t('auth.intro.teacher'))}</span>
      <textarea name="intro" data-k="intro" rows="4" maxlength="1200" placeholder="${esc(t('auth.intro.teacher.ph'))}"></textarea></label>`;
  }

  function familyFieldsHTML() {
    return `
    <div class="grid2">
      <label><span>${esc(t('auth.instruments.family'))}</span>
        <input name="instruments" data-k="instruments" placeholder="${esc(t('auth.instruments.family.ph'))}" /></label>
      <label><span>${esc(t('auth.level'))}</span>
        <select name="level" data-k="level">
          <option value="零基础">${esc(t('level.zero'))}</option>
          <option value="入门">${esc(t('level.beginner'))}</option>
          <option value="进阶">${esc(t('level.intermediate'))}</option>
          <option value="高级">${esc(t('level.advanced'))}</option>
          <option value="艺考 / 专业">${esc(t('level.pro'))}</option>
        </select></label>
    </div>
    <div class="grid2">
      <label><span>${esc(t('auth.studentAge'))}</span>
        <input name="studentAge" data-k="studentAge" maxlength="40" placeholder="${esc(t('auth.studentAge.ph'))}" /></label>
      <label><span>${esc(t('auth.budget'))}</span>
        <input type="number" name="budget" data-k="budget" min="0" max="5000" step="10" /></label>
    </div>
    <div class="grid2">
      <label><span>${esc(t('auth.mode'))}</span>
        <select name="mode" data-k="mode">
          <option value="线上 + 线下">${esc(t('mode.both'))}</option>
          <option value="线下">${esc(t('mode.offline'))}</option>
          <option value="线上">${esc(t('mode.online'))}</option>
        </select></label>
      <label><span>${esc(t('auth.goal'))}</span>
        <input name="goal" data-k="goal" maxlength="160" placeholder="${esc(t('auth.goal.ph'))}" /></label>
    </div>
    <label><span>${esc(t('auth.intro.family'))}</span>
      <textarea name="intro" data-k="intro" rows="4" maxlength="1200" placeholder="${esc(t('auth.intro.family.ph'))}"></textarea></label>`;
  }

  function renderProfile() {
    const u = state.me;
    if (!u) return;
    const form = $('#profileForm');
    form.name.value = u.name || '';
    form.city.value = u.city || '';
    form.email.value = u.email || '';
    form.createdAt.value = fmtDate(u.createdAt);
    $('#profileRolePill').textContent = roleLabel(u.role);

    $('#profileFields').innerHTML = u.role === 'teacher' ? teacherFieldsHTML() : familyFieldsHTML();
    const p = u.profile || {};
    $$('#profileFields [data-k]').forEach((el) => {
      const k = el.dataset.k;
      let v = p[k];
      if (el.dataset.multi === '1' && Array.isArray(v)) v = v[0] || '';
      if (Array.isArray(v)) v = v.join('、');
      el.value = v == null ? '' : v;
    });
    $('#profileErr').hidden = true;
    $('#profileOk').hidden = true;
  }

  $('#profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const errBox = $('#profileErr');
    const okBox = $('#profileOk');
    errBox.hidden = true;
    okBox.hidden = true;
    try {
      const { user } = await api('/profile', {
        method: 'PATCH',
        body: {
          name: form.name.value,
          city: form.city.value,
          profile: collectFields($('#profileFields')),
        },
      });
      state.me = { ...user, email: user.email || state.me.email };
      paintAuth();
      okBox.hidden = false;
      toast(t('toast.saved'));
    } catch (err) {
      errBox.textContent = errText(err);
      errBox.hidden = false;
    }
  });

  // ------------------------------------------------------------------ 启动
  (async function boot() {
    bindLangSwitch();
    apply();                       // 先刷一遍静态文案 + <html lang>
    await refreshMe();
    const hash = location.hash.replace('#', '');
    if (hash && VIEWS.includes(hash)) go(hash);
    else if (state.me) go('browse');
    else go('home');
  })();
})();
