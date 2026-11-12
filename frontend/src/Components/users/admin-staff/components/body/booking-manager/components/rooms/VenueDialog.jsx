import { useRef, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch, Textarea } from '@nextui-org/react';
import { LuArrowUp, LuCheck, LuMapPin, LuPlus, LuRotateCcw, LuTrash2 } from 'react-icons/lu';
import { saveVenue } from '@/services/venues';
import { mapLinkOf } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';

const fold = (text) => text.trim().toLocaleLowerCase('vi');
// A new studio's first room (the server's name for it too).
const FIRST_ROOM = { key: 'new0', id: null, name: 'Phòng 1', rent: '', active: true };

// The rent lives on the rooms: a studio has at least one (a new one starts with "Phòng 1", its price to fill in).
const fromVenue = (venue) => ({
    name: venue?.name ?? '',
    publicName: venue?.public_name ?? '',
    address: venue?.address ?? '',
    mapUrl: venue?.map_url ?? '',
    note: venue?.note ?? '',
    active: venue?.active ?? true,
    // `key`: the row's React key (a saved room's id, or a new one's own).
    rooms: venue?.rooms?.length
        ? venue.rooms.map((room) => ({ key: `r${room.id}`, id: room.id, name: room.name, rent: String(room.rent_per_hour ?? 0), active: room.active }))
        : [FIRST_ROOM],
});

// What a room row is missing, if anything: 'name' | 'duplicate' and / or 'rent'.
function roomProblems(rooms) {
    const counts = new Map();
    for (const room of rooms) counts.set(fold(room.name), (counts.get(fold(room.name)) ?? 0) + 1);
    return rooms.map((room) => {
        const rent = Number(room.rent);
        return {
            name: !room.name.trim() ? 'name' : counts.get(fold(room.name)) > 1 ? 'duplicate' : null,
            rent: room.rent === '' || Number.isNaN(rent) || rent < 0,
        };
    });
}

// Add or change a rented studio: name, the name on the website, address, map link, its rooms (at least one, each
// with its rent per hour), a note for staff and whether classes can still be put there (inactive: out of the
// pickers, history kept). `venue` null = a new one. `classes` [{ id, name, venue_room_id }]: the classes taught
// there now, so removing a room they are in asks first.
const VenueDialog = ({ venue, classes = [], onClose, onSaved }) => {
    const { t } = useI18n();
    const toast = useToast();
    const [form, setForm] = useState(() => fromVenue(venue));
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);
    const [removedSaved, setRemovedSaved] = useState(false);
    const nextKey = useRef(0);
    const set = (field) => (value) => setForm((old) => ({ ...old, [field]: value }));
    const setRooms = (change) => setForm((old) => ({ ...old, rooms: change(old.rooms) }));
    const setRoom = (key, field) => (value) => setRooms((rooms) => rooms.map((room) => (room.key === key ? { ...room, [field]: value } : room)));

    const roomIssues = roomProblems(form.rooms);
    // The last room in use can't go: a studio has at least one.
    const inUse = form.rooms.filter((room) => room.active).length;
    const problems = {
        name: !form.name.trim(),
        mapUrl: Boolean(form.mapUrl.trim()) && !/^https:\/\//i.test(form.mapUrl.trim()),
        rooms: inUse === 0 || roomIssues.some((issue) => issue.name || issue.rent),
    };
    const show = (key) => tried && problems[key];
    const mapPreview = mapLinkOf({ map_url: problems.mapUrl ? null : form.mapUrl.trim(), address: form.address.trim() });
    // What the website shows when the name on the website is left empty (the server's rule).
    const publicFallback = form.address.split(',')[0].trim() || form.name.trim();

    const addRoom = () => {
        nextKey.current += 1;
        setRooms((rooms) => [...rooms, { key: `new${nextKey.current}`, id: null, name: '', rent: '', active: true }]);
    };
    const moveUp = (index) =>
        setRooms((rooms) => {
            const next = [...rooms];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    const removeRoom = (room) => {
        const using = room.id ? classes.filter((cls) => cls.venue_room_id === room.id) : [];
        if (
            using.length > 0 &&
            !window.confirm(
                t('{classes} are taught in {room}. Remove it anyway? It stays on record as inactive and they keep it until you move them.', {
                    classes: using.map((cls) => cls.name).join(', '),
                    room: room.name || t('this room'),
                })
            )
        ) {
            return;
        }
        if (room.id) setRemovedSaved(true);
        setRooms((rooms) => rooms.filter((item) => item.key !== room.key));
    };

    const save = async (event) => {
        event.preventDefault();
        setTried(true);
        if (Object.values(problems).some(Boolean)) return;
        setSaving(true);
        try {
            const saved = await saveVenue(venue?.id ?? null, form);
            toast.success(venue ? t('{name} saved.', { name: saved.name }) : t('{name} added.', { name: saved.name }));
            onSaved(saved);
        } catch (error) {
            toast.error(error);
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen
            size="xl"
            placement="center"
            scrollBehavior="inside"
            onOpenChange={(open) => !open && !saving && onClose()}
            classNames={{ base: 'venueDialog adminPortal' }}
        >
            <ModalContent>
                <form onSubmit={save} noValidate>
                    <ModalHeader className="venueDialogHead">
                        <span className="venueDialogIcon" aria-hidden="true">
                            <LuMapPin />
                        </span>
                        <span>
                            <span>{venue ? t('Edit {name}', { name: venue.name }) : t('Add a rented studio')}</span>
                            <small>{t('A studio rented by the hour, where classes can be taught.')}</small>
                        </span>
                    </ModalHeader>
                    <ModalBody className="venueDialogBody">
                        <Input
                            autoFocus={!venue}
                            label={t('Studio name')}
                            isRequired
                            maxLength={100}
                            value={form.name}
                            onValueChange={set('name')}
                            isInvalid={show('name')}
                            errorMessage={show('name') ? t('Give the studio a name.') : undefined}
                            description={t('For staff, instructors and admins.')}
                        />
                        <Input
                            label={t('Name on the website')}
                            maxLength={80}
                            value={form.publicName}
                            onValueChange={set('publicName')}
                            placeholder={publicFallback || t('e.g. Bà Triệu')}
                            description={t('Visitors and students see this instead of the studio’s name, which is another studio’s brand. Left empty: the first part of the address.')}
                        />
                        <Input label={t('Address')} maxLength={200} value={form.address} onValueChange={set('address')} placeholder={t('Street, ward, district')} />
                        <Input
                            label={t('Map link')}
                            type="url"
                            maxLength={500}
                            value={form.mapUrl}
                            onValueChange={set('mapUrl')}
                            placeholder="https://maps.app.goo.gl/…"
                            isInvalid={show('mapUrl')}
                            errorMessage={show('mapUrl') ? t('The map link must start with https://.') : undefined}
                            description={
                                mapPreview && !form.mapUrl.trim() ? (
                                    <a href={mapPreview} target="_blank" rel="noreferrer" className="venueDialogLink">
                                        {t('Without one, “Open in Maps” searches the address.')}
                                    </a>
                                ) : (
                                    t('Optional. Paste the studio’s Google Maps link.')
                                )
                            }
                        />
                        <fieldset className="venueRoomsEditor">
                            <legend>{t('Rooms')}</legend>
                            <p className="venueRoomsIntro">
                                {t('A studio has at least one room, each with its own price per hour. Add more only if it has several: a class then picks its room in Setup.')}
                            </p>
                            {form.rooms.length > 0 && (
                                <ol className="venueRoomRows" aria-label={t('Rooms')}>
                                    {form.rooms.map((room, index) => {
                                        const issue = tried ? roomIssues[index] : {};
                                        const last = room.active && inUse === 1;
                                        return (
                                            <li key={room.key} className={`venueRoomRow${room.active ? '' : ' isInactive'}`} data-room={room.id ?? 'new'}>
                                                <Input
                                                    size="sm"
                                                    isRequired
                                                    label={t('Room name')}
                                                    maxLength={60}
                                                    value={room.name}
                                                    onValueChange={setRoom(room.key, 'name')}
                                                    autoFocus={!room.id && !room.name}
                                                    isInvalid={Boolean(issue.name)}
                                                    errorMessage={
                                                        issue.name === 'duplicate' ? t('Two rooms have this name.') : issue.name ? t('Give the room a name.') : undefined
                                                    }
                                                    endContent={!room.active ? <span className="venueBadge">{t('Inactive')}</span> : null}
                                                />
                                                <Input
                                                    size="sm"
                                                    isRequired
                                                    label={t('Price per hour (VND)')}
                                                    type="number"
                                                    min={0}
                                                    step={1000}
                                                    value={room.rent}
                                                    onValueChange={setRoom(room.key, 'rent')}
                                                    isInvalid={Boolean(issue.rent)}
                                                    errorMessage={issue.rent ? t('Enter a price of 0 or more.') : undefined}
                                                />
                                                <span className="venueRoomTools">
                                                    {index > 0 && (
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            variant="light"
                                                            aria-label={t('Move {name} up', { name: room.name || t('this room') })}
                                                            onPress={() => moveUp(index)}
                                                        >
                                                            <LuArrowUp />
                                                        </Button>
                                                    )}
                                                    {!room.active && (
                                                        <Button
                                                            isIconOnly
                                                            size="sm"
                                                            variant="light"
                                                            aria-label={t('Use {name} again', { name: room.name || t('this room') })}
                                                            title={t('Use again')}
                                                            onPress={() => setRoom(room.key, 'active')(true)}
                                                        >
                                                            <LuRotateCcw />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant="light"
                                                        className="venueDanger"
                                                        aria-label={t('Remove {name}', { name: room.name || t('this room') })}
                                                        title={last ? t('A studio has at least one room.') : undefined}
                                                        isDisabled={last}
                                                        onPress={() => removeRoom(room)}
                                                    >
                                                        <LuTrash2 />
                                                    </Button>
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                            {inUse === 1 && <p className="venueRoomsNote">{t('A studio has at least one room, so its only room can’t be removed.')}</p>}
                            {inUse === 0 && (
                                <p className="venueRoomsNote isError" role="alert">
                                    {t('A studio needs at least one room in use: add one or use one again.')}
                                </p>
                            )}
                            {removedSaved && (
                                <p className="venueRoomsNote" role="status">
                                    {t('A removed room a class or a session was in can’t be deleted: it stays on record as inactive, out of the class pickers.')}
                                </p>
                            )}
                            <Button size="sm" variant="flat" className="venueRoomAdd" startContent={<LuPlus aria-hidden="true" />} onPress={addRoom}>
                                {t('Add a room')}
                            </Button>
                        </fieldset>

                        <Textarea label={t('Note for staff')} maxLength={300} minRows={2} value={form.note} onValueChange={set('note')} placeholder={t('Who to call, how to get the key…')} />
                        <Switch isSelected={form.active} onValueChange={set('active')} size="sm" color="danger" classNames={{ base: 'venueDialogSwitch' }}>
                            <span className="venueSwitchText">
                                <strong>{t('In use')}</strong>
                                <small>{form.active ? t('Classes can be put here.') : t('Out of the class pickers; its history stays.')}</small>
                            </span>
                        </Switch>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose} isDisabled={saving}>
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" color="danger" isLoading={saving} startContent={saving ? null : <LuCheck aria-hidden="true" />}>
                            {venue ? t('Save studio') : t('Add studio')}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
};

export default VenueDialog;
