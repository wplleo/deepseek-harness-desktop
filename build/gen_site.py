# -*- coding: utf-8 -*-
"""生成 DeepSeek Harness Desktop 下载落地页（单文件，图标 base64 内嵌）"""
import base64, pathlib

ICON = pathlib.Path(r"E:\DeepSeek\rebuild\build\icon.png")
OUT = pathlib.Path(r"E:\DeepSeek\rebuild\download-site\index.html")
DOWNLOAD_URL = ("https://github.com/wplleo/deepseek-harness-desktop/releases/download/"
                "v1.0.3/DeepSeek.Harness.Desktop.Setup.1.0.3.exe")
RELEASE_URL = "https://github.com/wplleo/deepseek-harness-desktop/releases/tag/v1.0.3"
REPO_URL = "https://github.com/wplleo/deepseek-harness-desktop"

b64 = base64.b64encode(ICON.read_bytes()).decode("ascii")

html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DeepSeek Harness Desktop - Windows 下载</title>
<meta name="description" content="DeepSeek Harness Desktop：DeepSeek Harness 的 Windows 桌面封装，原生窗口 + 托盘常驻，开箱即用。">
<style>
  :root {
    --bg: #0b1220;
    --bg2: #101a30;
    --card: #16203a;
    --line: rgba(255,255,255,.08);
    --accent: #2f6bff;
    --accent2: #4f8bff;
    --text: #e8edf7;
    --muted: #93a0b8;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif;
    background: radial-gradient(1200px 600px at 70% -10%, #14254a 0%, transparent 60%),
                radial-gradient(900px 500px at 10% 110%, #101c3a 0%, transparent 55%),
                var(--bg);
    color: var(--text);
    min-height: 100vh;
    line-height: 1.6;
  }
  .wrap { max-width: 920px; margin: 0 auto; padding: 56px 24px 40px; }

  /* Hero */
  .hero { text-align: center; padding: 12px 0 40px; }
  .logo {
    width: 108px; height: 108px; border-radius: 26px; margin: 0 auto 22px;
    background: var(--card); border: 1px solid var(--line);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 18px 50px rgba(0,0,0,.45);
  }
  .logo img { width: 84px; height: 84px; border-radius: 20px; display: block; }
  h1 { font-size: 34px; font-weight: 700; letter-spacing: .5px; }
  .tagline { color: var(--muted); margin-top: 10px; font-size: 16px; }
  .badge {
    display: inline-block; margin-top: 16px; padding: 5px 14px; border-radius: 999px;
    background: rgba(47,107,255,.15); border: 1px solid rgba(79,139,255,.35);
    color: #9db8ff; font-size: 13px;
  }

  /* Download */
  .download {
    background: linear-gradient(180deg, var(--card), #131f3a);
    border: 1px solid var(--line); border-radius: 20px;
    padding: 34px 28px; margin: 8px 0 36px; text-align: center;
  }
  .btn {
    display: inline-flex; align-items: center; gap: 12px;
    background: linear-gradient(180deg, var(--accent2), var(--accent));
    color: #fff; text-decoration: none; font-size: 18px; font-weight: 600;
    padding: 16px 42px; border-radius: 14px; letter-spacing: .5px;
    box-shadow: 0 12px 34px rgba(47,107,255,.38);
    transition: transform .12s ease, box-shadow .12s ease;
  }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 16px 42px rgba(47,107,255,.5); }
  .btn .arrow { font-size: 20px; }
  .btns { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; }
  .btn-gh {
    display: inline-flex; align-items: center; gap: 8px;
    background: transparent; color: #c6d2ea; text-decoration: none;
    font-size: 15px; font-weight: 600;
    padding: 14px 28px; border-radius: 12px;
    border: 1px solid rgba(255,255,255,.18);
    transition: border-color .12s ease, color .12s ease, background .12s ease;
  }
  .btn-gh:hover { border-color: rgba(79,139,255,.6); color: #fff; background: rgba(47,107,255,.1); }
  .meta { margin-top: 16px; color: var(--muted); font-size: 13.5px; }
  .meta b { color: #c6d2ea; font-weight: 600; }
  .alt-link { margin-top: 10px; font-size: 13px; }
  .alt-link a { color: var(--muted); }

  /* Features */
  h2 { font-size: 20px; margin-bottom: 18px; }
  .grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 14px; margin-bottom: 40px;
  }
  .feat {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 18px 18px 16px;
  }
  .feat .ico { font-size: 20px; }
  .feat h3 { font-size: 15px; margin: 8px 0 4px; }
  .feat p { color: var(--muted); font-size: 13px; }

  /* Install steps */
  .steps { counter-reset: s; margin-bottom: 40px; }
  .step {
    display: flex; gap: 16px; align-items: flex-start;
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 16px 18px; margin-bottom: 10px;
  }
  .step .num {
    counter-increment: s; flex: 0 0 34px; width: 34px; height: 34px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: rgba(47,107,255,.18); color: #9db8ff; font-weight: 700; font-size: 15px;
  }
  .step p { font-size: 14px; color: #cdd8ee; }
  .step code {
    background: #0c1530; border: 1px solid var(--line); border-radius: 6px;
    padding: 1px 7px; font-family: Consolas, monospace; font-size: 13px; color: #b8d0ff;
  }

  footer { text-align: center; color: var(--muted); font-size: 13px; padding-top: 8px; }
  footer a { color: #7f95c0; text-decoration: none; }
  footer a:hover { color: #9db8ff; text-decoration: underline; }

  @media (max-width: 520px) {
    h1 { font-size: 27px; }
    .btns { flex-direction: column; width: 100%; }
    .btn, .btn-gh { width: 100%; justify-content: center; padding: 15px 20px; }
  }
</style>
</head>
<body>
<div class="wrap">

  <header class="hero">
    <div class="logo"><img src="data:image/png;base64,B64" alt="DeepSeek Harness Desktop"></div>
    <h1>DeepSeek Harness Desktop</h1>
    <p class="tagline">把 DeepSeek Harness 装进 Windows 桌面 · 原生窗口 · 托盘常驻 · 开箱即用</p>
    <span class="badge">v1.0.3 · Windows 10/11 · x64</span>
  </header>

  <section class="download">
    <div class="btns">
      <a class="btn" href="DLURL" rel="noopener">
        <span>下载安装包 v1.0.3</span><span class="arrow">&#8595;</span>
      </a>
      <a class="btn-gh" href="REPOURL" rel="noopener">GitHub 仓库 &#8599;</a>
    </div>
    <p class="meta">DeepSeek.Harness.Desktop.Setup.1.0.3.exe · <b>129 MB</b> · 2026-08-19 发布</p>
    <p class="alt-link">下载慢或失效？<a href="RELURL" rel="noopener">去 GitHub Releases 页选择其他入口 &#8599;</a></p>
  </section>

  <h2>为什么用它</h2>
  <section class="grid">
    <div class="feat"><div class="ico">&#128194;</div><h3>一键安装</h3><p>NSIS 安装包，双击按向导完成，桌面快捷方式自动生成</p></div>
    <div class="feat"><div class="ico">&#128472;</div><h3>托盘常驻</h3><p>关窗不退出，服务在托盘后台运行，随时唤回</p></div>
    <div class="feat"><div class="ico">&#127760;</div><h3>本地服务</h3><p>内置 dsh Web 服务，随机端口，随装随用无需配置</p></div>
    <div class="feat"><div class="ico">&#128274;</div><h3>数据本地</h3><p>全部在本机运行，不依赖外部账号与云服务</p></div>
  </section>

  <h2>安装步骤</h2>
  <section class="steps">
    <div class="step"><div class="num"></div><p>点击上方按钮下载 <code>Setup 1.0.3.exe</code>（129 MB）</p></div>
    <div class="step"><div class="num"></div><p>双击安装包，按向导点击「下一步」完成安装</p></div>
    <div class="step"><div class="num"></div><p>从桌面或开始菜单启动 <b>DeepSeek Harness Desktop</b>，开箱即用</p></div>
  </section>

  <footer>
    <p>DeepSeek Harness Desktop · 开源地址 <a href="REPOURL" rel="noopener">github.com/wplleo/deepseek-harness-desktop</a></p>
  </footer>

</div>
</body>
</html>
"""

html = (html.replace("B64", b64)
            .replace("DLURL", DOWNLOAD_URL)
            .replace("RELURL", RELEASE_URL)
            .replace("REPOURL", REPO_URL))
OUT.write_text(html, encoding="utf-8")
print("written:", OUT, len(html), "bytes")
