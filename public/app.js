/* 知音配对 · 前端（三级账号：学生 / 老师 / 管理员） */
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
    filters: {},
    lastItems: null,
    stats: null,
    myRequest: null,
    students: null,
    admin: null,
    candRequestId: null,
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

  // ------------------------------------------------------------------ 导航
  const NAV = {
    student: [
      { view: 'browse', key: 'nav.browseTeacher' },
      { view: 'myrequest', key: 'nav.myRequest' },
      { view: 'profile', key: 'nav.profile' },
    ],
    teacher: [
      { view: 'browse', key: 'nav.browseStudent' },
      { view: 'mystudents', key: 'nav.myStudents' },
      { view: 'profile', key: 'nav.profile' },
    ],
    admin: [
      { view: 'admin', key: 'nav.admin', badge: true },
      { view: 'browse', key: 'nav.browseAll' },
      { view: 'profile', key: 'nav.profile' },
    ],
  };

  function renderNav() {
    const nav = $('#topnav');
    if (!state.me) { nav.hidden = true; nav.innerHTML = ''; return; }
    const items = NAV[state.me.role] || [];
    nav.innerHTML = items.map((it) => `
      <button class="navlink" data-go="${it.view}">
        <span>${esc(t(it.key))}</span>
        ${it.badge ? '<span class="badge" id="navBadge" hidden>0</span>' : ''}
      </button>`).join('');
    nav.hidden = false;
    paintBadge();
  }

  function paintBadge() {
    const badge = $('#navBadge');
    if (!badge) return;
    const n = state.me?.counts?.pendingRequests || 0;
    badge.hidden = n <= 0;
    badge.textContent = n;
  }

  const DEFAULT_VIEW = { student: 'myrequest', teacher: 'mystudents', admin: 'admin' };

  // ------------------------------------------------------------------ 路由
  const VIEWS = ['home', 'login', 'register', 'browse', 'myrequest', 'mystudents', 'admin', 'profile'];
  const NEED_AUTH = new Set(['browse', 'myrequest', 'mystudents', 'admin', 'profile']);
  const ROLE_OF_VIEW = { myrequest: 'student', mystudents: 'teacher', admin: 'admin' };

  function go(view, opts = {}) {
    if (!VIEWS.includes(view)) view = 'home';
    if (NEED_AUTH.has(view) && !state.me) {
      toast(t('toast.loginFirst'));
      view = 'login';
    }
    const needRole = ROLE_OF_VIEW[view];
    if (needRole && state.me && state.me.role !== needRole) {
      view = DEFAULT_VIEW[state.me.role] || 'home';
    }
    state.view = view;
    VIEWS.forEach((v) => { $('#view-' + v).hidden = v !== view; });
    if (state.me) {
      $$('.navlink').forEach((b) => b.classList.toggle('on', b.dataset.go === view));
    }
    if (view === 'register' && opts.role) pickRole(opts.role);
    if (view === 'browse') loadBrowse();
    if (view === 'myrequest') loadMyRequest();
    if (view === 'mystudents') loadMyStudents();
    if (view === 'admin') loadAdmin();
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
    if (logged) {
      const u = state.me;
      $('#chipName').textContent = u.name;
      $('#chipRole').textContent = roleLabel(u.role);
      $('#chipAvatar').textContent = (u.name || '音').slice(0, 1);
    }
    renderNav();
  }

  async function refreshMe() {
    try {
      const data = await api('/me');
      state.me = { ...data.user, counts: data.counts || {}, request: data.request || null };
    } catch {
      state.me = null;
    }
    paintAuth();
    return state.me;
  }

  function switchLang(next) {
    if (window.I18N.lang === next) return;
    setLang(next);
    if (state.me) {
      $('#chipRole').textContent = roleLabel(state.me.role);
      renderNav();
      renderProfile();
    }
    if (state.lastItems) renderCards(state.lastItems, state.browseRole || 'teacher');
    if (state.stats) renderStats(state.stats);
    if (state.view === 'myrequest') renderMyRequest();
    if (state.view === 'mystudents') renderMyStudents();
    if (state.view === 'admin' && state.admin) renderAdmin();
    if (state.regRole) {
      $('#regSubmit').textContent = t(state.regRole === 'teacher' ? 'auth.submit.teacher' : 'auth.submit.student');
    }
  }

  $('#langswitch').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) switchLang(b.dataset.lang);
  });

  // ------------------------------------------------------------------ 注册
  function pickRole(role) {
    if (!['teacher', 'student'].includes(role)) return;
    state.regRole = role;
    $$('#rolepick .roleopt').forEach((b) => b.classList.toggle('on', b.dataset.role === role));
    $$('.rolefields').forEach((f) => { f.hidden = f.dataset.for !== role; });
    $('#registerForm').hidden = false;
    const submit = $('#regSubmit');
    submit.disabled = false;
    submit.textContent = t(role === 'teacher' ? 'auth.submit.teacher' : 'auth.submit.student');
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
      go(DEFAULT_VIEW[state.regRole] || 'home');
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
      go(DEFAULT_VIEW[state.me.role] || 'home');
    } catch (err) {
      errBox.textContent = errText(err);
      errBox.hidden = false;
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/logout', { method: 'POST' }); } catch {}
    state.me = null;
    state.myRequest = null;
    state.students = null;
    state.admin = null;
    paintAuth();
    toast(t('toast.loggedOut'));
    go('home');
  });

  // ------------------------------------------------------------------ 首页统计
  function renderStats(s) {
    $('#homeStats').innerHTML = `
      <span><b>${s.teachers}</b> ${t('home.stat.teachers')}</span>
      <span><b>${s.students}</b> ${t('home.stat.students')}</span>
      <span><b>${s.assigned}</b> ${t('home.stat.pairs')}</span>`;
  }

  async function loadStats() {
    try {
      state.stats = await api('/health');
      renderStats(state.stats);
    } catch { /* 忽略 */ }
  }

  // ------------------------------------------------------------------ 浏览
  function defaultBrowseRole() {
    if (state.browseRole) return state.browseRole;
    return state.me?.role === 'teacher' ? 'student' : 'teacher';
  }

  async function loadBrowse() {
    const role = defaultBrowseRole();
    state.browseRole = role;
    $$('#browseSwitch button').forEach((b) => b.classList.toggle('on', b.dataset.role === role));
    $('#browseTitle').dataset.i18n = role === 'teacher' ? 'browse.title.teacher' : 'browse.title.student';
    $('#browseSub').dataset.i18n = role === 'teacher' ? 'browse.sub.teacher' : 'browse.sub.student';
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

    const subtitle = (p.instruments || []).join(' / ');
    const bits = [];
    if (role === 'teacher') {
      if (p.nationality) bits.push(esc(p.nationality));
      if (p.languages?.length) bits.push(esc(p.languages.join(' / ')));
      if (p.styles) bits.push(esc(p.styles));
      if (p.qualifications) bits.push(esc(p.qualifications.slice(0, 60)));
    }
    const desc = esc((p.intro || '').slice(0, 400));

    return `<article class="card ${role === 'student' ? 'family' : ''}">
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
      <div class="card-foot"><span class="mini">${esc(it.city || t('card.cityMissing'))}</span></div>
    </article>`;
  }

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

  // ------------------------------------------------------------------ 学生：我的申请
  async function loadMyRequest() {
    try {
      state.myRequest = await api('/student/request');
      renderMyRequest();
    } catch (err) {
      toast(errText(err), true);
    }
  }

  function renderMyRequest() {
    const data = state.myRequest;
    const form = $('#requestForm');
    if (!data) return;
    const req = data.request;
    const pill = $('#reqStatus');
    pill.textContent = !req ? t('req2.noRequest')
      : req.teacherId ? t('req2.status.assigned') : t('req2.status.pending');
    pill.className = 'pill' + (!req ? '' : req.teacherId ? ' ok' : ' warn');

    const box = $('#reqAssigned');
    if (data.teacher) {
      box.hidden = false;
      const p = data.teacher.profile || {};
      $('#reqTeacherCard').innerHTML = `
        <div class="req assigned-teacher">
          <span class="avatar">${esc((data.teacher.name || '师').slice(0, 1))}</span>
          <div class="body">
            <b>${esc(data.teacher.name)}</b>
            <span class="mini"> · ${esc(roleLabel('teacher'))}</span>
            <div class="mini">${esc((p.instruments || []).join(' / '))}${p.rate ? ' · ' + esc(t('card.rate', { n: p.rate })) : ''}${p.mode ? ' · ' + esc(modeLabel(p.mode)) : ''}</div>
            ${p.qualifications ? `<div class="mini">${esc(p.qualifications)}</div>` : ''}
            <p class="mini">${esc(t('req.contact'))}：<span class="emailpill">${esc(data.teacher.email || '')}</span></p>
          </div>
        </div>`;
    } else {
      box.hidden = true;
      $('#reqTeacherCard').innerHTML = '';
    }

    if (req) {
      form.instrument.value = req.instrument || '';
      form.studentName.value = req.studentName || '';
      form.contact.value = req.contact || '';
      form.times.value = req.times || '';
      form.note.value = req.note || '';
      $('#reqOk').hidden = true;
    } else if (!form.studentName.value) {
      form.studentName.value = state.me?.name || '';
    }
  }

  $('#requestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    $('#reqErr').hidden = true;
    $('#reqOk').hidden = true;
    try {
      await api('/student/request', {
        method: 'POST',
        body: {
          instrument: form.instrument.value,
          studentName: form.studentName.value,
          contact: form.contact.value,
          times: form.times.value,
          note: form.note.value,
        },
      });
      $('#reqOk').hidden = false;
      await loadMyRequest();
      await refreshMe();
      toast(t('toast.requestSaved'));
    } catch (err) {
      $('#reqErr').textContent = errText(err);
      $('#reqErr').hidden = false;
    }
  });

  // ------------------------------------------------------------------ 老师：我的学生
  async function loadMyStudents() {
    try {
      const { students } = await api('/teacher/students');
      state.students = students;
      renderMyStudents();
    } catch (err) {
      toast(errText(err), true);
    }
  }

  function renderMyStudents() {
    const list = state.students || [];
    const box = $('#studentList');
    $('#myStudentCount').textContent = t('my.count', { n: list.length });
    $('#studentsEmpty').hidden = list.length > 0;
    box.innerHTML = list.map((s) => `
      <div class="req">
        <span class="avatar">${esc((s.studentName || s.student?.name || '学').slice(0, 1))}</span>
        <div class="body">
          <b>${esc(s.studentName || s.student?.name || '')}</b>
          <span class="mini"> · ${esc(s.instrument || '')}</span>
          <div class="mini">${esc(s.times || t('my.noTimes'))}</div>
          ${s.note ? `<p class="msg">“${esc(s.note)}”</p>` : ''}
          <p class="mini">${esc(t('req.contact'))}：<span class="emailpill">${esc(s.contact || s.studentEmail || '')}</span></p>
        </div>
      </div>`).join('');
  }

  // ------------------------------------------------------------------ 管理员
  async function loadAdmin() {
    try {
      const [overview, list] = await Promise.all([
        api('/admin/overview'),
        api('/admin/requests'),
      ]);
      state.admin = { overview, items: list.items };
      renderAdmin();
      await refreshMe();
    } catch (err) {
      toast(errText(err), true);
    }
  }

  function renderAdmin() {
    const data = state.admin;
    if (!data) return;
    const { totals, teachers } = data.overview;
    $('#adminStats').innerHTML = `
      <span><b>${totals.pending}</b> ${t('admin.stat.pending')}</span>
      <span><b>${totals.assigned}</b> ${t('admin.stat.assigned')}</span>
      <span><b>${totals.students}</b> ${t('admin.stat.students')}</span>
      <span><b>${totals.teachers}</b> ${t('admin.stat.teachers')}</span>`;

    const pending = data.items.filter((r) => !r.teacherId);
    const assigned = data.items.filter((r) => r.teacherId);

    $('#adminPendingEmpty').hidden = pending.length > 0;
    $('#adminAssignedEmpty').hidden = assigned.length > 0;

    $('#adminPending').innerHTML = pending.map((r) => `
      <div class="req">
        <span class="avatar">${esc((r.studentName || '学').slice(0, 1))}</span>
        <div class="body">
          <b>${esc(r.studentName)}</b>
          <span class="mini"> · ${esc(r.instrument)}</span>
          <div class="mini">${esc(r.times || t('admin.noTimes'))}</div>
          <div class="mini">${esc(t('req.contact'))}：${esc(r.contact)}</div>
          ${r.note ? `<p class="msg">“${esc(r.note)}”</p>` : ''}
        </div>
        <div class="actions">
          <button class="btn solid sm" data-assign="${esc(r.id)}">${esc(t('admin.assign'))}</button>
        </div>
      </div>`).join('');

    $('#adminAssigned').innerHTML = assigned.map((r) => `
      <div class="req">
        <span class="avatar">${esc((r.studentName || '学').slice(0, 1))}</span>
        <div class="body">
          <b>${esc(r.studentName)}</b>
          <span class="mini"> · ${esc(r.instrument)}</span>
          <div class="mini">${esc(t('admin.assignedTo', { name: r.teacher?.name || '—' }))}</div>
          ${r.teacher?.email ? `<div class="mini">${esc(r.teacher.email)}</div>` : ''}
        </div>
        <div class="actions">
          <button class="btn ghost sm" data-assign="${esc(r.id)}">${esc(t('admin.reassign'))}</button>
          <button class="btn ghost sm" data-unassign="${esc(r.id)}">${esc(t('admin.unassign'))}</button>
        </div>
      </div>`).join('');

    $('#adminTeacherLoad').innerHTML = teachers.map((tt) =>
      `<span class="tag">${esc(tt.name)} · ${esc(t('admin.load', { n: tt.load }))}</span>`).join('');
  }

  $('#adminRefresh').addEventListener('click', () => loadAdmin());

  $('#view-admin').addEventListener('click', async (e) => {
    const assignBtn = e.target.closest('[data-assign]');
    if (assignBtn) { openCandidates(assignBtn.dataset.assign); return; }
    const unBtn = e.target.closest('[data-unassign]');
    if (unBtn) {
      try {
        await api('/admin/unassign', { method: 'POST', body: { requestId: unBtn.dataset.unassign } });
        toast(t('toast.unassigned'));
        loadAdmin();
      } catch (err) { toast(errText(err), true); }
    }
  });

  async function openCandidates(requestId) {
    state.candRequestId = requestId;
    const req = state.admin?.items.find((r) => r.id === requestId);
    $('#modalTitle').textContent = t('admin.candidates', { name: req?.studentName || '' });
    $('#modalSub').textContent = t('admin.candidates.sub');
    $('#candList').innerHTML = `<p class="mini">${t('browse.loading')}</p>`;
    $('#modal').hidden = false;
    try {
      const { candidates } = await api('/admin/candidates?requestId=' + encodeURIComponent(requestId));
      if (!candidates.length) {
        $('#candList').innerHTML = `<p class="mini">${esc(t('admin.noTeachers'))}</p>`;
        return;
      }
      $('#candList').innerHTML = candidates.map((c, i) => `
        <button class="cand" data-pick="${esc(c.teacher.id)}">
          <span class="cand-rank">${i + 1}</span>
          <span class="cand-main">
            <b>${esc(c.teacher.name)}</b>
            <span class="mini">${esc((c.teacher.profile.instruments || []).join(' / '))}${c.teacher.profile.rate ? ' · ¥' + c.teacher.profile.rate : ''} · ${esc(c.teacher.city || '')}</span>
            <span class="mini">${esc(c.reasons.map((r) => t('admin.reason.' + r)).join(' · '))} · ${esc(t('admin.load', { n: c.load }))}</span>
          </span>
          <span class="cand-score">${c.score}</span>
        </button>`).join('');
    } catch (err) {
      $('#candList').innerHTML = '';
      toast(errText(err), true);
    }
  }

  $('#candList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b || !state.candRequestId) return;
    try {
      await api('/admin/assign', {
        method: 'POST',
        body: { requestId: state.candRequestId, teacherId: b.dataset.pick },
      });
      $('#modal').hidden = true;
      toast(t('toast.assigned'));
      loadAdmin();
    } catch (err) {
      toast(errText(err), true);
    }
  });

  $('#modalCancel').addEventListener('click', () => { $('#modal').hidden = true; });
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; });

  // ------------------------------------------------------------------ 我的资料
  function teacherFieldsHTML() {
    return `
    <div class="grid2">
      <label><span>${esc(t('auth.nationality'))}</span>
        <input name="nationality" data-k="nationality" maxlength="40" placeholder="${esc(t('auth.nationality.ph'))}" /></label>
      <label><span>${esc(t('auth.languages'))}</span>
        <input name="languages" data-k="languages" placeholder="${esc(t('auth.languages.ph'))}" /></label>
    </div>
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
    <label><span>${esc(t('auth.qualif'))}</span>
      <textarea name="qualifications" data-k="qualifications" rows="3" maxlength="600" placeholder="${esc(t('auth.qualif.ph'))}"></textarea></label>
    <label><span>${esc(t('auth.education'))}</span>
      <input name="education" data-k="education" placeholder="${esc(t('auth.education.ph'))}" /></label>
    <label><span>${esc(t('auth.intro.teacher'))}</span>
      <textarea name="intro" data-k="intro" rows="4" maxlength="1200" placeholder="${esc(t('auth.intro.teacher.ph'))}"></textarea></label>`;
  }

  function studentFieldsHTML() {
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

    $('#profileFields').innerHTML = u.role === 'teacher' ? teacherFieldsHTML()
      : u.role === 'student' ? studentFieldsHTML() : '';

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
      state.me = { ...state.me, ...user, email: user.email || state.me.email };
      paintAuth();
      renderProfile();
      okBox.hidden = false;
      toast(t('toast.saved'));
    } catch (err) {
      errBox.textContent = errText(err);
      errBox.hidden = false;
    }
  });

  // ------------------------------------------------------------------ 启动
  (async function boot() {
    apply();
    await refreshMe();
    const hash = location.hash.replace('#', '');
    if (hash && VIEWS.includes(hash)) go(hash);
    else if (state.me) go(DEFAULT_VIEW[state.me.role] || 'home');
    else go('home');
  })();
})();
