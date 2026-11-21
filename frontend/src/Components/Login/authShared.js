// Shared bits of the login / sign-up / reset-password pages.

// auth.minimum_password_length in supabase/config.toml
export const MIN_PASSWORD_LENGTH = 8;

// The form's error line: English source text plus placeholder values, translated when shown.
// Pages add `field` (an input's id) to show a message under that field instead of above the form.
export const toAlert = (error) => ({ text: error?.message ?? String(error), vars: error?.vars });

// The form column enters quickly (header, form, footer one after another), so switching between
// login and sign-up feels instant. AuthShell's <MotionConfig reducedMotion="user"> drops the
// movement for people who ask their OS for less motion.
export const EASE_OUT = [0.22, 1, 0.36, 1];

export const authStagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05 } },
};

export const authRise = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
};

// The short shake of a message that just appeared.
export const SHAKE = {
    initial: { opacity: 0, y: -4 },
    animate: { opacity: 1, y: 0, x: [0, -6, 5, -3, 0] },
    exit: { opacity: 0, transition: { duration: 0.12 } },
    transition: { duration: 0.34 },
};

// Seconds since the auth pages were first opened. The studio side's drifting colours and style
// ticker run on this clock, so they carry on where they were when the page is drawn again
// (login → reset password and back) instead of starting over.
const OPENED_AT = Date.now();
export const authClock = () => (Date.now() - OPENED_AT) / 1000;
