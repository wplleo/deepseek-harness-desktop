'use strict';
/**
 * DeepSeek Harness Desktop — preload 脚本
 * 通过 contextBridge 向渲染进程暴露少量只读桌面信息。
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('dshDesktop', {
  appName: 'DeepSeek Harness Desktop',
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
