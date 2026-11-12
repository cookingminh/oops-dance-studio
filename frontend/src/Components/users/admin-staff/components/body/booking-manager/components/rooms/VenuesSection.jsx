import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuMapPin, LuPlus } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { deleteVenue, listVenueClasses, listVenueRent, listVenues, saveVenue } from '@/services/venues';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import { stagger } from '../../../../common/motion';
import VenueCard from './VenueCard';
import VenueDialog from './VenueDialog';

const nothing = () => Promise.resolve([]);

// "Rented studios", under the rooms: the studios rented by the hour where classes are taught while the
// rooms are closed, each with the name the website shows and its rooms (each with its own rent). Staff and
// admins add, change and remove them; a studio classes were taught at can only be set inactive. The rent of
// each session taught there (its room's, else the studio's) becomes an expense of its class by itself.
const VenuesSection = ({ today, isAdmin }) => {
    const { t } = useI18n();
    const toast = useToast();
    const month = today ? `${today.slice(0, 7)}-01` : null;
    const venues = useAsync(listVenues, []);
    const classes = useAsync(() => (today ? listVenueClasses(today) : nothing()), [today]);
    // Only admins see the automatic rent rows (expenses RLS).
    const rent = useAsync(() => (isAdmin && month ? listVenueRent(month) : nothing()), [isAdmin, month]);
    const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, or a venue
    const [busyId, setBusyId] = useState(null);

    // By its session's studio; a rent whose session was deleted since goes by the name it was charged under
    // ("Studio", or "Studio · Room" in one of its rooms).
    const chargedAt = (vendor, venue) => vendor === venue.name || Boolean(vendor?.startsWith(`${venue.name} · `));
    const rentOf = (venue) =>
        isAdmin
            ? (rent.data ?? [])
                .filter((row) => (row.venue_id ? row.venue_id === venue.id : chargedAt(row.vendor, venue)))
                .reduce((sum, row) => sum + row.amount, 0)
            : null;
    const classesOf = (id) => (classes.data ?? []).filter((cls) => cls.venue_id === id);

    const remove = async (venue) => {
        if (!window.confirm(t('Delete {name}? This can’t be undone.', { name: venue.name }))) return;
        setBusyId(venue.id);
        try {
            await deleteVenue(venue.id);
            toast.success(t('{name} deleted.', { name: venue.name }));
            venues.reload();
        } catch (error) {
            // Classes were taught there: it stays on record, but it can leave the pickers.
            if (error.code !== 'INVALID_STATE') toast.error(error);
            else if (!venue.active) toast.info(t('Classes were taught at {name}, so it stays on record. It is already inactive.', { name: venue.name }));
            else if (window.confirm(t('Classes were taught at {name}, so it can’t be deleted. Set it inactive instead? It leaves the class pickers and its history stays.', { name: venue.name }))) {
                try {
                    // Its rooms stay as they are (no `rooms`); the name on the website is sent back as it is.
                    await saveVenue(venue.id, {
                        name: venue.name,
                        publicName: venue.public_name,
                        address: venue.address,
                        mapUrl: venue.map_url,
                        rent: venue.rent_per_hour,
                        note: venue.note,
                        active: false,
                    });
                    toast.success(t('{name} is inactive.', { name: venue.name }));
                    venues.reload();
                } catch (inner) {
                    toast.error(inner);
                }
            }
        } finally {
            setBusyId(null);
        }
    };

    const list = venues.data ?? [];

    return (
        <section className="venueSection" aria-labelledby="venues-title">
            <header className="venueSectionHead">
                <span className="venueSectionIcon" aria-hidden="true">
                    <LuMapPin />
                </span>
                <div>
                    <h3 id="venues-title">{t('Rented studios')}</h3>
                    <p>{t('Studios rented by the hour to teach classes in. Choose one in a class’s Setup; the rent of each session taught there is added to the class’s costs.')}</p>
                </div>
                <Button variant="flat" startContent={<LuPlus aria-hidden="true" />} onPress={() => setEditing(null)}>
                    {t('Add a rented studio')}
                </Button>
            </header>

            <AsyncState state={venues} isEmpty={list.length === 0} emptyText={t('No rented studios yet.')}>
                <motion.div className="venueGrid" variants={stagger} initial="hidden" animate="show">
                    {list.map((venue) => (
                        <VenueCard
                            key={venue.id}
                            venue={venue}
                            classes={classesOf(venue.id)}
                            rent={rentOf(venue)}
                            busy={busyId === venue.id}
                            onEdit={setEditing}
                            onDelete={remove}
                        />
                    ))}
                </motion.div>
            </AsyncState>

            {editing !== undefined && (
                <VenueDialog
                    key={editing?.id ?? 'new'}
                    venue={editing}
                    classes={editing ? classesOf(editing.id) : []}
                    onClose={() => setEditing(undefined)}
                    onSaved={() => {
                        setEditing(undefined);
                        venues.reload();
                        // A removed room in use is set inactive; the classes' rooms are shown again.
                        classes.reload();
                    }}
                />
            )}
        </section>
    );
};

export default VenuesSection;
