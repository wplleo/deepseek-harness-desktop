# v1.4.1 — 修复自动更新失败（builder-util-runtime 依赖错配）

## 修复的问题

v1.4.0 及更早版本的自动更新**能检测到新版本、能下载完安装包，但在最后一步崩溃**：

```
[updater] Found version 1.4.0 (url: DeepSeek-Harness-Desktop-Setup-1.4.0.exe)
发现新版本 1.4.0
更新下载进度 100%
[updater:error] Error: TypeError: (0, builder_util_runtime_1.retry) is not a function
    at NsisUpdater.executeDownload (.../electron-updater/out/AppUpdater.js:620)
自动更新出错
```

**根因**：`electron-updater@6.8.9` 写死依赖 `builder-util-runtime@9.7.0`（`retry` 函数在其中才存在），
但 `package.json` 用的是 caret 范围 `^6.3.9` 加上 8-17 生成的旧 lockfile，npm 扁平化后顶层只装了
`builder-util-runtime@9.2.4`（那是 `electron-builder@24.13.3` 要求的版本），并且**没有**为
electron-updater 生成嵌套依赖 → 运行时找不到 `retry`，下载完成后抛异常，更新流程中断。

## 修复方式

在 `dependencies` 中显式锁定正确版本：

```json
"dependencies": {
  "builder-util-runtime": "9.7.0",
  "electron-updater": "6.8.9"
}
```

- 顶层 `builder-util-runtime` → **9.7.0**（含 `retry` 导出），electron-updater 可正常调用
- `electron-builder@24.13.3` 自动获得**嵌套的 9.2.4**，构建工具不受影响
- `electron-updater` 由 caret 范围改为**精确版本**，避免后续 `npm install` 再次漂移

## 影响范围（重要）

- 本修复**只涉及 Electron 壳的自动更新**；dsh 引擎的独立自更新（`dsh-updates` 频道）一直是正常的，
  日志中可见 `[dsh-update] dsh 已是最新`。
- 已安装 v1.1.0 ~ v1.4.0 的客户端，**其内置的更新器本身是坏的**，因此无法自动升到本版 →
  **需要手动安装一次 v1.4.1**。
- 从 v1.4.1 起，后续版本升级才能正常自动完成。

## 附带修复

- v1.4.0 起补齐了连字符命名的 `blockmap`（`DeepSeek-Harness-Desktop-Setup-X.Y.Z.exe.blockmap`），
  此前客户端请求该文件会 404（日志中 `Cannot download differentially, fallback to full download`），
  导致每次都退化为全量下载。现在差分下载可用。

## 验证

- 打包产物内 `resources/app/node_modules/builder-util-runtime` 版本 = **9.7.0**，`retry` 导出存在
- 安装包 sha512 / size 与 `latest.yml` 一致（已校验）
