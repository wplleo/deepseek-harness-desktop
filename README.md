# DeepSeek Harness Desktop

把 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai) 的 Web GUI 封装为 Windows 桌面应用的安装包。

## 简介

本项目使用 Electron + electron-builder 将 dsh 的网页界面打包成原生 Windows 程序（NSIS 安装包），让你像用普通桌面软件一样使用 DeepSeek Harness，无需自己起服务、开浏览器。

## 特性

- 一键安装，自动创建桌面快捷方式与开始菜单入口
- 原生窗口加载本地 dsh 服务（随机端口，绑定 127.0.0.1）
- 托盘常驻，关闭窗口不会退出后台服务
- 自带深蓝圆角方块 + 白鲸鱼图标
- **外壳自动更新**（electron-updater）：新版安装包发布后自动下载提示安装
- **dsh 引擎独立自动更新**（v1.2.0+）：内置 dsh 引擎可独立于安装包升级，后台自动下载替换，无需重装

## 下载

前往 [Releases](https://github.com/wplleo/deepseek-harness-desktop/releases) 下载最新安装包 `DeepSeek.Harness.Desktop.Setup.x.x.x.exe`，双击安装即可。

## 技术栈

- Electron 37
- electron-builder 24（NSIS 目标）
- Node 22

## 目录结构

- `src/main.js`：Electron 主进程，拉起 dsh 服务并加载原生窗口
- `src/dsh-update.js`：dsh 引擎独立自更新模块（manifest 比对 / 下载 / 校验 / 备份回滚）
- `scripts/pack-dsh.js`：dsh 构建产物打包脚本（产出 tar.gz + manifest，用于发布 dsh 更新）
- `electron-builder.yml`：打包配置（含 NSIS 自定义安装宏）
- `build/`：图标与构建脚本

## 发布 dsh 引擎更新

dsh 引擎更新走独立的 Release 频道（tag: `dsh-updates`），与外壳版本互不干扰：

```bash
# 1. 打包新 dsh（源目录指向含 @deepseek-ai 的 node_modules）
node scripts/pack-dsh.js <含 @deepseek-ai 的目录> ./dsh-out <版本号>

# 2. 上传到 dsh-updates Release
gh release upload dsh-updates dsh-out/dsh-build-*.tar.gz dsh-out/dsh-manifest.json --clobber
```

上传后，所有运行 v1.2.0+ 的桌面端会在下次检查时自动下载并替换 dsh 引擎（默认每 6 小时检查一次）。

## 说明

dsh 的运行依赖（`@deepseek-ai/dsh` 全家桶）未在本仓库的 `package.json` 中声明，打包阶段会从预构建目录复制进 `node_modules` 后一并打入安装包。
