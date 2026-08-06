'use strict';

/**
 * filestore.js — 统一文件库(独立模块)
 * 文件 Blob 存 IndexedDB;元数据(名称/分类/大小/时间/来源)存 localStorage。
 * 所有模块上传的文件统一入库,本地保存、本地打开(URL.createObjectURL)。
 */
const FileStore = (() => {
  const DB_NAME = 'scholarflow_files';
  const DB_VERSION = 1;
  const META_KEY = 'rws_files_meta';

  // 分类 = 各模块名称(文件按来源模块归类)
  const CATEGORIES = ['文献证据', '实验中心', '数据分析', '成果管理', '项目管理', '日程管理', '文件管理', '数据备份', '其他'];
  // 旧分类名 → 模块名迁移
  const CAT_MAP = { '论文PDF': '文献证据', '实验资料': '实验中心', '成果文件': '成果管理', '图片文件': '文件管理' };

  let db = null;
  let opening = null;

  function open() {
    if (db) return Promise.resolve(db);
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('files')) {
          req.result.createObjectStore('files');
        }
      };
      req.onsuccess = () => { db = req.result; opening = null; resolve(db); };
      req.onerror = () => { opening = null; reject(req.error); };
    });
    return opening;
  }

  /* ---------- 元数据 ---------- */
  function meta() {
    let list;
    try { list = JSON.parse(localStorage.getItem(META_KEY)); if (!Array.isArray(list)) list = []; } catch (e) { list = []; }
    // 旧分类名迁移到模块名(幂等)
    let changed = false;
    list.forEach(m => {
      if (m && CAT_MAP[m.category]) { m.category = CAT_MAP[m.category]; changed = true; }
    });
    if (changed) saveMeta(list);
    return list;
  }
  function saveMeta(list) {
    try { localStorage.setItem(META_KEY, JSON.stringify(list)); } catch (e) { /* 忽略 */ }
  }

  /* ---------- 增删查 ---------- */
  async function putBlob(id, blob) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('files', 'readwrite');
      tx.objectStore('files').put(blob, id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getBlob(id) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('files', 'readonly');
      const req = tx.objectStore('files').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  async function delBlob(id) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction('files', 'readwrite');
      tx.objectStore('files').delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------- 对外接口 ---------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* 上传文件:返回元数据对象 */
  async function add(file, category, source) {
    const id = uid();
    const metaItem = {
      id,
      name: file.name,
      type: file.type || '',
      size: file.size,
      category: category || '其他',
      source: source || '手动上传',
      time: Date.now()
    };
    await putBlob(id, file);
    const list = meta();
    list.push(metaItem);
    saveMeta(list);
    return metaItem;
  }

  /* 打开文件(生成临时 URL,使用后应 revoke) */
  async function openURL(id) {
    const blob = await getBlob(id);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }

  /* 下载文件 */
  async function download(id) {
    const m = meta().find(x => x.id === id);
    if (!m) return;
    const url = await openURL(id);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = m.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* 删除:默认进回收站(软删除),permanent=true 时彻底删除 */
  async function remove(id, permanent) {
    if (permanent) {
      const list = meta().filter(x => x.id !== id);
      saveMeta(list);
      await delBlob(id);
      return;
    }
    update(id, { trashed: true, trashedAt: Date.now() });
  }

  /* 从回收站恢复 */
  function restore(id) {
    update(id, { trashed: false, trashedAt: null });
  }

  /* 从回收站彻底删除 */
  async function purge(id) {
    const list = meta().filter(x => x.id !== id);
    saveMeta(list);
    await delBlob(id);
  }

  /* 未删除文件 / 回收站文件 */
  const active = () => meta().filter(f => !f.trashed);
  const trashed = () => meta().filter(f => f.trashed);

  /* 更新元数据(重命名/移动分类) */
  function update(id, fields) {
    const list = meta();
    const m = list.find(x => x.id === id);
    if (m) { Object.assign(m, fields); saveMeta(list); }
  }

  /* 统计 */
  function stats() {
    const list = meta();
    const total = list.reduce((a, m) => a + (m.size || 0), 0);
    const byCat = {};
    CATEGORIES.forEach(c => { byCat[c] = 0; });
    list.forEach(m => { byCat[m.category] = (byCat[m.category] || 0) + (m.size || 0); });
    return { count: list.length, total, byCat };
  }

  return {
    CATEGORIES,
    meta,
    active,
    trashed,
    add,
    openURL,
    download,
    remove,
    restore,
    purge,
    update,
    stats,
    uid
  };
})();

// 暴露到 window,供各模块通过 window.FileStore 访问
window.FileStore = FileStore;
