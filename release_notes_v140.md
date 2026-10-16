# v1.4.0 — 版本更新（触发自动更新分发）

本版本无功能变更，仅递增外壳版本号以验证/触发桌面端自动更新链路。

## 更新内容

- 外壳版本升级至 **v1.4.0**
- 自动更新链路保持不变：启动即检测 + 每小时复查
- dsh 引擎仍走独立更新频道（`dsh-updates` 预发布），本次不涉及引擎升级
- 已包含正确的 `build/installer.nsh`，安装/升级后会重建桌面与开始菜单快捷方式（引用 `resources/appicon.ico`，绕开 Windows 图标缓存），避免快捷方式丢失或图标裂图

## 自动更新说明

已安装 v1.3.0 的用户启动应用时会检测到新版本并自动下载，下载完成后弹窗询问「现在重启 / 稍后」。选「现在重启」即完成升级。

未安装的请从 Releases 下载 `DeepSeek-Harness-Desktop-Setup-1.4.0.exe` 安装。

## 产物校验

| 项 | 值 |
| --- | --- |
| 安装器 | DeepSeek-Harness-Desktop-Setup-1.4.0.exe |
| 大小 | 140319614 字节（约 133.8 MB） |
| sha512 (base64) | MQR+DYLPcfRTiY4JLSgdXff+4s/uYnlIhRd+vof3xYpF0AIN6CQGh5RqlEmCT9H8WBUNTOyDyTI1114LlGypFA== |
| 构建时间 | 2026-10-16T02:05:08Z |

`latest.yml` 中的 `path` / `sha512` / `size` 与实际上传的安装器逐字节一致（已校验）。
