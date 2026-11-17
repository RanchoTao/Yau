#!/usr/bin/env python3
"""Assemble theorem explainer pages from tools/content/<slug>.html.

Each content file starts with a block of `key: value` lines, then a line `---`,
then the <section> elements, then a line `===`, then the JS config object body.
Run:  python3 tools/build_explainers.py
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title_zh} · {title_en} — 丘成桐 · 数学世界</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#06070b">
<link rel="canonical" href="https://masteryau.com/{slug}/">
<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:title" content="{title_zh} · {title_en}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://masteryau.com/assets/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;500;700;900&family=Cormorant+Garamond:ital,wght@0,300;0,500;1,300;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
<link rel="stylesheet" href="../assets/explainer.css">
</head>
<body>
<div id="progress"></div>
<nav>
  <a class="back" href="../#theorems">← <span class="zh">丘成桐 · 数学世界</span><span class="en">Shing-Tung Yau</span></a>
  <div class="lang" role="group" aria-label="Language"><button data-l="zh">中文</button><button data-l="en">EN</button></div>
</nav>

<header class="hero">
  <canvas id="cy" aria-label="{canvas_label}"></canvas>
  <div class="hero-text">
    <div class="kicker">{kicker}</div>
    <h1><span class="zh">{title_zh}</span><span class="en">{title_en}</span></h1>
    <div class="sub"><span class="zh">{sub_zh}</span><span class="en">{sub_en}</span></div>
    <div class="meta">
      <span><span class="zh">原文</span><span class="en">Paper</span> · <b>{paper}</b></span>
      <span><span class="zh">阅读约 {mins} 分钟</span><span class="en">~{mins} min read</span></span>
    </div>
  </div>
</header>

<div class="wrap">
<aside><ol id="toc"></ol></aside>
<article>
{body}
</article>
</div>

<footer>
  <span class="zh">本讲解由 AI 辅助撰写，力求通俗；涉及严格表述时，请以原始论文为准。欢迎在 GitHub 提出勘误。<br>学生自发制作的致敬作品，并非丘成桐先生官方网站。</span>
  <span class="en">This explainer was written with AI assistance and aims for accessibility; for rigorous statements, consult the original papers. Corrections welcome on GitHub.<br>A student-made tribute; not an official website of Professor Yau.</span>
</footer>

<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"></script>
<script>
window.EXPLAINER = {{
{cfg}
}};
</script>
<script src="../assets/explainer.js"></script>
</body>
</html>
"""

def build(path):
    raw = path.read_text(encoding="utf-8")
    head, rest = raw.split("\n---\n", 1)
    body, cfg = rest.split("\n===\n", 1)
    meta = dict(re.match(r"(\w+):\s*(.*)", l).groups() for l in head.strip().splitlines())
    slug = path.stem
    out = ROOT / slug / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(TEMPLATE.format(slug=slug, body=body.strip(), cfg=cfg.strip(), **meta), encoding="utf-8")
    print("built", out.relative_to(ROOT))

if __name__ == "__main__":
    for p in sorted((ROOT / "tools" / "content").glob("*.html")):
        build(p)
