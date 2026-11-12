import circleNewbie from '@/assets/images/timetable-circle-newbie.webp';
import circleBasic from '@/assets/images/timetable-circle-basic.webp';
import circleAdvanced from '@/assets/images/timetable-circle-advanced.webp';

// The brush-painted circles of the printed schedule, one per class level (lib/classLevel.js).
export const LEVEL_CIRCLES = { newbie: circleNewbie, basic: circleBasic, advanced: circleAdvanced };
export const circleOf = (level) => LEVEL_CIRCLES[level] ?? circleBasic;

// How a photo sits in its circle: the photo's point (x %, y %) in the middle, the photo zoom % of the circle
// wide. A class's own timetable photo starts centred and as wide as the circle; an instructor's avatar (a tall
// portrait) starts zoomed in on the head and shoulders.
export const PHOTO_FRAME = { x: 50, y: 50, zoom: 100 };
export const AVATAR_FRAME = { x: 50, y: 30, zoom: 150 };
