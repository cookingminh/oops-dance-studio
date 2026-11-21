import { useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from '@nextui-org/react';
import { LuEye, LuX } from 'react-icons/lu';
import { declineJoinRequest } from '@/services/classJoinStaff';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { DECLINE_REASONS, REASON_MAX, personName } from './joinModel';

// Decline a request, with an optional reason the student reads in My classes: a quick pick or their own words
// (≤ 300 characters). class_join_decline answers it. onDone() after it worked.
const DeclineJoinDialog = ({ request, onClose, onDone }) => {
    const { t } = useI18n();
    const toast = useToast();
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const name = personName(request.student);
    const className = request.class?.name ?? '';
    const tooLong = reason.length > REASON_MAX;

    const submit = async () => {
        if (tooLong) return;
        setSaving(true);
        try {
            const row = await declineJoinRequest(request.id, reason);
            toast.success(t('{name} won’t join {class}. They’ll see your answer in My classes.', { name, class: className }));
            onDone(row);
        } catch (error) {
            toast.error(error);
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && !saving && onClose()} placement="center" scrollBehavior="inside" classNames={{ base: 'hubDialog jrDialog adminPortal' }}>
            <ModalContent>
                <ModalHeader className="jrDialogHead">
                    <span className="jrDialogKicker">{t('Decline the request')}</span>
                    <span>{t('{name} for {class}', { name, class: className })}</span>
                </ModalHeader>
                <ModalBody className="jrDialogBody">
                    {request.note && <blockquote className="jrQuote">“{request.note}”</blockquote>}
                    <div className="jrField">
                        <span className="jrFieldLabel">{t('Why? (optional)')}</span>
                        <div className="tuQuick jrQuick" role="group" aria-label={t('Common reasons')}>
                            {DECLINE_REASONS.map((text) => (
                                <button key={text} type="button" aria-pressed={reason === t(text)} onClick={() => setReason(t(text))}>
                                    {t(text)}
                                </button>
                            ))}
                        </div>
                        <Textarea
                            aria-label={t('Reason')}
                            placeholder={t('Or write a few words of your own')}
                            value={reason}
                            onValueChange={setReason}
                            minRows={3}
                            maxRows={6}
                            isInvalid={tooLong}
                            errorMessage={tooLong ? t('The reason is up to 300 characters.') : undefined}
                            classNames={{ inputWrapper: 'jrTextarea' }}
                        />
                        <div className="jrFieldFoot">
                            <span className="jrSees">
                                <LuEye aria-hidden="true" />
                                {t('The student will see this reason.')}
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
                        {t('Decline')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default DeclineJoinDialog;
