'use strict';

/**
 * files.js — 文件管理(统一文件库)
 * 左:分类 + 统计;中:文件列表(打开/下载/重命名/移动分类/删除)
 */
const Files = (() => {
  let currentCat = '全部';
  let kw = '';
  let viewMode = 'files';          // files | trash
  const selected = new Set();      // 批量选中的文件 id

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB'
    : b >= 1024 ? Math.round(b / 1024) + 'KB' : b + 'B';
  const fmtTime = t => {
    const d = new Date(t);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };
  const extOf = name => {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toUpperCase().slice(0, 4) : 'FILE';
  };

  /* 上传(多选,选择分类) */
  function upload() {
    window.EditModalOpen('上传文件（可多选）', `
      <form class="edit-form">
        <div class="edit-field"><label>文件分类</label>
          <select name="cat">${FileStore.CATEGORIES.filter(c => c !== '数据备份').map(c => `<option>${c}</option>`).join('')}</select>
        </div>
        <div class="edit-field"><label>选择文件(可多选)</label><input type="file" name="file" id="filePick" multiple required></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">上传</button>
        </div>
      </form>`, async v => {
      const input = document.getElementById('filePick');
      const files = input && input.files;
      if (!files || !files.length) return;
      for (const f of files) await FileStore.add(f, v.cat, '手动上传');
      renderAll();
    });
  }

  /* 备份:将全部模块数据打包 JSON 存入文件库 */
  async function backupNow() {
    const d = Store.load();
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const name = 'ScholarFlow数据备份-' + Store.todayStr() + '-' + String(Date.now()).slice(-4) + '.json';
    const f = new File([blob], name, { type: 'application/json' });
    await FileStore.add(f, '数据备份', '数据备份');
    alert('已备份全部模块数据到文件库:「数据备份」分类');
    renderAll();
  }

  /* 恢复:从备份文件还原全部数据 */
  async function restoreFromFile(f) {
    const blob = await FileStore.getBlob(f.id);
    if (!blob) { alert('备份文件不存在'); return; }
    const text = await blob.text();
    let d;
    try {
      d = JSON.parse(text.replace(/^\uFEFF/, ''));   // 兼容带 BOM 的导出文件
      if (!d || !d.events || !d.todos || !d.feed) throw new Error('格式不正确');
    } catch (e) {
      alert('该文件不是有效的 ScholarFlow 数据备份');
      return;
    }
    if (!confirm(`将用「${f.name}」覆盖当前全部数据,确定恢复？(建议先备份当前数据)`)) return;
    try { localStorage.setItem('rws_dashboard_v1', JSON.stringify(d)); } catch (e) { alert('写入失败:' + e.message); return; }
    alert('已恢复,页面即将刷新');
    location.reload();
  }

  /* 文件列表(支持回收站视图 + 批量多选) */
  /* 图片预览 URL 池,渲染前释放上一批,避免内存累积 */
  let _urls = [];
  function renderList() {
    _urls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { /* 忽略 */ } });
    _urls = [];
    const box = document.getElementById('fileList');
    box.innerHTML = '';
    const source = viewMode === 'trash' ? FileStore.trashed() : FileStore.active();
    let list = source.slice().sort((a, b) => b.time - a.time);
    if (viewMode !== 'trash' && currentCat !== '全部') list = list.filter(f => f.category === currentCat);
    if (kw) list = list.filter(f => f.name.toLowerCase().includes(kw));
    if (viewMode === 'trash') {
      box.innerHTML = list.length
        ? list.map(f => `
          <div class="file-item trash">
            <span class="file-check"><input type="checkbox" data-sel="${f.id}" ${selected.has(f.id) ? 'checked' : ''}></span>
            <div class="file-icon">🗑</div>
            <div class="file-info">
              <div class="file-name">${escapeHtml(f.name)}</div>
              <div class="file-meta"><span>${fmtSize(f.size)}</span><span>删除于 ${fmtTime(f.trashedAt || f.time)}</span><span class="file-cat-tag">${escapeHtml(f.category || '其他')}</span></div>
            </div>
            <span class="file-ops">
              <button class="lab-action-btn" data-restore="${f.id}">恢复</button>
              <button class="lab-action-btn danger" data-purge="${f.id}">彻底删除</button>
            </span>
          </div>`).join('')
        : '<div class="file-empty">回收站为空</div>';
      box.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => { FileStore.restore(b.dataset.restore); selected.delete(b.dataset.restore); renderAll(); }));
      box.querySelectorAll('[data-purge]').forEach(b => b.addEventListener('click', () => purgeOne(b.dataset.purge)));
      box.querySelectorAll('[data-sel]').forEach(cb => cb.addEventListener('change', () => {
        if (cb.checked) selected.add(cb.dataset.sel); else selected.delete(cb.dataset.sel);
        renderBatchBar();
      }));
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="file-empty">暂无文件,点击"+ 上传文件"添加</div>';
      return;
    }
    list.forEach(f => {
      const item = document.createElement('div');
      item.className = 'file-item' + (selected.has(f.id) ? ' sel' : '');
      const isImg = /^image\//.test(f.type || '');
      const isBackup = f.category === '数据备份';
      const ops = isBackup
        ? `<button class="lab-action-btn" data-act="restore">恢复</button><button class="lab-action-btn" data-act="dl">下载</button><button class="lab-action-btn danger" data-act="del">删除</button>`
        : `<button class="lab-action-btn" data-act="prev">预览</button><button class="lab-action-btn" data-act="open">打开</button><button class="lab-action-btn" data-act="dl">下载</button><button class="lab-action-btn" data-act="ren">重命名</button><button class="lab-action-btn" data-act="mv">分类</button><button class="lab-action-btn danger" data-act="del">删除</button>`;
      item.innerHTML = `
        <span class="file-check"><input type="checkbox" data-sel="${f.id}" ${selected.has(f.id) ? 'checked' : ''}></span>
        <div class="file-icon" data-img="${f.id}">${isBackup ? '📦' : (isImg ? '' : escapeHtml(extOf(f.name)))}</div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(f.name)}</div>
          <div class="file-meta">
            <span>${fmtSize(f.size)}</span><span>${fmtTime(f.time)}</span>
            <span>来源:${escapeHtml(f.source || '')}</span>
            <span class="file-cat-tag">${escapeHtml(f.category || '其他')}</span>
          </div>
        </div>
        <span class="file-ops">${ops}</span>`;
      // 图片预览图标
      if (isImg) {
        FileStore.openURL(f.id).then(url => {
          if (url) {
            _urls.push(url);
            const icon = item.querySelector('[data-img="' + f.id + '"]');
            if (icon) icon.innerHTML = `<img src="${url}" alt="">`;
          }
        });
      }
      item.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          act(f, btn.dataset.act);
        });
      });
      item.querySelector('[data-sel]').addEventListener('change', e => {
        if (e.target.checked) selected.add(f.id); else selected.delete(f.id);
        item.classList.toggle('sel', e.target.checked);
        renderBatchBar();
      });
      box.appendChild(item);
    });
  }

  function act(f, actName) {
    if (actName === 'open') openFile(f);
    else if (actName === 'prev') previewFile(f);
    else if (actName === 'dl') FileStore.download(f.id);
    else if (actName === 'ren') renameFile(f);
    else if (actName === 'mv') moveFile(f);
    else if (actName === 'restore') restoreFromFile(f);
    else if (actName === 'del') delFile(f);
  }

  async function openFile(f) {
    const url = await FileStore.openURL(f.id);
    if (!url) { alert('文件不存在或已被删除'); return; }
    window.open(url, '_blank');
  }

  /* 内置预览:PDF / 文本 / 图片 */
  async function previewFile(f) {
    const url = await FileStore.openURL(f.id);
    if (!url) { alert('文件不存在'); return; }
    const isText = /\.(txt|md|json|csv|log|py|js|html)$/i.test(f.name) || /^text\//.test(f.type || '');
    if (isText) {
      const blob = await FileStore.getBlob(f.id);
      const text = await blob.text();
      window.EditModalOpen('预览: ' + f.name, `<pre style="white-space:pre-wrap;word-break:break-all;font-size:12px;line-height:1.6;max-height:70vh;overflow:auto;color:var(--text-1)">${escapeHtml(text.slice(0, 200000))}</pre>`);
    } else if (/^image\//.test(f.type || '')) {
      window.EditModalOpen('预览: ' + f.name, `<div style="text-align:center"><img src="${url}" style="max-width:100%;max-height:70vh;border-radius:6px"></div>`);
    } else if (/^application\/pdf/.test(f.type || '') || /\.pdf$/i.test(f.name)) {
      window.EditModalOpen('预览: ' + f.name, `<iframe src="${url}" style="width:100%;height:70vh;border:none;border-radius:6px;background:#fff"></iframe>`);
      document.querySelector('#editModal .modal')?.classList.add('modal-wide');
    } else {
      window.EditModalOpen('预览', `<div style="color:var(--text-3);font-size:13px">该类型不支持内置预览,可点「打开」用系统程序查看。<br><br><b>${escapeHtml(f.name)}</b> · ${fmtSize(f.size)}</div>`);
    }
  }

  /* 回收站:彻底删除单个 */
  function purgeOne(id) {
    const f = FileStore.meta().find(x => x.id === id);
    window.EditModalOpen('彻底删除', `
      <div style="font-size:13px;color:var(--text-2);line-height:1.8;margin-bottom:14px">彻底删除「${escapeHtml(f ? f.name : '')}」？删除后无法恢复。</div>
      <div class="edit-actions">
        <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
        <button type="button" class="btn-danger" id="purgeConfirm">彻底删除</button>
      </div>`, null);
    document.getElementById('purgeConfirm').onclick = async () => {
      await FileStore.purge(id);
      selected.delete(id);
      EditModalClose();
      renderAll();
    };
  }

  function renameFile(f) {
    window.EditModalOpen('重命名文件', `
      <form class="edit-form">
        <div class="edit-field"><label>文件名</label><input name="name" value="${escapeHtml(f.name)}" required></div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">保存</button></div>
      </form>`, v => {
      if (v.name) { FileStore.update(f.id, { name: v.name }); renderAll(); }
    });
  }

  function moveFile(f) {
    window.EditModalOpen('移动分类', `
      <form class="edit-form">
        <div class="edit-field"><label>分类</label>
          <select name="cat">${FileStore.CATEGORIES.map(c => `<option ${f.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
        <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">移动</button></div>
      </form>`, v => {
      FileStore.update(f.id, { category: v.cat });
      renderAll();
    });
  }

  function delFile(f) {
    window.EditModalOpen('删除文件', `
      <div style="font-size:13px;color:var(--text-2);line-height:1.8;margin-bottom:14px">将文件「${escapeHtml(f.name)}」移入回收站？(可随时恢复)</div>
      <div class="edit-actions">
        <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
        <button type="button" class="btn-danger" id="fileDelConfirm">移入回收站</button>
      </div>`, null);
    document.getElementById('fileDelConfirm').onclick = async () => {
      await FileStore.remove(f.id);
      EditModalClose();
      renderAll();
    };
  }

  /* ---------- 批量操作 ---------- */
  function renderBatchBar() {
    const bar = document.getElementById('fileBatch');
    if (!bar) return;
    const n = selected.size;
    bar.style.display = n ? 'flex' : 'none';
    bar.innerHTML = n
      ? `<span class="file-batch-info">已选 <b>${n}</b> 项</span>
         <button class="lab-action-btn" id="batchDel">批量删除</button>
         <button class="lab-action-btn" id="batchMv">批量移动分类</button>
         <button class="lab-action-btn" id="batchDl">批量下载</button>
         <button class="lab-action-btn" id="batchClear">取消选择</button>`
      : '';
    if (!n) return;
    const ids = [...selected];
    bar.querySelector('#batchClear').onclick = () => { selected.clear(); renderList(); renderBatchBar(); };
    bar.querySelector('#batchDel').onclick = async () => {
      if (!confirm(`将 ${ids.length} 个文件移入回收站？`)) return;
      for (const id of ids) await FileStore.remove(id);
      selected.clear(); renderAll();
    };
    bar.querySelector('#batchDl').onclick = () => { ids.forEach(id => FileStore.download(id)); };
    bar.querySelector('#batchMv').onclick = () => {
      window.EditModalOpen('批量移动分类', `
        <form class="edit-form">
          <div class="edit-field"><label>移动到</label>
            <select name="cat">${FileStore.CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
          </div>
          <div class="edit-actions"><button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button><button type="submit" class="btn-primary">移动</button></div>
        </form>`, v => {
        ids.forEach(id => FileStore.update(id, { category: v.cat }));
        selected.clear(); renderAll();
      });
    };
  }

  /* 左栏:统计 + 分类 + 回收站 */
  function renderLeft() {
    const activeCount = FileStore.active().length;
    const trashCount = FileStore.trashed().length;
    const st = FileStore.stats();
    document.getElementById('fileStats').innerHTML = `
      <div><b>${activeCount}</b> 个文件</div>
      <div class="l">已用 ${fmtSize(st.total)}</div>`;
    const cats = document.getElementById('fileCats');
    cats.innerHTML = '';
    const all = document.createElement('div');
    all.className = 'file-cat' + (viewMode === 'files' && currentCat === '全部' ? ' active' : '');
    all.innerHTML = `<span>全部文件</span><span class="cnt">${activeCount}</span>`;
    all.addEventListener('click', () => { viewMode = 'files'; currentCat = '全部'; selected.clear(); renderLeft(); renderList(); renderBatchBar(); });
    cats.appendChild(all);
    FileStore.CATEGORIES.forEach(c => {
      const count = FileStore.active().filter(f => f.category === c).length;
      const item = document.createElement('div');
      item.className = 'file-cat' + (viewMode === 'files' && currentCat === c ? ' active' : '');
      item.innerHTML = `<span>${c}</span><span class="cnt">${count}</span>`;
      item.addEventListener('click', () => { viewMode = 'files'; currentCat = c; selected.clear(); renderLeft(); renderList(); renderBatchBar(); });
      cats.appendChild(item);
    });
    // 回收站
    const trash = document.createElement('div');
    trash.className = 'file-cat trash' + (viewMode === 'trash' ? ' active' : '');
    trash.innerHTML = `<span>🗑 回收站</span><span class="cnt">${trashCount}</span>`;
    trash.addEventListener('click', () => { viewMode = 'trash'; currentCat = '全部'; selected.clear(); renderLeft(); renderList(); renderBatchBar(); });
    cats.appendChild(trash);
  }

  function init() {
    document.getElementById('fileUpload').addEventListener('click', upload);
    document.getElementById('fileUpload2').addEventListener('click', upload);
    document.getElementById('fileBackup').addEventListener('click', backupNow);
    document.getElementById('fileSearch').addEventListener('input', e => {
      kw = e.target.value.trim().toLowerCase();
      renderList();
    });
  }

  function renderAll() {
    viewMode = viewMode || 'files';
    currentCat = currentCat || '全部';
    document.getElementById('fileSearch').value = '';
    kw = '';
    selected.clear();
    renderLeft();
    renderList();
    renderBatchBar();
  }

  return { init, renderAll };
})();
