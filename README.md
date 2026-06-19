# 洛谷 Markdown 渲染器

> **注意**：本仓库已包含打包后的 IIFE 文件，你可以直接使用 CDN 链接，无需本地构建。

提供两个独立的 Markdown 渲染器，输出纯 HTML 字符串（**不含 CSS**）。

- **旧版** (`render-old.js`)：基于 markdown-it，轻量稳定，用于剪贴板、个人主页等
- **新版** (`render-new.js`)：基于 remark + rehype，支持洛谷扩展语法（容器、对齐、表格合并、代码块行号/高亮等），用于文章、题目等

## 安装

```bash
npm install luogu-renderer
```

```js
import { render as renderOld } from 'luogu-renderer/old';
import { render as renderNew } from 'luogu-renderer/new';

const html = await renderNew('# 标题 $E=mc^2$');
```

## 文件结构

```
render-old.js                # 旧版渲染器源码（ESM）
render-new.js                # 新版渲染器源码（ESM）
dist/
├── luogu-old-renderer.iife.js   # 旧版 IIFE（<script> 引入）
└── luogu-new-renderer.iife.js   # 新版 IIFE
```

## CDN 链接（jsDelivr）

| 渲染器 | 全局变量名 | CDN |
|--------|------------|-----|
| 旧版 | `LuoguOldRenderer` | `https://cdn.jsdelivr.net/npm/luogu-renderer/dist/luogu-old-renderer.iife.js` |
| 新版 | `LuoguNewRenderer` | `https://cdn.jsdelivr.net/npm/luogu-renderer/dist/luogu-new-renderer.iife.js` |

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

### 浏览器（IIFE）

```html
<script src="https://cdn.jsdelivr.net/npm/luogu-renderer/dist/luogu-new-renderer.iife.js"></script>
<script>
LuoguNewRenderer.render("# 标题 $E=mc^2$").then(html => {
  document.getElementById('preview').innerHTML = html;
});
</script>
```

两个渲染器均暴露为对象，调用 `.render(markdown)` 返回 `Promise<string>`。

### Node.js（ESM）

```js
import { render } from 'luogu-renderer/new';
// 或 import { render } from 'luogu-renderer/old';

const html = await render(`:::info
这是一个提示容器
:::

\`\`\`js line-numbers lines=2-3
console.log("第一行");
console.log("第二行");
console.log("第三行");
\`\`\``);
```

## 样式说明

渲染器不含 CSS。需要自行引入：

- **KaTeX**：`https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css`
- **代码高亮**：Prism 或 highlight.js 主题
- **容器/行号等**：参考输出 HTML 类名自定义样式

## 本地构建

```bash
npm install
npm run build:new    # 新版
npm run build:old    # 旧版
npm run build        # 全部
```

## 许可证

AGPL-3.0
