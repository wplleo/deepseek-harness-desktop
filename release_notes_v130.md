# DeepSeek Harness Desktop v1.3.0

## 更新内容
- **dsh 升级到 0.1.1-rc.2，支持多模态（图片附件）**：与官方 web 版对齐，桌面端现在可以在对话中上传/识别图片。
- 内置 dsh 全家桶（200+ 包）整体升级，含新增的附件处理相关包（dsh-attachment、dsh-client-ui-attachment 等）。
- 原生模块同步升级以兼容新版 dsh：
  - koffi 3.1.5 → 3.1.6（JS 封装层与原生二进制版本一致）
  - node-pty 1.1.0 → 1.2.0-beta.15（含 Windows conpty 预编译）
  - 新增 open 及其依赖树（多模态附件打开/系统交互）
  - hono / jose / negotiator / scheduler 等依赖小幅升级

## 已安装用户
已装 v1.2.0 的用户**无需重装**：桌面端会自动检测 dsh-updates 预发布渠道，后台静默下载并热替换 dsh 模块（含校验与失败回滚），下次启动或 2 小时内的自动检查后即生效。

## 校验
- 从 vendor/node_modules 启动 dsh web 服务（--profile web）实测 HTTP 200，无报错，前端为 0.1.1-rc.2 且含多模态 attachment 标记。
- 自更新包：dsh-build-0.1.1-rc.2.tar.gz（46MB，sha256 见 dsh-manifest.json）。
