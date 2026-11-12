// The class image is a tall poster; every place that crops it shows the part staff picked for the website's class
// card (classes.image_pos_x / _y, 0–100: CSS object-position %, 50 % 50 % = the middle).
export const imagePositionOf = (cls) => `${cls?.image_pos_x ?? 50}% ${cls?.image_pos_y ?? 50}%`;
