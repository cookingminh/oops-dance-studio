import { useState } from 'react';
import { motion } from 'framer-motion';
import { studioTimeNow } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import { stagger } from '../../../../common/motion';
import PolicyCard from './PolicyCard';
import RoomCard from './RoomCard';
import RoomEditForm from './RoomEditForm';
import { roomStats } from './roomStats';
import './rooms.scss';

// The bookings page's "Rooms & prices" view (?view=rooms, once the Rooms page): every room with its
// hourly price and how it is booked, and the cancellation policy beside them — together they are what a
// guest pays and gets back.
//   roomsState  the rooms' useAsync (loading / error)   rooms  sorted   bookings  every booking
//   policy      the booking_settings useAsync            onEditPolicy  opens RefundPolicyDialog (admins)
//   onCalendar(room)  the calendar of that room          onOpenBooking(booking)   onRoomsChanged
const RoomsView = ({ roomsState, rooms, bookings, today, roomColor, policy, isAdmin, onEditPolicy, onCalendar, onOpenBooking, onRoomsChanged }) => {
    const [editing, setEditing] = useState(null);
    const now = studioTimeNow();

    return (
        <motion.div className="bkRoomsView" variants={stagger} initial="hidden" animate="show">
            <div className="bkRoomsMain">
                <AsyncState state={roomsState} isEmpty={rooms.length === 0} emptyText="No rooms yet.">
                    <div className="roomGrid">
                        {rooms.map((room) => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                stats={roomStats(bookings, room.id, { today, now })}
                                color={roomColor.get(room.id)}
                                today={today}
                                onEdit={setEditing}
                                onCalendar={onCalendar}
                                onOpenBooking={onOpenBooking}
                            />
                        ))}
                    </div>
                </AsyncState>
            </div>
            <PolicyCard state={policy} isAdmin={isAdmin} onEdit={onEditPolicy} />

            {editing && (
                <RoomEditForm
                    room={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        onRoomsChanged();
                    }}
                />
            )}
        </motion.div>
    );
};

export default RoomsView;
