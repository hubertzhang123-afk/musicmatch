/* 知音配对 · 中英切换（零依赖，前端词典） */
window.I18N = (() => {
  'use strict';

  const LS_KEY = 'mm_lang';
  const SUPPORTED = ['zh', 'en'];
  const listeners = new Set();

  const dict = {
    zh: {
      'meta.title': '知音配对 · 学生提申请，老师来接',
      'meta.desc': '学生提交申请，老师按自己的专长挑学生；管理员由老师兼任，能看到全站资料与分配状态。',

      'brand.name': '知音配对',
      'brand.sub': 'MUSICMATCH',

      'nav.browseTeacher': '看看老师',
      'nav.browseStudents': '看看学生',
      'nav.myRequest': '我的申请',
      'nav.myStudents': '我的学生',
      'nav.pool': '可接学生',
      'nav.admin': '管理台',
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
      'home.lead1': '学生写一张申请，老师按自己的专长来接。',
      'home.lead2': '不排名、不比价。老师看到申请里的乐器、时间和备注，觉得对得上就接走；接了就只属于你。',
      'home.cta.student': '我是学生',
      'home.cta.teacher': '我是音乐老师',
      'home.stat.teachers': '位老师',
      'home.stat.students': '位学生',
      'home.stat.pairs': '位已配对',

      'role.student': '学生',
      'role.teacher': '音乐老师',
      'role.admin': '管理员（老师）',

      'role.student.card.title': '学生',
      'role.student.b1': '填一张申请：想学什么、什么时间方便、怎么联系',
      'role.student.b2': '申请会出现在老师的「学生申请」里',
      'role.student.b3': '被哪位老师接走，就直接看到他的资料和联系方式',
      'role.student.b4': '随时修改申请，接你的老师同步更新',
      'role.student.cta': '创建学生账号',

      'role.teacher.card.title': '音乐老师',
      'role.teacher.b1': '作品集：姓名、国籍、教学语言、各乐器资质',
      'role.teacher.b2': '在「学生申请」里按专长挑学生，点一下就接走',
      'role.teacher.b3': '接到的学生立刻显示资料、时间和联系方式',
      'role.teacher.b4': '接错了可以放回申请池，别人还能接',
      'role.teacher.cta': '创建老师账号',

      'role.admin.card.title': '管理员',
      'role.admin.b1': '管理员本身就是老师，也带学生、也能接申请',
      'role.admin.b2': '额外能看到所有人的资料：老师、学生、联系方式',
      'role.admin.b3': '所有申请与分配状态、上课时间，一屏看完',
      'role.admin.b4': '必要时把某个学生放回申请池',
      'role.admin.note': '管理员账号由站点内部开设，不开放注册。',

      'how.title': '怎么个流程',
      'how.s1.t': '1 · 学生提申请',
      'how.s1.d': '乐器、上课时间、学生姓名、联系方式，一张表交给系统。',
      'how.s2.t': '2 · 老师看申请池',
      'how.s2.d': '所有还没人接的学生申请都在这里，按自己的专长挑。',
      'how.s3.t': '3 · 老师接学生',
      'how.s3.d': '点一下归你，别人看不到了；接错了可以放回去。',
      'how.s4.t': '4 · 管理员看全局',
      'how.s4.d': '所有老师、学生、分配状态和上课时间，一屏看清。',

      'cta.title': '先注册，再慢慢挑',
      'cta.sub': '免费、不用手机号。学生和老师同一个入口。',
      'cta.btn': '现在开始',

      'foot.main': '知音配对 · MusicMatch — 学生提申请，老师按专长来接，管理员看全局。',
      'foot.fine': '不排名 · 不比价 · 联系方式只给接到你的那位老师',

      'auth.login.title': '欢迎回来',
      'auth.login.sub': '学生看申请、老师看申请池、管理员看全局。',
      'auth.email': '邮箱',
      'auth.email.ph': 'you@example.com',
      'auth.email.ph2': '用来登录',
      'auth.password': '密码',
      'auth.password.ph': '至少 8 位',
      'auth.login.btn': '登录',
      'auth.noaccount': '还没有账号？',
      'auth.goRegister': '免费注册',
      'auth.hasAccount': '已经有账号？',
      'auth.goLogin': '直接登录',

      'auth.reg.title': '创建账号',
      'auth.reg.sub': '先选身份 —— 这一步决定你之后要填哪些资料，注册后不能改。',
      'auth.role.student': '学生',
      'auth.role.student.sub': '我要找老师',
      'auth.role.teacher': '音乐老师',
      'auth.role.teacher.sub': '我在收学生',
      'auth.name': '名字 / 昵称',
      'auth.name.ph': '怎么称呼你',

      'auth.teacher.legend': '老师作品集',
      'auth.nationality': '国籍 / 地区',
      'auth.nationality.ph': '例如 中国',
      'auth.languages': '教学语言',
      'auth.languages.ph': '中文、英语',
      'auth.qualif': '各乐器资质',
      'auth.qualif.ph': '例：钢琴 ABRSM 八级；乐理 上音硕士',
      'auth.instruments.teacher': '教的乐器（可多个，逗号分隔）',
      'auth.instruments.teacher.ph': '钢琴、乐理',
      'auth.levels': '可教级别',
      'auth.years': '教龄（年）',
      'auth.mode': '授课方式',
      'auth.styles': '风格 / 流派',
      'auth.styles.ph': '古典、流行、爵士…',
      'auth.education': '院校',
      'auth.education.ph': '例：上音钢琴表演',
      'auth.intro.teacher': '介绍一下你的课',
      'auth.intro.teacher.ph': '你怎么带零基础的学生？',

      'auth.student.legend': '学生资料',
      'auth.instruments.family': '想学的乐器（可多个，逗号分隔）',
      'auth.instruments.family.ph': '钢琴、乐理',
      'auth.level': '现在的水平',
      'auth.studentAge': '学生年龄',
      'auth.studentAge.ph': '8 岁 / 成人',
      'auth.goal': '目标 / 诉求',
      'auth.goal.ph': '考级、兴趣…',
      'auth.intro.family': '补充说明',
      'auth.intro.family.ph': '家里有琴吗？每周能练多久？',

      'auth.submit.pick': '先选一个身份',
      'auth.submit.student': '创建学生账号',
      'auth.submit.teacher': '创建老师账号',

      'browse.title.teacher': '看看老师们',
      'browse.title.student': '看看学生们',
      'browse.sub.teacher': '按乐器、城市、授课方式筛一筛。',
      'browse.sub.student': '这些是学生提交的申请，谁先接就归谁。',
      'browse.tab.teacher': '看老师',
      'browse.tab.student': '看学生',
      'browse.empty': '这里还没有符合条件的资料。',
      'browse.loading': '加载中…',

      'filters.instrument': '乐器',
      'filters.instrument.ph': '钢琴 / 小提琴…',
      'filters.mode': '授课方式',
      'filters.any': '不限',
      'filters.keyword': '关键词',
      'filters.keyword.ph': '爵士 / 考级 / 成人…',
      'filters.apply': '筛选',
      'filters.reset': '清空',

      'req2.title': '我的申请',
      'req2.sub': '写完就有老师能看到；被接走之后你会看到他的资料和联系方式。',
      'req2.noRequest': '还没提交',
      'req2.status.waiting': '等老师来接',
      'req2.status.taken': '已被老师接走',
      'req2.assignedTitle': '你的老师',
      'req2.instrument': '想学的乐器',
      'req2.instrument.ph': '钢琴 / 小提琴…',
      'req2.studentName': '学生姓名',
      'req2.studentName.ph': '孩子 / 本人姓名',
      'req2.contact': '联系方式',
      'req2.contact.ph': '手机 / 微信 / 邮箱',
      'req2.times': '方便的上课时间',
      'req2.times.ph': '周六上午、工作日 19 点后',
      'req2.note': '备注',
      'req2.note.ph': '目标、基础、家里有没有琴…',
      'req2.level': '水平',
      'req2.submit': '提交申请',
      'req2.saved': '已提交 ✓',

      'req.contact': '联系方式',

      'pool.title': '学生申请',
      'pool.sub': '这些学生还没人接。看乐器、时间、备注，对得上就接走。',
      'pool.empty': '现在没有待接的申请。',
      'pool.claim': '接这个学生',
      'pool.count': '待接 {n} 位',

      'my.title': '我的学生',
      'my.sub': '你接下的学生都在这里。',
      'my.empty': '你还没接过学生。',
      'my.count': '共 {n} 位',
      'my.noTimes': '学生还没写上课时间',
      'my.release': '放回申请池',

      'admin.title': '管理台',
      'admin.sub': '全站老师、学生、分配状态和上课时间，一屏看完。',
      'admin.refresh': '刷新',
      'admin.stat.staff': '位老师（含管理员）',
      'admin.stat.students': '位学生',
      'admin.stat.pending': '份待接申请',
      'admin.stat.assigned': '份已配对',
      'admin.allRequests': '所有申请',
      'admin.allTeachers': '老师与学生',
      'admin.noRequests': '还没有学生提交申请。',
      'admin.noTeachers': '还没有老师账号。',
      'admin.takenBy': '由 {name} 接走',
      'admin.release': '放回池子',
      'admin.waiting': '待接',
      'admin.studentsOf': '名下学生（{n}）',
      'admin.noneYet': '暂无学生',
      'admin.noTimes': '没写时间',

      'card.noIntro': '还没写介绍',
      'card.years': '教龄 {n} 年',

      'profile.title': '我的资料',
      'profile.sub': '资料越具体，越容易被选中。',
      'profile.emailLocked': '邮箱（登录用，不可改）',
      'profile.created': '注册时间',
      'profile.save': '保存资料',
      'profile.saved': '已保存 ✓',

      'toast.loginFirst': '先登录一下吧',
      'toast.registered': '账号建好了，欢迎',
      'toast.welcome': '欢迎回来，{name}',
      'toast.loggedOut': '已退出',
      'toast.saved': '资料已保存',
      'toast.requestSaved': '申请已提交',
      'toast.claimed': '接下了，学生已经归你',
      'toast.released': '已放回申请池',

      'level.zero': '零基础',
      'level.beginner': '入门',
      'level.intermediate': '进阶',
      'level.advanced': '高级',
      'level.pro': '艺考 / 专业',
      'mode.online': '线上',
      'mode.offline': '线下',
      'mode.both': '线上 + 线下',


      'slots.teacherLabel': '可以上课的时间',
      'slots.studentLabel': '想上课的时间',
      'slots.hint': '工作日 15:30–18:30 · 周末 09:00–18:00 · 每节 45 分钟',
      'slots.window': '可排时段：工作日（周一至周五）15:30–18:30，周末（周六、周日）09:00–18:00。',
      'slots.note': '每节课 45 分钟。具体时间可由老师在与家长沟通后调整。',
      'slots.add': '+ 添加时段',
      'slots.remove': '删除这个时段',
      'slots.available': '可上课时间',
      'slots.wanted': '想上课时间',
      'slot.d1': '周一', 'slot.d2': '周二', 'slot.d3': '周三', 'slot.d4': '周四',
      'slot.d5': '周五', 'slot.d6': '周六', 'slot.d7': '周日',
      'err.slot_out_of_range': '时段超出范围：工作日 15:30–18:30，周末 09:00–18:00，每节课 45 分钟',

      'err.role_required': '请选择身份：老师 或 学生',
      'err.name_short': '名字至少 2 个字',
      'err.email_invalid': '邮箱格式不对',
      'err.password_short': '密码至少 8 位',
      'err.email_taken': '这个邮箱已经注册过了',
      'err.bad_credentials': '邮箱或密码不对',
      'err.not_logged_in': '请先登录',
      'err.forbidden': '这个操作你的身份没有权限',
      'err.not_found': '找不到这条记录',
      'err.rate_limited': '操作太频繁了，请稍后再试',
      'err.request_incomplete': '请把乐器、学生姓名、联系方式填完',
      'err.already_taken': '这个学生已经被别的老师接走了',
      'err.not_yours': '这不是你的学生',
    },

    en: {
      'meta.title': 'MusicMatch · Students apply, teachers pick',
      'meta.desc': 'Students submit a request; teachers pick students that match their expertise. Admins are teachers too, and can see the whole roster.',

      'brand.name': 'MusicMatch',
      'brand.sub': 'STUDENT × TEACHER',
      'nav.browseTeacher': 'Teachers',
      'nav.browseStudents': 'Students',
      'nav.myRequest': 'My request',
      'nav.myStudents': 'My students',
      'nav.pool': 'Students available',
      'nav.admin': 'Admin',
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
      'home.lead1': 'Students write one request. Teachers pick the ones that fit their expertise.',
      'home.lead2': 'No rankings, no price comparing. Teachers read the instrument, times and notes — and take the student if it clicks. Once taken, that student is theirs.',
      'home.cta.student': "I'm a student",
      'home.cta.teacher': "I'm a music teacher",
      'home.stat.teachers': 'teachers',
      'home.stat.students': 'students',
      'home.stat.pairs': 'paired up',

      'role.student': 'Student',
      'role.teacher': 'Music teacher',
      'role.admin': 'Administrator (teacher)',

      'role.student.card.title': 'Students',
      'role.student.b1': 'One request: what you want to learn, when you are free, how to reach you',
      'role.student.b2': 'It shows up in the teachers’ “Requests” list',
      'role.student.b3': 'Whoever takes you, you immediately see their profile and contact',
      'role.student.b4': 'Edit the request any time — your teacher sees the update',
      'role.student.cta': 'Create a student account',

      'role.teacher.card.title': 'Music teachers',
      'role.teacher.b1': 'Portfolio: name, nationality, teaching languages, qualifications per instrument',
      'role.teacher.b2': 'Pick students from “Requests” that match what you teach — one click',
      'role.teacher.b3': 'A student you take shows their details, times and contact right away',
      'role.teacher.b4': 'Took the wrong one? Put them back in the pool for someone else',
      'role.teacher.cta': 'Create a teacher account',

      'role.admin.card.title': 'Administrators',
      'role.admin.b1': 'An admin is a teacher too — they teach and can take requests',
      'role.admin.b2': 'Plus: see every profile — teachers, students, contact details',
      'role.admin.b3': 'Every request, assignment and lesson time on one screen',
      'role.admin.b4': 'Put a student back into the pool when needed',
      'role.admin.note': 'Admin accounts are created internally — no public signup.',

      'how.title': 'How it works',
      'how.s1.t': '1 · Student applies',
      'how.s1.d': 'Instrument, available times, student name, contact — one form into the system.',
      'how.s2.t': '2 · Teachers look',
      'how.s2.d': 'Every unclaimed request sits in one pool, and teachers pick by expertise.',
      'how.s3.t': '3 · Teacher takes it',
      'how.s3.d': 'One click and the student is theirs; nobody else sees it. Wrong pick? Put it back.',
      'how.s4.t': '4 · Admin sees everything',
      'how.s4.d': 'All teachers, students, assignment status and lesson times in one view.',

      'cta.title': 'Sign up, then take your time',
      'cta.sub': 'Free, no phone number. Students and teachers use the same door.',
      'cta.btn': 'Get started',

      'foot.main': 'MusicMatch — students apply, teachers pick, admins keep the overview.',
      'foot.fine': 'No rankings · no price comparing · contact details only for the teacher who took you',

      'auth.login.title': 'Welcome back',
      'auth.login.sub': 'Students see their request, teachers see the pool, admins see everything.',
      'auth.email': 'Email',
      'auth.email.ph': 'you@example.com',
      'auth.email.ph2': 'Used for login',
      'auth.password': 'Password',
      'auth.password.ph': 'At least 8 characters',
      'auth.login.btn': 'Log in',
      'auth.noaccount': 'New here?',
      'auth.goRegister': 'Create an account',
      'auth.hasAccount': 'Already have an account?',
      'auth.goLogin': 'Log in',

      'auth.reg.title': 'Create an account',
      'auth.reg.sub': 'Pick your role first — it decides which fields you get, and it can’t be changed later.',
      'auth.role.student': 'Student',
      'auth.role.student.sub': "I'm looking for a teacher",
      'auth.role.teacher': 'Music teacher',
      'auth.role.teacher.sub': "I'm taking students",
      'auth.name': 'Name / nickname',
      'auth.name.ph': 'What should we call you',

      'auth.teacher.legend': 'Teacher portfolio',
      'auth.nationality': 'Nationality / region',
      'auth.nationality.ph': 'e.g. China',
      'auth.languages': 'Teaching languages',
      'auth.languages.ph': 'Chinese, English',
      'auth.qualif': 'Qualifications per instrument',
      'auth.qualif.ph': 'e.g. Piano ABRSM grade 8; theory MMus',
      'auth.instruments.teacher': 'Instruments you teach (comma separated)',
      'auth.instruments.teacher.ph': 'Piano, music theory',
      'auth.levels': 'Levels you teach',
      'auth.years': 'Years teaching',
      'auth.mode': 'Lesson format',
      'auth.styles': 'Styles',
      'auth.styles.ph': 'Classical, pop, jazz…',
      'auth.education': 'School',
      'auth.education.ph': 'e.g. Shanghai Conservatory',
      'auth.intro.teacher': 'Tell students about your lessons',
      'auth.intro.teacher.ph': 'How do you work with complete beginners?',

      'auth.student.legend': 'Student details',
      'auth.instruments.family': 'Instruments you want to learn',
      'auth.instruments.family.ph': 'Piano, music theory',
      'auth.level': 'Current level',
      'auth.studentAge': 'Student age',
      'auth.studentAge.ph': '8 / adult',
      'auth.goal': 'Goal',
      'auth.goal.ph': 'Grades, for fun…',
      'auth.intro.family': 'Anything else',
      'auth.intro.family.ph': 'Do you have an instrument? How often can you practise?',

      'auth.submit.pick': 'Pick a role first',
      'auth.submit.student': 'Create student account',
      'auth.submit.teacher': 'Create teacher account',

      'browse.title.teacher': 'Meet the teachers',
      'browse.title.student': 'Meet the students',
      'browse.sub.teacher': 'Filter by instrument, city and format.',
      'browse.sub.student': 'These are student requests — first to take one keeps it.',
      'browse.tab.teacher': 'Teachers',
      'browse.tab.student': 'Students',
      'browse.empty': 'Nothing matches those filters yet.',
      'browse.loading': 'Loading…',

      'filters.instrument': 'Instrument',
      'filters.instrument.ph': 'Piano / violin…',
      'filters.mode': 'Format',
      'filters.any': 'Any',
      'filters.keyword': 'Keyword',
      'filters.keyword.ph': 'jazz / grades / adult…',
      'filters.apply': 'Filter',
      'filters.reset': 'Clear',

      'req2.title': 'My request',
      'req2.sub': 'Once written, teachers can see it. When one takes you, their profile and contact appear here.',
      'req2.noRequest': 'Not submitted',
      'req2.status.waiting': 'Waiting for a teacher',
      'req2.status.taken': 'Taken by a teacher',
      'req2.assignedTitle': 'Your teacher',
      'req2.instrument': 'Instrument you want',
      'req2.instrument.ph': 'Piano / violin…',
      'req2.studentName': 'Student name',
      'req2.studentName.ph': 'Child or your own name',
      'req2.contact': 'Contact',
      'req2.contact.ph': 'Phone / WeChat / email',
      'req2.times': 'Preferred lesson times',
      'req2.times.ph': 'Saturday mornings, weeknights after 7',
      'req2.note': 'Notes',
      'req2.note.ph': 'Goals, level, do you own an instrument…',
      'req2.level': 'Level',
      'req2.submit': 'Submit request',
      'req2.saved': 'Submitted ✓',

      'req.contact': 'Contact',

      'pool.title': 'Student requests',
      'pool.sub': 'Nobody has taken these yet. Read the instrument, times and notes — take what fits.',
      'pool.empty': 'No open requests right now.',
      'pool.claim': 'Take this student',
      'pool.count': '{n} open',

      'my.title': 'My students',
      'my.sub': 'Everyone you have taken on.',
      'my.empty': 'You haven’t taken any students yet.',
      'my.count': '{n} total',
      'my.noTimes': 'No times given yet',
      'my.release': 'Put back in pool',

      'admin.title': 'Admin console',
      'admin.sub': 'Every teacher, student, assignment and lesson time in one view.',
      'admin.refresh': 'Refresh',
      'admin.stat.staff': 'teachers (incl. admins)',
      'admin.stat.students': 'students',
      'admin.stat.pending': 'open requests',
      'admin.stat.assigned': 'paired up',
      'admin.allRequests': 'All requests',
      'admin.allTeachers': 'Teachers & students',
      'admin.noRequests': 'No student requests yet.',
      'admin.noTeachers': 'No teacher accounts yet.',
      'admin.takenBy': 'Taken by {name}',
      'admin.release': 'Release',
      'admin.waiting': 'Open',
      'admin.studentsOf': 'Students ({n})',
      'admin.noneYet': 'No students yet',
      'admin.noTimes': 'no times given',

      'card.noIntro': 'No description yet',
      'card.years': '{n} yrs teaching',

      'profile.title': 'My profile',
      'profile.sub': 'The more specific you are, the easier you are to pick.',
      'profile.emailLocked': 'Email (for login, can’t be changed)',
      'profile.created': 'Joined',
      'profile.save': 'Save profile',
      'profile.saved': 'Saved ✓',

      'toast.loginFirst': 'Please log in first',
      'toast.registered': 'Account created — welcome',
      'toast.welcome': 'Welcome back, {name}',
      'toast.loggedOut': 'Logged out',
      'toast.saved': 'Profile saved',
      'toast.requestSaved': 'Request submitted',
      'toast.claimed': 'Taken — the student is yours',
      'toast.released': 'Put back in the pool',

      'level.zero': 'Absolute beginner',
      'level.beginner': 'Beginner',
      'level.intermediate': 'Intermediate',
      'level.advanced': 'Advanced',
      'level.pro': 'Exam / pro track',
      'mode.online': 'Online',
      'mode.offline': 'In person',
      'mode.both': 'Online + in person',


      'slots.teacherLabel': 'Times you can teach',
      'slots.studentLabel': 'Preferred lesson times',
      'slots.hint': 'Weekdays 15:30–18:30 · Weekends 09:00–18:00 · 45 minutes per lesson',
      'slots.window': 'Allowed windows: Mon–Fri 15:30–18:30, Sat–Sun 09:00–18:00.',
      'slots.note': 'Each lesson is 45 minutes. Exact times can be adjusted by the teacher after talking with the parent.',
      'slots.add': '+ Add a slot',
      'slots.remove': 'Remove this slot',
      'slots.available': 'Available',
      'slots.wanted': 'Requested',
      'slot.d1': 'Mon', 'slot.d2': 'Tue', 'slot.d3': 'Wed', 'slot.d4': 'Thu',
      'slot.d5': 'Fri', 'slot.d6': 'Sat', 'slot.d7': 'Sun',
      'err.slot_out_of_range': 'Outside the allowed windows: weekdays 15:30–18:30, weekends 09:00–18:00, 45 minutes per lesson',

      'err.role_required': 'Pick a role: teacher, or student',
      'err.name_short': 'Name needs at least 2 characters',
      'err.email_invalid': 'That email doesn’t look right',
      'err.password_short': 'Password needs at least 8 characters',
      'err.email_taken': 'That email is already registered',
      'err.bad_credentials': 'Wrong email or password',
      'err.not_logged_in': 'Please log in',
      'err.forbidden': 'Your role can’t do this',
      'err.not_found': 'Not found',
      'err.rate_limited': 'Too many attempts — please wait a moment',
      'err.request_incomplete': 'Instrument, student name and contact are required',
      'err.already_taken': 'Another teacher already took this student',
      'err.not_yours': 'That student isn’t yours',
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

  const LEVEL_KEY = {
    '零基础': 'level.zero', '入门': 'level.beginner', '进阶': 'level.intermediate',
    '高级': 'level.advanced', '艺考 / 专业': 'level.pro',
  };
  const MODE_KEY = { '线上': 'mode.online', '线下': 'mode.offline', '线上 + 线下': 'mode.both' };
  const levelLabel = (v) => (v ? t(LEVEL_KEY[v] || v) : '');
  const modeLabel = (v) => (v ? t(MODE_KEY[v] || v) : '');

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
