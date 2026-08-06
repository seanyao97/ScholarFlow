'use strict';

/**
 * ai.js — AI 助手(独立模块)
 * 数据存 localStorage 独立 key(rws_ai_chats),不混入主数据;模块完全自包含。
 * 架构:前端 → 本地后端 server.py → Reasonix → DeepSeek-V4-Flash
 * 后端地址:http://localhost:8765(可用 AI_API_BASE 覆盖)
 */
const AIHelper = (() => {
  const KEY = 'rws_ai_chats';
  const CFG_KEY = 'rws_ai_config';
  const DEFAULT_MODEL = 'deepseek-chat';
  const DEFAULT_BASE = 'https://api.deepseek.com/v1';
  const QUICK = [
    { name: '文献总结', desc: '总结论文背景/问题/方法/结果/创新点/不足', prompt: '请帮我总结这篇论文：\n1.研究背景\n2.研究问题\n3.研究方法\n4.主要结果\n5.创新点\n6.不足' },
    { name: '论文润色', desc: '改为 SCI 论文表达方式', prompt: '请将下面内容修改为SCI论文表达方式，保持科学含义不变，提高逻辑性和专业性。' },
    { name: '实验方案分析', desc: '分析实验目的/变量/对照/问题/建议', prompt: '请作为科研导师，分析该实验方案：\n包括：实验目的、变量设计、对照组、可能问题、优化建议' },
    { name: '研究思路拓展', desc: '提出研究假设、创新点与下一步', prompt: '根据我的研究方向，帮助提出可能的研究假设、创新点和下一步实验方向。' },
    { name: '科研总结', desc: '提取关键问题、结论与建议', prompt: '请总结以上内容：提取关键问题、主要结论、下一步建议' }
  ];

  let chats = [];
  let currentId = null;
  let pendingFile = null;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function load() {
    try { chats = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { chats = []; }
    if (!Array.isArray(chats)) chats = [];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(chats)); } catch (e) { /* 忽略 */ }
  }
  function current() { return chats.find(c => c.id === currentId) || null; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmtDay(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return '今天 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /* ---------- DeepSeek 直连配置 ---------- */
  function getCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveCfg(c) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) { /* 忽略 */ }
  }
  function modelName() { const c = getCfg(); return c.model || DEFAULT_MODEL; }
  function baseUrl() { const c = getCfg(); return c.baseUrl || DEFAULT_BASE; }
  function apiKey() { const c = getCfg(); return c.key || ''; }

  /* ---------- 左:会话列表 ---------- */
  function renderChats(kw) {
    const box = document.getElementById('aiChats');
    box.innerHTML = '';
    let list = chats.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
    if (kw) {
      const k = kw.toLowerCase();
      list = list.filter(c => (c.title || '').toLowerCase().includes(k));
    }
    if (!list.length) {
      box.innerHTML = '<div class="ai-chat-empty">暂无对话,点击“新建对话”开始</div>';
      return;
    }
    list.forEach(c => {
      const item = document.createElement('div');
      item.className = 'ai-chat-item' + (c.id === currentId ? ' active' : '');
      const t = c.title || '新对话';
      item.innerHTML = `
        <div class="t">${escapeHtml(t)}<i class="ai-chat-del" title="删除对话">×</i></div>
        <div class="d"><span>${fmtDay(c.updated || c.created || Date.now())}</span><span>${(c.messages || []).length} 条</span></div>`;
      item.querySelector('.t').addEventListener('click', () => {
        currentId = c.id;
        renderChats(document.getElementById('aiSearch').value);
        renderMsgs();
      });
      item.querySelector('.ai-chat-del').addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(`删除对话「${t}」？`)) {
          chats = chats.filter(x => x.id !== c.id);
          if (currentId === c.id) { currentId = chats.length ? chats[0].id : null; }
          save();
          renderChats(document.getElementById('aiSearch').value);
          renderMsgs();
        }
      });
      box.appendChild(item);
    });
  }

  function newChat() {
    const c = { id: uid(), title: '新对话', created: Date.now(), updated: Date.now(), messages: [] };
    chats.push(c);
    currentId = c.id;
    save();
    renderChats('');
    renderMsgs();
  }

  /* ---------- 中:消息 ---------- */
  function renderMsgs() {
    const box = document.getElementById('aiMsgs');
    const c = current();
    box.innerHTML = '';
    if (!c) {
      box.innerHTML = '<div class="ai-chat-empty" style="padding:40px 0">新建对话,开始科研交流</div>';
      return;
    }
    if (!c.messages.length) {
      box.innerHTML = '<div class="ai-chat-empty" style="padding:40px 0">向 AI 助手提出你的科研问题…</div>';
      return;
    }
    c.messages.forEach(m => {
      const row = document.createElement('div');
      row.className = 'ai-msg ' + m.role;
      row.innerHTML = `<div class="bubble">${escapeHtml(m.content)}</div><span class="time">${m.time || ''}</span>`;
      box.appendChild(row);
    });
    box.scrollTop = box.scrollHeight;
  }

  function appendMsg(role, content) {
    const c = current();
    if (!c) return;
    c.messages.push({ role, content, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
    if (c.title === '新对话' && role === 'user') {
      c.title = content.slice(0, 20) + (content.length > 20 ? '…' : '');
    }
    c.updated = Date.now();
    save();
    renderMsgs();
    renderChats(document.getElementById('aiSearch').value);
  }

  /* ---------- 发送(直连 DeepSeek) ---------- */
  async function sendRaw(text) {
    const c = current();
    if (!c) return;
    const typing = document.createElement('div');
    typing.className = 'ai-typing';
    typing.textContent = 'AI 思考中';
    document.getElementById('aiMsgs').appendChild(typing);
    document.getElementById('aiMsgs').scrollTop = document.getElementById('aiMsgs').scrollHeight;
    const history = (c.messages || []).slice(0, -1).map(m => ({ role: m.role, content: m.content }));
    const key = apiKey();
    if (!key) {
      typing.remove();
      appendMsg('ai', '⚠️ 尚未配置 DeepSeek API Key,请点击右上角“API 设置”填写后再试。');
      return;
    }
    const cfg = getCfg();
    const messages = [];
    if (cfg.system) messages.push({ role: 'system', content: cfg.system });
    messages.push(...history, { role: 'user', content: text });
    try {
      const resp = await fetch(baseUrl() + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model: modelName(),
          messages,
          stream: false
        })
      });
      if (!resp.ok) {
        const err = await resp.text().catch(() => '');
        typing.remove();
        appendMsg('ai', `⚠️ 请求失败(${resp.status}):${err.slice(0, 200)}。若提示跨域(CORS)限制,可在本地用 server.py 代理方式调用。`);
        return;
      }
      const data = await resp.json();
      typing.remove();
      const answer = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      appendMsg('ai', answer || '（无回复）');
    } catch (e) {
      typing.remove();
      appendMsg('ai', '⚠️ 无法连接 DeepSeek：' + e.message + '。请检查网络或 API 地址;若为跨域限制,请使用 server.py 代理。');
    }
  }

  async function send(text) {
    if (!text || !current()) return;
    appendMsg('user', text);
    sendRaw(text);
  }

  async function sendFile(file) {
    if (!file || !current()) return;
    appendMsg('user', `📎 上传文件：${file.name}`);
    let content = '';
    try {
      if (/\.(txt|md|csv)$/i.test(file.name)) {
        content = await file.text();
      } else if (/\.pdf$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        content = extractPdfText(buf);
      } else {
        content = `（${file.name} 为 ${file.type || '文件'},已作为上下文参考）`;
      }
    } catch (e) {
      content = '（文件读取失败:' + e.message + '）';
    }
    sendRaw('请分析我上传的文件内容：\n' + content);
  }

  /* PDF 简易文本提取(纯前端,无依赖,适合文本型 PDF) */
  function extractPdfText(buf) {
    try {
      const dec = new TextDecoder('latin1');
      let t = dec.decode(buf);
      t = t.replace(/\(([^)]*)\)/g, '$1');
      t = t.replace(/[^\x20-\x7E\u4e00-\u9fff\n\r]/g, ' ');
      t = t.replace(/\s+/g, ' ').slice(0, 8000);
      return t.trim() || '（PDF 文本提取为空,请手动粘贴关键内容）';
    } catch (e) {
      return '（PDF 解析失败,请手动粘贴关键内容）';
    }
  }

  /* ---------- 状态 / API 设置 ---------- */
  function checkStatus() {
    const el = document.getElementById('aiStatus');
    if (!el) return;
    if (apiKey()) {
      el.textContent = '● 已配置';
      el.className = 'ai-chat-status online';
    } else {
      el.textContent = '○ 未配置密钥';
      el.className = 'ai-chat-status offline';
    }
  }

  function openConfig() {
    const cfg = getCfg();
    const pre = Store.settings().preferences;
    const defaultSys = `你是嵌入 ScholarFlow 的 AI 科研助手。研究领域:${(pre.fields || []).join('、') || '未设置'};主要科研类型:${(pre.types || []).join('、') || '未设置'}。请专业、简洁地解答科研问题。`;
    window.EditModalOpen('API 设置（直连 DeepSeek）', `
      <form class="edit-form">
        <div class="edit-field"><label>API Key</label><input type="password" name="key" value="${escapeHtml(cfg.key || '')}" placeholder="sk-…"></div>
        <div class="edit-field"><label>模型</label><input name="model" value="${escapeHtml(cfg.model || DEFAULT_MODEL)}" placeholder="deepseek-chat"></div>
        <div class="edit-field"><label>Base URL</label><input name="base" value="${escapeHtml(cfg.baseUrl || DEFAULT_BASE)}" placeholder="https://api.deepseek.com/v1"></div>
        <div class="edit-field"><label>系统提示词(默认根据科研偏好生成)</label><textarea name="system" rows="2">${escapeHtml(cfg.system || defaultSys)}</textarea></div>
        <div class="edit-actions">
          <button type="button" class="btn-ghost" onclick="EditModalClose()">取消</button>
          <button type="submit" class="btn-primary">保存</button>
        </div>
      </form>`, v => {
      saveCfg({ key: v.key.trim(), model: v.model.trim() || DEFAULT_MODEL, baseUrl: v.base.trim() || DEFAULT_BASE, system: v.system });
      checkStatus();
      renderQuick();
    });
  }

  /* ---------- 快捷助手 ---------- */
  function renderQuick() {
    const box = document.getElementById('aiQuick');
    box.innerHTML = '';
    QUICK.forEach(q => {
      const card = document.createElement('div');
      card.className = 'ai-quick-card';
      card.innerHTML = `<div class="n">${q.name}</div><div class="d">${q.desc}</div>`;
      card.addEventListener('click', () => {
        const input = document.getElementById('aiInput');
        input.value = q.prompt + '\n\n';
        input.focus();
      });
      box.appendChild(card);
    });
  }

  /* ---------- 设置页注入(AI 模块自提供,settings.js 仅加分类入口) ---------- */
  function renderSettingsInto(box) {
    box.innerHTML = `
      <div class="set-card">
        <div class="set-card-title">AI 模型设置</div>
        <div class="set-switch-row"><span class="set-switch-label">当前模型</span><b style="color:var(--blue)">${escapeHtml(modelName())}</b></div>
        <div class="set-switch-row"><span class="set-switch-label">接口</span><b>DeepSeek API（直连）</b></div>
        <div class="set-switch-row"><span class="set-switch-label">状态</span><b id="aiSetStatus">检测中…</b></div>
        <div class="set-switch-row"><span class="set-switch-label">最大输出</span><b>自动</b></div>
        <div class="set-hint">AI 助手直接调用 DeepSeek API。API Key 在 AI 助手模块右上角“API 设置”中配置(保存在本机浏览器,不上传)。</div>
      </div>`;
    const el = document.getElementById('aiSetStatus');
    if (el) el.textContent = apiKey() ? '已配置' : '未配置(请在 AI 助手模块设置)';
  }

  function init() {
    load();
    document.getElementById('aiNew').addEventListener('click', newChat);
    const cfgBtn = document.getElementById('aiConfigBtn');
    if (cfgBtn) cfgBtn.addEventListener('click', openConfig);
    document.getElementById('aiSearch').addEventListener('input', e => renderChats(e.target.value.trim()));
    document.getElementById('aiSend').addEventListener('click', () => {
      const input = document.getElementById('aiInput');
      const text = input.value.trim();
      if (text) { send(text); input.value = ''; }
    });
    document.getElementById('aiInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = e.target.value.trim();
        if (text) { send(text); e.target.value = ''; }
      }
    });
    document.getElementById('aiFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      pendingFile = f;
      document.getElementById('aiFileName').textContent = f.name;
      sendFile(f);
      e.target.value = '';
    });
    renderQuick();
    // 默认进入恢复最近会话
    if (!chats.length) newChat();
    else { currentId = chats[0].id; }
    checkStatus();
  }

  function renderAll() {
    load();
    if (!chats.length) { newChat(); }
    else if (!current()) currentId = chats[0].id;
    document.getElementById('aiSearch').value = '';
    const mn = document.getElementById('aiModelName');
    if (mn) mn.textContent = '模型：' + modelName();
    renderChats('');
    renderMsgs();
    renderQuick();
    checkStatus();
  }

  return { init, renderAll, renderSettingsInto };
})();
