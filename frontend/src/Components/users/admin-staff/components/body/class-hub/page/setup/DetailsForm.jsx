import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Input, Select, SelectItem } from '@nextui-org/react';
import { LuCheck } from 'react-icons/lu';
import { classBookingClashes, moveClassToRoom, updateClass } from '@/services/classes';
import { clashBookingId, clashText } from '@/services/errors';
import { avatarUrl } from '@/services/storage';
import { placeColumns, placeKeyOf } from '@/lib/place';
import { MAX_STUDENTS_LIMIT, maxStudentsProblem, placesTaken } from '@/lib/classSeats';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import DateField from '@/ui/DateField';
import PlaceField from '../../../../common/PlaceField';
import LevelField from '../../../../common/LevelField';
import { personName } from '../../hubModel';
import RoomClashDialog from './RoomClashDialog';

const POPOVER = { popoverContent: 'adminPortal' };

const fromClass = (cls) => ({
    name: cls.name,
    instructorId: cls.instructor_id,
    place: placeKeyOf(cls),
    price: String(cls.price),
    startsOn: cls.starts_on,
    level: cls.level ?? '',
    maxStudents: cls.max_students ? String(cls.max_students) : '',
});

// The class's details in place. The start date can only move while the class hasn't started. Moving the
// class to another room or rented studio moves its sessions not started yet (the server does it). A studio room
// booked on some of the class's days doesn't block the move: RoomClashDialog places those sessions first (another
// room that day, or none yet — a to-do), then the class moves; any other clash says what it is, with its booking.
const DetailsForm = ({ cls, today, instructors, rooms, venues, readOnly, onSaved }) => {
    const { t } = useI18n();
    const toast = useToast();
    const [form, setForm] = useState(() => fromClass(cls));
    const [saving, setSaving] = useState(false);
    const [clash, setClash] = useState(null); // { room, days } while RoomClashDialog is open
    const navigate = useNavigate();
    const initial = fromClass(cls);
    const notStarted = cls.starts_on > today;
    const set = (field) => (value) => setForm((old) => ({ ...old, [field]: value }));
    const price = Number(form.price);
    // Places held now: the maximum can't go below them (guard_class_max).
    const taken = placesTaken(cls.students ?? [], today);
    const maxProblem = maxStudentsProblem(form.maxStudents, taken);
    const problems = {
        maxStudents: Boolean(maxProblem),
        name: !form.name.trim(),
        price: form.price === '' || Number.isNaN(price) || price < 0,
        startsOn: notStarted && (!form.startsOn || form.startsOn < today),
    };
    const dirty = Object.keys(initial).some((key) => String(initial[key] ?? '') !== String(form[key] ?? ''));
    const valid = !Object.values(problems).some(Boolean) && form.instructorId;

    const fields = () => ({ ...form, ...placeColumns(form.place), startsOn: notStarted ? form.startsOn : undefined });
    const target = placeColumns(form.place);

    const save = async (event) => {
        event?.preventDefault();
        if (!valid || !dirty) return;
        setSaving(true);
        try {
            await updateClass(cls.id, fields());
            toast.success('Class updated.');
            onSaved();
        } catch (error) {
            const bookingId = error.code === 'SLOT_TAKEN' ? clashBookingId(error) : null;
            // Moving into a studio room booked on some of its days: deal with those sessions one by one.
            if (bookingId && target.roomId && form.place !== initial.place) {
                const days = await classBookingClashes(cls.id, target.roomId).catch(() => []);
                if (days.length) {
                    setClash({ room: rooms.find((room) => room.id === target.roomId), days });
                    return;
                }
            }
            if (error.code === 'DUPLICATE') toast.error('A class with this name already exists.');
            else if (error.code === 'SLOT_TAKEN' && error.detail)
                toast.error(t('That room isn’t free at this class’s times: {detail}.', { detail: clashText(error.detail) }), {
                    action: bookingId ? { label: 'Open booking', onPress: () => navigate(`/admin/bookings?booking=${bookingId}`) } : undefined,
                });
            else toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    // The clashing sessions placed and the class moved (one call), then the rest of the details.
    const moveWithPlaces = async (places) => {
        try {
            await moveClassToRoom(cls.id, target.roomId, places);
            await updateClass(cls.id, fields());
            setClash(null);
            const unplaced = places.filter((place) => place.room_id === null).length;
            toast.success(unplaced ? t('Class moved. {count} session(s) have no room yet: see the to-do list.', { count: unplaced }) : 'Class updated.');
            onSaved();
        } catch (error) {
            toast.error(error.code === 'SLOT_TAKEN' && error.detail ? t('That room isn’t free at this class’s times: {detail}.', { detail: clashText(error.detail) }) : error);
        }
    };

    return (
        <form className="hubForm" onSubmit={save} noValidate>
            <Input label={t('Class Name')} value={form.name} onValueChange={set('name')} isReadOnly={readOnly} isInvalid={problems.name} maxLength={80} className="isWide" />
            <Select
                label={t('Instructor')}
                classNames={POPOVER}
                isDisabled={readOnly}
                selectedKeys={form.instructorId ? [form.instructorId] : []}
                onChange={(event) => event.target.value && set('instructorId')(event.target.value)}
                description={t('For one session only, use “Substitute instructor” in Sessions.')}
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
            <PlaceField value={form.place} onChange={set('place')} rooms={rooms} venues={venues} isDisabled={readOnly} />
            <Input
                label={t('Price (VND)')}
                type="number"
                min={0}
                step={1000}
                value={form.price}
                onValueChange={set('price')}
                isReadOnly={readOnly}
                isInvalid={problems.price}
                description={t('The fee of a course unless the routine sets its own.')}
            />
            <DateField
                label={t('Starts on')}
                value={form.startsOn}
                onChange={set('startsOn')}
                isReadOnly={readOnly || !notStarted}
                isInvalid={problems.startsOn}
                description={notStarted ? t('Still upcoming: you can move the first day.') : t('The class has started; its first day stays.')}
            />
            <LevelField value={form.level} onChange={set('level')} isDisabled={readOnly} />
            <Input
                label={t('Max students')}
                type="number"
                min={Math.max(1, taken)}
                max={MAX_STUDENTS_LIMIT}
                step={1}
                placeholder={t('No limit')}
                value={form.maxStudents}
                onValueChange={set('maxStudents')}
                isReadOnly={readOnly}
                isInvalid={problems.maxStudents}
                errorMessage={
                    maxProblem === 'below'
                        ? t('{count} students already hold a place: the maximum can’t be lower.', { count: taken })
                        : maxProblem
                          ? t('A whole number from 1 to {max}, or empty for no limit.', { max: MAX_STUDENTS_LIMIT })
                          : undefined
                }
                description={t('{count} in the class now. When it is full, nobody can ask to join and nobody new can be added.', { count: taken })}
            />
            {clash && <RoomClashDialog cls={cls} room={clash.room} days={clash.days} onClose={() => setClash(null)} onConfirm={moveWithPlaces} />}
            {!readOnly && (
                <div className="hubFormActions isWide">
                    <Button variant="light" isDisabled={!dirty || saving} onPress={() => setForm(fromClass(cls))}>
                        {t('Undo changes')}
                    </Button>
                    <Button type="submit" color="danger" isLoading={saving} isDisabled={!dirty || !valid} startContent={saving ? null : <LuCheck aria-hidden="true" />}>
                        {t('Save details')}
                    </Button>
                </div>
            )}
        </form>
    );
};

export default DetailsForm;
