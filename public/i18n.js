/* 知音配对 · 中英切换（零依赖，前端词典） */
window.I18N = (() => {
  'use strict';

  const LS_KEY = 'mm_lang';
  const SUPPORTED = ['zh', 'en'];
  const listeners = new Set();

  const dict = {
    zh: {
      'meta.title': '知音配对 · 学生提单，管理员分配老师',
      'meta.desc': '知音配对：学生提交申请表，系统按乐器、城市、预算排序，管理员把最合适的音乐老师分配给你。',

      'brand.name': '知音配对',
      'brand.sub': 'MUSICMATCH',

      'nav.browse': '浏览',
      'nav.browseTeacher': '找老师',
      'nav.browseStudent': '找学生',
      'nav.browseAll': '浏览资料',
      'nav.myRequest': '我的申请',
      'nav.myStudents': '我的学生',
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
      'home.lead1': '学生填一张申请表，其它交给系统和分配老师。',
      'home.lead2': '按乐器、城市、预算排好序，管理员把最合适的老师分配给你；老师也能看到你的时间安排和联系方式。',
      'home.cta.student': '我是学生',
      'home.cta.teacher': '我是音乐老师',
      'home.stat.teachers': '位老师',
      'home.stat.students': '位学生',
      'home.stat.pairs': '对已分配',

      'role.student': '学生',
      'role.teacher': '音乐老师',
      'role.admin': '管理员',

      'role.student.card.title': '学生',
      'role.student.b1': '填一张申请表：想学什么、什么时间方便、怎么联系',
      'role.student.b2': '提交后进入管理台，按乐器 / 城市 / 预算自动排序',
      'role.student.b3': '被分配后能看到老师的资料和联系方式',
      'role.student.b4': '随时修改申请，老师那边同步更新',
      'role.student.cta': '创建学生账号',

      'role.teacher.card.title': '音乐老师',
      'role.teacher.b1': '做自己的作品集：姓名、国籍、教学语言、各乐器资质',
      'role.teacher.b2': '定课时费、授课方式、可教级别和风格',
      'role.teacher.b3': '被分配后直接看到学生的资料和联系方式',
      'role.teacher.b4': '学生的时间安排和备注都在「我的学生」里',
      'role.teacher.cta': '创建老师账号',

      'role.admin.card.title': '管理员',
      'role.admin.b1': '一屏看到所有申请、老师和分配情况',
      'role.admin.b2': '系统按乐器匹配 / 同城 / 预算 / 现有学生数给出排序',
      'role.admin.b3': '点一下把老师分配给某个学生，随时可以换人或撤回',
      'role.admin.b4': '能看到全站账号和每个老师带了几个人',
      'role.admin.note': '管理员账号由站点内部开设，不开放注册。',

      'how.title': '怎么个流程',
      'how.s1.t': '1 · 学生提申请',
      'how.s1.d': '乐器、上课时间、学生姓名、联系方式，一张表交给系统。',
      'how.s2.t': '2 · 系统排序',
      'how.s2.d': '乐器命中、同城、预算内、授课方式一致、目前带得少，都会加分。',
      'how.s3.t': '3 · 管理员分配',
      'how.s3.d': '看着排序结果点一下，不合适就换人，也可以取消重来。',
      'how.s4.t': '4 · 双方看到彼此',
      'how.s4.d': '老师看到学生的时间与联系方式，学生看到老师的资料与联系方式。',

      'cta.title': '先注册，再慢慢挑',
      'cta.sub': '免费、不用手机号。学生和老师同一个入口。',
      'cta.btn': '现在开始',

      'foot.main': '知音配对 · MusicMatch — 学生、老师、管理员各司其职。',
      'foot.fine': '学生提交申请 · 管理员分配老师 · 联系方式只给被分配的一方',

      'auth.login.title': '欢迎回来',
      'auth.login.sub': '学生看申请、老师看学生、管理员看管理台。',
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
      'auth.city': '城市 / 地区',
      'auth.city.ph': '例如 杭州',

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
      'auth.rate': '课时费（元 / 课时）',
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
      'auth.budget': '预算（元 / 课时）',
      'auth.goal': '目标 / 诉求',
      'auth.goal.ph': '考级、兴趣…',
      'auth.intro.family': '补充说明',
      'auth.intro.family.ph': '家里有琴吗？每周能练多久？',

      'auth.submit.pick': '先选一个身份',
      'auth.submit.student': '创建学生账号',
      'auth.submit.teacher': '创建老师账号',

      'browse.title.teacher': '找一位音乐老师',
      'browse.title.student': '看看谁在找老师',
      'browse.sub.teacher': '按乐器、城市、课时费筛一筛。',
      'browse.sub.student': '这些是学生提交的申请，老师可以提前了解。',
      'browse.tab.teacher': '看老师',
      'browse.tab.student': '看学生',
      'browse.empty': '这里还没有符合条件的资料。',
      'browse.loading': '加载中…',

      'filters.instrument': '乐器',
      'filters.instrument.ph': '钢琴 / 小提琴…',
      'filters.city': '城市',
      'filters.city.ph': '杭州',
      'filters.mode': '授课方式',
      'filters.any': '不限',
      'filters.maxRate': '预算上限',
      'filters.rate200': '¥200 以下',
      'filters.rate300': '¥300 以下',
      'filters.rate400': '¥400 以下',
      'filters.keyword': '关键词',
      'filters.keyword.ph': '爵士 / 考级 / 成人…',
      'filters.apply': '筛选',
      'filters.reset': '清空',

      'req2.title': '我的申请',
      'req2.sub': '填好交给管理台，管理员按乐器、城市、预算排序后分配老师。',
      'req2.noRequest': '还没提交',
      'req2.status.pending': '等待分配',
      'req2.status.assigned': '已分配',
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
      'req2.submit': '提交申请',
      'req2.saved': '已提交 ✓',

      'req.contact': '联系方式',
      'req.status.pending': '等待回复',
      'req.status.accepted': '已配对',
      'req.status.declined': '已谢绝',

      'my.title': '我的学生',
      'my.sub': '管理员分配给你的学生都在这里。',
      'my.empty': '还没有学生被分配给你。',
      'my.count': '共 {n} 位',
      'my.noTimes': '学生还没写上课时间',

      'admin.title': '管理台',
      'admin.sub': '所有申请、老师和分配情况一屏看完。',
      'admin.refresh': '刷新',
      'admin.stat.pending': '待分配',
      'admin.stat.assigned': '已分配',
      'admin.stat.students': '学生',
      'admin.stat.teachers': '老师',
      'admin.pending': '待分配',
      'admin.assigned': '已分配',
      'admin.teachers': '老师工作量',
      'admin.assign': '分配老师',
      'admin.reassign': '换一位',
      'admin.unassign': '取消分配',
      'admin.noPending': '没有待分配的申请。',
      'admin.noAssigned': '还没有分配过。',
      'admin.candidates': '给 {name} 选老师',
      'admin.candidates.sub': '按乐器匹配、同城、预算、当前带的学生数排序。',
      'admin.load': '带 {n} 人',
      'admin.assignedTo': '已分配给 {name}',
      'admin.noTimes': '没写时间',
      'admin.noTeachers': '还没有老师注册。',
      'admin.reason.instrument': '乐器匹配',
      'admin.reason.city': '同城',
      'admin.reason.budget': '预算内',
      'admin.reason.mode': '授课方式一致',
      'admin.reason.free': '目前没学生',

      'card.cityMissing': '城市未填',
      'card.noIntro': '还没写介绍',
      'card.rate': '¥{n} / 课时',
      'card.years': '教龄 {n} 年',
      'card.budget': '预算 ¥{n}',

      'profile.title': '我的资料',
      'profile.sub': '资料越具体，越容易被选中。',
      'profile.emailLocked': '邮箱（登录用，不可改）',
      'profile.created': '注册时间',
      'profile.save': '保存资料',
      'profile.saved': '已保存 ✓',

      'modal.title': '推荐老师',
      'modal.sub': '按乐器匹配、同城、预算、当前带的学生数排序。',
      'modal.msg.ph': '说一句你想学什么（可不填）',
      'modal.cancel': '取消',
      'modal.send': '发出请求',

      'toast.loginFirst': '先登录一下吧',
      'toast.registered': '账号建好了，欢迎',
      'toast.welcome': '欢迎回来，{name}',
      'toast.loggedOut': '已退出',
      'toast.saved': '资料已保存',
      'toast.requestSaved': '申请已提交',
      'toast.assigned': '分配好了',
      'toast.unassigned': '已取消分配',

      'level.zero': '零基础',
      'level.beginner': '入门',
      'level.intermediate': '进阶',
      'level.advanced': '高级',
      'level.pro': '艺考 / 专业',
      'mode.online': '线上',
      'mode.offline': '线下',
      'mode.both': '线上 + 线下',

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
      'err.bad_teacher': '选中的不是一位老师',
    },

    en: {
      'meta.title': 'MusicMatch · Students apply, admins assign',
      'meta.desc': 'MusicMatch: students submit a request, the system ranks teachers by instrument, city and budget, and admins assign the best fit.',

      'brand.name': 'MusicMatch',
      'brand.sub': 'STUDENT × TEACHER',
      'nav.browse': 'Browse',
      'nav.browseTeacher': 'Teachers',
      'nav.browseStudent': 'Students',
      'nav.browseAll': 'Browse',
      'nav.myRequest': 'My request',
      'nav.myStudents': 'My students',
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
      'home.lead1': 'Students fill in one request form. The system and an admin handle the rest.',
      'home.lead2': 'Requests are ranked by instrument, city and budget, and an admin assigns the teacher who fits best — the teacher then sees your schedule and contact details.',
      'home.cta.student': "I'm a student",
      'home.cta.teacher': "I'm a music teacher",
      'home.stat.teachers': 'teachers',
      'home.stat.students': 'students',
      'home.stat.pairs': 'assigned',

      'role.student': 'Student',
      'role.teacher': 'Music teacher',
      'role.admin': 'Administrator',

      'role.student.card.title': 'Students',
      'role.student.b1': 'One request form: what you want to learn, when you are free, how to reach you',
      'role.student.b2': 'It lands in the admin console and is ranked by instrument, city and budget',
      'role.student.b3': 'Once assigned, you see your teacher’s profile and contact details',
      'role.student.b4': 'Edit the request any time — the teacher sees the update',
      'role.student.cta': 'Create a student account',

      'role.teacher.card.title': 'Music teachers',
      'role.teacher.b1': 'Build your portfolio: name, nationality, teaching languages, qualifications',
      'role.teacher.b2': 'Set your rate, format, levels and styles',
      'role.teacher.b3': 'Once assigned, you see the student’s details and contact info',
      'role.teacher.b4': 'Their schedule and notes live in “My students”',
      'role.teacher.cta': 'Create a teacher account',

      'role.admin.card.title': 'Administrators',
      'role.admin.b1': 'See every request, teacher and assignment on one screen',
      'role.admin.b2': 'The system ranks candidates by instrument, city, budget and current load',
      'role.admin.b3': 'One click assigns a teacher; reassign or undo at any time',
      'role.admin.b4': 'See every account and how many students each teacher has',
      'role.admin.note': 'Admin accounts are created internally — no public signup.',

      'how.title': 'How it works',
      'how.s1.t': '1 · Student applies',
      'how.s1.d': 'Instrument, available times, student name, contact — one form into the system.',
      'how.s2.t': '2 · System ranks',
      'how.s2.d': 'Instrument match, same city, within budget, same format, lighter load — all score points.',
      'how.s3.t': '3 · Admin assigns',
      'how.s3.d': 'Pick from the ranked list, switch teachers if it doesn’t fit, or undo.',
      'how.s4.t': '4 · Both sides see each other',
      'how.s4.d': 'The teacher sees the student’s schedule and contact; the student sees the teacher’s profile and contact.',

      'cta.title': 'Sign up, then take your time',
      'cta.sub': 'Free, no phone number. Students and teachers use the same door.',
      'cta.btn': 'Get started',

      'foot.main': 'MusicMatch — students apply, admins assign, teachers teach.',
      'foot.fine': 'Request form · admin assignment · contact details only for the assigned pair',

      'auth.login.title': 'Welcome back',
      'auth.login.sub': 'Students see their request, teachers see their students, admins see the console.',
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
      'auth.city': 'City / region',
      'auth.city.ph': 'e.g. Hangzhou',

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
      'auth.rate': 'Rate (¥ per lesson)',
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
      'auth.budget': 'Budget (¥ per lesson)',
      'auth.goal': 'Goal',
      'auth.goal.ph': 'Grades, for fun…',
      'auth.intro.family': 'Anything else',
      'auth.intro.family.ph': 'Do you have an instrument? How often can you practise?',

      'auth.submit.pick': 'Pick a role first',
      'auth.submit.student': 'Create student account',
      'auth.submit.teacher': 'Create teacher account',

      'browse.title.teacher': 'Find a music teacher',
      'browse.title.student': "See who's looking for a teacher",
      'browse.sub.teacher': 'Filter by instrument, city and rate.',
      'browse.sub.student': 'These are the requests students submitted.',
      'browse.tab.teacher': 'Teachers',
      'browse.tab.student': 'Students',
      'browse.empty': 'Nothing matches those filters yet.',
      'browse.loading': 'Loading…',

      'filters.instrument': 'Instrument',
      'filters.instrument.ph': 'Piano / violin…',
      'filters.city': 'City',
      'filters.city.ph': 'Hangzhou',
      'filters.mode': 'Format',
      'filters.any': 'Any',
      'filters.maxRate': 'Budget cap',
      'filters.rate200': 'Under ¥200',
      'filters.rate300': 'Under ¥300',
      'filters.rate400': 'Under ¥400',
      'filters.keyword': 'Keyword',
      'filters.keyword.ph': 'jazz / grades / adult…',
      'filters.apply': 'Filter',
      'filters.reset': 'Clear',

      'req2.title': 'My request',
      'req2.sub': 'Send this to the admin console — they rank teachers and assign one to you.',
      'req2.noRequest': 'Not submitted',
      'req2.status.pending': 'Awaiting assignment',
      'req2.status.assigned': 'Assigned',
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
      'req2.submit': 'Submit request',
      'req2.saved': 'Submitted ✓',

      'req.contact': 'Contact',
      'req.status.pending': 'Pending',
      'req.status.accepted': 'Matched',
      'req.status.declined': 'Declined',

      'my.title': 'My students',
      'my.sub': 'Everyone an admin has assigned to you.',
      'my.empty': 'No students assigned yet.',
      'my.count': '{n} total',
      'my.noTimes': 'No times given yet',

      'admin.title': 'Admin console',
      'admin.sub': 'Every request, teacher and assignment in one view.',
      'admin.refresh': 'Refresh',
      'admin.stat.pending': 'pending',
      'admin.stat.assigned': 'assigned',
      'admin.stat.students': 'students',
      'admin.stat.teachers': 'teachers',
      'admin.pending': 'Pending',
      'admin.assigned': 'Assigned',
      'admin.teachers': 'Teacher workload',
      'admin.assign': 'Assign a teacher',
      'admin.reassign': 'Reassign',
      'admin.unassign': 'Unassign',
      'admin.noPending': 'Nothing waiting for assignment.',
      'admin.noAssigned': 'No assignments yet.',
      'admin.candidates': 'Pick a teacher for {name}',
      'admin.candidates.sub': 'Ranked by instrument match, same city, budget and current load.',
      'admin.load': '{n} students',
      'admin.assignedTo': 'Assigned to {name}',
      'admin.noTimes': 'no times given',
      'admin.noTeachers': 'No teachers have signed up yet.',
      'admin.reason.instrument': 'instrument match',
      'admin.reason.city': 'same city',
      'admin.reason.budget': 'within budget',
      'admin.reason.mode': 'same format',
      'admin.reason.free': 'no students yet',

      'card.cityMissing': 'City not set',
      'card.noIntro': 'No description yet',
      'card.rate': '¥{n} / lesson',
      'card.years': '{n} yrs teaching',
      'card.budget': 'Budget ¥{n}',

      'profile.title': 'My profile',
      'profile.sub': 'The more specific you are, the easier you are to match.',
      'profile.emailLocked': 'Email (for login, can’t be changed)',
      'profile.created': 'Joined',
      'profile.save': 'Save profile',
      'profile.saved': 'Saved ✓',

      'modal.title': 'Suggested teachers',
      'modal.sub': 'Ranked by instrument match, same city, budget and current load.',
      'modal.msg.ph': 'One line about what you want to learn (optional)',
      'modal.cancel': 'Cancel',
      'modal.send': 'Send request',

      'toast.loginFirst': 'Please log in first',
      'toast.registered': 'Account created — welcome',
      'toast.welcome': 'Welcome back, {name}',
      'toast.loggedOut': 'Logged out',
      'toast.saved': 'Profile saved',
      'toast.requestSaved': 'Request submitted',
      'toast.assigned': 'Assigned',
      'toast.unassigned': 'Assignment removed',

      'level.zero': 'Absolute beginner',
      'level.beginner': 'Beginner',
      'level.intermediate': 'Intermediate',
      'level.advanced': 'Advanced',
      'level.pro': 'Exam / pro track',
      'mode.online': 'Online',
      'mode.offline': 'In person',
      'mode.both': 'Online + in person',

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
      'err.bad_teacher': 'That account is not a teacher',
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
