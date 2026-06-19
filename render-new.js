import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkExtendedTable from 'remark-extended-table';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypePrism from 'rehype-prism';
import rehypeKatex from 'rehype-katex';
import { visit } from 'unist-util-visit';
import { toText } from 'hast-util-to-text';
import katex from 'katex';
import { h } from 'hastscript';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Load Prism and make globally accessible so CJS components can find it
globalThis.Prism = require('prismjs');
require('prismjs/components/prism-clike.js');
require('prismjs/components/prism-c.js');
require('prismjs/components/prism-cpp.js');

// ========== 1. 表格合并（处理 ^ 符号，生成 rowspan）==========
// 在 rehype 阶段直接扫描表格，^ 向上合并并添加 rowspan
function rehypeTableMerge() {
    return (tree) => {
        visit(tree, 'element', (node) => {
            if (node.tagName !== 'table') return;
            const tbody = node.children.find(c => c.tagName === 'tbody');
            const rows = tbody ? tbody.children.filter(c => c.tagName === 'tr') : node.children.filter(c => c.tagName === 'tr');
            if (rows.length === 0) return;

            // 遍历所有 ^ 单元格并计算目标 cell 应该增加的行合并数
            const rowspanIncrement = {}; // key: "rowIndex,colIndex" -> count of ^ below
            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].children.filter(c => c.tagName === 'td' || c.tagName === 'th');
                for (let j = 0; j < cells.length; j++) {
                    const text = cells[j].children?.[0]?.value?.trim();
                    if (text === '^') {
                        // 向上找到第一个非 ^ 的同列单元格
                        for (let k = i - 1; k >= 0; k--) {
                            const prevCells = rows[k].children.filter(c => c.tagName === 'td' || c.tagName === 'th');
                            if (j < prevCells.length && prevCells[j]?.children?.[0]?.value?.trim() !== '^') {
                                const key = `${k},${j}`;
                                rowspanIncrement[key] = (rowspanIncrement[key] || 0) + 1;
                                break;
                            }
                        }
                    }
                }
            }
            // 应用 rowspan
            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].children.filter(c => c.tagName === 'td' || c.tagName === 'th');
                for (let j = 0; j < cells.length; j++) {
                    const key = `${i},${j}`;
                    if (rowspanIncrement[key]) {
                        const current = parseInt(cells[j].properties?.rowspan || '1');
                        cells[j].properties = cells[j].properties || {};
                        cells[j].properties.rowspan = current + rowspanIncrement[key];
                    }
                }
            }
            // 移除所有 ^ 单元格及周围的空白文本节点（从右向左删，避免索引偏移）
            for (let i = 0; i < rows.length; i++) {
                const children = rows[i].children;
                for (let j = children.length - 1; j >= 0; j--) {
                    const c = children[j];
                    if (c.tagName === 'td' || c.tagName === 'th') {
                        const text = c.children?.[0]?.value?.trim();
                        if (text === '^') {
                            children.splice(j, 1);
                            // 移除前后的空白文本节点
                            if (j < children.length && children[j]?.type === 'text' && !children[j].value.trim()) {
                                children.splice(j, 1);
                            }
                            if (j > 0 && children[j-1]?.type === 'text' && !children[j-1].value.trim()) {
                                children.splice(j-1, 1);
                                j--;
                            }
                        }
                    }
                }
            }
        });
    };
}

// ========== 2. 自定义容器（info/warning/error/success -> details）==========
function remarkCustomContainers() {
    return (tree) => {
        visit(tree, 'containerDirective', (node) => {
            const name = node.name;
            if (!['info', 'warning', 'error', 'success'].includes(name)) return;
            const data = node.data || (node.data = {});
            data.hName = 'details';
            data.hProperties = { className: name };
            if ('open' in (node.attributes || {})) {
                data.hProperties.open = true;
            }
            // [标题] 语法：第一个 child 是 paragraph 包含标题内容（可能含内联公式）
            if (node.children.length > 0 && node.children[0].type === 'paragraph') {
                const titlePara = node.children[0];
                // 把这个 paragraph 变成 summary（保留其 children，如 inlineMath）
                titlePara.data = titlePara.data || {};
                titlePara.data.hName = 'summary';
            } else {
                // 无标题时默认用容器名
                const summaryNode = {
                    type: 'element',
                    tagName: 'summary',
                    children: [{ type: 'text', value: name.charAt(0).toUpperCase() + name.slice(1) }]
                };
                node.children.unshift(summaryNode);
            }
        });
    };
}

// ========== 3. 对齐容器（align 给内部的标题或段落加 style）==========
function remarkAlignContainer() {
    return (tree) => {
        visit(tree, 'containerDirective', (node) => {
            if (node.name !== 'align') return;
            const attrs = node.attributes || {};
            const align = 'center' in attrs ? 'center' : 'left' in attrs ? 'left' : 'right';
            const data = node.data || (node.data = {});
            data.hName = 'div';
            data.hProperties = { style: `text-align: ${align};` };
        });
    };
}

// 后处理：将 align div 的 style 分布到所有块级子元素，然后移除 div
function rehypeAlignCleanup() {
    return (tree) => {
        visit(tree, 'element', (node, idx, parent) => {
            if (node.tagName !== 'div' || !node.properties?.style?.startsWith('text-align:')) return;
            if (!parent) return;
            const children = (node.children || []).filter(c => c.type !== 'text' || c.value.trim());
            const style = node.properties.style;
            for (const child of children) {
                if (child.type === 'element' && (child.tagName === 'p' || child.tagName.match(/^h[1-6]$/))) {
                    child.properties = child.properties || {};
                    child.properties.style = style;
                }
            }
            parent.children.splice(idx, 1, ...children);
        });
    };
}

// ========== 4. Cute Table 容器 ==========
function remarkCuteTable() {
    return (tree) => {
        visit(tree, 'leafDirective', (node) => {
            if (node.name !== 'cute-table') return;
            const isTuack = node.attributes && 'tuack' in node.attributes;
            const data = node.data || (node.data = {});
            data.hName = isTuack ? 'cute-table-tuack' : 'cute-table';
        });
    };
}

// rehype 阶段：将 leafDirective 生成的标记元素与其后的 table 合并
function rehypeCuteTableCleanup() {
    return (tree) => {
        visit(tree, 'element', (node, idx, parent) => {
            if (!parent) return;
            const isTuack = node.tagName === 'cute-table-tuack';
            if (node.tagName !== 'cute-table' && !isTuack) return;
            const siblings = parent.children;
            const nextSib = siblings[idx + 1];
            if (nextSib && nextSib.type === 'element' && nextSib.tagName === 'table') {
                node.tagName = 'div';
                node.properties = node.properties || {};
                node.properties.className = isTuack
                    ? 'cute-table cute-table-tuack'
                    : 'cute-table cute-table';
                node.children = [nextSib];
                siblings.splice(idx + 1, 1);
            }
        });
    };
}

// ========== 5. Epigraph 容器 ==========
function remarkEpigraph() {
    return (tree) => {
        visit(tree, 'containerDirective', (node) => {
            if (node.name !== 'epigraph') return;
            const data = node.data || (node.data = {});
            data.hName = 'div';
            data.hProperties = { className: 'epigraph has-source' };
            // [来源] 语法：第一个 child 是 paragraph 包含来源
            if (node.children.length > 1 && node.children[0].type === 'paragraph') {
                const sourcePara = node.children.shift();
                node.children.push(sourcePara); // 将来源移到末尾
            }
        });
    };
}

// ========== 6. 代码块参数（行号、高亮行）==========
function remarkCodeBlockParams() {
    return (tree) => {
        visit(tree, 'code', (node) => {
            const meta = node.meta || '';
            const lineNumbers = /line-numbers/.test(meta);
            const linesMatch = meta.match(/lines=([\d,-]+)/);
            let highlightLines = [];
            if (linesMatch) {
                const ranges = linesMatch[1].split(',');
                for (const range of ranges) {
                    if (range.includes('-')) {
                        const [start, end] = range.split('-').map(Number);
                        for (let i = start; i <= end; i++) highlightLines.push(i);
                    } else {
                        highlightLines.push(Number(range));
                    }
                }
            }
            node.data = node.data || {};
            node.data.hProperties = node.data.hProperties || {};
            if (lineNumbers) node.data.hProperties.dataLineNumbers = true;
            if (highlightLines.length) {
                node.data.hProperties.highlightLines = highlightLines.join(',');
                node.data.hProperties.dataLine = linesMatch ? linesMatch[1] : '';
            }
        });
    };
}

function rehypeCodeBlockEnhance() {
    return (tree) => {
        visit(tree, 'element', (node, index, parent) => {
            if (node.tagName === 'pre' && node.children[0]?.tagName === 'code') {
                const codeNode = node.children[0];
                const dataLineNumbers = codeNode.properties?.dataLineNumbers;
                const dataLine = codeNode.properties?.dataLine || '';
                const highlightLinesStr = codeNode.properties?.highlightLines || '';
                const highlightLines = highlightLinesStr.split(',').filter(Boolean).map(Number);
                const lang = codeNode.properties?.className?.find(c => c.startsWith('language-'))?.slice(9) || '';

                // Clean up properties not meant for final HTML output
                delete codeNode.properties.dataLineNumbers;
                delete codeNode.properties.dataLine;
                delete codeNode.properties.highlightLines;

                // Get actual line count from the rendered (highlighted) code text
                const textContent = toText(codeNode, { whitespace: 'pre' });
                const lines = textContent.split('\n');
                const lineCount = textContent.endsWith('\n') ? lines.length - 1 : lines.length;

                // Construct pre classes
                const preClasses = ['pre'];
                if (dataLineNumbers) preClasses.push('line-numbers');
                if (lang) preClasses.push(`language-${lang}`);
                node.properties.className = preClasses;
                node.properties.tabindex = '0';
                node.properties['data-v-a7061ca4'] = '';
                codeNode.properties['data-v-a7061ca4'] = '';
                if (dataLine) node.properties.dataLine = dataLine;

                // Add line-numbers-rows and line-numbers-sizer
                if (dataLineNumbers) {
                    const rowsSpan = {
                        type: 'element',
                        tagName: 'span',
                        properties: { 'aria-hidden': 'true', className: 'line-numbers-rows' },
                        children: Array.from({ length: lineCount }, () => ({
                            type: 'element',
                            tagName: 'span',
                            properties: { style: 'height: 21px;' },
                            children: []
                        }))
                    };
                    codeNode.children.push(rowsSpan);

                    const sizerSpan = {
                        type: 'element',
                        tagName: 'span',
                        properties: { className: 'line-numbers-sizer', style: 'display: none;' },
                        children: []
                    };
                    codeNode.children.push(sizerSpan);
                }

                // Add highlight divs with data-range attribute
                if (highlightLines.length > 0) {
                    let currentStart = null;
                    for (let i = 1; i <= lineCount; i++) {
                        if (highlightLines.includes(i)) {
                            if (currentStart === null) currentStart = i;
                        } else {
                            if (currentStart !== null) {
                                const end = i - 1;
                                const height = (end - currentStart + 1) * 21;
                                const top = (currentStart - 1) * 21;
                                const rangeStr = currentStart === end ? String(currentStart) : `${currentStart}-${end}`;
                                const highDiv = {
                                    type: 'element',
                                    tagName: 'div',
                                    properties: {
                                        'aria-hidden': 'true',
                                        'data-range': rangeStr,
                                        className: ' line-highlight',
                                        style: `top: ${top}px; height: ${height}px;`
                                    },
                                    children: []
                                };
                                node.children.push(highDiv);
                                currentStart = null;
                            }
                        }
                    }
                    if (currentStart !== null) {
                        const height = (lineCount - currentStart + 1) * 21;
                        const top = (currentStart - 1) * 21;
                        const rangeStr = currentStart === lineCount ? String(currentStart) : `${currentStart}-${lineCount}`;
                        const highDiv = {
                            type: 'element',
                            tagName: 'div',
                            properties: {
                                'aria-hidden': 'true',
                                'data-range': rangeStr,
                                className: ' line-highlight',
                                style: `top: ${top}px; height: ${height}px;`
                            },
                            children: []
                        };
                        node.children.push(highDiv);
                    }
                }

                // Add copy button
                const copyBtn = h('button', { type: 'button', className: 'copy-button', 'data-v-a7061ca4': '' }, [
                    h('svg', { className: 'svg-inline--fa fa-copy copy-icon', viewBox: '0 0 448 512', 'aria-hidden': 'true', 'data-v-a7061ca4': '' }, [
                        h('path', { class: '', fill: 'currentColor', d: 'M192 0c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-200.6c0-17.4-7.1-34.1-19.7-46.2L370.6 17.8C358.7 6.4 342.8 0 326.3 0L192 0zM64 128c-35.3 0-64 28.7-64 64L0 448c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-16-64 0 0 16-192 0 0-256 16 0 0-64-16 0z' })
                    ])
                ]);
                const wrapper = h('div', { className: 'code-container', 'data-v-a7061ca4': '' }, [node, copyBtn]);
                parent.children[index] = wrapper;
            }
        });
    };
}

// 将 align 属性转为内联 style（与期望输出一致）
function rehypeAlignToStyle() {
    return (tree) => {
        visit(tree, 'element', (node) => {
            const align = node.properties?.align;
            if (align && (node.tagName === 'th' || node.tagName === 'td' || node.tagName === 'tr' || node.tagName === 'table')) {
                node.properties.style = `text-align: ${align};`;
                delete node.properties.align;
            }
        });
    };
}

// ========== 7. 图片：处理 bilibili: 协议 ==========
function rehypeBilibili() {
    return (tree) => {
        visit(tree, 'element', (node) => {
            if (node.tagName === 'img' && node.properties?.src?.startsWith('bilibili:')) {
                const src = node.properties.src;
                const urlPart = src.slice('bilibili:'.length);
                const [bvidPart, query] = urlPart.includes('?') ? urlPart.split('?') : [urlPart, ''];
                const params = new URLSearchParams(query);
                const page = params.get('page') || '1';
                const t = params.get('t') || '0';
                const embedUrl = `https://player.bilibili.com/player.html?danmaku=0&autoplay=0&playlist=0&muted=0&bvid=${bvidPart}&page=${page}&t=${t}`;
                const divProps = {
                    src: `bilibili://${bvidPart}${query ? '?' + query : ''}`,
                    alt: 'video',
                    style: 'position: relative; padding-bottom: 62.5%;'
                };
                const iframe = h('iframe', {
                    src: embedUrl,
                    scrolling: 'no',
                    border: '0',
                    frameborder: 'no',
                    framespacing: '0',
                    allowfullscreen: true,
                    style: 'position: absolute; top: 0px; left: 0px; width: 100%; height: 100%;'
                });
                const container = h('div', divProps, [iframe]);
                node.tagName = 'div';
                node.properties = divProps;
                node.children = [iframe];
            }
        });
    };
}

// ========== 8. 公式错误处理（KaTeX 渲染失败时显示红色）==========
function rehypeKatexWithError() {
    return rehypeKatex({ throwOnError: false, errorColor: 'rgb(204, 0, 0)', output: 'html', strict: false });
}

// ========== 构建处理器 ==========
const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(remarkCustomContainers)     // info/warning/error/success -> details
    .use(remarkAlignContainer)       // align 容器
    .use(remarkCuteTable)            // cute-table 容器
    .use(remarkEpigraph)             // epigraph 容器
    .use(remarkCodeBlockParams)      // 代码块参数
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatexWithError)       // KaTeX 渲染，错误显示红色
    .use(rehypePrism)
    .use(rehypeCuteTableCleanup)     // cute-table 包裹 table
    .use(rehypeTableMerge)           // 在 HTML 层面清理合并单元格
    .use(rehypeAlignCleanup)         // 对齐样式转移
    .use(rehypeCodeBlockEnhance)     // 代码块行号和高亮
    .use(rehypeBilibili)             // B站视频
    .use(rehypeAlignToStyle)         // align -> style
    .use(rehypeStringify, { allowDangerousCharacters: true, spaces: false });

export async function render(markdown) {
    // Normalize CRLF -> LF in input
    markdown = markdown.replace(/\r\n/g, '\n');
    const result = await processor.process(markdown);
    let html = String(result);
    // Normalize katex-error inline style format
    html = html.replace(/style="color:rgb\(204,\s*0,\s*0\)"/g, 'style="color: rgb(204, 0, 0);"');
    // Ensure boolean HTML attributes (open, allowfullscreen) render as attr="" not bare attr
    html = html.replace(/\b(open|allowfullscreen)(?=[\s>\/])/g, '$1=""');
    return html;
}

export default { render };