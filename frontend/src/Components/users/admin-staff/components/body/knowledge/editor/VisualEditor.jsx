import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { LuLink } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { fold } from '../../user-manager/peopleModel';
import { INSERTS, MARKS } from './actions';
import EditorToolbar, { ToolButton } from './EditorToolbar';
import { editorExtensions, firstBlank } from './extensions';
import LinkBar from './LinkBar';
import { readMarkdown, sameAsDoc, writeMarkdown } from './markdown';
import { cleanPastedHtml, isColouredText, looksLikeMarkdown } from './paste';
import SlashMenu from './SlashMenu';

// Loaded on demand (KnowledgeEditor). Writing as it will look: a toolbar, "/" to insert, a small bar over selected words.
// The text goes in and comes out as Markdown; a change that says the same as `saved` gives `saved` back, so opening an
// article or undoing a change isn't an edit. A text with things the editor can't show isn't touched: onUnsupported
// ([English labels]) and the Markdown box takes over.
const VisualEditor = ({ value, saved, onChange, onUnsupported, onTitle, label, fillToken = 0 }) => {
    const { t, lang } = useI18n();
    const [start] = useState(() => readMarkdown(value));
    const [checked, setChecked] = useState(false);
    const [slash, setSlash] = useState(null);
    const [linking, setLinking] = useState(false);
    const slashKeys = useRef(() => false);
    const given = useRef(value); // the text the parent has from here
    const whole = useRef(false); // everything in that text is in the editor: until then, nothing is given back
    const live = useRef({});
    live.current = { t, label, saved, onChange, onUnsupported, onTitle };

    // Made once: they read what changes through `live` (a new array each time would set the editor up again).
    const [extensions] = useState(() =>
        editorExtensions({
            placeholder: () => live.current.t('Write here, or type / to add a heading, a list, a table…'),
            onLink: () => setLinking(true),
            slash: {
                // "/tieu de", but not "Thứ 2 / Thứ 3".
                items: (query) => {
                    if (query.startsWith(' ')) return [];
                    const words = fold(query).trim();
                    return INSERTS.filter((item) => fold(`${live.current.t(item.label)} ${item.label} ${item.words}`).includes(words));
                },
                onChange: (state) => setSlash(state && { items: state.items, query: state.query, command: state.command, clientRect: state.clientRect }),
                onKey: (event) => slashKeys.current(event),
            },
        })
    );
    const editorRef = useRef(null);
    const [editorProps] = useState(() => ({
        attributes: () => ({ role: 'textbox', 'aria-multiline': 'true', 'aria-label': live.current.label, class: 'kbMarkdown kbProse' }),
        transformPastedHTML: cleanPastedHtml,
        handlePaste: (view, event, slice) => pasteInto(editorRef.current, event, slice, (title) => live.current.onTitle?.(title)),
    }));
    const editor = useEditor({
        extensions,
        editorProps,
        content: start.doc,
        onBlur: () => setSlash(null),
        onUpdate: ({ editor: current }) => {
            if (!whole.current) return;
            const doc = current.getJSON();
            const { saved: before, onChange: change } = live.current;
            given.current = sameAsDoc(before, doc) ? before : writeMarkdown(doc);
            change(given.current);
        },
    });
    editorRef.current = editor;

    // Is everything in the text really in the editor? (Schemas drop what they don't know without a word.)
    const check = (text, { unsupported }) => {
        const lost = unsupported.length ? unsupported : sameAsDoc(text, editor.getJSON()) ? [] : ['other formatting'];
        whole.current = lost.length === 0;
        if (lost.length) live.current.onUnsupported(lost);
        return whole.current;
    };
    useEffect(() => {
        if (editor && check(value, start)) setChecked(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for the text it opened with
    }, [editor]);

    // The text changed elsewhere (discarded, carried on…).
    useEffect(() => {
        if (!editor || value === given.current) return;
        given.current = value;
        whole.current = false;
        const next = readMarkdown(value);
        editor.commands.setContent(next.doc, { emitUpdate: false });
        check(value, next);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the text is another one
    }, [editor, value]);

    // A template was picked: its first blank is selected, ready to be typed over.
    useEffect(() => {
        if (!editor || !fillToken) return;
        const blank = firstBlank(editor.state.doc);
        if (blank) editor.chain().focus().setTextSelection(blank).scrollIntoView().run();
    }, [editor, fillToken]);

    // Another language: drawn again, for its label and its placeholder. (Never touch view.dom here: the view may not be
    // on the page yet, or any more.)
    useEffect(() => {
        if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false));
    }, [editor, label, lang]);

    if (!editor) return null;
    return (
        <div className="kbVisual" hidden={!checked}>
            <EditorToolbar editor={editor} onLink={() => setLinking(true)} />
            {linking && <LinkBar editor={editor} onClose={() => setLinking(false)} />}
            <BubbleMenu editor={editor} className="kbBubble" options={{ placement: 'bottom', offset: 8 }} shouldShow={({ editor: current, from, to }) => from !== to && !current.isActive('codeBlock') && current.state.doc.textBetween(from, to).trim() !== ''}>
                {MARKS.map((action) => (
                    <ToolButton
                        key={action.key}
                        label={t(action.label)}
                        icon={action.icon}
                        onPress={() => action.run(editor.chain().focus()).run()}
                    />
                ))}
                <ToolButton label={t('Add a link')} icon={LuLink} onPress={() => setLinking(true)} />
            </BubbleMenu>
            <EditorContent editor={editor} className="kbVisualText" />
            {slash && <SlashMenu state={slash} keys={slashKeys} onClose={() => setSlash(null)} />}
        </div>
    );
};

// Markdown copied as text (from a .md file, VS Code, a chat) becomes what it says: its "# …" heading the article's title
// when there is none yet (takeTitle → true when taken), the others below it; images and HTML in it are left out, as
// they are from any paste. In a table cell everything is one line. → true when handled here.
function pasteInto(editor, event, slice, takeTitle) {
    const data = event.clipboardData;
    if (!editor || !data) return false;
    if (editor.isActive('table')) {
        if (slice.content.childCount <= 1 && slice.content.firstChild?.isTextblock) return false;
        if (slice.content.firstChild?.type.spec.tableRole) return false;
        const text = slice.content.textBetween(0, slice.content.size, ' ', ' ').replace(/\s+/g, ' ').trim();
        if (text) editor.chain().insertContent({ type: 'text', text }).run();
        return true;
    }
    if (editor.isActive('codeBlock')) return false;
    const text = data.getData('text/plain');
    const html = data.getData('text/html');
    if (!looksLikeMarkdown(text) || (html && (html.includes('data-pm-slice') || !isColouredText(html)))) return false;
    const blocks = readMarkdown(text).doc.content;
    const [first] = blocks;
    // The title is the page's heading: the text's headings start below it.
    const content = blocks.map((node) => (node.type === 'heading' && node.attrs?.level === 1 ? { ...node, attrs: { ...node.attrs, level: 2 } } : node));
    if (first?.type === 'heading' && first.attrs?.level === 1) {
        const title = (first.content ?? []).map((child) => child.text ?? '').join('').trim();
        if (title && takeTitle(title)) content.shift();
    }
    return content.length ? editor.chain().insertContent(content).run() : true;
}

export default VisualEditor;
