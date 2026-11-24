import { LuAlertTriangle, LuCalendarSearch, LuCheckCircle2, LuClock, LuLoader2 } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { ClashLines } from '../booking-calendar/SlotClashNotice';

const ICONS = { idle: LuCalendarSearch, busy: LuLoader2, good: LuCheckCircle2, warn: LuAlertTriangle, bad: LuAlertTriangle, past: LuClock };

// The answer at the top of the booking form's preview: green when nothing holds the room then, red with what does.
const CheckBanner = ({ tone, title, detail, children }) => {
    const Icon = ICONS[tone] ?? ICONS.idle;
    return (
        <div className={`bfCheck is-${tone}`} role={tone === 'bad' || tone === 'past' ? 'alert' : 'status'}>
            <Icon className="bfCheckIcon" aria-hidden="true" />
            <div className="bfCheckBody">
                <p className="bfCheckTitle">{title}</p>
                {detail && <p className="bfCheckDetail">{detail}</p>}
                {children}
            </div>
        </div>
    );
};

// One booking: is the room free then? `clashes` are the rows of slotClashes; `freeRooms` the other rooms free at
// those times (one click moves the booking there); a booking that holds the slot can be opened.
export const SingleCheck = ({ ready, checking, past, room, date, start, end, clashes, freeRooms, onRoom, onOpenBooking }) => {
    const { t, formatDate } = useI18n();
    if (!ready) {
        return <CheckBanner tone="idle" title={t('Pick a room, a day and the times')} detail={t('The calendar checks right away that the room is free then.')} />;
    }
    const when = `${formatDate(date, 'short')} · ${start}–${end}`;
    if (past) return <CheckBanner tone="past" title={t('That time has already passed')} detail={`${when} · ${t('Pick a later time or another day.')}`} />;
    if (checking) return <CheckBanner tone="busy" title={t('Checking…')} detail={when} />;
    if (clashes.length) {
        return (
            <CheckBanner tone="bad" title={t('{room} is already taken then', { room: room?.name ?? t('This room') })} detail={when}>
                <ClashLines clashes={clashes} onOpen={onOpenBooking} />
                {freeRooms.length > 0 && (
                    <div className="bfCheckFix">
                        <span>{t('Free at those times:')}</span>
                        {freeRooms.map((other) => (
                            <button key={other.id} type="button" onClick={() => onRoom(String(other.id))}>
                                {t('Use {room}', { room: other.name })}
                            </button>
                        ))}
                    </div>
                )}
            </CheckBanner>
        );
    }
    return <CheckBanner tone="good" title={t('{room} is free then', { room: room?.name ?? '' })} detail={`${when} · ${t('No booking or class overlaps it.')}`} />;
};

// A weekly series: every day checked (useSeriesPlan); `times` names each weekday's times when they differ. Green when every day is free, amber when some days were
// taken but each has an answer (another room, other free times, or skipped), red while one still clashes.
export const SeriesCheck = ({ series, room, date, start, end, times }) => {
    const { t, tn, dayName, formatDate } = useI18n();
    if (!series.ready) {
        return <CheckBanner tone="idle" title={t('Pick the weekdays and how long it runs')} detail={t('Every day of the series is checked against bookings and classes.')} />;
    }
    if (series.loading) return <CheckBanner tone="busy" title={t('Checking every day…')} />;
    const weekdays = series.weekdays.map((day) => dayName(day, 'short')).join(', ');
    if (series.days.length === 0) {
        return (
            <CheckBanner
                tone="warn"
                title={t('No day left to book')}
                detail={t('No {days} from {from} to {until} at {time} is still ahead.', {
                    days: weekdays,
                    from: formatDate(date, 'short'),
                    until: formatDate(series.until, 'short'),
                    time: start,
                })}
            />
        );
    }
    const taken = series.days.filter((day) => day.clash);
    const open = series.days.filter((day) => day.status === 'clash');
    const every = times ? `${times} · ${room?.name ?? ''}` : `${weekdays} · ${start}–${end} · ${room?.name ?? ''}`;
    if (taken.length === 0) {
        return <CheckBanner tone="good" title={tn(series.days.length, 'The {count} day is free', 'All {count} days are free')} detail={every} />;
    }
    if (open.length) {
        return (
            <CheckBanner
                tone="bad"
                title={tn(open.length, '{count} day still clashes', '{count} days still clash')}
                detail={t('Pick another room or other free times for it, or skip it.')}
            />
        );
    }
    const moved = taken.filter((day) => day.status === 'moved').length;
    const skipped = taken.filter((day) => day.status === 'skipped').length;
    return (
        <CheckBanner
            tone="warn"
            title={tn(series.kept.length, '{count} session can be booked', '{count} sessions can be booked')}
            detail={[
                tn(taken.length, '{count} day was taken', '{count} days were taken'),
                moved ? tn(moved, '{count} moved', '{count} moved') : null,
                skipped ? tn(skipped, '{count} skipped', '{count} skipped') : null,
            ]
                .filter(Boolean)
                .join(' · ')}
        />
    );
};
