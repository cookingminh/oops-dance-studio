import { useCallback, useState } from 'react';
import { LuDoorOpen, LuListChecks } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listRooms } from '@/services/rooms';
import { useI18n } from '@/i18n/i18nContext';
import PageHeader from '../Components/PageHeader/PageHeader';
import Search from '../Components/Search/Search';
import { ALL_ROOMS, lowestPrice } from '../Components/Search/rooms';
import Rooms from '../Components/Rooms/Rooms';
import BookingGuide from '../Components/Rooms/BookingGuide';

// /rooms: booking a practice room is the job, so the booking card comes first (riding over the
// header); then the rooms themselves and how booking works.
const RoomsPage = () => {
    const { t } = useI18n();
    const rooms = useAsync(listRooms, []);
    const [selectedRoom, setSelectedRoom] = useState(ALL_ROOMS);

    // "Book" on a room card: pick that room in the booking card and bring it into view.
    const bookRoom = useCallback((id) => {
        setSelectedRoom(id);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById('book')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, []);

    const list = rooms.data ?? [];
    const cheapest = lowestPrice(list);

    return (
        <>
            <PageHeader
                overlap
                icon={LuDoorOpen}
                eyebrow={t('Rooms')}
                title={t('Book a practice room')}
                pitch={t('Pick a room, a day and the hours you need. Rooms are open every day from 08:00 to 22:00.')}
                watermark="Studio"
                links={[
                    { id: 'rooms', label: t('The rooms'), icon: LuDoorOpen },
                    { id: 'how-it-works', label: t('How booking works'), icon: LuListChecks },
                ]}
                facts={[
                    { label: t('Rooms'), value: list.length || '—' },
                    { label: t('Per hour, from'), value: cheapest === null ? '—' : `${Math.round(cheapest / 1000)}k` },
                    { label: t('Open every day'), value: '8:00 – 22:00' },
                ]}
            />
            <Search rooms={rooms} selectedRoom={selectedRoom} onSelectRoom={setSelectedRoom} />
            <Rooms rooms={rooms} onBook={bookRoom} />
            <BookingGuide />
        </>
    );
};

export default RoomsPage;
