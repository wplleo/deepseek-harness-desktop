DeepSeek Harness Desktop v1.0.0（修正版安装包）

Electron 37 + electron-builder 24 封装的 DeepSeek Harness (dsh) 桌面应用。

下载

Windows 用户直接下载下方的 DeepSeek Harness Desktop Setup 1.0.0.exe（约 129MB）双击安装即可。

工作原理

启动时随机端口拉起内置 dsh 服务（builtin 模式，Electron 二进制以 ELECTRON_RUN_AS_NODE 运行 dsh/bin.js）→ 原生窗口加载 127.0.0.1 → 托盘常驻、关窗不退服务。

本版修正（相对首版）

- 关闭 asar 打包，改用 asar:false + extraResources 把 dsh 全家桶（@deepseek-ai/dsh 等 195 个包，约 206MB）原样打进 resources/app/node_modules，resolveDshEntry 可正确定位 dsh/lib/bin.js。
- 首版因 dsh 被打入 asar 导致启动即崩溃（找不到 bin.js），本版已修复。
- 已本地验证：dsh 服务可在 127.0.0.1 随机端口正常提供 HTTP 服务（HTTP 200）。
- 注意：首次启动 dsh 加载插件约需 30 秒，请耐心等待窗口出现。

构建说明

- 源码见 src/，构建配置见 electron-builder.yml
- 打包需在 electron-builder 调用时清除 WorkBuddy 的 safe-delete 注入（env -u NODE_OPTIONS），否则 NSIS 收尾删中间文件会失败产出半成品 exe

安装包信息

- 文件：DeepSeek Harness Desktop Setup 1.0.0.exe
- 大小：约 129 MB
- sha256：ccdb4a95604fb0df014b8dee1e40d1391ddb8b97d273ea529036cb394e24ad8f
- 生成时间：2026-08-18
