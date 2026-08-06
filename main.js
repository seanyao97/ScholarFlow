// ScholarFlow 桌面版主进程
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isWin = process.platform === 'win32';

// 单实例:重复启动时聚焦已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

let aiProc = null;

// 启动本地 AI 助手后端(server.py,端口 8765)
// 未安装 Python 时 AI 助手自动离线,其余功能不受影响
function startAIServer() {
  const script = path.join(__dirname, 'web', 'server', 'server.py');
  const args = isWin ? ['python', [script]] : ['python3', [script]];
  let p;
  try {
    p = spawn(args[0], args[1], { cwd: path.dirname(script), windowsHide: true });
  } catch (e) {
    console.log('[ScholarFlow] AI 服务启动失败:', e.message);
    return;
  }
  aiProc = p;
  p.on('error', () => {
    aiProc = null;
    console.log('[ScholarFlow] 未检测到 Python,AI 助手离线(其余功能不受影响)');
  });
  p.on('exit', () => { aiProc = null; });
  p.stdout.on('data', d => console.log('[AI]', String(d).trim()));
  p.stderr.on('data', d => console.log('[AI]', String(d).trim()));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'ScholarFlow',
    autoHideMenuBar: true,
    backgroundColor: '#0f1522',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'web', 'index.html'));
  win.on('closed', () => { /* 窗口关闭即退出 */ });
}

app.whenReady().then(() => {
  startAIServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  if (aiProc) { try { aiProc.kill(); } catch (e) { /* 忽略 */ } }
});
