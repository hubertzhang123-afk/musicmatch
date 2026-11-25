/* 知音配对 · 前端（学生提申请 / 老师接学生 / 管理员监督） */
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
    pool: null,
    students: null,
    admin: null,
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
      { view: 'pool', key: 'nav.pool', badge: 'pool' },
      { view: 'mystudents', key: 'nav.myStudents' },
      { view: 'browse', key: 'nav.browseStudents' },
      { view: 'profile', key: 'nav.profile' },
    ],
    admin: [
      { view: 'admin', key: 'nav.admin' },
      { view: 'pool', key: 'nav.pool', badge: 'pool' },
      { view: 'mystudents', key: 'nav.myStudents' },
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
    const n = state.me?.counts?.pool || 0;
    badge.hidden = n <= 0;
    badge.textContent = n;
  }

  const DEFAULT_VIEW = { student: 'myrequest', teacher: 'pool', admin: 'admin' };

  // ------------------------------------------------------------------ 路由
  const VIEWS = ['home', 'login', 'register', 'browse', 'myrequest', 'pool', 'mystudents', 'admin', 'profile'];
  const NEED_AUTH = new Set(['browse', 'myrequest', 'pool', 'mystudents', 'admin', 'profile']);
  const ROLE_OF_VIEW = {
    myrequest: 'student',
    pool: ['teacher', 'admin'],
    mystudents: ['teacher', 'admin'],
    admin: 'admin',
  };

  function go(view, opts = {}) {
    if (!VIEWS.includes(view)) view = 'home';
    if (NEED_AUTH.has(view) && !state.me) {
      toast(t('toast.loginFirst'));
      view = 'login';
    }
    const need = ROLE_OF_VIEW[view];
    if (need && state.me) {
      const ok = Array.isArray(need) ? need.includes(state.me.role) : state.me.role === need;
      if (!ok) view = DEFAULT_VIEW[state.me.role] || 'home';
    }
    state.view = view;
    VIEWS.forEach((v) => { $('#view-' + v).hidden = v !== view; });
    if (state.me) {
      $$('.navlink').forEach((b) => b.classList.toggle('on', b.dataset.go === view));
    }
    if (view === 'register' && opts.role) pickRole(opts.role);
    if (view === 'browse') loadBrowse();
    if (view === 'myrequest') loadMyRequest();
    if (view === 'pool') loadPool();
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
    if (state.view === 'pool') renderPool();
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
    state.pool = null;
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
    return state.me?.role === 'student' ? 'teacher' : 'student';
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
      if (p.years) tags.push(`<span class="tag">${esc(t('card.years', { n: p.years }))}</span>`);
    } else {
      if (p.level) tags.push(`<span class="tag">${esc(levelLabel(p.level))}</span>`);
      if (p.studentAge) tags.push(`<span class="tag">${esc(p.studentAge)}</span>`);
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
        <span class="role-tag">${esc(roleLabel(it.role))}</span>
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
      : req.teacherId ? t('req2.status.taken') : t('req2.status.waiting');
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
            <span class="mini"> · ${esc(roleLabel(data.teacher.role))}</span>
            <div class="mini">${esc((p.instruments || []).join(' / '))}${p.mode ? ' · ' + esc(modeLabel(p.mode)) : ''}${p.years ? ' · ' + esc(t('card.years', { n: p.years })) : ''}</div>
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

  // ------------------------------------------------------------------ 申请池（老师 / 管理员）
  async function loadPool() {
    try {
      const { items } = await api('/pool');
      state.pool = items;
      renderPool();
      await refreshMe();
    } catch (err) {
      toast(errText(err), true);
    }
  }

  function renderPool() {
    const items = state.pool || [];
    $('#poolCount').textContent = t('pool.count', { n: items.length });
    $('#poolEmpty').hidden = items.length > 0;
    $('#poolList').innerHTML = items.map((r) => `
      <div class="req">
        <span class="avatar">${esc((r.studentName || '学').slice(0, 1))}</span>
        <div class="body">
          <b>${esc(r.studentName)}</b>
          <span class="mini"> · ${esc(r.instrument)}</span>
          <div class="mini">${esc(r.times || t('admin.noTimes'))}</div>
          ${r.student?.profile?.level ? `<div class="mini">${esc(t('req2.level'))}：${esc(levelLabel(r.student.profile.level))}${r.student.profile.studentAge ? ' · ' + esc(r.student.profile.studentAge) : ''}</div>` : ''}
          ${r.note ? `<p class="msg">“${esc(r.note)}”</p>` : ''}
          <p class="mini">${esc(t('req.contact'))}：<span class="emailpill">${esc(r.contact)}</span></p>
        </div>
        <div class="actions">
          <button class="btn solid sm" data-claim="${esc(r.id)}">${esc(t('pool.claim'))}</button>
        </div>
      </div>`).join('');
  }

  $('#view-pool').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-claim]');
    if (!b) return;
    try {
      await api('/claim', { method: 'POST', body: { requestId: b.dataset.claim } });
      toast(t('toast.claimed'));
      await loadPool();
    } catch (err) {
      toast(errText(err), true);
      loadPool();
    }
  });

  // ------------------------------------------------------------------ 我的学生
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
    $('#myStudentCount').textContent = t('my.count', { n: list.length });
    $('#studentsEmpty').hidden = list.length > 0;
    $('#studentList').innerHTML = list.map((s) => `
      <div class="req">
        <span class="avatar">${esc((s.studentName || '学').slice(0, 1))}</span>
        <div class="body">
          <b>${esc(s.studentName)}</b>
          <span class="mini"> · ${esc(s.instrument)}</span>
          <div class="mini">${esc(s.times || t('my.noTimes'))}</div>
          ${s.note ? `<p class="msg">“${esc(s.note)}”</p>` : ''}
          <p class="mini">${esc(t('req.contact'))}：<span class="emailpill">${esc(s.contact || s.studentEmail || '')}</span></p>
        </div>
        <div class="actions">
          <button class="btn ghost sm" data-release="${esc(s.id)}">${esc(t('my.release'))}</button>
        </div>
      </div>`).join('');
  }

  $('#view-mystudents').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-release]');
    if (!b) return;
    try {
      await api('/release', { method: 'POST', body: { requestId: b.dataset.release } });
      toast(t('toast.released'));
      await loadMyStudents();
      await refreshMe();
    } catch (err) {
      toast(errText(err), true);
    }
  });

  // ------------------------------------------------------------------ 管理员：全站监督
  async function loadAdmin() {
    try {
      const [overview, requests, teachers] = await Promise.all([
        api('/admin/overview'),
        api('/admin/requests'),
        api('/admin/teachers'),
      ]);
      state.admin = { overview, requests: requests.items, teachers: teachers.items };
      renderAdmin();
      await refreshMe();
    } catch (err) {
      toast(errText(err), true);
    }
  }

  function renderAdmin() {
    const data = state.admin;
    if (!data) return;
    const { totals } = data.overview;
    $('#adminStats').innerHTML = `
      <span><b>${totals.teachers + totals.admins}</b> ${t('admin.stat.staff')}</span>
      <span><b>${totals.students}</b> ${t('admin.stat.students')}</span>
      <span><b>${totals.pending}</b> ${t('admin.stat.pending')}</span>
      <span><b>${totals.assigned}</b> ${t('admin.stat.assigned')}</span>`;

    $('#adminAllEmpty').hidden = data.requests.length > 0;
    $('#adminAll').innerHTML = data.requests.map((r) => `
      <div class="req">
        <span class="avatar">${esc((r.studentName || '学').slice(0, 1))}</span>
        <div class="body">
          <b>${esc(r.studentName)}</b>
          <span class="mini"> · ${esc(r.instrument)}</span>
          <div class="mini">${esc(t('req2.times'))}：${esc(r.times || t('admin.noTimes'))}</div>
          <div class="mini">${esc(t('req.contact'))}：${esc(r.contact)}${r.student?.email && r.student.email !== r.contact ? ` · ${esc(r.student.email)}` : ''}</div>
          ${r.note ? `<p class="msg">“${esc(r.note)}”</p>` : ''}
        </div>
        <div class="actions">
          ${r.teacher
            ? `<span class="statuspill accepted">${esc(t('admin.takenBy', { name: r.teacher.name }))}</span>
               <button class="btn ghost sm" data-release="${esc(r.id)}">${esc(t('admin.release'))}</button>`
            : `<span class="statuspill pending">${esc(t('admin.waiting'))}</span>`}
        </div>
      </div>`).join('');

    $('#adminTeachersEmpty').hidden = data.teachers.length > 0;
    $('#adminTeachers').innerHTML = data.teachers.map((tt) => {
      const p = tt.profile || {};
      return `
      <article class="tcard">
        <div class="tcard-head">
          <span class="avatar">${esc(tt.name.slice(0, 1))}</span>
          <div>
            <b>${esc(tt.name)}</b>
            <span class="mini"> · ${esc(roleLabel(tt.role))}${tt.city ? ' · ' + esc(tt.city) : ''}</span>
          </div>
        </div>
        <div class="mini">${esc((p.instruments || []).join(' / ') || '—')}${p.mode ? ' · ' + esc(modeLabel(p.mode)) : ''}${p.years ? ' · ' + esc(t('card.years', { n: p.years })) : ''}</div>
        ${p.nationality || p.languages?.length ? `<div class="mini">${esc([p.nationality, (p.languages || []).join(' / ')].filter(Boolean).join(' · '))}</div>` : ''}
        ${p.qualifications ? `<div class="mini">${esc(p.qualifications)}</div>` : ''}
        <div class="mini"><a href="mailto:${esc(tt.email)}">${esc(tt.email)}</a></div>
        <div class="tcard-students">
          <b class="mini">${esc(t('admin.studentsOf', { n: tt.students.length }))}</b>
          ${tt.students.length
            ? tt.students.map((s) => `<div class="mini">· ${esc(s.studentName)} — ${esc(s.instrument)}${s.times ? ' · ' + esc(s.times) : ''}</div>`).join('')
            : `<div class="mini">${esc(t('admin.noneYet'))}</div>`}
        </div>
      </article>`;
    }).join('');
  }

  $('#adminRefresh').addEventListener('click', () => loadAdmin());

  $('#view-admin').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-release]');
    if (!b) return;
    try {
      await api('/release', { method: 'POST', body: { requestId: b.dataset.release } });
      toast(t('toast.released'));
      loadAdmin();
    } catch (err) {
      toast(errText(err), true);
    }
  });

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
      <label><span>${esc(t('auth.mode'))}</span>
        <select name="mode" data-k="mode">
          <option value="线上 + 线下">${esc(t('mode.both'))}</option>
          <option value="线下">${esc(t('mode.offline'))}</option>
          <option value="线上">${esc(t('mode.online'))}</option>
        </select></label>
    </div>
    <div class="grid2">
      <label><span>${esc(t('auth.styles'))}</span>
        <input name="styles" data-k="styles" placeholder="${esc(t('auth.styles.ph'))}" /></label>
      <label><span>${esc(t('auth.education'))}</span>
        <input name="education" data-k="education" placeholder="${esc(t('auth.education.ph'))}" /></label>
    </div>
    <label><span>${esc(t('auth.qualif'))}</span>
      <textarea name="qualifications" data-k="qualifications" rows="3" maxlength="600" placeholder="${esc(t('auth.qualif.ph'))}"></textarea></label>
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
      <label><span>${esc(t('auth.mode'))}</span>
        <select name="mode" data-k="mode">
          <option value="线上 + 线下">${esc(t('mode.both'))}</option>
          <option value="线下">${esc(t('mode.offline'))}</option>
          <option value="线上">${esc(t('mode.online'))}</option>
        </select></label>
    </div>
    <label><span>${esc(t('auth.goal'))}</span>
      <input name="goal" data-k="goal" maxlength="160" placeholder="${esc(t('auth.goal.ph'))}" /></label>
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

    const staff = u.role === 'teacher' || u.role === 'admin';
    $('#profileFields').innerHTML = staff ? teacherFieldsHTML() : studentFieldsHTML();

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
