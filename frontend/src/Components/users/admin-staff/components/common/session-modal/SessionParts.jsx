import { useState } from 'react';
import { Avatar, Button, Image, Modal, ModalBody, ModalContent, ModalHeader, Select, SelectItem, Textarea } from '@nextui-org/react';
import { LuCheck, LuImage, LuUserCog } from 'react-icons/lu';
import { formatClock } from '@/lib/format';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { personName } from './sessionModel';

// The pieces of the session modal. Labels passed in are already translated.

// Check-in or check-out: the time and the proof photo (click to see it large).
export const CheckStep = ({ label, proofLabel, at, proof, onView }) => {
    const { t } = useI18n();
    return (
        <li className={`smCheck${at ? ' isDone' : ''}`}>
            <span className="smCheckMark" aria-hidden="true">{at && <LuCheck />}</span>
            <span className="smCheckText">
                <small>{label}</small>
                <strong>{at ? formatClock(at) : t('Not yet')}</strong>
            </span>
            {proof ? (
                <button type="button" className="smProof" aria-label={t('View proof photo')} title={proofLabel} onClick={() => onView({ url: proof, label: proofLabel })}>
                    <img src={proof} alt="" />
                </button>
            ) : (
                at && (
                    <span className="smProof isEmpty" title={t('No photo')}>
                        <LuImage aria-hidden="true" />
                    </span>
                )
            )}
        </li>
    );
};

// Who teaches this session; before the check-in another instructor can take it over (only this
// session changes, and the substitute is paid for it).
export const InstructorBlock = ({ teacher, regular, substitute, canChange, instructors, busy, onChange }) => {
    const { t } = useI18n();
    const [editing, setEditing] = useState(false);
    const [pick, setPick] = useState(teacher?.id ?? '');
    const name = personName(teacher) || t('No instructor');

    return (
        <div className="smWho">
            <div className="smWhoRow">
                <Avatar {...AVATAR_DEFAULTS} src={avatarUrl(teacher?.avatar_path, teacher?.updated_at) ?? undefined} name={name} />
                <span className="smWhoText">
                    <small>{t('Instructor')}</small>
                    <strong>
                        {name}
                        {substitute && <span className="smTag">{t('Substitute')}</span>}
                    </strong>
                    {substitute && regular && <span className="smWhoHint">{t('Instead of {name}', { name: personName(regular) })}</span>}
                </span>
                {canChange && !editing && (
                    <Button size="sm" variant="flat" startContent={<LuUserCog aria-hidden="true" />} onPress={() => setEditing(true)}>
                        {t('Substitute for this session')}
                    </Button>
                )}
            </div>
            {editing && (
                <div className="smSubstitute">
                    <p>{t('Only this session changes; the class keeps {name} as its instructor. The substitute is paid for this session.', { name: personName(regular) || name })}</p>
                    <Select
                        size="sm"
                        label={t('Who teaches this session')}
                        classNames={{ popoverContent: 'adminPortal' }}
                        selectedKeys={pick ? [pick] : []}
                        onChange={(event) => setPick(event.target.value)}
                    >
                        {instructors.map((person) => (
                            <SelectItem
                                key={person.id}
                                textValue={personName(person)}
                                startContent={<Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(person.avatar_path, person.updated_at) ?? undefined} name={personName(person)} />}
                            >
                                {personName(person)}
                            </SelectItem>
                        ))}
                    </Select>
                    <div className="smRowEnd">
                        <Button size="sm" variant="light" onPress={() => setEditing(false)} isDisabled={busy}>
                            {t('Close')}
                        </Button>
                        <Button size="sm" color="danger" isLoading={busy} isDisabled={!pick || pick === teacher?.id} onPress={() => onChange(pick).then((ok) => ok && setEditing(false))}>
                            {t('Change instructor')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

// The session's note (e.g. "Substitute teacher, class ended early"): edited in place.
export const NoteBox = ({ details, canEdit, busy, onSave }) => {
    const { t } = useI18n();
    const [draft, setDraft] = useState(details ?? '');
    const changed = (draft.trim() || null) !== (details?.trim() || null);
    if (!canEdit) {
        return details ? (
            <div className="smNote">
                <small>{t('Note')}</small>
                <p>{details}</p>
            </div>
        ) : null;
    }
    return (
        <div className="smNote">
            <Textarea
                label={t('Session note')}
                placeholder={t('e.g. Substitute teacher, class ended early…')}
                value={draft}
                onValueChange={setDraft}
                maxLength={500}
                minRows={2}
                variant="bordered"
            />
            {changed && (
                <div className="smRowEnd">
                    <Button size="sm" variant="light" onPress={() => setDraft(details ?? '')} isDisabled={busy}>
                        {t('Undo')}
                    </Button>
                    <Button size="sm" color="danger" variant="flat" isLoading={busy} onPress={() => onSave(draft)}>
                        {t('Save note')}
                    </Button>
                </div>
            )}
        </div>
    );
};

// A proof photo, large.
export const ProofDialog = ({ proof, onClose }) => (
    <Modal isOpen onOpenChange={(open) => !open && onClose()} size="lg" placement="center" classNames={{ base: 'adminPortal' }}>
        <ModalContent>
            <ModalHeader>{proof.label}</ModalHeader>
            <ModalBody className="pb-6">
                <Image src={proof.url} alt={proof.label} />
            </ModalBody>
        </ModalContent>
    </Modal>
);
