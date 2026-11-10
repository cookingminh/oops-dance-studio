import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip } from '@nextui-org/react';
import { LuCalendarDays, LuCalendarX, LuChevronDown, LuTicket } from 'react-icons/lu';
import { addDays, parseISO } from 'date-fns';
import { useI18n } from '@/i18n/i18nContext';
import { formatTime, toIsoDate } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import { statusColorMap } from '../../../../../../Table/utils';
import SectionCard, { CardFooterLink } from '../../../../../admin-staff/components/common/SectionCard';
import { ClassThumb, DayName } from '../classes/ClassParts';

const ACTIVE = ['pending', 'approved'];
const FIRST = 5; // items shown before "Show all"

// Classes and room bookings of the next 7 days in one list, grouped by day.
const WeekAgenda = ({ state, week, bookings, today }) => {
    const { t, tn } = useI18n();
    const [expanded, setExpanded] = useState(false);
    const until = today ? toIsoDate(addDays(parseISO(today), 7)) : '';
    const upcoming = today ? bookings.filter((b) => b.date >= today && ACTIVE.includes(b.status)) : [];
    const soon = upcoming.filter((b) => b.date < until);
    const later = upcoming.length - soon.length;

    const items = [
        ...week.map((session) => ({ kind: 'class', key: `c-${session.cls.id}-${session.date}`, date: session.date, start: session.start, session })),
        ...soon.map((booking) => ({ kind: 'booking', key: `b-${booking.id}`, date: booking.date, start: formatTime(booking.start_time), booking })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    const shown = expanded ? items : items.slice(0, FIRST);
    const days = [...new Set(shown.map((item) => item.date))];

    return (
        <SectionCard
            className="pfAgendaCard"
            icon={LuCalendarDays}
            title={t('Your week')}
            subtitle={t('Classes and room bookings in the next 7 days')}
            footer={<CardFooterLink to="/profile/my-bookings">{t('All my bookings')}</CardFooterLink>}
        >
            <AsyncState state={state} isEmpty={false}>
                {items.length === 0 ? (
                    <div className="pfEmptyLine">
                        <LuCalendarX aria-hidden="true" />
                        <span>{t('Nothing planned for the next 7 days.')}</span>
                        <Link to="/rooms" className="pfInlineLink">
                            {t('Book a room')}
                        </Link>
                    </div>
                ) : (
                    <ol className="pfAgenda">
                        {days.map((date) => (
                            <li key={date} className={date === today ? 'isToday' : undefined}>
                                <h4 className="pfAgendaDay">
                                    <DayName date={date} today={today} style="long" />
                                </h4>
                                <ul>
                                    {shown
                                        .filter((item) => item.date === date)
                                        .map((item) =>
                                            item.kind === 'class' ? (
                                                <li key={item.key} className={`pfAgendaItem${item.session.isLive ? ' isLive' : ''}`}>
                                                    <span className="pfAgendaTime">{item.start}</span>
                                                    <ClassThumb cls={item.session.cls} />
                                                    <span className="pfAgendaText">
                                                        <strong>{item.session.cls.name}</strong>
                                                        <span>
                                                            {item.session.start}–{item.session.end} · {t('with')} {item.session.cls.instructorName}
                                                        </span>
                                                    </span>
                                                    {item.session.isLive && (
                                                        <span className="pfLiveTag">
                                                            <span className="pfPulse" aria-hidden="true" /> {t('Now')}
                                                        </span>
                                                    )}
                                                </li>
                                            ) : (
                                                <li key={item.key} className="pfAgendaItem isBooking">
                                                    <span className="pfAgendaTime">{item.start}</span>
                                                    <span className="pfThumb isTicket" aria-hidden="true">
                                                        <LuTicket />
                                                    </span>
                                                    <span className="pfAgendaText">
                                                        <strong>{item.booking.room?.name}</strong>
                                                        <span>
                                                            {t('Room booking')} · {formatTime(item.booking.start_time)}–{formatTime(item.booking.end_time)}
                                                        </span>
                                                    </span>
                                                    <Chip size="sm" variant="flat" className="capitalize" color={statusColorMap[item.booking.status] ?? 'default'}>
                                                        {t(item.booking.status)}
                                                    </Chip>
                                                </li>
                                            ),
                                        )}
                                </ul>
                            </li>
                        ))}
                    </ol>
                )}
                {items.length > FIRST && (
                    <button type="button" className="pfShowAll" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
                        {expanded ? t('Show less') : t('Show all {count}', { count: items.length })} <LuChevronDown aria-hidden="true" />
                    </button>
                )}
                {later > 0 && (
                    <p className="pfAgendaMore">{tn(later, '+ {count} more booking after this week', '+ {count} more bookings after this week')}</p>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default WeekAgenda;
