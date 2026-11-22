/* 知音配对 · 中英切换（零依赖，前端词典） */
window.I18N = (() => {
  'use strict';

  const LS_KEY = 'mm_lang';
  const SUPPORTED = ['zh', 'en'];
  const listeners = new Set();

  const dict = {
    zh: {
      'meta.title': '知音配对 · 找一位合适的音乐老师',
      'meta.desc': '知音配对：学生 / 家长 与音乐老师互相配对。老师填写教的乐器、级别、课时费；家长和学生填写想学什么、目标、预算，互相看得见，合适就配。',

      'brand.name': '知音配对',
      'brand.sub': 'MUSICMATCH',
      'nav.browse': '找配对',
      'nav.requests': '我的配对',
      'nav.profile': '我的资料',
      'nav.login': '登录',
      'nav.register': '免费注册',
      'nav.logout': '退出',
      'lang.zh': '中',
      'lang.en': 'EN',

      'home.eyebrow': '钢琴 · 小提琴 · 声乐 · 吉他 · 古筝 · 架子鼓 · 更多',
      'home.title.a': '找到那位',
      'home.title.hl': '听得懂你',
      'home.title.b': '的音乐老师',
      'home.lead1': '这里不讲排名，只讲合不合适。',
      'home.lead2': '老师写清自己怎么教，学生和家长写清自己想学什么 —— 双方都看得见，看顺眼了再互相点一次「想认识」。',
      'home.cta.family': '我是学生 / 家长',
      'home.cta.teacher': '我是音乐老师',
      'home.stat.teachers': '位老师',
      'home.stat.families': '位学生 / 家长',
      'home.stat.pairs': '对已配对',

      'role.family': '家长 / 学生',
      'role.teacher': '音乐老师',
      'role.family.card.title': '家长 / 学生',
      'role.family.b1': '写下想学的乐器、现在的水平和目标',
      'role.family.b2': '填预算和上课方式（线上 / 线下 / 都行）',
      'role.family.b3': '浏览正在收学生的老师，按乐器、城市、课时费筛',
      'role.family.b4': '老师回你之后，双方才看到联系方式',
      'role.family.cta': '创建学生账号',
      'role.teacher.card.title': '音乐老师',
      'role.teacher.b1': '写清教的乐器、可教级别、教龄和资质',
      'role.teacher.b2': '定课时费和授课方式，学生先看得见再决定',
      'role.teacher.b3': '浏览附近正在找老师的学生需求',
      'role.teacher.b4': '你同意之后，才会把联系方式交出去',
      'role.teacher.cta': '创建老师账号',

      'how.title': '怎么个配对法',
      'how.s1.t': '1 · 选身份',
      'how.s1.d': '老师，或者家长 / 学生。一个账号只用一种，资料字段完全不一样。',
      'how.s2.t': '2 · 填资料',
      'how.s2.d': '乐器、级别、预算或课时费、城市、授课方式。填得越具体，越容易被对上。',
      'how.s3.t': '3 · 点「想认识」',
      'how.s3.d': '只能一位老师配一位学生，所以先看资料再动手，别群发。',
      'how.s4.t': '4 · 双方同意才见面',
      'how.s4.d': '对方同意，两个人才互相看到邮箱；拒绝也不会通知得太难看。',

      'cta.title': '先注册，再慢慢挑',
      'cta.sub': '免费、不用手机号。想换身份？换个邮箱再注册一个就好。',
      'cta.btn': '现在开始',

      'foot.main': '知音配对 · MusicMatch — 一个把学生和音乐老师放在同一张桌子上的小站。',
      'foot.fine': '双方同意后才交换联系方式 · 不公开手机号 · 遇到骚扰可以直接拒绝并删除请求',

      'auth.login.title': '欢迎回来',
      'auth.login.sub': '登录后可以看配对请求、改资料。',
      'auth.email': '邮箱',
      'auth.email.ph': 'you@example.com',
      'auth.password': '密码',
      'auth.password.ph': '至少 8 位',
      'auth.login.btn': '登录',
      'auth.noaccount': '还没有账号？',
      'auth.goRegister': '免费注册',
      'auth.hasAccount': '已经有账号？',
      'auth.goLogin': '直接登录',

      'auth.reg.title': '创建账号',
      'auth.reg.sub': '先选身份 —— 这一步决定你之后要填哪些资料，注册后不能改。',
      'auth.role.family': '家长 / 学生',
      'auth.role.family.sub': '我要找老师',
      'auth.role.teacher': '音乐老师',
      'auth.role.teacher.sub': '我在收学生',
      'auth.name': '名字 / 昵称',
      'auth.name.ph': '怎么称呼你',
      'auth.city': '城市',
      'auth.city.ph': '例如 杭州',
      'auth.email.ph2': '用来登录，也只对你同意的人可见',

      'auth.teacher.legend': '老师的资料',
      'auth.instruments.teacher': '教的乐器（可多个，逗号分隔）',
      'auth.instruments.teacher.ph': '钢琴、乐理',
      'auth.levels': '可教级别',
      'auth.years': '教龄（年）',
      'auth.rate': '课时费（元 / 课时）',
      'auth.mode': '授课方式',
      'auth.styles': '风格 / 流派',
      'auth.styles.ph': '古典、流行、爵士…',
      'auth.education': '院校 / 资质',
      'auth.education.ph': '例：上音钢琴表演，十级，教龄 8 年',
      'auth.intro.teacher': '介绍一下你的课',
      'auth.intro.teacher.ph': '你怎么带零基础的学生？一节课大概什么节奏？',

      'auth.family.legend': '学生 / 家长的资料',
      'auth.instruments.family': '想学的乐器（可多个，逗号分隔）',
      'auth.instruments.family.ph': '钢琴、乐理',
      'auth.level': '现在的水平',
      'auth.studentAge': '学生年龄',
      'auth.studentAge.ph': '8 岁 / 成人 / 初二',
      'auth.budget': '预算（元 / 课时）',
      'auth.goal': '目标 / 诉求',
      'auth.goal.ph': '考级、兴趣、想弹一首喜欢的曲子…',
      'auth.intro.family': '补充说明',
      'auth.intro.family.ph': '家里有琴吗？每周能练多久？希望老师什么风格？',

      'auth.submit.pick': '先选一个身份',
      'auth.submit.family': '创建学生账号',
      'auth.submit.teacher': '创建老师账号',

      'browse.title.teacher': '找一位音乐老师',
      'browse.title.family': '看看谁在找老师',
      'browse.sub.teacher': '按乐器、城市、课时费筛一筛，看到合适的就点「想认识」。',
      'browse.sub.family': '这些是学生 / 家长留下的需求，对得上的就点「想认识」。',
      'browse.tab.teacher': '看老师',
      'browse.tab.family': '看学生需求',
      'browse.empty': '这里还没有符合条件的资料。换个筛选条件，或者过会儿再来看看。',
      'browse.loading': '加载中…',

      'filters.instrument': '乐器',
      'filters.instrument.ph': '钢琴 / 小提琴…',
      'filters.city': '城市',
      'filters.city.ph': '杭州',
      'filters.mode': '授课方式',
      'filters.maxRate': '预算上限',
      'filters.rate200': '¥200 以下',
      'filters.rate300': '¥300 以下',
      'filters.rate400': '¥400 以下',
      'filters.any': '不限',
      'filters.keyword': '关键词',
      'filters.keyword.ph': '爵士 / 考级 / 成人…',
      'filters.apply': '筛选',
      'filters.reset': '清空',

      'req.title': '我的配对',
      'req.sub': '对方同意之后，两个人的邮箱才会互相出现。',
      'req.incoming': '收到的请求',
      'req.incoming.empty': '还没有人给你发请求。',
      'req.outgoing': '我发出的请求',
      'req.outgoing.empty': '你还没主动找过谁。',
      'req.accept': '同意配对',
      'req.decline': '谢绝',
      'req.withdraw': '撤回',
      'req.contact': '联系方式',
      'req.status.pending': '等待回复',
      'req.status.accepted': '已配对',
      'req.status.declined': '已谢绝',

      'card.accepted': '已配对 ✓',
      'card.pending': '等对方回复…',
      'card.match': '想认识',
      'card.retry': '再试一次',
      'card.cityMissing': '城市未填',
      'card.noIntro': '还没写介绍',
      'card.rate': '¥{n} / 课时',
      'card.years': '教龄 {n} 年',
      'card.budget': '预算 ¥{n}',

      'profile.title': '我的资料',
      'profile.sub': '资料越具体，越容易被对的人找到。',
      'profile.emailLocked': '邮箱（登录用，不可改）',
      'profile.created': '注册时间',
      'profile.save': '保存资料',
      'profile.saved': '已保存 ✓',

      'modal.title': '想认识 {name}',
      'modal.sub': '发一条请求过去。对方同意后，你们才会互相看到邮箱。',
      'modal.msg.ph': '说一句你想学什么 / 你能教什么（可不填）',
      'modal.cancel': '取消',
      'modal.send': '发出请求',

      'toast.loginFirst': '先登录一下吧',
      'toast.registered': '账号建好了，欢迎',
      'toast.welcome': '欢迎回来，{name}',
      'toast.loggedOut': '已退出',
      'toast.sent': '请求发出去了，等对方回复',
      'toast.matched': '配上了，可以联系对方了',
      'toast.declined': '已谢绝',
      'toast.withdrawn': '已撤回',
      'toast.saved': '资料已保存',

      'level.zero': '零基础',
      'level.beginner': '入门',
      'level.intermediate': '进阶',
      'level.advanced': '高级',
      'level.pro': '艺考 / 专业',
      'mode.online': '线上',
      'mode.offline': '线下',
      'mode.both': '线上 + 线下',

      'err.role_required': '请选择身份：老师 或 家长/学生',
      'err.name_short': '名字至少 2 个字',
      'err.email_invalid': '邮箱格式不对',
      'err.password_short': '密码至少 8 位',
      'err.email_taken': '这个邮箱已经注册过了',
      'err.bad_credentials': '邮箱或密码不对',
      'err.not_logged_in': '请先登录',
      'err.same_role': '需要一位老师 + 一位家长/学生 才能配对',
      'err.self_match': '不能和自己配对',
      'err.already_matched': '你们已经配上了',
      'err.already_pending': '已经有一条待回复的请求了',
      'err.not_found': '找不到这条记录',
      'err.not_recipient': '只有收到邀请的一方能回复',
      'err.already_handled': '这条请求已经处理过了',
      'err.rate_limited': '操作太频繁了，请稍后再试',
    },

    en: {
      'meta.title': 'MusicMatch · Find the right music teacher',
      'meta.desc': 'MusicMatch pairs students and parents with music teachers. Teachers list their instruments, levels and rates; families say what they want to learn and what they can spend. Both sides see everything, and match when it fits.',

      'brand.name': 'MusicMatch',
      'brand.sub': 'STUDENT × TEACHER',
      'nav.browse': 'Browse',
      'nav.requests': 'My matches',
      'nav.profile': 'My profile',
      'nav.login': 'Log in',
      'nav.register': 'Sign up free',
      'nav.logout': 'Log out',
      'lang.zh': '中',
      'lang.en': 'EN',

      'home.eyebrow': 'Piano · Violin · Voice · Guitar · Guzheng · Drums · and more',
      'home.title.a': 'Find a music teacher ',
      'home.title.hl': 'who gets you',
      'home.title.b': '',
      'home.lead1': 'No leaderboards here — only whether it fits.',
      'home.lead2': 'Teachers spell out how they teach. Students and parents spell out what they want. You both see everything, and only say hi when it feels right.',
      'home.cta.family': "I'm a student / parent",
      'home.cta.teacher': "I'm a music teacher",
      'home.stat.teachers': 'teachers',
      'home.stat.families': 'students & parents',
      'home.stat.pairs': 'pairs matched',

      'role.family': 'Parent / student',
      'role.teacher': 'Music teacher',
      'role.family.card.title': 'Parents & students',
      'role.family.b1': 'Say which instrument, your level, and what you want',
      'role.family.b2': 'Set a budget and a format: online, in person, or either',
      'role.family.b3': 'Browse teachers taking students, filtered by instrument, city and rate',
      'role.family.b4': 'Contact details appear only after the teacher says yes',
      'role.family.cta': 'Create a student account',
      'role.teacher.card.title': 'Music teachers',
      'role.teacher.b1': 'List your instruments, levels, years of experience and credentials',
      'role.teacher.b2': 'Set your rate and format — students see it all before deciding',
      'role.teacher.b3': 'Browse nearby students who are looking for a teacher',
      'role.teacher.b4': 'Your contact details go out only after you agree',
      'role.teacher.cta': 'Create a teacher account',

      'how.title': 'How matching works',
      'how.s1.t': '1 · Pick a side',
      'how.s1.d': 'Teacher, or parent / student. One account, one role — the profile fields are completely different.',
      'how.s2.t': '2 · Fill in your profile',
      'how.s2.d': 'Instrument, level, budget or rate, city, format. The more concrete you are, the easier you are to match.',
      'how.s3.t': '3 · Say hi',
      'how.s3.d': 'One teacher pairs with one student, so read the profile first — no spraying requests around.',
      'how.s4.t': '4 · Both sides agree',
      'how.s4.d': 'Emails are revealed only when the other person agrees. A decline stays quiet.',

      'cta.title': 'Sign up, then take your time',
      'cta.sub': 'Free, no phone number. Need the other role? Just register again with another email.',
      'cta.btn': 'Get started',

      'foot.main': 'MusicMatch — a small site that puts students and music teachers at the same table.',
      'foot.fine': 'Contact details only after mutual agreement · no phone numbers published · decline and remove requests anytime',

      'auth.login.title': 'Welcome back',
      'auth.login.sub': 'Log in to see your match requests and edit your profile.',
      'auth.email': 'Email',
      'auth.email.ph': 'you@example.com',
      'auth.password': 'Password',
      'auth.password.ph': 'At least 8 characters',
      'auth.login.btn': 'Log in',
      'auth.noaccount': 'New here?',
      'auth.goRegister': 'Create an account',
      'auth.hasAccount': 'Already have an account?',
      'auth.goLogin': 'Log in',

      'auth.reg.title': 'Create an account',
      'auth.reg.sub': "Pick your role first — it decides which profile fields you get, and it can't be changed later.",
      'auth.role.family': 'Parent / student',
      'auth.role.family.sub': "I'm looking for a teacher",
      'auth.role.teacher': 'Music teacher',
      'auth.role.teacher.sub': "I'm taking students",
      'auth.name': 'Name / nickname',
      'auth.name.ph': 'What should we call you',
      'auth.city': 'City',
      'auth.city.ph': 'e.g. Hangzhou',
      'auth.email.ph2': 'For login; only shown to people you approve',

      'auth.teacher.legend': 'Teacher details',
      'auth.instruments.teacher': 'Instruments you teach (comma separated)',
      'auth.instruments.teacher.ph': 'Piano, music theory',
      'auth.levels': 'Levels you teach',
      'auth.years': 'Years teaching',
      'auth.rate': 'Rate (¥ per lesson)',
      'auth.mode': 'Lesson format',
      'auth.styles': 'Styles',
      'auth.styles.ph': 'Classical, pop, jazz…',
      'auth.education': 'School / credentials',
      'auth.education.ph': 'e.g. Shanghai Conservatory, piano performance, grade 10',
      'auth.intro.teacher': 'Tell students about your lessons',
      'auth.intro.teacher.ph': 'How do you work with complete beginners? What does one lesson look like?',

      'auth.family.legend': 'Student / parent details',
      'auth.instruments.family': 'Instruments you want to learn (comma separated)',
      'auth.instruments.family.ph': 'Piano, music theory',
      'auth.level': 'Current level',
      'auth.studentAge': 'Student age',
      'auth.studentAge.ph': '8 / adult / grade 8',
      'auth.budget': 'Budget (¥ per lesson)',
      'auth.goal': 'Goal',
      'auth.goal.ph': 'Grades, for fun, a song you love…',
      'auth.intro.family': 'Anything else',
      'auth.intro.family.ph': 'Do you have an instrument at home? How often can you practise? What teaching style do you want?',

      'auth.submit.pick': 'Pick a role first',
      'auth.submit.family': 'Create student account',
      'auth.submit.teacher': 'Create teacher account',

      'browse.title.teacher': 'Find a music teacher',
      'browse.title.family': "See who's looking for a teacher",
      'browse.sub.teacher': 'Filter by instrument, city and rate — then hit 「Say hi」.',
      'browse.sub.family': 'These are students and parents looking for lessons. If you fit, say hi.',
      'browse.tab.teacher': 'Teachers',
      'browse.tab.family': 'Students',
      'browse.empty': 'Nothing matches those filters yet. Try widening them, or check back later.',
      'browse.loading': 'Loading…',

      'filters.instrument': 'Instrument',
      'filters.instrument.ph': 'Piano / violin…',
      'filters.city': 'City',
      'filters.city.ph': 'Hangzhou',
      'filters.mode': 'Format',
      'filters.maxRate': 'Budget cap',
      'filters.rate200': 'Under ¥200',
      'filters.rate300': 'Under ¥300',
      'filters.rate400': 'Under ¥400',
      'filters.any': 'Any',
      'filters.keyword': 'Keyword',
      'filters.keyword.ph': 'jazz / grades / adult…',
      'filters.apply': 'Filter',
      'filters.reset': 'Clear',

      'req.title': 'My matches',
      'req.sub': 'Emails are revealed only once both sides agree.',
      'req.incoming': 'Requests received',
      'req.incoming.empty': 'No requests yet.',
      'req.outgoing': 'Requests sent',
      'req.outgoing.empty': "You haven't reached out to anyone yet.",
      'req.accept': 'Accept',
      'req.decline': 'Decline',
      'req.withdraw': 'Withdraw',
      'req.contact': 'Contact',
      'req.status.pending': 'Awaiting reply',
      'req.status.accepted': 'Matched',
      'req.status.declined': 'Declined',

      'card.accepted': 'Matched ✓',
      'card.pending': 'Waiting for a reply…',
      'card.match': 'Say hi',
      'card.retry': 'Try again',
      'card.cityMissing': 'City not set',
      'card.noIntro': 'No description yet',
      'card.rate': '¥{n} / lesson',
      'card.years': '{n} yrs teaching',
      'card.budget': 'Budget ¥{n}',

      'profile.title': 'My profile',
      'profile.sub': 'The more specific you are, the easier you are to find.',
      'profile.emailLocked': 'Email (for login, can’t be changed)',
      'profile.created': 'Joined',
      'profile.save': 'Save profile',
      'profile.saved': 'Saved ✓',

      'modal.title': 'Say hi to {name}',
      'modal.sub': 'Send a request. Emails are revealed only when you both agree.',
      'modal.msg.ph': 'One line about what you want to learn or teach (optional)',
      'modal.cancel': 'Cancel',
      'modal.send': 'Send request',

      'toast.loginFirst': 'Please log in first',
      'toast.registered': 'Account created — welcome',
      'toast.welcome': 'Welcome back, {name}',
      'toast.loggedOut': 'Logged out',
      'toast.sent': 'Request sent — waiting for a reply',
      'toast.matched': 'Matched — you can contact each other now',
      'toast.declined': 'Declined',
      'toast.withdrawn': 'Withdrawn',
      'toast.saved': 'Profile saved',

      'level.zero': 'Absolute beginner',
      'level.beginner': 'Beginner',
      'level.intermediate': 'Intermediate',
      'level.advanced': 'Advanced',
      'level.pro': 'Exam / pro track',
      'mode.online': 'Online',
      'mode.offline': 'In person',
      'mode.both': 'Online + in person',

      'err.role_required': 'Pick a role: teacher, or parent / student',
      'err.name_short': 'Name needs at least 2 characters',
      'err.email_invalid': 'That email doesn’t look right',
      'err.password_short': 'Password needs at least 8 characters',
      'err.email_taken': 'That email is already registered',
      'err.bad_credentials': 'Wrong email or password',
      'err.not_logged_in': 'Please log in',
      'err.same_role': 'A match needs one teacher and one parent / student',
      'err.self_match': 'You can’t match with yourself',
      'err.already_matched': 'You two are already matched',
      'err.already_pending': 'There’s already a pending request',
      'err.not_found': 'Not found',
      'err.not_recipient': 'Only the person who received the request can reply',
      'err.already_handled': 'That request was already handled',
      'err.rate_limited': 'Too many attempts — please wait a moment',
    },
  };

  let lang = (() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (SUPPORTED.includes(saved)) return saved;
    } catch { /* 隐私模式 */ }
    return (navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  })();

  function t(key, vars) {
    let s = dict[lang]?.[key];
    if (s === undefined) s = dict.zh[key] !== undefined ? dict.zh[key] : key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
    }
    return s;
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('meta.title');
    const md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', t('meta.desc'));
    document.querySelectorAll('[data-lang]').forEach((b) => {
      b.classList.toggle('on', b.dataset.lang === lang);
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
  }

  function setLang(next) {
    if (!SUPPORTED.includes(next) || next === lang) return;
    lang = next;
    try { localStorage.setItem(LS_KEY, lang); } catch { /* 忽略 */ }
    apply();
    listeners.forEach((fn) => { try { fn(lang); } catch (e) { console.error(e); } });
  }

  // 数据里存的是中文枚举，展示时翻译
  const LEVEL_KEY = {
    '零基础': 'level.zero', '入门': 'level.beginner', '进阶': 'level.intermediate',
    '高级': 'level.advanced', '艺考 / 专业': 'level.pro',
  };
  const MODE_KEY = { '线上': 'mode.online', '线下': 'mode.offline', '线上 + 线下': 'mode.both' };
  const levelLabel = (v) => (v ? t(LEVEL_KEY[v] || v) : '');
  const modeLabel = (v) => (v ? t(MODE_KEY[v] || v) : '');

  // 服务端错误码 → 本地文案
  function errText(err) {
    const code = err && err.code;
    if (code && dict[lang]?.['err.' + code]) return t('err.' + code);
    return (err && err.message) || String(err);
  }

  return {
    t, apply, setLang, levelLabel, modeLabel, errText,
    get lang() { return lang; },
    onChange(fn) { listeners.add(fn); },
  };
})();
