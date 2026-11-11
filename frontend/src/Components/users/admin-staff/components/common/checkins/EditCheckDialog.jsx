import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuAlertTriangle, LuClipboardEdit, LuInfo } from 'react-icons/lu';
import { editSessionCheck, studioMoment } from '@/services/checkins';
import { formatClock } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import Segmented from '../Segmented';
import { CHECK_REASONS, LATE_CHOICES, checkFormProblem, checkReasonToSave, lateByTimes } from './checkEdit';
import '../../body/class-manager/routines/routines.scss';
import '../session-changes/sessionChanges.scss';
import './checkins.scss';

// Staff correct a session's check-in / check-out (a forgotten check-out, a wrong time, an instructor the
// studio kept back): the two times on the session's day (the check-out may stay empty), the late mark —
// worked out from the times, or staff decide — and why (required). session_edit_check logs it with the
// times before and after.
//   session  { cls, date, start, end, row }      onDone() after saving
const EditCheckDialog = ({ session, onClose, onDone }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const { cls, date, row } = session;
    const [checkin, setCheckin] = useState(row.checkin_at ? formatClock(row.checkin_at) : session.start || '');
    const [checkout, setCheckout] = useState(row.checkout_at ? formatClock(row.checkout_at) : '');
    const [late, setLate] = useState('auto');
    const [reason, setReason] = useState('');
    const [problem, setProblem] = useState('');
    const [saving, setSaving] = useState(false);

    const formProblem = checkFormProblem({ checkin, checkout, reason });
    const byTimes = lateByTimes(checkout, session.end);
    const typed = reason.trim();

    // What the late mark will be, said in words.
    let lateHint = '';
    if (!checkout) lateHint = t('No check-out yet: the session stays open.');
    else if (late === 'auto' && byTimes !== null) {
        lateHint = byTimes
            ? t('Late: more than 10 minutes after the end ({end}).', { end: session.end })
            : t('On time: within 10 minutes of the end ({end}).', { end: session.end });
    }

    const edit = (setter) => (value) => {
        setter(value);
        setProblem('');
    };

    const save = async (event) => {
        event?.preventDefault();
        if (formProblem || saving) return;
        setSaving(true);
        setProblem('');
        try {
            await editSessionCheck({
                attendanceId: row.id,
                checkinAt: studioMoment(date, checkin),
                checkoutAt: checkout ? studioMoment(date, checkout) : null,
                late: checkout ? LATE_CHOICES.find((choice) => choice.key === late).value : null,
                reason: checkReasonToSave(reason, t),
            });
            toast.success('Check-in times corrected.');
            onDone();
        } catch (error) {
            setProblem(t(error.message));
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && !saving && onClose()}
            placement="center"
            scrollBehavior="inside"
            size="lg"
            classNames={{ base: 'rtDialog scgDialog ckDialog adminPortal' }}
        >
            <ModalContent>
                <form onSubmit={save} noValidate>
                    <ModalHeader className="rtDialogHead">
                        <span className="rtDialogIcon" aria-hidden="true">
                            <LuClipboardEdit />
                        </span>
                        <span>
                            <span className="rtDialogTitle">{t('Edit check-in/out times')}</span>
                            <small>
                                {cls.name} · {formatDate(date, 'long')}
                                {session.start && <span className="scgNoWrap"> · {`${session.start}–${session.end}`}</span>}
                            </small>
                        </span>
                    </ModalHeader>
                    <ModalBody className="rtDialogBody scgBody">
                        <div className="ckTimes">
                            <Input type="time" label={t('Check-in')} isRequired value={checkin} onValueChange={edit(setCheckin)} isDisabled={saving} />
                            <Input
                                type="time"
                                label={t('Check-out')}
                                value={checkout}
                                onValueChange={edit(setCheckout)}
                                isClearable
                                onClear={() => edit(setCheckout)('')}
                                isDisabled={saving}
                                description={session.end ? t('The session ends at {end}.', { end: session.end }) : undefined}
                            />
                        </div>

                        <div className="ckLate">
                            <span className="ckLabel" aria-hidden="true">
                                {t('Late check-out')}
                            </span>
                            {/* Without a check-out there is nothing to be late with. */}
                            {checkout && (
                                <Segmented
                                    label={t('Late check-out')}
                                    options={LATE_CHOICES.map((choice) => ({ key: choice.key, label: t(choice.label) }))}
                                    value={late}
                                    onChange={edit(setLate)}
                                />
                            )}
                            {lateHint && (
                                <p className="ckHint">
                                    <LuInfo aria-hidden="true" /> {lateHint}
                                </p>
                            )}
                        </div>

                        <div className="scgReason">
                            <Input label={t('Reason')} isRequired value={reason} onValueChange={edit(setReason)} maxLength={300} isDisabled={saving} description={t('Kept in the activity log.')} />
                            <div className="scgChips" role="group" aria-label={t('Ready-made reasons')}>
                                {CHECK_REASONS.map((key) => (
                                    <button key={key} type="button" aria-pressed={typed === t(key)} disabled={saving} onClick={() => edit(setReason)(t(key))}>
                                        {t(key)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {(problem || (formProblem && formProblem !== 'Say why the times change.')) && (
                            <p className="rtNotice isError" role="alert">
                                <LuAlertTriangle aria-hidden="true" />
                                <span>{problem || t(formProblem)}</span>
                            </p>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose} isDisabled={saving}>
                            {t('Close')}
                        </Button>
                        <Button type="submit" color="danger" isLoading={saving} isDisabled={Boolean(formProblem)}>
                            {t('Save the times')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default EditCheckDialog;
