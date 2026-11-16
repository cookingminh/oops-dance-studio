import { Link } from 'react-router-dom';
import { Avatar } from '@nextui-org/react';
import { LuCalendarDays, LuExternalLink, LuMail, LuMessagesSquare, LuPhone, LuReceipt, LuTicket } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { ErrorMessage, Loading } from '@/ui/feedback/AsyncState';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { avatarUrl } from '@/services/storage';
import { formatTime, formatVnd } from '@/lib/format';
import { classPath } from '../class-hub/hubModel';

const BOOKING_STATUS = { pending: 'Waiting for approval', approved: 'Approved' };

// The right column: who is asking — contact, classes, what they owe, their next bookings and where they asked from.
const InboxCard = ({ card, thread, isAdmin }) => {
    const { t, tn, formatDate } = useI18n();
    if (card.error && !card.data) return <aside className="inboxPane inboxCard"><ErrorMessage error={card.error} onRetry={card.reload} /></aside>;
    if (!card.data) return <aside className="inboxPane inboxCard">{card.loading ? <Loading /> : null}</aside>;
    const person = card.data;
    const learns = person.classes.filter((cls) => !cls.teaches);
    const teaches = person.classes.filter((cls) => cls.teaches);
    const roleLabel = person.role === 'instructor' ? 'Instructor' : learns.length ? 'Student' : 'Guest';
    const unpaid = Number(person.unpaid?.count ?? 0);

    return (
        <aside className="inboxPane inboxCard" aria-label={t('About {name}', { name: person.name })}>
            <header className="inboxCardHead">
                <Avatar {...AVATAR_DEFAULTS} src={avatarUrl(person.avatar_path) ?? undefined} name={person.name} size="lg" />
                <div>
                    <h3>{person.name}</h3>
                    <span className="inboxChip">{t(roleLabel)}</span>
                </div>
            </header>

            <ul className="inboxFacts">
                <li>
                    <LuPhone aria-hidden="true" />
                    {person.phone ? <a href={`tel:${person.phone.replace(/\s+/g, '')}`}>{person.phone}</a> : <span className="isMuted">{t('No phone number')}</span>}
                </li>
                {person.email && (
                    <li>
                        <LuMail aria-hidden="true" />
                        <a href={`mailto:${person.email}`}>{person.email}</a>
                    </li>
                )}
                <li>
                    <LuMessagesSquare aria-hidden="true" />
                    <span>{tn(Number(person.conversations ?? 0), '{count} chat with the studio', '{count} chats with the studio')}</span>
                </li>
            </ul>

            {thread?.opened_from && (
                <p className="inboxAskedFrom">
                    {t('Asked from')} <code>{thread.opened_from}</code>
                </p>
            )}

            {(learns.length > 0 || teaches.length > 0) && (
                <section className="inboxCardBlock">
                    <h4>
                        <LuCalendarDays aria-hidden="true" /> {t(teaches.length && !learns.length ? 'Teaches' : 'Classes')}
                    </h4>
                    <ul className="inboxLinks">
                        {[...learns, ...teaches].map((cls) => (
                            <li key={`${cls.id}-${cls.teaches}`}>
                                <Link to={classPath(cls.id, { tab: 'overview' })}>{cls.name}</Link>
                                {cls.teaches && learns.length > 0 && <span className="isMuted"> · {t('teaches')}</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {person.role !== 'instructor' && (
                <section className="inboxCardBlock">
                    <h4>
                        <LuReceipt aria-hidden="true" /> {t('Tuition')}
                    </h4>
                    {unpaid > 0 ? (
                        <Link className="inboxOwes" to={`/admin/tuition?q=${encodeURIComponent(person.name)}`}>
                            {tn(unpaid, '{count} unpaid invoice · {amount}', '{count} unpaid invoices · {amount}', { amount: formatVnd(person.unpaid.amount) })}
                        </Link>
                    ) : (
                        <p className="isMuted">{t('Nothing unpaid')}</p>
                    )}
                </section>
            )}

            {person.bookings.length > 0 && (
                <section className="inboxCardBlock">
                    <h4>
                        <LuTicket aria-hidden="true" /> {t('Next bookings')}
                    </h4>
                    <ul className="inboxLinks">
                        {person.bookings.map((booking) => (
                            <li key={booking.id}>
                                <Link to={`/admin/bookings?booking=${booking.id}&date=${booking.date}`}>
                                    {formatDate(booking.date, 'short')} · {formatTime(booking.start)}–{formatTime(booking.end)}
                                </Link>
                                <span className="isMuted">
                                    {' '}
                                    · {booking.room ?? t('Room')} · {t(BOOKING_STATUS[booking.status] ?? booking.status)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {isAdmin && (
                <Link className="inboxCardMore" to={`/admin/users?person=${person.id}`}>
                    {t('Open in Users')} <LuExternalLink aria-hidden="true" />
                </Link>
            )}
        </aside>
    );
};

export default InboxCard;
