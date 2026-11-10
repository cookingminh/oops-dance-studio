// The "All rooms" tab of the room search (the other tabs are room ids).
export const ALL_ROOMS = 'all';

// Cheapest hourly price, for "from … an hour" labels.
export const lowestPrice = (rooms) => (rooms.length ? Math.min(...rooms.map((room) => Number(room.price))) : null);
