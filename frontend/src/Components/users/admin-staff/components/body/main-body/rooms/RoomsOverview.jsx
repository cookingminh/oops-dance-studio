import { Link } from 'react-router-dom';
import { LuDoorOpen } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listRooms } from '@/services/rooms';
import { roomImageUrls } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard, { CardFooterLink } from '../../../common/SectionCard';
import studioPhoto from '@/assets/images/studio.webp';

const PREVIEW = 2;

const RoomsOverview = () => {
    const rooms = useAsync(listRooms, []);
    const count = rooms.data?.length ?? 0;

    return (
        <SectionCard
            className="roomsCard"
            icon={LuDoorOpen}
            title="Rooms"
            subtitle="Spaces guests can book by the hour"
            footer={
                <CardFooterLink to="/admin/rooms">
                    {count > PREVIEW ? `See all ${count} rooms` : 'Edit sizes and prices'}
                </CardFooterLink>
            }
        >
            <AsyncState state={rooms} emptyText="No rooms yet.">
                {(list) => (
                    <div className="roomTiles">
                        {list.slice(0, PREVIEW).map((room) => (
                            <Link to="/admin/rooms" key={room.id} className="roomTile">
                                <img src={roomImageUrls(room)[0] ?? studioPhoto} alt="" />
                                <span className="roomTileShade" aria-hidden="true" />
                                <span className="roomTileText">
                                    <strong>{room.name}</strong>
                                    {room.size && <small>{room.size}</small>}
                                </span>
                                <span className="roomTilePrice">{formatVnd(room.price)}/h</span>
                            </Link>
                        ))}
                    </div>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default RoomsOverview;
