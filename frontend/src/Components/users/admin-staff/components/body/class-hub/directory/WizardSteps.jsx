import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, Button, Input, Select, SelectItem } from '@nextui-org/react';
import { LuMusic, LuPlus, LuX } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { TIME_OPTIONS, WEEKDAYS, formatTime, formatVnd, toMinutes } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import DateField from '@/ui/DateField';
import PlaceField from '../../../common/PlaceField';
import LevelField from '../../../common/LevelField';
import { bySlot } from '../hubModel';

const POPOVER = { popoverContent: 'adminPortal' };

// Step 1: what the class is. `form` { name, instructorId, place (lib/place.js key), price, startsOn, level ('' = none) }.
export const DetailsStep = ({ form, onChange, instructors, rooms, venues, today, problems, tried }) => {
    const { t } = useI18n();
    const set = (field) => (value) => onChange({ ...form, [field]: value });
    const show = (key) => tried && problems[key];
    return (
        <div className="hubWizardGrid">
            <Input
                autoFocus
                label={t('Class Name')}
                isRequired
                value={form.name}
                onValueChange={set('name')}
                maxLength={80}
                isInvalid={show('name')}
                errorMessage={show('name') ? t('Give the class a name.') : undefined}
                className="isWide"
            />
            <Select
                label={t('Instructor')}
                isRequired
                classNames={POPOVER}
                placeholder={instructors.length ? t('Select an instructor') : t('No instructors yet')}
                selectedKeys={form.instructorId ? [form.instructorId] : []}
                onChange={(event) => set('instructorId')(event.target.value)}
                isInvalid={show('instructor')}
                errorMessage={show('instructor') ? t('Choose who teaches it.') : undefined}
            >
                {instructors.map((person) => (
                    <SelectItem
                        key={person.id}
                        textValue={person.full_name || person.username}
                        startContent={<Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(person.avatar_path, person.updated_at) ?? undefined} name={person.full_name} />}
                    >
                        {person.full_name || person.username}
                    </SelectItem>
                ))}
            </Select>
            <PlaceField value={form.place} onChange={set('place')} rooms={rooms} venues={venues} roomHint={t('Optional. A class without a room blocks no room.')} />
            <Input
                label={t('Price (VND)')}
                type="number"
                min={0}
                step={1000}
                isRequired
                value={form.price}
                onValueChange={set('price')}
                description={!show('price') && form.price ? t('Per course: {amount}', { amount: formatVnd(form.price) }) : t('What one course (routine) costs.')}
                isInvalid={show('price')}
                errorMessage={show('price') ? t('Enter a price of 0 or more.') : undefined}
            />
            <DateField
                label={t('Starts on')}
                value={form.startsOn}
                onChange={set('startsOn')}
                isRequired
                description={form.startsOn > today ? t('An upcoming class: it takes sign-ups now and meets from this day.') : t('Today or a later day.')}
                isInvalid={show('startsOn')}
                errorMessage={show('startsOn') ? t('Pick today or a later day.') : undefined}
            />
            <LevelField value={form.level} onChange={set('level')} />
        </div>
    );
};

// Step 2: weekly sessions, added one by one (the room's clashes are reported as they happen).
export const SessionsStep = ({ slots, busy, error, onAdd, onRemove }) => {
    const { t, dayName } = useI18n();
    const [draft, setDraft] = useState({ day: '', start: '', end: '' });
    const timeError = draft.start && draft.end && toMinutes(draft.start) >= toMinutes(draft.end) ? t('End time must be after start time.') : '';
    const ready = draft.day && draft.start && draft.end && !timeError;
    const set = (field) => (event) => setDraft((old) => ({ ...old, [field]: event.target.value }));

    const add = async () => {
        if (!ready) return;
        if (await onAdd({ dayOfWeek: Number(draft.day), startTime: draft.start, endTime: draft.end })) setDraft({ day: '', start: '', end: '' });
    };

    return (
        <div className="hubWizardStack">
            <p className="hubHint">{t('When does the class meet every week? Add each session; you can change them later on the class page.')}</p>
            <ul className="hubSlotList" aria-label={t('Weekly sessions')}>
                <AnimatePresence initial={false}>
                    {[...slots].sort(bySlot).map((slot) => (
                        <motion.li key={slot.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} className="hubSlotItem">
                            <strong>{dayName(slot.day_of_week)}</strong>
                            <span>
                                {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                            </span>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                aria-label={t('Remove the {day} session', { day: dayName(slot.day_of_week) })}
                                isDisabled={busy}
                                onPress={() => onRemove(slot)}
                            >
                                <LuX />
                            </Button>
                        </motion.li>
                    ))}
                </AnimatePresence>
                {slots.length === 0 && <li className="hubSlotItem isEmpty">{t('No weekly sessions yet')}</li>}
            </ul>
            <div className="hubSlotForm">
                <Select label={t('Day of the Week')} classNames={POPOVER} selectedKeys={draft.day ? [draft.day] : []} onChange={set('day')}>
                    {WEEKDAYS.map((day) => (
                        <SelectItem key={String(day.value)}>{dayName(day.value)}</SelectItem>
                    ))}
                </Select>
                <Select label={t('Start Time')} classNames={POPOVER} selectedKeys={draft.start ? [draft.start] : []} onChange={set('start')}>
                    {TIME_OPTIONS.slice(0, -1).map((time) => (
                        <SelectItem key={time}>{time}</SelectItem>
                    ))}
                </Select>
                <Select
                    label={t('End Time')}
                    classNames={POPOVER}
                    selectedKeys={draft.end ? [draft.end] : []}
                    onChange={set('end')}
                    isInvalid={Boolean(timeError)}
                    errorMessage={timeError || undefined}
                >
                    {TIME_OPTIONS.slice(1).map((time) => (
                        <SelectItem key={time}>{time}</SelectItem>
                    ))}
                </Select>
                <Button variant="flat" startContent={<LuPlus aria-hidden="true" />} isDisabled={!ready} isLoading={busy} onPress={add}>
                    {t('Add session')}
                </Button>
            </div>
            {error && (
                <p className="hubFormError" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
};

// Step 3: the first routine (= the first course the students pay for).
export const RoutineStep = ({ routine, onChange, startsOn, price }) => {
    const { t, formatDate } = useI18n();
    const set = (field) => (value) => onChange({ ...routine, [field]: value });
    const count = Number(routine.sessions);
    const countInvalid = routine.sessions !== '' && !(Number.isInteger(count) && count >= 1 && count <= 60);
    return (
        <div className="hubWizardGrid">
            <p className="hubHint isWide">
                {t('A routine is the piece the class learns over a number of sessions, ending with the video shoot. It is also the course students pay for.')}
            </p>
            <Input
                autoFocus
                className="isWide"
                label={t('Routine')}
                placeholder={t('Song — Artist')}
                maxLength={120}
                startContent={<LuMusic className="text-default-400" aria-hidden="true" />}
                value={routine.title}
                onValueChange={set('title')}
            />
            <Input
                label={t('Number of sessions')}
                type="number"
                min={1}
                max={60}
                value={routine.sessions}
                onValueChange={set('sessions')}
                isInvalid={countInvalid}
                errorMessage={countInvalid ? t('Between 1 and 60 sessions.') : undefined}
                description={t('Starts with the class on {date}.', { date: formatDate(startsOn, 'dayMonth') })}
            />
            <Input
                label={t('Course fee (VND)')}
                type="number"
                min={0}
                step={1000}
                value={routine.price}
                onValueChange={set('price')}
                placeholder={String(price ?? '')}
                description={t('Leave empty to use the class price.')}
            />
        </div>
    );
};
