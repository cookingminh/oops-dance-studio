import { useState } from 'react';
import { addDays, parseISO } from 'date-fns';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@nextui-org/react';
import { LuAlertTriangle, LuCalendarPlus, LuStickyNote } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { addMakeUpSession } from '@/services/classes';
import { getAvailableSlots } from '@/services/bookings';
import { TIME_OPTIONS, formatTime, toIsoDate, toMinutes } from '@/lib/format';
import { meetsOn, usualSlot } from '@/lib/lessons';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import { PlaceIcon } from '@/ui/place/PlaceParts';
import { makeUpProblem } from './routineData';
import './routines.scss';

const toClock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const CLOSE = toMinutes('22:00');
const onGrid = (time) => TIME_OPTIONS.includes(time);

// First day from today the class doesn't meet (and has no make-up yet) while it runs.
function firstFreeDay(cls, today, takenDates) {
    for (let offset = 0; offset < 21; offset += 1) {
        const day = toIsoDate(addDays(parseISO(today), offset));
        if (cls.ended_on && day > cls.ended_on) break;
        if ((!cls.starts_on || day >= cls.starts_on) && !meetsOn(cls, day) && !takenDates.has(day)) return day;
    }
    return today;
}

// Add a one-off (make-up) session: a day the class doesn't meet, today or later, with its own times on
// the 30-minute grid (prefilled with the class's usual length). The server checks the room against
// bookings, classes and other make-ups and says what it is taken by.
const MakeUpDialog = ({ cls, today, makeUps = [], onClose, onAdded }) => {
    const toast = useToast();
    const { t, formatDate } = useI18n();
    const usual = usualSlot(cls);
    const takenDates = new Set(makeUps.map((row) => row.date));
    const [date, setDate] = useState(() => firstFreeDay(cls, today, takenDates));
    const [start, setStart] = useState(() => (onGrid(usual.start) ? usual.start : '18:00'));
    const [end, setEnd] = useState(() => toClock(Math.min(CLOSE, toMinutes(onGrid(usual.start) ? usual.start : '18:00') + usual.minutes)));
    const [note, setNote] = useState('');
    const [problem, setProblem] = useState(null); // { key, vars } or an already translated message
    const [saving, setSaving] = useState(false);

    const slots = useAsync(async () => (date && date >= today ? getAvailableSlots(date) : []), [date, today]);
    const free = (slots.data ?? []).filter((slot) => slot.room_id === cls.room_id);

    let dateError = '';
    if (date && date < today) dateError = t('Pick today or a later day.');
    else if (date && cls.starts_on && date < cls.starts_on) dateError = t('The class only starts on {date}.', { date: formatDate(cls.starts_on, 'short') });
    else if (date && cls.ended_on && date > cls.ended_on) dateError = t('The class ends on {date}.', { date: formatDate(cls.ended_on, 'short') });
    else if (date && meetsOn(cls, date)) dateError = t('The class already meets on {day}. Pick a day without a class.', { day: formatDate(date, 'weekday') });
    else if (takenDates.has(date)) dateError = t('There is already a make-up session that day.');
    const timeError = start && end && toMinutes(end) <= toMinutes(start) ? t('End time must be after start time.') : '';
    const fits = free.some((slot) => formatTime(slot.start_time) <= start && formatTime(slot.end_time) >= end);
    const canSave = date && !dateError && start && end && !timeError;

    // Moving the start keeps the session's length.
    const pickStart = (value) => {
        if (!value) return;
        const length = Math.max(30, toMinutes(end) - toMinutes(start));
        setStart(value);
        setEnd(toClock(Math.min(CLOSE, toMinutes(value) + length)));
        setProblem(null);
    };

    const save = async () => {
        setSaving(true);
        setProblem(null);
        try {
            await addMakeUpSession(cls.id, date, start, end, note.trim() || null);
            toast.success(t('Make-up session added on {date}.', { date: formatDate(date, 'short') }));
            onAdded();
        } catch (error) {
            setProblem(makeUpProblem(error) ?? t(error.message));
        } finally {
            setSaving(false);
        }
    };

    let roomHint = null;
    // Room clashes only concern the studio's rooms; a rented studio's own diary is the staff's to check.
    if (cls.venue_id) roomHint = t('{venue} is a rented studio: check with them that it’s free then.', { venue: cls.venue?.name ?? t('The studio') });
    else if (!cls.room_id) roomHint = t('This class has no room, so the time is up to you.');
    else if (date && !dateError && slots.data) {
        roomHint = free.length
            ? t('{room} is free {slots}.', { room: cls.room?.name ?? t('The room'), slots: free.map((slot) => `${formatTime(slot.start_time)}–${formatTime(slot.end_time)}`).join(' · ') })
            : t('{room} has no free time left that day.', { room: cls.room?.name ?? t('The room') });
    }

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} placement="center" scrollBehavior="inside" classNames={{ base: 'rtDialog adminPortal' }}>
            <ModalContent>
                <ModalHeader className="rtDialogHead">
                    <span className="rtDialogIcon" aria-hidden="true">
                        <LuCalendarPlus />
                    </span>
                    <span>
                        <span className="rtDialogTitle">{t('Add a make-up session')}</span>
                        <small>{cls.name}</small>
                    </span>
                </ModalHeader>
                <ModalBody className="rtDialogBody">
                    <p className="rtDialogLead">{t('A one-off session on a day the class doesn’t meet. It gets a roll call and counts for the routine and the instructor’s pay.')}</p>
                    <Input
                        type="date"
                        label={t('Date')}
                        min={today}
                        value={date}
                        onValueChange={(value) => {
                            setDate(value);
                            setProblem(null);
                        }}
                        isInvalid={Boolean(dateError)}
                        errorMessage={dateError || undefined}
                        description={date && !dateError ? formatDate(date, 'long') : undefined}
                    />
                    <div className="rtFormRow">
                        <Select
                            label={t('From')}
                            selectedKeys={start ? [start] : []}
                            disallowEmptySelection
                            onChange={(event) => pickStart(event.target.value)}
                            classNames={{ popoverContent: 'adminPortal' }}
                        >
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
                                setProblem(null);
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
                    <Input
                        label={t('Note (optional)')}
                        placeholder={t('e.g. Makes up for the cancelled Tuesday')}
                        maxLength={300}
                        startContent={<LuStickyNote className="text-default-400" aria-hidden="true" />}
                        value={note}
                        onValueChange={setNote}
                    />
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
                    <Button color="danger" onPress={save} isLoading={saving} isDisabled={!canSave}>
                        {t('Add session')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default MakeUpDialog;
