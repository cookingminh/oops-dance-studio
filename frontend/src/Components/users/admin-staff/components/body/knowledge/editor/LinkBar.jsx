import { useState } from 'react';
import { Button, Input } from '@nextui-org/react';
import { useI18n } from '@/i18n/i18nContext';
import { linkOf } from './actions';

// Under the toolbar: the address of the link being added or changed. Nothing selected: the address becomes the words.
const LinkBar = ({ editor, onClose }) => {
    const { t } = useI18n();
    const current = editor.getAttributes('link').href ?? '';
    const [typed, setTyped] = useState(current);
    const [wrong, setWrong] = useState(false);

    const close = () => {
        onClose();
        editor.commands.focus();
    };
    const apply = () => {
        const href = linkOf(typed);
        if (!href) {
            setWrong(true);
            return;
        }
        const { empty } = editor.state.selection;
        if (empty && !current) editor.chain().focus().insertContent({ type: 'text', text: typed.trim(), marks: [{ type: 'link', attrs: { href } }] }).run();
        else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
        onClose();
    };
    const remove = () => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        onClose();
    };
    const onKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            apply();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    };

    return (
        <div className="kbLinkBar" onKeyDown={onKeyDown}>
            <Input
                autoFocus
                size="sm"
                aria-label={t('Link address')}
                placeholder="https://"
                value={typed}
                onValueChange={(value) => {
                    setTyped(value);
                    setWrong(false);
                }}
                isInvalid={wrong}
                errorMessage={wrong ? t('Type a web address (https://…) or an email.') : undefined}
            />
            <Button size="sm" color="danger" onPress={apply}>
                {t('Set the link')}
            </Button>
            {current && (
                <Button size="sm" variant="flat" onPress={remove}>
                    {t('Remove the link')}
                </Button>
            )}
            <Button size="sm" variant="light" onPress={close}>
                {t('Cancel')}
            </Button>
        </div>
    );
};

export default LinkBar;
