'use strict';

/**
 * store.js — 数据层
 * 基于 localStorage 持久化,结构:
 * {
 *   events:     { 'YYYY-MM-DD': [{ id, time, title, type }] },
 *   todos:      { 'YYYY-MM-DD': [{ id, title, done }] },
 *   feed:       [{ id, ts: 'YYYY-MM-DDTHH:mm', text, source }],
 *   milestones: [{ id, name, date: 'YYYY-MM-DD' }]
 * }
 */
const Store = (() => {
  const KEY = 'rws_dashboard_v1';

  const pad = n => String(n).padStart(2, '0');
  const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => fmtDate(new Date());
  const nowTime = () => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const offsetDate = days => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return fmtDate(d);
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- 初始示例数据 ---------- */
  function seed() {
    const t = todayStr();
    return {
      version: 1,
      events: {
        [t]: [
          { id: uid(), time: '09:00', title: '实验：样本预处理', type: '实验' },
          { id: uid(), time: '14:00', title: '数据处理', type: '数据处理' }
        ]
      },
      todos: {
        [t]: [
          { id: uid(), title: '整理文献证据卡片', done: true },
          { id: uid(), title: '完成实验样本编号', done: true },
          { id: uid(), title: '修改论文方法部分', done: false },
          { id: uid(), title: '补充组会 PPT', done: false },
          { id: uid(), title: '记录今日科研日志', done: false }
        ]
      },
      feed: [
        { id: uid(), ts: `${t}T14:30`, text: '完成实验样本编号整理', source: '实验中心' },
        { id: uid(), ts: `${offsetDate(-1)}T21:00`, text: '阅读文献：Deep Learning Methods', source: '文献证据' },
        { id: uid(), ts: `${offsetDate(-1)}T16:00`, text: '修改论文方法部分', source: '论文工作台' }
      ],
      milestones: [
        { id: 'biye', name: '博士毕业', date: offsetDate(700) },
        { id: 'kaoti', name: '开题答辩', date: offsetDate(13) },
        { id: 'lunwen', name: '论文初稿', date: offsetDate(30) },
        { id: 'zuhui', name: '组会汇报', date: offsetDate(3) }
      ],
      academic: {
        student: {
          name: '林川',
          school: '江北大学',
          dept: '物理系',
          degree: '博士二年级'
        },
        credits: { done: 26, total: 36 },
        thesis: { percent: 35 },
        milestones: [
          { id: 'ruxue', name: '入学', time: '2024年9月', status: 'done' },
          { id: 'kaiti', name: '开题', time: '2026年8月18日', status: 'upcoming' },
          { id: 'zhongqi', name: '中期', time: '2027年4月', status: 'todo' },
          { id: 'yubian', name: '预答辩', time: '2028年1月', status: 'todo' },
          { id: 'dabian', name: '答辩', time: '2028年6月', status: 'todo' }
        ],
        materials: {
          ruxue: [
            { id: uid(), name: '研究生录取通知书', type: 'PDF' },
            { id: uid(), name: '学籍注册信息表', type: '文档' }
          ],
          kaiti: [
            { id: uid(), name: '开题报告（初稿）', type: '文档' }
          ],
          zhongqi: [],
          yubian: [],
          dabian: []
        }
      },
      experiments: {
        categories: {
          wet: '湿实验 Wet Lab',
          dry: '干实验 Dry Lab'
        },
        skills: [
          { id: 'wet-dna', category: 'wet', name: 'DNA提取' },
          { id: 'wet-rna', category: 'wet', name: 'RNA提取' },
          { id: 'wet-pcr', category: 'wet', name: 'PCR扩增' },
          { id: 'wet-qpcr', category: 'wet', name: 'qPCR' },
          { id: 'wet-gel', category: 'wet', name: '电泳检测' },
          { id: 'wet-wb', category: 'wet', name: 'Western Blot' },
          { id: 'wet-elisa', category: 'wet', name: 'ELISA' },
          { id: 'wet-cell', category: 'wet', name: '细胞培养' },
          { id: 'wet-ihc', category: 'wet', name: '免疫组化' },
          { id: 'wet-other', category: 'wet', name: '其他实验' },
          { id: 'dry-clean', category: 'dry', name: '数据清洗' },
          { id: 'dry-python', category: 'dry', name: 'Python数据分析' },
          { id: 'dry-ml', category: 'dry', name: '机器学习建模' },
          { id: 'dry-image', category: 'dry', name: '图像处理' },
          { id: 'dry-stats', category: 'dry', name: '统计分析' },
          { id: 'dry-molsim', category: 'dry', name: '分子模拟' },
          { id: 'dry-pipeline', category: 'dry', name: '计算流程' }
        ],
        content: {
          'wet-dna': {
            id: 'wet-dna',
            name: 'DNA提取',
            tags: ['湿实验', '分子生物学实验'],
            updated: '2026.08.02',
            intro: 'DNA提取是一种从生物样本中分离纯化基因组DNA的方法，通过细胞裂解、DNA结合、洗涤和洗脱等步骤，获得满足PCR扩增、测序分析等实验需求的高质量DNA样本。',
            purpose: '从组织、细胞或血液样本中提取高纯度DNA，去除蛋白质、RNA及其他杂质，为后续PCR、测序和分子检测实验提供可靠模板。',
            principle: '利用裂解液破坏细胞结构释放DNA，通过硅胶膜或磁珠吸附DNA，经过洗涤去除杂质，最终获得纯化DNA。',
            sampleTypes: ['组织样本', '细胞样本', '血液样本', '微生物样本'],
            steps: [
              { id: uid(), title: '样品裂解', purpose: '破坏细胞结构，释放DNA。', operation: '加入裂解液和蛋白酶K，充分混匀后进行裂解。', params: '56℃，10-15 min。', notes: '确保样品充分裂解。' },
              { id: uid(), title: '离心去除杂质', purpose: '去除未裂解残渣。', operation: '高速离心后转移上清液。', params: '12000 rpm，10 min。', notes: '避免吸取沉淀区域。' },
              { id: uid(), title: 'DNA结合', purpose: '使DNA吸附于纯化膜。', operation: '加入结合缓冲液，将样品转移至纯化柱。', params: '', notes: '' },
              { id: uid(), title: '洗涤', purpose: '去除蛋白质和盐离子。', operation: '加入洗涤液进行离心清洗。', params: '', notes: '' },
              { id: uid(), title: 'DNA洗脱', purpose: '获得纯化DNA。', operation: '加入洗脱液收集DNA。', params: '', notes: '' }
            ],
            refs: [
              { id: uid(), title: 'DNA extraction methods for molecular biology', if: '8.5', zone: '一区', note: '该文章验证了不同DNA提取方法对样品纯度和完整性的影响。' },
              { id: uid(), title: 'A rapid genomic DNA extraction protocol', if: '5.3', zone: '二区', note: '提出了一种快速DNA提取流程。' }
            ],
            projects: ['博士课题：AI辅助材料性能预测', '项目：生物样本检测方法优化']
          },

        }
      },
      settings: {
        profile: {
          name: '林川',
          school: '江北大学',
          college: '物理学院',
          major: '凝聚态物理',
          degree: '博士',
          grade: '博士二年级',
          gradDate: '2028年6月',
          researchField: 'AI辅助材料性能预测'
        },
        interface: {
          theme: 'light',
          fontSize: 'standard',
          fontStyle: 'default',
          layout: 'standard',
          showFeed: true,
          showCountdown: true,
          showTodoStatus: true,
          showRecent: true
        },
        preferences: {
          fields: ['物理', '计算科学'],
          types: ['湿实验', '数据分析'],
          planCycle: 'weekly',
          paperMode: 'chapter'
        },
        notify: {
          expRemind: true,
          meeting: true,
          milestone: true,
          dailyLog: true,
          weeklyReport: true,
          paperDeadline: true
        },
        backup: {
          auto: true,
          frequency: 'daily'
        },
        storage: {
          folder: '',
          totalGB: 100
        }
      },
      literature: {
        categories: ['我的研究方向', '实验方法', '理论基础', '综述文章', '方法学文章', '待阅读文献'],
        tags: ['机器学习', 'PCR', 'DNA提取', '实验方法', '材料预测', '统计分析'],
        papers: [
          {
            id: 'lit-1',
            title: 'Deep Learning Methods for Material Property Prediction',
            authors: 'Zhang Y., Wang X., Li H.',
            journal: 'Nature Communications',
            year: '2025',
            if: '16.6',
            zone: '一区',
            doi: '10.1038/s41467-025-00000-0',
            category: '我的研究方向',
            tags: ['机器学习', '材料预测'],
            favorite: false,
            addedAt: t,
            lastUsed: t,
            overview: {
              question: '如何利用深度学习方法提高材料性能预测准确性？',
              methods: ['Transformer模型', '大规模材料数据集', '深度学习预测框架'],
              results: ['模型预测精度明显提高', '在多个材料体系中具有较好的泛化能力', '验证了深度学习方法的有效性']
            },
            evidences: [
              {
                id: 'ev-1',
                title: '深度学习模型能够提高材料性能预测准确性',
                content: '该研究通过实验数据证明，Transformer模型相比传统机器学习方法具有更好的预测能力。',
                type: '实验结果',
                source: 'Figure 4',
                supports: '深度学习方法适用于复杂材料性能预测',
                usableIn: ['论文 Introduction', '论文 Discussion'],
                trust: 5
              },
              {
                id: 'ev-2',
                title: '模型具有较好的泛化能力',
                content: '模型在不同材料体系中均保持稳定预测性能。',
                type: '实验结果',
                source: 'Table 2',
                supports: '模型具有跨体系应用潜力。',
                usableIn: ['论文结果分析部分'],
                trust: 4
              }
            ],
            projects: ['博士课题：AI材料性能预测'],
            experiments: ['材料性能测试实验', '数据采集实验'],
            chapters: [{ name: '论文第三章 方法', status: '已引用' }, { name: '论文第四章 结果讨论', status: '待引用' }],
            knowledge: ['Transformer', '深度学习预测', '材料结构表征']
          }
        ]
      },
      papers: [
        {
          id: 'paper-1',
          name: 'XXX机制研究',
          figures: [
            { id: 'fig-1', title: 'Figure 1 研究设计与实验流程', status: 'done', created: '2026.07.01', updated: '2026.08.02', md: '# Figure 1 研究设计与实验流程\n\n## 1. Figure目的\n\n说明该图解决什么科学问题，为什么需要制作该Figure。\n\n## 2. 数据来源\n\n项目：\n\n实验：\n\n样品：\n\n数据文件：\n\n## 3. 实验方法\n\n实验流程：\n\n关键参数：\n\n实验条件：\n\n## 4. 数据分析方法\n\n分析软件：\n\n分析代码：\n\n统计方法：\n\n参数设置：\n\n## 5. 图形制作\n\n绘图软件：\n\n制作流程：\n\n输出格式：\n\n## 6. 结果描述\n\n该Figure主要说明：\n\n主要发现：\n\n## 7. 论文对应位置\n\n对应章节：\n\nFigure legend：\n\n## 8. 修改记录\n\n日期：\n\n版本：\n\n修改内容：' },
            { id: 'fig-2', title: 'Figure 2 实验结果', status: 'ongoing', created: '2026.07.15', updated: '2026.08.01', md: '# Figure 2 实验结果\n\n## 1. Figure目的\n\n## 2. 数据来源\n\n## 3. 实验方法\n\n## 4. 数据分析方法\n\n## 5. 图形制作\n\n## 6. 结果描述\n\n## 7. 论文对应位置\n\n## 8. 修改记录' },
            { id: 'fig-3', title: 'Figure 3 机制分析', status: 'todo', created: '', updated: '', md: '# Figure 3 机制分析\n\n## 1. Figure目的\n\n## 2. 数据来源\n\n## 3. 实验方法\n\n## 4. 数据分析方法\n\n## 5. 图形制作\n\n## 6. 结果描述\n\n## 7. 论文对应位置\n\n## 8. 修改记录' },
            { id: 'fig-4', title: 'Figure 4 验证实验', status: 'todo', created: '', updated: '', md: '' },
            { id: 'fig-5', title: 'Figure 5 模型构建', status: 'todo', created: '', updated: '', md: '' },
            { id: 'fig-6', title: 'Supplementary Figure', status: 'todo', created: '', updated: '', md: '' },
            { id: 'fig-7', title: 'Supplementary Table', status: 'todo', created: '', updated: '', md: '' }
          ]
        },
        
      ],
      achievements: {
        types: ['论文', '专利', '会议', '数据', '代码', '荣誉', '团队'],
        achievements: [
          {
            id: 'ach-1',
            type: '论文',
            title: 'Deep Learning Methods for Material Property Prediction',
            journal: 'Nature Communications',
            year: '2025',
            if: '16.6',
            zone: '一区',
            role: '第一作者',
            status: '已发表',
            time: '2025.09',
            tags: ['SCI', '一区', '第一作者', '已发表'],
            projects: ['AI材料预测'],
            experiments: ['材料性能测试实验'],
            refs: ['Deep Learning Methods for Material Property Prediction'],
            papers: ['论文第三章 方法', '论文第四章 结果讨论'],
            background: '材料性能预测对加速新材料研发具有重要意义。',
            contribution: '提出基于Transformer的材料性能预测框架,并在多个数据集上验证。',
            innovation: '将大规模预训练思想引入材料科学,实现跨体系泛化。'
          }
        ]
      },
      weekly: {},
      projects: [
        {
          id: 'proj-1',
          name: '基于机器学习的材料性能预测研究',
          type: '博士课题',
          start: '2025.09',
          end: '2028.06',
          mentor: 'XXX教授',
          members: ['本人', '合作者'],
          status: '进行中',
          percent: 65,
          updated: '2026.08.03',
          archived: false,
          stages: [
            { id: 'st-1', name: '开题设计', status: '已完成', start: '2025.09', end: '2026.01', goal: '完成开题设计与文献调研', tasks: ['完成文献综述', '确定研究框架'], note: '# 开题设计记录\n\n## 研究背景\n材料性能预测对加速新材料研发具有重要意义。\n\n## 研究问题\n如何利用深度学习方法提高材料性能预测准确性？\n\n## 研究方案\n1. 构建材料数据集\n2. 设计深度学习模型\n3. 实验验证与对比' },
            { id: 'st-2', name: '样品采集', status: '已完成', start: '2026.01', end: '2026.05', goal: '完成样品采集与预处理', tasks: ['样品编号整理', '预处理流程确定'], note: '' },
            { id: 'st-3', name: '实验阶段', status: '进行中', start: '2026.05', end: '2026.09', goal: '完成材料制备与性能测试,获取有效实验数据', tasks: ['完成PCR验证实验', '优化实验条件', '扩大量样本量', '撰写实验记录'], note: '# 实验阶段记录\n\n## 实验目的\n验证材料性能变化规律。\n\n## 实验方案\n1. 样品制备\n2. 参数设置\n3. 实验验证\n\n## 实验结果\n记录实验现象和数据。\n\n## 当前问题\n- 实验重复性不足\n- PCR 扩增不稳定\n\n## 下一步计划\n优化实验条件。' },
            { id: 'st-4', name: '分析阶段', status: '未开始', start: '2026.09', end: '2027.03', goal: '数据分析与模型构建', tasks: [], note: '' },
            { id: 'st-5', name: '结果阶段', status: '未开始', start: '2027.03', end: '2028.06', goal: '整理结果,撰写论文', tasks: [], note: '' }
          ],
          issues: [
            { text: 'PCR重复性差', status: '实验验证中' },
            { text: '样品数量不足', status: '待解决' }
          ],
          timeline: [
            { time: '2025.09', text: '项目创建' },
            { time: '2026.01', text: '完成采样' },
            { time: '2026.05', text: '进入实验阶段' },
            { time: '2026.08', text: '开始分析' }
          ],
          linked: { tasks: 12, experiments: 8, refs: 23, papers: 2, outputs: 1 }
        }
      ]
    };
  }

  let data = null;

  function load() {
    if (data) return data;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        data = JSON.parse(raw);
        if (!data.events || !data.todos || !data.feed || !data.milestones) {
          data = seed();
        } else {
          // 结构性字段:无条件确保存在(幂等,兼容任意旧版本存量数据)
          if (!data.weekly) data.weekly = {};
          if (!data.achievements || !Array.isArray(data.achievements.types)) {
            if (!data.achievements) data.achievements = { achievements: [] };
            data.achievements.types = ['论文', '专利', '会议', '数据', '代码', '荣誉', '团队'];
          }
          // 旧数据迁移:仅在首次加载时执行一次(避免每次覆盖用户删除/修改的数据)
          if (!data._migrated) {
            const s = seed();
            if (!data.academic) data.academic = s.academic;
            if (!data.version) data.version = s.version;
            // 补充新节点(如博士毕业)——仅首次,之后删除不会被补回
            const knownIds = new Set(data.milestones.map(m => m.id));
            s.milestones.forEach(m => {
              if (!knownIds.has(m.id)) data.milestones.push(m);
            });
            // 补充实验中心数据
            if (!data.experiments) data.experiments = s.experiments;
            // 补充设置数据
            if (!data.settings) data.settings = s.settings;
            else {
              Object.keys(s.settings).forEach(k => {
                if (!data.settings[k]) data.settings[k] = s.settings[k];
              });
              // 旧版本中文值 → 英文值迁移
              const map = {
                '浅色模式': 'light', '深色模式': 'dark', '跟随系统': 'auto',
                '小': 'small', '标准': 'standard', '大': 'large',
                '系统默认': 'default', '学术阅读模式字体': 'reading',
                '紧凑模式': 'compact', '宽屏模式': 'wide',
                '每日计划': 'daily', '每周计划': 'weekly', '手动': 'manual', '每天': 'daily',
                '章节管理': 'chapter', '项目管理': 'project'
              };
              Object.keys(data.settings).forEach(sec => {
                const obj = data.settings[sec];
                if (obj && typeof obj === 'object') {
                  Object.keys(obj).forEach(k => {
                    if (typeof obj[k] === 'string' && map[obj[k]]) obj[k] = map[obj[k]];
                  });
                }
              });
            }
            // 补充文献证据数据
            if (!data.literature) data.literature = s.literature;
            // 补充成果管理数据
            if (!data.achievements) data.achievements = s.achievements;
            // 补充项目管理数据
            if (!data.projects) data.projects = s.projects;
            // 补充论文工作台数据
            if (!data.papers) data.papers = s.papers;
            data._migrated = true;
            try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
          }
        }
      } else {
        data = seed();
      }
    } catch (e) {
      data = seed();
    }
    return data;
  }

  const BACKUP_KEY = 'rws_backup_list';

  function save() {
    try {
      const d = load();
      localStorage.setItem(KEY, JSON.stringify(d));
      // 自动备份:按设置频率写入历史快照(保留最近 8 份)
      if (d.settings && d.settings.backup && d.settings.backup.auto) {
        const freq = (d.settings.backup.frequency || 'daily');
        const interval = freq === 'weekly' ? 7 * 24 * 60 * 60 * 1000
          : freq === 'manual' ? Infinity
          : 24 * 60 * 60 * 1000;   // daily 默认,Infinity=不自动
        if (isFinite(interval)) {
          const list = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
          const last = list[list.length - 1];
          const now = Date.now();
          if (!last || now - last.ts > interval) {
            list.push({ ts: now, label: new Date().toLocaleString('zh-CN'), data: JSON.parse(JSON.stringify(d)) });
            if (list.length > 8) list.shift();
            localStorage.setItem(BACKUP_KEY, JSON.stringify(list));
          }
        }
      }
    } catch (e) { /* 忽略 */ }
  }

  const backups = () => {
    try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch (e) { return []; }
  };
  function restoreBackup(ts) {
    const list = backups();
    const b = list.find(x => x.ts === ts);
    if (!b) return false;
    localStorage.setItem(KEY, JSON.stringify(b.data));
    return true;
  }

  /* ---------- events 日程 ---------- */
  const getEvents = dateStr => load().events[dateStr] || [];
  function addEvent(dateStr, ev) {
    const d = load();
    (d.events[dateStr] = d.events[dateStr] || []).push(ev);
    save();
  }
  function removeEvent(dateStr, id) {
    const d = load();
    d.events[dateStr] = (d.events[dateStr] || []).filter(e => e.id !== id);
    if (!d.events[dateStr].length) delete d.events[dateStr];
    save();
  }
  function addEvent(dateStr, ev) {
    const d = load();
    (d.events[dateStr] = d.events[dateStr] || []).push({ details: { method: '', result: '' }, ...ev });
    save();
  }
  function updateEventDetails(dateStr, id, fields) {
    const d = load();
    const it = (d.events[dateStr] || []).find(e => e.id === id);
    if (it) {
      it.details = Object.assign({ method: '', result: '' }, it.details || {}, fields);
      save();
    }
  }
  function updateEvent(dateStr, id, fields) {
    const d = load();
    const it = (d.events[dateStr] || []).find(e => e.id === id);
    if (it) { Object.assign(it, fields); save(); }
  }
  function updateCountdown(id, fields) {
    const d = load();
    const m = d.milestones.find(x => x.id === id);
    if (m) { Object.assign(m, fields); save(); }
  }

  /* ---------- todos 任务 ---------- */
  const getTodos = dateStr => load().todos[dateStr] || [];
  function setTodoDone(dateStr, id, done) {
    const d = load();
    const list = d.todos[dateStr] || [];
    const it = list.find(x => x.id === id);
    if (it) { it.done = done; save(); }
  }
  function addTodo(dateStr, title) {
    const d = load();
    (d.todos[dateStr] = d.todos[dateStr] || []).push({ id: uid(), title, done: false });
    save();
  }
  function updateTodo(dateStr, id, title) {
    const d = load();
    const it = (d.todos[dateStr] || []).find(x => x.id === id);
    if (it) { it.title = title; save(); }
  }
  function removeTodo(dateStr, id) {
    const d = load();
    d.todos[dateStr] = (d.todos[dateStr] || []).filter(x => x.id !== id);
    if (!d.todos[dateStr].length) delete d.todos[dateStr];
    save();
  }

  /* ---------- feed 科研动态 ---------- */
  function addFeed(text, source) {
    const d = load();
    d.feed.unshift({
      id: uid(),
      ts: `${todayStr()}T${nowTime()}`,
      text,
      source
    });
    if (d.feed.length > 50) d.feed.length = 50;
    save();
  }

  /* ---------- academic 学业 ---------- */
  function updateStudent(fields) {
    const d = load();
    Object.assign(d.academic.student, fields);
    save();
  }
  function updateCredits(done, total) {
    const d = load();
    d.academic.credits.done = done;
    d.academic.credits.total = total;
    save();
  }
  function updateThesis(percent) {
    const d = load();
    d.academic.thesis.percent = percent;
    save();
  }
  function updateMilestone(id, fields) {
    const d = load();
    const m = d.academic.milestones.find(x => x.id === id);
    if (m) { Object.assign(m, fields); save(); }
  }
  function addMilestone(node) {
    const d = load();
    const id = uid();
    d.academic.milestones.push({ id, ...node });
    d.academic.materials[id] = d.academic.materials[id] || [];
    save();
  }
  function addCountdown(node) {
    const d = load();
    d.milestones.push({ id: uid(), ...node });
    save();
  }
  function removeCountdown(id) {
    const d = load();
    d.milestones = d.milestones.filter(m => m.id !== id);
    save();
  }
  function removeMilestone(id) {
    const d = load();
    d.academic.milestones = d.academic.milestones.filter(x => x.id !== id);
    delete d.academic.materials[id];
    save();
  }
  function addMaterial(nodeId, mat) {
    const d = load();
    (d.academic.materials[nodeId] = d.academic.materials[nodeId] || []).push({ id: uid(), ...mat });
    save();
  }
  function removeMaterial(nodeId, id) {
    const d = load();
    d.academic.materials[nodeId] = (d.academic.materials[nodeId] || []).filter(x => x.id !== id);
    save();
  }

  /* ---------- experiments 实验中心 ---------- */
  const experiments = () => load().experiments;

  function getExperiment(skillId) {
    const d = load();
    if (!d.experiments.content[skillId]) {
      d.experiments.content[skillId] = {
        id: skillId,
        name: (d.experiments.skills.find(s => s.id === skillId) || {}).name || '未命名实验',
        tags: [],
        updated: `${pad(new Date().getMonth() + 1)}.${pad(new Date().getDate())}`,
        intro: '',
        purpose: '',
        principle: '',
        sampleTypes: [],
        steps: [],
        refs: [],
        projects: [],
        files: []
      };
      save();
    }
    return d.experiments.content[skillId];
  }

  function updateExperiment(skillId, fields) {
    const c = getExperiment(skillId);
    Object.assign(c, fields, { updated: `${pad(new Date().getMonth() + 1)}.${pad(new Date().getDate())}` });
    save();
  }

  function addExperiment(skill) {
    const d = load();
    const id = uid();
    d.experiments.skills.push({ id, ...skill });
    d.experiments.content[id] = null;
    save();
    return id;
  }

  /* 实验分类:新建 / 改名(干湿实验可扩展) */
  function addExpCategory(label) {
    const d = load();
    const key = 'cat-' + Date.now().toString(36);
    d.experiments.categories[key] = label;
    save();
    return key;
  }
  function renameExpCategory(key, label) {
    const d = load();
    if (d.experiments.categories[key]) { d.experiments.categories[key] = label; save(); }
  }

  function updateSkillName(skillId, name) {
    const d = load();
    const s = d.experiments.skills.find(x => x.id === skillId);
    if (s) { s.name = name; save(); }
  }
  function removeSkill(skillId) {
    const d = load();
    d.experiments.skills = d.experiments.skills.filter(x => x.id !== skillId);
    delete d.experiments.content[skillId];
    save();
  }

  function addStep(skillId, step) {
    const c = getExperiment(skillId);
    c.steps.push({ id: uid(), ...step });
    save();
  }
  function updateStep(skillId, stepId, fields) {
    const c = getExperiment(skillId);
    const st = c.steps.find(x => x.id === stepId);
    if (st) { Object.assign(st, fields); save(); }
  }
  function removeStep(skillId, stepId) {
    const c = getExperiment(skillId);
    c.steps = c.steps.filter(x => x.id !== stepId);
    save();
  }
  function moveStep(skillId, stepId, dir) {
    const c = getExperiment(skillId);
    const i = c.steps.findIndex(x => x.id === stepId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= c.steps.length) return;
    const t = c.steps[i];
    c.steps[i] = c.steps[j];
    c.steps[j] = t;
    save();
  }

  /* ---------- settings 设置 ---------- */
  const settings = () => load().settings;
  function updateSettings(section, fields) {
    const d = load();
    Object.assign(d.settings[section], fields);
    save();
  }

  /* ---------- literature 文献证据 ---------- */
  const literature = () => load().literature;
  function addLitPaper(p) {
    const d = load();
    const id = uid();
    d.literature.papers.push({ id, addedAt: Store.todayStr(), lastUsed: Store.todayStr(), ...p });
    save();
    return id;
  }
  function updatePaper(id, fields) {
    const d = load();
    const it = d.literature.papers.find(x => x.id === id);
    if (it) { Object.assign(it, fields); it.lastUsed = todayStr(); save(); }
  }
  function removePaper(id) {
    const d = load();
    d.literature.papers = d.literature.papers.filter(x => x.id !== id);
    save();
  }
  function addEvidence(paperId, ev) {
    const d = load();
    const p = d.literature.papers.find(x => x.id === paperId);
    if (p) { p.evidences.push({ id: uid(), ...ev }); p.lastUsed = todayStr(); save(); }
  }
  function updateEvidence(paperId, evId, fields) {
    const d = load();
    const p = d.literature.papers.find(x => x.id === paperId);
    if (p) {
      const e = p.evidences.find(x => x.id === evId);
      if (e) { Object.assign(e, fields); p.lastUsed = todayStr(); save(); }
    }
  }
  function removeEvidence(paperId, evId) {
    const d = load();
    const p = d.literature.papers.find(x => x.id === paperId);
    if (p) { p.evidences = p.evidences.filter(x => x.id !== evId); save(); }
  }
  function addCategory(name) {
    const d = load();
    if (!d.literature.categories.includes(name)) { d.literature.categories.push(name); save(); }
  }
  function removeCategory(name) {
    const d = load();
    d.literature.categories = d.literature.categories.filter(x => x !== name);
    save();
  }
  function removePapersByCategory(name) {
    const d = load();
    d.literature.papers = d.literature.papers.filter(p => p.category !== name);
    save();
  }
  function renameCategory(oldName, newName) {
    const d = load();
    if (!oldName || !newName || oldName === newName) return;
    const i = d.literature.categories.indexOf(oldName);
    if (i >= 0) d.literature.categories[i] = newName;
    d.literature.papers.forEach(p => { if (p.category === oldName) p.category = newName; });
    save();
  }
  function addTag(name) {
    const d = load();
    if (!d.literature.tags.includes(name)) { d.literature.tags.push(name); save(); }
  }
  function removeTag(name) {
    const d = load();
    d.literature.tags = d.literature.tags.filter(x => x !== name);
    save();
  }

  /* ---------- achievements 成果管理 ---------- */
  const achievements = () => (load().achievements.achievements || []).filter(Boolean);
  const achTypes = () => (load().achievements.types || []);
  function addAchType(name) {
    const d = load();
    if (!Array.isArray(d.achievements.types)) d.achievements.types = [];
    if (!d.achievements.types.includes(name)) d.achievements.types.push(name);
    save();
  }
  function renameAchType(oldName, newName) {
    const d = load();
    d.achievements.types = d.achievements.types.map(t => t === oldName ? newName : t);
    d.achievements.achievements.forEach(a => { if (a.type === oldName) a.type = newName; });
    save();
  }
  function removeAchType(name, keepItems) {
    const d = load();
    d.achievements.types = d.achievements.types.filter(t => t !== name);
    if (keepItems) {
      d.achievements.achievements.forEach(a => { if (a.type === name) a.type = '其他'; });
      if (!d.achievements.types.includes('其他')) d.achievements.types.push('其他');
    } else {
      d.achievements.achievements = d.achievements.achievements.filter(a => a.type !== name);
    }
    save();
  }
  function addAchievement(a) {
    const d = load();
    d.achievements.achievements.push({ id: uid(), ...a });
    save();
  }
  function updateAchievement(id, fields) {
    const d = load();
    const it = d.achievements.achievements.find(x => x.id === id);
    if (it) { Object.assign(it, fields); save(); }
  }
  function removeAchievement(id) {
    const d = load();
    d.achievements.achievements = d.achievements.achievements.filter(x => x.id !== id);
    save();
  }

  /* ---------- projects 项目管理 ---------- */
  const projects = () => load().projects;
  function addProject(p) {
    const d = load();
    d.projects.push({ id: uid(), ...p });
    save();
  }
  function updateProject(id, fields) {
    const d = load();
    const it = d.projects.find(x => x.id === id);
    if (it) { Object.assign(it, fields, { updated: `${pad(new Date().getMonth() + 1)}.${pad(new Date().getDate())}` }); save(); }
  }
  function removeProject(id) {
    const d = load();
    d.projects = d.projects.filter(x => x.id !== id);
    save();
  }
  function updateStage(projectId, stageId, fields) {
    const d = load();
    const p = d.projects.find(x => x.id === projectId);
    if (p) {
      const st = (p.stages || []).find(s => s.id === stageId);
      if (st) { Object.assign(st, fields); save(); }
    }
  }

  /* ---------- papers 论文工作台 ---------- */
  const papers = () => load().papers;
  function addPaper(p) {
    const d = load();
    d.papers.push({ id: uid(), ...p });
    save();
  }
  function updatePaperName(id, name) {
    const d = load();
    const it = d.papers.find(x => x.id === id);
    if (it) { it.name = name; save(); }
  }
  function removePaper(id) {
    const d = load();
    d.papers = d.papers.filter(x => x.id !== id);
    save();
  }
  function addFigure(paperId, fig) {
    const d = load();
    const p = d.papers.find(x => x.id === paperId);
    if (p) { p.figures.push({ id: uid(), ...fig }); save(); }
  }
  function updateFigure(paperId, figId, fields) {
    const d = load();
    const p = d.papers.find(x => x.id === paperId);
    if (p) {
      const f = p.figures.find(x => x.id === figId);
      if (f) { Object.assign(f, fields, { updated: `${pad(new Date().getMonth() + 1)}.${pad(new Date().getDate())}` }); save(); }
    }
  }
  function removeFigure(paperId, figId) {
    const d = load();
    const p = d.papers.find(x => x.id === paperId);
    if (p) { p.figures = p.figures.filter(x => x.id !== figId); save(); }
  }

  /* ---------- 每周计划(周一到周日整体目标) ---------- */
  function weekStartOf(dateStr) {
    const d = dateStr ? new Date(dateStr + 'T00:00') : new Date();
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function getWeekPlan(weekStart) {
    return (load().weekly || {})[weekStart] || null;
  }
  function setWeekPlan(weekStart, fields) {
    const d = load();
    if (!d.weekly) d.weekly = {};
    d.weekly[weekStart] = Object.assign({ goal: '', status: 'todo' }, d.weekly[weekStart] || {}, fields);
    save();
  }

  return {
    KEY,
    uid,
    pad,
    fmtDate,
    todayStr,
    nowTime,
    load,
    save,
    getEvents,
    addEvent,
    removeEvent,
    updateEventDetails,
    updateEvent,
    getTodos,
    setTodoDone,
    addTodo,
    updateTodo,
    removeTodo,
    addFeed,
    feed: () => load().feed,
    milestones: () => load().milestones,
    events: () => load().events,
    academic: () => load().academic,
    updateStudent,
    updateCredits,
    updateThesis,
    updateMilestone,
    addMilestone,
    removeMilestone,
    addCountdown,
    removeCountdown,
    updateCountdown,
    addMaterial,
    removeMaterial,
    experiments,
    getExperiment,
    updateExperiment,
    addExperiment,
    addExpCategory,
    renameExpCategory,
    updateSkillName,
    removeSkill,
    addStep,
    updateStep,
    removeStep,
    moveStep,
    settings,
    updateSettings,
    backups,
    restoreBackup,
    literature,
    addLitPaper,
    updatePaper,
    removePaper,
    addEvidence,
    updateEvidence,
    removeEvidence,
    addCategory,
    removeCategory,
    renameCategory,
    removePapersByCategory,
    addTag,
    removeTag,
    achievements,
    addAchievement,
    updateAchievement,
    removeAchievement,
    projects,
    addProject,
    updateProject,
    removeProject,
    updateStage,
    papers,
    addPaper,
    updatePaperName,
    removePaper,
    addFigure,
    updateFigure,
    removeFigure,
    weekStartOf,
    getWeekPlan,
    setWeekPlan,
    achTypes,
    addAchType,
    renameAchType,
    removeAchType
  };
})();
