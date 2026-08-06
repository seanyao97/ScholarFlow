'use strict';

/**
 * settings.js — 设置
 * 左侧8分类菜单 + 右侧配置内容;个人资料同步首页,界面设置全局生效
 */
const Settings = (() => {
  const MENUS = ['个人资料', '界面设置', '通知提醒', '文件与存储', '快捷操作', 'AI 助手', '关于系统'];
  let current = '界面设置';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ---------- 全局应用(主题/字号/布局/显示) ---------- */
  function applyGlobal() {
    const ui = Store.settings().interface;
    const b = document.body;
    let dark = ui.theme === 'dark';
    if (ui.theme === 'auto' && window.matchMedia) {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    b.classList.toggle('dark', dark);
    b.classList.remove('font-small', 'font-large');
    if (ui.fontSize === 'small') b.classList.add('font-small');
    if (ui.fontSize === 'large') b.classList.add('font-large');
    b.classList.remove('layout-compact', 'layout-wide');
    if (ui.layout === 'compact') b.classList.add('layout-compact');
    if (ui.layout === 'wide') b.classList.add('layout-wide');

    // 显示设置 → 首页各区块
    const feedCard = document.getElementById('homeFeedCard');
    const countdownRow = document.getElementById('countdownRow');
    const todoCard = document.getElementById('homeTodoCard');
    const feedList = document.getElementById('timeline');
    if (feedCard) feedCard.style.display = ui.showFeed ? '' : 'none';
    if (countdownRow) countdownRow.style.display = ui.showCountdown ? '' : 'none';
    if (todoCard) todoCard.style.display = ui.showTodoStatus ? '' : 'none';
    if (feedList) feedList.style.display = ui.showRecent ? '' : 'none';
  }

  /* ---------- 左菜单 ---------- */
  function renderMenu() {
    const box = document.getElementById('setMenu');
    box.innerHTML = '';
    MENUS.forEach(name => {
      const item = document.createElement('div');
      item.className = 'set-menu-item' + (name === current ? ' active' : '');
      item.textContent = name;
      item.addEventListener('click', () => {
        current = name;
        renderMenu();
        renderContent();
      });
      box.appendChild(item);
    });
  }

  let storageTimer = null;
  let exportFmt = 'Markdown';

  /* ---------- 右侧内容 ---------- */
  function renderContent() {
    if (storageTimer) { clearInterval(storageTimer); storageTimer = null; }
    const box = document.getElementById('setContent');
    box.innerHTML = '';
    if (current === '个人资料') pageProfile(box);
    else if (current === '界面设置') pageInterface(box);
    else if (current === '通知提醒') pageNotify(box);
    else if (current === '文件与存储') pageStorage(box);
    else if (current === '快捷操作') pageShortcuts(box);
    else if (current === 'AI 助手') AIHelper.renderSettingsInto(box);
    else if (current === '关于系统') pageAbout(box);
  }

  /* ---------- 通用控件 ---------- */
  function card(title, bodyHTML) {
    return `<div class="set-card"><div class="set-card-title">${title}</div>${bodyHTML}</div>`;
  }
  function radioRow(name, value, label, checked) {
    return `<label class="set-radio"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span class="set-radio-dot"></span><span>${label}</span></label>`;
  }
  function switchRow(label, id, checked) {
    return `<div class="set-switch-row"><span class="set-switch-label">${label}</span><label class="mac-switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span class="mac-switch-slider"></span></label></div>`;
  }

  /* 单选:直接绑定 label 点击,保证触发 */
  function bindRadioGroup(box, name, callback) {
    box.querySelectorAll(`.set-radio input[name="${name}"]`).forEach(r => {
      r.closest('.set-radio').addEventListener('click', () => {
        if (r.checked) callback(r.value);
      });
    });
  }

  /* ---------- 1 个人资料 ---------- */
  function pageProfile(box) {
    const p = Store.settings().profile;
    box.innerHTML = card('个人资料', `
      <div class="set-avatar-row">
        <div class="set-avatar" id="setAvatar">${escapeHtml((p.name || '用')[0])}</div>
        <button class="lab-action-btn" id="setAvatarBtn">更换头像</button>
      </div>
      <div class="set-form-grid">
        <div class="edit-field"><label>姓名</label><input name="name" value="${escapeHtml(p.name || '')}"></div>
        <div class="edit-field"><label>学校</label><input name="school" value="${escapeHtml(p.school || '')}"></div>
        <div class="edit-field"><label>学院</label><input name="college" value="${escapeHtml(p.college || '')}"></div>
        <div class="edit-field"><label>专业方向</label><input name="major" value="${escapeHtml(p.major || '')}"></div>
        <div class="edit-field"><label>学历</label><input name="degree" value="${escapeHtml(p.degree || '')}"></div>
        <div class="edit-field"><label>年级</label><input name="grade" value="${escapeHtml(p.grade || '')}"></div>
        <div class="edit-field"><label>预计毕业时间</label><input name="gradDate" value="${escapeHtml(p.gradDate || '')}"></div>
        <div class="edit-field"><label>研究方向</label><input name="researchField" value="${escapeHtml(p.researchField || '')}"></div>
      </div>
      <div class="set-card-actions"><button class="lab-action-btn primary" id="setProfileSave">保存修改</button></div>
    `);
    // 头像:上传图片转 dataURL 显示
    box.querySelector('#setAvatarBtn').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const f = input.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          const img = box.querySelector('#setAvatar');
          img.style.backgroundImage = `url(${r.result})`;
          img.textContent = '';
          try { localStorage.setItem('rws_avatar', r.result); } catch (e) { /* 忽略 */ }
        };
        r.readAsDataURL(f);
      };
      input.click();
    });
    box.querySelector('#setProfileSave').addEventListener('click', () => {
      const vals = {};
      box.querySelectorAll('.set-form-grid input').forEach(i => { vals[i.name] = i.value.trim(); });
      Store.updateSettings('profile', vals);
      // 同步首页个人信息卡片
      Store.updateStudent({
        name: vals.name,
        school: vals.school,
        dept: vals.major || vals.college,
        degree: vals.grade || vals.degree
      });
      document.title = 'ScholarFlow · 设置';
      // 通知首页刷新个人资料
      document.dispatchEvent(new CustomEvent('rws:profile-changed'));
    });
    // 已保存的头像
    try {
      const av = localStorage.getItem('rws_avatar');
      if (av) {
        const img = box.querySelector('#setAvatar');
        img.style.backgroundImage = `url(${av})`;
        img.textContent = '';
      }
    } catch (e) { /* 忽略 */ }
  }

  /* ---------- 2 界面设置 ---------- */
  function pageInterface(box) {
    const ui = Store.settings().interface;
    box.innerHTML =
      card('主题模式', `
        <div class="set-radio-group">
          ${radioRow('theme', 'light', '浅色模式', ui.theme === 'light')}
          ${radioRow('theme', 'dark', '深色模式', ui.theme === 'dark')}
          ${radioRow('theme', 'auto', '跟随系统', ui.theme === 'auto')}
        </div>`) +
      card('字体设置', `
        <div class="set-section-label">字体大小</div>
        <div class="set-radio-group">
          ${radioRow('fontSize', 'small', '小', ui.fontSize === 'small')}
          ${radioRow('fontSize', 'standard', '标准', ui.fontSize === 'standard')}
          ${radioRow('fontSize', 'large', '大', ui.fontSize === 'large')}
        </div>
        <div class="set-font-preview">ScholarFlow 示例文本</div>`) +
      card('布局模式', `
        <div class="set-radio-group">
          ${radioRow('layout', 'compact', '紧凑模式', ui.layout === 'compact')}
          ${radioRow('layout', 'standard', '标准模式', ui.layout === 'standard')}
          ${radioRow('layout', 'wide', '宽屏模式', ui.layout === 'wide')}
        </div>`) +
      card('显示设置', `
        ${switchRow('显示科研动态', 'setFeed', ui.showFeed)}
        ${switchRow('显示日历倒计时', 'setCountdown', ui.showCountdown)}
        ${switchRow('显示任务完成情况', 'setTodoStatus', ui.showTodoStatus)}
        ${switchRow('显示最近科研活动', 'setRecent', ui.showRecent)}`);

    // 主题 / 字号 / 样式 / 布局:label 点击即应用
    bindRadioGroup(box, 'theme', v => { Store.updateSettings('interface', { theme: v }); applyGlobal(); });
    bindRadioGroup(box, 'fontSize', v => { Store.updateSettings('interface', { fontSize: v }); applyGlobal(); });
    bindRadioGroup(box, 'layout', v => { Store.updateSettings('interface', { layout: v }); applyGlobal(); });
    [['setFeed', 'showFeed'], ['setCountdown', 'showCountdown'], ['setTodoStatus', 'showTodoStatus'], ['setRecent', 'showRecent']].forEach(([id, key]) => {
      box.querySelector('#' + id).addEventListener('change', e => {
        Store.updateSettings('interface', { [key]: e.target.checked });
      });
    });
  }

  /* ---------- 5 通知提醒 ---------- */
  function pageNotify(box) {
    const n = Store.settings().notify;
    box.innerHTML =
      card('日程提醒', `
        ${switchRow('实验开始提醒', 'nExp', n.expRemind)}
        ${switchRow('会议提醒', 'nMeeting', n.meeting)}
        ${switchRow('重要节点提醒', 'nMilestone', n.milestone)}`) +
      card('科研提醒', `
        ${switchRow('每日科研日志提醒', 'nDaily', n.dailyLog)}
        ${switchRow('周报生成提醒', 'nWeekly', n.weeklyReport)}
        ${switchRow('论文截止提醒', 'nPaper', n.paperDeadline)}`);
    [['nExp', 'expRemind'], ['nMeeting', 'meeting'], ['nMilestone', 'milestone'], ['nDaily', 'dailyLog'], ['nWeekly', 'weeklyReport'], ['nPaper', 'paperDeadline']].forEach(([id, key]) => {
      box.querySelector('#' + id).addEventListener('change', e => {
        Store.updateSettings('notify', { [key]: e.target.checked });
      });
    });
  }

  /* ---------- 6 文件与存储 ---------- */
  function refreshStorage(box) {
    const used = (window.FileStore ? FileStore.stats().total : 0) + usedBytes();
    const usedTxt = used >= 1073741824 ? (used / 1073741824).toFixed(1) + 'GB'
      : used >= 1048576 ? (used / 1048576).toFixed(1) + 'MB'
      : Math.max(1, Math.round(used / 1024)) + 'KB';
    const u = box.querySelector('#stUsed');
    if (u) u.textContent = usedTxt;
  }

  function pageStorage(box) {
    const st = Store.settings().storage;
    const bk = Store.settings().backup;
    box.innerHTML =
      card('存储设置', `
        <div class="set-section-label">存储文件夹（专门文件夹）</div>
        <div class="set-folder-row">
          <input class="lab-textarea" id="setFolderInput" value="${escapeHtml(st.folder || '')}" placeholder="例如：C:\\Users\\seany\\ResearchWorkspace">
          <button class="lab-action-btn" id="setFolderPick">选择文件夹</button>
          <button class="lab-action-btn primary" id="setFolderSave">保存</button>
        </div>
        <div class="set-hint">所有科研资料（文献、实验 SOP、数据导出、备份）统一存放于该文件夹。</div>`) +
      card('存储空间', `
        <div class="set-storage-num">已使用 <b id="stUsed">—</b></div>`) +
      card('数据备份', `
        ${switchRow('自动备份', 'setBackupAuto', bk.auto)}
        <div class="set-section-label">备份频率</div>
        <div class="set-radio-group">
          ${radioRow('backupFreq', 'daily', '每天', bk.frequency === 'daily')}
          ${radioRow('backupFreq', 'weekly', '每周', bk.frequency === 'weekly')}
          ${radioRow('backupFreq', 'manual', '手动', bk.frequency === 'manual')}
        </div>
        <div class="set-hint">开启后数据变更时按频率自动生成历史快照,可在「数据恢复」中恢复。</div>`) +
      card('数据导出', `
        <div class="set-export-row">
          <button class="lab-action-btn" data-export="all">导出全部数据</button>
          <button class="lab-action-btn" data-export="schedule">日程管理</button>
          <button class="lab-action-btn" data-export="projects">项目管理</button>
          <button class="lab-action-btn" data-export="lab">实验中心</button>
          <button class="lab-action-btn" data-export="literature">文献证据</button>
          <button class="lab-action-btn" data-export="paper">数据分析</button>
          <button class="lab-action-btn" data-export="ach">成果管理</button>
        </div>
        <div class="set-section-label">导出格式</div>
        <div class="set-radio-group">
          ${radioRow('exportFmt', 'Markdown', 'Markdown', exportFmt === 'Markdown')}
          ${radioRow('exportFmt', 'Excel', 'Excel', exportFmt === 'Excel')}
          ${radioRow('exportFmt', 'JSON', 'JSON', exportFmt === 'JSON')}
        </div>
        <div class="set-hint">提示：选择 <b>JSON</b> 格式导出全部数据后，可在「数据恢复 → 导入备份文件」中完整恢复各模块数据。文件名已含时间戳，不会重复。</div>`) +
      card('数据恢复', `
        <div class="set-export-row">
          <button class="lab-action-btn" id="setRestoreHist">恢复历史版本</button>
          <button class="lab-action-btn" id="setImport">导入备份文件</button>
        </div>`);

    // 存储
    refreshStorage(box);
    clearInterval(storageTimer);
    storageTimer = setInterval(() => refreshStorage(box), 3000);
    const input = box.querySelector('#setFolderInput');
    box.querySelector('#setFolderPick').addEventListener('click', async () => {
      try {
        if (window.showDirectoryPicker) {
          const dir = await window.showDirectoryPicker();
          input.value = dir.name;
          Store.updateSettings('storage', { folder: dir.name });
          alert(`已选择存储文件夹：${dir.name}`);
        } else {
          input.focus();
          alert('当前浏览器不支持目录选择，请手动输入文件夹路径');
        }
      } catch (e) {
        if (e.name !== 'AbortError') alert('选择文件夹失败：' + e.message);
      }
    });
    box.querySelector('#setFolderSave').addEventListener('click', () => {
      Store.updateSettings('storage', { folder: input.value.trim() });
      refreshStorage(box);
    });

    // 备份
    box.querySelector('#setBackupAuto').addEventListener('change', e => {
      Store.updateSettings('backup', { auto: e.target.checked });
    });
    bindRadioGroup(box, 'backupFreq', v => Store.updateSettings('backup', { frequency: v }));

    // 导出
    bindRadioGroup(box, 'exportFmt', v => { exportFmt = v; });
    box.querySelectorAll('[data-export]').forEach(b => {
      b.addEventListener('click', () => exportData(b.dataset.export));
    });

    // 恢复
    box.querySelector('#setRestoreHist').addEventListener('click', () => {
      const list = Store.backups();
      if (!list.length) {
        alert('暂无历史备份。开启「自动备份」后,数据变更时会自动生成快照。');
        return;
      }
      const opts = list.slice().reverse().map((b, i) => `<option value="${b.ts}">${b.label}</option>`).join('');
      window.EditModalOpen('恢复历史版本', `
        <form class="edit-form">
          <div class="edit-field"><label>选择备份时间</label>
            <select name="ts">${opts}</select>
          </div>
          <div class="edit-field"><label>注意</label><div class="lab-ref-empty" style="text-align:left">恢复将用所选备份覆盖当前数据,建议先导出当前数据。</div></div>
          <div class="edit-actions">
            <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
            <button type="submit" class="btn-primary">恢复</button>
          </div>
        </form>`, v => {
        if (Store.restoreBackup(parseInt(v.ts, 10))) {
          alert('已恢复,页面即将刷新');
          location.reload();
        } else alert('恢复失败:未找到该备份');
      });
    });
    box.querySelector('#setImport').addEventListener('click', () => {
      const input2 = document.createElement('input');
      input2.type = 'file';
      input2.accept = '.json';
      input2.onchange = () => {
        const f = input2.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          try {
            const d = JSON.parse(r.result.replace(/^\uFEFF/, ''));   // 去除 BOM(导出的 JSON 带 BOM)
            if (d && d.events && d.todos && d.feed) {
              localStorage.setItem('rws_dashboard_v1', JSON.stringify(d));
              alert('导入成功，已刷新数据');
              location.reload();
            } else alert('文件格式不正确');
          } catch (err) { alert('导入失败：' + err.message); }
        };
        r.readAsText(f);
      };
      input2.click();
    });
  }

  function usedBytes() {
    let n = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        n += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
    } catch (e) { /* 忽略 */ }
    return n;
  }

  /* 数据导出(全部/项目/文献/日志),按所选格式 */
  function exportData(which) {
    const d = Store.load();
    let out = {};
    let mlabel = which;
    if (which === 'all') { out = d; mlabel = '全部数据'; }
    else if (which === 'schedule') { out = { events: d.events, todos: d.todos, milestones: d.milestones, weekly: d.weekly }; mlabel = '日程管理'; }
    else if (which === 'projects') { out = { projects: d.projects }; mlabel = '项目管理'; }
    else if (which === 'lab') { out = { experiments: d.experiments }; mlabel = '实验中心'; }
    else if (which === 'literature') { out = { literature: d.literature }; mlabel = '文献证据'; }
    else if (which === 'paper') { out = { papers: d.papers }; mlabel = '数据分析'; }
    else if (which === 'ach') { out = { achievements: d.achievements }; mlabel = '成果管理'; }
    const now = new Date();
    const ts = `${Store.todayStr()}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const fname = `科研数据-${mlabel}-${ts}`;

    if (exportFmt === 'JSON') {
      const blob = new Blob(['\uFEFF' + JSON.stringify(out, null, 2)], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${fname}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (exportFmt === 'Excel') {
      // 简易表格导出(CSV,Excel 可打开)
      const rows = [];
      rows.push(['模块', '类型', '内容']);
      if (out.events) Object.entries(out.events).forEach(([date, list]) =>
        list.forEach(e => rows.push(['日程', `${date} ${e.time}`, `${e.title}（${e.type}）`])));
      if (out.todos) Object.entries(out.todos).forEach(([date, list]) =>
        list.forEach(t => rows.push(['任务', date, `${t.done ? '✓ ' : ''}${t.title}`])));
      if (out.feed) out.feed.forEach(f => rows.push(['科研动态', f.ts, f.text]));
      if (out.experiments && out.experiments.skills) out.experiments.skills.forEach(s => rows.push(['实验中心', '实验', s.name]));
      if (out.projects) out.projects.forEach(p => rows.push(['项目管理', '项目', `${p.name}（${p.status || ''}）`]));
      if (out.literature && out.literature.papers) out.literature.papers.forEach(p => rows.push(['文献证据', '文献', p.title]));
      if (out.papers) out.papers.forEach(p => rows.push(['数据分析', '论文', p.title || p.name || '']));
      if (out.achievements && out.achievements.achievements) out.achievements.achievements.forEach(a => rows.push(['成果管理', a.type, a.title]));
      const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${fname}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      // Markdown
      let md = `# 科研数据导出（${which}）\n\n> 生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
      if (out.events) {
        md += '## 日程安排\n';
        Object.keys(out.events).sort().forEach(date => {
          out.events[date].forEach(e => { md += `- ${date} ${e.time} ${e.title}（${e.type}）\n`; });
        });
      }
      if (out.todos) {
        md += '\n## 任务\n';
        Object.keys(out.todos).sort().forEach(date => {
          out.todos[date].forEach(t => { md += `- ${date} ${t.done ? '[✓]' : '[ ]'} ${t.title}\n`; });
        });
      }
      if (out.feed) {
        md += '\n## 科研动态\n';
        out.feed.forEach(f => { md += `- ${f.ts} ${f.text}（${f.source}）\n`; });
      }
      if (out.experiments && out.experiments.skills) {
        md += '\n## 实验中心\n';
        out.experiments.skills.forEach(s => {
          const c = (out.experiments.content && out.experiments.content[s.id]) || {};
          md += `\n### ${s.name}\n`;
          if (c.intro) md += `- 简介：${c.intro}\n`;
          if (c.purpose) md += `- 目的：${c.purpose}\n`;
          if (c.principle) md += `- 原理：${c.principle}\n`;
          if (c.sampleTypes && c.sampleTypes.length) md += `- 样品类型：${c.sampleTypes.join('、')}\n`;
          if (c.refs && c.refs.length) md += `- 关联文献：${c.refs.map(r => r.title || r).join('；')}\n`;
          (c.steps || []).forEach((st, i) => {
            md += `\n**Step ${i + 1} ${st.title || ''}**\n`;
            if (st.purpose) md += `- 目的：${st.purpose}\n`;
            if (st.operation) md += `- 操作：${st.operation}\n`;
            if (st.params) md += `- 参数：${st.params}\n`;
            if (st.notes) md += `- 注意事项：${st.notes}\n`;
          });
        });
      }
      if (out.projects) {
        md += '\n## 项目管理\n';
        out.projects.forEach(p => {
          md += `\n### ${p.name}\n`;
          md += `- 类型：${p.type || ''} ｜ 状态：${p.status || ''}\n`;
          if (p.goal) md += `- 目标：${p.goal}\n`;
          (p.stages || []).forEach(st => {
            const tasks = (st.tasks || []).map(t => (typeof t === 'string') ? { title: t, done: false } : t);
            const done = tasks.filter(t => t.done).length;
            md += `- 阶段【${st.name}】${st.status || ''} ${st.start || ''}~${st.end || ''}（任务 ${done}/${tasks.length}）\n`;
            tasks.forEach(t => md += `    ${t.done ? '[✓]' : '[ ]'} ${t.title}\n`);
            if (st.goal) md += `    目标：${st.goal}\n`;
            if (st.note) md += `    笔记：${st.note.replace(/\n/g, '\n    ')}\n`;
          });
          (p.timeline || []).forEach(t => md += `- 时间线：${t.time} ${t.text}\n`);
          (p.issues || []).forEach(i => md += `- 问题：${i.text}（${i.status || ''}）\n`);
          if (p.notes) md += `- 笔记：${p.notes.replace(/\n/g, '\n    ')}\n`;
        });
      }
      if (out.literature && out.literature.papers) {
        md += '\n## 文献证据\n';
        out.literature.papers.forEach(p => {
          md += `\n### ${p.title}\n`;
          md += `- 作者：${p.authors || ''} ｜ 期刊：${p.journal || ''} ｜ 年份：${p.year || ''} ｜ IF：${p.if || ''} ｜ 分区：${p.zone || ''}\n`;
          if (p.doi) md += `- DOI：${p.doi}\n`;
          if (p.tags && p.tags.length) md += `- 标签：${p.tags.map(t => '#' + t).join(' ')}\n`;
          (p.evidences || []).forEach((ev, i) => {
            md += `- 证据${i + 1}：${ev.title || ''}\n`;
            if (ev.content) md += `    ${ev.content}\n`;
            if (ev.type) md += `    类型：${ev.type} ｜ 来源：${ev.source || ''} ｜ 可信度：${'★'.repeat(ev.trust || 5)}\n`;
            if (ev.supports) md += `    支持观点：${ev.supports}\n`;
          });
        });
      }
      if (out.papers) {
        md += '\n## 数据分析\n';
        out.papers.forEach(p => {
          md += `\n### ${p.title || p.name || ''}\n`;
          (p.figures || []).forEach(f => {
            const stTxt = { done: '已完成', ongoing: '进行中', todo: '未开始' }[f.status] || '未开始';
            md += `- Figure：${f.title || ''}（${stTxt}）\n`;
            if (f.md) md += `    ${f.md.replace(/\n/g, '\n    ')}\n`;
          });
        });
      }
      if (out.achievements && out.achievements.achievements) {
        md += '\n## 成果管理\n';
        out.achievements.achievements.forEach(a => {
          md += `\n### [${a.type}] ${a.title}\n`;
          md += `- 状态：${a.status || ''} ｜ 时间：${a.time || ''} ｜ 年份：${a.year || ''}\n`;
          const extra = [['期刊', a.journal], ['IF', a.if], ['分区', a.zone], ['角色', a.role], ['专利号', a.patentNo], ['会议', a.confName], ['报告类型', a.reportType], ['授予单位', a.awardOrg]].filter(x => x[1]).map(x => `${x[0]}：${x[1]}`).join(' ｜ ');
          if (extra) md += `- ${extra}\n`;
          if (a.background) md += `- 研究背景：${a.background}\n`;
          if (a.contribution) md += `- 主要贡献：${a.contribution}\n`;
          if (a.innovation) md += `- 创新点：${a.innovation}\n`;
        });
      }
      const blob = new Blob(['\uFEFF' + md], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${fname}.md`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }

  /* ---------- 7 快捷操作 ---------- */
  function pageShortcuts(box) {
    const sc = [
      ['新建科研日志', 'Alt + J'],
      ['新建任务', 'Alt + T'],
      ['快速搜索', 'Alt + K'],
      ['新建项目', 'Alt + P']
    ];
    box.innerHTML = card('系统快捷键', `
      <div class="set-shortcuts">
        ${sc.map(([n, k]) => `<div class="set-shortcut"><span>${n}</span><kbd>${k}</kbd></div>`).join('')}
      </div>
      <div class="set-hint">快捷键已生效，可在任意页面使用。浏览器保留 Ctrl 组合键，故使用 Alt + 字母触发。</div>`);
  }

  /* ---------- 快捷键功能 ---------- */
  function quickNewLog() {
    window.EditModalOpen('新建科研日志', `
      <form class="edit-form">
        <div class="edit-field"><label>日志内容</label><textarea name="text" rows="4" placeholder="记录今天的实验进展、思考…" required></textarea></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, values => {
      if (values.text) {
        Store.addFeed(values.text, '科研日志');
        alert('科研日志已记录到科研动态');
      }
    });
  }

  function quickNewTask() {
    window.EditModalOpen('新建任务', `
      <form class="edit-form">
        <div class="edit-field"><label>任务名称</label><input name="title" maxlength="60" placeholder="输入任务…" required></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">添加</button>
        </div>
      </form>`, values => {
      if (values.title) {
        Store.addTodo(Store.todayStr(), values.title);
        alert('任务已添加到今日工作计划');
      }
    });
  }

  function quickSearch() {
    window.EditModalOpen('快速搜索', `
      <div class="edit-field"><label>关键词</label><input id="qsInput" placeholder="搜索实验技能、日程、任务、科研动态…"></div>
      <div class="lab-refs" id="qsResult" style="margin-top:10px"></div>
      <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">关闭</button></div>`, null);
    const input = document.getElementById('qsInput');
    const res = document.getElementById('qsResult');
    input.focus();
    input.addEventListener('input', () => {
      const kw = input.value.trim().toLowerCase();
      res.innerHTML = '';
      if (!kw) return;
      const hits = [];
      Store.experiments().skills.forEach(s => {
        if (s.name.toLowerCase().includes(kw)) hits.push({ type: '实验技能', name: s.name, id: s.id });
      });
      Object.entries(Store.events() || {}).forEach(([date, list]) => {
        list.forEach(e => {
          if ((e.title || '').toLowerCase().includes(kw)) hits.push({ type: '日程', name: `${date} ${e.time} ${e.title}` });
        });
      });
      Object.entries(Store.load().todos || {}).forEach(([date, list]) => {
        list.forEach(t => {
          if ((t.title || '').toLowerCase().includes(kw)) hits.push({ type: '任务', name: `${date} ${t.title}` });
        });
      });
      Store.feed().forEach(f => {
        if ((f.text || '').toLowerCase().includes(kw)) hits.push({ type: '动态', name: f.text });
      });
      hits.slice(0, 10).forEach(h => {
        const div = document.createElement('div');
        div.className = 'lab-ref';
        div.style.marginBottom = '6px';
        div.innerHTML = `<div class="lab-ref-title">[${h.type}] ${escapeHtml(h.name)}</div>`;
        if (window.Goto) {
          div.style.cursor = 'pointer';
          div.addEventListener('click', () => {
            EditModalClose();
            window.Goto(h.type === '实验技能' ? 'lab' : h.type === '日程' ? 'schedule' : 'home');
          });
        }
        res.appendChild(div);
      });
      if (!hits.length) res.innerHTML = '<div class="lab-ref-empty">无匹配结果</div>';
    });
  }

  function quickNewProject() {
    window.EditModalOpen('新建项目', `
      <form class="edit-form">
        <div class="edit-field"><label>项目名称</label><input name="name" maxlength="40" placeholder="输入项目名称…" required></div>
        <div class="edit-field"><label>类型</label>
          <select name="type"><option>博士课题</option><option>导师项目</option><option>合作项目</option><option>论文项目</option></select>
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">创建</button>
        </div>
      </form>`, values => {
      if (values.name) {
        Store.addProject({
          name: values.name, type: values.type, start: '', end: '', mentor: '',
          members: ['本人'], status: '进行中', percent: 0, archived: false,
          stages: [], issues: [], timeline: [{ time: String(new Date().getFullYear()), text: '项目创建' }],
          linked: { tasks: 0, experiments: 0, refs: 0, papers: 0, outputs: 0 }
        });
        alert(`项目「${values.name}」已创建`);
        if (window.Goto) window.Goto('proj');
      }
    });
  }

  /* 全局快捷键:Alt + J/T/K/P */
  function initShortcuts() {
    document.addEventListener('keydown', e => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = (e.key || '').toLowerCase();
      if (k === 'j') { e.preventDefault(); quickNewLog(); }
      else if (k === 't') { e.preventDefault(); quickNewTask(); }
      else if (k === 'k') { e.preventDefault(); quickSearch(); }
      else if (k === 'p') { e.preventDefault(); quickNewProject(); }
    });
  }

  /* ---------- 8 关于系统 ---------- */
  function pageAbout(box) {
    box.innerHTML = `
      <div class="set-about">
        <div class="set-about-logo">ScholarFlow</div>
        <div class="set-about-version">版本：v1.0 测试版</div>
        <div class="set-about-desc">面向硕博研究人员的个人科研操作系统。帮助研究者管理从研究想法产生,到实验实施、数据分析、论文 Figure 构建以及最终成果沉淀的完整科研流程。</div>
        <div class="set-about-desc" style="font-size:12.5px">关注科研过程的可追溯性：项目在哪里推进？实验如何完成？数据如何产生？Figure 如何构建？论文结论依据是什么？所有科研资产在一个系统中形成闭环。</div>
        <div class="set-about-links">
          <button class="lab-action-btn" id="aboutUpdate">版本更新</button>
          <button class="lab-action-btn" id="aboutHelp">帮助文档</button>
          <button class="lab-action-btn" id="aboutFeedback">问题反馈</button>
        </div>
      </div>`;
    box.querySelector('#aboutUpdate').addEventListener('click', () => {
      window.EditModalOpen('版本更新', `
        <div class="lab-ref-empty" style="text-align:left;line-height:1.8">
          <b>ScholarFlow v1.0 测试版</b><br>
          当前为最新测试版。<br>
          · 已实现:9 大模块(首页/日程/项目/实验/文献/数据分析/成果/AI/设置)<br>
          · 科研数据全部保存在浏览器本地<br>
          · 更多功能规划见 README / docs
        </div>`, null);
    });
    box.querySelector('#aboutHelp').addEventListener('click', () => {
      window.EditModalOpen('帮助文档', `
        <div class="lab-ref-empty" style="text-align:left;line-height:2.2">
          请复制以下链接到浏览器打开:<br>
          <b style="color:var(--blue);font-size:14px;user-select:all">https://github.com/seanyao97/ScholarFlow</b>
        </div>`, null);
    });
    box.querySelector('#aboutFeedback').addEventListener('click', () => {
      window.EditModalOpen('问题反馈', `
        <div class="lab-ref-empty" style="text-align:left;line-height:2.2">
          反馈邮箱:<br>
          <b style="color:var(--blue);font-size:14px">seanyao9712@163.com</b><br>
          <span style="font-size:12px">欢迎将使用中遇到的问题、建议发送到该邮箱。</span>
        </div>`, null);
    });
  }

  function init() {
    renderMenu();
    renderContent();
    applyGlobal();
    initShortcuts();
  }

  return { init, renderAll: renderContent };
})();
