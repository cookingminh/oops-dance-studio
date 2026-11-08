import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuDoorOpen, LuImage, LuPencil } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listRooms } from '@/services/rooms';
import { formatVnd } from '@/lib/format';
import { roomImageUrls } from '@/services/storage';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../common/SectionCard';
import { fadeUp, stagger } from '../../../common/motion';
import EditForm from './EditForm';
import studioPhoto from '@/assets/images/studio.webp';

// "80 m² · gương 2 mặt · loa JBL" → ['80 m²', 'gương 2 mặt', 'loa JBL']
const featuresOf = (size) => (size ?? '').split('·').map((part) => part.trim()).filter(Boolean);

const RoomDetails = () => {
    const rooms = useAsync(listRooms, []);
    const [editing, setEditing] = useState(null);

    return (
        <SectionCard
            icon={LuDoorOpen}
            title="Room details"
            subtitle="Sizes, features and the hourly price guests see when they book."
        >
            <AsyncState state={rooms} emptyText="No rooms yet.">
                {(list) => (
                    <motion.div className="roomGrid" variants={stagger} initial="hidden" animate="show">
                        {list.map((room) => {
                            const photos = roomImageUrls(room);
                            const features = featuresOf(room.size);
                            return (
                                <motion.article key={room.id} variants={fadeUp} className="roomCard">
                                    <div className="roomCardMedia">
                                        <img src={photos[0] ?? studioPhoto} alt={room.name} />
                                        {photos.length > 1 && (
                                            <span className="photoCount">
                                                <LuImage aria-hidden="true" /> {photos.length} photos
                                            </span>
                                        )}
                                    </div>
                                    <div className="roomCardBody">
                                        <div className="roomCardHead">
                                            <h3>{room.name}</h3>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="flat"
                                                radius="full"
                                                aria-label={`Edit ${room.name}`}
                                                onPress={() => setEditing(room)}
                                            >
                                                <LuPencil />
                                            </Button>
                                        </div>
                                        {features.length > 0 && (
                                            <ul className="roomFeatures">
                                                {features.map((feature) => (
                                                    <li key={feature}>{feature}</li>
                                                ))}
                                            </ul>
                                        )}
                                        <div className="roomPrice">
                                            <strong>{formatVnd(room.price)}</strong>
                                            <span>per hour</span>
                                        </div>
                                    </div>
                                </motion.article>
                            );
                        })}
                    </motion.div>
                )}
            </AsyncState>

            {editing && (
                <EditForm
                    room={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        rooms.reload();
                    }}
                />
            )}
        </SectionCard>
    );
};

export default RoomDetails;
