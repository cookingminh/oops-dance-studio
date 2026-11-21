import { useEffect, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuHourglass } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { cancelJoinRequest } from '@/services/classJoin';
import { ClassHead } from './JoinParts';
import { START_LABELS } from './joinOffer';
import './joinDialog.scss';

// A request still waiting for the studio (the card's "Request sent" pill): when it was sent, the start asked for,
// the note, and a way to withdraw it (asked twice). onCancelled() after it is withdrawn.
const RequestDialog = ({ item, request, onClose, onCancelled }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const keepRef = useRef(null);
    const askRef = useRef(null);
    const focusNext = useRef(null); // 'keep' | 'ask': where the focus goes once the buttons have swapped

    // The footer swaps its buttons: the focus follows ("Keep it" when asked, "Cancel request" when kept).
    useEffect(() => {
        const target = { keep: keepRef, ask: askRef }[focusNext.current];
        focusNext.current = null;
        target?.current?.focus();
    }, [confirming]);

    const ask = () => {
        focusNext.current = 'keep';
        setConfirming(true);
    };
    const keep = () => {
        focusNext.current = 'ask';
        setConfirming(false);
    };

    const cancel = async () => {
        setBusy(true);
        try {
            await cancelJoinRequest(request.id);
            toast.success('Request cancelled.');
            onCancelled?.();
            onClose();
        } catch (error) {
            toast.error(error);
            setBusy(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" scrollBehavior="inside" classNames={{ base: 'jnDialog isRequest', closeButton: 'jnClose' }}>
            <ModalContent>
                <ModalHeader>
                    <ClassHead item={item} eyebrow={t('Your request')} />
                </ModalHeader>
                <ModalBody className="jnBody">
                    <p className="jnStatus">
                        <LuHourglass aria-hidden="true" /> {t('Waiting for the studio')}
                    </p>
                    <dl className="jnFactList">
                        <div>
                            <dt>{t('Sent')}</dt>
                            <dd>{formatDate(new Date(request.created_at), 'long')}</dd>
                        </div>
                        <div>
                            <dt>{t('Start')}</dt>
                            <dd>{t(START_LABELS[request.start_pref] ?? START_LABELS.now)}</dd>
                        </div>
                        {request.note && (
                            <div>
                                <dt>{t('Your note')}</dt>
                                <dd className="jnNoteText">{request.note}</dd>
                            </div>
                        )}
                    </dl>
                    <p className="jnText">{t('The studio usually answers within a day. Once you’re in, the class and its invoice show up in your profile.')}</p>
                </ModalBody>
                <ModalFooter className="jnFoot">
                    {confirming ? (
                        <>
                            <span className="jnConfirm">{t('Cancel this request?')}</span>
                            <Button ref={keepRef} variant="light" onPress={keep} isDisabled={busy}>
                                {t('Keep it')}
                            </Button>
                            <Button color="danger" onPress={cancel} isLoading={busy}>
                                {t('Yes, cancel it')}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button ref={askRef} variant="light" color="danger" className="jnFootStart" onPress={ask}>
                                {t('Cancel request')}
                            </Button>
                            <Button variant="flat" onPress={onClose}>
                                {t('Close')}
                            </Button>
                        </>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default RequestDialog;
