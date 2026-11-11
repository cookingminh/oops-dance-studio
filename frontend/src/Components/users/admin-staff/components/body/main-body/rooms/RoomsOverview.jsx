import { Link } from 'react-router-dom';
import { LuDoorOpen } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listRooms } from '@/services/rooms';
import { roomImageUrls } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard, { CardFooterLink } from '../../../common/SectionCard';
import studioPhoto from '@/assets/images/studio.webp';

const PREVIEW = 2;
// Rooms and their prices: the bookings page's "Rooms & prices" view.
const ROOMS_VIEW = '/admin/bookings?view=rooms';

const RoomsOverview = () => {
    const { t } = useI18n();
    const rooms = useAsync(listRooms, []);
    const count = rooms.data?.length ?? 0;

    return (
        <SectionCard
            className="roomsCard"
            icon={LuDoorOpen}
            title={t('Rooms')}
            subtitle={t('Spaces guests can book by the hour')}
            footer={
                <CardFooterLink to={ROOMS_VIEW}>
                    {count > PREVIEW ? t('See all {count} rooms', { count }) : t('Edit sizes and prices')}
                </CardFooterLink>
            }
        >
            <AsyncState state={rooms} emptyText={t('No rooms yet.')}>
                {(list) => (
                    <div className="roomTiles">
                        {list.slice(0, PREVIEW).map((room) => (
                            <Link to={ROOMS_VIEW} key={room.id} className="roomTile">
                                <img src={roomImageUrls(room)[0] ?? studioPhoto} alt="" />
                                <span className="roomTileShade" aria-hidden="true" />
                                <span className="roomTileText">
                                    <strong>{room.name}</strong>
                                    {room.size && <small>{room.size}</small>}
                                </span>
                                <span className="roomTilePrice">{t('{price}/h', { price: formatVnd(room.price) })}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default RoomsOverview;
