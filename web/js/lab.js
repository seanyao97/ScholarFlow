'use strict';

/**
 * lab.js — 实验中心
 * 三栏布局:实验分类导航 + 实验SOP编辑工作区 + 关联文献/项目
 */
const Lab = (() => {
  let current = 'wet-dna';        // 当前选中技能 id
  let previewMode = true;        // 默认预览模式
  const collapsedCats = new Set(); // 折叠的分类

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ---------- 左栏:分类与技能列表 ---------- */
  function renderCats(filter) {
    const box = document.getElementById('labCats');
    box.innerHTML = '';
    const exp = Store.experiments();
    const kw = (filter || '').trim().toLowerCase();
    Object.keys(exp.categories).forEach(cat => {
      const skills = exp.skills.filter(s => s.category === cat);
      const matched = kw ? skills.filter(s => s.name.toLowerCase().includes(kw)) : skills;
      if (!matched.length && !collapsedCats.has(cat)) return;
      const collapsed = collapsedCats.has(cat);
      // 分类名行(可折叠 + 重命名)
      const name = document.createElement('div');
      name.className = 'lab-cat-name' + (collapsed ? ' collapsed' : '');
      name.innerHTML = `<span class="lab-cat-arrow">${collapsed ? '▸' : '▾'}</span><span class="lab-cat-label">${escapeHtml(exp.categories[cat])}</span><span class="lab-cat-count">${skills.length}</span><i class="paper-op" data-cat-edit="${cat}" title="重命名分类">✎</i>`;
      name.querySelector('[data-cat-edit]').addEventListener('click', e => {
        e.stopPropagation();
        renameCat(cat, exp.categories[cat]);
      });
      name.addEventListener('click', () => {
        if (collapsedCats.has(cat)) collapsedCats.delete(cat); else collapsedCats.add(cat);
        renderCats(document.getElementById('labSearch').value);
      });
      box.appendChild(name);
      // 技能列表(折叠时隐藏)
      const items = document.createElement('div');
      items.className = 'lab-cat-items' + (collapsed ? ' hide' : '');
      matched.forEach(s => {
        const item = document.createElement('div');
        item.className = 'lab-skill' + (s.id === current ? ' active' : '');
        item.innerHTML = `<span class="lab-skill-t">${escapeHtml(s.name)}</span><span class="lab-skill-ops"><i class="paper-op" data-op="edit" title="重命名">✎</i><i class="paper-op danger" data-op="del" title="删除">×</i></span>`;
        item.addEventListener('click', e => {
          if (e.target.closest('[data-op="edit"]')) { renameSkill(s); return; }
          if (e.target.closest('[data-op="del"]')) { deleteSkill(s); return; }
          current = s.id;
          select();
        });
        items.appendChild(item);
      });
      box.appendChild(items);
    });
    if (!box.childNodes.length) {
      box.innerHTML = '<div class="lab-ref-empty">未找到相关实验</div>';
    }
  }

  /* 重命名分类 */
  function renameCat(key, oldLabel) {
    window.EditModalOpen('重命名分类', `
      <form class="edit-form">
        <div class="edit-field"><label>分类名称</label><input name="label" value="${escapeHtml(oldLabel)}" maxlength="20" required></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">保存</button></div>
      </form>`, v => {
      if (v.label.trim()) {
        Store.renameExpCategory(key, v.label.trim());
        renderCats(document.getElementById('labSearch').value);
      }
    });
  }

  /* ---------- 中栏:编辑工作区 ---------- */
  function renderMain() {
    const c = Store.getExperiment(current);
    document.getElementById('labTitle').textContent = c.name;
    document.getElementById('labUpdated').textContent = c.updated ? `最近更新时间：${c.updated}` : '';

    const tags = document.getElementById('labTags');
    tags.innerHTML = (c.tags || []).map(t => `<span class="lab-tag">${escapeHtml(t)}</span>`).join('');

    const cards = document.getElementById('labCards');
    cards.innerHTML = '';

    // 简介
    cards.appendChild(editCard('实验简介', c.intro, 'intro'));
    // 目的
    cards.appendChild(editCard('实验目的', c.purpose, 'purpose'));
    // 原理
    cards.appendChild(editCard('实验原理', c.principle, 'principle'));
    // 适用样本类型
    const sampleCard = document.createElement('div');
    sampleCard.className = 'lab-edit-card';
    sampleCard.innerHTML = `
      <div class="lab-edit-card-head">
        <span class="lab-edit-card-title">适用样本类型</span>
        <button class="edit-btn" data-edit="sampleTypes">编辑</button>
      </div>
      <div class="lab-sample-types"></div>`;
    const stBox = sampleCard.querySelector('.lab-sample-types');
    (c.sampleTypes || []).forEach(t => {
      const tag = document.createElement('span');
      tag.className = 'lab-sample-tag';
      tag.textContent = t;
      stBox.appendChild(tag);
    });
    if (!(c.sampleTypes || []).length) stBox.innerHTML = '<div class="lab-ref-empty">暂无样本类型</div>';
    sampleCard.querySelector('[data-edit="sampleTypes"]').addEventListener('click', () => editSampleTypes());
    cards.appendChild(sampleCard);

    // 标准实验流程
    const stepCard = document.createElement('div');
    stepCard.className = 'lab-edit-card';
    stepCard.innerHTML = `
      <div class="lab-edit-card-head">
        <span class="lab-edit-card-title">标准实验流程</span>
      </div>
      <div class="lab-steps"></div>`;
    const stepBox = stepCard.querySelector('.lab-steps');
    renderSteps(stepBox, c);
    cards.appendChild(stepCard);

    // 操作按钮状态
    const saveBtn = document.getElementById('labSave');
    saveBtn.textContent = previewMode ? '退出预览' : '保存';
    renderRight();
  }

  function editCard(title, value, key) {
    const card = document.createElement('div');
    card.className = 'lab-edit-card';
    if (previewMode) {
      card.innerHTML = `
        <div class="lab-edit-card-head"><span class="lab-edit-card-title">${title}</span></div>
        <div class="lab-text">${escapeHtml(value || '（暂无内容）')}</div>`;
    } else {
      card.innerHTML = `
        <div class="lab-edit-card-head">
          <span class="lab-edit-card-title">${title}</span>
          <button class="edit-btn" data-key="${key}">编辑</button>
        </div>
        <textarea class="lab-textarea" data-key="${key}" rows="4" placeholder="点击编辑填写…">${escapeHtml(value || '')}</textarea>`;
      card.querySelector('.lab-textarea').addEventListener('change', e => {
        Store.updateExperiment(current, { [key]: e.target.value });
      });
    }
    return card;
  }

  function renderSteps(container, c) {
    container.innerHTML = '';
    (c.steps || []).forEach((st, i) => {
      const item = document.createElement('div');
      item.className = 'lab-step';
      if (previewMode) {
        item.innerHTML = `
          <div class="lab-step-head">
            <span class="lab-step-no">Step ${i + 1}</span>
            <span class="lab-step-title">${escapeHtml(st.title)}</span>
          </div>
          <div class="lab-step-fields">
            ${st.purpose ? `<div class="lab-step-field"><span class="k">目的：</span>${escapeHtml(st.purpose)}</div>` : ''}
            ${st.operation ? `<div class="lab-step-field full"><span class="k">操作：</span>${escapeHtml(st.operation)}</div>` : ''}
            ${st.params ? `<div class="lab-step-field"><span class="k">参数：</span>${escapeHtml(st.params)}</div>` : ''}
            ${st.notes ? `<div class="lab-step-field"><span class="k">注意事项：</span>${escapeHtml(st.notes)}</div>` : ''}
          </div>`;
      } else {
        item.innerHTML = `
          <div class="lab-step-head">
            <span class="lab-step-no">Step ${i + 1}</span>
            <input class="lab-step-title" data-step-title="title" value="${escapeHtml(st.title)}" maxlength="30">
            <span class="lab-step-actions">
              <button class="icon-btn" data-move="-1" title="上移">↑</button>
              <button class="icon-btn" data-move="1" title="下移">↓</button>
              <button class="icon-btn" data-edit-step title="编辑">✎</button>
              <button class="icon-btn danger" data-del-step title="删除">×</button>
            </span>
          </div>
          <div class="lab-step-fields">
            <div class="lab-step-field full"><span class="k">目的</span></div>
            <div class="lab-step-field full"><textarea class="lab-textarea" data-step-f="purpose" rows="2" placeholder="本步骤目的…">${escapeHtml(st.purpose || '')}</textarea></div>
            <div class="lab-step-field full"><span class="k">操作</span></div>
            <div class="lab-step-field full"><textarea class="lab-textarea" data-step-f="operation" rows="2" placeholder="具体操作…">${escapeHtml(st.operation || '')}</textarea></div>
            <div class="lab-step-field"><span class="k">参数</span></div>
            <div class="lab-step-field full"><textarea class="lab-textarea" data-step-f="params" rows="1" placeholder="条件、时间、转速…">${escapeHtml(st.params || '')}</textarea></div>
            <div class="lab-step-field full"><span class="k">注意事项</span></div>
            <div class="lab-step-field full"><textarea class="lab-textarea" data-step-f="notes" rows="1" placeholder="注意事项…">${escapeHtml(st.notes || '')}</textarea></div>
          </div>`;

        item.querySelector('[data-step-title]').addEventListener('change', e => {
          Store.updateStep(current, st.id, { title: e.target.value });
        });
        item.querySelectorAll('[data-step-f]').forEach(ta => {
          ta.addEventListener('change', e => {
            Store.updateStep(current, st.id, { [e.target.dataset.stepF]: e.target.value });
          });
        });
        item.querySelector('[data-move="-1"]').addEventListener('click', () => { Store.moveStep(current, st.id, -1); renderMain(); });
        item.querySelector('[data-move="1"]').addEventListener('click', () => { Store.moveStep(current, st.id, 1); renderMain(); });
        item.querySelector('[data-edit-step]').addEventListener('click', () => openStepEdit(st));
        item.querySelector('[data-del-step]').addEventListener('click', () => {
          Store.removeStep(current, st.id);
          renderMain();
        });
      }
      container.appendChild(item);
    });
    if (!(c.steps || []).length) {
      container.innerHTML = '<div class="lab-ref-empty">暂无步骤,点击下方“+ 添加步骤”</div>';
    }
  }

  /* ---------- 右侧:关联文献 / 项目(可编辑) ---------- */
  function renderRight() {
    const c = Store.getExperiment(current);
    const refs = document.getElementById('labRefs');
    refs.innerHTML = '';
    if (!(c.refs || []).length) {
      refs.innerHTML = '<div class="lab-ref-empty">暂无关联文献</div>';
    } else {
      c.refs.forEach(r => {
        const item = document.createElement('div');
        item.className = 'lab-ref' + (r.id ? ' clickable' : '');
        if (r.id) item.title = '点击打开该文献';
        item.innerHTML = `
          <div class="lab-ref-title">${escapeHtml(r.title)}</div>
          <div class="lab-ref-meta">
            ${r.if ? `<span>IF：${escapeHtml(r.if)}</span>` : ''}
            ${r.zone ? `<span>分区：${escapeHtml(r.zone)}</span>` : ''}
          </div>
          ${r.note ? `<div class="lab-ref-note">${escapeHtml(r.note)}</div>` : ''}`;
        if (r.id) {
          item.addEventListener('click', () => {
            window.Goto('lit');
            if (window.LitOpen) window.LitOpen(r.id);
          });
        }
        refs.appendChild(item);
      });
    }

    const projects = document.getElementById('labProjects');
    projects.innerHTML = '';
    // 关联项目:反查项目管理中关联了本实验的项目,点击跳转
    const projHits = Store.projects().filter(pr => ((pr.links || {}).exp || []).includes(current));
    if (projHits.length) {
      projHits.forEach(pr => {
        const item = document.createElement('div');
        item.className = 'lab-project link';
        item.textContent = pr.name;
        item.title = '点击跳转到项目';
        item.addEventListener('click', () => {
          window.Goto('proj');
          if (window.ProjectSelect) window.ProjectSelect(pr.id);
        });
        projects.appendChild(item);
      });
    } else if (c.projects && c.projects.length) {
      // 兼容旧手填数据
      c.projects.forEach(p => {
        const item = document.createElement('div');
        item.className = 'lab-project';
        item.textContent = p;
        projects.appendChild(item);
      });
    } else {
      projects.innerHTML = '<div class="lab-project-empty">暂无关联项目(在项目管理「编辑关联」中设置)</div>';
    }

    // 编辑入口(关联文献)
    const refBtn = document.getElementById('labRefsEdit');
    if (refBtn) refBtn.onclick = () => editRefs(c);
    // 关联项目编辑(与项目管理双向联动)
    const projBtn = document.getElementById('labProjectsEdit');
    if (projBtn) projBtn.onclick = () => editProjectsLinked(c);
    // 关联文件(文件库)
    renderLabFiles(c);
  }

  /* 编辑关联项目:勾选项目 → 同步写入对应项目的 links.exp(与项目管理双向联动) */
  function editProjectsLinked(c) {
    const projs = Store.projects();
    const cur = projs.filter(pr => ((pr.links || {}).exp || []).includes(current));
    const chk = id => cur.some(x => x.id === id) ? 'checked' : '';
    window.EditModalOpen('编辑关联项目（与项目管理联动）', `
      <form class="edit-form">
        <div class="edit-field"><label>勾选要关联的项目</label>
          ${projs.length
            ? `<div class="proj-link-pick">${projs.map(pr => `<label class="proj-pick-row"><input type="checkbox" name="proj" value="${pr.id}" ${chk(pr.id)}>${escapeHtml(pr.name)}</label>`).join('')}</div>`
            : '<div class="lit-rel-empty">暂无项目,请先创建项目</div>'}
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, () => {
      const sel = [...document.querySelectorAll('input[name=proj]:checked')].map(i => i.value);
      projs.forEach(pr => {
        const list = ((pr.links || {}).exp || []).filter(x => x !== current);   // 先移除本实验
        if (sel.includes(pr.id)) list.push(current);                            // 勾选再加入
        Store.updateProject(pr.id, { links: Object.assign({}, pr.links || {}, { exp: list }) });
      });
      renderRight();
    });
  }

  /* 关联文件:显示 + 上传 PDF + 移除(文件库联动) */
  function renderLabFiles(c) {
    const box = document.getElementById('labFiles');
    const addBtn = document.getElementById('labFilesAdd');
    if (addBtn) addBtn.onclick = () => uploadLabPdf(c);
    if (!box) return;
    box.innerHTML = '';
    const ids = c.files || [];
    const metas = window.FileStore ? FileStore.meta() : [];
    const files = ids.map(id => metas.find(m => m.id === id)).filter(Boolean);
    if (!files.length) {
      box.innerHTML = '<div class="lab-ref-empty">暂无关联文件,点击右上角“+ 上传 PDF”</div>';
      return;
    }
    files.forEach(f => {
      const item = document.createElement('div');
      item.className = 'file-rel-item';
      item.innerHTML = `
        <span class="file-rel-name">${escapeHtml(f.name)}</span>
        <span class="file-rel-size">${fmtSize(f.size)}</span>
        <span class="file-rel-ops">
          <button class="lab-action-btn" data-fopen="${f.id}">打开</button>
          <button class="lab-action-btn danger" data-fdel="${f.id}">移除</button>
        </span>`;
      item.querySelector('[data-fopen]').addEventListener('click', async () => {
        const url = await FileStore.openURL(f.id);
        if (url) window.open(url, '_blank');
      });
      item.querySelector('[data-fdel]').addEventListener('click', () => {
        Store.updateExperiment(current, { files: (c.files || []).filter(x => x !== f.id) });
        renderRight();
      });
      box.appendChild(item);
    });
  }

  /* 直接上传 PDF:存入文件库(实验资料/实验中心)并关联到当前实验 */
  function uploadLabPdf(c) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async () => {
      const f = input.files[0];
      if (!f) return;
      if (!window.FileStore) { alert('文件库不可用'); return; }
      const m = await FileStore.add(f, '实验中心', '实验中心');
      Store.updateExperiment(current, { files: (c.files || []).concat([m.id]) });
      renderRight();
    };
    input.click();
  }

  /* 通用:选择文件库文件(多选) */
  function editFiles(c, onSave) {
    const metas = window.FileStore ? FileStore.meta() : [];
    if (!metas.length) { alert('文件库暂无文件,请先到「文件管理」上传'); return; }
    const chosen = c.files || [];
    const rows = metas.map(f => `
      <label class="set-radio" style="width:100%;justify-content:flex-start">
        <input type="checkbox" name="f" value="${f.id}" ${chosen.includes(f.id) ? 'checked' : ''}>
        <span class="set-radio-dot"></span>
        <span>${escapeHtml(f.name)} <small style="color:var(--text-3)">(${fmtSize(f.size)})</small></span>
      </label>`).join('');
    window.EditModalOpen('关联文件', `
      <form class="edit-form">
        <div class="edit-field"><label>勾选文件库中的文件</label><div style="display:flex;flex-direction:column;gap:4px">${rows}</div></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, v => {
      const sel = [...document.querySelectorAll('#editModalBody input[name="f"]:checked')].map(x => x.value);
      onSave(sel);
    });
  }

  const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : b >= 1024 ? Math.round(b / 1024) + 'KB' : b + 'B';

  function editRefs(c) {
    const papers = Store.literature().papers;
    const cur = c.refs || [];
    const chk = id => cur.some(r => r.id === id) ? 'checked' : '';
    window.EditModalOpen('编辑关联文献（从文献证据库选择）', `
      <form class="edit-form">
        <div class="edit-field"><label>勾选要关联的文献</label>
          ${papers.length
            ? `<div class="proj-link-pick">${papers.map(pp => `<label class="proj-pick-row"><input type="checkbox" name="ref" value="${pp.id}" ${chk(pp.id)}>${escapeHtml(pp.title)}</label>`).join('')}</div>`
            : '<div class="lit-rel-empty">文献证据库暂无文献,请先添加文献</div>'}
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, () => {
      const sel = [...document.querySelectorAll('input[name=ref]:checked')].map(i => i.value);
      const refs = sel.map(id => {
        const pp = papers.find(x => x.id === id);
        const old = cur.find(r => r.id === id);
        return old ? old : { id, title: pp ? pp.title : '', if: (pp && pp.if) || '', zone: (pp && pp.zone) || '', note: '' };
      });
      Store.updateExperiment(current, { refs });
      renderRight();
    });
  }

  function editProjects(c) {
    window.EditModalOpen('编辑关联项目', `
      <form class="edit-form">
        <div class="edit-field"><label>每行一个项目</label>
          <textarea name="projects" rows="5">${escapeHtml((c.projects || []).join('\n'))}</textarea>
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, v => {
      Store.updateExperiment(current, { projects: v.projects.split('\n').map(s => s.trim()).filter(Boolean) });
      renderRight();
    });
  }

  /* ---------- 编辑弹窗 ---------- */
  function editSampleTypes() {
    const c = Store.getExperiment(current);
    window.EditModalOpen('编辑适用样本类型', `
      <form class="edit-form">
        <div class="edit-field"><label>样本类型(每行一个)</label>
          <textarea name="sampleTypes" rows="5">${escapeHtml((c.sampleTypes || []).join('\n'))}</textarea>
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, values => {
      const list = values.sampleTypes.split('\n').map(s => s.trim()).filter(Boolean);
      Store.updateExperiment(current, { sampleTypes: list });
      renderMain();
    });
  }

  function addStep() {
    window.EditModalOpen('添加步骤', `
      <form class="edit-form">
        <div class="edit-field"><label>步骤名称</label><input name="title" maxlength="30" placeholder="如：样品裂解" required></div>
        <div class="edit-field"><label>目的</label><textarea name="purpose" rows="2"></textarea></div>
        <div class="edit-field"><label>操作</label><textarea name="operation" rows="3"></textarea></div>
        <div class="edit-field"><label>参数</label><input name="params" maxlength="60"></div>
        <div class="edit-field"><label>注意事项</label><textarea name="notes" rows="2"></textarea></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">添加</button>
        </div>
      </form>`, values => {
      Store.addStep(current, {
        title: values.title || '新步骤',
        purpose: values.purpose || '',
        operation: values.operation || '',
        params: values.params || '',
        notes: values.notes || ''
      });
      renderMain();
    });
  }

  function openStepEdit(st) {
    window.EditModalOpen(`编辑步骤（${st.title}）`, `
      <form class="edit-form">
        <div class="edit-field"><label>步骤名称</label><input name="title" maxlength="30" value="${escapeHtml(st.title)}" required></div>
        <div class="edit-field"><label>目的</label><textarea name="purpose" rows="2">${escapeHtml(st.purpose || '')}</textarea></div>
        <div class="edit-field"><label>操作</label><textarea name="operation" rows="3">${escapeHtml(st.operation || '')}</textarea></div>
        <div class="edit-field"><label>参数</label><input name="params" maxlength="60" value="${escapeHtml(st.params || '')}"></div>
        <div class="edit-field"><label>注意事项</label><textarea name="notes" rows="2">${escapeHtml(st.notes || '')}</textarea></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, values => {
      Store.updateStep(current, st.id, {
        title: values.title || st.title,
        purpose: values.purpose || '',
        operation: values.operation || '',
        params: values.params || '',
        notes: values.notes || ''
      });
      renderMain();
    });
  }

  function renameSkill(s) {
    const c = Store.getExperiment(s.id);
    window.EditModalOpen('重命名实验技能', `
      <form class="edit-form">
        <div class="edit-field"><label>名称</label><input name="name" value="${escapeHtml(c.name)}" maxlength="20" required></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, values => {
      Store.updateSkillName(s.id, values.name);
      Store.updateExperiment(s.id, { name: values.name });
      renderCats(document.getElementById('labSearch').value);
      renderMain();
    });
  }

  function deleteSkill(s) {
    window.EditModalOpen('删除实验技能', `
      <div style="font-size:13px;color:var(--text-2);line-height:1.8;margin-bottom:14px">删除实验技能「${escapeHtml(s.name)}」及其全部内容？</div>
      <div class="edit-actions">
        <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
        <button type="button" class="btn-danger" id="skillDelConfirm">删除</button>
      </div>`, null);
    document.getElementById('skillDelConfirm').onclick = () => {
      Store.removeSkill(s.id);
      if (current === s.id) {
        const rest = Store.experiments().skills;
        current = rest[0]?.id || null;
      }
      EditModalClose();
      renderCats(document.getElementById('labSearch').value);
      renderMain();
    };
  }

  /* 新建分类 / 实验技能(合并为一个按钮,弹窗内切换类型) */
  function newItem() {
    window.EditModalOpen('新建', `
      <form class="edit-form">
        <div class="edit-field"><label>类型</label>
          <select id="newItemType" onchange="document.getElementById('newItemFields').innerHTML = window.LabNewFields(this.value)">
            <option value="cat">新建分类</option>
            <option value="skill">新建实验技能</option>
          </select>
        </div>
        <div id="newItemFields">${labNewFieldsHTML('cat')}</div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">创建</button>
        </div>
      </form>`, v => {
      const type = document.getElementById('newItemType').value;
      if (type === 'cat') {
        if (v.label && v.label.trim()) {
          Store.addExpCategory(v.label.trim());
          renderCats(document.getElementById('labSearch').value);
        }
      } else {
        if (v.name && v.name.trim()) {
          const id = Store.addExperiment({ category: v.category, name: v.name.trim() });
          current = id;
          document.getElementById('labSearch').value = '';
          renderCats('');
          renderMain();
        }
      }
    });
  }

  function labNewFieldsHTML(type) {
    if (type === 'skill') {
      const cats = Object.entries(Store.experiments().categories)
        .map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('');
      return `<div class="edit-field"><label>实验技能名称</label><input name="name" maxlength="20" placeholder="如：质粒提取" required></div>
        <div class="edit-field"><label>所属分类</label><select name="category">${cats}</select></div>`;
    }
    return `<div class="edit-field"><label>分类名称</label><input name="label" maxlength="20" placeholder="如：动物实验 / 生信分析" required></div>`;
  }
  window.LabNewFields = labNewFieldsHTML;

  /* 供文献证据等模块跳转:选中指定实验并渲染 */
  window.LabSelect = (id) => {
    if (!Store.experiments().skills.some(s => s.id === id)) return;
    current = id;
    renderCats('');
    renderMain();
  };

  function select() {
    renderCats(document.getElementById('labSearch').value);
    renderMain();
  }

  /* ---------- 导出(当前实验 → Markdown / PDF) ---------- */
  function buildLabMd(c) {
    let md = `# ${c.name}\n\n`;
    md += `- 标签:${(c.tags || []).join('、') || '—'}\n`;
    md += `- 最近更新:${c.updated || ''}\n\n`;
    md += `## 实验简介\n\n${c.intro || '（暂无）'}\n\n`;
    md += `## 实验目的\n\n${c.purpose || '（暂无）'}\n\n`;
    md += `## 实验原理\n\n${c.principle || '（暂无）'}\n\n`;
    md += `## 适用样本类型\n\n${(c.sampleTypes || []).join('、') || '（暂无）'}\n\n`;
    md += `## 标准实验流程\n`;
    (c.steps || []).forEach((st, i) => {
      md += `\n### Step ${i + 1} ${st.title}\n`;
      if (st.purpose) md += `- 目的:${st.purpose}\n`;
      if (st.operation) md += `- 操作:${st.operation}\n`;
      if (st.params) md += `- 参数:${st.params}\n`;
      if (st.notes) md += `- 注意事项:${st.notes}\n`;
    });
    md += `\n## 关联文献\n`;
    if (!(c.refs || []).length) md += '（暂无）\n';
    else (c.refs || []).forEach(r => { md += `- ${r.title}${r.if ? '（IF:' + r.if + '）' : ''}${r.zone ? ' ' + r.zone : ''}\n`; });
    md += `\n## 关联项目\n`;
    if (!(c.projects || []).length) md += '（暂无）\n';
    else (c.projects || []).forEach(p => { md += `- ${p}\n`; });
    return md;
  }

  function buildLabHTML(c) {
    const md = buildLabMd(c);
    return `<html><head><meta charset="utf-8"><title>${escapeHtml(c.name)}</title>
<style>
  body { font-family: SimSun, "宋体", serif; font-size: 11pt; color: #333; margin: 40px; line-height: 1.9; }
  h1 { font-size: 17pt; text-align: center; }
  h2 { font-size: 13pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 12pt; }
  li { margin: 3px 0; }
  .meta { color: #888; font-size: 10pt; text-align: center; margin-bottom: 20px; }
</style></head><body>${mdToHtmlForExport(md)}</body></html>`;
  }

  function mdToHtmlForExport(md) {
    // 简易 markdown → html(标题/列表/粗体)
    let s = escapeHtml(md);
    s = s.split('\n').map(line => {
      const h = line.match(/^(#{1,4})\s+(.*)/);
      if (h) return `<h${h[1].length}>${h[2]}</h${h[1].length}>`;
      if (/^\s*[-*]\s+/.test(line)) return `<li>${line.replace(/^\s*[-*]\s+/, '')}</li>`;
      if (/^\s*$/.test(line)) return '';
      return `<p>${line}</p>`;
    }).join('\n');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    return `<ul>${s}</ul>`.replace('<ul><h', '<h').replace('</ul>', '');
  }

  function downloadFile(name, content, mime) {
    const blob = new Blob(['\uFEFF' + content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function exportLab(kind) {
    const c = Store.getExperiment(current);
    const fname = `${c.name}-SOP-${Store.todayStr()}`;
    if (kind === 'md') {
      downloadFile(`${fname}.md`, buildLabMd(c), 'text/markdown;charset=utf-8');
    } else if (kind === 'pdf') {
      const w = window.open('', '_blank');
      const hint = '<div style="position:fixed;top:12px;right:16px;font-size:11px;color:#999;background:#fff;padding:6px 10px;border:1px solid #eee;border-radius:8px">提示:在打印对话框中选择「另存为 PDF」</div>';
      w.document.write(buildLabHTML(c).replace('<body>', '<body>' + hint).replace('</body>', '<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script></body>'));
      w.document.close();
    }
  }

  function init() {
    document.getElementById('labExportMd').addEventListener('click', () => exportLab('md'));
    document.getElementById('labExportPdf').addEventListener('click', () => exportLab('pdf'));
    document.getElementById('labSearch').addEventListener('input', e => {
      renderCats(e.target.value);
    });
    document.getElementById('labNew').addEventListener('click', newItem);
    document.getElementById('labRename').addEventListener('click', () => {
      const s = Store.experiments().skills.find(x => x.id === current);
      if (s) renameSkill(s);
    });
    document.getElementById('labAddStep').addEventListener('click', addStep);
    document.getElementById('labSave').addEventListener('click', () => {
      previewMode = !previewMode;
      renderMain();
    });
    document.getElementById('labPreview').addEventListener('click', () => {
      previewMode = true;
      renderMain();
    });
    document.getElementById('labMode').addEventListener('click', () => {
      previewMode = false;
      renderMain();
    });
    document.getElementById('labRefGo').addEventListener('click', () => {
      if (window.Goto) window.Goto('lit');
    });
  }

  function renderAll() {
    previewMode = true;
    renderCats('');
    renderMain();
  }

  return { init, renderAll };
})();
