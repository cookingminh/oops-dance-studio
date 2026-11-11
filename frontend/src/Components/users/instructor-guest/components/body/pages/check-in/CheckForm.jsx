import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, ModalHeader, ModalBody, ModalFooter, ModalContent } from '@nextui-org/react';
import { LuAlarmClock, LuCamera, LuClock, LuDoorOpen, LuMusic } from 'react-icons/lu';
import { checkIn, checkOut } from '@/services/attendance';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import ImagePicker from '@/ui/ImagePicker';
import { sessionTimesOf } from '@/lib/lessons';
import MakeUpTag from '../../../../../admin-staff/components/body/class-manager/routines/MakeUpTag';
import { checkOutLate, checkProblem, useStudioNow } from '../../profileHelpers';

const COPY = {
    checkin: { title: 'Check in', action: 'Check In', hint: 'A quick photo of the room or the class getting ready.', done: 'Checked in. Have a great class!' },
    checkout: { title: 'Check out', action: 'Check Out', hint: 'A photo at the end of the class.', done: 'Checked out. Thank you!' },
};

// Photo proof is required; the check-in/out time is recorded by the server. A check-out more than 10
// minutes after the end still works but is marked late: the dialog says so before confirming. A refused
// check-in (too early, the session is over) says why in the button's words.
// COPY holds English source text, translated where it is shown (the toast provider translates `done`).
const CheckForm = ({ kind, attendance, onClose, onDone }) => {
    const toast = useToast();
    const { t } = useI18n();
    const { now } = useStudioNow();
    const [proof, setProof] = useState(null);
    const [saving, setSaving] = useState(false);
    const copy = COPY[kind];
    const { start, end } = sessionTimesOf(attendance);
    const late = kind === 'checkout' && checkOutLate(attendance, now);
    const preview = useMemo(() => (proof ? URL.createObjectURL(proof) : null), [proof]);
    useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await (kind === 'checkin' ? checkIn : checkOut)(attendance, proof);
            toast.success(copy.done);
            onDone();
        } catch (error) {
            toast.error(checkProblem(error, t) ?? error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    <span>{t(copy.title)}</span>
                    <span className="text-small font-normal text-default-500">{t(copy.hint)}</span>
                </ModalHeader>
                <ModalBody>
                    <ul className="grid gap-2 rounded-2xl bg-default-50 p-3 text-small">
                        <li className="flex items-center gap-2">
                            <LuMusic className="text-danger" aria-hidden="true" />
                            <strong>{attendance.class?.name}</strong>
                        </li>
                        <li className="flex items-center gap-2 text-default-600">
                            <LuClock aria-hidden="true" /> {start} – {end}
                            {attendance.is_extra && <MakeUpTag />}
                        </li>
                        <li className="flex items-center gap-2 text-default-600">
                            <LuDoorOpen aria-hidden="true" /> {attendance.room?.name ?? t('No room')}
                        </li>
                    </ul>
                    {late && (
                        <p className="pfLateWarn" role="note">
                            <LuAlarmClock aria-hidden="true" />
                            <span>
                                <strong>{t('Late check-out')}</strong> {t('The class ended at {end}; a check-out now is marked late.', { end })}
                            </span>
                        </p>
                    )}
                    {preview && <img src={preview} alt={t('Your proof photo')} className="w-full max-h-64 rounded-2xl object-cover" />}
                    <ImagePicker
                        label={proof ? t('Retake the photo') : t('Take or upload a proof photo')}
                        capture="environment"
                        color="default"
                        startContent={<LuCamera aria-hidden="true" />}
                        onChange={setProof}
                        isDisabled={saving}
                    />
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color={late ? 'warning' : 'danger'} onPress={handleSubmit} isLoading={saving} isDisabled={!proof}>
                        {late ? t('Check out late') : t(copy.action)}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default CheckForm;
