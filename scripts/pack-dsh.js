#!/usr/bin/env node
'use strict';
/**
 * dsh 构建产物打包脚本
 *
 * 用法：
 *   node scripts/pack-dsh.js <dsh源目录> <输出目录> <版本号>
 *
 * 示例：
 *   node scripts/pack-dsh.js "E:/DeepSeek/dist/win-unpacked/resources/app.asar.unpacked/node_modules/@deepseek-ai" ./dsh-out 0.1.0-rc.7
 *
 * 产出：
 *   <输出目录>/dsh-build-<版本>.tar.gz   — 解压后顶层为 @deepseek-ai/
 *   <输出目录>/dsh-manifest.json          — 可直接上传到 GitHub Release
 *
 * 然后用 gh CLI 上传到 dsh-updates Release：
 *   gh release upload dsh-updates dsh-out/dsh-build-*.tar.gz dsh-out/dsh-manifest.json --clobber
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const GITHUB_BASE =
  'https://github.com/wplleo/deepseek-harness-desktop/releases/download/dsh-updates';

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function main() {
  const [srcDir, outDir, version] = process.argv.slice(2);

  if (!srcDir || !outDir || !version) {
    console.error('用法: node scripts/pack-dsh.js <dsh源目录(@deepseek-ai)> <输出目录> <版本号>');
    console.error('示例: node scripts/pack-dsh.js "E:/DeepSeek/.../node_modules/@deepseek-ai" ./dsh-out 0.1.0-rc.7');
    process.exit(1);
  }

  if (!fs.existsSync(srcDir)) {
    console.error(`源目录不存在: ${srcDir}`);
    process.exit(1);
  }

  // 确认源目录是 @deepseek-ai（包含 dsh 子目录）
  const dshPkg = path.join(srcDir, 'dsh', 'package.json');
  if (!fs.existsSync(dshPkg)) {
    console.error(`源目录下未找到 dsh/package.json，请确认路径指向 @deepseek-ai 目录`);
    process.exit(1);
  }

  // 读 dsh 版本确认
  const pkg = JSON.parse(fs.readFileSync(dshPkg, 'utf8'));
  console.log(`源 dsh 版本: ${pkg.version}`);

  fs.mkdirSync(outDir, { recursive: true });

  // 打包 tar.gz
  // tar 顶层为 @deepseek-ai/，解压到 node_modules/ 即可
  const archiveName = `dsh-build-${version}.tar.gz`;
  const archivePath = path.resolve(outDir, archiveName);

  // 先切到 srcDir 的父目录（node_modules/），这样 tar 里的路径是 @deepseek-ai/...
  const parentDir = path.dirname(srcDir);
  const dirName = path.basename(srcDir); // @deepseek-ai

  console.log(`打包: tar -czf ${archiveName} -C ${parentDir} ${dirName}`);
  try {
    // cwd 设为输出目录 + 纯文件名，规避 GNU tar 把 "E:" 当远程主机的问题
    execFileSync('tar', ['--force-local', '-czf', archiveName, '-C', parentDir, dirName], {
      stdio: 'inherit',
      cwd: outDir,
    });
  } catch (e) {
    console.error('tar 打包失败:', e.message);
    process.exit(1);
  }

  // 计算 sha256
  const checksum = sha256File(archivePath);
  console.log(`sha256: ${checksum}`);

  // 生成 manifest
  const manifest = {
    dshVersion: version,
    downloadUrl: `${GITHUB_BASE}/${archiveName}`,
    checksum,
    releaseNotes: `dsh ${version}`,
    publishedAt: new Date().toISOString(),
  };

  const manifestPath = path.resolve(outDir, 'dsh-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log('');
  console.log('=== 打包完成 ===');
  console.log(`tar.gz:    ${archivePath}`);
  console.log(`manifest:  ${manifestPath}`);
  console.log('');
  console.log('上传到 GitHub Release:');
  console.log(`  gh release upload dsh-updates "${archivePath}" "${manifestPath}" --clobber --repo wplleo/deepseek-harness-desktop`);
}

main();
