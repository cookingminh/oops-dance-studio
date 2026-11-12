import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, Button, Input, Select, SelectItem } from '@nextui-org/react';
import { LuMusic, LuPlus, LuSparkles, LuUsers, LuWallet, LuX } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { TIME_OPTIONS, WEEKDAYS, formatTime, formatVnd, toMinutes } from '@/lib/format';
import { placeColumns } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import DateField from '@/ui/DateField';
import TimetableDisc from '@/ui/timetable/TimetableDisc';
import { AVATAR_FRAME } from '@/ui/timetable/timetableFrame';
import PlaceField from '../../../common/PlaceField';
import LevelPicker from '../../../common/LevelPicker';
import { groupDigits, parseAmountInput } from '../../expenses/expensesModel';
import { bySlot, personName } from '../hubModel';

const POPOVER = { popoverContent: 'adminPortal' };

// The price as typed: digits grouped (1.200.000), "800k" / "1.2m" as shorthands (expensesModel.js).
const PriceField = ({ value, onChange, prices, isInvalid, errorMessage }) => {
    const { t } = useI18n();
    return (
        <div className="ncPrice">
            <Input
                label={t('Price per course')}
                isRequired
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={groupDigits(value)}
                onValueChange={(text) => onChange(String(parseAmountInput(text) ?? ''))}
                endContent={<span className="ncUnit">₫</span>}
                isInvalid={isInvalid}
                errorMessage={errorMessage}
                description={isInvalid ? undefined : t('Type 800k for short.')}
            />
            {prices.length > 0 && (
                <div className="ncQuick" role="group" aria-label={t('Prices of the other classes')}>
                    {prices.map((amount) => (
                        <button key={amount} type="button" aria-pressed={Number(value) === amount} onClick={() => onChange(String(amount))}>
                            {groupDigits(amount)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// How the class will look on the website's poster timetable, as the form fills in.
const DetailsPreview = ({ form, instructor, place }) => {
    const { t, formatDate } = useI18n();
    const avatar = instructor?.avatar_path ? avatarUrl(instructor.avatar_path, instructor.updated_at) : null;
    return (
        <aside className="ncPreview" aria-label={t('Preview on the website')}>
            <span className="ncPreviewLabel">{t('On the website')}</span>
            <div className="ncPreviewStage">
                <TimetableDisc
                    name={form.name.trim() || t('Class name')}
                    level={form.level || null}
                    photo={avatar ? { src: avatar, alt: '', frame: AVATAR_FRAME } : null}
                />
            </div>
            <dl className="ncFacts">
                <div>
                    <dt>{t('Instructor')}</dt>
                    <dd>{instructor ? personName(instructor) : '—'}</dd>
                </div>
                <div>
                    <dt>{t('Where')}</dt>
                    <dd>{place?.name ?? t('Not set')}</dd>
                </div>
                <div>
                    <dt>{t('Fee')}</dt>
                    <dd>{form.price !== '' ? formatVnd(form.price) : '—'}</dd>
                </div>
                <div>
                    <dt>{t('First day')}</dt>
                    <dd>{form.startsOn ? formatDate(form.startsOn, 'long') : '—'}</dd>
                </div>
            </dl>
        </aside>
    );
};

// Step 1: what the class is. `form` { name, instructorId, place (lib/place.js key), price, startsOn, level ('' = none) };
// `prices` = the other classes' prices, offered as quick picks.
export const DetailsStep = ({ form, onChange, instructors, rooms, venues, today, problems, tried, prices = [] }) => {
    const { t } = useI18n();
    const set = (field) => (value) => onChange({ ...form, [field]: value });
    const show = (key) => tried && problems[key];
    const instructor = instructors.find((person) => person.id === form.instructorId);
    const { roomId, venueId } = placeColumns(form.place);
    const place = roomId ? rooms.find((room) => room.id === roomId) : venueId ? venues.find((venue) => venue.id === venueId) : null;

    return (
        <div className="ncDetails">
            <div className="ncForm">
                <section className="ncGroup" aria-labelledby="ncGroupClass">
                    <h3 className="ncGroupTitle" id="ncGroupClass">
                        <LuSparkles aria-hidden="true" /> {t('The class')}
                    </h3>
                    <Input
                        autoFocus
                        label={t('Class Name')}
                        placeholder={t('e.g. Girlstyle 3')}
                        isRequired
                        value={form.name}
                        onValueChange={set('name')}
                        maxLength={80}
                        isInvalid={show('name')}
                        errorMessage={show('name') ? t('Give the class a name.') : undefined}
                    />
                    <LevelPicker value={form.level} onChange={set('level')} hint={t('Colours the class on the website timetable.')} />
                </section>

                <section className="ncGroup" aria-labelledby="ncGroupWho">
                    <h3 className="ncGroupTitle" id="ncGroupWho">
                        <LuUsers aria-hidden="true" /> {t('Who and where')}
                    </h3>
                    <div className="ncPair">
                        <Select
                            label={t('Instructor')}
                            isRequired
                            classNames={POPOVER}
                            placeholder={instructors.length ? t('Select an instructor') : t('No instructors yet')}
                            selectedKeys={form.instructorId ? [form.instructorId] : []}
                            onChange={(event) => set('instructorId')(event.target.value)}
                            isInvalid={show('instructor')}
                            errorMessage={show('instructor') ? t('Choose who teaches it.') : undefined}
                            startContent={
                                instructor ? (
                                    <Avatar {...AVATAR_DEFAULTS} className="h-6 w-6 shrink-0" src={avatarUrl(instructor.avatar_path, instructor.updated_at) ?? undefined} name={personName(instructor)} />
                                ) : null
                            }
                        >
                            {instructors.map((person) => (
                                <SelectItem
                                    key={person.id}
                                    textValue={personName(person)}
                                    startContent={<Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(person.avatar_path, person.updated_at) ?? undefined} name={personName(person)} />}
                                >
                                    {personName(person)}
                                </SelectItem>
                            ))}
                        </Select>
                        <PlaceField value={form.place} onChange={set('place')} rooms={rooms} venues={venues} roomHint={t('Optional: you can set it later.')} />
                    </div>
                </section>

                <section className="ncGroup" aria-labelledby="ncGroupFee">
                    <h3 className="ncGroupTitle" id="ncGroupFee">
                        <LuWallet aria-hidden="true" /> {t('Fee and first day')}
                    </h3>
                    <div className="ncPair">
                        <PriceField
                            value={form.price}
                            onChange={set('price')}
                            prices={prices}
                            isInvalid={show('price')}
                            errorMessage={show('price') ? t('Enter a price of 0 or more.') : undefined}
                        />
                        <DateField
                            label={t('Starts on')}
                            value={form.startsOn}
                            onChange={set('startsOn')}
                            isRequired
                            description={form.startsOn > today ? t('Opens later: it takes sign-ups now.') : t('Today or a later day.')}
                            isInvalid={show('startsOn')}
                            errorMessage={show('startsOn') ? t('Pick today or a later day.') : undefined}
                        />
                    </div>
                </section>
            </div>
            <DetailsPreview form={form} instructor={instructor} place={place} />
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
