import { useState } from 'react';
import { Button, Input } from '@nextui-org/react';
import { LuAlertTriangle, LuArrowRight, LuBanknote, LuCalendarDays, LuFlag, LuMinus, LuMusic, LuPlus } from 'react-icons/lu';
import { saveRoutine } from '@/services/classes';
import { routineNeighbours, sessionDates } from '@/lib/lessons';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';

const MAX_SESSIONS = 60; // class_lessons.session_count check
const digits = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 10);
const grouped = (value) => (value === '' ? '' : Number(value).toLocaleString('vi-VN'));

// Plan a routine (no `initial.id`) or change one: its song, how many sessions it takes, when it starts
// and its course fee (tuition is per course), with a live preview of its first and last session (the
// shoot day). `options` are the class's make-up and cancelled days (routineData.dateOptions) so the
// preview matches the server. A fee equal to the class price is saved as "the class price" (null).
// One routine at a time: a new routine starts after the last session of the latest one (students of that
// one are asked whether they continue with it); an edited one stays between its neighbours.
const RoutineForm = ({ cls, routines, options, initial, onCancel, onSaved, idPrefix = 'routine' }) => {
    const toast = useToast();
    const { t, formatDate } = useI18n();
    const isNew = !initial.id;
    const [title, setTitle] = useState(initial.title ?? '');
    const [count, setCount] = useState(String(initial.sessionCount ?? 8));
    const [startsOn, setStartsOn] = useState(initial.startsOn ?? '');
    const [price, setPrice] = useState(digits(initial.price ?? cls.price));
    const [saving, setSaving] = useState(false);

    const sessions = Number(count);
    const countValid = Number.isInteger(sessions) && sessions >= 1 && sessions <= MAX_SESSIONS;
    const dates = startsOn && countValid ? sessionDates(cls, startsOn, { ...options, count: sessions }) : [];
    const end = countValid && dates.length === sessions ? dates.at(-1) : null;
    const { before, after, earliest } = routineNeighbours(routines, { id: initial.id, startsOn: initial.startsOn });
    const startsEarly = Boolean(startsOn && earliest && startsOn < earliest);
    const endsLate = Boolean(end && after && end >= after.starts_on);
    // A new routine follows one that is still on (or planned): say what happens at the hand-over.
    const follows = isNew && before && ['current', 'planned'].includes(before.status) && before.ends_on ? before : null;
    const fee = price === '' || Number(price) === Number(cls.price) ? null : Number(price);
    const unchanged = !isNew && title.trim() === initial.title && sessions === initial.sessionCount && startsOn === initial.startsOn
        && fee === (initial.price === null || initial.price === undefined || Number(initial.price) === Number(cls.price) ? null : Number(initial.price));
    const canSave = title.trim() && countValid && startsOn && !unchanged && !startsEarly && !endsLate;

    const step = (by) => setCount(String(Math.min(MAX_SESSIONS, Math.max(1, (countValid ? sessions : 8) + by))));

    const save = async (event) => {
        event.preventDefault();
        if (!canSave) return;
        setSaving(true);
        try {
            await saveRoutine({ id: initial.id, classId: cls.id, title, startsOn, sessionCount: sessions, price: fee });
            toast.success(isNew ? t('“{title}” is planned.', { title: title.trim() }) : 'Routine saved.');
            onSaved();
        } catch (error) {
            if (error.code === 'DUPLICATE') toast.error(t('Another routine of this class already starts on that day.'));
            else if (error.code === 'INVALID_STATE' && /routine order/i.test(error.detail ?? '')) toast.error(t('This would overlap another routine. Refresh the page and check the dates.'));
            else toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form className="rtForm" onSubmit={save} aria-label={isNew ? t('Plan the next routine') : t('Edit routine')}>
            {follows && (
                <p className="rtFollows">
                    <LuFlag aria-hidden="true" />
                    <span>
                        {t('“{title}” ends on {date} (its shoot day). The next routine starts after it, and its students are asked whether they continue.', {
                            title: follows.title,
                            date: formatDate(follows.ends_on, 'short'),
                        })}
                    </span>
                </p>
            )}
            <Input
                autoFocus={!isNew}
                label={t('Routine')}
                placeholder={t('Song — Artist')}
                description={t('The piece the class learns, e.g. Super Shy — NewJeans.')}
                maxLength={120}
                startContent={<LuMusic className="text-default-400" aria-hidden="true" />}
                value={title}
                onValueChange={setTitle}
            />
            <div className="rtFormRow">
                <Input
                    type="number"
                    label={t('Sessions')}
                    min={1}
                    max={MAX_SESSIONS}
                    value={count}
                    onValueChange={setCount}
                    isInvalid={count !== '' && !countValid}
                    errorMessage={t('From 1 to {max} sessions.', { max: MAX_SESSIONS })}
                    classNames={{ input: 'rtCountInput' }}
                    endContent={
                        <span className="rtStepper">
                            <button type="button" aria-label={t('One session fewer')} onClick={() => step(-1)} disabled={countValid && sessions <= 1}>
                                <LuMinus aria-hidden="true" />
                            </button>
                            <button type="button" aria-label={t('One session more')} onClick={() => step(1)} disabled={countValid && sessions >= MAX_SESSIONS}>
                                <LuPlus aria-hidden="true" />
                            </button>
                        </span>
                    }
                />
                <Input
                    type="date"
                    label={t('Starts on')}
                    value={startsOn}
                    onValueChange={setStartsOn}
                    min={earliest ?? undefined}
                    isInvalid={startsEarly}
                    errorMessage={
                        startsEarly
                            ? t('“{title}” runs until {date}. Pick a later day.', { title: before.title, date: formatDate(before.ends_on, 'short') })
                            : undefined
                    }
                    startContent={<LuCalendarDays className="text-default-400" aria-hidden="true" />}
                />
            </div>
            <Input
                label={t('Course fee')}
                inputMode="numeric"
                value={grouped(price)}
                onValueChange={(value) => setPrice(digits(value))}
                placeholder={grouped(digits(cls.price))}
                description={t('Students pay this per course; someone joining late pays for the sessions left.')}
                startContent={<LuBanknote className="text-default-400" aria-hidden="true" />}
                endContent={<span className="text-small text-default-400">₫</span>}
            />

            <div className="rtPreview" aria-live="polite" id={`${idPrefix}-preview`}>
                {!startsOn || !countValid ? (
                    <p className="rtPreviewHint">{t('Pick a start day and the number of sessions to see when it ends.')}</p>
                ) : end ? (
                    <div className="rtPreviewDates">
                        <span>
                            <small>{t('First session')}</small>
                            <strong>{formatDate(dates[0], 'short')}</strong>
                        </span>
                        <LuArrowRight aria-hidden="true" />
                        <span>
                            <small>{t('Last session · shoot day')}</small>
                            <strong>{formatDate(end, 'short')}</strong>
                        </span>
                    </div>
                ) : (
                    <p className="rtPreviewWarn">
                        <LuAlertTriangle aria-hidden="true" />
                        {cls.ended_on
                            ? t('The class ends on {date}, before the last session.', { date: formatDate(cls.ended_on, 'short') })
                            : t('The class has no weekly sessions to count yet. Add one first.')}
                    </p>
                )}
                {endsLate && (
                    <p className="rtPreviewWarn" role="alert">
                        <LuAlertTriangle aria-hidden="true" />
                        {t('It would still run when “{title}” starts on {date}. Use fewer sessions or move “{title}” later first.', {
                            title: after.title,
                            date: formatDate(after.starts_on, 'short'),
                        })}
                    </p>
                )}
            </div>

            <div className="rtFormActions">
                {onCancel && (
                    <Button variant="light" onPress={onCancel} isDisabled={saving}>
                        {t('Cancel')}
                    </Button>
                )}
                <Button type="submit" color="danger" isLoading={saving} isDisabled={!canSave}>
                    {isNew ? t('Plan routine') : t('Save changes')}
                </Button>
            </div>
        </form>
    );
};

export default RoutineForm;
