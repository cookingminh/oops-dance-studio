import { addMonths, format, getISODay, parseISO } from 'date-fns';

const STUDIO_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// ISO weekday: 1 = Monday … 7 = Sunday (api-contract §0).
export const WEEKDAYS = [
    { value: 1, label: 'Monday', short: 'T2' },
    { value: 2, label: 'Tuesday', short: 'T3' },
    { value: 3, label: 'Wednesday', short: 'T4' },
    { value: 4, label: 'Thursday', short: 'T5' },
    { value: 5, label: 'Friday', short: 'T6' },
    { value: 6, label: 'Saturday', short: 'T7' },
    { value: 7, label: 'Sunday', short: 'CN' },
];

export const weekdayLabel = (day) => WEEKDAYS.find((item) => item.value === Number(day))?.label ?? '';

// 'yyyy-MM-dd' → ISO weekday of that calendar date.
export const isoWeekdayOf = (isoDate) => getISODay(parseISO(isoDate));

// Local calendar date → 'yyyy-MM-dd' (unlike toISOString(), no UTC shift).
export const toIsoDate = (date) => format(date, 'yyyy-MM-dd');

// '18:30:00' → '18:30'
export const formatTime = (time) => (time ? time.slice(0, 5) : '');

export const formatTimeRange = (start, end) => `${formatTime(start)} – ${formatTime(end)}`;

// '2026-11-08' → '08/11/2026'
export const formatDate = (isoDate) => (isoDate ? format(parseISO(isoDate), 'dd/MM/yyyy') : '');

// timestamptz → 'HH:mm dd/MM' in the studio's timezone.
export function formatDateTime(timestamp) {
    if (!timestamp) return '';
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: STUDIO_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    }).format(new Date(timestamp));
}

// Current hour (0–23) and 'HH:mm' in the studio's timezone, e.g. for greetings and "live now" badges.
const studioClock = (options) => new Intl.DateTimeFormat('en-GB', { timeZone: STUDIO_TIME_ZONE, hourCycle: 'h23', ...options }).format(new Date());
export const studioHour = () => Number(studioClock({ hour: '2-digit' }));
export const studioTimeNow = () => studioClock({ hour: '2-digit', minute: '2-digit' });

// 'Sunday, 8 November' for today in the studio's timezone.
export const studioDateLabel = () => studioClock({ weekday: 'long', day: 'numeric', month: 'long' });

// timestamptz → 'HH:mm' in the studio's timezone.
export function formatClock(timestamp) {
    if (!timestamp) return '';
    return new Intl.DateTimeFormat('en-GB', { timeZone: STUDIO_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(timestamp));
}

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
export const formatVnd = (amount) => (amount === null || amount === undefined || amount === '' ? '—' : vnd.format(Number(amount)));

// Opening hours on a 30-minute grid: '08:00' … '22:00'.
export const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
    const minutes = 8 * 60 + i * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

export const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

// { from, to } for a month: from inclusive, to exclusive. month is 1–12.
export function monthRange(year, month) {
    const start = new Date(year, month - 1, 1);
    return { from: toIsoDate(start), to: toIsoDate(addMonths(start, 1)) };
}
