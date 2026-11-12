import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@nextui-org/react';
import { LuAlertTriangle, LuCalendarClock, LuCalendarOff, LuCalendarPlus, LuClapperboard } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listLessonProgress } from '@/services/classes';
import { listClassSessionChanges } from '@/services/sessions';
import { getAvailableSlots } from '@/services/bookings';
import { cancelSession, moveSession } from '@/services/sessionChanges';
import { TIME_OPTIONS, formatTime, toMinutes } from '@/lib/format';
import { meetsOn } from '@/lib/lessons';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import { PlaceIcon } from '@/ui/place/PlaceParts';
import ReasonField from './ReasonField';
import { changeDay, changeProblem, reasonText, reasonToSave } from './changeText';
import { CLOSE, firstTimes, fitsIn, freeDays, searchFrom, shootDayNotes, toClock } from './rescheduleModel';
import '../../body/class-manager/routines/routines.scss';
import './sessionChanges.scss';

// What can happen to the session: made up on another day in the same step, or only called off.
const CHOICES = [
    { key: 'move', label: 'Make it up on another day', hint: 'Call it off and add the make-up now', icon: LuCalendarClock },
    { key: 'cancel', label: 'Only call it off', hint: 'Schedule the make-up later', icon: LuCalendarOff },
];

// Call a class session off with a reason the class sees and — by default — move it to another day in one
// step (session_move: the make-up says which day it replaces), or only call it off (session_cancel). Works
// for a session ahead whose record doesn't exist yet. `makeUpOnly`: the session is already called off, so
// this schedules its make-up (the reason is kept, and can be edited). The make-up starts on a free day
// after the session where the class's room is free at its usual time; the server checks the room again.
// It also says what happens to the routine's shoot day.
//   session  { cls, date, start, end, row? }      onDone({ kind: 'move' | 'cancel', newDate?, start?, end? })
const RescheduleDialog = ({ session, today, makeUpOnly = false, onClose, onDone }) => {
    const i18n = useI18n();
    const { t, formatDate } = i18n;
    const toast = useToast();
    const { cls, date } = session;
    const [what, setWhat] = useState('move');
    const [reason, setReason] = useState(() => reasonText(session.row?.cancel_reason, t));
    const first = firstTimes(cls, session);
    const [newDate, setNewDate] = useState(null); // null = the suggested day, once known
    const [start, setStart] = useState(first.start);
    const [end, setEnd] = useState(first.end);
    const [problem, setProblem] = useState(null); // { key, vars } or a message
    const [saving, setSaving] = useState(false);

    // The class's routines and its other changes (for the shoot day and the days already taken by make-ups).
    const context = useAsync(
        () =>
            Promise.all([listLessonProgress([cls.id]).catch(() => []), listClassSessionChanges(cls.id).catch(() => ({ makeUps: [], cancelledDates: [] }))]).then(
                ([routines, changes]) => ({ routines, ...changes })
            ),
        [cls.id]
    );
    const makeUps = context.data?.makeUps ?? [];
    const takenDates = new Set(makeUps.map((row) => row.date));

    // The first free day after the session where the room is free at these times (else the first free day).
    const suggestion = useAsync(async () => {
        if (!context.data) return undefined;
        const days = freeDays(cls, searchFrom(date, today), new Set(context.data.makeUps.map((row) => row.date)));
        if (!days.length) return '';
        if (!cls.room_id) return days[0];
        const slots = await Promise.all(days.map((day) => getAvailableSlots(day).catch(() => [])));
        const index = slots.findIndex((rows) => fitsIn(rows.filter((slot) => slot.room_id === cls.room_id), first.start, first.end));
        return days[Math.max(index, 0)];
    }, [context.data, cls.id, date, today]);
    const day = newDate ?? suggestion.data ?? '';
    const moving = makeUpOnly || what === 'move';

    const slots = useAsync(async () => (moving && day && day >= today ? getAvailableSlots(day) : []), [moving, day, today]);
    const free = (slots.data ?? []).filter((slot) => slot.room_id === cls.room_id);

    let dateError = '';
    if (moving && day) {
        if (day < today) dateError = t('Pick today or a later day.');
        else if (day === date) dateError = t('Pick another day for the make-up.');
        else if (cls.starts_on && day < cls.starts_on) dateError = t('The class only starts on {date}.', { date: formatDate(cls.starts_on, 'short') });
        else if (cls.ended_on && day > cls.ended_on) dateError = t('The class ends on {date}.', { date: formatDate(cls.ended_on, 'short') });
        else if (meetsOn(cls, day)) dateError = t('The class already meets on {day}. Pick a day without a class.', { day: formatDate(day, 'weekday') });
        else if (takenDates.has(day)) dateError = t('There is already a make-up session that day.');
    }
    const timeError = moving && start && end && toMinutes(end) <= toMinutes(start) ? t('End time must be after start time.') : '';
    const fits = fitsIn(free, start, end);
    const reasonMissing = !reason.trim();
    const canSave = !reasonMissing && (!moving || (day && !dateError && start && end && !timeError));

    const notes = context.data
        ? shootDayNotes({ cls, routines: context.data.routines, makeUps, cancelledDates: context.data.cancelledDates, date, newDate: moving ? day || null : null })
        : [];

    const clear = () => setProblem(null);
    const choose = (key) => {
        setWhat(key);
        clear();
    };
    const editReason = (value) => {
        setReason(value);
        clear();
    };
    // Moving the start keeps the session's length.
    const pickStart = (value) => {
        if (!value) return;
        const length = Math.max(30, toMinutes(end) - toMinutes(start));
        setStart(value);
        setEnd(toClock(Math.min(CLOSE, toMinutes(value) + length)));
        clear();
    };

    const save = async (event) => {
        event?.preventDefault();
        if (!canSave || saving) return;
        setSaving(true);
        clear();
        const why = reasonToSave(reason, t);
        try {
            if (moving) {
                await moveSession({ classId: cls.id, date, newDate: day, start, end, reason: why });
                const vars = { day: changeDay(day, i18n), time: `${start}–${end}` };
                toast.success(makeUpOnly ? t('Make-up added on {day}, {time}.', vars) : t('Moved to {day}, {time}.', vars));
                onDone({ kind: 'move', newDate: day, start, end });
            } else {
                await cancelSession(cls.id, date, why);
                toast.success('Session called off.');
                onDone({ kind: 'cancel' });
            }
        } catch (error) {
            setProblem(changeProblem(error) ?? t(error.message));
            setSaving(false);
        }
    };

    let roomHint = null;
    // Room clashes only concern the studio's rooms; a rented studio's own diary is the staff's to check.
    if (moving && cls.venue_id) roomHint = t('{venue} is a rented studio: check with them that it’s free then.', { venue: cls.venue?.name ?? t('The studio') });
    else if (moving && !cls.room_id) roomHint = t('This class has no room, so the time is up to you.');
    else if (moving && day && !dateError && slots.data) {
        roomHint = free.length
            ? t('{room} is free {slots}.', { room: cls.room?.name ?? t('The room'), slots: free.map((slot) => `${formatTime(slot.start_time)}–${formatTime(slot.end_time)}`).join(' · ') })
            : t('{room} has no free time left that day.', { room: cls.room?.name ?? t('The room') });
    }


    let submitLabel = t('Move the session');
    if (makeUpOnly) submitLabel = t('Add the make-up');
    else if (!moving) submitLabel = t('Call off the session');

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && !saving && onClose()}
            placement="center"
            scrollBehavior="inside"
            size="lg"
            classNames={{ base: 'rtDialog scgDialog adminPortal' }}
        >
            <ModalContent>
                <form onSubmit={save} noValidate>
                    <ModalHeader className="rtDialogHead">
                        <span className="rtDialogIcon" aria-hidden="true">
                            {makeUpOnly ? <LuCalendarPlus /> : <LuCalendarClock />}
                        </span>
                        <span>
                            <span className="rtDialogTitle">{makeUpOnly ? t('Schedule the make-up') : t('Call off or move the session')}</span>
                            <small>
                                {cls.name} · {formatDate(date, 'long')}
                                {session.start && <span className="scgNoWrap"> · {`${session.start}–${session.end}`}</span>}
                            </small>
                        </span>
                    </ModalHeader>
                    <ModalBody className="rtDialogBody scgBody">
                        {makeUpOnly ? (
                            <p className="rtDialogLead">{t('The {day} session is called off. Pick the make-up’s day and time: the class sees both.', { day: changeDay(date, i18n) })}</p>
                        ) : (
                            <div className="scgChoice" role="group" aria-label={t('What happens to the session?')}>
                                {CHOICES.map((choice) => (
                                    <button key={choice.key} type="button" aria-pressed={what === choice.key} onClick={() => choose(choice.key)}>
                                        <choice.icon aria-hidden="true" />
                                        <span>
                                            <strong>{t(choice.label)}</strong>
                                            <small>{t(choice.hint)}</small>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <ReasonField value={reason} onChange={editReason} isDisabled={saving} />

                        <AnimatePresence initial={false}>
                            {moving && (
                                <motion.fieldset
                                    key="make-up"
                                    className="scgMakeUp"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    <legend>{t('The make-up')}</legend>
                                    <Input
                                        type="date"
                                        label={t('Date')}
                                        min={today}
                                        value={day}
                                        onValueChange={(value) => {
                                            setNewDate(value);
                                            clear();
                                        }}
                                        isInvalid={Boolean(dateError)}
                                        errorMessage={dateError || undefined}
                                        description={day && !dateError ? formatDate(day, 'long') : suggestion.loading ? t('Finding a free day…') : undefined}
                                    />
                                    <div className="rtFormRow">
                                        <Select label={t('From')} selectedKeys={start ? [start] : []} disallowEmptySelection onChange={(event) => pickStart(event.target.value)} classNames={{ popoverContent: 'adminPortal' }}>
                                            {TIME_OPTIONS.slice(0, -1).map((time) => (
                                                <SelectItem key={time}>{time}</SelectItem>
                                            ))}
                                        </Select>
                                        <Select
                                            label={t('To')}
                                            selectedKeys={end ? [end] : []}
                                            disallowEmptySelection
                                            onChange={(event) => {
                                                if (!event.target.value) return;
                                                setEnd(event.target.value);
                                                clear();
                                            }}
                                            isInvalid={Boolean(timeError)}
                                            errorMessage={timeError || undefined}
                                            classNames={{ popoverContent: 'adminPortal' }}
                                        >
                                            {TIME_OPTIONS.slice(1).map((time) => (
                                                <SelectItem key={time}>{time}</SelectItem>
                                            ))}
                                        </Select>
                                    </div>
                                    {roomHint && (
                                        <p className={`rtRoomHint${cls.room_id && !fits && !timeError ? ' isWarn' : ''}`}>
                                            <PlaceIcon place={{ kind: cls.venue_id ? 'venue' : 'room' }} />
                                            <span>
                                                {roomHint}
                                                {cls.room_id && free.length > 0 && !fits && !timeError && <strong> {t('The time you picked isn’t in a free stretch.')}</strong>}
                                            </span>
                                        </p>
                                    )}
                                </motion.fieldset>
                            )}
                        </AnimatePresence>

                        {notes.map((note) => (
                            <p key={note.key} className="rtNotice isWarn scgShoot">
                                <LuClapperboard aria-hidden="true" />
                                <span>{t(note.key, { ...note.vars, day: note.date ? changeDay(note.date, i18n) : '' })}</span>
                            </p>
                        ))}

                        {problem && (
                            <p className="rtNotice isError" role="alert">
                                <LuAlertTriangle aria-hidden="true" />
                                <span>{typeof problem === 'string' ? problem : t(problem.key, problem.vars)}</span>
                            </p>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose} isDisabled={saving}>
                            {t('Close')}
                        </Button>
                        <Button type="submit" color="danger" isLoading={saving} isDisabled={!canSave}>
                            {submitLabel}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default RescheduleDialog;
