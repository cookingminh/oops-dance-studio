// The visual editor of AI knowledge articles (/admin/knowledge/…; body/knowledge/editor): writing as it will look, stored
// as clean Markdown — the toolbar, the "/" menu, tables, links, characters that mean something in Markdown, what is
// pasted (Google Docs, Word, spreadsheets, Markdown), Vietnamese typing; a text it can't show opens as Markdown untouched,
// and so does any text when the editor itself doesn't load. Saved bodies are read back with the staff's own JWT.
import { test, expect } from '@playwright/test';
import { login, rest, staffJwt } from './support.js';

// Every test writes an article of its own; they only share the signed-in page.

const RUN = Date.now();
const EDITOR = '/src/Components/users/admin-staff/components/body/knowledge/editor/markdown.js';

let page;
let jwt;
const errors = [];
let count = 0;
const made = []; // ids of the articles written here (a pasted "# …" can rename one)

const text = () => page.getByLabel('Article text');
const tool = (name) => page.getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name, exact: true });
const save = () => page.locator('.kbEditorActions').getByRole('button', { name: /^Save/ });
const menu = () => page.getByRole('listbox', { name: 'Insert' });
const type = (words) => page.keyboard.type(words);
const press = async (...keys) => {
    for (const key of keys) await page.keyboard.press(key);
};

const make = async (body) => {
    count += 1;
    const res = await rest(jwt, 'knowledge_articles', { method: 'POST', body: { title: `E2E editor ${RUN} ${count}`, category: 'other', body }, prefer: 'return=representation' });
    expect(res.status, JSON.stringify(res.data)).toBe(201);
    made.push(res.data[0].id);
    return res.data[0].id;
};
const open = async (body) => {
    const id = await make(body);
    await page.goto(`/admin/knowledge/${id}`);
    await expect(text()).toBeVisible();
    return id;
};
const bodyOf = async (id) => (await rest(jwt, `knowledge_articles?select=body&id=eq.${id}`)).data[0].body;
// Saves, and checks what is stored; then opens it again: the same text, in the visual editor, nothing to save.
const expectStored = async (id, markdown) => {
    await save().click();
    await expect(page.locator('.kbUnsaved')).toHaveCount(0);
    await expect(save()).toBeDisabled();
    expect(await bodyOf(id)).toBe(markdown);
    await page.goto(`/admin/knowledge/${id}`);
    await expect(page.locator('.kbProse')).toBeVisible();
    await expect(save()).toBeDisabled();
};
// A paste with these clipboard types, into the editor.
const paste = (data) =>
    text().evaluate((box, types) => {
        const clipboard = new DataTransfer();
        for (const [kind, value] of Object.entries(types)) clipboard.setData(kind, value);
        box.focus();
        box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
    }, data);
const cleanUp = async () => {
    expect((await rest(jwt, `knowledge_articles?title=like.${encodeURIComponent('E2E editor *')}`, { method: 'DELETE' })).status).toBe(204);
    if (made.length) expect((await rest(jwt, `knowledge_articles?id=in.(${made.join(',')})`, { method: 'DELETE' })).status).toBe(204);
};

test.beforeAll(async ({ browser }) => {
    jwt = await staffJwt();
    await cleanUp();
    page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page, 'staff@demo.oopsdance.test');
});

test.afterAll(async () => {
    await page?.close();
    await cleanUp();
    expect(errors, 'errors on the page').toEqual([]);
});

test('the toolbar: bold, italic, headings, lists, a note, a divider', async () => {
    const id = await open('');
    await text().click();
    await tool('Section heading').click();
    await type('Giá phòng');
    await press('Enter');
    await type('Giá ');
    await tool('Bold text').click();
    await expect(tool('Bold text')).toHaveAttribute('aria-pressed', 'true');
    await type('200.000đ');
    await tool('Bold text').click();
    await type('/giờ, ');
    await press('ControlOrMeta+i');
    await type('ưu đãi');
    await press('ControlOrMeta+i');
    await type(' cuối tuần.');
    await press('Enter');
    await tool('Bullet list').click();
    await type('Phòng A');
    await press('Enter', 'Tab');
    await type('có gương');
    await press('Enter', 'Shift+Tab');
    await type('Phòng B');
    await press('Enter', 'Enter');
    await tool('Numbered list').click();
    await type('Đăng nhập');
    await press('Enter');
    await type('Chọn giờ');
    await press('Enter', 'Enter');
    await tool('Small heading').click();
    await type('Lưu ý');
    await press('Enter');
    await tool('Quote block').click();
    await type('Đến đúng giờ.');
    await press('Enter', 'Enter');
    await tool('Divider line').click();
    await type('Hết.');
    await expect(text().locator('h2')).toHaveText('Giá phòng');
    await expect(text().locator('ul ul li')).toHaveText('có gương');
    await expectStored(
        id,
        '## Giá phòng\n\nGiá **200.000đ**/giờ, *ưu đãi* cuối tuần.\n\n- Phòng A\n  - có gương\n- Phòng B\n\n1. Đăng nhập\n2. Chọn giờ\n\n### Lưu ý\n\n> Đến đúng giờ.\n\n---\n\nHết.'
    );
});

test('undoing a change is not an edit; the words keep their marks in the bar over a selection', async () => {
    const id = await open('Giá **200.000đ** một giờ, _chưa gồm_ gửi xe.');
    await expect(save()).toBeDisabled();
    await text().click();
    await press('End');
    await type('!');
    await expect(page.locator('.kbUnsaved')).toBeVisible();
    await tool('Undo the change').click();
    await expect(page.locator('.kbUnsaved')).toHaveCount(0);
    await expect(save()).toBeDisabled();

    await text().getByText('gửi xe').dblclick();
    const bar = page.locator('.kbBubble');
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Bold text' }).click();
    await expect(text().locator('strong')).toHaveCount(2);
    await save().click();
    await expect(save()).toBeDisabled();
    expect(await bodyOf(id)).toMatch(/^Giá \*\*200\.000đ\*\* một giờ, \*chưa gồm\* .*\*\*.+\*\*/);
});

test('the "/" menu: arrows, mouse, words with or without accents, Escape; a plain slash stays a slash', async () => {
    const id = await open('');
    await text().click();
    await type('/');
    await expect(menu().getByRole('option')).toHaveCount(7);
    await press('ArrowDown');
    await expect(menu().getByRole('option', { selected: true })).toContainText('Small heading');
    await press('ArrowUp', 'Enter');
    await expect(menu()).toHaveCount(0);
    await type('Một');
    await press('Enter');

    await type('/num');
    await expect(menu().getByRole('option')).toHaveCount(1);
    await press('Enter');
    await type('bước');
    await press('Enter', 'Enter');

    await type('/');
    await menu().getByRole('option', { name: /Quote block/ }).click();
    await type('ghi chú');
    await press('Enter', 'Enter');

    // Vietnamese names too, accents or not, with spaces.
    await type('/trich dan');
    await expect(menu().getByRole('option')).toHaveCount(1);
    await press('Escape');
    await expect(menu()).toHaveCount(0);
    await press('ControlOrMeta+Shift+ArrowLeft', 'Backspace', 'Home', 'Shift+End', 'Backspace');

    await type('200.000đ/giờ, thứ 2 / thứ 3, và/hoặc');
    await expect(menu()).toHaveCount(0);
    await press('Enter');
    await type('xong /zzz');
    await expect(menu()).toHaveCount(0);
    await press('Enter');
    await expectStored(id, '## Một\n\n1. bước\n\n> ghi chú\n\n200.000đ/giờ, thứ 2 / thứ 3, và/hoặc\n\nxong /zzz');
});

test('tables: written cell by cell, rows and columns added and deleted, the first row stays the header', async () => {
    const id = await open('Trước');
    await text().click();
    await press('End', 'Enter');
    await tool('Insert table').click();
    await type('Phòng');
    await press('Tab');
    await type('Giá | giờ');
    await press('Tab');
    await type('A');
    await press('Enter');
    await type('200.000đ');
    await press('Enter');
    await type('B');
    await press('Enter');
    await type('150.000đ');
    // The last cell: Enter makes a new row.
    await press('Enter');
    await type('C');
    await press('Enter');
    await type('100.000đ');
    await expect(text().locator('tr')).toHaveCount(4);
    // Only words go in a cell.
    await expect(tool('Section heading')).toBeDisabled();
    await expect(tool('Bullet list')).toBeDisabled();
    await expect(tool('Insert table')).toBeDisabled();

    const table = (action) => page.getByRole('toolbar', { name: 'This table' }).getByRole('button', { name: action, exact: true }).click();
    await table('Add a column on the right');
    await press('Tab');
    await type('m2');
    await table('Delete this column');
    await text().getByText('150.000đ').click();
    await table('Delete this row');
    await expect(text().locator('tr')).toHaveCount(3);
    await table('Add a row below');
    await expectStored(id, 'Trước\n\n| Phòng | Giá \\| giờ |\n| - | - |\n| A | 200.000đ |\n| C | 100.000đ |');

    // The header deleted: the next row is the header.
    await text().locator('th').first().click();
    await table('Delete this row');
    await expect(text().locator('th')).toHaveText(['A', '200.000đ']);
    await expectStored(id, 'Trước\n\n| A | 200.000đ |\n| - | - |\n| C | 100.000đ |');
    await text().locator('td').first().click();
    await table('Delete the table');
    await expectStored(id, 'Trước');
});

test('links: on words, on their own, changed and removed; only web addresses and emails', async () => {
    const id = await open('Xem bảng giá nhé');
    const address = page.getByLabel('Link address');
    await text().getByText('Xem bảng giá nhé').dblclick({ position: { x: 5, y: 8 } });
    await press('ControlOrMeta+k');
    await address.fill('javascript:alert(1)');
    await press('Enter');
    await expect(page.getByText('Type a web address (https://…) or an email.')).toBeVisible();
    await address.fill('oopsdance.vn/gia');
    await press('Enter');
    await expect(address).toHaveCount(0);
    await expect(text().locator('a')).toHaveAttribute('href', 'https://oopsdance.vn/gia');
    await expectStored(id, '[Xem](https://oopsdance.vn/gia) bảng giá nhé');

    await text().locator('a').click();
    await tool('Add a link').click();
    await expect(address).toHaveValue('https://oopsdance.vn/gia');
    await address.fill('hello@oopsdance.vn');
    await page.getByRole('button', { name: 'Set the link' }).click();
    await expect(text().locator('a')).toHaveAttribute('href', 'mailto:hello@oopsdance.vn');
    await text().locator('a').click();
    await tool('Add a link').click();
    await page.getByRole('button', { name: 'Remove the link' }).click();
    await expect(text().locator('a')).toHaveCount(0);

    // Nothing selected: the address itself, written plainly.
    await text().click();
    await press('ControlOrMeta+End');
    await type(' ');
    await tool('Add a link').click();
    await address.fill('https://oopsdance.vn');
    await press('Enter');
    await expectStored(id, 'Xem bảng giá nhé https://oopsdance.vn');
    // Escape leaves everything as it was.
    await tool('Add a link').click();
    await press('Escape');
    await expect(address).toHaveCount(0);
    await expect(save()).toBeDisabled();
});

test('characters that mean something in Markdown are stored as they are typed, and come back', async () => {
    const id = await open('');
    const line = 'Giá 1.000 * 2 < 3.000 & R&B, [ngoặc], a_b_c@x.vn, https://x.vn/a_b, 200k ~ 300k, 50% #1';
    await text().click();
    await type(line);
    await press('Enter');
    await type('<script>window.hacked = true</script>');
    await expectStored(id, `${line}\n\n\\<script>window.hacked = true\\</script>`);
    await expect(text().locator('p').nth(0)).toHaveText(line);
    await expect(text().locator('p').nth(1)).toHaveText('<script>window.hacked = true</script>');
    expect(await page.evaluate(() => window.hacked)).toBeUndefined();
});

test('pasted from Google Docs, Word and a spreadsheet: headings, lists, tables, bold and links stay, the rest goes', async () => {
    const docs = await open('');
    await paste({
        'text/html':
            '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><h1 dir="ltr"><span style="color:#f00;font-size:20pt">Nội quy</span></h1><p><span style="font-weight:700">Đến</span><span> đúng&nbsp;giờ </span><a href="https://x.vn/a"><span>xem</span></a></p><ul><li><p><span>Giày sạch</span></p></li><ul><li><p>Đế mềm</p></li></ul></ul><p><img src="https://example.com/a.png" alt="x"></p></b>',
        'text/plain': 'Nội quy',
    });
    await expectStored(docs, '## Nội quy\n\n**Đến** đúng giờ [xem](https://x.vn/a)\n\n- Giày sạch\n  - Đế mềm');

    const word = await open('');
    const item = (level, marker, words) =>
        `<p class=MsoListParagraph style='margin-left:.5in;mso-list:l0 level${level} lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>${marker}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>${words}<o:p></o:p></p>`;
    await paste({
        'text/html': `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p{color:red}</style></head><body><h2>Đặt phòng<o:p></o:p></h2><p class=MsoNormal><b>Cọc</b> 50%<o:p></o:p></p>${item(1, '·', 'Một')}${item(2, 'o', 'Con')}${item(1, '·', 'Hai')}<p class=MsoNormal>Các bước<o:p></o:p></p>${item(1, '1.', 'Chọn')}${item(1, '2.', 'Trả tiền')}<table class=MsoTableGrid><tr><td><p class=MsoNormal>Phòng</p></td><td><p>Giá</p></td></tr><tr><td><p>A</p><p>tầng 2</p></td><td><p>200</p></td></tr></table></body></html>`,
        'text/plain': 'Đặt phòng',
    });
    await expectStored(word, '## Đặt phòng\n\n**Cọc** 50%\n\n- Một\n  - Con\n- Hai\n\nCác bước\n\n1. Chọn\n2. Trả tiền\n\n| Phòng | Giá |\n| - | - |\n| A tầng 2 | 200 |');

    const sheet = await open('');
    await paste({
        'text/html': '<table><tbody><tr><td colspan="2">Bảng giá</td></tr><tr><td>A</td><td>200.000</td></tr><tr><td>B</td><td></td></tr></tbody></table>',
        'text/plain': 'Bảng giá\nA\t200.000',
    });
    await expectStored(sheet, '| Bảng giá | |\n| - | - |\n| A | 200.000 |\n| B | |');
});

test('pasted Markdown becomes what it says; plain words stay plain; a cell takes one line', async () => {
    const markdown = '## Huỷ phòng\n\n- Trước **24 giờ**: hoàn 100%\n- Sau: không hoàn\n\n| Khi | Hoàn |\n| - | - |\n| Sớm | 100% |';
    const id = await open('');
    await paste({ 'text/plain': markdown });
    await expectStored(id, markdown);

    const plain = await open('');
    await paste({ 'text/plain': 'Một dòng, 2 * 3\nDòng nữa' });
    await expectStored(plain, 'Một dòng, 2 * 3\n\nDòng nữa');

    const cell = await open('| A | B |\n| - | - |\n| x | y |');
    await text().locator('td').first().click();
    await press('End');
    await paste({ 'text/html': '<p>một</p><ul><li>hai</li><li>ba</li></ul>', 'text/plain': 'một\nhai\nba' });
    await expectStored(cell, '| A | B |\n| - | - |\n| xmột hai ba | y |');
});

test('Markdown copied from VS Code (coloured HTML next to it) is read as Markdown; its "# …" becomes the title when there is none', async () => {
    const file = '# Chọn lớp cho người mới\n\n_Nội dung mẫu._\n\n## Các phong cách\n- **K-pop Dance**: dễ theo.\n- **Choreo**: cho người đã học.\n\n| Lớp | Trình độ |\n| --- | --- |\n| K-pop | Cơ bản |';
    // What VS Code puts next to the text: a div per line, coloured spans, headings in bold.
    const coloured = (markdown) =>
        `<meta charset="utf-8"><div style="color: #cccccc;background-color: #1f1f1f;font-family: Menlo, Monaco, 'Courier New', monospace;white-space: pre;">${markdown
            .split('\n')
            .map((line) => (line ? `<div><span style="color: ${line.startsWith('#') ? '#569cd6;font-weight: bold' : '#cccccc'};">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span></div>` : '<br>'))
            .join('')}</div>`;
    const id = await make('');
    await page.goto(`/admin/knowledge/${id}`);
    await page.getByLabel('Article title').fill('');
    await text().click();
    await paste({ 'text/html': coloured(file), 'text/plain': file });
    await expect(page.getByLabel('Article title')).toHaveValue('Chọn lớp cho người mới');
    await expect(text().locator('h2')).toHaveText('Các phong cách');
    await expect(text().locator('strong')).toHaveText(['K-pop Dance', 'Choreo']);
    await expect(text()).not.toContainText('#');
    await expectStored(id, '*Nội dung mẫu.*\n\n## Các phong cách\n\n- **K-pop Dance**: dễ theo.\n- **Choreo**: cho người đã học.\n\n| Lớp | Trình độ |\n| - | - |\n| K-pop | Cơ bản |');
    expect((await rest(jwt, `knowledge_articles?select=title&id=eq.${id}`)).data[0].title).toBe('Chọn lớp cho người mới');

    // A title already there stays; the "# …" is a heading below it. Rich text (a web page) is pasted as such, where
    // "**…**" typed in it still turns bold.
    const titled = await open('');
    await paste({ 'text/html': coloured('# Một\n\n- hai'), 'text/plain': '# Một\n\n- hai' });
    await expect(page.getByLabel('Article title')).toHaveValue(`E2E editor ${RUN} ${count}`);
    await expectStored(titled, '## Một\n\n- hai');
    const page2 = await open('');
    await paste({ 'text/html': '<p>Giá <b>**200k**</b></p>', 'text/plain': 'Giá **200k**' });
    await expectStored(page2, 'Giá **200k**');
});

test('templates: pick one, fill its highlighted blanks (a click selects one); publishing waits until none is left', async () => {
    await page.goto('/admin/knowledge/new');
    const picker = page.getByRole('region', { name: 'Start from a template' });
    await expect(picker.getByRole('button')).toHaveCount(4);
    await picker.getByRole('button', { name: /A question customers ask/ }).click();
    await expect(picker).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Article category/ })).toContainText('FAQ');
    await expect(page.getByText('The question, as customers ask it: “Can I park my motorbike?”')).toBeVisible();
    const blanks = text().locator('.kbBlank');
    await expect(blanks).toHaveCount(4);
    // The first blank is selected: typing replaces it.
    await type('Có, gửi xe máy miễn phí ở tầng hầm.');
    await expect(blanks).toHaveCount(3);
    await expect(text().locator('p').first()).toHaveText('Có, gửi xe máy miễn phí ở tầng hầm.');

    await page.getByLabel('Article title').fill(`E2E editor ${RUN} template`);
    await page.locator('.kbEditorActions').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.kbMissing')).toContainText('Fill in the blanks left in {{…}}.');
    // A draft may keep them.
    await page.locator('.kbEditorActions').getByRole('button', { name: 'Save draft' }).click();
    await expect(page).toHaveURL(/\/admin\/knowledge\/\d+$/);
    const id = Number(page.url().split('/').pop());
    made.push(id);
    expect(await bodyOf(id)).toContain('{{Ý thứ nhất}}');

    for (const words of ['Xe máy: tầng hầm', 'Ô tô: không có chỗ', 'Hỏi lễ tân.']) {
        await blanks.first().click();
        await type(words);
    }
    await expect(blanks).toHaveCount(0);
    await page.locator('.kbEditorActions').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.kbEditorTitle .kbPill')).toHaveText('Published');
    expect(await bodyOf(id)).toBe('Có, gửi xe máy miễn phí ở tầng hầm.\n\n## Chi tiết\n\n- Xe máy: tầng hầm\n- Ô tô: không có chỗ\n\n## Cần hỏi thêm\n\nHỏi lễ tân.');

    // Every template opens as it looks, with nothing only Markdown can show.
    for (const name of ['A rule with money in it', 'About a class', 'House rules']) {
        await page.goto('/admin/knowledge/new');
        // The template picked the time before is an unsaved draft: asked about, and thrown away.
        await expect(page.locator('.kbTemplates, [role="dialog"]').first()).toBeVisible();
        if (await page.getByRole('dialog').count()) await page.getByRole('dialog').getByRole('button', { name: 'Discard it' }).click();
        await page.getByRole('region', { name: 'Start from a template' }).getByRole('button', { name: new RegExp(name) }).click();
        await expect(text().locator('.kbBlank').first()).toBeVisible();
        await expect(page.locator('.kbForm .kbNotice')).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard it' }).click();
    await expect(page).toHaveURL(/\/admin\/knowledge$/);
});

test('Vietnamese: composed by an input method, or retyped letter by letter as Unikey does', async () => {
    const id = await open('');
    await text().click();
    // An input method composes "viet" → "việt" before giving it to the page.
    const cdp = await page.context().newCDPSession(page);
    for (const composing of ['v', 'vi', 'viê', 'việ', 'việt']) await cdp.send('Input.imeSetComposition', { text: composing, selectionStart: composing.length, selectionEnd: composing.length });
    await cdp.send('Input.insertText', { text: 'việt' });
    await type(' ');
    // Unikey / EVKey: the plain letters, then Backspace and the accented ones.
    await type('nhay');
    await press('Backspace', 'Backspace');
    await page.keyboard.insertText('ảy');
    await type(' /');
    await press('Escape', 'Backspace');
    await page.keyboard.insertText('đẹp');
    await expect(text()).toHaveText('việt nhảy đẹp');
    await expectStored(id, 'việt nhảy đẹp');
});

test('a text it can’t show opens as Markdown, untouched, and says why', async () => {
    const body = 'Trước\n\n![ảnh](https://example.com/a.png)\n\n- [ ] việc\n\n<div>khung</div>';
    const id = await open(body);
    const notice = page.locator('.kbForm .kbNotice');
    await expect(notice).toContainText('only Markdown can show');
    for (const thing of ['images', 'checklists', 'HTML']) await expect(notice).toContainText(thing);
    await expect(text()).toHaveValue(body);
    await expect(page.locator('.kbPreviewCol')).toBeVisible();
    await expect(save()).toBeDisabled();
    // Asking for the visual editor doesn't lose it either.
    await page.getByRole('button', { name: 'Write as it looks' }).click();
    await expect(notice).toContainText('only Markdown can show');
    await expect(text()).toHaveValue(body);
    expect(await bodyOf(id)).toBe(body);
    // Without those things it can be written as it looks.
    await text().fill('Trước\n\n- việc');
    await page.getByRole('button', { name: 'Write as it looks' }).click();
    await expect(text().locator('li')).toHaveText('việc');
    await page.getByRole('button', { name: 'Write in Markdown' }).click();
    await expect(text()).toHaveValue('Trước\n\n- việc');
});

test('what was left unsaved, and discarding it, show in the editor', async () => {
    const id = await open('Bản đã lưu');
    await text().click();
    await press('End');
    await type(' và thêm');
    await page.reload();
    await page.getByRole('dialog').getByRole('button', { name: 'Carry on writing' }).click();
    await expect(text()).toHaveText('Bản đã lưu và thêm');
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard it' }).click();
    await expect(text()).toHaveText('Bản đã lưu');
    await expect(save()).toBeDisabled();
    expect(await bodyOf(id)).toBe('Bản đã lưu');
});

test('the editor doesn’t load: the Markdown box takes over, nothing is lost', async ({ browser }) => {
    const id = await make('## Còn nguyên');
    const other = await browser.newPage();
    await login(other, 'staff@demo.oopsdance.test');
    await other.route('**/editor/VisualEditor*', (route) => route.abort());
    await other.goto(`/admin/knowledge/${id}`);
    await expect(other.locator('.kbForm .kbNotice')).toContainText('The visual editor didn’t open');
    await expect(other.getByLabel('Article text')).toHaveValue('## Còn nguyên');
    await other.getByLabel('Article text').fill('## Còn nguyên\n\nvà sửa được');
    await other.locator('.kbEditorActions').getByRole('button', { name: 'Save draft' }).click();
    await expect(other.locator('.kbUnsaved')).toHaveCount(0);
    expect(await bodyOf(id)).toBe('## Còn nguyên\n\nvà sửa được');
    await other.close();
});

test('it works on a phone, and in Vietnamese', async () => {
    await page.locator('.adminTopBar').getByRole('button', { name: 'Tiếng Việt' }).click();
    const id = await make('Điện thoại');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/knowledge/${id}`);
    const box = page.getByLabel('Nội dung tài liệu');
    await box.click();
    await press('End', 'Enter');
    await type('/bảng');
    await expect(page.getByRole('listbox', { name: 'Chèn' }).getByRole('option')).toHaveCount(1);
    await press('Enter');
    await type('Cột');
    await expect(page.getByRole('toolbar', { name: 'Bảng này' })).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('.adminMain').scrollWidth <= document.querySelector('.adminMain').clientWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await page.evaluate(() => [...(window.__i18nMissing ?? [])])).toEqual([]);
    await page.locator('.adminTopBar').getByRole('button', { name: 'English' }).click();
    await expect(page.getByLabel('Article text')).toBeVisible();
});

test('Markdown ⇄ editor: whatever is written reads back the same (a thousand made-up texts)', async () => {
    await page.goto('/admin/knowledge');
    const result = await page.evaluate(async (path) => {
        const { readMarkdown, sameAsDoc, sameMarkdown, writeMarkdown } = await import(path);
        let seed = 7;
        const random = () => {
            seed = (seed + 0x6d2b79f5) | 0;
            let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
            return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
        };
        const pick = (list) => list[Math.floor(random() * list.length)];
        const many = (n, fn) => Array.from({ length: Math.floor(random() * n) + 1 }, fn);
        const BITS = ['a', 'đậm', ' ', ' ', '*', '**', '_', '#', '# ', '1. ', '- ', '+ ', '> ', '|', '\\', '`', '~', '<', '<b>', '&', '&lt;', '[', ']', '[ ] ', '(', ')', '!', ':', '@', 'a@b.vn', 'http://x.vn', 'www.x.vn', '---', '===', '.', '1)', '200.000đ/giờ', '[^1]'];
        const words = () => many(6, () => pick(BITS)).join('');
        const inline = () =>
            many(4, () => {
                const marks = ['bold', 'italic', 'strike'].filter(() => random() < 0.25).map((name) => ({ type: name }));
                return random() < 0.05 ? { type: 'hardBreak' } : { type: 'text', text: words(), ...(marks.length && { marks }) };
            });
        const paragraph = () => ({ type: 'paragraph', content: inline() });
        const list = (deep) => ({ type: pick(['bulletList', 'orderedList']), content: many(3, () => ({ type: 'listItem', content: [paragraph(), ...(deep && random() < 0.3 ? [list(deep - 1)] : [])] })) });
        const table = () => {
            const width = Math.floor(random() * 3) + 1;
            return { type: 'table', content: many(3, () => 0).map((_, y) => ({ type: 'tableRow', content: Array.from({ length: width }, () => ({ type: y ? 'tableCell' : 'tableHeader', content: [paragraph()] })) })) };
        };
        const block = () => pick([paragraph, paragraph, () => ({ type: 'heading', attrs: { level: 2 }, content: inline() }), () => list(2), () => ({ type: 'blockquote', content: many(2, paragraph) }), table, () => ({ type: 'horizontalRule' })])();
        const letters = (node) => `${node.text ?? ''}${(node.content ?? []).map(letters).join('')}`.replace(/\s/g, '');
        const wrong = [];
        for (let i = 0; i < 1000; i += 1) {
            const doc = { type: 'doc', content: many(4, block) };
            const out = writeMarkdown(doc);
            const back = readMarkdown(out);
            if (back.unsupported.length || !sameAsDoc(out, doc) || !sameMarkdown(writeMarkdown(back.doc), out) || letters(doc) !== letters(back.doc)) wrong.push(out);
        }
        return wrong.slice(0, 3);
    }, EDITOR);
    expect(result).toEqual([]);
});
