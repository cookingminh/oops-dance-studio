// Turns Supabase / Postgres / network errors into an AppError with a stable code and a message
// that is safe to show to users. RPCs raise `CODE: details` (see api-contract §5).

export const MESSAGES = {
    SLOT_TAKEN: 'That time slot is already taken. Please choose another time.',
    PAST_DATE: 'That date is in the past. Please choose today or a later date.',
    FORBIDDEN: 'You don’t have permission to do that.',
    NOT_FOUND: 'We couldn’t find that record. It may have been deleted.',
    INVALID_STATE: 'This can’t be done in the record’s current state. Refresh and try again.',
    INVALID_INPUT: 'Some of the information is invalid. Please check the form.',
    DUPLICATE: 'That already exists.',
    IN_USE: 'This record is still used elsewhere, so it can’t be removed.',
    FILE_TOO_LARGE: 'That file is too large. The maximum is 5 MB.',
    FILE_TYPE: 'That file type isn’t supported. Please use a JPEG, PNG or WebP image.',
    BAD_CREDENTIALS: 'Wrong email or password.',
    EMAIL_TAKEN: 'An account with this email already exists.',
    USERNAME_TAKEN: 'This username may already be taken. Please choose another one.',
    EMAIL_NOT_CONFIRMED: 'Please confirm your email address before logging in.',
    RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
    SUPPORT_CLOSED: 'The studio isn’t taking messages right now.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    NETWORK: 'Can’t reach the server. Check your connection and try again.',
    UNKNOWN: 'Something went wrong. Please try again.',
};

const RPC_CODE = /^(FORBIDDEN|NOT_FOUND|INVALID_STATE|INVALID_INPUT|SLOT_TAKEN|PAST_DATE|IN_USE|SUPPORT_CLOSED|RATE_LIMITED)\b\s*:?\s*/;

// Specific IN_USE reasons from the database.
const CLASS_HAS_HISTORY = 'This class has sessions, attendance or payments on record. End the class instead of deleting it.';
// A cancelled session frees its room; once someone books it, the session can't come back (guard_session_reopen).
const BOOKED_AFTER_CANCEL = 'The room was booked after this session was cancelled, so it can’t be reopened. Add a make-up session instead.';
// Specific INVALID_STATE reasons from the database.
const INVALID_STATE_REASONS = [
    // A rented studio classes were taught at stays on record (venue_delete).
    [/set it inactive instead/i, 'Classes were taught at this studio, so it can’t be deleted. Set it inactive instead.'],
    // The sandbox's pretend transfer on a booking already paid in full (booking_simulate_transfer).
    [/nothing is left to pay/i, 'This booking is already paid in full.'],
    // Asking to join a class (class_join_request / _cancel / _approve / _decline).
    [/already in this class/i, 'You’re already in this class.'],
    [/already asked to join this class/i, 'You’ve already asked to join this class. The studio will get back to you soon.'],
    [/too many open requests/i, 'You have 3 requests waiting already. Wait for an answer, or cancel one, before asking again.'],
    [/not taking new students/i, 'This class isn’t taking new students.'],
    [/request is no longer waiting/i, 'This request has already been answered or cancelled. Refresh to see it.'],
];

// Specific FORBIDDEN reasons from the database.
const FORBIDDEN_REASONS = [
    [/only students can ask to join/i, 'Only student accounts can ask to join a class.'],
];

// Specific INVALID_INPUT reasons (RPC text or constraint name) that deserve their own message.
const INVALID_INPUT_REASONS = [
    [/half hour|HH:00 or HH:30|half_hour_grid/i, 'Start and end times must be on the hour or half hour (for example 18:00 or 18:30).'],
    [/between 08:00 and 22:00|opening_hours/i, 'Bookings must be between 08:00 and 22:00.'],
    [/end time must be after start time|time_order/i, 'The end time must be after the start time.'],
    [/proof photo .* not been uploaded|proof path/i, 'The proof photo didn’t upload. Please choose the photo again.'],
    [/check-out comes after check-in/i, 'The check-out time must be after the check-in time.'],
    [/a check-in time is needed/i, 'Enter the check-in time.'],
    [/^say why/i, 'Please give a reason.'],
    // Rented studios and their rooms (venue_save) and a class's place (classes_one_place).
    [/give the studio a name/i, 'Give the studio a name (up to 100 characters).'],
    [/already a studio called/i, 'There is already a rented studio with this name.'],
    [/map link must start with https/i, 'The map link must start with https://.'],
    [/the rent must be 0 or more/i, 'The rent must be 0 or more.'],
    [/name on the website is up to/i, 'The name on the website is up to 80 characters.'],
    [/two rooms have the same name/i, 'Two rooms have the same name.'],
    [/give each room a name/i, 'Give each room a name (up to 60 characters).'],
    [/room's rent must be 0 or more/i, 'A room’s rent must be 0 or more.'],
    [/a studio needs at least one room/i, 'A studio needs at least one room in use.'],
    [/^pick a room/i, 'Pick a room for this session.'],
    // The sandbox's pretend transfer for a booking (booking_simulate_transfer).
    [/more than is left to pay/i, 'That’s more than is left to pay on this booking.'],
    // Chat with the studio (support_start / support_send).
    [/^pick a topic/i, 'Pick a topic for your question.'],
    [/^write your question|^write a message/i, 'Write your message first.'],
    [/up to 2000 characters/i, 'A message is up to 2,000 characters.'],
    [/chat photo/i, 'The photo didn’t upload. Please choose it again.'],
    // Homepage banners (home_banner_save).
    [/give the banner a name/i, 'Give the banner a name (up to 60 characters).'],
    [/write what the poster says/i, 'Write what the poster says (up to 400 characters).'],
    [/both posters are needed/i, 'Add both posters: the desktop one and the phone one.'],
    [/poster .*has not been uploaded|poster must be banners/i, 'A poster didn’t upload. Please choose it again.'],
    [/banner ends before it starts/i, 'The banner ends before it starts.'],
    [/up to 4 buttons/i, 'A banner has up to 4 buttons.'],
    [/button's text is/i, 'Each button needs words (up to 30 characters).'],
    [/pick where the button leads/i, 'Pick where each button leads.'],
    [/link starts with https/i, 'A button’s own link starts with https://'],
    [/must sit on the .*poster/i, 'Keep each button on the poster.'],
    [/size is between 60/i, 'A button’s size is between 60% and 200%.'],
    [/classes_one_place|instructor_attendance_one_place/i, 'A class is taught in one place: a room or a rented studio.'],
    // Asking to join a class (class_join_request / class_join_approve / class_join_decline).
    [/no next course planned/i, 'This class has no next course planned yet. Start them now, or plan the next routine first.'],
    [/note is up to 500 characters/i, 'The note is up to 500 characters.'],
    [/reason is up to 300 characters/i, 'The reason is up to 300 characters.'],
];

function invalidInputMessage(text) {
    return INVALID_INPUT_REASONS.find(([pattern]) => pattern.test(text))?.[1] ?? MESSAGES.INVALID_INPUT;
}

// The message for an RPC's `CODE: reason`: a specific one when the reason has its own, else the code's.
const REASONS = { INVALID_STATE: INVALID_STATE_REASONS, FORBIDDEN: FORBIDDEN_REASONS };
function rpcMessage(code, detail) {
    if (code === 'INVALID_INPUT') return invalidInputMessage(detail);
    if (code === 'IN_USE' && /class has history/i.test(detail)) return CLASS_HAS_HISTORY;
    if (code === 'SLOT_TAKEN' && /after the session was cancelled/i.test(detail)) return BOOKED_AFTER_CANCEL;
    return REASONS[code]?.find(([pattern]) => pattern.test(detail))?.[1] ?? MESSAGES[code];
}

export class AppError extends Error {
    constructor(code, message = MESSAGES[code] ?? MESSAGES.UNKNOWN, cause, detail = '') {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.cause = cause;
        // Server text after the code (e.g. "overlaps a booking on 2026-11-10 (08:00–10:00)").
        this.detail = detail;
    }
}

const POSTGRES_CODES = {
    23505: 'DUPLICATE',
    '23P01': 'SLOT_TAKEN', // exclusion constraint: overlapping booking
    23514: 'INVALID_INPUT', // check constraint
    23502: 'INVALID_INPUT', // not null
    '22P02': 'INVALID_INPUT', // invalid text representation
    22007: 'INVALID_INPUT', // invalid datetime format
    22008: 'INVALID_INPUT', // datetime out of range
    23503: 'IN_USE', // foreign key
    42501: 'FORBIDDEN', // RLS / privilege
    PGRST116: 'NOT_FOUND', // .single() matched no row (or RLS hid it)
    PGRST301: 'SESSION_EXPIRED',
};

const AUTH_MESSAGES = [
    [/invalid login credentials/i, 'BAD_CREDENTIALS'],
    [/user already registered|already been registered/i, 'EMAIL_TAKEN'],
    [/database error saving new user/i, 'USERNAME_TAKEN'],
    [/email not confirmed/i, 'EMAIL_NOT_CONFIRMED'],
    [/rate limit|too many requests/i, 'RATE_LIMITED'],
    [/jwt expired|refresh token/i, 'SESSION_EXPIRED'],
];

// Auth messages that are already written for end users (password rules, etc.).
const PASS_THROUGH = [/^password should/i, /^new password should be different/i, /^unable to validate email address/i];

export function toAppError(error) {
    if (error instanceof AppError) return error;
    const raw = typeof error === 'string' ? error : error?.message ?? '';

    const rpc = raw.match(RPC_CODE);
    if (rpc) {
        const detail = raw.slice(rpc[0].length).trim();
        return new AppError(rpc[1], rpcMessage(rpc[1], detail), error, detail);
    }

    const pgCode = POSTGRES_CODES[error?.code];
    if (pgCode === 'INVALID_INPUT') return new AppError(pgCode, invalidInputMessage(`${raw} ${error?.details ?? ''}`), error);
    if (pgCode) return new AppError(pgCode, MESSAGES[pgCode], error);

    // Storage errors carry an HTTP status.
    const status = Number(error?.statusCode ?? error?.status);
    if (status === 413 || /exceeded the maximum allowed size/i.test(raw)) return new AppError('FILE_TOO_LARGE', undefined, error);
    if (status === 415 || /mime type .* not supported/i.test(raw)) return new AppError('FILE_TYPE', undefined, error);
    if (/row-level security|permission denied|unauthorized/i.test(raw) || status === 403) {
        return new AppError('FORBIDDEN', undefined, error);
    }

    for (const [pattern, code] of AUTH_MESSAGES) {
        if (pattern.test(raw)) return new AppError(code, undefined, error);
    }
    if (PASS_THROUGH.some((pattern) => pattern.test(raw))) return new AppError('INVALID_INPUT', raw, error);

    if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
        return new AppError('NETWORK', undefined, error);
    }
    return new AppError('UNKNOWN', undefined, error);
}

// For `{ data, error }` results from supabase-js.
export function unwrap({ data, error }) {
    if (error) throw toAppError(error);
    return data;
}
