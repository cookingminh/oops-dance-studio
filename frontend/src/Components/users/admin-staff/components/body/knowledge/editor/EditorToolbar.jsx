import { useEditorState } from '@tiptap/react';
import { LuLink, LuRedo2, LuUndo2 } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { BLOCKS, HEADINGS, MARKS } from './actions';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const shortcutText = (key) => (isMac ? `⌘${key}` : `Ctrl+${key}`);

const GROUPS = [MARKS, HEADINGS, BLOCKS];
const ALL = GROUPS.flat();

// A toolbar button. Pressing it keeps the editor's selection and focus.
export const ToolButton = ({ label, shortcut, icon: Icon, active, disabled, inWords = false, onPress }) => (
    <button
        type="button"
        className={`kbTool${inWords ? ' isWords' : ''}`}
        aria-label={label}
        aria-pressed={active}
        title={shortcut ? `${label} (${shortcutText(shortcut)})` : label}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onPress}
    >
        <Icon aria-hidden="true" />
        {inWords && <span aria-hidden="true">{label}</span>}
    </button>
);

// Rows and columns of the table the cursor is in. The first row is the header: deleting it makes the next one the header.
const TABLE_ACTIONS = [
    { key: 'rowBelow', label: 'Add a row below', run: (chain) => chain.addRowAfter() },
    { key: 'columnRight', label: 'Add a column on the right', run: (chain) => chain.addColumnAfter() },
    { key: 'deleteRow', label: 'Delete this row', run: (chain) => chain.deleteRow() },
    { key: 'deleteColumn', label: 'Delete this column', run: (chain) => chain.deleteColumn() },
    { key: 'deleteTable', label: 'Delete the table', run: (chain) => chain.deleteTable() },
];

// The header row is always there, and only there.
function keepHeader(editor) {
    const { state, view, schema } = editor;
    const { tableHeader, tableCell } = schema.nodes;
    const tr = state.tr;
    state.doc.descendants((node, pos) => {
        if (node.type.name !== 'table') return true;
        node.forEach((row, rowPos, rowIndex) =>
            row.forEach((cell, cellPos) => {
                const type = rowIndex === 0 ? tableHeader : tableCell;
                if (cell.type !== type) tr.setNodeMarkup(pos + 1 + rowPos + 1 + cellPos, type, cell.attrs);
            })
        );
        return false;
    });
    if (tr.docChanged) view.dispatch(tr);
}

const EditorToolbar = ({ editor, onLink }) => {
    const { t } = useI18n();
    const state = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            active: ALL.filter((action) => action.isActive(current)).map((action) => action.key).join(),
            // A table's cells hold words only.
            possible: (current.isActive('table') ? MARKS : ALL.filter((action) => action.run(current.can().chain().focus()).run())).map((action) => action.key).join(),
            inTable: current.isActive('table'),
            onLink: current.isActive('link'),
            undo: current.can().undo(),
            redo: current.can().redo(),
        }),
    });
    const active = state.active.split(',');
    const possible = state.possible.split(',');
    const act = (run) => run(editor.chain().focus()).run();

    return (
        <div className="kbFormat">
            <div className="kbTools" role="toolbar" aria-label={t('Formatting')}>
                {GROUPS.map((group) => (
                    <div className="kbToolGroup" key={group[0].key}>
                        {group.map((action) => (
                            <ToolButton
                                key={action.key}
                                label={t(action.label)}
                                shortcut={action.shortcut}
                                icon={action.icon}
                                inWords={group === HEADINGS}
                                active={active.includes(action.key)}
                                disabled={!possible.includes(action.key)}
                                onPress={() => act(action.run)}
                            />
                        ))}
                        {group === MARKS && <ToolButton label={t('Add a link')} shortcut="K" icon={LuLink} active={state.onLink} onPress={onLink} />}
                    </div>
                ))}
                <div className="kbToolGroup isEnd">
                    <ToolButton label={t('Undo the change')} shortcut="Z" icon={LuUndo2} disabled={!state.undo} onPress={() => act((chain) => chain.undo())} />
                    <ToolButton label={t('Redo the change')} icon={LuRedo2} disabled={!state.redo} onPress={() => act((chain) => chain.redo())} />
                </div>
            </div>
            {state.inTable && (
                <div className="kbTools isTable" role="toolbar" aria-label={t('This table')}>
                    <strong>{t('This table')}</strong>
                    {TABLE_ACTIONS.map((action) => (
                        <button
                            key={action.key}
                            type="button"
                            className={`kbTableTool${action.key.startsWith('delete') ? ' isDelete' : ''}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                act(action.run);
                                keepHeader(editor);
                            }}
                        >
                            {t(action.label)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EditorToolbar;
