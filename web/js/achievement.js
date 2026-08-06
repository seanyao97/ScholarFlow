'use strict';

/**
 * achievement.js — 成果管理
 * 个人科研成果档案库:分类/年份/标签筛选、按类型分组列表、成果概览、环形占比、时间轴、详情、新建成果
 */
const Achievement = (() => {
    let currentType = '全部';
      let selAch = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  const STATUS_CLS = s => (s === '已发表' || s === '已报告' || s === '已发布' || s === '已整理' || s === '完成') ? 'done' : (s === '申请中' || s === '投稿中' || s === '返修中') ? 'progress' : 'pending';

  /* ---------- 左栏 ---------- */
  function renderNav() {
    const list = Store.achievements();
    const nav = document.getElementById('achNav');
    nav.innerHTML = '';
    const counts = {};

    const all = document.createElement('div');
    all.className = 'ach-nav-item' + (currentType === '全部' ? ' active' : '');
    all.innerHTML = `全部成果 <span class="cnt">${list.length}</span>`;
    all.addEventListener('click', () => { currentType = '全部'; selAch = null; renderNav(); renderBody(); });
    nav.appendChild(all);

    Store.achTypes().forEach(t => {
      const n = list.filter(a => a.type === t).length;
      counts[t] = n;
      const item = document.createElement('div');
      item.className = 'ach-nav-item' + (currentType === t ? ' active' : '');
      item.innerHTML = `<span class="lit-nav-edit" data-edit="${escapeHtml(t)}" title="重命名">✎</span><span class="lit-nav-del" data-del="${escapeHtml(t)}" title="删除分类">×</span>${escapeHtml(t)}成果 <span class="cnt">${n}</span>`;
      item.addEventListener('click', () => { currentType = t; selAch = null; renderNav(); renderBody(); });
      item.querySelector('.lit-nav-edit').addEventListener('click', e => {
        e.stopPropagation();
        renameType(t);
      });
      item.querySelector('.lit-nav-del').addEventListener('click', e => {
        e.stopPropagation();
        delType(t, counts[t] || 0);
      });
      nav.appendChild(item);
    });

    // 添加分类
    const add = document.createElement('div');
    add.className = 'lit-add-btn ach-nav-add';
    add.textContent = '+ 添加分类';
    add.addEventListener('click', addType);
    nav.appendChild(add);
  }

  /* 分类:新建 / 重命名 / 删除 */
  function addType() {
    window.EditModalOpen('添加成果分类', `
      <form class="edit-form">
        <div class="edit-field"><label>分类名称</label><input name="name" maxlength="15" placeholder="如：教材 / 软著" required></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">添加</button></div>
      </form>`, v => {
      if (v.name.trim()) { Store.addAchType(v.name.trim()); renderNav(); }
    });
  }
  function renameType(oldName) {
    window.EditModalOpen('重命名分类', `
      <form class="edit-form">
        <div class="edit-field"><label>分类名称</label><input name="name" value="${escapeHtml(oldName)}" maxlength="15" required></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">保存</button></div>
      </form>`, v => {
      if (v.name.trim() && v.name.trim() !== oldName) {
        Store.renameAchType(oldName, v.name.trim());
        if (currentType === oldName) currentType = v.name.trim();
        renderNav(); renderBody();       }
    });
  }
  function delType(name, cnt) {
    window.EditModalOpen(`删除分类「${name}」`, `
      <div style="font-size:13px;color:var(--text-2);line-height:1.8;margin-bottom:14px">
        该分类下共有 <b>${cnt}</b> 项成果，如何处理？
      </div>
      <div class="edit-actions">
        <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
        <button type="button" class="btn-primary" id="achDelKeep">保留成果</button>
        <button type="button" class="btn-danger" id="achDelAll">连同成果删除</button>
      </div>`, null);
    document.getElementById('achDelKeep').onclick = () => {
      Store.removeAchType(name, true);
      if (currentType === name) currentType = '全部';
      EditModalClose();
      renderNav(); renderBody();     };
    document.getElementById('achDelAll').onclick = () => {
      Store.removeAchType(name, false);
      if (currentType === name) currentType = '全部';
      EditModalClose();
      renderNav(); renderBody();     };
  }

  /* ---------- 筛选 ---------- */
  function filtered() {
    let list = Store.achievements().slice();
    if (currentType !== '全部') list = list.filter(a => a.type === currentType);
    const kw = (document.getElementById('achSearch').value || '').trim().toLowerCase();
    if (kw) {
      list = list.filter(a =>
        (a.title || '').toLowerCase().includes(kw) ||
        (a.journal || '').toLowerCase().includes(kw) ||
        (a.conference || '').toLowerCase().includes(kw) ||
        (a.projects || []).some(p => p.toLowerCase().includes(kw))
      );
    }
    return list;
  }

  /* ---------- 中间:分组列表 ---------- */
  function renderBody() {
    const box = document.getElementById('achBody');
    const list = filtered();
    if (selAch) {
      const a = Store.achievements().find(x => x.id === selAch);
      if (a) { renderDetail(box, a); return; }
      selAch = null;
    }
    const sort = document.getElementById('achSort').value;
    if (sort === 'time') {
      list.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
      box.innerHTML = `<div class="ach-group"><div class="ach-group-head"><span class="ach-group-title">按时间排序</span></div><div class="ach-cards">${list.map(cardHTML).join('')}</div></div>`;
      bindCards(box);
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="ach-empty">暂无成果,点击右上角“新建成果”开始建档</div>';
      return;
    }
    box.innerHTML = '';
    Store.achTypes().forEach(t => {
      const group = list.filter(a => a.type === t);
      if (!group.length) return;
      const sec = document.createElement('div');
      sec.className = 'ach-group';
      const head = document.createElement('div');
      head.className = 'ach-group-head';
      head.innerHTML = `<span class="ach-group-title">${t}成果</span><button class="ach-more" data-more="${t}">查看更多 ></button>`;
      const cards = document.createElement('div');
      cards.className = 'ach-cards';
      cards.innerHTML = group.map(cardHTML).join('');
      sec.appendChild(head);
      sec.appendChild(cards);
      box.appendChild(sec);
    });
    bindCards(box);
    box.querySelectorAll('[data-more]').forEach(b => {
      b.addEventListener('click', () => {
        currentType = b.dataset.more;
        selAch = null;
        renderNav();
        renderBody();
              });
    });
  }

  function cardHTML(a) {
    const rows = [];
    if (a.type === '论文') {
      rows.push(['期刊', a.journal], ['年份', a.year], ['IF', a.if], ['分区', a.zone], ['作者身份', a.role]);
    } else if (a.type === '专利') {
      rows.push(['申请时间', a.applyTime], ['发明人', a.inventors]);
    } else if (a.type === '会议') {
      rows.push(['时间', a.confTime], ['地点', a.location], ['报告类型', a.reportType]);
    } else if (a.type === '数据') {
      rows.push(['数据类型', a.dataType], ['数据规模', a.scale], ['创建时间', a.createTime], ['来源项目', a.sourceProject]);
    } else if (a.type === '代码') {
      rows.push(['开发语言', a.language], ['功能', a.function], ['关联论文', a.linkedPaper]);
    } else if (a.type === '荣誉') {
      rows.push(['时间', a.time], ['授予单位', a.honorOrg]);
    } else if (a.type === '团队') {
      rows.push(['时间', a.time], ['参与人员', a.members]);
    }
    const rel = a.projects && a.projects.length ? `<div class="ach-card-row"><b>关联项目</b>${a.projects.join('、')}</div>` : '';
    return `
      <div class="ach-card" data-type="${a.type}" data-id="${a.id}">
        <div class="ach-card-title">${escapeHtml(a.title)}</div>
        ${rows.map(r => `<div class="ach-card-row"><b>${r[0]}</b>${escapeHtml(r[1] || '')}</div>`).join('')}
        ${rel}
        ${a.status ? `<span class="ach-card-status ${STATUS_CLS(a.status)}">${escapeHtml(a.status)}</span>` : ''}
        <div class="ach-card-actions">
          <button class="lab-action-btn" data-open="1">查看详情</button>
          <button class="lab-action-btn" data-edit="1">编辑</button>
          <button class="lab-action-btn" data-paper="${escapeHtml((a.papers || [])[0] || '')}">打开论文</button>
        </div>
      </div>`;
  }

  function bindCards(box) {
    box.querySelectorAll('.ach-card').forEach(card => {
      card.addEventListener('click', e => {
        const id = card.dataset.id;
        if (e.target.closest('[data-edit]')) { const a = Store.achievements().find(x => x.id === id); editAch(a); return; }
        if (e.target.closest('[data-paper]')) {
          if (window.Goto) {
            const pid = e.target.closest('[data-paper]').dataset.paper;
            window.Goto('paper');
            if (pid && window.PaperSelect) window.PaperSelect(pid);
          }
          return;
        }
        selAch = id;
        renderBody();
      });
    });
  }

  /* ---------- 详情 ---------- */
  function renderDetail(box, a) {
    const rows = [];
    if (a.type === '论文') {
      rows.push(['期刊', a.journal], ['年份', a.year], ['IF', a.if], ['分区', a.zone], ['作者身份', a.role]);
    } else if (a.type === '专利') {
      rows.push(['申请时间', a.applyTime], ['发明人', a.inventors]);
    } else if (a.type === '会议') {
      rows.push(['会议名称', a.conference], ['时间', a.confTime], ['地点', a.location], ['报告类型', a.reportType], ['报告题目', a.reportTitle]);
    } else if (a.type === '数据') {
      rows.push(['数据类型', a.dataType], ['数据规模', a.scale], ['创建时间', a.createTime], ['来源项目', a.sourceProject]);
    } else if (a.type === '代码') {
      rows.push(['开发语言', a.language], ['功能', a.function], ['关联论文', a.linkedPaper]);
    } else if (a.type === '荣誉') {
      rows.push(['时间', a.time], ['授予单位', a.honorOrg]);
    } else if (a.type === '团队') {
      rows.push(['时间', a.time], ['参与人员', a.members], ['描述', a.description]);
    }
    const rel = (label, arr) => arr && arr.length ? `<div class="ach-desc-row"><div class="k">${label}</div><div class="v">${arr.map(escapeHtml).join('、')}</div></div>` : '';
    box.innerHTML = `
      <div class="ach-detail-head">
        <div class="ach-detail-title">${escapeHtml(a.title)}</div>
        <div class="ach-detail-meta">
          <span><b>类型</b>${escapeHtml(a.type)}</span>
          ${a.status ? `<span><b>状态</b>${escapeHtml(a.status)}</span>` : ''}
          <span><b>时间</b>${escapeHtml(a.time || '')}</span>
          ${rows.map(r => `<span><b>${r[0]}</b>${escapeHtml(r[1] || '')}</span>`).join('')}
        </div>
        ${(a.tags || []).length ? `<div class="lit-detail-tags">${a.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="ach-detail-actions">
          <button class="lab-action-btn" data-act="edit">编辑</button>
          <button class="lab-action-btn danger" data-act="del">删除</button>
          <button class="lab-action-btn" data-act="back">← 返回列表</button>
        </div>
      </div>
      <div class="lit-sec-card">
        <div class="lit-sec-title">成果描述</div>
        <div class="ach-desc-row"><div class="k">研究背景</div><div class="v">${escapeHtml(a.background || '（暂无）')}</div></div>
        <div class="ach-desc-row"><div class="k">主要贡献</div><div class="v">${escapeHtml(a.contribution || '（暂无）')}</div></div>
        <div class="ach-desc-row"><div class="k">创新点</div><div class="v">${escapeHtml(a.innovation || '（暂无）')}</div></div>
      </div>
      <div class="lit-sec-card">
        <div class="lit-sec-title">关联文件（文件库）<button class="edit-btn" id="achFilesUpload" style="margin-left:8px">+ 上传文件</button><button class="edit-btn" id="achFilesEdit" style="margin-left:4px">从文件库选择</button></div>
        <div id="achFilesList"></div>
      </div>`;
    // 关联文件:列表 + 打开/移除 + 编辑选择
    const filesBox = box.querySelector('#achFilesList');
    const ids = a.files || [];
    const metas = window.FileStore ? FileStore.meta() : [];
    const files = ids.map(id => metas.find(m => m.id === id)).filter(Boolean);
    filesBox.innerHTML = files.length
      ? files.map(f => `<div class="file-rel-item" style="margin-bottom:4px"><span class="file-rel-name">${escapeHtml(f.name)}</span><span class="file-rel-size">${f.size >= 1048576 ? (f.size / 1048576).toFixed(1) + 'MB' : Math.round(f.size / 1024) + 'KB'}</span><span class="file-rel-ops"><button class="lab-action-btn" data-afopen="${f.id}">打开</button><button class="lab-action-btn" data-afdel="${f.id}">移除</button></span></div>`).join('')
      : '<span style="color:var(--text-3);font-size:12px">暂无关联文件,点击右上角"编辑"从文件库添加</span>';
    filesBox.querySelectorAll('[data-afopen]').forEach(b => b.addEventListener('click', async () => {
      const url = await FileStore.openURL(b.dataset.afopen);
      if (url) window.open(url, '_blank');
    }));
    filesBox.querySelectorAll('[data-afdel]').forEach(b => b.addEventListener('click', () => {
      Store.updateAchievement(a.id, { files: (a.files || []).filter(x => x !== b.dataset.afdel) });
      renderBody();
    }));
    // 上传文件:直接入库(成果文件/成果管理)并关联
    box.querySelector('#achFilesUpload').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async () => {
        const f = input.files[0];
        if (!f) return;
        if (!window.FileStore) { alert('文件库不可用'); return; }
        const m = await FileStore.add(f, '成果管理', '成果管理');
        Store.updateAchievement(a.id, { files: (a.files || []).concat([m.id]) });
        renderBody();
      };
      input.click();
    });
    box.querySelector('#achFilesEdit').addEventListener('click', () => {
      const metas2 = window.FileStore ? FileStore.meta() : [];
      if (!metas2.length) { alert('文件库暂无文件,请先到「文件管理」上传'); return; }
      const chosen = a.files || [];
      const rows = metas2.map(f => `
        <label class="set-radio" style="width:100%;justify-content:flex-start">
          <input type="checkbox" name="f" value="${f.id}" ${chosen.includes(f.id) ? 'checked' : ''}>
          <span class="set-radio-dot"></span>
          <span>${escapeHtml(f.name)} <small style="color:var(--text-3)">(${f.size >= 1048576 ? (f.size / 1048576).toFixed(1) + 'MB' : Math.round(f.size / 1024) + 'KB'})</small></span>
        </label>`).join('');
      window.EditModalOpen('关联文件', `
        <form class="edit-form">
          <div class="edit-field"><label>勾选文件库中的文件</label><div style="display:flex;flex-direction:column;gap:4px">${rows}</div></div>
          <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">保存</button></div>
        </form>`, v => {
        const sel = [...document.querySelectorAll('#editModalBody input[name="f"]:checked')].map(x => x.value);
        Store.updateAchievement(a.id, { files: sel });
        renderBody();
      });
    });
    box.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'back') { selAch = null; renderBody(); }
        else if (act === 'edit') editAch(a);
        else if (act === 'del') {
          if (confirm(`删除成果「${a.title}」？`)) {
            Store.removeAchievement(a.id);
            selAch = null;
            renderNav();
            renderBody();
                      }
        }
      });
    });
  }

  /* ---------- 新建 / 编辑 ---------- */
  function typeFieldsHTML(type, a) {
    const v = k => a ? escapeHtml(a[k] || '') : '';
    switch (type) {
      case '论文': return `
        <div class="edit-field"><label>期刊</label><input name="journal" value="${v('journal')}" placeholder="Nature Communications"></div>
        <div class="edit-field"><label>影响因子</label><input name="if" value="${v('if')}"></div>
        <div class="edit-field"><label>分区</label><input name="zone" value="${v('zone')}" placeholder="一区"></div>
        <div class="edit-field"><label>角色</label><input name="role" value="${v('role')}" placeholder="第一作者"></div>`;
      case '专利': return `
        <div class="edit-field"><label>专利号</label><input name="patentNo" value="${v('patentNo')}"></div>
        <div class="edit-field"><label>发明人</label><input name="inventors" value="${v('inventors')}" placeholder="逗号分隔"></div>
        <div class="edit-field"><label>申请时间</label><input name="applyTime" value="${v('applyTime')}"></div>`;
      case '会议': return `
        <div class="edit-field"><label>会议名称</label><input name="conference" value="${v('conference')}"></div>
        <div class="edit-field"><label>会议时间</label><input name="confTime" value="${v('confTime')}"></div>
        <div class="edit-field"><label>地点</label><input name="location" value="${v('location')}"></div>
        <div class="edit-field"><label>报告类型</label><input name="reportType" value="${v('reportType')}" placeholder="口头报告 / 海报"></div>
        <div class="edit-field"><label>报告题目</label><input name="reportTitle" value="${v('reportTitle')}"></div>`;
      case '数据': return `
        <div class="edit-field"><label>数据类型</label><input name="dataType" value="${v('dataType')}" placeholder="基因组 / 蛋白结构…"></div>
        <div class="edit-field"><label>数据规模</label><input name="scale" value="${v('scale')}"></div>
        <div class="edit-field"><label>创建时间</label><input name="createTime" value="${v('createTime')}"></div>
        <div class="edit-field"><label>来源项目</label><input name="sourceProject" value="${v('sourceProject')}"></div>`;
      case '代码': return `
        <div class="edit-field"><label>语言</label><input name="language" value="${v('language')}" placeholder="Python"></div>
        <div class="edit-field"><label>主要功能</label><input name="function" value="${v('function')}"></div>
        <div class="edit-field"><label>关联论文</label><input name="linkedPaper" value="${v('linkedPaper')}"></div>`;
      case '荣誉': return `
        <div class="edit-field"><label>授予单位</label><input name="honorOrg" value="${v('honorOrg')}"></div>
        <div class="edit-field"><label>级别</label><input name="awardLevel" value="${v('awardLevel')}" placeholder="国家级 / 校级"></div>`;
      case '团队': return `
        <div class="edit-field"><label>参与人员</label><input name="members" value="${v('members')}" placeholder="逗号分隔"></div>
        <div class="edit-field"><label>团队描述</label><textarea name="description" rows="2">${v('description')}</textarea></div>`;
      default: return '';
    }
  }

  function collectTypeFields(type, v) {
    const map = {
      '论文': ['journal', 'if', 'zone', 'role'],
      '专利': ['patentNo', 'inventors', 'applyTime'],
      '会议': ['conference', 'confTime', 'location', 'reportType', 'reportTitle'],
      '数据': ['dataType', 'scale', 'createTime', 'sourceProject'],
      '代码': ['language', 'function', 'linkedPaper'],
      '荣誉': ['honorOrg', 'awardLevel'],
      '团队': ['members', 'description']
    };
    const out = {};
    (map[type] || []).forEach(k => { if (v[k] !== undefined && v[k] !== '') out[k] = v[k]; });
    return out;
  }

  function newAch() {
    window.EditModalOpen('新建成果', `
      <form class="edit-form">
        <div class="edit-field"><label>成果类型</label>
          <select name="type" onchange="document.getElementById('achTypeFields').innerHTML = window.AchTypeFields(this.value)">${Store.achTypes().map(t => `<option>${t}</option>`).join('')}</select>
        </div>
        <div id="achTypeFields">${typeFieldsHTML(Store.achTypes()[0] || '论文', null)}</div>
        <div class="edit-field"><label>成果名称</label><input name="title" required placeholder="成果名称"></div>
        <div class="edit-field"><label>状态</label><input name="status" placeholder="已发表 / 申请中 / 已报告…"></div>
        <div class="edit-field"><label>时间(如 2025.06)</label><input name="time" placeholder="2025.06"></div>
        <div class="edit-field"><label>年份</label><input name="year" placeholder="2025"></div>
        <div class="edit-field"><label>关联项目(逗号分隔)</label><input name="projects" placeholder="AI材料预测"></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">创建</button>
        </div>
      </form>`, v => {
      if (!v.title) return;
      Store.addAchievement(Object.assign({
        type: v.type, title: v.title, status: v.status, time: v.time, year: v.year,
        projects: v.projects ? v.projects.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        tags: v.status ? [v.status] : [], experiments: [], refs: [], papers: [], files: []
      }, collectTypeFields(v.type, v)));
      renderNav();
      renderBody();
          });
  }

  function editAch(a) {
    window.EditModalOpen(`编辑成果（${a.type}）`, `
      <form class="edit-form">
        <div class="edit-field"><label>成果名称</label><input name="title" value="${escapeHtml(a.title || '')}" required></div>
        <div class="edit-field"><label>状态</label><input name="status" value="${escapeHtml(a.status || '')}"></div>
        <div class="edit-field"><label>时间</label><input name="time" value="${escapeHtml(a.time || '')}"></div>
        <div class="edit-field"><label>年份</label><input name="year" value="${escapeHtml(a.year || '')}"></div>
        <div id="achTypeFields">${typeFieldsHTML(a.type, a)}</div>
        <div class="edit-field"><label>关联项目(逗号分隔)</label><input name="projects" value="${escapeHtml((a.projects || []).join('、'))}"></div>
        <div class="edit-field"><label>研究背景</label><textarea name="background" rows="2">${escapeHtml(a.background || '')}</textarea></div>
        <div class="edit-field"><label>主要贡献</label><textarea name="contribution" rows="2">${escapeHtml(a.contribution || '')}</textarea></div>
        <div class="edit-field"><label>创新点</label><textarea name="innovation" rows="2">${escapeHtml(a.innovation || '')}</textarea></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, v => {
      Store.updateAchievement(a.id, Object.assign({
        title: v.title, status: v.status, time: v.time, year: v.year,
        projects: v.projects ? v.projects.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        background: v.background, contribution: v.contribution, innovation: v.innovation
      }, collectTypeFields(a.type, v)));
      renderNav();
      renderBody();
          });
  }

  function init() {
    window.AchTypeFields = t => typeFieldsHTML(t, null);
    document.getElementById('achNew').addEventListener('click', newAch);
    document.getElementById('achNew2').addEventListener('click', newAch);
    document.getElementById('achSearch').addEventListener('input', () => renderBody());
    document.getElementById('achSort').addEventListener('change', () => renderBody());
  }

  function renderAll() {
    currentType = '全部';
    selAch = null;
    document.getElementById('achSearch').value = '';
    renderNav();
    renderBody();
      }

  return { init, renderAll };
})();
