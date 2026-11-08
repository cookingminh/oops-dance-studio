// Shared entrance animations for the admin pages. <MotionConfig reducedMotion="user"> in Admin
// turns the movement off for people who ask their OS for reduced motion.
export const EASE_OUT = [0.22, 1, 0.36, 1];

// Put on a container: its motion children (SectionCards, list rows…) enter one after another.
export const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};
