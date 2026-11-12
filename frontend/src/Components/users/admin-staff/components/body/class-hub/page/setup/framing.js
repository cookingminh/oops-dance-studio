import { useEffect, useMemo, useRef, useState } from 'react';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { AVATAR_FRAME, PHOTO_FRAME } from '@/ui/timetable/timetableFrame';
import { weeklySlots } from '../../hubModel';

// Framing a class's pictures for the website (ClassImageDialog, TimetablePhotoDialog): the class image's position
// on the Classes page card, and the round timetable photo's frame. Positions are whole percents (0–100).

export const clamp = (value, min = 0, max = 100) => Math.round(Math.min(max, Math.max(min, value)));

// The class image's card shows a 16 : 10 crop (classCard.scss .hpClassMedia).
export const CARD_RATIO = 16 / 10;
export const CENTRE = { x: 50, y: 50 };

export const imagePositionFrom = (cls) => ({ x: cls.image_pos_x ?? 50, y: cls.image_pos_y ?? 50 });

// The class's saved timetable photo frame (only means something when it has a photo of its own).
export const timetableFrameFrom = (cls) =>
    cls.timetable_photo_path
        ? { x: cls.timetable_photo_x ?? PHOTO_FRAME.x, y: cls.timetable_photo_y ?? PHOTO_FRAME.y, zoom: cls.timetable_photo_zoom ?? PHOTO_FRAME.zoom }
        : PHOTO_FRAME;

export const sameFrame = (a, b) => a.x === b.x && a.y === b.y && (a.zoom ?? 0) === (b.zoom ?? 0);

// The instructor's avatar, which the poster shows while the class has no photo of its own.
export const instructorPhotoOf = (cls) => {
    const src = avatarUrl(cls.instructor?.avatar_path, cls.instructor?.updated_at);
    return src ? { src, alt: '', frame: AVATAR_FRAME } : null;
};

export const instructorNameOf = (cls) => cls.instructor?.full_name || cls.instructor?.username || '';

// What stands in for a photo of the class's own: "Using Linh's profile photo" (or that there is none).
export const avatarNote = (cls, t) => {
    const name = instructorNameOf(cls);
    return instructorPhotoOf(cls) && name ? t('Using {name}’s profile photo', { name }) : t('No photo yet: the circle stays empty.');
};

// The class's saved timetable photo, as the poster shows it.
export const timetablePhotoOf = (cls) =>
    cls.timetable_photo_path
        ? { src: classImageUrl(cls.timetable_photo_path), alt: '', frame: timetableFrameFrom(cls) }
        : instructorPhotoOf(cls);

// A class page row (services/classes.js getClass) in the shape list_public_classes() gives the website's card.
export function publicRowOf(cls, position) {
    return {
        id: cls.id,
        name: cls.name,
        price: cls.price,
        lesson: cls.lesson,
        image_path: cls.image_path,
        image_pos_x: position.x,
        image_pos_y: position.y,
        instructor_name: instructorNameOf(cls),
        instructor_avatar_path: cls.instructor?.avatar_path ?? null,
        schedules: weeklySlots(cls).map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time })),
        room_name: cls.room?.name ?? cls.venue?.name ?? null,
        venue_address: cls.venue?.address ?? null,
        venue_map_url: cls.venue?.map_url ?? null,
        place_kind: cls.room ? 'room' : cls.venue ? 'venue' : null,
        level: cls.level,
    };
}

// Temporary URL for previewing a picked file; released when it changes or the dialog closes.
export function useObjectUrl(file) {
    const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
    return url;
}

// The picture's own width and height once it has loaded (null before, or without a picture).
export function useNaturalSize(src) {
    const [size, setSize] = useState(null);
    useEffect(() => {
        setSize(null);
        if (!src) return undefined;
        let live = true;
        const image = new Image();
        image.onload = () => live && setSize({ width: image.naturalWidth, height: image.naturalHeight });
        image.src = src;
        return () => {
            live = false;
        };
    }, [src]);
    return size;
}

// Which way a picture can move inside a box of `ratio` (width / height) with object-fit: cover: a picture
// taller than the box moves up and down, a wider one left and right.
export function coverRoom(size, ratio = CARD_RATIO) {
    if (!size?.width || !size?.height) return { x: false, y: false };
    const own = size.width / size.height;
    return { x: own > ratio * 1.005, y: own < ratio / 1.005 };
}

// How far (px) a cover-fitted picture reaches past a `box` on each side: the room object-position moves it in.
export function coverOverflow(size, box) {
    const scale = Math.max(box.width / size.width, box.height / size.height);
    return { x: size.width * scale - box.width, y: size.height * scale - box.height };
}

// Dragging with any pointer: `begin(event)` returns what the drag needs to remember (null = no drag), and
// `move(dx, dy, memo)` gets the distance from where it started. The element keeps the pointer while dragging.
export function useDrag(begin, move) {
    const drag = useRef(null);
    const [dragging, setDragging] = useState(false);
    const stop = (event) => {
        if (drag.current?.id !== event.pointerId) return;
        drag.current = null;
        setDragging(false);
    };
    const handlers = {
        onPointerDown: (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            const memo = begin(event);
            if (!memo) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, memo };
            setDragging(true);
        },
        onPointerMove: (event) => {
            const current = drag.current;
            if (current?.id !== event.pointerId) return;
            move(event.clientX - current.x, event.clientY - current.y, current.memo);
        },
        onPointerUp: stop,
        onPointerCancel: stop,
        onLostPointerCapture: stop,
    };
    return { dragging, handlers };
}
