import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuArrowRight, LuCalendarDays, LuImage, LuPencil } from 'react-icons/lu';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { roomImageUrls } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import studioPhoto from '@/assets/images/studio.webp';
import { fadeUp } from '../../../../common/motion';
import { guestName } from '../../bookingsModel';
import { featuresOf } from './roomStats';

// One room in "Rooms & prices": its photo, features and the hourly price guests see (edited here), then
// how it is booked — this week, this month, this month's income, the next booking (opens it) — and a way
// to the calendar showing only this room.
//   stats  roomStats()   onEdit(room)   onCalendar(room)   onOpenBooking(booking)
const RoomCard = ({ room, stats, color, today, onEdit, onCalendar, onOpenBooking }) => {
    const { t, tn, formatDate } = useI18n();
    const photos = roomImageUrls(room);
    const features = featuresOf(room.size);
    const { next } = stats;

    return (
        <motion.article variants={fadeUp} className="roomCard" style={{ '--room': color }}>
            <div className="roomCardMedia">
                <img src={photos[0] ?? studioPhoto} alt={room.name} />
                {photos.length > 1 && (
                    <span className="photoCount">
                        <LuImage aria-hidden="true" /> {t('{count} photos', { count: photos.length })}
                    </span>
                )}
            </div>
            <div className="roomCardBody">
                <div className="roomCardHead">
                    <h3>
                        <span className="segDot" style={{ background: color }} aria-hidden="true" />
                        {room.name}
                    </h3>
                    <Button isIconOnly size="sm" variant="flat" radius="full" aria-label={t('Edit {name}', { name: room.name })} onPress={() => onEdit(room)}>
                        <LuPencil />
                    </Button>
                </div>
                {features.length > 0 && (
                    <ul className="roomFeatures">
                        {features.map((feature) => (
                            <li key={feature}>{feature}</li>
                        ))}
                    </ul>
                )}
                <div className="roomPrice">
                    <strong>{formatVnd(room.price)}</strong>
                    <span>{t('per hour')}</span>
                </div>

                <dl className="roomFacts">
                    <div>
                        <dt>{t('This week')}</dt>
                        <dd>{tn(stats.week, '{count} booking', '{count} bookings')}</dd>
                    </div>
                    <div>
                        <dt>{t('This month')}</dt>
                        <dd>{tn(stats.month, '{count} booking', '{count} bookings')}</dd>
                    </div>
                    <div className="isMoney">
                        <dt>{t('Revenue this month')}</dt>
                        <dd>{formatVnd(stats.revenue)}</dd>
                    </div>
                </dl>

                <div className="roomNext">
                    <small>{t('Next booking')}</small>
                    {next ? (
                        <button type="button" className="roomNextBtn" onClick={() => onOpenBooking(next)} title={t('Open booking {id}', { id: next.id })}>
                            <strong>
                                {next.date === today ? t('Today') : formatDate(next.date, 'short')} · {formatTimeRange(next.start_time, next.end_time)}
                            </strong>
                            <span>
                                {guestName(next, t)}
                                {next.status === 'pending' && <em className="roomNextTag">{t('Awaiting approval')}</em>}
                            </span>
                        </button>
                    ) : (
                        <span className="roomNextNone">{t('Nothing booked ahead')}</span>
                    )}
                </div>

                <Button
                    variant="flat"
                    className="roomCalendarBtn"
                    startContent={<LuCalendarDays aria-hidden="true" />}
                    endContent={<LuArrowRight aria-hidden="true" />}
                    onPress={() => onCalendar(room)}
                >
                    {t('See this room’s calendar')}
                </Button>
            </div>
        </motion.article>
    );
};

export default RoomCard;
