import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import Suggestion from '@tiptap/suggestion';
import { BLANK } from '../templates';

// A cell is one line of text: all a Markdown table can hold.
const OneLine = { content: 'paragraph' };

// Enter goes to the next cell, as Tab does (a new row after the last one); cells have no line breaks.
const TableKeys = Extension.create({
    name: 'tableKeys',
    priority: 1000,
    addKeyboardShortcuts() {
        const inTable = () => this.editor.isActive('table');
        return {
            Enter: () => inTable() && (this.editor.commands.goToNextCell() || this.editor.chain().addRowAfter().goToNextCell().run()),
            'Shift-Enter': inTable,
            'Mod-Enter': inTable,
        };
    },
});

// "/" at the start of a line or after a space: the menu of things to insert. The menu itself is React (SlashMenu.jsx):
// onChange gets the suggestion's state (null = closed), onKey the keys pressed while it is open (true = handled).
const SlashCommands = Extension.create({
    name: 'slashCommands',
    addOptions: () => ({ items: () => [], onChange: () => {}, onKey: () => false }),
    addProseMirrorPlugins() {
        const { items, onChange, onKey } = this.options;
        return [
            Suggestion({
                editor: this.editor,
                char: '/',
                allowSpaces: true,
                allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name === 'paragraph' && !this.editor.isActive('table'),
                items: ({ query }) => items(query),
                command: ({ editor, range, props }) => props.insert(editor.chain().focus().deleteRange(range)).run(),
                render: () => ({
                    onStart: onChange,
                    onUpdate: onChange,
                    onKeyDown: ({ event }) => onKey(event),
                    onExit: () => onChange(null),
                }),
            }),
        ];
    },
});

// The blanks of a template ({{…}}): highlighted, and a click selects the whole of one, so typing replaces it.
const blanksOf = (doc) => {
    const found = [];
    doc.descendants((node, pos) => {
        if (node.isText) for (const match of node.text.matchAll(BLANK)) found.push({ from: pos + match.index, to: pos + match.index + match[0].length });
    });
    return found;
};
export const firstBlank = (doc) => blanksOf(doc)[0] ?? null;
const Blanks = Extension.create({
    name: 'blanks',
    addProseMirrorPlugins: () => [
        new Plugin({
            key: new PluginKey('blanks'),
            props: {
                decorations: (state) => DecorationSet.create(state.doc, blanksOf(state.doc).map(({ from, to }) => Decoration.inline(from, to, { class: 'kbBlank' }))),
                handleClick: (view, pos) => {
                    const blank = blanksOf(view.state.doc).find(({ from, to }) => pos >= from && pos <= to);
                    if (!blank) return false;
                    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, blank.from, blank.to)));
                    return true;
                },
            },
        }),
    ],
});

export const editorExtensions = ({ placeholder, slash, onLink }) => [
    StarterKit.configure({
        underline: false,
        link: { openOnClick: false, autolink: false, linkOnPaste: true, defaultProtocol: 'https', HTMLAttributes: { rel: 'noopener noreferrer', target: null } },
    }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader.extend(OneLine),
    TableCell.extend(OneLine),
    Placeholder.configure({ placeholder }),
    TableKeys,
    Blanks,
    SlashCommands.configure(slash),
    Extension.create({
        name: 'linkKey',
        addKeyboardShortcuts: () => ({
            'Mod-k': () => {
                onLink();
                return true;
            },
        }),
    }),
];
