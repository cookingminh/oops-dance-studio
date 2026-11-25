// What is pasted into the visual editor. Headings, lists, tables, bold, italic and links stay (the editor's schema drops
// colours, fonts and images by itself); here the HTML of Word, Google Docs and spreadsheets is put into that shape first.

const BLOCKS = 'p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, pre';

const unwrap = (element) => element.replaceWith(...element.childNodes);
const rename = (element, tag) => {
    const next = element.ownerDocument.createElement(tag);
    next.append(...element.childNodes);
    element.replaceWith(next);
    return next;
};

// Word writes list items as paragraphs ("mso-list:l0 level2 lfo1") with the bullet or number typed in front.
const isWordItem = (element) => element?.tagName === 'P' && /mso-list:\s*l\d+/i.test(element.getAttribute('style') ?? '');
function wordLists(doc) {
    for (const first of [...doc.querySelectorAll('p')]) {
        if (!first.isConnected || !isWordItem(first) || isWordItem(first.previousElementSibling)) continue;
        const items = [];
        for (let item = first; isWordItem(item); item = item.nextElementSibling) items.push(item);
        const holder = doc.createElement('div');
        first.before(holder);
        const open = []; // the lists being filled, outermost first: { level, list }
        for (const item of items) {
            const level = Number(/level(\d+)/i.exec(item.getAttribute('style'))?.[1] ?? 1);
            const marker = [...item.querySelectorAll('span')].find((span) => /mso-list:\s*ignore/i.test(span.getAttribute('style') ?? ''));
            const ordered = /^\(?([0-9]+|[a-z]|[ivx]+)[.)]/i.test(marker?.textContent.trim() ?? '');
            marker?.remove();
            while (open.length && open.at(-1).level > level) open.pop();
            if (open.at(-1)?.level === level && (open.at(-1).list.tagName === 'OL') !== ordered) open.pop();
            if (open.at(-1)?.level !== level) {
                const list = doc.createElement(ordered ? 'ol' : 'ul');
                (open.at(-1)?.list.lastElementChild ?? holder).append(list);
                open.push({ level, list });
            }
            const li = doc.createElement('li');
            const text = doc.createElement('p');
            text.append(...item.childNodes);
            li.append(text);
            open.at(-1).list.append(li);
            item.remove();
        }
        unwrap(holder);
    }
}

// A table's cells hold one line of text and its first row is its header (all a Markdown table can say); cells that span
// several are followed by empty ones. A table of one cell is only a frame around its text.
function tables(doc) {
    for (const table of [...doc.querySelectorAll('table')].reverse()) {
        const rows = [...table.rows];
        const cells = rows.flatMap((row) => [...row.cells]);
        if (cells.length <= 1 || table.parentElement.closest('table')) {
            const frame = doc.createElement('div');
            frame.append(...cells.flatMap((cell) => [...cell.childNodes]));
            table.replaceWith(frame);
            continue;
        }
        for (const cell of cells) {
            for (const br of cell.querySelectorAll('br')) br.replaceWith(' ');
            for (const block of [...cell.querySelectorAll(BLOCKS)]) {
                block.after(' ');
                unwrap(block);
            }
            for (let i = cell.colSpan; i > 1; i -= 1) cell.after(doc.createElement('td'));
            cell.removeAttribute('colspan');
        }
        rows.forEach((row, y) =>
            [...row.cells].forEach((cell) => {
                const x = cell.cellIndex;
                for (let i = 1; i < cell.rowSpan && rows[y + i]; i += 1) rows[y + i].insertBefore(doc.createElement('td'), rows[y + i].cells[x] ?? null);
                cell.removeAttribute('rowspan');
            })
        );
        for (const cell of [...rows[0].cells]) if (cell.tagName === 'TD') rename(cell, 'th');
        for (const row of rows.slice(1)) for (const cell of [...row.cells]) if (cell.tagName === 'TH') rename(cell, 'td');
    }
}

export function cleanPastedHtml(html) {
    if (html.includes('data-pm-slice')) return html; // copied inside the editor
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('style, script, meta, link, title, xml, img, svg, video, iframe').forEach((element) => element.remove());
    // Google Docs wraps everything in a bold that isn't bold.
    doc.querySelectorAll('b[id^="docs-internal-guid"]').forEach(unwrap);
    wordLists(doc);
    tables(doc);
    // The article's title is the page's heading: pasted ones start below it.
    doc.querySelectorAll('h1').forEach((heading) => rename(heading, 'h2'));
    doc.querySelectorAll('h4, h5, h6').forEach((heading) => rename(heading, 'h3'));
    return doc.body.innerHTML.replace(/\u00a0|&nbsp;/g, ' ');
}

// Plain text that is written in Markdown (copied from a .md file, a chat…).
export const looksLikeMarkdown = (text) =>
    /^(#{1,6} |> |[-*+] |\d+[.)] |\|.+\|\s*$)/m.test(text) || /\*\*[^*\n]+\*\*/.test(text) || /\[[^\]\n]+\]\(https?:[^)\s]+\)/.test(text);
