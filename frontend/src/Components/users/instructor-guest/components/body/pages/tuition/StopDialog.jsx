import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuDoorOpen } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { songOf } from './tuitionData';

// "Are you sure?" before stopping a class. A course that hasn't started: they finish the one they're
// in, then leave when it starts. The running course: they leave today (and it isn't charged). Either
// way they can come back from the tuition page while that course is on.
const StopDialog = ({ invoice, busy, onCancel, onConfirm }) => {
    const { t } = useI18n();
    const isNow = invoice.course?.phase !== 'planned';
    const course = invoice.course?.title || invoice.class_name;
    const previous = invoice.previous ? songOf(invoice.previous) : null;
    const vars = { className: invoice.class_name, course, previous };

    let title;
    let body;
    let confirm;
    if (isNow) {
        title = t('Stop {className} now?', vars);
        body = t('You’ll leave {className} today and won’t be charged for {course}.', vars);
        confirm = t('Stop now');
    } else if (previous) {
        title = t('Stop {className} after {previous}?', vars);
        body = t('You’ll keep dancing until {previous} ends, then leave {className} before {course} starts. Nothing is charged for {course}.', vars);
        confirm = t('Stop after {course}', { course: previous });
    } else {
        title = t('Skip {course}?', vars);
        body = t('You’ll leave {className} before {course} starts. Nothing is charged for it.', vars);
        confirm = t('Don’t continue');
    }

    return (
        <Modal isOpen onOpenChange={(open) => !open && onCancel()} size="md" placement="center" classNames={{ base: 'tuStopModal adminPortal' }}>
            <ModalContent>
                <ModalHeader className="tuStopHead">
                    <span className="tuStopIcon" aria-hidden="true">
                        <LuDoorOpen />
                    </span>
                    {title}
                </ModalHeader>
                <ModalBody>
                    <p>{body}</p>
                    <p className="tuStopSoft">{t('Changed your mind later? You can continue again from this page until {course} is over.', vars)}</p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onCancel} isDisabled={busy}>
                        {t('Keep dancing')}
                    </Button>
                    <Button color="danger" variant="flat" onPress={onConfirm} isLoading={busy}>
                        {confirm}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default StopDialog;
