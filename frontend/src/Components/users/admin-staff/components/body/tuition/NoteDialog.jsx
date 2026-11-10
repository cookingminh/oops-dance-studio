import { useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@nextui-org/react';
import { LuStickyNote } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { InvoiceHead } from './TuitionParts';
import { NOTE_MAX, splitNote } from './tuitionModel';

const QUICK_NOTES = ['Promised to pay cash at the weekend', 'Reminded on Zalo', 'Pays after payday', 'Asked for a discount'];

// A note on one invoice, on its own ("Promised to pay cash at the weekend"). Only staff's words are
// edited: the server's "Joined after N of M sessions." stays in front of them. Empty = no note.
// onSubmit(fullNote) → true when saved.
const NoteDialog = ({ invoice, onClose, onSubmit }) => {
    const { t } = useI18n();
    const { prefix, text: current } = splitNote(invoice);
    const [text, setText] = useState(current);
    const [saving, setSaving] = useState(false);
    const room = NOTE_MAX - prefix.length;
    const changed = text.trim() !== current.trim();

    const save = async (value) => {
        setSaving(true);
        const done = await onSubmit(value.trim() ? `${prefix}${value.trim()}` : prefix.trim());
        setSaving(false);
        if (done) onClose();
    };

    const submit = (event) => {
        event?.preventDefault();
        if (changed && !saving) save(text);
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" classNames={{ base: 'tuDialog tuNoteDialog adminPortal' }}>
            <ModalContent>
                <form onSubmit={submit} noValidate>
                    <ModalHeader>
                        <InvoiceHead invoice={invoice} title={current ? t('Edit note') : t('Add note')} />
                    </ModalHeader>
                    <ModalBody className="tuDialogBody">
                        <Textarea
                            label={t('Note')}
                            placeholder={t('Only staff see it, under the invoice.')}
                            value={text}
                            onValueChange={(value) => setText(value.slice(0, room))}
                            maxLength={room}
                            minRows={3}
                            autoFocus
                            description={t('{count} of {max} characters', { count: text.length, max: room })}
                        />
                        <div className="tuQuick" role="group" aria-label={t('Quick notes')}>
                            {QUICK_NOTES.map((note) => (
                                <button key={note} type="button" onClick={() => setText(t(note))}>
                                    {t(note)}
                                </button>
                            ))}
                        </div>
                        {prefix && <p className="tuDialogText">{t('The “joined late” line stays in front of your note.')}</p>}
                    </ModalBody>
                    <ModalFooter>
                        {current && (
                            <Button variant="light" color="danger" className="mr-auto" isDisabled={saving} onPress={() => save('')}>
                                {t('Remove note')}
                            </Button>
                        )}
                        <Button variant="light" onPress={onClose}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" color="danger" isLoading={saving} isDisabled={!changed} startContent={saving ? null : <LuStickyNote aria-hidden="true" />}>
                            {t('Save note')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default NoteDialog;
