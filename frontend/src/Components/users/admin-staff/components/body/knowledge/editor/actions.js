import { LuBold, LuHeading, LuItalic, LuList, LuListOrdered, LuMinus, LuQuote, LuTable, LuType } from 'react-icons/lu';

// What the toolbar and the "/" menu do. Labels are English i18n keys; `words` are other names someone may type after
// "/" (no accents). run(chain): the toolbar's (a second press takes it back); insert(chain): the menu's.
const heading = (level) => ({
    run: (chain) => chain.toggleHeading({ level }),
    insert: (chain) => chain.setHeading({ level }),
    isActive: (editor) => editor.isActive('heading', { level }),
});

export const MARKS = [
    { key: 'bold', label: 'Bold text', icon: LuBold, shortcut: 'B', run: (chain) => chain.toggleBold(), isActive: (editor) => editor.isActive('bold') },
    { key: 'italic', label: 'Italic text', icon: LuItalic, shortcut: 'I', run: (chain) => chain.toggleItalic(), isActive: (editor) => editor.isActive('italic') },
];

export const HEADINGS = [
    { key: 'heading', label: 'Section heading', hint: 'Starts a new part', icon: LuHeading, words: 'heading tieu de muc lon h2', ...heading(2) },
    { key: 'subheading', label: 'Small heading', hint: 'A part inside a part', icon: LuType, words: 'heading tieu de nho h3', ...heading(3) },
];

export const BLOCKS = [
    { key: 'bullets', label: 'Bullet list', hint: 'Points in any order', icon: LuList, words: 'danh sach gach dau dong cham', run: (chain) => chain.toggleBulletList(), isActive: (editor) => editor.isActive('bulletList') },
    { key: 'numbers', label: 'Numbered list', hint: 'Steps, in order', icon: LuListOrdered, words: 'danh sach so thu tu buoc', run: (chain) => chain.toggleOrderedList(), isActive: (editor) => editor.isActive('orderedList') },
    {
        key: 'table',
        label: 'Insert table',
        hint: 'Prices, timetables',
        icon: LuTable,
        words: 'bang gia table',
        run: (chain) => chain.insertTable({ rows: 3, cols: 2, withHeaderRow: true }),
        isActive: () => false,
    },
    { key: 'quote', label: 'Quote block', hint: 'A note that stands out', icon: LuQuote, words: 'trich dan ghi chu luu y', run: (chain) => chain.toggleBlockquote(), isActive: (editor) => editor.isActive('blockquote') },
    { key: 'divider', label: 'Divider line', hint: 'Between two parts', icon: LuMinus, words: 'duong ke ngang vach', run: (chain) => chain.setHorizontalRule(), isActive: () => false },
].map((action) => ({ insert: action.run, ...action }));

export const INSERTS = [...HEADINGS, ...BLOCKS];

// A typed address as a link, or null: "oopsdance.vn" → https, an email → mailto; only web, email and phone links.
export function linkOf(typed) {
    const text = typed.trim();
    if (/^(https?:\/\/|mailto:|tel:)\S+$/i.test(text)) return text;
    if (/^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/.test(text)) return `mailto:${text}`;
    if (/^[\w-]+(\.[\w-]+)+([/?#]\S*)?$/.test(text)) return `https://${text}`;
    return null;
}
