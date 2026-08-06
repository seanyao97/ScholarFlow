'use strict';

/**
 * project.js — 项目管理
 * 博士个人科研项目档案室:项目列表、自定义阶段、Markdown 阶段笔记、右侧精简概览
 */
const Project = (() => {
  let currentId = null;
  let currentStageId = null;
  let noteMode = 'preview';   // preview | edit

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* 简易 Markdown 渲染 */
  function mdToHtml(src) {
    if (!src) return '<div style="color:var(--text-3)">（暂无笔记）</div>';
    let s = escapeHtml(src);
    s = s.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    const lines = s.split('\n');
    let html = '';
    let inList = false;
    lines.forEach(line => {
      const h = line.match(/^(#{1,4})\s+(.*)/);
      const li = line.match(/^\s*[-*]\s+(.*)/);
      const oli = line.match(/^\s*\d+\.\s+(.*)/);
      const q = line.match(/^\s*>\s?(.*)/);
      if (h) {
        if (inList) { html += '</ul>'; inList = false; }
        const lv = h[1].length;
        html += `<h${lv}>${h[2]}</h${lv}>`;
      } else if (li || oli) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${(li ? li[1] : oli[1])}</li>`;
      } else if (q) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<blockquote>${q[1]}</blockquote>`;
      } else if (/^\s*$/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p>${line}</p>`;
      }
    });
    if (inList) html += '</ul>';
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
    return html;
  }

  /* ---------- 左:项目列表 ---------- */
  /* 项目进展百分比:按阶段实时计算(有阶段时),无阶段回退手动值 */
  function calcProjectPercent(p) {
    const stages = (p && p.stages) || [];
    if (!stages.length) return p.percent || 0;
    let weight = 0;
    stages.forEach(st => {
      if (st.status === '已完成') { weight += 1; return; }
      if (st.status === '未开始') return;
      const tasks = normTasks(st);
      if (tasks.length) weight += tasks.filter(t => t.done).length / tasks.length;
      else weight += 0.5;   // 进行中且无任务按半程计
    });
    return Math.round((weight / stages.length) * 100);
  }

  function renderList(kw) {
    const box = document.getElementById('projList');
    box.innerHTML = '';
    let list = Store.projects();
    if (kw) {
      const k = kw.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(k));
    }
    if (!list.length) {
      box.innerHTML = '<div class="ai-chat-empty">暂无项目</div>';
      return;
    }
    list.forEach(p => {
      const card = document.createElement('div');
      card.className = 'proj-card' + (p.id === currentId ? ' active' : '');
      const stCls = p.status === '已完成' ? 'st' : 'st';
      card.innerHTML = `
        <div class="n">${escapeHtml(p.name)}</div>
        <div class="m"><span>${escapeHtml(p.type || '')}</span><span class="${stCls}">${escapeHtml(p.status || '')}</span></div>
        <div class="m"><span>${calcProjectPercent(p)}%</span><span>${escapeHtml(p.updated || '')}</span></div>
        <div class="proj-bar"><div class="f" style="width:${calcProjectPercent(p)}%"></div></div>`;
      card.addEventListener('click', () => {
        currentId = p.id;
        currentStageId = (p.stages || []).find(s => s.status === '进行中')?.id || (p.stages || [])[0]?.id || null;
        noteMode = 'preview';
        renderList(document.getElementById('projSearch').value);
        renderInfo();
        renderStages();
        renderBody();
        renderOverview();
      });
      box.appendChild(card);
    });
  }

  /* ---------- 中:信息 / 阶段 / 正文 ---------- */
  function renderInfo() {
    const p = current();
    const box = document.getElementById('projInfo');
    if (!p) { box.innerHTML = '<div class="ai-chat-empty">选择或新建一个项目</div>'; return; }
    box.innerHTML = `
      <div class="proj-info-title">${escapeHtml(p.name)}</div>
      <div class="proj-info-meta">
        <span><b>类型</b>${escapeHtml(p.type || '')}</span>
        <span><b>开始</b>${escapeHtml(p.start || '')}</span>
        <span><b>预计完成</b>${escapeHtml(p.end || '')}</span>
        <span><b>负责人</b>${escapeHtml(p.members ? p.members[0] : '本人')}</span>
        <span><b>导师</b>${escapeHtml(p.mentor || '')}</span>
      </div>
      <div class="proj-info-actions">
        <button class="lab-action-btn" id="projEdit">编辑项目</button>
        <button class="lab-action-btn" id="projMore">更多设置</button>
        <button class="lab-action-btn danger" id="projDel">删除项目</button>
      </div>`;
    box.querySelector('#projEdit').addEventListener('click', () => editProject(p));
    box.querySelector('#projMore').addEventListener('click', () => {
      window.EditModalOpen('更多设置', `
        <div class="edit-field"><label>进度(%)（有阶段时自动按阶段完成情况计算）</label><input type="number" id="projPercent" min="0" max="100" value="${p.percent || 0}"></div>
        <div class="edit-field"><label>状态</label>
          <select id="projStatus"><option ${p.status === '进行中' ? 'selected' : ''}>进行中</option><option ${p.status === '已完成' ? 'selected' : ''}>已完成</option><option ${p.status === '未开始' ? 'selected' : ''}>未开始</option></select>
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="button" class="btn-primary" id="projPercentSave">保存</button>
        </div>`, null);
      document.getElementById('projPercentSave').onclick = () => {
        Store.updateProject(p.id, {
          percent: Math.min(100, Math.max(0, parseInt(document.getElementById('projPercent').value, 10) || 0)),
          status: document.getElementById('projStatus').value
        });
        EditModalClose();
        renderAllFresh();
      };
    });
    box.querySelector('#projDel').addEventListener('click', () => {
      if (confirm(`删除项目「${p.name}」？`)) {
        Store.removeProject(p.id);
        currentId = null;
        renderAllFresh();
      }
    });
  }

  function renderStages() {
    const p = current();
    const box = document.getElementById('projStages');
    box.innerHTML = '';
    if (!p) return;
    const stCls = s => s === '已完成' ? 'done' : (s === '进行中' ? 'going' : 'wait');

    // 标题行
    const head = document.createElement('div');
    head.className = 'proj-stages-head';
    head.innerHTML = `
      <span class="proj-stage-title">项目阶段</span>
      <span class="proj-stage-hint">点击节点查看该阶段概览，✎ 编辑阶段</span>
      <button class="lab-action-btn" id="projAddStage">+ 添加阶段</button>`;
    box.appendChild(head);
    head.querySelector('#projAddStage').addEventListener('click', () => addStage(p));

    // 阶段节点行
    const row = document.createElement('div');
    row.className = 'proj-stages-row';
    const stages = p.stages || [];
    if (!stages.length) {
      row.innerHTML = '<div class="ai-chat-empty">暂无阶段,点击“+ 添加阶段”</div>';
    }
    stages.forEach((st, i) => {
      const item = document.createElement('div');
      item.className = 'proj-stage' + (st.id === currentStageId ? ' active' : '');
      item.dataset.id = st.id;
      const stTasks = normTasks(st);
      const stDone = stTasks.filter(t => t.done).length;
      item.innerHTML = `
        <span class="proj-stage-edit" title="编辑阶段">✎</span>
        <div class="n">${escapeHtml(st.name)}</div>
        <div class="t">${escapeHtml(st.start || '')} - ${escapeHtml(st.end || '')}</div>
        <span class="s ${stCls(st.status)}">${escapeHtml(st.status)}</span>
        ${stTasks.length ? `<span class="proj-stage-prog ${stDone === stTasks.length ? 'all' : ''}" title="任务完成度">${stDone}/${stTasks.length}</span>` : ''}`;
      item.addEventListener('click', e => {
        if (e.target.closest('.proj-stage-edit')) { editStage(p, st); return; }
        if (currentStageId !== st.id) {
          currentStageId = st.id;
          noteMode = 'preview';
          renderStages();
          renderBody();
        }
      });
      row.appendChild(item);
      if (i < stages.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'proj-stage-arrow';
        arrow.textContent = '→';
        row.appendChild(arrow);
      }
    });
    box.appendChild(row);
  }

  function renderBody() {
    const p = current();
    const box = document.getElementById('projBody');
    if (!p) return;
    const linked = projectLinked();
    const st = (p.stages || []).find(s => s.id === currentStageId) || (p.stages || [])[0];
    const stTasks = normTasks(st);
    const stDone = stTasks.filter(t => t.done).length;
    box.innerHTML = `
      <div class="proj-note-card">
        <div class="proj-note-head"><span class="proj-note-title">当前阶段概览（${escapeHtml(st ? st.name : '')}）</span></div>
        <div class="proj-stage-overview">
          <div class="proj-ov-col">
            <div class="proj-ov-col-title">阶段目标</div>
            <div class="proj-ov-col-text">${escapeHtml(st && st.goal ? st.goal : '（暂无目标）')}</div>
          </div>
          <div class="proj-ov-col">
            <div class="proj-ov-col-title">阶段任务 <span class="proj-st-prog">${stDone}/${stTasks.length}</span></div>
            <div class="proj-st-task-list">
              ${stTasks.length ? stTasks.map(t => `
                <div class="proj-st-task ${t.done ? 'done' : ''}">
                  <label class="proj-st-task-row">
                    <input type="checkbox" ${t.done ? 'checked' : ''} data-tid="${t.id}">
                    <span>${escapeHtml(t.title)}</span>
                  </label>
                  <button class="icon-btn danger proj-st-del" data-tid="${t.id}" title="删除任务">×</button>
                </div>`).join('') : '<div class="proj-st-task-empty">暂无任务,在下方添加</div>'}
            </div>
            <div class="proj-st-task-add">
              <input id="stTaskInput" placeholder="添加任务,回车确认" maxlength="40">
              <button class="lab-action-btn" id="stTaskAdd">+ 添加</button>
            </div>
          </div>
          <div class="proj-ov-col">
            <div class="proj-ov-col-title">关联资源</div>
            <div class="proj-ov-res">
              <span>实验记录 <b>${linked.experiments || 0}个</b></span>
              <span>文献证据 <b>${linked.refs || 0}条</b></span>
              <span>相关任务 <b>${linked.tasks || 0}个</b></span>
              <span>论文章节 <b>${linked.papers || 0}篇</b></span>
            </div>
          </div>
        </div>
      </div>
      <div class="proj-note-card">
        <div class="proj-note-head">
          <span class="proj-note-title">${escapeHtml(st ? st.name : '')} · 阶段笔记</span>
          <span class="proj-note-actions">
            <button class="lab-action-btn ${noteMode === 'edit' ? 'primary' : ''}" id="noteEdit">编辑</button>
            <button class="lab-action-btn ${noteMode === 'preview' ? 'primary' : ''}" id="notePrev">预览</button>
          </span>
        </div>
        ${noteMode === 'edit'
          ? `<textarea class="proj-note-edit" id="noteText" placeholder="用 Markdown 记录本阶段…(支持 # 标题、- 列表、**粗体**、\`\`\` 代码块)">${escapeHtml(st ? st.note || '' : '')}</textarea>`
          : `<div class="proj-note-preview">${mdToHtml(st ? st.note || '' : '')}</div>`}
      </div>
      <div class="proj-note-card">
        <div class="proj-note-head">
          <span class="proj-note-title">阶段关联内容</span>
          <span class="proj-note-actions"><button class="lab-action-btn" id="projLinksEdit">编辑关联</button></span>
        </div>
        <div class="proj-links">
          ${linkCard('任务', cntManual('tasks', linked.tasks))}
          ${linkCard('实验', cntManual('exp', linked.experiments))}
          ${linkCard('文献证据', cntManual('lit', linked.refs))}
          ${linkCard('论文', cntManual('paper', linked.papers))}
          ${linkCard('成果', cntManual('ach', linked.outputs))}
        </div>
      </div>`;

    if (noteMode === 'edit') {
      box.querySelector('#noteText').addEventListener('change', e => {
        if (st) Store.updateStage(p.id, st.id, { note: e.target.value });
      });
    }
    box.querySelector('#noteEdit').addEventListener('click', () => { noteMode = 'edit'; renderBody(); });
    box.querySelector('#notePrev').addEventListener('click', () => { noteMode = 'preview'; renderBody(); });
    // 阶段任务交互
    box.querySelectorAll('.proj-st-task input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => toggleStageTask(st, cb.dataset.tid, cb.checked));
    });
    box.querySelectorAll('.proj-st-del').forEach(b => {
      b.addEventListener('click', () => removeStageTask(st, b.dataset.tid));
    });
    const stInp = box.querySelector('#stTaskInput');
    const stAdd = box.querySelector('#stTaskAdd');
    if (stInp && stAdd) {
      const doAdd = () => { const v = stInp.value.trim(); if (v) { addStageTask(st, v); stInp.value = ''; } };
      stAdd.addEventListener('click', doAdd);
      stInp.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
    }
    const linksEdit = box.querySelector('#projLinksEdit');
    if (linksEdit) linksEdit.addEventListener('click', () => editLinks(p));
    box.querySelectorAll('.proj-link').forEach(l => {
      l.addEventListener('click', () => {
        const t = l.dataset.target;
        window.Goto(t === 'tasks' ? 'home' : t === 'experiments' ? 'lab' : t === 'refs' ? 'lit' : 'paper');
      });
    });
  }

  const taskUid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* 手动关联优先计数:项目设置了手动关联则显示手动数,否则回退自动统计 */
  function cntManual(key, auto) {
    const p = current();
    const m = (p && p.links) || {};
    return (Array.isArray(m[key]) && m[key].length > 0) ? m[key].length : auto;
  }

  /* 手动关联编辑弹窗:勾选实验/文献/论文/成果 */
  function editLinks(p) {
    const links = p.links || {};
    const chk = (arr, id) => (arr || []).includes(id) ? 'checked' : '';
    const exps = Store.experiments().skills;
    const lits = Store.literature().papers;
    const papers = Store.papers();
    const achs = Store.achievements();
    const todos = Store.load().todos || {};
    // 最近 14 天任务,按日期分组
    const taskDays = [];
    const now0 = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now0);
      d.setDate(now0.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = todos[ds] || [];
      if (list.length) taskDays.push({ ds, list });
    }
    const taskHTML = taskDays.length ? taskDays.map(day => `
      <div class="proj-pick-day">${day.ds}</div>
      ${day.list.map(t => `<label class="proj-pick-row"><input type="checkbox" name="tasks" value="${day.ds}:${t.id}" ${chk(links.tasks, day.ds + ':' + t.id)}>${escapeHtml(t.title)}${t.done ? ' ✓' : ''}</label>`).join('')}
    `).join('') : '<span class="proj-st-task-empty">近 14 天无任务</span>';
    const row = (name, list, labelFn) => list.length
      ? list.map(s => `<label class="proj-pick-row"><input type="checkbox" name="${name}" value="${s.id}" ${chk(links[name], s.id)}>${escapeHtml(labelFn(s))}</label>`).join('')
      : '<span class="proj-st-task-empty">暂无</span>';
    window.EditModalOpen('编辑关联内容', `
      <form class="edit-form">
        <div class="edit-field"><label>实验(实验中心技能)</label>
          <div class="proj-link-pick">${row('exp', exps, s => s.name)}</div>
        </div>
        <div class="edit-field"><label>文献证据</label>
          <div class="proj-link-pick">${row('lit', lits, s => s.title || s.name || '未命名')}</div>
        </div>
        <div class="edit-field"><label>论文(数据分析)</label>
          <div class="proj-link-pick">${row('paper', papers, s => s.title || s.name || '未命名')}</div>
        </div>
        <div class="edit-field"><label>成果</label>
          <div class="proj-link-pick">${row('ach', achs, s => s.title || '未命名')}</div>
        </div>
        <div class="edit-field"><label>任务(近 14 天,勾选关联)</label>
          <div class="proj-link-pick">${taskHTML}</div>
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, () => {
      const pick = n => [...document.querySelectorAll(`input[name="${n}"]:checked`)].map(i => i.value);
      Store.updateProject(p.id, { links: { exp: pick('exp'), lit: pick('lit'), paper: pick('paper'), ach: pick('ach'), tasks: pick('tasks') } });
      renderBody();
      renderOverview();
    });
  }

  /* 阶段任务:兼容旧版字符串数组,统一为 {id,title,done} */
  function normTasks(st) {
    if (!st || !Array.isArray(st.tasks)) return [];
    return st.tasks.map(t => (typeof t === 'string') ? { id: taskUid(), title: t, done: false } : t);
  }
  function persistTasks(st, tasks) {
    const p = current();
    const s = (p.stages || []).find(x => x.id === st.id);
    if (s) { s.tasks = tasks; Store.updateProject(p.id, { stages: p.stages }); }
  }
  function toggleStageTask(st, id, done) {
    persistTasks(st, normTasks(st).map(t => t.id === id ? Object.assign({}, t, { done }) : t));
    renderBody(); renderStages(); renderOverview();
  }
  function addStageTask(st, title) {
    persistTasks(st, normTasks(st).concat([{ id: taskUid(), title, done: false }]));
    renderBody(); renderStages();
  }
  function removeStageTask(st, id) {
    persistTasks(st, normTasks(st).filter(t => t.id !== id));
    renderBody(); renderStages();
  }

  function linkCard(label, num) {
    const target = label === '任务' ? 'tasks' : label === '实验' ? 'experiments' : label === '文献证据' ? 'refs' : label === '论文' ? 'paper' : 'ach';
    return `<div class="proj-link" data-target="${target}"><div class="n">${num || 0}</div><div class="l">${label}</div></div>`;
  }

  /* ---------- 右:概览 ---------- */
  function renderOverview() {
    const p = current();
    const box = document.getElementById('projOverview');
    box.innerHTML = '';
    if (!p) return;
    const linked = projectLinked();
    const pc = calcProjectPercent(p);
    box.innerHTML = `
      <div class="proj-ov-ring-wrap">
        <div class="ach-ring" style="width:92px;height:92px;background:conic-gradient(var(--blue) ${pc}%, var(--blue-softer) ${pc}%)">
          <div class="ach-ring-center"><b>${pc}%</b></div>
        </div>
      </div>
      <div class="proj-ov-item"><b>状态</b>${escapeHtml(p.status || '')}</div>
      <div class="proj-ov-item"><b>当前阶段</b>${escapeHtml((p.stages || []).find(s => s.status === '进行中')?.name || '—')}</div>
      <div class="proj-ov-item"><b>最近更新</b>${escapeHtml(p.updated || '')}</div>
      <div class="proj-ov-label">项目统计</div>
      <div class="proj-ov-stat">
        <span>任务 <b>${cntManual('tasks', linked.tasks) || 0}</b></span><span>实验 <b>${cntManual('exp', linked.experiments) || 0}</b></span>
        <span>文献 <b>${cntManual('lit', linked.refs) || 0}</b></span><span>论文 <b>${cntManual('paper', linked.papers) || 0}</b></span>
        <span>成果 <b>${cntManual('ach', linked.outputs) || 0}</b></span>
      </div>
      <div class="proj-ov-label">当前问题 <button class="edit-btn" id="projIssuesEdit" style="font-size:10px;padding:1px 7px;margin-left:4px">编辑</button></div>
      ${(p.issues || []).slice(0, 3).map(i => `<div class="proj-issue">${escapeHtml(i.text)}<span class="st">${escapeHtml(i.status || '')}</span></div>`).join('') || '<div class="proj-issue">无</div>'}
      <div class="proj-ov-label">项目时间线 <button class="edit-btn" id="projTimelineEdit" style="font-size:10px;padding:1px 7px;margin-left:4px">编辑</button></div>
      ${(p.timeline || []).slice(-4).map(t => `<div class="proj-tl"><b>${escapeHtml(t.time)}</b>${escapeHtml(t.text)}</div>`).join('') || '<div class="proj-issue">无</div>'}
      <div class="proj-ov-label">关联内容</div>
      <div class="proj-rel">
        <div class="proj-rel-item" data-g="home"><span>任务中心</span><b>${cntManual('tasks', linked.tasks) || 0}个任务</b></div>
        <div class="proj-rel-item" data-g="lab"><span>实验中心</span><b>${cntManual('exp', linked.experiments) || 0}个实验记录</b></div>
        <div class="proj-rel-item" data-g="lit"><span>文献证据</span><b>${cntManual('lit', linked.refs) || 0}条证据</b></div>
        <div class="proj-rel-item" data-g="paper"><span>数据分析</span><b>${cntManual('paper', linked.papers) || 0}篇论文</b></div>
        <div class="proj-rel-item" data-g="ach"><span>成果管理</span><b>${cntManual('ach', linked.outputs) || 0}项成果</b></div>
      </div>`;
    const ie = box.querySelector('#projIssuesEdit');
    if (ie) ie.addEventListener('click', () => editIssues(p));
    const te = box.querySelector('#projTimelineEdit');
    if (te) te.addEventListener('click', () => editTimeline(p));
    box.querySelectorAll('.proj-rel-item').forEach(el => {
      el.addEventListener('click', () => {
        const g = el.dataset.g;
        if (g === 'lab') window.Goto('lab');
        else if (g === 'lit') window.Goto('lit');
        else if (g === 'ach') window.Goto('ach');
        else if (g === 'home') window.Goto('home');
        else if (g === 'paper') window.Goto('paper');
      });
    });
  }

  /* ---------- 阶段/项目编辑与新建 ---------- */
  function editIssues(p) {
    const lines = (p.issues || []).map(i => `${i.text}|${i.status || ''}`).join('\n');
    window.EditModalOpen('编辑当前问题', `
      <form class="edit-form">
        <div class="edit-field"><label>每行一个,格式:问题|状态</label>
          <textarea name="issues" rows="5" placeholder="PCR重复性差|实验验证中">${escapeHtml(lines)}</textarea>
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, v => {
      const issues = v.issues.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
        const [text, status] = line.split('|');
        return { text: (text || '').trim(), status: (status || '').trim() };
      });
      Store.updateProject(p.id, { issues });
      renderAllFresh();
    });
  }

  function editTimeline(p) {
    const lines = (p.timeline || []).map(t => `${t.time}|${t.text}`).join('\n');
    window.EditModalOpen('编辑项目时间线', `
      <form class="edit-form">
        <div class="edit-field"><label>每行一个,格式:时间|事件</label>
          <textarea name="tl" rows="5" placeholder="2026.01|完成采样">${escapeHtml(lines)}</textarea>
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, v => {
      const timeline = v.tl.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
        const [time, text] = line.split('|');
        return { time: (time || '').trim(), text: (text || '').trim() };
      });
      Store.updateProject(p.id, { timeline });
      renderAllFresh();
    });
  }

  function editStage(p, st) {
    window.EditModalOpen(`编辑阶段（${st.name}）`, `
      <form class="edit-form">
        <div class="edit-field"><label>阶段名称</label><input name="name" value="${escapeHtml(st.name)}" required></div>
        <div class="edit-field"><label>状态</label>
          <select name="status"><option ${st.status === '已完成' ? 'selected' : ''}>已完成</option><option ${st.status === '进行中' ? 'selected' : ''}>进行中</option><option ${st.status === '未开始' ? 'selected' : ''}>未开始</option></select>
        </div>
        <div class="edit-field"><label>开始时间</label><input name="start" value="${escapeHtml(st.start || '')}" placeholder="2026.05"></div>
        <div class="edit-field"><label>结束时间</label><input name="end" value="${escapeHtml(st.end || '')}" placeholder="2026.09"></div>
        <div class="edit-field"><label>阶段目标</label><textarea name="goal" rows="2">${escapeHtml(st.goal || '')}</textarea></div>
        <div class="edit-field"><label>关键任务(每行一个)</label><textarea name="tasks" rows="3">${escapeHtml((st.tasks || []).map(t => typeof t === 'string' ? t : t.title).join('\n'))}</textarea></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="button" class="btn-danger" id="stDel">删除阶段</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, v => {
      // 保留已勾选状态:按标题匹配旧任务,新增行 done=false
      const oldTasks = (st.tasks || []).map(t => typeof t === 'string' ? { id: null, title: t, done: false } : t);
      Store.updateStage(p.id, st.id, {
        name: v.name, status: v.status, start: v.start, end: v.end,
        goal: v.goal,
        tasks: v.tasks.split('\n').map(s => s.trim()).filter(Boolean).map(text => {
          const old = oldTasks.find(t => t.title === text);
          return (old && old.id) ? old : { id: taskUid(), title: text, done: false };
        })
      });
      renderAllFresh();
    });
    document.getElementById('stDel').onclick = () => {
      const list = (p.stages || []).filter(s => s.id !== st.id);
      Store.updateProject(p.id, { stages: list });
      if (currentStageId === st.id) currentStageId = list[0]?.id || null;
      EditModalClose();
      renderAllFresh();
    };
  }

  function addStage(p) {
    window.EditModalOpen('添加阶段', `
      <form class="edit-form">
        <div class="edit-field"><label>阶段名称</label><input name="name" placeholder="如：实验阶段" required></div>
        <div class="edit-field"><label>状态</label><select name="status"><option>未开始</option><option>进行中</option><option>已完成</option></select></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">添加</button></div>
      </form>`, v => {
      const stages = (p.stages || []).concat([{ id: Store.uid(), name: v.name, status: v.status, start: '', end: '', note: '', goal: '', tasks: [] }]);
      Store.updateProject(p.id, { stages });
      renderAllFresh();
    });
  }

  function editProject(p) {
    window.EditModalOpen('编辑项目', `
      <form class="edit-form">
        <div class="edit-field"><label>项目名称</label><input name="name" value="${escapeHtml(p.name)}" required></div>
        <div class="edit-field"><label>类型</label>
          <select name="type">${['博士课题', '导师项目', '合作项目', '论文项目'].map(t => `<option ${p.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </div>
        <div class="edit-field"><label>开始时间</label><input name="start" value="${escapeHtml(p.start || '')}" placeholder="2025.09"></div>
        <div class="edit-field"><label>预计完成</label><input name="end" value="${escapeHtml(p.end || '')}" placeholder="2028.06"></div>
        <div class="edit-field"><label>导师</label><input name="mentor" value="${escapeHtml(p.mentor || '')}"></div>
        <div class="edit-field"><label>成员(逗号分隔)</label><input name="members" value="${escapeHtml((p.members || []).join('、'))}"></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">保存</button></div>
      </form>`, v => {
      Store.updateProject(p.id, {
        name: v.name, type: v.type, start: v.start, end: v.end, mentor: v.mentor,
        members: v.members ? v.members.split(/[,，]/).map(s => s.trim()).filter(Boolean) : []
      });
      renderAllFresh();
    });
  }

  function newProject() {
    window.EditModalOpen('新建项目', `
      <form class="edit-form">
        <div class="edit-field"><label>项目名称</label><input name="name" required placeholder="项目名称"></div>
        <div class="edit-field"><label>类型</label>
          <select name="type"><option>博士课题</option><option>导师项目</option><option>合作项目</option><option>论文项目</option></select>
        </div>
        <div class="edit-field"><label>开始时间</label><input name="start" placeholder="2025.09"></div>
        <div class="edit-field"><label>预计完成</label><input name="end" placeholder="2028.06"></div>
        <div class="edit-field"><label>导师</label><input name="mentor"></div>
        <div class="edit-field"><label>创建阶段(每行一个,系统自动生成)</label>
          <textarea name="stages" rows="4" placeholder="开题设计&#10;样品采集&#10;实验阶段&#10;分析阶段&#10;结果阶段"></textarea>
        </div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">创建</button></div>
      </form>`, v => {
      if (!v.name) return;
      const stageNames = v.stages.split('\n').map(s => s.trim()).filter(Boolean);
      const stages = stageNames.map((n, i) => ({
        id: Store.uid(), name: n, status: i === 0 ? '进行中' : '未开始', start: '', end: '', note: ''
      }));
      Store.addProject({
        name: v.name, type: v.type, start: v.start, end: v.end, mentor: v.mentor,
        members: ['本人'], status: '进行中', percent: 0, archived: false,
        stages, issues: [], timeline: [{ time: v.start || new Date().getFullYear() + '', text: '项目创建' }],
        linked: { tasks: 0, experiments: 0, refs: 0, papers: 0, outputs: 0 }
      });
      const created = Store.projects()[Store.projects().length - 1];
      currentId = created.id;
      currentStageId = stages[0]?.id || null;
      renderAllFresh();
    });
  }

  /* ---------- 辅助 ---------- */
  function current() { return Store.projects().find(p => p.id === currentId) || null; }
  /* 关联资源计数:按真实数据动态计算 */
  function projectLinked() {
    const p = current();
    const pname = p ? p.name : '';
    const hit = (arr) => (arr || []).some(x => (x || '').includes(pname));
    const allTodos = Object.values(Store.load().todos || {}).reduce((a, l) => a + l.length, 0);
    const exps = Store.experiments();
    return {
      tasks: allTodos,
      experiments: pname ? exps.skills.filter(s => (s.name || '').includes(pname) || hit(((exps.content[s.id] || {}).projects))) : 0,
      refs: pname ? Store.literature().papers.filter(pp => hit(pp.projects)) : 0,
      papers: Store.papers().reduce((a, pp) => a + (pp.figures || []).length, 0),
      outputs: pname ? Store.achievements().filter(a => hit(a.projects)) : 0
    };
  }
  function renderAllFresh() {
    renderList(document.getElementById('projSearch').value);
    renderInfo();
    renderStages();
    renderBody();
    renderOverview();
  }

  function init() {
    document.getElementById('projNew').addEventListener('click', newProject);
    document.getElementById('projSearch').addEventListener('input', e => renderList(e.target.value.trim()));
  }

  function renderAll() {
    const list = Store.projects();
    if (!list.length) { newProject(); return; }
    if (!current()) {
      currentId = list[0].id;
      currentStageId = (list[0].stages || []).find(s => s.status === '进行中')?.id || (list[0].stages || [])[0]?.id || null;
    }
    noteMode = 'preview';
    document.getElementById('projSearch').value = '';
    renderAllFresh();
  }

  /* 按 id 选中项目(供其他模块跳转) */
  function select(id) {
    const list = Store.projects();
    if (!list.some(x => x.id === id)) return;
    currentId = id;
    const p = current();
    currentStageId = (p.stages || []).find(s => s.status === '进行中')?.id || (p.stages || [])[0]?.id || null;
    renderAllFresh();
  }
  window.ProjectSelect = select;

  return { init, renderAll, select };
})();
