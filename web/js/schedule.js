'use strict';

/**
 * schedule.js — 日程管理页
 * 月历状态标签、点击查看当日安排、重要节点倒计时、本周科研状态、今日工作、科研周报生成
 */
const Schedule = (() => {
  /* 事件类型 → 分类 */
  const SCIENCE = ['实验', '采样', '测试', '数据处理', '仪器预约'];
  const ACADEMIC = ['组会', '导师讨论', '学术会议', '答辩'];
  const MILESTONE = ['开题答辩', '中期考核', '论文投稿截止', '项目验收'];
  const PERSONAL = ['课程', '学校手续', '培训'];

  function classify(type) {
    if (SCIENCE.includes(type)) return 'k-science';
    if (ACADEMIC.includes(type)) return 'k-academic';
    if (MILESTONE.includes(type)) return 'k-milestone';
    if (PERSONAL.includes(type)) return 'k-personal';
    return 'k-default';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  const pad = n => String(n).padStart(2, '0');
  const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let viewYear, viewMonth, selected;
  let viewMode = 'month';   // month | week

  /* ---------- 周视图 ---------- */
  function renderWeek() {
    const grid = document.getElementById('schGrid');
    const calTitle = document.getElementById('schCalTitle');
    const monthEl = document.getElementById('schMonth');
    grid.style.gridTemplateRows = '1fr';
    grid.innerHTML = '';
    const base = new Date(selected + 'T00:00');
    const dow = (base.getDay() + 6) % 7;
    const monday = new Date(base);
    monday.setDate(base.getDate() - dow);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const title = `${monday.getMonth() + 1}月${monday.getDate()}日 - ${sunday.getMonth() + 1}月${sunday.getDate()}日`;
    calTitle.textContent = title;
    monthEl.textContent = title;
    const week = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = fmtDate(d);
      const cell = document.createElement('div');
      cell.className = 'sch-cell sch-week-day' + (ds === selected ? ' selected' : '') + (ds === Store.todayStr() ? ' today' : '');
      const day = document.createElement('div');
      day.className = 'sch-day';
      day.textContent = `${week[i]} ${d.getMonth() + 1}/${d.getDate()}`;
      cell.appendChild(day);
      const tags = document.createElement('div');
      tags.className = 'sch-tags';
      Store.getEvents(ds).forEach(e => {
        const t = document.createElement('span');
        t.className = 'sch-tag ' + classify(e.type);
        t.textContent = e.time + ' ' + e.title.slice(0, 14);
        tags.appendChild(t);
      });
      Store.getTodos(ds).forEach(t => {
        const x = document.createElement('span');
        x.className = 'sch-tag k-default';
        x.textContent = (t.done ? '✓ ' : '☐ ') + t.title.slice(0, 14);
        tags.appendChild(x);
      });
      if (!tags.childNodes.length) {
        tags.innerHTML = '<span class="sch-tag k-default">无安排</span>';
      }
      cell.appendChild(tags);
      cell.addEventListener('click', () => { selected = ds; renderGrid(); renderDayPanel(); });
      grid.appendChild(cell);
    }
  }

  /* ---------- 月历渲染(带状态标签) ---------- */
  function renderGrid() {
    const grid = document.getElementById('schGrid');
    const calTitle = document.getElementById('schCalTitle');
    const monthEl = document.getElementById('schMonth');
    if (viewMode === 'week') { renderWeek(); return; }
    grid.style.gridTemplateRows = 'auto repeat(6, 1fr)';
    calTitle.textContent = `${viewYear}年${viewMonth + 1}月`;
    monthEl.textContent = `${viewYear}年${viewMonth + 1}月`;
    grid.innerHTML = '';

    ['一', '二', '三', '四', '五', '六', '日'].forEach(w => {
      const dow = document.createElement('div');
      dow.className = 'sch-dow';
      dow.textContent = w;
      grid.appendChild(dow);
    });

    const first = new Date(viewYear, viewMonth, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = Store.todayStr();

    for (let i = 0; i < 42; i++) {
      const dayNum = i - startOffset + 1;
      const dt = new Date(viewYear, viewMonth, dayNum);
      const dateStr = fmtDate(dt);
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;

      const cell = document.createElement('div');
      cell.className = 'sch-cell' + (inMonth ? '' : ' other');
      if (dateStr === today) cell.classList.add('today');
      if (selected === dateStr) cell.classList.add('selected');

      const day = document.createElement('span');
      day.className = 'sch-day';
      day.textContent = String(dt.getDate());
      cell.appendChild(day);

      // 事件标签(最多 2 条)
      const evs = Store.getEvents(dateStr);
      const tags = document.createElement('div');
      tags.className = 'sch-tags';
      evs.slice(0, 2).forEach(ev => {
        const tag = document.createElement('span');
        tag.className = 'sch-tag ' + classify(ev.type);
        tag.textContent = ev.title.replace(/[:：]/g, '').slice(0, 7);
        tag.title = `${ev.time} ${ev.title}`;
        tags.appendChild(tag);
      });
      if (evs.length > 2) {
        const more = document.createElement('span');
        more.className = 'sch-tag k-default';
        more.textContent = `+${evs.length - 2}`;
        tags.appendChild(more);
      }
      cell.appendChild(tags);

      // 任务完成状态
      const todos = Store.getTodos(dateStr);
      if (todos.length) {
        const done = todos.filter(t => t.done).length;
        const status = document.createElement('span');
        status.className = 'sch-status' + (done === todos.length ? ' done' : ' working');
        status.textContent = done === todos.length
          ? `✓ ${done}项完成`
          : (done ? `进行中 ${todos.length - done}项` : `未完成 ${todos.length}项`);
        cell.appendChild(status);
      }

      cell.addEventListener('click', () => pick(dateStr, inMonth));
      grid.appendChild(cell);
    }
  }

  /* ---------- 点击日期:选中 + 展示当日安排 ---------- */
  function pick(dateStr, inMonth) {
    if (!inMonth) {
      const [y, m] = dateStr.split('-').map(Number);
      viewYear = y;
      viewMonth = m - 1;
    }
    selected = dateStr;
    renderGrid();
    renderDayPanel();
  }

  function renderDayPanel() {
    const title = document.getElementById('schDayTitle');
    const sub = document.getElementById('schDaySub');
    const list = document.getElementById('schDayList');

    const [y, m, d] = selected.split('-').map(Number);
    const week = ['日', '一', '二', '三', '四', '五', '六'][new Date(y, m - 1, d).getDay()];
    title.textContent = `${m}月${d}日 当日安排`;
    sub.textContent = `周${week}${selected === Store.todayStr() ? ' · 今天' : ''}`;
    list.innerHTML = '';

    const evs = Store.getEvents(selected);
    const todos = Store.getTodos(selected);
    if (!evs.length && !todos.length) {
      list.innerHTML = '<div class="sch-day-empty">当天暂无安排,可点击右上角添加</div>';
      return;
    }
    evs.forEach(ev => {
      const details = ev.details || {};
      const item = document.createElement('div');
      item.className = 'sch-day-item' + (details.method || details.result ? ' has-detail' : '');
      item.innerHTML =
        `<span class="tt">${escapeHtml(ev.time)}</span>` +
        `<span class="t">${escapeHtml(ev.title)}</span>` +
        `<span class="tag ${classify(ev.type)}">${escapeHtml(ev.type)}</span>` +
        `<button class="icon-btn day-detail" title="编辑方法/结果" data-id="${ev.id}">✎</button>` +
        `<button class="icon-btn danger day-del" title="删除" data-id="${ev.id}">×</button>`;
      const body = document.createElement('div');
      body.className = 'sch-day-body';
      if (details.method) body.innerHTML += `<div class="d-method"><b>方法：</b>${escapeHtml(details.method)}</div>`;
      if (details.result) body.innerHTML += `<div class="d-result"><b>结果：</b>${escapeHtml(details.result)}</div>`;
      if (body.childNodes.length) item.appendChild(body);
      list.appendChild(item);
    });
    todos.forEach(td => {
      const item = document.createElement('div');
      item.className = 'sch-day-item';
      item.innerHTML =
        `<span class="tt">任务</span>` +
        `<span class="t">${td.done ? '☑ ' : '☐ '}${escapeHtml(td.title)}</span>` +
        `<span class="tag ${td.done ? 'k-science' : 'k-default'}">${td.done ? '已完成' : '未完成'}</span>`;
      list.appendChild(item);
    });
  }

  /* ---------- 添加安排 / 编辑详情 ---------- */
  function openAddSchedule() {
    window.EditModalOpen(`添加安排（${selected.replace(/-/g, '.')}）`, `
      <form class="edit-form">
        <div class="edit-field"><label>时间</label><input type="time" name="time" value="${Store.nowTime()}" required></div>
        <div class="edit-field"><label>标题</label><input name="title" maxlength="60" placeholder="如：提取家蝇环境DNA（样本编号）" required></div>
        <div class="edit-field"><label>类型</label>
          <select name="type">
            <option>实验</option><option>采样</option><option>测试</option><option>数据处理</option><option>仪器预约</option>
            <option>组会</option><option>导师讨论</option><option>学术会议</option><option>答辩</option>
            <option>开题答辩</option><option>中期考核</option><option>课程</option><option>其他</option>
          </select>
        </div>
        <div class="edit-field"><label>实验方法（可选）</label><textarea name="method" rows="4" placeholder="试剂盒、步骤、条件…"></textarea></div>
        <div class="edit-field"><label>实验结果（可选）</label><textarea name="result" rows="3" placeholder="结果如何…"></textarea></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, values => {
      if (!values.title) return;
      Store.addEvent(selected, {
        id: Store.uid(),
        time: values.time || '00:00',
        title: values.title,
        type: values.type || '其他',
        details: { method: values.method || '', result: values.result || '' }
      });
      renderDayPanel();
      renderGrid();
    });
  }

  function openEventDetails(ev) {
    const d = ev.details || {};
    window.EditModalOpen(`编辑安排（${ev.title}）`, `
      <form class="edit-form">
        <div class="edit-field"><label>标题</label><input name="title" value="${escapeHtml(ev.title)}" maxlength="60" required></div>
        <div class="edit-field"><label>时间</label><input type="time" name="time" value="${escapeHtml(ev.time || '')}"></div>
        <div class="edit-field"><label>类型</label>
          <select name="type">
            ${['实验', '采样', '测试', '数据处理', '仪器预约', '组会', '导师讨论', '学术会议', '答辩', '开题答辩', '中期考核', '课程', '其他']
              .map(t => `<option ${ev.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="edit-field"><label>实验方法</label><textarea name="method" rows="4" placeholder="试剂盒、实验前准备、操作流程…">${escapeHtml(d.method || '')}</textarea></div>
        <div class="edit-field"><label>实验结果</label><textarea name="result" rows="3" placeholder="结果如何…">${escapeHtml(d.result || '')}</textarea></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, values => {
      Store.updateEvent(selected, ev.id, { title: values.title, time: values.time, type: values.type });
      Store.updateEventDetails(selected, ev.id, { method: values.method, result: values.result });
      renderDayPanel();
      renderGrid();
    });
  }

  /* ---------- 重要节点倒计时 ---------- */
  function renderCountdown() {
    const list = document.getElementById('schCountdown');
    list.innerHTML = '';
    const today = new Date(Store.todayStr() + 'T00:00');
    Store.milestones().forEach(m => {
      const diff = Math.round((new Date(m.date + 'T00:00') - today) / 86400000);
      const item = document.createElement('div');
      item.className = 'cd-item' + (diff < 0 ? ' expired' : '');
      const dot = document.createElement('span');
      dot.className = 'cd-dot ' + (diff <= 30 && diff >= 0 ? 'critical' : 'normal');
      const info = document.createElement('div');
      info.className = 'cd-info';
      const name = document.createElement('div');
      name.className = 'cd-name';
      name.textContent = m.name;
      const date = document.createElement('div');
      date.className = 'cd-date';
      date.textContent = m.date.replace(/-/g, '.');
      info.appendChild(name);
      info.appendChild(date);
      const left = document.createElement('span');
      left.className = 'cd-left';
      left.textContent = diff > 0 ? `剩余${diff}天` : (diff === 0 ? '今天' : '已过');
      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn cd-edit';
      editBtn.title = '编辑节点';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', () => editCountdown(m));
      const del = document.createElement('button');
      del.className = 'icon-btn danger cd-del';
      del.title = '删除节点';
      del.textContent = '×';
      del.addEventListener('click', () => {
        Store.removeCountdown(m.id);
        renderCountdown();
      });
      item.appendChild(dot);
      item.appendChild(info);
      item.appendChild(left);
      item.appendChild(editBtn);
      item.appendChild(del);
      list.appendChild(item);
    });
  }

  function editCountdown(m) {
    window.EditModalOpen('编辑倒计时节点', `
      <form class="edit-form">
        <div class="edit-field"><label>节点名称</label><input name="name" value="${escapeHtml(m.name)}" maxlength="20" required></div>
        <div class="edit-field"><label>日期</label><input type="date" name="date" value="${escapeHtml(m.date || '')}" required></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, v => {
      if (v.name && v.date) {
        Store.updateCountdown(m.id, { name: v.name, date: v.date });
        renderCountdown();
      }
    });
  }

  /* ---------- 本周科研状态(按真实数据动态计算) ---------- */
  function renderWeekStats() {
    const el = document.getElementById('schWeekStats');
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(fmtDate(d));
    }
    let evCount = 0, expCount = 0, todoDone = 0, todoTotal = 0;
    days.forEach(ds => {
      Store.getEvents(ds).forEach(e => {
        evCount++;
        if (['实验', '采样', '测试', '数据处理', '仪器预约'].includes(e.type)) expCount++;
      });
      const ts = Store.getTodos(ds);
      todoTotal += ts.length;
      todoDone += ts.filter(t => t.done).length;
    });
    const refs = Store.literature().papers.length;
    const figsDone = Store.papers().reduce((a, p) => a + (p.figures || []).filter(f => f.status === 'done').length, 0);
    const stats = [
      { num: `${todoDone}/${todoTotal}`, label: '本周任务完成' },
      { num: `${evCount}项`, label: '本周安排' },
      { num: `${expCount}次`, label: '实验记录' },
      { num: `${refs}篇`, label: '文献阅读' },
      { num: `${figsDone}项`, label: 'Figure 完成' }
    ];
    el.innerHTML = stats.map(s =>
      `<div class="ws-item"><div class="ws-num">${s.num}</div><div class="ws-label">${s.label}</div></div>`
    ).join('');
  }

  /* ---------- 当日安排面板(点击日历显示对应日期) ---------- */
  /* ---------- 科研周报 ---------- */
  const cn = d => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  function weekRange(offset) {
    // offset=0 本周, -1 上周, -2 上上周
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow + offset * 7);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }

  function buildReport(days) {
    const now = new Date();
    const evs = [];
    const todos = [];
    days.forEach((d, i) => {
      const ds = fmtDate(d);
      Store.getEvents(ds).forEach(e => evs.push({ d, w: i, time: e.time, title: e.title, type: e.type, details: e.details || {} }));
      Store.getTodos(ds).forEach(t => todos.push({ d, w: i, title: t.title, done: t.done }));
    });

    let md = `# 工作计划与实验记录（${cn(days[0])} - ${cn(days[6])}）\n\n`;
    md += `> 生成时间：${now.toLocaleString('zh-CN')}\n\n`;

    days.forEach((d, i) => {
      const dayEvs = evs.filter(e => e.w === i);
      const dayTodos = todos.filter(t => t.w === i);
      if (!dayEvs.length && !dayTodos.length) return;   // 无安排的日期不显示
      md += `\n## ${cn(d)}（${weekNames[i]}）\n`;
      dayEvs.forEach(e => {
        md += `\n**${e.time} ${e.title}**\n`;
        if (e.details.method) md += `方法：${e.details.method}\n`;
        if (e.details.result) md += `结果：${e.details.result}\n`;
      });
      dayTodos.forEach(t => {
        md += `\n- 任务：${t.done ? '[已完成] ' : ''}${t.title}\n`;
      });
    });

    md += `\n\n---\n\n完成人签字：______________________    日期：____________\n`;
    return md;
  }

  /* 美化 HTML 排版(Word / PDF 导出用,宋体五号) */
  function buildReportHTML(days) {
    const now = new Date();
    const esc = escapeHtml;
    const evs = [];
    const todos = [];
    days.forEach((d, i) => {
      const ds = fmtDate(d);
      Store.getEvents(ds).forEach(e => evs.push({ d, w: i, time: e.time, title: e.title, details: e.details || {} }));
      Store.getTodos(ds).forEach(t => todos.push({ d, w: i, title: t.title, done: t.done }));
    });

    let body = '';
    days.forEach((d, i) => {
      const dayEvs = evs.filter(e => e.w === i);
      const dayTodos = todos.filter(t => t.w === i);
      if (!dayEvs.length && !dayTodos.length) return;   // 无安排的日期不显示
      body += `<h2>${cn(d)}（${weekNames[i]}）</h2>`;
      dayEvs.forEach(e => {
        body += `<div class="item"><span class="title">${e.time} ${esc(e.title)}</span></div>`;
        if (e.details.method) body += `<div class="sub">方法：${esc(e.details.method).replace(/\n/g, '<br>')}</div>`;
        if (e.details.result) body += `<div class="sub result">结果：${esc(e.details.result).replace(/\n/g, '<br>')}</div>`;
      });
      dayTodos.forEach(t => {
        body += `<div class="item"><span class="title">${t.done ? '☑' : '☐'} ${esc(t.title)}</span></div>`;
      });
    });

    return `<html><head><meta charset="utf-8"><title>工作计划与实验记录</title>
<style>
  body { font-family: SimSun, "宋体", serif; font-size: 10.5pt; color: #333; margin: 36px; line-height: 1.8; }
  h1 { font-size: 15pt; text-align: center; letter-spacing: 2px; margin: 0 0 4px; }
  .meta { text-align: center; color: #999; font-size: 9pt; margin-bottom: 26px; }
  h2 { font-size: 11.5pt; margin: 16px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  .item { margin: 6px 0; }
  .item .title { font-weight: bold; }
  .sub { margin: 2px 0 2px 1.2em; color: #555; font-size: 10pt; }
  .sub.result { color: #2E7D4F; }
  .sign { margin-top: 44px; font-size: 10.5pt; }
  .sign p { margin: 10px 0; }
  .line { display: inline-block; min-width: 160px; border-bottom: 1px solid #333; }
  .line2 { display: inline-block; min-width: 90px; border-bottom: 1px solid #333; }
</style></head><body>
<h1>工作计划与实验记录</h1>
<div class="meta">${cn(days[0])} - ${cn(days[6])} · 生成时间：${now.toLocaleString('zh-CN')}</div>
${body}
<div class="sign">
  <p>完成人签字：<span class="line"></span>　日期：<span class="line2"></span></p>
</div>
</body></html>`;
  }

  function renderReportPreview() {
    document.getElementById('schReportPreview').textContent = buildReport(weekRange(0));
  }

  function download(name, content, mime) {
    const blob = new Blob(['\uFEFF' + content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- 周选择导出 ---------- */
  function exportWithWeekPicker(kind) {
    const options = [0, -1, -2, -3].map(off => {
      const days = weekRange(off);
      const label = off === 0 ? '本周' : (off === -1 ? '上周' : (off === -2 ? '上上周' : '前三周'));
      return `<option value="${off}">${label}（${cn(days[0])} - ${cn(days[6])}）</option>`;
    }).join('');
    window.EditModalOpen('选择导出周', `
      <form class="edit-form">
        <div class="edit-field"><label>导出范围</label>
          <select name="week">${options}</select>
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">导出</button>
        </div>
      </form>`, values => {
      const days = weekRange(parseInt(values.week, 10) || 0);
      const fname = `工作计划-${cn(days[0])}-${cn(days[6])}`;
      if (kind === 'md') download(`${fname}.md`, buildReport(days), 'text/markdown;charset=utf-8');
      else if (kind === 'word') {
        // Word 导出:结构化 HTML(.doc,Word/WPS 可直接打开)
        download(`${fname}.doc`, buildReportHTML(days), 'application/msword');
      } else if (kind === 'pdf') {
        // PDF 导出:打开排版好的新窗口,打印对话框选择"另存为 PDF"
        const w = window.open('', '_blank');
        const hint = '<div style="position:fixed;top:12px;right:16px;font-size:11px;color:#999;background:#fff;padding:6px 10px;border:1px solid #eee;border-radius:8px">提示:在打印对话框中选择「另存为 PDF」</div>';
        w.document.write(buildReportHTML(days).replace('<body>', '<body>' + hint).replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script></body>'));
        w.document.close();
      }
    });
  }

  /* ---------- 添加节点 ---------- */
  function openAddMilestone() {
    const bodyHTML = `
      <form class="edit-form">
        <div class="edit-field"><label>节点名称</label><input name="name" maxlength="20" placeholder="如：中期考核" required></div>
        <div class="edit-field"><label>日期</label><input type="date" name="date" required></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">添加</button>
        </div>
      </form>`;
    window.EditModalOpen('添加倒计时节点', bodyHTML, values => {
      if (!values.date) return;
      Store.addCountdown({ name: values.name || '新节点', date: values.date });
      renderCountdown();
    });
  }

  /* ---------- 视图切换(周/月) ---------- */
  function init() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selected = Store.todayStr();

    document.getElementById('schPrev').addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      renderGrid();
    });
    document.getElementById('schNext').addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderGrid();
    });
    document.getElementById('schWeekView').addEventListener('click', () => {
      document.getElementById('schWeekView').classList.add('active');
      document.getElementById('schMonthView').classList.remove('active');
      viewMode = 'week';
      renderGrid();
    });
    document.getElementById('schMonthView').addEventListener('click', () => {
      document.getElementById('schMonthView').classList.add('active');
      document.getElementById('schWeekView').classList.remove('active');
      viewMode = 'month';
      renderGrid();
    });
    document.getElementById('schMilestoneAdd').addEventListener('click', openAddMilestone);
    document.getElementById('schDayAdd').addEventListener('click', openAddSchedule);

    // 当日安排:详情编辑 / 删除
    document.getElementById('schDayList').addEventListener('click', e => {
      const btn = e.target.closest('.icon-btn');
      if (!btn) return;
      const id = btn.dataset.id;
      const ev = Store.getEvents(selected).find(x => x.id === id);
      if (!ev) return;
      if (btn.classList.contains('day-detail')) {
        openEventDetails(ev);
      } else if (btn.classList.contains('day-del')) {
        Store.removeEvent(selected, id);
        renderDayPanel();
        renderGrid();
      }
    });

    document.getElementById('schExport').addEventListener('click', () => exportWithWeekPicker('md'));
    document.getElementById('schReportRefresh').addEventListener('click', renderReportPreview);
    document.getElementById('schReportMd').addEventListener('click', () => exportWithWeekPicker('md'));
    document.getElementById('schReportWord').addEventListener('click', () => exportWithWeekPicker('word'));
    document.getElementById('schReportPdf').addEventListener('click', () => exportWithWeekPicker('pdf'));
  }

  function renderAll() {
    // 每次进入默认显示当天
    selected = Store.todayStr();
    viewMode = 'month';
    renderGrid();
    renderDayPanel();
    renderCountdown();
    if (window.WeekPlan) WeekPlan.render('schWeekPlan');
    renderWeekStats();
    renderReportPreview();
    // 科研偏好:计划周期
    const pc = document.getElementById('schPlanCycle');
    if (pc) pc.textContent = '计划周期：' + (Store.settings().preferences.planCycle === 'daily' ? '每日计划' : '每周计划');
  }

  return { init, renderAll };
})();
