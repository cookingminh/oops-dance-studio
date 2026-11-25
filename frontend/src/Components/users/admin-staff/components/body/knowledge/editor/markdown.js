import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';

// Between the Markdown an article is stored as and the visual editor's document (ProseMirror JSON), through remark's
// syntax tree (mdast). What the editor can't show is reported, never dropped quietly:
//   readMarkdown(text)         → { doc, unsupported: [English labels] }
//   writeMarkdown(doc)         → clean Markdown (no escape that isn't needed: the assistant reads it as it is)
//   sameMarkdown(a, b)         → whether two texts say the same, however they are written (_x_ / *x*, spacing…)
//   sameAsDoc(text, doc)       → the same, against what is in the editor

const reader = unified().use(remarkParse).use(remarkGfm).freeze();
const writer = unified()
    .use(remarkGfm, { tablePipeAlign: false })
    .use(remarkStringify, { bullet: '-', listItemIndent: 'one', rule: '-', handlers: { break: () => '  \n' } })
    .freeze();

const parse = (text) => reader.parse(text);

// ---- Saying the same -----------------------------------------------------------------

// A web or email address that is its own link ("oops@x.vn" ⇄ mailto:oops@x.vn) is plain text here.
const isBareLink = (text, url) => url === text || url === `mailto:${text}` || url === `http://${text}`;
const isBare = (link) => link.children.length === 1 && link.children[0].type === 'text' && !link.title && isBareLink(link.children[0].value, link.url);

const MARK_NODES = ['strong', 'emphasis', 'delete'];

// Text with its marks, in runs: [[text, 'mark mark'], …]. Spaces carry no marks (a bold space looks like any other), a
// line break in the source is a space, and what can't be shown keeps its place as [{…}, 'other'].
function runsOf(nodes, marks = [], out = []) {
    const push = (text, own) => {
        if (!text) return;
        const key = [...new Set(own)].sort().join(' ');
        const last = out.at(-1);
        if (last && last[1] === key) last[0] += text;
        else out.push([text, key]);
    };
    for (const node of nodes) {
        if (node.type === 'text') {
            const text = node.value.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/\u00a0/g, ' ');
            for (const part of text.split(/(\s+)/)) push(part, part.trim() ? marks : []);
        } else if (MARK_NODES.includes(node.type)) runsOf(node.children, [...marks, node.type], out);
        else if (node.type === 'inlineCode') push(node.value, [...marks, 'code']);
        else if (node.type === 'link') runsOf(node.children, isBare(node) ? marks : [...marks, `link:${node.url}:${node.title ?? ''}`], out);
        else if (node.type === 'break') push('\n', []);
        else push(JSON.stringify(bare(node)), ['other']);
    }
    return out;
}

function trimRuns(runs) {
    const out = runs.map(([text, marks]) => [marks === '' ? text.replace(/ *\n */g, '\n') : text, marks]);
    while (out.length && out[0][1] === '' && !out[0][0].trim()) out.shift();
    while (out.length && out.at(-1)[1] === '' && !out.at(-1)[0].trim()) out.pop();
    if (out.length && out[0][1] === '') out[0][0] = out[0][0].trimStart();
    if (out.length && out.at(-1)[1] === '') out.at(-1)[0] = out.at(-1)[0].trimEnd();
    return out;
}

// A node without where it was in the source.
const bare = (node) => ({ ...node, position: undefined, ...(node.children && { children: node.children.map(bare) }) });

// Two lists of the same kind in a row read as one.
function joinLists(children) {
    const out = [];
    for (const node of children) {
        const last = out.at(-1);
        if (node.type === 'list' && last?.type === 'list' && Boolean(last.ordered) === Boolean(node.ordered)) {
            out[out.length - 1] = { ...last, children: [...last.children, ...node.children] };
        } else out.push(node);
    }
    return out;
}

const keysOf = (children) => joinLists(children).map(keyOf).filter(Boolean);

function keyOf(node) {
    const runs = () => trimRuns(runsOf(node.children));
    switch (node.type) {
        case 'root':
            return keysOf(node.children);
        case 'paragraph': {
            const own = runs();
            return own.length ? ['p', own] : null;
        }
        case 'heading': {
            const own = runs();
            return own.length ? ['h', node.depth, own] : null;
        }
        case 'blockquote': {
            const own = keysOf(node.children);
            return own.length ? ['quote', own] : null;
        }
        case 'list': {
            const items = node.children.map((item) => [item.checked ?? null, keysOf(item.children)]).filter(([checked, own]) => checked !== null || own.length);
            return items.length ? ['list', node.ordered ? node.start ?? 1 : 0, items] : null;
        }
        case 'table': {
            const width = Math.max(...node.children.map((row) => row.children.length));
            const rows = node.children.map((row) => Array.from({ length: width }, (_, i) => (row.children[i] ? trimRuns(runsOf(row.children[i].children)) : [])));
            // (a row of empty cells says nothing)
            const own = rows.filter((row, i) => i === 0 || row.some((cell) => cell.length));
            return own.some((row) => row.some((cell) => cell.length)) ? ['table', own] : null;
        }
        case 'code':
            return ['code', node.lang ?? '', node.meta ?? '', node.value];
        case 'thematicBreak':
            return ['rule'];
        default:
            return ['other', JSON.stringify(bare(node))];
    }
}

// One text is compared many times while someone types: the last few keys are kept.
const textKeys = new Map();
function keyOfText(text) {
    if (!textKeys.has(text)) {
        if (textKeys.size > 50) textKeys.clear();
        textKeys.set(text, JSON.stringify(keyOf(parse(text))));
    }
    return textKeys.get(text);
}

export const sameMarkdown = (a, b) => a === b || keyOfText(a) === keyOfText(b);
export const sameAsDoc = (text, doc) => keyOfText(text) === JSON.stringify(keyOf(treeOf(doc)));

// ---- Markdown → document -------------------------------------------------------------

const MARKS = { strong: 'bold', emphasis: 'italic', delete: 'strike' };

// What the editor has no place for, in words (English i18n keys).
const UNSUPPORTED = {
    image: 'images',
    imageReference: 'images',
    html: 'HTML',
    footnoteReference: 'footnotes',
    footnoteDefinition: 'footnotes',
    definition: 'link references',
    linkReference: 'link references',
};

export function readMarkdown(text) {
    const unsupported = new Set();
    const skip = (node) => {
        unsupported.add(UNSUPPORTED[node.type] ?? 'other formatting');
        return [];
    };

    const inline = (nodes, marks = []) =>
        nodes.flatMap((node) => {
            const withText = (value, own) => (value ? [{ type: 'text', text: value, ...(own.length && { marks: own }) }] : []);
            if (node.type === 'text') return withText(node.value.replace(/[ \t]*\n[ \t]*/g, ' '), marks);
            if (MARKS[node.type]) return inline(node.children, [...marks, { type: MARKS[node.type] }]);
            if (node.type === 'inlineCode') return withText(node.value, [...marks, { type: 'code' }]);
            if (node.type === 'link') return inline(node.children, isBare(node) ? marks : [...marks, { type: 'link', attrs: { href: node.url } }]);
            if (node.type === 'break') return [{ type: 'hardBreak' }];
            return skip(node);
        });
    const withContent = (node, content) => (content.length ? { ...node, content } : node);
    const paragraph = (nodes) => withContent({ type: 'paragraph' }, inline(nodes));

    const blocks = (nodes) => joinLists(nodes).flatMap(block);
    const block = (node) => {
        switch (node.type) {
            case 'paragraph':
                return [paragraph(node.children)];
            case 'heading':
                return [withContent({ type: 'heading', attrs: { level: node.depth } }, inline(node.children))];
            case 'blockquote':
                return [{ type: 'blockquote', content: atLeastParagraph(blocks(node.children)) }];
            case 'list': {
                if (node.children.some((item) => typeof item.checked === 'boolean')) unsupported.add('checklists');
                const items = node.children.map((item) => {
                    const own = blocks(item.children);
                    return { type: 'listItem', content: own[0]?.type === 'paragraph' ? own : [{ type: 'paragraph' }, ...own] };
                });
                return [node.ordered ? { type: 'orderedList', attrs: { start: node.start ?? 1 }, content: items } : { type: 'bulletList', content: items }];
            }
            case 'table': {
                const width = Math.max(...node.children.map((row) => row.children.length));
                return [
                    {
                        type: 'table',
                        content: node.children.map((row, index) => ({
                            type: 'tableRow',
                            content: Array.from({ length: width }, (_, i) => ({
                                type: index === 0 ? 'tableHeader' : 'tableCell',
                                content: [paragraph(row.children[i]?.children ?? [])],
                            })),
                        })),
                    },
                ];
            }
            case 'code':
                return [withContent({ type: 'codeBlock', attrs: { language: node.lang ?? null } }, node.value ? [{ type: 'text', text: node.value }] : [])];
            case 'thematicBreak':
                return [{ type: 'horizontalRule' }];
            default:
                return skip(node);
        }
    };
    const content = atLeastParagraph(blocks(parse(text).children));
    return { doc: { type: 'doc', content }, unsupported: [...unsupported] };
}

const atLeastParagraph = (content) => (content.length ? content : [{ type: 'paragraph' }]);

// ---- Document → Markdown -------------------------------------------------------------

const NODE_OF_MARK = { bold: 'strong', italic: 'emphasis', strike: 'delete' };
const markKey = (mark) => (mark.type === 'link' ? `link:${mark.attrs?.href ?? ''}` : mark.type);

// A block's text: pieces of { text, marks: [keys] }, spaces moved out of the marks (Markdown can't mark a space's edge),
// and no spaces at the ends of a line.
function piecesOf(content = [], { oneLine = false } = {}) {
    const pieces = [];
    const push = (text, marks) => text && pieces.push({ text, marks });
    for (const node of content) {
        if (node.type === 'hardBreak') {
            if (oneLine) push(' ', []);
            else pieces.push({ br: true, marks: [] });
            continue;
        }
        if (node.type !== 'text') continue;
        const text = node.text.replace(/\u00a0/g, ' ').replace(/[\r\n]+/g, ' ');
        const marks = (node.marks ?? []).filter((mark) => mark.type !== 'link' || !isBareLink(node.text, mark.attrs?.href)).map(markKey);
        if (marks.length === 0 || marks.includes('code')) {
            push(text, marks);
            continue;
        }
        const [, before, core, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
        push(before, []);
        push(core, marks);
        push(after, []);
    }
    const isBlank = (piece) => piece && !piece.br && piece.marks.length === 0 && !piece.text.trim();
    const out = [];
    pieces.forEach((piece, i) => {
        const edge = (other) => !other || other.br;
        if (piece.br) {
            out.push(piece);
            return;
        }
        let { text } = piece;
        const plain = piece.marks.length === 0;
        if (plain && edge(pieces[i - 1])) text = text.trimStart();
        if (plain && edge(pieces[i + 1])) text = text.trimEnd();
        if (text) out.push({ ...piece, text });
    });
    while (out.length && (out[0].br || isBlank(out[0]))) out.shift();
    while (out.length && (out.at(-1).br || isBlank(out.at(-1)))) out.pop();
    return out;
}

// Pieces → mdast, the mark that goes on longest outside ("**a *b***").
function phrasing(pieces) {
    const out = [];
    for (let i = 0; i < pieces.length; ) {
        const piece = pieces[i];
        if (piece.br) {
            out.push({ type: 'break' });
            i += 1;
            continue;
        }
        const marks = piece.marks.filter((key) => key !== 'code');
        if (marks.length === 0) {
            out.push(piece.marks.includes('code') ? { type: 'inlineCode', value: piece.text } : { type: 'text', value: piece.text });
            i += 1;
            continue;
        }
        const reach = (key) => {
            let end = i;
            while (end < pieces.length && !pieces[end].br && pieces[end].marks.includes(key)) end += 1;
            return end;
        };
        const [outer, end] = marks.map((key) => [key, reach(key)]).sort((a, b) => b[1] - a[1])[0];
        const children = phrasing(pieces.slice(i, end).map((inner) => ({ ...inner, marks: inner.marks.filter((key) => key !== outer) })));
        out.push(outer.startsWith('link:') ? { type: 'link', url: outer.slice(5), title: null, children } : { type: NODE_OF_MARK[outer] ?? 'emphasis', children });
        i = end;
    }
    // Plain text pieces side by side are one text.
    return out.reduce((list, node) => {
        const last = list.at(-1);
        if (node.type === 'text' && last?.type === 'text') last.value += node.value;
        else list.push(node.type === 'text' ? { ...node } : node);
        return list;
    }, []);
}

const textBlock = (node, pieces) => {
    const children = phrasing(pieces);
    return children.length ? [{ ...node, children }] : [];
};
// An empty line inside a paragraph (two line breaks) makes two paragraphs, as it looks.
function paragraphs(content = []) {
    const groups = [[]];
    content.forEach((node, i) => {
        const breaks = (at) => content[at]?.type === 'hardBreak';
        if (breaks(i) && (breaks(i + 1) || breaks(i - 1))) {
            if (groups.at(-1).length) groups.push([]);
        } else groups.at(-1).push(node);
    });
    return groups.flatMap((group) => textBlock({ type: 'paragraph' }, piecesOf(group)));
}
const treeBlocks = (content = []) => joinLists(content.flatMap(treeBlock));

function treeBlock(node) {
    switch (node.type) {
        case 'paragraph':
            return paragraphs(node.content);
        case 'heading':
            return textBlock({ type: 'heading', depth: node.attrs?.level ?? 2 }, piecesOf(node.content, { oneLine: true }));
        case 'blockquote': {
            const children = treeBlocks(node.content);
            return children.length ? [{ type: 'blockquote', children }] : [];
        }
        case 'bulletList':
        case 'orderedList': {
            const items = (node.content ?? [])
                .map((item) => treeBlocks(item.content))
                .filter((children) => children.length)
                .map((children) => ({ type: 'listItem', spread: children.filter((child) => child.type === 'paragraph').length > 1, children }));
            if (!items.length) return [];
            const ordered = node.type === 'orderedList';
            return [{ type: 'list', ordered, ...(ordered && { start: node.attrs?.start ?? 1 }), spread: false, children: items }];
        }
        case 'table': {
            const rows = (node.content ?? []).map((row) => ({
                type: 'tableRow',
                children: (row.content ?? []).map((cell) => ({
                    type: 'tableCell',
                    children: phrasing(piecesOf((cell.content ?? []).flatMap((child, i) => [...(i ? [{ type: 'text', text: ' ' }] : []), ...(child.content ?? [])]), { oneLine: true })),
                })),
            }));
            // Rows left empty aren't written (nor a table with nothing in it); the first one is the header.
            const filled = (row) => row.children.some((cell) => cell.children.length);
            return rows.some(filled) ? [{ type: 'table', children: rows.filter((row, i) => i === 0 || filled(row)) }] : [];
        }
        case 'codeBlock':
            return [{ type: 'code', lang: node.attrs?.language ?? null, value: (node.content ?? []).map((child) => child.text ?? '').join('') }];
        case 'horizontalRule':
            return [{ type: 'thematicBreak' }];
        default:
            return [];
    }
}

const treeOf = (doc) => ({ type: 'root', children: treeBlocks(doc.content) });

// The writer escapes to be safe ("50\% \[x]", "a\@b.vn"). An escape goes when the text says the same without it: all of
// a block's at once, else one at a time. Blocks repeat while someone types, so the results are kept.
const tidied = new Map();
const ESCAPE = /\\(?=[!-/:-@[-`{-~])/g;
function tidy(block) {
    if (!block.includes('\\')) return block;
    if (tidied.has(block)) return tidied.get(block);
    const key = JSON.stringify(keyOf(parse(block)));
    const same = (text) => JSON.stringify(keyOf(parse(text))) === key;
    let out = block.replace(ESCAPE, '');
    if (!same(out)) {
        out = block;
        for (const at of [...block.matchAll(ESCAPE)].map((match) => match.index).reverse()) {
            const without = out.slice(0, at) + out.slice(at + 1);
            if (same(without)) out = without;
        }
    }
    if (tidied.size > 300) tidied.clear();
    tidied.set(block, out);
    return out;
}

export const writeMarkdown = (doc) =>
    treeOf(doc)
        .children.map((block) => tidy(writer.stringify({ type: 'root', children: [block] }).replace(/\n+$/, '')))
        .join('\n\n');
