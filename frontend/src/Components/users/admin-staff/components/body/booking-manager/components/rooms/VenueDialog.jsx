import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch, Textarea } from '@nextui-org/react';
import { LuCheck, LuMapPin } from 'react-icons/lu';
import { saveVenue } from '@/services/venues';
import { formatVnd } from '@/lib/format';
import { mapLinkOf } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';

const fromVenue = (venue) => ({
    name: venue?.name ?? '',
    address: venue?.address ?? '',
    mapUrl: venue?.map_url ?? '',
    rent: venue ? String(venue.rent_per_hour ?? 0) : '',
    note: venue?.note ?? '',
    active: venue?.active ?? true,
});

// Add or change a rented studio: name, address, map link, rent per hour, a note for staff and whether
// classes can still be put there (inactive: out of the pickers, history kept). `venue` null = a new one.
const VenueDialog = ({ venue, onClose, onSaved }) => {
    const { t } = useI18n();
    const toast = useToast();
    const [form, setForm] = useState(() => fromVenue(venue));
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);
    const set = (field) => (value) => setForm((old) => ({ ...old, [field]: value }));

    const rent = Number(form.rent);
    const problems = {
        name: !form.name.trim(),
        mapUrl: Boolean(form.mapUrl.trim()) && !/^https:\/\//i.test(form.mapUrl.trim()),
        rent: form.rent === '' || Number.isNaN(rent) || rent < 0,
    };
    const show = (key) => tried && problems[key];
    const mapPreview = mapLinkOf({ map_url: problems.mapUrl ? null : form.mapUrl.trim(), address: form.address.trim() });

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
        <Modal isOpen placement="center" scrollBehavior="inside" onOpenChange={(open) => !open && !saving && onClose()} classNames={{ base: 'venueDialog adminPortal' }}>
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
                        <Input
                            label={t('Rent per hour (VND)')}
                            type="number"
                            min={0}
                            step={1000}
                            isRequired
                            value={form.rent}
                            onValueChange={set('rent')}
                            isInvalid={show('rent')}
                            errorMessage={show('rent') ? t('Enter a price of 0 or more.') : undefined}
                            description={
                                problems.rent
                                    ? t('Each session taught there adds its rent to the class’s costs.')
                                    : t('{rent} an hour: a 90-minute session costs {session}.', { rent: formatVnd(rent), session: formatVnd(Math.round((rent * 1.5) / 1000) * 1000) })
                            }
                        />
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
