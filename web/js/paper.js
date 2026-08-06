'use strict';

/**
 * paper.js — 论文工作台(以 Figure 为核心的科研记录系统)
 * 左:论文与 Figure 导航(状态圆点);中:Figure Markdown 工作区 + 自动目录
 */
const PaperWorkspace = (() => {
  let currentPaperId = null;
  let currentFigId = null;
  let noteMode = 'preview';   // preview | edit

  const FIG_TEMPLATE = (title) => `# ${title}\n\n## 1. Figure目的\n\n说明该图解决什么科学问题，为什么需要制作该Figure。\n\n## 2. 数据来源\n\n项目：\n\n实验：\n\n样品：\n\n数据文件：\n\n## 3. 实验方法\n\n实验流程：\n\n关键参数：\n\n实验条件：\n\n## 4. 数据分析方法\n\n分析软件：\n\n分析代码：\n\n统计方法：\n\n参数设置：\n\n## 5. 图形制作\n\n绘图软件：\n\n制作流程：\n\n输出格式：\n\n## 6. 结果描述\n\n该Figure主要说明：\n\n主要发现：\n\n## 7. 论文对应位置\n\n对应章节：\n\nFigure legend：\n\n## 8. 修改记录\n\n日期：\n\n版本：\n\n修改内容：`;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* 增强版 Markdown 渲染(标题/列表/表格/代码/引用/图片/粗斜体) */
  function mdToHtml(src) {
    if (!src) return '<p style="color:var(--text-3)">（暂无内容）</p>';
    let s = escapeHtml(src);
    s = s.replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${code.trim()}</code></pre>`);
    const lines = s.split('\n');
    let html = '';
    let inList = false;
    let inTable = false;
    lines.forEach(line => {
      const h = line.match(/^(#{1,4})\s+(.*)/);
      const li = line.match(/^\s*[-*]\s+(.*)/);
      const q = line.match(/^\s*>\s?(.*)/);
      const tableSep = /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('|') && line.includes('-');
      const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (h) {
        if (inList) { html += '</ul>'; inList = false; }
        const lv = h[1].length;
        const id = 'h-' + h[2].replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '');
        html += `<h${lv} id="${id}">${h[2]}</h${lv}>`;
      } else if (img) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p><img src="${img[2]}" alt="${img[1]}"></p>`;
      } else if (tableSep) {
        inList = false;
      } else if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inList = false;
        const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const tag = inTable ? 'td' : 'th';
        if (!inTable) { html += '<table><tr>'; inTable = true; }
        else html += '<tr>';
        cells.forEach(c => { html += `<${tag}>${c}</${tag}>`; });
        html += '</tr>';
      } else if (/^\s*$/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        if (inTable) { html += '</table>'; inTable = false; }
      } else if (li) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${li[1]}</li>`;
      } else if (q) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<blockquote>${q[1]}</blockquote>`;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p>${line}</p>`;
      }
    });
    if (inList) html += '</ul>';
    if (inTable) html += '</table>';
    html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
    return html;
  }

  /* 自动目录:解析 md 标题 */
  function tocOf(md) {
    const toc = [];
    (md || '').split('\n').forEach(line => {
      const m = line.match(/^(#{2,4})\s+(.*)/);
      if (m) {
        toc.push({ lv: m[1].length, text: m[2], id: 'h-' + m[2].replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '') });
      }
    });
    return toc;
  }

  /* ---------- 左:论文与 Figure 导航 ---------- */
  function renderList(kw) {
    const box = document.getElementById('paperList');
    box.innerHTML = '';
    const papers = Store.papers();
    if (!papers.length) {
      box.innerHTML = '<div class="ai-chat-empty">暂无论文,点击“新建论文”</div>';
      return;
    }
    const k = (kw || '').toLowerCase();
    papers.forEach(p => {
      const flist = p.figures || [];
      const figs = k ? flist.filter(f => f.title.toLowerCase().includes(k)) : flist;
      if (k && figs.length === 0 && !(p.name || '').toLowerCase().includes(k)) return;
      const group = document.createElement('div');
      group.className = 'paper-group';
      const name = document.createElement('div');
      name.className = 'paper-name' + (p.id === currentPaperId ? ' active' : '');
      name.innerHTML = `<span class="caret">${p.id === currentPaperId ? '▾' : '▸'}</span><span class="paper-name-t">${escapeHtml(p.name)}</span><span class="paper-name-ops"><i class="paper-op" data-op="edit" title="重命名">✎</i><i class="paper-op danger" data-op="del" title="删除论文">×</i></span>`;
      name.addEventListener('click', e => {
        if (e.target.closest('[data-op="edit"]')) { renamePaper(p); return; }
        if (e.target.closest('[data-op="del"]')) { deletePaper(p); return; }
        currentPaperId = p.id;
        currentFigId = p.figures[0]?.id || null;
        renderList(document.getElementById('paperSearch').value);
        renderHead();
        renderWorkspace();
      });
      group.appendChild(name);
      if (p.id === currentPaperId) {
        const figsBox = document.createElement('div');
        figsBox.className = 'paper-figs';
        figs.forEach(f => {
          const item = document.createElement('div');
          item.className = 'paper-fig' + (f.id === currentFigId ? ' active' : '');
          const stTxt = { done: '已完成', ongoing: '进行中', todo: '未开始' }[f.status] || '未开始';
          item.innerHTML = `<span class="paper-fig-t">${escapeHtml(f.title)}</span><span class="paper-fig-ops"><i class="paper-op" data-op="edit" title="编辑 Figure">✎</i><i class="paper-op danger" data-op="del" title="删除 Figure">×</i></span><span class="paper-fig-badge ${f.status || 'todo'}">${stTxt}</span>`;
          item.addEventListener('click', e => {
            if (e.target.closest('[data-op="edit"]')) { editFig(p, f); return; }
            if (e.target.closest('[data-op="del"]')) { deleteFig(p, f); return; }
            currentFigId = f.id;
            noteMode = 'preview';
            renderList(document.getElementById('paperSearch').value);
            renderHead();
            renderWorkspace();
          });
          figsBox.appendChild(item);
        });
        const add = document.createElement('div');
        add.className = 'paper-fig-add';
        add.textContent = '+ 添加 Figure';
        add.addEventListener('click', () => addFigure(p));
        figsBox.appendChild(add);
        group.appendChild(figsBox);
      }
      box.appendChild(group);
    });
  }

  /* ---------- 中:头部 ---------- */
  function renderHead() {
    const box = document.getElementById('paperHead');
    const fig = currentFig();
    if (!fig) { box.innerHTML = ''; return; }
    const st = fig.status || 'todo';
    const stTxt = { done: '已完成', ongoing: '进行中', todo: '未开始' }[st];
    box.innerHTML = `
      <span class="paper-fig-title">${escapeHtml(fig.title)}</span>
      <span class="paper-fig-status ${st}">${stTxt}</span>
      <span class="paper-fig-meta">创建：${escapeHtml(fig.created || '—')} · 更新：${escapeHtml(fig.updated || '—')}</span>`;
  }

  /* ---------- 中:Markdown 工作区(目录融入正文) ---------- */
  function renderWorkspace() {
    const box = document.getElementById('paperWorkspace');
    const fig = currentFig();
    const p = currentPaper();
    if (!p) { box.innerHTML = '<div class="paper-empty">选择或新建一篇论文</div>'; return; }
    if (!fig) { box.innerHTML = '<div class="paper-empty">选择或新建一个 Figure</div>'; return; }
    box.innerHTML = `
      <div class="paper-editor">
        <div class="paper-editor-bar">
          <button class="lab-action-btn ${noteMode === 'edit' ? 'primary' : ''}" id="paperEdit">编辑</button>
          <button class="lab-action-btn ${noteMode === 'preview' ? 'primary' : ''}" id="paperPrev">预览</button>
          <button class="lab-action-btn" id="paperStatus">状态：${({ done: '已完成', ongoing: '进行中', todo: '未开始' })[fig.status] || '未开始'}</button>
          <button class="paper-eye-btn" id="paperTocEye" title="隐藏/显示目录 (Alt+D)">👁</button>
          <button class="lab-action-btn danger" id="paperFigDel" style="margin-left:auto">删除 Figure</button>
        </div>
        ${noteMode === 'edit'
          ? `<textarea class="paper-md-edit" id="paperMd">${escapeHtml(fig.md || '')}</textarea>`
          : `<div class="paper-md-preview" id="paperMdPrev">${mdToHtml(fig.md || '')}</div>`}
      </div>
      <div class="paper-toc-right" id="paperTocRight">
        <div class="paper-toc-title">目录</div>
        <div class="paper-toc-items" id="paperTocItems"></div>
      </div>`;

    // 目录:根据 md 标题生成
    const tocBox = box.querySelector('#paperTocItems');
    const toc = tocOf(fig.md);
    if (!toc.length) tocBox.innerHTML = '<div style="font-size:11px;color:var(--text-3)">无标题,编辑时添加 # 标题</div>';
    toc.forEach(t => {
      const item = document.createElement('div');
      item.className = 'paper-toc-item';
      item.style.paddingLeft = (8 + (t.lv - 2) * 12) + 'px';
      item.textContent = t.text;
      item.addEventListener('click', () => {
        if (noteMode === 'preview') {
          const el = document.getElementById(t.id);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          alert('请切换到“预览”模式使用目录跳转');
        }
      });
      tocBox.appendChild(item);
    });
    // 透明眼睛按钮 + Alt+D 切换目录
    const toggleToc = () => {
      const right = box.querySelector('#paperTocRight');
      right.style.display = right.style.display === 'none' ? 'block' : 'none';
    };
    box.querySelector('#paperTocEye').addEventListener('click', toggleToc);

    if (noteMode === 'edit') {
      const ta = box.querySelector('#paperMd');
      ta.addEventListener('input', () => {
        Store.updateFigure(p.id, fig.id, { md: ta.value });
      });
    }
    box.querySelector('#paperEdit').addEventListener('click', () => { noteMode = 'edit'; renderWorkspace(); });
    box.querySelector('#paperPrev').addEventListener('click', () => { noteMode = 'preview'; renderWorkspace(); });
    box.querySelector('#paperStatus').addEventListener('click', () => {
      const st = fig.status || 'todo';
      const next = st === 'done' ? 'ongoing' : st === 'ongoing' ? 'todo' : 'done';
      Store.updateFigure(p.id, fig.id, { status: next });
      renderList(document.getElementById('paperSearch').value);
      renderHead();
      renderWorkspace();
    });
    box.querySelector('#paperFigDel').addEventListener('click', () => {
      if (confirm(`删除 Figure「${fig.title}」？`)) {
        Store.removeFigure(p.id, fig.id);
        currentFigId = (p.figures.filter(f => f.id !== fig.id))[0]?.id || null;
        renderList(document.getElementById('paperSearch').value);
        renderHead();
        renderWorkspace();
      }
    });
  }

  /* ---------- 新建论文 / Figure ---------- */
  function renamePaper(p) {
    window.EditModalOpen('重命名论文', `
      <form class="edit-form">
        <div class="edit-field"><label>论文名称</label><input name="name" value="${escapeHtml(p.name)}" required></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">保存</button></div>
      </form>`, v => {
      if (v.name) { Store.updatePaperName(p.id, v.name); renderList(document.getElementById('paperSearch').value); }
    });
  }

  function deletePaper(p) {
    window.EditModalOpen('删除论文', `
      <div style="font-size:13px;color:var(--text-2);line-height:1.8;margin-bottom:14px">删除论文「${escapeHtml(p.name)}」及其全部 Figure？</div>
      <div class="edit-actions">
        <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
        <button type="button" class="btn-danger" id="paperDelConfirm">删除</button>
      </div>`, null);
    document.getElementById('paperDelConfirm').onclick = () => {
      Store.removePaper(p.id);
      if (currentPaperId === p.id) {
        const papers = Store.papers();
        currentPaperId = papers[0]?.id || null;
        currentFigId = papers[0]?.figures[0]?.id || null;
      }
      EditModalClose();
      renderList(document.getElementById('paperSearch').value);
      renderHead();
      renderWorkspace();
    };
  }

  function editFig(p, f) {
    window.EditModalOpen('编辑 Figure', `
      <form class="edit-form">
        <div class="edit-field"><label>Figure 标题</label><input name="title" value="${escapeHtml(f.title)}" required></div>
        <div class="edit-field"><label>状态</label>
          <select name="status">
            <option value="done" ${f.status === 'done' ? 'selected' : ''}>已完成</option>
            <option value="ongoing" ${f.status === 'ongoing' ? 'selected' : ''}>进行中</option>
            <option value="todo" ${f.status === 'todo' ? 'selected' : ''}>未开始</option>
          </select>
        </div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">保存</button></div>
      </form>`, v => {
      Store.updateFigure(p.id, f.id, { title: v.title, status: v.status });
      renderList(document.getElementById('paperSearch').value);
      renderHead();
      renderWorkspace();
    });
  }

  function deleteFig(p, f) {
    if (confirm(`删除 Figure「${f.title}」？`)) {
      Store.removeFigure(p.id, f.id);
      if (currentFigId === f.id) currentFigId = p.figures.filter(x => x.id !== f.id)[0]?.id || null;
      renderList(document.getElementById('paperSearch').value);
      renderHead();
      renderWorkspace();
    }
  }

  function newPaper() {
    window.EditModalOpen('新建论文', `
      <form class="edit-form">
        <div class="edit-field"><label>论文名称</label><input name="name" placeholder="如：XXX机制研究" required></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">创建</button></div>
      </form>`, v => {
      if (!v.name) return;
      const id = Store.uid();
      Store.addPaper({ id, name: v.name, figures: [] });
      currentPaperId = id;
      currentFigId = null;
      renderList('');
      renderHead();
      renderWorkspace();
    });
  }

  function addFigure(p) {
    window.EditModalOpen(`添加 Figure（${p.name}）`, `
      <form class="edit-form">
        <div class="edit-field"><label>Figure 标题</label><input name="title" placeholder="如：Figure 6 补充实验" required></div>
        <div class="edit-field"><label>初始状态</label><select name="status"><option>未开始</option><option>进行中</option><option>已完成</option></select></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">创建</button></div>
      </form>`, v => {
      if (!v.title) return;
      const now = `${String(new Date().getMonth() + 1).padStart(2, '0')}.${String(new Date().getDate()).padStart(2, '0')}`;
      const stMap = { '未开始': 'todo', '进行中': 'ongoing', '已完成': 'done' };
      Store.addFigure(p.id, {
        title: v.title, status: stMap[v.status] || 'todo',
        created: now, updated: now, md: FIG_TEMPLATE(v.title)
      });
      const added = Store.papers().find(x => x.id === p.id).figures;
      currentFigId = added[added.length - 1].id;
      noteMode = 'preview';
      renderList(document.getElementById('paperSearch').value);
      renderHead();
      renderWorkspace();
    });
  }

  /* ---------- 辅助 ---------- */
  function currentPaper() { return Store.papers().find(p => p.id === currentPaperId) || null; }
  function currentFig() {
    const p = currentPaper();
    if (!p) return null;
    return p.figures.find(f => f.id === currentFigId) || null;
  }

  function init() {
    document.getElementById('paperNew').addEventListener('click', newPaper);
    document.getElementById('paperSearch').addEventListener('input', e => renderList(e.target.value.trim()));
    // 快捷键:Alt+D 切换目录显隐
    document.addEventListener('keydown', e => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key || '').toLowerCase() === 'd') {
        const right = document.getElementById('paperTocRight');
        if (right) {
          right.style.display = right.style.display === 'none' ? 'block' : 'none';
          e.preventDefault();
        }
      }
    });
  }

  function renderAll() {
    const papers = Store.papers();
    if (!papers.length) { newPaper(); return; }
    if (!currentPaper()) {
      currentPaperId = papers[0].id;
      currentFigId = papers[0].figures[0]?.id || null;
    }
    noteMode = 'preview';
    document.getElementById('paperSearch').value = '';
    renderList('');
    renderHead();
    renderWorkspace();
  }

  /* 供成果/项目等模块跳转:选中指定论文并渲染(支持 id 或标题) */
  window.PaperSelect = (ref) => {
    if (!ref) return;
    const p = Store.papers().find(x => x.id === ref) || Store.papers().find(x => (x.title || '') === ref);
    if (!p) { window.Goto && window.Goto('paper'); return; }
    currentPaperId = p.id;
    currentFigId = (p.figures && p.figures[0]) ? p.figures[0].id : null;
    noteMode = 'preview';
    renderList('');
    renderHead();
    renderWorkspace();
  };

  return { init, renderAll };
})();
