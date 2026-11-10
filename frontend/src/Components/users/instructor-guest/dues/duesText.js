import { formatTime, formatVnd } from '@/lib/format';

// The words for one item of loadMyDues() (English keys, translated with the page's i18n):
//   title, detail   the bell's two lines
//   nudge           the daily reminder's sentence (friendly, says what to do and that it's quick)
//   action          { label, pay: true → opens the QR dialog | false → goes to the page (answer a renewal) }
export function duesText(item, { t, tn, formatDate }) {
    const amount = formatVnd(item.amount);
    const date = item.date ? formatDate(item.date, 'short') : '';
    const late = -item.days;
    const pay = { label: t('Pay {amount}', { amount }), pay: true };

    if (item.kind === 'tuition') {
        const vars = { cls: item.className, course: item.course, amount, date, count: late };
        if (item.tone === 'late') {
            return {
                title: tn(late, 'Tuition for {cls} is {count} day late', 'Tuition for {cls} is {count} days late', vars),
                detail: t('{course} · {amount} left', vars),
                nudge: tn(
                    late,
                    'Tuition for {cls} ({course}) is {count} day late: {amount} left. One scan of the QR code and it’s done.',
                    'Tuition for {cls} ({course}) is {count} days late: {amount} left. One scan of the QR code and it’s done.',
                    vars
                ),
                action: pay,
            };
        }
        return {
            title: t('Tuition for {cls} is due {date}', vars),
            detail: t('{course} · {amount}', vars),
            nudge: t('Tuition for {cls} ({course}) is due {date}: {amount}. Pay now and it’s off your mind.', vars),
            action: pay,
        };
    }

    if (item.kind === 'renewal') {
        const vars = { cls: item.className, course: item.course, amount, date, count: late };
        if (item.ask) {
            return {
                title: t('Continue with {course} in {cls}?', vars),
                detail: item.tone === 'late' ? t('The answer was due {date}', vars) : t('Answer or pay by {date} to keep your place', vars),
                nudge: t('Will you continue with {course} in {cls}? Answer or pay by {date} to keep your place in the class.', vars),
                action: { label: t('Answer'), pay: false },
            };
        }
        return {
            title: t('Pay for {course} in {cls}', vars),
            detail: item.tone === 'late' ? tn(late, '{amount} · {count} day late', '{amount} · {count} days late', vars) : t('{amount} · by {date}', vars),
            nudge: t('You’re continuing with {course} in {cls}. Pay {amount} by {date} and your place is set.', vars),
            action: pay,
        };
    }

    const booking = item.booking;
    const vars = {
        room: booking.room?.name ?? t('the room'),
        date: formatDate(booking.date, 'short'),
        time: `${formatTime(booking.start_time)}–${formatTime(booking.end_time)}`,
        amount,
    };
    if (item.kind === 'deposit') {
        return {
            title: t('Deposit for {room} on {date}', vars),
            detail: t('{time} · {amount} to hold the room', vars),
            nudge: t('Your booking of {room} on {date} is approved. Pay the {amount} deposit to hold the room.', vars),
            action: pay,
        };
    }
    return {
        title: t('{room} on {date} isn’t fully paid', vars),
        detail: t('{time} · {amount} left', vars),
        nudge: t('You still owe {amount} for {room} on {date}. One scan of the QR code and it’s done.', vars),
        action: pay,
    };
}
