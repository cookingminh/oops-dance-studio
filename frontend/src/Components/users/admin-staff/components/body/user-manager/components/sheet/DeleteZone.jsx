import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuLock, LuTrash2 } from 'react-icons/lu';
import { deleteUser } from '@/services/users';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';

// Deleting an account. The admin-users function refuses people with bookings, classes or teaching
// sessions (the studio keeps those records), yourself and the shared demo accounts; this explains
// why before anyone tries, and asks once more before it deletes. Finalized payslips also keep an
// account here, because they would be deleted with it.
const DeleteZone = ({ person, isSelf, lockedDemo, activity, onDeleted }) => {
    const { t, tn } = useI18n();
    const toast = useToast();
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const records = activity.data
        ? [
              activity.data.bookingCount && tn(activity.data.bookingCount, '{count} booking', '{count} bookings'),
              person.teaches.length && tn(person.teaches.length, '{count} class', '{count} classes'),
              activity.data.sessionCount && tn(activity.data.sessionCount, '{count} teaching session', '{count} teaching sessions'),
              activity.data.payslipCount && tn(activity.data.payslipCount, '{count} payslip', '{count} payslips'),
          ].filter(Boolean)
        : [];

    let reason = null;
    if (isSelf) reason = t('You can’t delete your own account.');
    else if (lockedDemo) reason = t('Demo accounts can’t be deleted in the public demo.');
    else if (records.length) reason = t('Kept for the studio’s records: {records}.', { records: records.join(', ') });

    const remove = async () => {
        setDeleting(true);
        try {
            await deleteUser(person.id);
            toast.success('Account deleted.');
            onDeleted();
        } catch (error) {
            toast.error(error);
            setDeleting(false);
        }
    };

    return (
        <section className="sheetSection dangerZone" aria-labelledby="sheet-delete">
            <h3 id="sheet-delete">{t('Delete account')}</h3>
            {reason ? (
                <p className="dangerReason">
                    <LuLock aria-hidden="true" />
                    <span>{reason}</span>
                </p>
            ) : !activity.data ? (
                <p className="sectionNote">{activity.error ? t('Something went wrong.') : t('Checking…')}</p>
            ) : (
                <AnimatePresence mode="wait" initial={false}>
                    {confirming ? (
                        <motion.div key="confirm" className="dangerConfirm" role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <p>
                                <strong>{t('Delete {name}’s account for good?', { name: person.name })}</strong>
                                <span>
                                    {person.enrolments.length
                                        ? t('Their login, class places and attendance history are removed. This can’t be undone.')
                                        : t('Their login is removed. This can’t be undone.')}
                                </span>
                            </p>
                            <div className="dangerActions">
                                <Button size="sm" variant="light" onPress={() => setConfirming(false)} isDisabled={deleting}>
                                    {t('Keep account')}
                                </Button>
                                <Button size="sm" color="danger" startContent={<LuTrash2 aria-hidden="true" />} isLoading={deleting} onPress={remove}>
                                    {t('Yes, delete')}
                                </Button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="ask" className="dangerAsk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <p className="sectionNote">{t('No bookings, classes, teaching sessions or payslips depend on this account, so it can be deleted.')}</p>
                            <Button size="sm" variant="flat" color="danger" startContent={<LuTrash2 aria-hidden="true" />} onPress={() => setConfirming(true)}>
                                {t('Delete account')}
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </section>
    );
};

export default DeleteZone;
