'use strict';

/**
 * literature.js — 文献证据
 * 个人科研证据库:分类/标签/年份筛选、搜索排序、文章详情、证据卡片、关联信息
 */
const Literature = (() => {
  let currentCat = '全部';      // 当前分类
  let selTag = null;            // 当前标签
    let selPaper = null;          // 当前查看文章 id

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ---------- 左栏 ---------- */
  function renderNav() {
    const lit = Store.literature();
    const nav = document.getElementById('litNav');
    nav.innerHTML = '';
    const counts = {};
    lit.papers.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });

    const all = document.createElement('div');
    all.className = 'lit-nav-item' + (currentCat === '全部' ? ' active' : '');
    all.innerHTML = `全部文献 <span class="cnt">${lit.papers.length}</span>`;
    all.addEventListener('click', () => { currentCat = '全部'; selTag = null; selPaper = null; renderNav(); renderBody(); });
    nav.appendChild(all);

    lit.categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'lit-nav-item' + (currentCat === cat ? ' active' : '');
      item.innerHTML = `<span class="lit-nav-edit" data-edit="${escapeHtml(cat)}" title="重命名">✎</span><span class="lit-nav-del" data-del="${escapeHtml(cat)}" title="删除分类">×</span>${escapeHtml(cat)} <span class="cnt">${counts[cat] || 0}</span>`;
      item.addEventListener('click', () => { currentCat = cat; selTag = null; selPaper = null; renderNav(); renderBody(); });
      item.querySelector('.lit-nav-del').addEventListener('click', e => {
        e.stopPropagation();
        const cnt = counts[cat] || 0;
        window.EditModalOpen('删除分类', `
          <div style="font-size:13px;color:var(--text-2);line-height:1.8;margin-bottom:14px">
            分类「${escapeHtml(cat)}」下共有 <b>${cnt}</b> 篇文章，如何处理？
          </div>
          <div class="edit-actions">
            <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
            <button type="button" class="btn-primary" id="delKeep">保留文章</button>
            <button type="button" class="btn-danger" id="delAll">连同文章删除</button>
          </div>`, null);
        document.getElementById('delKeep').onclick = () => {
          Store.removeCategory(cat);
          if (currentCat === cat) currentCat = '全部';
          EditModalClose();
          renderNav();
          renderBody();
        };
        document.getElementById('delAll').onclick = () => {
          Store.removePapersByCategory(cat);
          Store.removeCategory(cat);
          if (currentCat === cat) currentCat = '全部';
          selPaper = null;
          EditModalClose();
          renderNav();
          renderBody();
        };
      });
      item.querySelector('.lit-nav-edit').addEventListener('click', e => {
        e.stopPropagation();
        window.EditModalOpen('重命名分类', `
          <form class="edit-form">
            <div class="edit-field"><label>分类名称</label><input name="name" value="${escapeHtml(cat)}" maxlength="20" required></div>
            <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">保存</button></div>
          </form>`, v => {
          if (v.name && v.name !== cat) {
            Store.renameCategory(cat, v.name);
            if (currentCat === cat) currentCat = v.name;
            renderNav();
            renderBody();
          }
        });
      });
      nav.appendChild(item);
    });

    const add = document.createElement('div');
    add.className = 'lit-nav-item';
    add.textContent = '+ 自定义分类';
    add.addEventListener('click', () => {
      window.EditModalOpen('添加分类', `
        <form class="edit-form">
          <div class="edit-field"><label>分类名称</label><input name="name" maxlength="20" required></div>
          <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">添加</button></div>
        </form>`, v => {
        if (v.name) { Store.addCategory(v.name); renderNav(); }
      });
    });
    nav.appendChild(add);

    // 标签
    const tags = document.getElementById('litTags');
    tags.innerHTML = '';
    lit.tags.forEach(t => {
      const s = document.createElement('span');
      s.className = 'lit-tag' + (selTag === t ? ' on' : '');
      s.innerHTML = `#${escapeHtml(t)}<i class="lit-tag-del" data-del="${escapeHtml(t)}">×</i>`;
      s.addEventListener('click', () => {
        selTag = selTag === t ? null : t;
        currentCat = '全部';          // 标签筛选与分类筛选互斥
        selPaper = null;
        renderNav();
        renderBody();
      });
      const del = s.querySelector('.lit-tag-del');
      del.addEventListener('click', e => {
        e.stopPropagation();        Store.removeTag(t);
        if (selTag === t) selTag = null;
        renderNav();
        renderBody();
      });
      tags.appendChild(s);
    });
    const tagAdd = document.createElement('span');
    tagAdd.className = 'lit-tag';
    tagAdd.textContent = '+ 标签';
    tagAdd.addEventListener('click', () => {
      window.EditModalOpen('添加标签', `
        <form class="edit-form">
          <div class="edit-field"><label>标签名称</label><input name="name" maxlength="15" placeholder="如：机器学习" required></div>
          <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">添加</button></div>
        </form>`, v => {
        if (v.name) { Store.addTag(v.name); renderNav(); }
      });
    });
    tags.appendChild(tagAdd);
  }

  /* ---------- 筛选 ---------- */
  function filteredPapers(kw) {
    const lit = Store.literature();
    let list = lit.papers.slice();
    if (currentCat !== '全部') list = list.filter(p => p.category === currentCat);
    if (selTag) list = list.filter(p => (p.tags || []).includes(selTag));
    if (kw) {
      const k = kw.toLowerCase();
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(k) ||
        (p.authors || '').toLowerCase().includes(k) ||
        (p.journal || '').toLowerCase().includes(k) ||
        (p.tags || []).some(t => t.toLowerCase().includes(k)) ||
        (p.evidences || []).some(e => (e.title + e.content + e.supports).toLowerCase().includes(k))
      );
    }
    const sort = document.getElementById('litSort').value;
    if (sort === 'used') list.sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || ''));
    else if (sort === 'ev') list.sort((a, b) => (b.evidences || []).length - (a.evidences || []).length);
    else list.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
    return list;
  }

  /* ---------- 主体 ---------- */
  function renderBody() {
    const box = document.getElementById('litBody');
    const kw = document.getElementById('litSearch').value.trim();
    const list = filteredPapers(kw);

    if (selPaper) {
      const p = Store.literature().papers.find(x => x.id === selPaper);
      if (p) { renderDetail(box, p); return; }
      selPaper = null;
    }

    if (!list.length) {
      box.innerHTML = '<div class="lit-empty">暂无文献,点击右上角“添加文献”开始构建你的证据库</div>';
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'lit-paper-list';
    list.forEach(p => {
      const card = document.createElement('div');
      card.className = 'lit-paper-card';
      card.innerHTML = `
        <div class="lit-paper-title">${escapeHtml(p.title)}</div>
        <div class="lit-paper-meta">
          <span>${escapeHtml(p.authors || '')}</span>
          <span>${escapeHtml(p.journal || '')}</span>
          <span>${escapeHtml(p.year || '')}</span>
          ${p.if ? `<span>IF:${escapeHtml(p.if)}</span>` : ''}
          <span class="ev">${(p.evidences || []).length} 条证据</span>
        </div>
        <div class="lit-paper-tags">${(p.tags || []).map(t => `<span>#${escapeHtml(t)}</span>`).join('')}</div>`;
      card.addEventListener('click', () => {
        selPaper = p.id;
        Store.updatePaper(p.id, {});
        renderBody();
      });
      wrap.appendChild(card);
    });
    box.innerHTML = '';
    box.appendChild(wrap);
  }

  /* ---------- 文章详情 ---------- */
  function renderDetail(box, p) {
    const trust = n => '★'.repeat(Math.min(5, Math.max(0, n || 0))) + '☆'.repeat(Math.max(0, 5 - (n || 0)));
    box.innerHTML = `
      <div class="lit-detail-head">
        <div class="lit-detail-title">${escapeHtml(p.title)}</div>
        <div class="lit-detail-meta">
          <span><b>作者</b>${escapeHtml(p.authors || '')}</span>
          <span><b>期刊</b>${escapeHtml(p.journal || '')}</span>
          <span><b>年份</b>${escapeHtml(p.year || '')}</span>
          ${p.if ? `<span><b>IF</b>${escapeHtml(p.if)}</span>` : ''}
          <span><b>分区</b>${escapeHtml(p.zone || '')}</span>
          <span><b>DOI</b>${escapeHtml(p.doi || '')}</span>
        </div>
        <div class="lit-detail-tags" id="litDetailTags">
          ${(p.tags || []).map(t => `<span class="lit-detail-tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}<i class="lit-tag-del" data-del="${escapeHtml(t)}">×</i></span>`).join('')}
          <span class="lit-tag-add" id="litTagAdd">+ 标签</span>
          <span class="lit-detail-cat">${escapeHtml(p.category || '')}</span>
        </div>
        <div class="lit-detail-actions">
          <button class="lab-action-btn" data-act="edit">编辑</button>
          <button class="lab-action-btn" data-act="pdf">打开PDF</button>
          <button class="lab-action-btn" data-act="chpdf">更换PDF</button>
          <button class="lab-action-btn danger" data-act="del">删除</button>
          <button class="lab-action-btn" data-act="back">← 返回列表</button>
        </div>
      </div>

      <div class="lit-sec-card">
        <div class="lit-sec-title">文章概览</div>
        <div class="lit-ov-row"><div class="k">研究问题</div><div class="v">${escapeHtml((p.overview || {}).question || '（暂无）')}</div></div>
        <div class="lit-ov-row"><div class="k">研究方法</div><ul>${((p.overview || {}).methods || []).map(m => `<li>${escapeHtml(m)}</li>`).join('') || '<div class="v">（暂无）</div>'}</ul></div>
        <div class="lit-ov-row"><div class="k">主要结果</div><ul>${((p.overview || {}).results || []).map(r => `<li>${escapeHtml(r)}</li>`).join('') || '<div class="v">（暂无）</div>'}</ul></div>
      </div>

      <div class="lit-sec-card">
        <div class="lit-sec-title">该文献能够证明什么（证据卡片）</div>
        <div class="lit-ev-list" id="litEvList"></div>
        <button class="lit-ev-add" id="litEvAdd" style="margin-top:10px">+ 新增证据</button>
      </div>

      <div class="lit-rel-grid">
        <div class="lit-rel-card"><div class="lit-rel-title">关联项目</div><div class="lit-rel-list" id="litProjRel">${projRelList(p)}</div></div>
        <div class="lit-rel-card"><div class="lit-rel-title">关联实验</div><div class="lit-rel-list" id="litExpRel">${expRelList(p)}</div></div>
      </div>`;

    // 证据列表
    const evList = box.querySelector('#litEvList');
    (p.evidences || []).forEach((ev, i) => {
      const item = document.createElement('div');
      item.className = 'lit-ev';
      item.innerHTML = `
        <div class="lit-ev-head">
          <span class="lit-ev-no">证据${String(i + 1).padStart(2, '0')}</span>
          <span class="lit-ev-title">${escapeHtml(ev.title)}</span>
          <span class="lit-ev-actions">
            <button class="edit-btn" data-evedit title="编辑证据">编辑</button>
            <button class="icon-btn danger" data-evdel title="删除">×</button>
          </span>
        </div>
        <div class="lit-ev-body">${escapeHtml(ev.content || '')}</div>
        <div class="lit-ev-fields">
          <span><span class="k">证据类型</span>${escapeHtml(ev.type || '')}</span>
          <span><span class="k">来源</span>${escapeHtml(ev.source || '')}</span>
          <span><span class="k">支持观点</span>${escapeHtml(ev.supports || '')}</span>
          <span><span class="k">可信程度</span><span class="lit-ev-trust">${trust(ev.trust)}</span></span>
        </div>
        ${ev.usableIn && ev.usableIn.length ? `<div class="lit-ev-fields"><span><span class="k">可用于</span>${ev.usableIn.map(x => escapeHtml(x)).join('、')}</span></div>` : ''}`;
      item.querySelector('[data-evedit]').addEventListener('click', () => editEvidence(p, ev));
      item.querySelector('[data-evdel]').addEventListener('click', () => {
        Store.removeEvidence(p.id, ev.id);
        renderBody();
      });
      evList.appendChild(item);
    });
    if (!(p.evidences || []).length) {
      evList.innerHTML = '<div class="lit-rel-empty">暂无证据,点击下方“新增证据”记录这篇文章证明了什么</div>';
    }

    box.querySelector('#litEvAdd').addEventListener('click', () => editEvidence(p, null));
    box.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'back') { selPaper = null; renderBody(); }
        else if (act === 'edit') editPaper(p);
        else if (act === 'pdf') {
          openPaperPdf(p);
        }
        else if (act === 'chpdf') changePaperPdf(p);
        else if (act === 'del') {
          if (confirm(`删除文献「${p.title}」及其全部证据？`)) {
            Store.removePaper(p.id);
            selPaper = null;
            renderNav();
            renderBody();
          }
        }
      });
    });
    // 详情页标签:给该文献添加/删除标签
    const tagAddBtn = box.querySelector('#litTagAdd');
    if (tagAddBtn) tagAddBtn.addEventListener('click', () => addPaperTag(p));
    box.querySelectorAll('.lit-detail-tag [data-del]').forEach(del => {
      del.addEventListener('click', e => {
        e.stopPropagation();
        Store.updatePaper(p.id, { tags: (p.tags || []).filter(t => t !== del.dataset.del) });
        syncGlobalTags();
        renderNav();
        renderBody();
      });
    });
    // 详情页标签本体点击 → 按该标签筛选文献(与分类筛选互斥)
    box.querySelectorAll('.lit-detail-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        selTag = tag.dataset.tag;
        currentCat = '全部';
        selPaper = null;
        renderNav();
        renderBody();
      });
    });
    // 关联项目:点击跳转到项目管理并选中该项目
    box.querySelectorAll('[data-proj]').forEach(chip => {
      chip.addEventListener('click', () => {
        window.Goto('proj');
        if (window.ProjectSelect) window.ProjectSelect(chip.dataset.proj);
      });
    });
    // 关联实验:点击跳转到实验中心并选中该实验
    box.querySelectorAll('[data-exp]').forEach(chip => {
      chip.addEventListener('click', () => {
        window.Goto('lab');
        if (window.LabSelect) window.LabSelect(chip.dataset.exp);
      });
    });
  }

  /* 关联信息编辑(项目/实验/章节/知识库) */
  function editRelList(p, key) {
    const titles = { projects: '关联项目', experiments: '关联实验', knowledge: '关联知识库', chapters: '关联论文章节' };
    const isChapter = key === 'chapters';
    const val = isChapter
      ? (p.chapters || []).map(c => `${c.name}|${c.status}`).join('\n')
      : (p[key] || []).join('\n');
    const placeholder = isChapter ? '每行一个,格式:章节名称|已引用(或待引用)\n如:论文第三章 方法|已引用' : '每行一个';
    window.EditModalOpen(`编辑${titles[key] || key}`, `
      <form class="edit-form">
        <div class="edit-field"><label>${placeholder}</label>
          <textarea name="list" rows="6">${escapeHtml(val)}</textarea>
        </div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, v => {
      if (isChapter) {
        const chapters = v.list.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
          const [name, status] = line.split('|');
          return { name: (name || '').trim(), status: (status || '').trim() === '待引用' ? '待引用' : '已引用' };
        });
        Store.updatePaper(p.id, { chapters });
      } else {
        Store.updatePaper(p.id, { [key]: v.list.split('\n').map(s => s.trim()).filter(Boolean) });
      }
      renderBody();
    });
  }

  function relList(arr, label) {
    if (!arr || !arr.length) return `<div class="lit-rel-empty">暂无关联${label}</div>`;
    return arr.map(x => `<div class="lit-rel-item">${escapeHtml(x)}</div>`).join('');
  }
  function chaptersList(arr) {
    if (!arr || !arr.length) return '<div class="lit-rel-empty">暂无关联章节</div>';
    return arr.map(c => `
      <div class="lit-rel-item">${escapeHtml(c.name)}<span class="lit-rel-status ${c.status === '已引用' ? 'used' : 'pending'}">${escapeHtml(c.status)}</span></div>`).join('');
  }

  /* 关联项目:实时反查项目管理中手动关联了本文献的项目,点击跳转 */
  function projRelList(p) {
    const projs = Store.projects().filter(pr => ((pr.links || {}).lit || []).includes(p.id));
    if (!projs.length) return '<div class="lit-rel-empty">暂无关联项目(在项目管理「编辑关联」中设置)</div>';
    return projs.map(pr => `<div class="lit-rel-chip" data-proj="${pr.id}" title="跳转到项目">${escapeHtml(pr.name)}</div>`).join('');
  }

  /* 关联实验:实时反查实验中心中关联了本文献的实验,点击跳转 */
  function expRelList(p) {
    const exps = Store.experiments();
    const hits = exps.skills.filter(s => ((exps.content[s.id] || {}).refs || []).some(r => r.id === p.id));
    if (!hits.length) return '<div class="lit-rel-empty">暂无关联实验(在实验中心「关联文献」中设置)</div>';
    return hits.map(s => `<div class="lit-rel-chip" data-exp="${s.id}" title="跳转到实验">${escapeHtml(s.name)}</div>`).join('');
  }

  /* 全局标签池与文献实际使用同步:移除不再被任何文献使用的标签 */
  function syncGlobalTags() {
    const used = new Set();
    Store.literature().papers.forEach(pp => (pp.tags || []).forEach(t => used.add(t)));
    Store.literature().tags.slice().forEach(t => {
      if (!used.has(t)) Store.removeTag(t);
    });
  }

  /* 给某篇文献添加标签:输入新标签或点选已有全局标签 */
  function addPaperTag(p) {
    const cur = p.tags || [];
    const all = Store.literature().tags.filter(t => !cur.includes(t));
    window.EditModalOpen('给文献添加标签', `
      <form class="edit-form">
        <div class="edit-field"><label>输入新标签</label><input name="name" maxlength="15" placeholder="如：机器学习" required></div>
        ${all.length ? `<div class="edit-field"><label>或点选已有标签</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${all.map(t => `<span class="lit-tag" data-pick="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}</div></div>` : ''}
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">添加</button></div>
      </form>`, v => {
      const name = v.name.trim();
      if (name) Store.addTag(name);          // 同步到左侧全局标签池
      const tags = Array.from(new Set(cur.concat([name]))).filter(Boolean);
      Store.updatePaper(p.id, { tags });
      renderNav();
      renderBody();
    });
    // 点选已有标签
    document.querySelectorAll('#editModalBody [data-pick]').forEach(el => {
      el.addEventListener('click', () => {
        const t = el.dataset.pick;
        const tags = Array.from(new Set(cur.concat([t])));
        Store.updatePaper(p.id, { tags });
        EditModalClose();
        renderNav();
        renderBody();
      });
    });
  }

  /* 文献 PDF:已有关联 → 直接打开;无 → 首次上传 */
  async function openPaperPdf(p) {
    // 已关联文件库 PDF → 直接打开
    if (p.fileId && window.FileStore) {
      const url = await FileStore.openURL(p.fileId);
      if (url) { window.open(url, '_blank'); return; }
    }
    // 有外部链接 → 直接打开
    if (p.pdfUrl) { window.open(p.pdfUrl, '_blank'); return; }
    // 都没有 → 首次上传(自动存入文件库)
    uploadPaperPdf(p);
  }

  /* 首次上传 PDF:选择本地文件 → 存入文件库 → 关联并打开 */
  function uploadPaperPdf(p) {
    window.EditModalOpen('上传 PDF（自动存入文件库）', `
      <form class="edit-form">
        <div class="edit-field"><label>选择本地 PDF 文件</label><input type="file" name="file" id="paperPdfPick" accept=".pdf" required></div>
        <div class="edit-field"><label>或填写外部链接(可选)</label><input name="pdfUrl" value="${escapeHtml(p.pdfUrl || '')}" placeholder="https://…"></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">上传并打开</button>
        </div>
      </form>`, async v => {
      const input = document.getElementById('paperPdfPick');
      const up = input && input.files[0];
      if (up) {
        if (!window.FileStore) { alert('文件库不可用'); return; }
        const m = await FileStore.add(up, '文献证据', '文献证据');
        Store.updatePaper(p.id, { fileId: m.id, pdfUrl: v.pdfUrl || '' });
        const url = await FileStore.openURL(m.id);
        if (url) window.open(url, '_blank');
        return;
      }
      if (v.pdfUrl) {
        Store.updatePaper(p.id, { pdfUrl: v.pdfUrl, fileId: null });
        window.open(v.pdfUrl, '_blank');
        return;
      }
      alert('请选择 PDF 文件或填写外部链接');
    });
  }

  /* 更换 PDF:从文件库选择 / 重新上传 / 改用链接 */
  function changePaperPdf(p) {
    const linked = (p.fileId && window.FileStore) ? FileStore.meta().find(f => f.id === p.fileId) : null;
    const libPdfs = window.FileStore ? FileStore.meta().filter(f => f.category === '文献证据' || /\.pdf$/i.test(f.name)) : [];
    const linkOpts = ['', ...libPdfs.map(f => f.id)].map(id => {
      const m = libPdfs.find(f => f.id === id);
      return `<option value="${id}" ${linked && linked.id === id ? 'selected' : ''}>${m ? escapeHtml(m.name) : '不关联文件库 PDF'}</option>`;
    }).join('');
    window.EditModalOpen('更换 PDF（文件库）', `
      <form class="edit-form">
        <div class="edit-field"><label>选择文件库中的 PDF</label>
          <select name="fileId">${linkOpts}</select>
        </div>
        <div class="edit-field"><label>或上传新 PDF（自动存入文件库）</label><input type="file" name="file" id="paperPdfPick" accept=".pdf"></div>
        <div class="edit-field"><label>或填写外部链接(可选)</label><input name="pdfUrl" value="${escapeHtml(p.pdfUrl || '')}" placeholder="https://…"></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存并打开</button>
        </div>
      </form>`, async v => {
      const input = document.getElementById('paperPdfPick');
      const up = input && input.files[0];
      let fileId = v.fileId || null;
      if (up) {
        if (!window.FileStore) { alert('文件库不可用'); return; }
        const m = await FileStore.add(up, '文献证据', '文献证据');
        fileId = m.id;
      }
      if (fileId) {
        Store.updatePaper(p.id, { fileId, pdfUrl: v.pdfUrl || '' });
        const url = await FileStore.openURL(fileId);
        if (url) window.open(url, '_blank');
        return;
      }
      if (v.pdfUrl) {
        Store.updatePaper(p.id, { pdfUrl: v.pdfUrl, fileId: null });
        window.open(v.pdfUrl, '_blank');
        return;
      }
      alert('请选择文件库 PDF、上传新 PDF 或填写外部链接');
    });
  }

  /* ---------- 编辑文章 / 证据 / 添加 ---------- */
  function editPaper(p) {
    const o = p.overview || {};
    window.EditModalOpen('编辑文献信息', `
      <form class="edit-form">
        <div class="edit-field"><label>标题</label><input name="title" value="${escapeHtml(p.title || '')}" required></div>
        <div class="edit-field"><label>作者</label><input name="authors" value="${escapeHtml(p.authors || '')}"></div>
        <div class="edit-field"><label>期刊</label><input name="journal" value="${escapeHtml(p.journal || '')}"></div>
        <div class="edit-field"><label>年份</label><input name="year" value="${escapeHtml(p.year || '')}"></div>
        <div class="edit-field"><label>IF</label><input name="if" value="${escapeHtml(p.if || '')}"></div>
        <div class="edit-field"><label>分区</label><input name="zone" value="${escapeHtml(p.zone || '')}"></div>
        <div class="edit-field"><label>DOI</label><input name="doi" value="${escapeHtml(p.doi || '')}"></div>
        <div class="edit-field"><label>PDF 链接</label><input name="pdfUrl" value="${escapeHtml(p.pdfUrl || '')}" placeholder="https://… 或 file:///C:/…/paper.pdf"></div>
        <div class="edit-field"><label>研究问题</label><textarea name="question" rows="2">${escapeHtml(o.question || '')}</textarea></div>
        <div class="edit-field"><label>研究方法(每行一个)</label><textarea name="methods" rows="3">${escapeHtml((o.methods || []).join('\n'))}</textarea></div>
        <div class="edit-field"><label>主要结果(每行一个)</label><textarea name="results" rows="3">${escapeHtml((o.results || []).join('\n'))}</textarea></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">保存</button></div>
      </form>`, v => {
      Store.updatePaper(p.id, {
        title: v.title, authors: v.authors, journal: v.journal, year: v.year,
        if: v.if, zone: v.zone, doi: v.doi, pdfUrl: v.pdfUrl,
        overview: {
          question: v.question,
          methods: v.methods.split('\n').map(s => s.trim()).filter(Boolean),
          results: v.results.split('\n').map(s => s.trim()).filter(Boolean)
        }
      });
      renderBody();
    });
  }

  function editEvidence(p, ev) {
    const d = ev || {};
    const usable = (d.usableIn || []).join('\n');
    window.EditModalOpen(ev ? '编辑证据' : '新增证据', `
      <form class="edit-form">
        <div class="edit-field"><label>证明观点</label><input name="title" value="${escapeHtml(d.title || '')}" placeholder="这篇文章证明了什么…" required></div>
        <div class="edit-field"><label>证据描述</label><textarea name="content" rows="3" placeholder="为什么、证据内容…">${escapeHtml(d.content || '')}</textarea></div>
        <div class="edit-field"><label>来源位置</label><input name="source" value="${escapeHtml(d.source || '')}" placeholder="Figure / Table / Section"></div>
        <div class="edit-field"><label>证据类型</label>
          <select name="type">
            ${['实验结果', '理论分析', '方法验证', '综述总结'].map(t => `<option ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="edit-field"><label>支持观点</label><input name="supports" value="${escapeHtml(d.supports || '')}"></div>
        <div class="edit-field"><label>应用位置(论文哪一章,每行一个)</label><textarea name="usableIn" rows="2">${escapeHtml(usable)}</textarea></div>
        <div class="edit-field"><label>可信程度(1-5)</label>
          <select name="trust">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${(d.trust || 5) === n ? 'selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5 - n)}</option>`).join('')}</select>
        </div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">保存</button></div>
      </form>`, v => {
      const data = {
        title: v.title, content: v.content, source: v.source, type: v.type,
        supports: v.supports, trust: parseInt(v.trust, 10) || 5,
        usableIn: v.usableIn.split('\n').map(s => s.trim()).filter(Boolean)
      };
      if (ev) Store.updateEvidence(p.id, ev.id, data);
      else Store.addEvidence(p.id, data);
      renderBody();
    });
  }

  function addPaper() {
    window.EditModalOpen('添加文献', `
      <form class="edit-form">
        <div class="edit-field"><label>文章标题</label><input name="title" placeholder="文章标题" required></div>
        <div class="edit-field"><label>作者</label><input name="authors" placeholder="Zhang Y., Wang X."></div>
        <div class="edit-field"><label>期刊</label><input name="journal"></div>
        <div class="edit-field"><label>年份</label><input name="year" placeholder="2025"></div>
        <div class="edit-field"><label>IF</label><input name="if"></div>
        <div class="edit-field"><label>分区</label><input name="zone" placeholder="一区"></div>
        <div class="edit-field"><label>DOI</label><input name="doi"></div>
        <div class="edit-field"><label>研究问题</label><textarea name="question" rows="2"></textarea></div>
        <div class="edit-field"><label>研究方法(每行一个)</label><textarea name="methods" rows="2"></textarea></div>
        <div class="edit-field"><label>主要结果(每行一个)</label><textarea name="results" rows="2"></textarea></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">添加</button></div>
      </form>`, v => {
      if (!v.title) return;
      const id = Store.addLitPaper({
        title: v.title, authors: v.authors, journal: v.journal, year: v.year,
        if: v.if, zone: v.zone, doi: v.doi, category: currentCat === '全部' ? '我的研究方向' : currentCat,
        tags: [], favorite: false,
        overview: {
          question: v.question,
          methods: v.methods.split('\n').map(s => s.trim()).filter(Boolean),
          results: v.results.split('\n').map(s => s.trim()).filter(Boolean)
        },
        evidences: [], projects: [], experiments: [], chapters: [], knowledge: []
      });
      selPaper = id;
      renderNav();
      renderBody();
    });
  }

  function init() {
    document.getElementById('litAdd').addEventListener('click', addPaper);
    document.getElementById('litAdd2').addEventListener('click', addPaper);
    document.getElementById('litSearch').addEventListener('input', () => renderBody());
    document.getElementById('litSort').addEventListener('change', () => renderBody());
    document.getElementById('litFilter').addEventListener('click', () => {
      const lit = Store.literature();
      const catOpts = ['全部', ...lit.categories].map(c => `<option ${currentCat === c ? 'selected' : ''}>${c}</option>`).join('');
      const tagOpts = ['全部', ...lit.tags].map(t => `<option ${selTag === t ? 'selected' : ''}>${t}</option>`).join('');
      window.EditModalOpen('筛选', `
        <form class="edit-form">
          <div class="edit-field"><label>分类</label><select name="cat">${catOpts}</select></div>
          <div class="edit-field"><label>标签</label><select name="tag">${tagOpts}</select></div>
          <div class="edit-actions">
            <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
            <button type="submit" class="btn-primary">应用筛选</button>
          </div>
        </form>`, v => {
        currentCat = v.cat === '全部' ? '全部' : v.cat;
        selTag = v.tag === '全部' ? null : v.tag;
        // 分类与标签互斥:选分类清标签,选标签清分类
        if (currentCat !== '全部') selTag = null;
        if (selTag) currentCat = '全部';
        selPaper = null;
        renderNav();
        renderBody();
      });
    });
  }

  function renderAll() {
    currentCat = '全部';
    selTag = null;
    selPaper = null;
    document.getElementById('litSearch').value = '';
    renderNav();
    renderBody();
  }

  /* 供实验中心等模块跳转:打开指定文献详情(IIFE 内,可访问内部变量) */
  window.LitOpen = (id) => {
    if (!Store.literature().papers.some(x => x.id === id)) return;
    selPaper = id;
    renderNav();
    renderBody();
  };

  return { init, renderAll };
})();
