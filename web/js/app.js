'use strict';

/**
 * app.js — 应用装配
 * 倒计时动态计算、导出本周工作进展汇报、今日工作计划联动科研动态、导航高亮、初始化
 */
(() => {
  // 捕获全局错误,避免影响界面
  window.addEventListener('error', e => {
    try { console.error('[ScholarFlow]', e.message || e.error); } catch (err) { /* 忽略 */ }
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ---------- 倒计时 ---------- */
  function renderCountdown() {
    const row = document.getElementById('countdownRow');
    row.innerHTML = '';
    const today = new Date(Store.todayStr() + 'T00:00');
    Store.milestones().forEach(m => {
      const diff = Math.round((new Date(m.date + 'T00:00') - today) / 86400000);
      const tag = document.createElement('span');
      tag.className = 'countdown-tag';
      if (diff > 0) tag.textContent = `${m.name}倒计时 ${diff} 天`;
      else if (diff === 0) tag.textContent = `${m.name}（今天）`;
      else { tag.textContent = `${m.name}已过 ${-diff} 天`; tag.classList.add('expired'); }
      row.appendChild(tag);
    });
  }

  /* ---------- 通用编辑弹窗 ---------- */
  const EditModal = (() => {
    const overlay = document.getElementById('editModal');
    const titleEl = document.getElementById('editModalTitle');
    const bodyEl = document.getElementById('editModalBody');
    let onSave = null;

    function open(title, bodyHTML, saveHandler) {
      document.querySelector('#editModal .modal')?.classList.remove('modal-wide');
      titleEl.textContent = title;
      bodyEl.innerHTML = bodyHTML;
      onSave = saveHandler;
      overlay.hidden = false;
    }

    function close() {
      overlay.hidden = true;
      onSave = null;
    }

    function collect(form) {
      const out = {};
      [...form.elements].forEach(el => {
        if (el.name) out[el.name] = el.value.trim();
      });
      return out;
    }

    function init() {
      document.getElementById('editModalClose').addEventListener('click', close);
      overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
      });
      bodyEl.addEventListener('submit', e => {
        e.preventDefault();
        if (onSave) {
          onSave(collect(e.target));
          close();
        }
      });
    }

    return { init, open, close };
  })();

  /* ---------- 每周计划(周一到周日整体目标,日程管理) ---------- */
  const WeekPlan = {
    uid: () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    render(id) {
      const box = document.getElementById(id);
      if (!box) return;
      const ws = Store.weekStartOf(Store.todayStr());
      const plan = Store.getWeekPlan(ws) || {};
      const items = plan.items || [];
      const done = items.filter(i => i.done).length;
      const wd = new Date(ws + 'T00:00');
      const we = new Date(wd);
      we.setDate(wd.getDate() + 6);
      const rng = `${wd.getMonth() + 1}月${wd.getDate()}日 - ${we.getMonth() + 1}月${we.getDate()}日`;
      box.innerHTML = `
        <div class="week-plan-head">
          <span class="week-plan-title">本周计划</span>
          <span class="week-plan-range">${rng}</span>
          <button class="edit-btn week-plan-edit" id="wpEdit">编辑</button>
        </div>
        ${plan.goal ? `<div class="week-plan-goal">${escapeHtml(plan.goal)}</div>` : ''}
        <div class="week-plan-items">
          ${items.length ? items.map(it => `
            <div class="week-plan-item ${it.done ? 'done' : ''}">
              <label class="week-plan-item-row">
                <input type="checkbox" ${it.done ? 'checked' : ''} data-id="${it.id}">
                <span>${escapeHtml(it.text)}</span>
              </label>
              <button class="icon-btn danger wp-del" data-id="${it.id}" title="删除">×</button>
            </div>`).join('') : '<div class="week-plan-empty">点击"编辑"设置本周整体目标<br>（周一至周日,不按天拆分）</div>'}
        </div>`;
      box.querySelector('#wpEdit').addEventListener('click', () => this.edit(ws));
      box.querySelectorAll('input[type=checkbox][data-id]').forEach(cb => {
        cb.addEventListener('change', () => this.toggle(ws, cb.dataset.id, cb.checked));
      });
      box.querySelectorAll('.wp-del').forEach(b => {
        b.addEventListener('click', () => this.remove(ws, b.dataset.id));
      });
    },
    add(ws, text) {
      const plan = Store.getWeekPlan(ws) || {};
      const items = plan.items || [];
      items.push({ id: this.uid(), text, done: false });
      Store.setWeekPlan(ws, { items });
      this.render('schWeekPlan');
    },
    remove(ws, id) {
      const plan = Store.getWeekPlan(ws) || {};
      Store.setWeekPlan(ws, { items: (plan.items || []).filter(i => i.id !== id) });
      this.render('schWeekPlan');
    },
    toggle(ws, id, done) {
      const plan = Store.getWeekPlan(ws) || {};
      Store.setWeekPlan(ws, { items: (plan.items || []).map(i => i.id === id ? Object.assign({}, i, { done }) : i) });
      this.render('schWeekPlan');
    },
    edit(ws) {
      const plan = Store.getWeekPlan(ws) || {};
      const lines = (plan.items || []).map(i => i.text).join('\n');
      window.EditModalOpen('编辑本周计划', `
        <form class="edit-form">
          <div class="edit-field"><label>本周整体说明（可选）</label>
            <textarea name="goal" rows="2" placeholder="如：完成 DNA 提取与建库、整理开题报告初稿…">${escapeHtml(plan.goal || '')}</textarea>
          </div>
          <div class="edit-field"><label>周目标条目（每行一条,删除某行即删除该条）</label>
            <textarea name="items" rows="4" placeholder="完成 DNA 提取与建库&#10;整理开题报告初稿">${escapeHtml(lines)}</textarea>
          </div>
          <div class="edit-actions">
            <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
            <button type="submit" class="btn-primary">保存</button>
          </div>
        </form>`, v => {
        const oldItems = plan.items || [];
        const items = v.items.split('\n').map(s => s.trim()).filter(Boolean).map(text => {
          const old = oldItems.find(o => o.text === text);
          return old ? old : { id: this.uid(), text, done: false };
        });
        Store.setWeekPlan(ws, { goal: v.goal, items });
        this.render('schWeekPlan');
      });
    }
  };
  window.WeekPlan = WeekPlan;

  /* ---------- 首页:个人信息编辑 ---------- */
  function renderProfile() {
    const s = Store.academic().student;
    document.getElementById('profileName').textContent = s.name;
    document.getElementById('profileMeta').innerHTML =
      `${escapeHtml(s.school)} · ${escapeHtml(s.dept)}<br>${escapeHtml(s.degree)}`;
    document.getElementById('academicName').textContent = s.name;
    document.getElementById('academicSchool').textContent = s.school;
    document.getElementById('academicDept').textContent = s.dept;
    document.getElementById('academicDegree').textContent = s.degree;
  }

  function openStudentEdit() {
    const s = Store.academic().student;
    EditModal.open('编辑个人资料', `
      <form class="edit-form">
        <div class="edit-field"><label>姓名</label><input name="name" value="${escapeHtml(s.name)}" maxlength="20" required></div>
        <div class="edit-field"><label>学校</label><input name="school" value="${escapeHtml(s.school)}" maxlength="40" required></div>
        <div class="edit-field"><label>专业</label><input name="dept" value="${escapeHtml(s.dept)}" maxlength="40" required></div>
        <div class="edit-field"><label>学历</label><input name="degree" value="${escapeHtml(s.degree)}" maxlength="40" required></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, values => {
      Store.updateStudent(values);
      renderProfile();
      renderAcademic();
    });
  }

  /* ---------- 工作计划(跟随日历选中日期,联动日程管理的日程 events) ---------- */
  function renderTodos(dateStr) {
    const list = document.getElementById('todoList');
    const dateEl = document.getElementById('todoDate');
    const titleEl = document.getElementById('todoTitle');
    list.innerHTML = '';
    const t = dateStr || Calendar.selectedDate() || Store.todayStr();
    const todos = Store.getTodos(t);
    const [y, m, d] = t.split('-').map(Number);
    const week = ['日', '一', '二', '三', '四', '五', '六'][new Date(y, m - 1, d).getDay()];
    titleEl.textContent = t === Store.todayStr() ? '今日工作计划' : `${m}月${d}日 工作计划`;
    dateEl.textContent = `周${week}`;

    // 该日期的日程安排(来自日程管理模块) — 联动显示
    const evs = Store.getEvents(t);
    evs.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'todo-event';
      item.innerHTML =
        `<span class="todo-ev-time">${escapeHtml(ev.time)}</span>` +
        `<span class="todo-ev-title">${escapeHtml(ev.title)}</span>` +
        `<span class="todo-ev-type">${escapeHtml(ev.type || '')}</span>`;
      list.appendChild(item);
    });

    if (!todos.length) {
      if (!evs.length) list.innerHTML = '<div class="event-empty">当天暂无安排</div>';
    }
    todos.forEach(td => {
      const item = document.createElement('div');
      item.className = 'todo-item' + (td.done ? ' done' : '');
      const box = document.createElement('span');
      box.className = 'todo-box';
      const name = document.createElement('span');
      name.className = 'todo-name';
      name.textContent = td.title;
      const actions = document.createElement('span');
      actions.className = 'todo-actions';
      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn';
      editBtn.title = '编辑任务';
      editBtn.textContent = '✎';
      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn danger';
      delBtn.title = '删除任务';
      delBtn.textContent = '×';
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      item.appendChild(box);
      item.appendChild(name);
      item.appendChild(actions);
      item.addEventListener('click', () => {
        const newDone = !td.done;
        Store.setTodoDone(t, td.id, newDone);
        if (newDone) Store.addFeed(`完成任务：${td.title}`, '任务中心');
        renderTodos(t);
        renderFeed();
        renderStats();
      });
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        EditModal.open('编辑任务', `
          <form class="edit-form">
            <div class="edit-field"><label>任务名称</label><input name="title" value="${escapeHtml(td.title)}" maxlength="60" required></div>
            <div class="edit-actions">
              <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
              <button type="submit" class="btn-primary">保存</button>
            </div>
          </form>`, values => {
          Store.updateTodo(t, td.id, values.title);
          renderTodos(t);
        });
      });
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        Store.removeTodo(t, td.id);
        renderTodos(t);
        renderStats();
      });
      list.appendChild(item);
    });
  }

  /* ---------- 通知提醒(每天第一次提醒,右上角弹窗,1分钟自动消失/点击关闭) ---------- */
  const NOTICE_KEY = 'rws_notice_date';
  let noticeTimer = null;
  function hideNotice() {
    const box = document.getElementById('noticeBanner');
    if (box) box.style.display = 'none';
    if (noticeTimer) { clearTimeout(noticeTimer); noticeTimer = null; }
  }
  function renderNotices() {
    const box = document.getElementById('noticeBanner');
    if (!box) return;
    const n = Store.settings().notify;
    const msgs = [];
    // 重要节点提醒(3 天内)
    if (n.milestone) {
      const today = new Date(Store.todayStr() + 'T00:00');
      Store.milestones().forEach(m => {
        const diff = Math.round((new Date(m.date + 'T00:00') - today) / 86400000);
        if (diff >= 0 && diff <= 3) msgs.push(`⏰ 重要节点「${m.name}」还有 ${diff} 天（${m.date}）`);
      });
    }
    // 每日科研日志提醒
    if (n.dailyLog) {
      const hasLog = Store.feed().some(f => f.source === '科研日志' && String(f.ts || '').startsWith(Store.todayStr()));
      if (!hasLog) msgs.push('📝 今天还没记录科研日志');
    }
    // 周报生成提醒(周五)
    if (n.weeklyReport) {
      const wd = new Date().getDay();
      if (wd === 5) msgs.push('📊 今天是周五,记得生成本周科研周报');
    }
    hideNotice();
    if (!msgs.length) return;
    // 每天第一次提醒:当天已提醒过则不再弹出
    let last = '';
    try { last = localStorage.getItem(NOTICE_KEY) || ''; } catch (e) { /* 忽略 */ }
    if (last === Store.todayStr()) return;
    try { localStorage.setItem(NOTICE_KEY, Store.todayStr()); } catch (e) { /* 忽略 */ }
    box.innerHTML = '';
    msgs.forEach(m => {
      const item = document.createElement('div');
      item.className = 'notice-item';
      item.textContent = m;
      box.appendChild(item);
    });
    box.style.display = 'flex';
    box.onclick = hideNotice;
    noticeTimer = setTimeout(hideNotice, 60 * 1000);   // 1 分钟自动消失
  }

  /* ---------- 个人统计 ---------- */
  function renderStats() {
    const undone = Store.getTodos(Store.todayStr()).filter(x => !x.done).length;
    document.getElementById('statTasks').textContent = undone;
    // 学业进度 = 学分完成百分比(动态)
    const credits = Store.academic().credits;
    const pct = credits && credits.total ? Math.round(credits.done / credits.total * 100) : 0;
    const progressEl = document.getElementById('statProgress');
    if (progressEl) progressEl.textContent = pct + '%';
    // 连续记录 = 科研动态有记录的天数
    const days = new Set((Store.feed() || []).map(f => (f.ts || '').slice(0, 10))).size;
    const streakEl = document.getElementById('statStreak');
    if (streakEl) streakEl.textContent = days + '天';
  }

  /* ---------- 科研动态 ---------- */
  function feedLabel(ts) {
    const d = new Date(ts.replace('T', 'T'));
    const today = new Date(Store.todayStr() + 'T00:00');
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((today - day) / 86400000);
    const hm = ts.slice(11);
    if (diff === 0) return '今天 ' + hm;
    if (diff === 1) return '昨天 ' + hm;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
  }

  let feedShowAll = false;
  function renderFeed() {
    const tl = document.getElementById('timeline');
    tl.innerHTML = '';
    const list = Store.feed();
    const shown = feedShowAll ? list : list.slice(0, 6);
    shown.forEach(f => {
      const item = document.createElement('div');
      item.className = 'tl-item';
      item.innerHTML =
        '<span class="tl-dot"></span>' +
        `<div class="tl-time">${escapeHtml(feedLabel(f.ts))}</div>` +
        `<div class="tl-text">${escapeHtml(f.text)}</div>` +
        `<span class="tl-tag">来源：${escapeHtml(f.source)}</span>`;
      tl.appendChild(item);
    });
    const more = document.getElementById('feedMore');
    if (more) more.textContent = feedShowAll ? '收起' : '查看全部动态';
  }

  /* ---------- 导出本周工作进展汇报 ---------- */
  function exportWeek() {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;                 // 周一 = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDays.push(d);
    }
    const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const cn = d => `${d.getMonth() + 1}月${d.getDate()}日`;

    let md = `# 本周工作进展汇报（${cn(weekDays[0])} - ${cn(weekDays[6])}）\n\n`;
    md += `> 生成时间：${now.toLocaleString('zh-CN')}\n\n`;

    md += '## 一、日程安排\n';
    weekDays.forEach((d, i) => {
      const ds = Store.fmtDate(d);
      const evs = Store.getEvents(ds);
      md += `\n### ${cn(d)}（${weekNames[i]}）\n`;
      if (!evs.length) md += '- （无日程）\n';
      else evs.forEach(e => md += `- ${e.time} ${e.title}（${e.type}）\n`);
    });

    md += '\n## 二、任务完成情况\n';
    weekDays.forEach((d, i) => {
      const ds = Store.fmtDate(d);
      const todos = Store.getTodos(ds);
      md += `\n### ${cn(d)}（${weekNames[i]}）\n`;
      if (!todos.length) md += '- （无任务）\n';
      else todos.forEach(t => md += `- [${t.done ? 'x' : ' '}] ${t.title}\n`);
    });

    md += '\n## 三、重要节点\n';
    const today = new Date(Store.todayStr() + 'T00:00');
    Store.milestones().forEach(m => {
      const diff = Math.round((new Date(m.date + 'T00:00') - today) / 86400000);
      md += `- ${m.name}：${m.date}（${diff > 0 ? '倒计时 ' + diff + ' 天' : (diff === 0 ? '今天' : '已过')}）\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `工作进展汇报-${Store.todayStr()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- 学业概览 ---------- */
  const STATUS_TEXT = { done: '已完成', upcoming: '进行中', todo: '未开始' };

  function showView(name) {
    document.getElementById('viewHome').hidden = name !== 'home';
    document.getElementById('viewAcademic').hidden = name !== 'academic';
    document.getElementById('viewSchedule').hidden = name !== 'schedule';
    document.getElementById('viewLab').hidden = name !== 'lab';
    document.getElementById('viewSettings').hidden = name !== 'settings';
    document.getElementById('viewLit').hidden = name !== 'lit';
    document.getElementById('viewAch').hidden = name !== 'ach';
    document.getElementById('viewFiles').hidden = name !== 'files';
    document.getElementById('viewAi').hidden = name !== 'ai';
    document.getElementById('viewProj').hidden = name !== 'proj';
    document.getElementById('viewPaper').hidden = name !== 'paper';
  }

  function renderAcademic() {
    const ac = Store.academic();
    if (!ac || !ac.student) return;
    document.getElementById('academicName').textContent = ac.student.name;
    document.getElementById('academicSchool').textContent = ac.student.school;
    document.getElementById('academicDept').textContent = ac.student.dept;
    document.getElementById('academicDegree').textContent = ac.student.degree;

    const cp = Math.round((ac.credits && ac.credits.total ? ac.credits.done / ac.credits.total * 100 : 0));
    document.getElementById('creditsNum').textContent = cp + '%';
    document.getElementById('creditsBar').style.width = cp + '%';
    document.getElementById('thesisNum').textContent = (ac.thesis && ac.thesis.percent != null ? ac.thesis.percent : 0) + '%';
    document.getElementById('thesisBar').style.width = (ac.thesis && ac.thesis.percent != null ? ac.thesis.percent : 0) + '%';

    const row = document.getElementById('milestoneRow');
    row.innerHTML = '';
    ac.milestones.forEach(m => {
      const item = document.createElement('div');
      item.className = 'milestone-item ' + m.status;
      item.innerHTML =
        '<span class="milestone-dot"></span>' +
        `<span class="milestone-status">${STATUS_TEXT[m.status] || ''}</span>` +
        `<span class="milestone-name">${escapeHtml(m.name)}</span>` +
        `<span class="milestone-time">${escapeHtml(m.time)}</span>`;
      item.addEventListener('click', () => AcademicModal.open(m));
      row.appendChild(item);
    });
  }

  /* ---------- 学业概览编辑 ---------- */
  function openCreditsEdit() {
    const c = Store.academic().credits;
    EditModal.open('编辑学分进度', `
      <form class="edit-form">
        <div class="edit-field"><label>已修学分</label><input type="number" name="done" min="0" max="500" value="${c.done}" required></div>
        <div class="edit-field"><label>总学分</label><input type="number" name="total" min="1" max="500" value="${c.total}" required></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, values => {
      const done = Math.max(0, parseInt(values.done, 10) || 0);
      const total = Math.max(1, parseInt(values.total, 10) || 1);
      Store.updateCredits(done, total);
      renderAcademic();
    });
  }

  function openThesisEdit() {
    const t = Store.academic().thesis;
    EditModal.open('编辑论文进度', `
      <form class="edit-form">
        <div class="edit-field"><label>完成百分比（%）</label><input type="number" name="percent" min="0" max="100" value="${t.percent}" required></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, values => {
      Store.updateThesis(Math.min(100, Math.max(0, parseInt(values.percent, 10) || 0)));
      renderAcademic();
    });
  }

  function bindMilestoneDel() {
    document.querySelectorAll('.m-del').forEach(btn => {
      btn.onclick = () => {
        const row = btn.closest('.milestone-manage-item');
        const id = row.dataset.id;
        if (id && id !== 'new') {
          Store.removeMilestone(id);
          renderAcademic();
        }
        row.remove();
      };
    });
  }

  function openMilestonesEdit() {
    const ac = Store.academic();
    const statusOpts = [
      ['done', '已完成'],
      ['upcoming', '进行中'],
      ['todo', '未开始']
    ];
    const rows = ac.milestones.map(m => `
      <div class="milestone-manage-item" data-id="${m.id}">
        <input class="m-name" value="${escapeHtml(m.name)}" maxlength="12">
        <input class="m-time" value="${escapeHtml(m.time)}" maxlength="30">
        <select class="m-status">${statusOpts.map(([v, t]) => `<option value="${v}" ${m.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <button type="button" class="icon-btn danger m-del" title="删除节点">×</button>
      </div>`).join('');

    EditModal.open('管理培养节点', `
      <div class="milestone-manage-list">${rows}</div>
      <button type="button" class="edit-btn" id="milestoneAddRow">+ 添加节点</button>
      <div class="edit-actions">
        <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
        <button type="button" class="btn-primary" id="milestoneSave">保存</button>
      </div>`);

    bindMilestoneDel();
    document.getElementById('milestoneAddRow').addEventListener('click', () => {
      const list = document.querySelector('.milestone-manage-list');
      const div = document.createElement('div');
      div.className = 'milestone-manage-item';
      div.dataset.id = 'new';
      div.innerHTML =
        '<input class="m-name" value="新节点" maxlength="12">' +
        '<input class="m-time" value="2026年" maxlength="30">' +
        '<select class="m-status"><option value="todo" selected>未开始</option><option value="upcoming">进行中</option><option value="done">已完成</option></select>' +
        '<button type="button" class="icon-btn danger m-del" title="删除节点">×</button>';
      list.appendChild(div);
      bindMilestoneDel();
    });
    document.getElementById('milestoneSave').addEventListener('click', () => {
      document.querySelectorAll('.milestone-manage-item').forEach(row => {
        const fields = {
          name: row.querySelector('.m-name').value.trim() || '未命名',
          time: row.querySelector('.m-time').value.trim(),
          status: row.querySelector('.m-status').value
        };
        if (row.dataset.id === 'new') Store.addMilestone(fields);
        else Store.updateMilestone(row.dataset.id, fields);
      });
      renderAcademic();
      EditModal.close();
    });
  }

  /* 各模块左栏折叠/展开 */
  function initSidebarToggles() {
    document.querySelectorAll('.sidebar-toggle').forEach(btn => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      btn.addEventListener('click', () => {
        const hidden = target.style.display === 'none';
        target.style.display = hidden ? '' : 'none';
        btn.textContent = hidden ? '◀' : '▶';
        btn.title = hidden ? '折叠侧栏' : '展开侧栏';
      });
    });
  }

  /* ---------- 导航拖拽排序(首页外模块) ---------- */
  const NAV_KEY = 'rws_nav_order';

  function loadNavOrder() {
    try {
      const v = JSON.parse(localStorage.getItem(NAV_KEY));
      return Array.isArray(v) ? v : null;
    } catch (e) { return null; }
  }

  function saveNavOrder() {
    const order = [];
    document.querySelectorAll('.nav .nav-item').forEach(i => {
      const t = i.textContent;
      if (t !== '首页' && t !== '设置') order.push(t);
    });
    try { localStorage.setItem(NAV_KEY, JSON.stringify(order)); } catch (e) { /* 忽略 */ }
  }

  function applyNavOrder() {
    const order = loadNavOrder();
    if (!order) return;
    const nav = document.querySelector('.nav');
    const divider = nav.querySelector('.nav-divider');
    const items = {};
    nav.querySelectorAll('.nav-item').forEach(i => { items[i.textContent] = i; });
    order.forEach(name => {
      // 旧名映射到新导航名
      const map = { '科研日志': 'AI 助手', '论文工作台': '数据分析' };
      const key = map[name] || name;
      if (items[key] && key !== '首页' && key !== '设置') {
        nav.insertBefore(items[key], divider);
      }
    });
  }

  function initDragNav() {
    const nav = document.querySelector('.nav');
    nav.querySelectorAll('.nav-item').forEach(item => {
      const t = item.textContent;
      item.draggable = (t !== '首页' && t !== '设置');
      if (!item.draggable) return;
      item.addEventListener('dragstart', e => {
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', e => e.preventDefault());
      item.addEventListener('drop', e => {
        e.preventDefault();
        const dragging = nav.querySelector('.dragging');
        if (!dragging || dragging === item) return;
        const rect = item.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        nav.insertBefore(dragging, after ? item.nextSibling : item);
        saveNavOrder();
      });
    });
  }

  /* ---------- 导航 ---------- */
  function initNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
        item.classList.add('active');
        const label = item.textContent;
        if (label === '首页') {
          showView('home');
          renderCountdown();   // 刷新倒计时(日程管理可能已修改节点)
          renderNotices();     // 刷新提醒(基于节点/日志状态)
          renderStats();       // 刷新个人统计
        } else if (label === '日程管理') {
          showView('schedule');
          Schedule.renderAll();
        } else if (label === '实验中心') {
          showView('lab');
          Lab.renderAll();
        } else if (label === '设置') {
          showView('settings');
          Settings.renderAll();
        } else if (label === '文献证据') {
          showView('lit');
          Literature.renderAll();
        } else if (label === '成果管理') {
          showView('ach');
          Achievement.renderAll();
        } else if (label === '文件管理') {
          showView('files');
          Files.renderAll();
        } else if (label === 'AI 助手') {
          showView('ai');
          AIHelper.renderAll();
        } else if (label === '项目管理') {
          showView('proj');
          Project.renderAll();
        } else if (label === '数据分析') {
          showView('paper');
          PaperWorkspace.renderAll();
        }
      });
    });
  }

  /* ---------- 节点材料弹窗 ---------- */
  const AcademicModal = (() => {
    const overlay = document.getElementById('academicModal');
    const titleEl = document.getElementById('academicModalTitle');
    const metaEl = document.getElementById('academicModalMeta');
    const listEl = document.getElementById('academicMaterialList');
    const form = document.getElementById('materialAddForm');
    let currentNodeId = null;

    function renderList() {
      listEl.innerHTML = '';
      const mats = (Store.academic().materials[currentNodeId] || []);
      if (!mats.length) {
        listEl.innerHTML = '<div class="event-empty">暂无材料,可添加</div>';
        return;
      }
      mats.forEach(m => {
        const item = document.createElement('div');
        item.className = 'material-item';
        item.innerHTML =
          `<span class="material-icon">${escapeHtml(m.type)}</span>` +
          `<span class="material-name">${escapeHtml(m.name)}</span>` +
          `<span class="material-type">${escapeHtml(m.type)}</span>` +
          `<button class="icon-btn danger material-del" title="删除材料" data-id="${m.id}">×</button>`;
        listEl.appendChild(item);
      });
    }

    function open(node) {
      currentNodeId = node.id;
      titleEl.textContent = `${node.name} · 相关材料`;
      metaEl.textContent = `${STATUS_TEXT[node.status] || ''} · ${node.time}`;
      form.elements.matName.value = '';
      form.elements.matType.value = 'PDF';
      renderList();
      overlay.hidden = false;
    }

    function close() {
      overlay.hidden = true;
      currentNodeId = null;
    }

    function init() {
      document.getElementById('academicModalClose').addEventListener('click', close);
      overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !overlay.hidden) close();
      });
      listEl.addEventListener('click', e => {
        const btn = e.target.closest('.material-del');
        if (!btn) return;
        Store.removeMaterial(currentNodeId, btn.dataset.id);
        renderList();
      });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const name = form.elements.matName.value.trim();
        const type = form.elements.matType.value;
        if (!name || !currentNodeId) return;
        Store.addMaterial(currentNodeId, { name, type });
        form.elements.matName.value = '';
        renderList();
      });
    }

    return { init, open, close };
  })();

  /* ---------- 初始化 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    Store.load();
    EditModal.init();
    Calendar.init();
    AcademicModal.init();
    Schedule.init();
    Lab.init();
    Literature.init();
    Achievement.init();
    Files.init();
    Project.init();
    PaperWorkspace.init();
    AIHelper.init();
    Settings.init();
    renderCountdown();
    renderProfile();
    renderTodos();
    renderStats();
    renderFeed();
    renderNotices();
    renderAcademic();
    applyNavOrder();
    initDragNav();
    initNav();
    initSidebarToggles();

    window.EditModalClose = () => EditModal.close();
    window.EditModalOpen = (title, bodyHTML, saveHandler) => EditModal.open(title, bodyHTML, saveHandler);
    window.Goto = (name) => {
      showView(name);
      // 跳转时渲染目标模块,避免空白
      if (name === 'schedule') Schedule.renderAll();
      else if (name === 'lab') Lab.renderAll();
      else if (name === 'lit') Literature.renderAll();
      else if (name === 'paper') PaperWorkspace.renderAll();
      else if (name === 'ach') Achievement.renderAll();
      else if (name === 'files') Files.renderAll();
      else if (name === 'proj') Project.renderAll();
      else if (name === 'settings') Settings.renderAll();
      else if (name === 'home') { renderNotices(); renderStats(); renderCountdown(); }
    };

    document.getElementById('calExport').addEventListener('click', exportWeek);
    document.getElementById('feedMore').addEventListener('click', () => {
      feedShowAll = !feedShowAll;
      renderFeed();
    });
    document.getElementById('profileBtn').addEventListener('click', () => {
      renderAcademic();
      showView('academic');
    });
    document.getElementById('backHome').addEventListener('click', () => showView('home'));

    // 编辑入口
    document.getElementById('profileEdit').addEventListener('click', openStudentEdit);
    document.getElementById('studentEdit').addEventListener('click', openStudentEdit);
    document.getElementById('creditsEdit').addEventListener('click', openCreditsEdit);
    document.getElementById('thesisEdit').addEventListener('click', openThesisEdit);
    document.getElementById('milestonesEdit').addEventListener('click', openMilestonesEdit);
    document.getElementById('todoAdd').addEventListener('click', () => {
      const t = Calendar.selectedDate() || Store.todayStr();
      EditModal.open('添加任务', `
        <form class="edit-form">
          <div class="edit-field"><label>任务名称</label><input name="title" maxlength="60" placeholder="输入任务…" required></div>
          <div class="edit-actions">
            <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
            <button type="submit" class="btn-primary">添加</button>
          </div>
        </form>`, values => {
        Store.addTodo(t, values.title);
        renderTodos(t);
        renderStats();
      });
    });

    // 日历选中日期变化 → 切换工作计划
    document.addEventListener('calendar:pick', e => {
      renderTodos(e.detail);
    });

    // 个人资料变更 → 刷新首页与学业概览
    document.addEventListener('rws:profile-changed', () => {
      renderProfile();
      renderStats();
    });
  });
})();
