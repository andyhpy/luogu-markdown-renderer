# 洛谷 Markdown 渲染器

> **注意**：本仓库已包含打包后的 IIFE 文件，你可以直接使用 CDN 链接，无需本地构建。如果你需要查看源码或自行构建，请参考下文。

提供两个独立的 Markdown 渲染器，输出纯 HTML 字符串（**不含 CSS**）。

- **旧版** (`render-old.js`)：基于 markdown-it，轻量稳定，用于渲染剪贴板、个人主页等
- **新版** (`render-new.js`)：基于 remark + rehype，支持洛谷扩展语法（容器、对齐、表格合并、代码块行号/高亮等），用于渲染文章、题目等

## 文件结构

```
render-old.js          # 旧版渲染器源码
render-new.js          # 新版渲染器源码
package-old.json       # 旧版依赖参考配置
package-new.json       # 新版依赖参考配置
dist/
├── luogu-old-renderer.iife.js   # 旧版 IIFE（可直接用 <script> 引入）
└── luogu-new-renderer.iife.js   # 新版 IIFE
```

> `package.json` 和 `package-lock.json` 已清空。如需构建，请将对应 `package-*.json` 复制为 `package.json` 后执行 `npm install && npm run build`。

## CDN 链接（jsDelivr）

| 渲染器 | 全局变量名 | CDN |
|--------|------------|-----|
| 旧版 | `LuoguOldRenderer` | `https://cdn.jsdelivr.net/gh/andyhpy/luogu-markdown-renderer@main/dist/luogu-old-renderer.iife.js` |
| 新版 | `LuoguNewRenderer` | `https://cdn.jsdelivr.net/gh/andyhpy/luogu-markdown-renderer@main/dist/luogu-new-renderer.iife.js` |

## 功能对比

| 特性 | 旧版 | 新版 |
|------|:----:|:----:|
| GFM（表格、任务列表、删除线） | ✅ | ✅ |
| 数学公式（行内 `$...$` / 块级 `$$...$$`） | ✅ | ✅ |
| 代码高亮 | ✅（highlight.js） | ✅（Prism） |
| 脚注 / 定义列表 / 缩写 / 上下标 | ❌ | ✅ |
| `:::info/warning/error/success` 容器 | ❌ | ✅ |
| `:::align{center/left/right}` 对齐 | ❌ | ✅ |
| 表格合并（`^` 跨行，`>` 跨列） | ✅ | ✅ |
| 代码块行号（`line-numbers`） | ❌ | ✅ |
| 代码块行高亮（`lines=1-5,7`） | ❌ | ✅ |
| Tuack 风格表格（`::cute-table{tuack}`） | ❌ | ✅ |
| 题头（epigraph） | ❌ | ✅ |

## 用法

```html
<script src="https://cdn.jsdelivr.net/gh/andyhpy/luogu-markdown-renderer@main/dist/luogu-new-renderer.iife.js"></script>
<script>
LuoguNewRenderer.render("# 标题 $E=mc^2$").then(html => {
  document.getElementById('preview').innerHTML = html;
});
</script>
```

两个渲染器均暴露为可直接调用的函数，返回 `Promise<string>`。

## 样式说明

渲染器不含 CSS。需要自行引入：

- **KaTeX**：`https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css`
- **代码高亮**：Prism 主题或 highlight.js 主题
- **容器/行号等**：参考输出 HTML 类名自定义样式

## 本地构建

```bash
# 使用新版配置构建
cp package-new.json package.json
npm install
npm run build:new

# 使用旧版配置构建
cp package-old.json package.json
npm install
npm run build:old
```

## 许可证

AGPL-3.0
