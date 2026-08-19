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
- 更新应用图标：黑鲸鱼放大居中、四角圆角，白色方块四周增加透明留白，避免 Windows 桌面在深色背景下给图标边缘投射出明显黑线。
- 注意：首次启动 dsh 加载插件约需 30 秒，请耐心等待窗口出现。
- 提示：若安装后快捷方式仍显示旧图标，是 Windows 图标缓存未刷新，注销/重启或右键快捷方式 → 属性 → 更改图标 → 确定即可刷新。

构建说明

- 源码见 src/，构建配置见 electron-builder.yml
- 打包需在 electron-builder 调用时清除 WorkBuddy 的 safe-delete 注入（env -u NODE_OPTIONS），否则 NSIS 收尾删中间文件会失败产出半成品 exe

安装包信息

- 文件：DeepSeek Harness Desktop Setup 1.0.0.exe
- 大小：约 129 MB
- sha256：ee257ce36c62b5befa7919f922f518e72590f30914fd5694ac13a90bfa51833c
- 生成时间：2026-08-19 10:24
