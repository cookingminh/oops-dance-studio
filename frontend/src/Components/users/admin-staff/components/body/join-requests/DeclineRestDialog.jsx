import { useState } from 'react';
import { Avatar, Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@nextui-org/react';
import { LuEye, LuX } from 'react-icons/lu';
import { declineJoinRequest } from '@/services/classJoinStaff';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { REASON_MAX, personName } from './joinModel';

// A full class: decline every request still waiting for it at once, with one reason the students read in My classes
// ("The class is full" to start with). Each is answered by class_join_decline, one after the other; onDone() after.
const DeclineRestDialog = ({ className, requests, onClose, onDone }) => {
    const { t, tn } = useI18n();
    const toast = useToast();
    const [reason, setReason] = useState(() => t('The class is full'));
    const [saving, setSaving] = useState(false);
    const tooLong = reason.length > REASON_MAX;

    const submit = async () => {
        if (tooLong) return;
        setSaving(true);
        let done = 0;
        try {
            for (const request of requests) {
                await declineJoinRequest(request.id, reason);
                done += 1;
            }
            toast.success(tn(done, '{count} request declined. The student sees your reason in My classes.', '{count} requests declined. The students see your reason in My classes.'));
            onDone();
        } catch (error) {
            toast.error(error);
            // Some went through: the lists reload either way.
            if (done) onDone();
            else setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && !saving && onClose()} placement="center" scrollBehavior="inside" classNames={{ base: 'hubDialog jrDialog adminPortal' }}>
            <ModalContent>
                <ModalHeader className="jrDialogHead">
                    <span className="jrDialogKicker">{t('The class is full')}</span>
                    <span>{tn(requests.length, 'Decline the {count} request still waiting for {class}', 'Decline the {count} requests still waiting for {class}', { class: className })}</span>
                </ModalHeader>
                <ModalBody className="jrDialogBody">
                    <ul className="jrRestList" aria-label={t('Still waiting')}>
                        {requests.map((request) => {
                            const name = personName(request.student);
                            return (
                                <li key={request.id}>
                                    <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(request.student?.avatar_path, request.student?.updated_at) ?? undefined} name={name} />
                                    <strong>{name}</strong>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="jrField">
                        <span className="jrFieldLabel">{t('Reason')}</span>
                        <Textarea
                            aria-label={t('Reason')}
                            value={reason}
                            onValueChange={setReason}
                            minRows={2}
                            maxRows={5}
                            isInvalid={tooLong}
                            errorMessage={tooLong ? t('The reason is up to 300 characters.') : undefined}
                            classNames={{ inputWrapper: 'jrTextarea' }}
                        />
                        <div className="jrFieldFoot">
                            <span className="jrSees">
                                <LuEye aria-hidden="true" />
                                {t('The students will see this reason.')}
                            </span>
                            <span className={`jrCounter${tooLong ? ' isOver' : ''}`}>
                                {reason.length}/{REASON_MAX}
                            </span>
                        </div>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="danger" variant="flat" startContent={saving ? null : <LuX aria-hidden="true" />} onPress={submit} isLoading={saving} isDisabled={tooLong}>
                        {tn(requests.length, 'Decline {count} request', 'Decline {count} requests')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default DeclineRestDialog;
