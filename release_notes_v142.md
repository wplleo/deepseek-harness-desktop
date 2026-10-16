# v1.4.2 — 修复启动时自动弹出浏览器

## 修复的问题

每次启动桌面客户端，都会**额外拉起系统默认浏览器并打开一个网页**。

**根因**：dsh 的 web profile 启动后默认会打开默认浏览器（源码可见于 `dsh-web-app/lib/startup.js`
的 `--no-open` 选项说明，以及 `dsh-web-app/lib/index.js` 的日志
`dsh web: opening the default browser; pass --no-open to disable`）。
而 `src/main.js` 拉起 dsh 时传的参数里没有加 `--no-open`，桌面端本身已经有自己的窗口，
于是每次都多弹一个网页。

```
修复前： ['--profile', 'web', '--port', <port>, '--host', '127.0.0.1']
修复后： ['--profile', 'web', '--port', <port>, '--host', '127.0.0.1', '--no-open']
```

## 修复方式

在 `src/main.js` 的 dsh 启动参数中显式加入 `--no-open`。
桌面窗口仍然正常加载 `http://127.0.0.1:<port>`，只是不再由 dsh 主动唤起外部浏览器。

> 需要时需要打开网页版，仍可通过**托盘菜单 → 在浏览器中打开**手动调起。

## 说明

- 该现象自 dsh 升级到 0.1.1-rc.2（v1.3.0）后出现，因为 rc.2 的 web-app 引入了浏览器唤起行为。
- 本次同时包含 v1.4.1 的自动更新修复（`builder-util-runtime` 锁定 9.7.0），
  因此从本版起，客户端可以正常接收后续版本的自动更新。
