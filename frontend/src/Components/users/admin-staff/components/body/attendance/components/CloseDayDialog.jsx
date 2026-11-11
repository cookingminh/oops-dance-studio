import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Checkbox, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@nextui-org/react';
import { LuAlertTriangle, LuArrowRight, LuCalendarCheck, LuCalendarPlus, LuCheck, LuCloudLightning, LuGraduationCap, LuTicket } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { closeStudioDay } from '@/services/sessionChanges';
import { formatTime, formatVnd } from '@/lib/format';
import { bookingReceived } from '@/services/bookingPayments';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import ReasonField from '../../../common/session-changes/ReasonField';
import RescheduleDialog from '../../../common/session-changes/RescheduleDialog';
import { changeDay, reasonToSave } from '../../../common/session-changes/changeText';
import { classColor, personName } from '../../../common/session-modal/sessionModel';
import { sessionTimes } from '../../class-hub/hubModel';
import { loadDayPreview } from '../closeDayData';
import '../../class-manager/routines/routines.scss';
import '../../../common/session-changes/sessionChanges.scss';

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } };

// Close the studio for a day (a storm, a power cut): the day (today by default) and why, a preview of
// what it touches — the classes meeting that day and the room bookings, with the money that goes back —
// and whether to cancel those bookings too (the studio cancels them: everything paid is due back). Then
// a summary with a "Schedule the make-up" per class (the Call off / move dialog in make-up mode).
//   classes  every class (the Attendance page's)    onChanged()  the page reloads its sessions
const CloseDayDialog = ({ today, classes, onClose, onChanged }) => {
    const i18n = useI18n();
    const { t, tn, formatDate } = i18n;
    const toast = useToast();
    const [date, setDate] = useState(today);
    const [reason, setReason] = useState('');
    const [withBookings, setWithBookings] = useState(true);
    const [saving, setSaving] = useState(false);
    const [problem, setProblem] = useState('');
    const [result, setResult] = useState(null); // { date, reason, sessions, bookings, classes }
    const [makeUpFor, setMakeUpFor] = useState(null); // a class of the summary
    const [madeUp, setMadeUp] = useState({}); // class id → { newDate, start, end }

    const dateError = date && date < today ? t('Pick today or a later day.') : '';
    const preview = useAsync(() => (date && !dateError && !result ? loadDayPreview(date, classes) : Promise.resolve(undefined)), [date, dateError, classes, result]);
    const sessions = preview.data?.sessions ?? [];
    const closing = sessions.filter((session) => !session.off);
    const bookings = preview.data?.bookings ?? [];
    const canClose = Boolean(date) && !dateError && Boolean(reason.trim()) && Boolean(preview.data) && !saving;
    const day = date ? changeDay(date, i18n) : '';

    const close = async (event) => {
        event?.preventDefault();
        if (!canClose) return;
        setSaving(true);
        setProblem('');
        const why = reasonToSave(reason, t);
        try {
            const done = await closeStudioDay(date, why, { cancelBookings: withBookings });
            toast.success(t('The studio is closed on {day}.', { day }));
            setResult({ ...done, date, reason: why });
            onChanged();
        } catch (error) {
            setProblem(t(error.message));
        } finally {
            setSaving(false);
        }
    };

    const summary = result
        ? [
            tn(result.sessions, '{count} session called off', '{count} sessions called off'),
            result.bookings ? tn(result.bookings, '{count} booking cancelled', '{count} bookings cancelled') : null,
        ].filter(Boolean).join(' · ')
        : '';

    // The make-up dialog for one class of the summary: that class's session that day, called off with the reason.
    const makeUpSession = (() => {
        if (!makeUpFor || !result) return null;
        const cls = classes.find((item) => item.id === makeUpFor.class_id);
        if (!cls) return null;
        return { cls, date: result.date, row: { status: 'cancelled', cancel_reason: result.reason }, ...sessionTimes(cls, result.date, null) };
    })();

    return (
        <>
            <Modal
                isOpen
                onOpenChange={(open) => !open && !saving && onClose()}
                placement="center"
                scrollBehavior="inside"
                size="xl"
                classNames={{ base: 'rtDialog scgDialog scgClose adminPortal' }}
            >
                <ModalContent>
                    <form onSubmit={close} noValidate>
                        <ModalHeader className="rtDialogHead">
                            <span className="rtDialogIcon" aria-hidden="true">
                                <LuCloudLightning />
                            </span>
                            <span>
                                <span className="rtDialogTitle">{t('Close the studio for a day')}</span>
                                <small>{t('Every class that day is called off, and the class sees why.')}</small>
                            </span>
                        </ModalHeader>
                        <ModalBody className="rtDialogBody scgBody">
                            <AnimatePresence mode="wait" initial={false}>
                                {result ? (
                                    <motion.div key="done" className="scgBody" {...fade}>
                                        <div className="scgDone" role="status">
                                            <span className="scgDoneIcon" aria-hidden="true">
                                                <LuCheck />
                                            </span>
                                            <strong>{t('Closed on {day}', { day: changeDay(result.date, i18n) })}</strong>
                                            <p>{summary}</p>
                                        </div>
                                        {result.classes.length > 0 ? (
                                            <section className="scgPreview" aria-label={t('Make-ups')}>
                                                <header>
                                                    <strong>{t('Schedule the make-ups')}</strong>
                                                    <small>{t('Each class can make the session up on another day.')}</small>
                                                </header>
                                                <ul className="scgList scgSummary">
                                                    {result.classes.map((item) => {
                                                        const done = madeUp[item.class_id];
                                                        return (
                                                            <li key={item.class_id} style={{ '--class': classColor(item.class_id) }}>
                                                                <span className="scgDot" aria-hidden="true" />
                                                                <span className="scgName">{item.name}</span>
                                                                {done ? (
                                                                    <span className="scgMadeUp">
                                                                        <LuCalendarCheck aria-hidden="true" />
                                                                        {t('Make-up {day}, {time}', { day: changeDay(done.newDate, i18n, { short: true }), time: `${done.start}–${done.end}` })}
                                                                    </span>
                                                                ) : (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="flat"
                                                                        color="danger"
                                                                        startContent={<LuCalendarPlus aria-hidden="true" />}
                                                                        aria-label={t('Schedule the make-up for {name}', { name: item.name })}
                                                                        onPress={() => setMakeUpFor(item)}
                                                                    >
                                                                        {t('Schedule the make-up')}
                                                                    </Button>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </section>
                                        ) : (
                                            <p className="rtDialogLead">{t('No class met that day.')}</p>
                                        )}
                                        {result.bookings > 0 && (
                                            <Link to="/admin/bookings?view=list&refunds=1" className="scgLink" onClick={onClose}>
                                                <LuTicket aria-hidden="true" />
                                                {t('Refunds of the cancelled bookings are on the Bookings page')}
                                                <LuArrowRight aria-hidden="true" />
                                            </Link>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div key="form" className="scgBody" {...fade}>
                                        <div className="scgDate">
                                            <Input
                                                type="date"
                                                label={t('Date')}
                                                min={today}
                                                value={date}
                                                onValueChange={(value) => {
                                                    setDate(value);
                                                    setProblem('');
                                                }}
                                                isInvalid={Boolean(dateError)}
                                                errorMessage={dateError || undefined}
                                                description={date && !dateError ? formatDate(date, 'full') : undefined}
                                            />
                                        </div>
                                        <ReasonField value={reason} onChange={setReason} isDisabled={saving} />

                                        <section className="scgPreview" aria-label={t('What closing the day touches')} aria-busy={preview.loading}>
                                            <header>
                                                <strong>{date && !dateError ? t('What closing {day} touches', { day }) : t('What closing the day touches')}</strong>
                                                {preview.loading && <Spinner size="sm" color="danger" aria-label={t('Loading…')} />}
                                            </header>
                                            {preview.error && <p className="scgEmpty">{t(preview.error.message)}</p>}
                                            {preview.data && (
                                                <>
                                                    <h4>
                                                        <LuGraduationCap aria-hidden="true" />
                                                        {closing.length ? tn(closing.length, '{count} class is called off', '{count} classes are called off') : t('No class to call off')}
                                                    </h4>
                                                    {sessions.length > 0 && (
                                                        <ul className="scgList">
                                                            {sessions.map((session) => (
                                                                <li key={session.cls.id} className={session.off ? 'isOff' : undefined} style={{ '--class': classColor(session.cls.id) }}>
                                                                    <span className="scgDot" aria-hidden="true" />
                                                                    <span className="scgTime">{session.start ? `${session.start}–${session.end}` : '—'}</span>
                                                                    <span className="scgName">{session.cls.name}</span>
                                                                    <span className="scgAside">
                                                                        {session.off === 'cancelled' && t('Already called off')}
                                                                        {session.off === 'started' && t('Already started')}
                                                                        {!session.off && (personName(session.row?.instructor ?? session.cls.instructor) || session.cls.room?.name)}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    <h4>
                                                        <LuTicket aria-hidden="true" />
                                                        {bookings.length ? tn(bookings.length, '{count} room booking that day', '{count} room bookings that day') : t('No room booking that day')}
                                                    </h4>
                                                    {bookings.length > 0 && (
                                                        <>
                                                            <ul className="scgList">
                                                                {bookings.map((booking) => (
                                                                    <li key={booking.id}>
                                                                        <span className="scgTime">
                                                                            {formatTime(booking.start_time)}–{formatTime(booking.end_time)}
                                                                        </span>
                                                                        <span className="scgName">
                                                                            {booking.room?.name} · {personName(booking.guest) || t('Guest')}
                                                                        </span>
                                                                        <span className="scgAside">{bookingReceived(booking) ? t('{amount} paid', { amount: formatVnd(bookingReceived(booking)) }) : t('Nothing paid')}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                            <Checkbox size="sm" color="danger" isSelected={withBookings} onValueChange={setWithBookings} isDisabled={saving}>
                                                                {t('Also cancel that day’s room bookings (full refund)')}
                                                            </Checkbox>
                                                            {withBookings && preview.data.refund > 0 && (
                                                                <p className="scgMoney">
                                                                    {t('Goes back to the guests:')} <strong>{formatVnd(preview.data.refund)}</strong>
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </section>

                                        {problem && (
                                            <p className="rtNotice isError" role="alert">
                                                <LuAlertTriangle aria-hidden="true" />
                                                <span>{problem}</span>
                                            </p>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </ModalBody>
                        <ModalFooter>
                            {result ? (
                                <Button color="danger" onPress={onClose}>
                                    {t('Done')}
                                </Button>
                            ) : (
                                <>
                                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                                        {t('Close')}
                                    </Button>
                                    <Button type="submit" color="danger" isLoading={saving} isDisabled={!canClose}>
                                        {day ? t('Close on {day}', { day }) : t('Close for a day')}
                                    </Button>
                                </>
                            )}
                        </ModalFooter>
                    </form>
                </ModalContent>
            </Modal>
            {makeUpSession && (
                <RescheduleDialog
                    session={makeUpSession}
                    today={today}
                    makeUpOnly
                    onClose={() => setMakeUpFor(null)}
                    onDone={(done) => {
                        setMadeUp((current) => ({ ...current, [makeUpFor.class_id]: done }));
                        setMakeUpFor(null);
                        onChanged();
                    }}
                />
            )}
        </>
    );
};

export default CloseDayDialog;
