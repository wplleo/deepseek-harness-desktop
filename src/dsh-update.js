'use strict';
/**
 * dsh 独立自更新模块
 *
 * 从 GitHub Release (tag: dsh-updates) 拉取 dsh-manifest.json，
 * 比对本地 dsh 版本，若有新版则：
 *   下载 tar.gz → 校验 sha256 → 备份旧 @deepseek-ai → 解压替换 → 通知重启 dsh
 * 失败自动回滚备份。
 *
 * 依赖：系统 tar（Windows 10+ / Linux / macOS 均内置），零额外 npm 依赖。
 */
const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const crypto = require('node:crypto');

// 固定指向 dsh-updates tag 的 Release（pre-release，不干扰 electron-updater 的 latest）
// 可用环境变量 DSH_UPDATE_MANIFEST_URL 覆盖（测试用）
const MANIFEST_URL =
  process.env.DSH_UPDATE_MANIFEST_URL ||
  'https://github.com/wplleo/deepseek-harness-desktop/releases/download/dsh-updates/dsh-manifest.json';

/* ================================================================ HTTP 工具 */

/** 跟随 3xx 重定向获取 Response 流 */
function fetchWithRedirect(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(
      url,
      { headers: { 'User-Agent': 'dsh-desktop-updater', Accept: 'application/octet-stream, application/json, */*' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (maxRedirects <= 0) return reject(new Error('重定向次数过多'));
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          return resolve(fetchWithRedirect(next, maxRedirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        }
        resolve(res);
      }
    );
    req.on('error', reject);
    req.setTimeout(30_000, () => req.destroy(new Error('请求超时')));
  });
}

/** 下载 JSON */
async function fetchJson(url) {
  const res = await fetchWithRedirect(url);
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** 下载文件到磁盘，支持进度回调 */
async function downloadFile(url, destPath, onProgress) {
  const res = await fetchWithRedirect(url);
  const total = parseInt(res.headers['content-length'] || '0', 10);
  let received = 0;
  const file = fs.createWriteStream(destPath);
  return new Promise((resolve, reject) => {
    res.on('data', (chunk) => {
      received += chunk.length;
      if (onProgress && total > 0) onProgress(Math.round((received / total) * 100));
    });
    res.pipe(file);
    file.on('finish', () => file.close(resolve));
    file.on('error', (e) => {
      try { fs.unlinkSync(destPath); } catch {}
      reject(e);
    });
    res.on('error', (e) => {
      try { fs.unlinkSync(destPath); } catch {}
      reject(e);
    });
  });
}

/* ================================================================ 版本比较 */

/**
 * 简单 semver 比较（支持 pre-release 后缀）
 * @returns 1 if a>b, -1 if a<b, 0 if equal
 */
function compareVersions(a, b) {
  const parse = (v) => {
    const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)(?:-([.\w-]+))?$/);
    if (!m) return { major: 0, minor: 0, patch: 0, pre: 'zzz' };
    return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || '' };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
  // 有 pre-release 的版本低于无 pre-release 的
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  if (pa.pre && pb.pre) {
    // 按 semver 规范：逐段比较，数字段按数值比，否则按字典序
    const paIds = pa.pre.split('.');
    const pbIds = pb.pre.split('.');
    const n = Math.max(paIds.length, pbIds.length);
    for (let i = 0; i < n; i++) {
      const x = paIds[i];
      const y = pbIds[i];
      if (x === undefined) return -1; // 较短的前缀更小
      if (y === undefined) return 1;
      const xNum = /^\d+$/.test(x);
      const yNum = /^\d+$/.test(y);
      if (xNum && yNum) {
        const xn = parseInt(x, 10);
        const yn = parseInt(y, 10);
        if (xn !== yn) return xn > yn ? 1 : -1;
      } else {
        if (x !== y) return x > y ? 1 : -1;
      }
    }
  }
  return 0;
}

/* ================================================================ 路径解析 */

/** 获取 node_modules 目录路径（优先 unpacked） */
function getNodeModulesDir(resourcesPath, appPath) {
  const candidates = [
    path.join(resourcesPath, 'app.asar.unpacked', 'node_modules'),
    path.join(appPath, 'node_modules'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 获取 @deepseek-ai 目录路径 */
function getDshModulesDir(resourcesPath, appPath) {
  const nm = getNodeModulesDir(resourcesPath, appPath);
  if (!nm) return null;
  const p = path.join(nm, '@deepseek-ai');
  return fs.existsSync(p) ? p : null;
}

/** 获取本地 dsh 版本号 */
function getLocalDshVersion(resourcesPath, appPath) {
  const dir = getDshModulesDir(resourcesPath, appPath);
  if (!dir) return null;
  const pkgPath = path.join(dir, 'dsh', 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || null;
  } catch {
    return null;
  }
}

/* ================================================================ 解压 */

/** Windows 上优先用 System32 的 bsdtar（正确处理盘符路径），其他平台用 PATH 中的 tar */
function findTarBin() {
  if (process.platform === 'win32') {
    const sysTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    if (fs.existsSync(sysTar)) return sysTar;
  }
  return 'tar';
}

/** 解压 tar.gz（顶层为 node_modules/）到 targetDir（即 app 根目录） */
function extractTarGz(archivePath, targetDir) {
  return new Promise((resolve, reject) => {
    const tar = findTarBin();
    // cwd 设为压缩包所在目录 + 纯文件名，规避 GNU tar 把盘符当远程主机的问题
    execFile(
      tar,
      ['-xzf', path.basename(archivePath), '-C', targetDir],
      { cwd: path.dirname(archivePath) },
      (err, _stdout, stderr) => {
        if (err) return reject(new Error(`tar 解压失败: ${err.message} ${stderr}`));
        resolve();
      }
    );
  });
}

/* ================================================================ 校验 */

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/* ================================================================ 递归删除 */

function rmrf(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows 下可能因文件锁失败，尝试逐个删
    try {
      const entries = fs.readdirSync(dir);
      for (const e of entries) {
        try { fs.rmSync(path.join(dir, e), { recursive: true, force: true }); } catch {}
      }
      try { fs.rmdirSync(dir); } catch {}
    } catch {}
  }
}

/* ================================================================ 主入口 */

/**
 * 检查并应用 dsh 更新
 *
 * 阶段 1（dsh 运行中）：拉 manifest → 比对版本 → 下载 → 校验 checksum
 * 阶段 2（回调 onBeforeApply 停止 dsh 后）：备份 → 解压替换 → 验证，失败回滚
 * 阶段 3：回调 onApplied（成功）或 onRollback（回滚后），由调用方重启 dsh
 *
 * @param {object} options
 * @param {string} options.resourcesPath - process.resourcesPath
 * @param {string} options.appPath - app.getAppPath()
 * @param {function} options.log - 日志函数
 * @param {object} [callbacks]
 * @param {function} [callbacks.onBeforeApply] - 替换文件前调用（应停止 dsh 并等待退出）
 * @param {function} [callbacks.onApplied] - 更新成功（应重启 dsh）
 * @param {function} [callbacks.onRollback] - 更新失败已回滚（应重启 dsh 用旧版）
 * @returns {Promise<{updated: boolean, version?: string, reason?: string, error?: string}>}
 */
async function checkAndApplyDshUpdate(options, callbacks = {}) {
  const { resourcesPath, appPath, log = console.log } = options;
  const { onChecking, onUpdateAvailable, onProgress, onBeforeApply, onApplied, onRollback, onUpToDate, onError } = callbacks;
  let dshStopped = false; // onBeforeApply 是否已执行（决定失败时是否要重启 dsh）

  try {
    onChecking?.();
    log('正在检查 dsh 更新…');

    // 1. 拉取 manifest
    let manifest;
    try {
      manifest = await fetchJson(MANIFEST_URL);
    } catch (e) {
      log('无法获取 manifest（离线或 GitHub 不可达）:', e.message);
      onUpToDate?.();
      return { updated: false, reason: 'network' };
    }

    if (!manifest || !manifest.dshVersion || !manifest.downloadUrl) {
      log('manifest 格式无效:', JSON.stringify(manifest).slice(0, 200));
      onUpToDate?.();
      return { updated: false, reason: 'invalid-manifest' };
    }

    // 2. 比对版本
    const localVersion = getLocalDshVersion(resourcesPath, appPath);
    const remoteVersion = manifest.dshVersion;
    log(`本地 dsh=${localVersion || '未知'}, 远程 dsh=${remoteVersion}`);

    if (localVersion && compareVersions(remoteVersion, localVersion) <= 0) {
      log('dsh 已是最新');
      onUpToDate?.();
      return { updated: false, reason: 'up-to-date' };
    }

    // 3. 发现更新
    onUpdateAvailable?.(remoteVersion);
    log(`发现 dsh 新版本 ${remoteVersion}`);

    // 4. 下载
    const tmpDir = path.join(os.tmpdir(), 'dsh-update');
    fs.mkdirSync(tmpDir, { recursive: true });
    const archivePath = path.join(tmpDir, `dsh-build-${remoteVersion}.tar.gz`);

    onProgress?.(0);
    log(`下载 ${manifest.downloadUrl}`);
    await downloadFile(manifest.downloadUrl, archivePath, (p) => {
      onProgress?.(p);
      if (p % 20 === 0) log(`下载进度 ${p}%`);
    });
    onProgress?.(100);

    // 5. 校验 checksum
    if (manifest.checksum) {
      const actual = sha256File(archivePath);
      if (actual !== manifest.checksum) {
        throw new Error(`checksum 不匹配: 期望 ${manifest.checksum}, 实际 ${actual}`);
      }
      log('checksum 校验通过');
    } else {
      log('manifest 未提供 checksum，跳过校验');
    }

    // 6. 定位目标目录
    const nodeModulesDir = getNodeModulesDir(resourcesPath, appPath);
    if (!nodeModulesDir) {
      throw new Error('找不到 node_modules 目录，无法更新');
    }
    const appRoot = path.dirname(nodeModulesDir); // resources/app/
    const dshDir = path.join(nodeModulesDir, '@deepseek-ai');

    // 7. 停止 dsh（文件被进程锁定时 Windows 无法替换）
    log('准备替换文件，先停止 dsh 服务…');
    try {
      await onBeforeApply?.();
    } catch (e) {
      log('onBeforeApply 回调出错（继续尝试替换）:', e.message);
    }
    dshStopped = true;
    // 等待文件句柄释放
    await new Promise((r) => setTimeout(r, 2000));

    // 8. 备份（rename @deepseek-ai 目录）
    const backupDir = dshDir + '.backup';
    if (fs.existsSync(backupDir)) rmrf(backupDir);
    if (fs.existsSync(dshDir)) {
      fs.renameSync(dshDir, backupDir);
      log(`已备份 @deepseek-ai → ${backupDir}`);
    }

    // 9. 解压（tar.gz 顶层为 node_modules/，解压到 appRoot 合并覆盖）
    try {
      await extractTarGz(archivePath, appRoot);
      // 确认解压出了 @deepseek-ai/dsh
      if (!fs.existsSync(path.join(dshDir, 'dsh', 'package.json'))) {
        throw new Error('解压后未找到 @deepseek-ai/dsh');
      }
      log('解压完成');
    } catch (e) {
      // 回滚
      log('解压失败，正在回滚…', e.message);
      if (fs.existsSync(dshDir)) rmrf(dshDir);
      if (fs.existsSync(backupDir)) fs.renameSync(backupDir, dshDir);
      onRollback?.(e.message);
      throw e;
    }

    // 10. 验证新 dsh 可读
    const newVersion = getLocalDshVersion(resourcesPath, appPath);
    if (!newVersion) {
      log('解压后无法读取 dsh 版本，回滚…');
      rmrf(dshDir);
      if (fs.existsSync(backupDir)) fs.renameSync(backupDir, dshDir);
      onRollback?.('解压后 dsh 版本不可读，已回滚');
      throw new Error('解压后 dsh 版本不可读');
    }
    log(`新 dsh 版本确认: ${newVersion}`);

    // 11. 清理备份和临时文件
    if (fs.existsSync(backupDir)) rmrf(backupDir);
    try { fs.unlinkSync(archivePath); } catch {}

    // 12. 完成
    log(`dsh 已更新到 ${newVersion}`);
    onApplied?.(newVersion);
    return { updated: true, version: newVersion };

  } catch (e) {
    log('dsh 更新错误:', e.message);
    // 若 dsh 已被停止且未被上述回滚路径重启过，通知调用方重启（用旧版本）
    if (dshStopped) {
      try { onRollback?.(e.message); } catch {}
    }
    onError?.(e.message);
    return { updated: false, reason: 'error', error: e.message };
  }
}

module.exports = {
  checkAndApplyDshUpdate,
  compareVersions,
  getLocalDshVersion,
  getNodeModulesDir,
  getDshModulesDir,
  MANIFEST_URL,
};
