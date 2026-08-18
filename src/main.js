'use strict';
/**
 * DeepSeek Harness Desktop — Electron 主进程
 *
 * 职责：
 *  - 单实例锁，避免重复启动
 *  - 自动拉起 dsh web 服务（优先内置 node_modules 中的 dsh，回退系统 PATH）
 *  - 轮询端口就绪后创建原生窗口加载界面
 *  - 托盘常驻：关闭窗口最小化到托盘，退出时优雅停止 dsh 服务
 */
const { app, BrowserWindow, Tray, Menu, Notification, dialog, shell, nativeImage } = require('electron');
const net = require('node:net');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');

const APP_NAME = 'DeepSeek Harness Desktop';
const APP_ID = 'com.deepseekai.dsh.desktop';
const READY_TIMEOUT_MS = 120_000; // dsh 首次启动加载插件较慢，给足时间
const POLL_INTERVAL_MS = 400;

let win = null;
let tray = null;
let dshProcess = null; // { child, mode }
let isQuitting = false;
let bootPort = 0;
let trayNoticeShown = false;

/* ---------------------------------------------------------------- 单实例 */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  app.whenReady().then(main);
}

app.on('window-all-closed', () => {
  // 托盘常驻：不因窗口全关而退出（除非正在退出流程）
  if (isQuitting) app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  stopDsh();
});

/* ---------------------------------------------------------------- 日志 */
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'desktop.log'), line);
  } catch {
    /* 忽略日志写入失败 */
  }
  console.log(line.trimEnd());
}

/* ---------------------------------------------------------------- 工具 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForReady(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode) return resolve(true);
        schedule();
      });
      req.on('error', schedule);
      req.on('timeout', () => req.destroy());
      function schedule() {
        if (Date.now() > deadline) return resolve(false);
        setTimeout(attempt, POLL_INTERVAL_MS);
      }
    };
    attempt();
  });
}

function iconPath() {
  const unpackedRoot = path.join(process.resourcesPath, 'app.asar.unpacked');
  const candidates = [
    path.join(unpackedRoot, 'build', 'icon.ico'),
    path.join(app.getAppPath(), 'build', 'icon.ico'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/* ---------------------------------------------------------------- dsh 服务 */
function resolveDshEntry() {
  // 打包版：优先 app.asar.unpacked 真实路径（ESM 解析需要真实文件路径）
  const unpackedRoot = path.join(process.resourcesPath, 'app.asar.unpacked');
  const candidates = [
    path.join(unpackedRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    path.join(app.getAppPath(), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function startDsh(port) {
  const binJs = resolveDshEntry();
  const args = ['web', '--port', String(port), '--host', '127.0.0.1'];
  let child;
  let mode;

  if (binJs) {
    // 内置 dsh：以 Node 模式运行 Electron 可执行文件，避免依赖系统 dsh
    child = spawn(process.execPath, [binJs, ...args], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    mode = 'builtin';
  } else {
    child = spawn('dsh', args, {
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    mode = 'system';
  }

  const logDir = path.join(app.getPath('userData'), 'logs');
  const out = fs.createWriteStream(path.join(logDir, 'dsh.out.log'), { flags: 'a' });
  const err = fs.createWriteStream(path.join(logDir, 'dsh.err.log'), { flags: 'a' });
  child.stdout?.pipe(out);
  child.stderr?.pipe(err);

  log(`dsh 服务已启动 mode=${mode} pid=${child.pid} port=${port}`);
  child.on('error', (e) => log('dsh spawn error:', e.message));
  child.on('exit', (code, signal) => {
    log(`dsh 服务退出 code=${code} signal=${signal}`);
    if (!isQuitting) {
      dialog
        .showMessageBox({
          type: 'error',
          title: APP_NAME,
          message: 'DeepSeek Harness 服务意外停止',
          detail: `服务进程已退出（code=${code}）。应用将关闭，请重新启动。`,
        })
        .then(() => app.quit());
    }
  });

  dshProcess = { child, mode };
  return dshProcess;
}

function stopDsh() {
  if (!dshProcess) return;
  const { child } = dshProcess;
  dshProcess = null;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  log(`正在停止 dsh 服务 pid=${child.pid}`);
  // Windows 下递归结束进程树，确保插件子进程一并清理
  execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], (e) => {
    if (e) log('taskkill 提示:', e.message);
  });
  const timer = setTimeout(() => {
    try { child.kill('SIGKILL'); } catch { /* 已退出 */ }
  }, 3000);
  timer.unref();
}

/* ---------------------------------------------------------------- 窗口 */
function createWindow() {
  const icon = iconPath();
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: APP_NAME,
    backgroundColor: '#0b1220',
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(`http://127.0.0.1:${bootPort}`);
  win.once('ready-to-show', () => win.show());

  // 外部链接交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:${bootPort}`)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (isQuitting) return;
    log(`页面加载失败 code=${code} desc=${desc} url=${url}`);
    win.webContents
      .executeJavaScript(
        `document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#94a3b8;background:#0b1220;flex-direction:column;gap:12px"><h2 style="color:#e2e8f0">服务尚未就绪</h2><p>加载失败（${code}: ${desc}）。请稍候或检查 dsh 服务日志。</p><button onclick="location.reload()" style="padding:8px 18px;border-radius:8px;border:none;background:#3b82f6;color:#fff;cursor:pointer">重试</button></div>'`
      )
      .catch(() => {});
  });

  // 关闭窗口 → 最小化到托盘（应用常驻，dsh 服务不中断）
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
      notifyTrayOnce();
    }
  });
  win.on('closed', () => { win = null; });

  Menu.setApplicationMenu(buildMenu());
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function notifyTrayOnce() {
  if (trayNoticeShown) return;
  trayNoticeShown = true;
  if (Notification.isSupported()) {
    new Notification({
      title: APP_NAME,
      body: '应用已最小化到系统托盘，服务仍在运行。点击托盘图标恢复窗口。',
    }).show();
  }
}

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '在浏览器中打开', click: () => shell.openExternal(`http://127.0.0.1:${bootPort}`) },
        { type: 'separator' },
        { label: '退出', accelerator: 'Ctrl+Q', click: () => { isQuitting = true; app.quit(); } },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'Ctrl+R', click: () => win?.webContents.reload() },
        { label: '开发者工具', accelerator: 'F12', click: () => win?.webContents.toggleDevTools() },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: `关于 ${APP_NAME}`, click: () => app.showAboutPanel() },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

/* ---------------------------------------------------------------- 托盘 */
function createTray() {
  const unpackedRoot = path.join(process.resourcesPath, 'app.asar.unpacked');
  const candidates = [
    path.join(unpackedRoot, 'build', 'tray.png'),
    path.join(app.getAppPath(), 'build', 'tray.png'),
    iconPath(),
  ].filter(Boolean);
  const found = candidates.find((p) => p && fs.existsSync(p));
  const img = found ? nativeImage.createFromPath(found) : nativeImage.createEmpty();
  tray = new Tray(img.isEmpty() ? nativeImage.createFromDataURL(DEFAULT_TRAY_PNG) : img);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主窗口', click: showWindow },
      { type: 'separator' },
      { label: '退出', click: () => { isQuitting = true; app.quit(); } },
    ])
  );
  tray.on('click', showWindow);
  log('托盘已创建');
}

/* ---------------------------------------------------------------- 启动 */
async function main() {
  app.setAppUserModelId(APP_ID);
  app.setName(APP_NAME);
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    copyright: 'DeepSeek Harness Desktop',
  });

  try {
    bootPort = await findFreePort();
  } catch (e) {
    dialog.showErrorBox(APP_NAME, `无法分配本地端口：${e.message}`);
    app.quit();
    return;
  }

  startDsh(bootPort);
  log(`等待服务就绪 http://127.0.0.1:${bootPort} ...`);

  const ready = await waitForReady(bootPort, READY_TIMEOUT_MS);
  if (!ready) {
    dialog.showErrorBox(
      APP_NAME,
      'DeepSeek Harness 服务启动超时。请查看日志：\n' + path.join(app.getPath('userData'), 'logs', 'dsh.err.log')
    );
    isQuitting = true;
    app.quit();
    return;
  }

  log('服务就绪，创建窗口');
  createWindow();
  createTray();
}

/* 兜底托盘图标（16x16 PNG，深蓝圆点，由 scripts/make-icon.js 生成的正式版会覆盖） */
const DEFAULT_TRAY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAHxJREFUOE+Nk0EOwCAIA/3/H90hBq2b2Z5MMKgw5lbZpvUyZns4mN3mbo5nqzxD14MZwI0Z8CJ1P7tqA+hcD4Bfubv+wAtAhXlBf2ICgBHZ/TD3wKymH/ABE6AHrAF7QJ1sA/q2AX2xAVzbAphfA+zgN3wHXgCuOVMs2/KY2AAAAABJRU5ErkJggg==';
