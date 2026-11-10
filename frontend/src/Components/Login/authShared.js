// Shared bits of the login / sign-up / reset-password pages.

// auth.minimum_password_length in supabase/config.toml
export const MIN_PASSWORD_LENGTH = 8;

// The form's error line: English source text plus placeholder values, translated when shown.
export const toAlert = (error) => ({ text: error?.message ?? String(error), vars: error?.vars });

// The form column enters quickly (header, form, footer one after another), so switching between
// login and sign-up feels instant. AuthLayout's <MotionConfig reducedMotion="user"> drops the
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
