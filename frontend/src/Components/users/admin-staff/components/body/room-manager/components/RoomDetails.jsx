import { useState } from 'react';
import { Card, CardHeader, CardBody, Image, Button } from '@nextui-org/react';
import { useAsync } from '@/hooks/useAsync';
import { listRooms } from '@/services/rooms';
import { formatVnd } from '@/lib/format';
import { roomImageUrls } from '@/services/storage';
import AsyncState from '@/ui/feedback/AsyncState';
import { EditIcon } from '../../../../../../Table/EditIcon';
import EditForm from './EditForm';
import studioPhoto from '@/assets/images/studio.webp';

const RoomDetails = () => {
    const rooms = useAsync(listRooms, []);
    const [editing, setEditing] = useState(null);

    return (
        <div className="flex flex-col justify-center gap-6 sectionContainer">
            <div className="header flex justify-center font-bold">
                <h2 className="text-4xl">Room Details</h2>
            </div>

            <AsyncState state={rooms} emptyText="No rooms yet.">
                {(list) => (
                    <div className="roomCards flex justify-center gap-6">
                        {list.map((room) => (
                            <div key={room.id} className="singleCard max-w-2xl">
                                <Card className="py-4 shadow-lg max-w-2xl bg-gray-700 text-white">
                                    <CardHeader className="pb-0 pt-2 px-4 flex-col items-center relative">
                                        <div className="flex flex-col text-center">
                                            <h4 className="font-bold text-large text-white">{room.name}</h4>
                                            {room.size && <p className="text-tiny uppercase font-bold text-gray-300">{room.size}</p>}
                                            <small className="text-gray-400">{formatVnd(room.price)} per hour</small>
                                        </div>
                                        <Button
                                            isIconOnly
                                            aria-label={`Edit ${room.name}`}
                                            className="text-default-900/60 data-[hover]:bg-gray-100 bg-gray-300 absolute top-0 right-3"
                                            radius="full"
                                            variant="light"
                                            onPress={() => setEditing(room)}
                                        >
                                            <EditIcon />
                                        </Button>
                                    </CardHeader>
                                    <CardBody className="overflow-visible py-2">
                                        <div className="flex justify-center">
                                            <Image
                                                isZoomed
                                                isBlurred
                                                alt={room.name}
                                                className="object-cover rounded-xl"
                                                src={roomImageUrls(room)[0] ?? studioPhoto}
                                                width={800}
                                            />
                                        </div>
                                    </CardBody>
                                </Card>
                            </div>
                        ))}
                    </div>
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
        </div>
    );
};

export default RoomDetails;
