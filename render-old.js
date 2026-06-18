import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import taskLists from 'markdown-it-task-lists';
import sup from 'markdown-it-sup';
import sub from 'markdown-it-sub';
import hljs from 'highlight.js';
import katex from 'katex';

function preprocessTextCommands(markdown) {
    const mathPattern = /(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g;
    const mathMatches = [];
    const placeholders = [];
    
    let processed = markdown.replace(mathPattern, (match) => {
        const idx = mathMatches.length;
        mathMatches.push(match);
        const placeholder = `__MATH_PLACEHOLDER_${idx}__`;
        placeholders.push(placeholder);
        return placeholder;
    });
    
    processed = processed
        .replace(/\\Huge\{([^}]*)\}/g, '<span style="font-size: 2em;">$1</span>')
        .replace(/\\huge\{([^}]*)\}/g, '<span style="font-size: 1.5em;">$1</span>')
        .replace(/\\large\{([^}]*)\}/g, '<span style="font-size: 1.2em;">$1</span>')
        .replace(/\\small\{([^}]*)\}/g, '<span style="font-size: 0.8em;">$1</span>')
        .replace(/\\tiny\{([^}]*)\}/g, '<span style="font-size: 0.6em;">$1</span>')
        .replace(/\\color\{([^}]*)\}\{([^}]*)\}/g, '<span style="color: $1;">$2</span>')
        .replace(/\\textcolor\{([^}]*)\}\{([^}]*)\}/g, '<span style="color: $1;">$2</span>');
    
    for (let i = 0; i < mathMatches.length; i++) {
        processed = processed.split(placeholders[i]).join(mathMatches[i]);
    }
    return processed;
}

const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
    highlight: function(str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                const langAttr = lang ? ` data-rendered-lang="${lang}"` : '';
                let code = hljs.highlight(str, { language: lang }).value;
                if (lang === 'cpp') {
                    code = code.replace(/\b(std)\b/g, '<span class="hljs-built_in">$1</span>');
                }
                return `<pre><code class="language-${lang}"${langAttr}>${code}</code></pre>\n`;
            } catch (__) {}
        }
        return '';
    }
});

md.use(taskLists);
md.use(sup);
md.use(sub);

texmath.rules.dollars.inline = texmath.rules.dollars.inline.filter(r => r.name !== 'math_inline_double');
texmath.rules.dollars.inline[0].rex = /(?<!\$)\$(?!\$)(.+?)\$/gy;

md.use(texmath, {
    engine: katex,
    delimiters: ['dollars', 'brackets'],
    katexOptions: {
        throwOnError: true,
        strict: false,
    }
});

function renderMath(tex, displayMode) {
    const options = { throwOnError: true, strict: false, displayMode };
    try {
        const katexHtml = katex.renderToString(tex, options);
        return `<span>${katexHtml}</span>`;
    } catch (e) {
        return `<span>${tex}</span>`;
    }
}

md.renderer.rules.math_inline = (tokens, idx) => renderMath(tokens[idx].content, false);
md.renderer.rules.math_inline_double = (tokens, idx) => renderMath(tokens[idx].content, true);
md.renderer.rules.math_block = (tokens, idx) => renderMath(tokens[idx].content, true);
md.renderer.rules.math_block_eqno = (tokens, idx) => renderMath(tokens[idx].content, true);

// ========== Bilibili 视频处理 ==========
const defaultImageRenderer = md.renderer.rules.image || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
};

md.renderer.rules.image = function(tokens, idx, options, env, self) {
    const token = tokens[idx];
    const srcIndex = token.attrIndex('src');
    if (srcIndex >= 0) {
        const src = token.attrs[srcIndex][1];
        if (src.startsWith('bilibili:')) {
            const urlPart = src.slice('bilibili:'.length);
            const qIndex = urlPart.indexOf('?');
            const idPart = qIndex >= 0 ? urlPart.slice(0, qIndex) : urlPart;
            let page = '1', t = '0';
            if (qIndex >= 0) {
                const query = urlPart.slice(qIndex + 1);
                const pairs = query.split('&');
                for (const pair of pairs) {
                    const eq = pair.indexOf('=');
                    if (eq >= 0) {
                        const key = pair.slice(0, eq);
                        const val = pair.slice(eq + 1);
                        if (key === 'page') page = val;
                        if (key === 't') t = val;
                    }
                }
            }
            let embedUrl;
            if (/^BV/i.test(idPart)) {
                embedUrl = 'https://www.bilibili.com/blackboard/webplayer/embed-old.html?bvid=' + idPart + '&danmaku=0&autoplay=0&playlist=0&high_quality=1&page=' + page + '&t=' + t;
            } else {
                const aid = idPart.replace(/^av/i, '');
                embedUrl = 'https://www.bilibili.com/blackboard/webplayer/embed-old.html?aid=' + aid + '&danmaku=0&autoplay=0&playlist=0&high_quality=1&page=' + page + '&t=' + t;
            }
            return '</p><div class="iframe-wrapper" style="position: relative; padding-bottom: 62.5%"><iframe scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" src="' + embedUrl.replace(/&/g, '&amp;') + '" style=" position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>';
        }
    }
    return defaultImageRenderer(tokens, idx, options, env, self);
};

export async function render(markdown) {
    const processed = preprocessTextCommands(markdown);
    let html = md.render(processed);
    html = html.replace('</div>\n:::</p>', '</div>\n:::<p></p>');
    html = html.replace('</code></pre>\n\n<p>:::</p>', '</code></pre>\n<p>:::</p>');
    html = html.replace(/\n$/, '');
    return html;
}

export default { render };