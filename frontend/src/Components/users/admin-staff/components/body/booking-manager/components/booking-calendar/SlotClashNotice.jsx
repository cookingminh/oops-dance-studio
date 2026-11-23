import { Button } from '@nextui-org/react';
import { LuAlertTriangle, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { guestName } from '../../bookingsModel';

// What holds a slot (rows of slotClashes): "Booking · Đinh Hoàng Long · 16:00–18:00 · Awaiting approval  [Open]",
// "Class · Girlstyle 1 · 18:15–19:30". A booking can be opened from here.
export const ClashLines = ({ clashes, onOpen }) => {
    const { t } = useI18n();
    return (
        <ul className="bookingClashList">
            {clashes.map((clash) => (
                <li key={clash.kind === 'booking' ? `b${clash.booking.id}` : `s${clash.session.key}`}>
                    <span className="bookingClashWhat">
                        <strong>{clash.kind === 'booking' ? guestName(clash.booking, t) : clash.session.class_name}</strong>
                        <span>
                            {[clash.kind === 'booking' ? t('Booking #{id}', { id: clash.booking.id }) : t('Class'), `${clash.start}–${clash.end}`, clash.kind === 'booking' ? t(clash.booking.status) : null]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </span>
                    {clash.kind === 'booking' && onOpen && (
                        <Button size="sm" variant="flat" onPress={() => onOpen(clash.booking)}>
                            {t('Open booking')}
                        </Button>
                    )}
                </li>
            ))}
        </ul>
    );
};

// A free slot picked on the calendar (click or drag) that is already taken. The selection stays on the calendar,
// in red, and this says what holds it, so staff see it before filling in a booking that can't be saved.
// `pick`: { date, startTime, endTime, roomName, clashes }.
const SlotClashNotice = ({ pick, onOpen, onClose }) => {
    const { t, formatDate } = useI18n();
    return (
        <div className="bookingClash" role="alert">
            <LuAlertTriangle className="bookingClashIcon" aria-hidden="true" />
            <div className="bookingClashBody">
                <p className="bookingClashTitle">
                    <strong>{t('The slot you picked is already taken')}</strong>
                    <span>{[formatDate(pick.date, 'short'), `${pick.startTime}–${pick.endTime}`, pick.roomName].filter(Boolean).join(' · ')}</span>
                </p>
                <ClashLines clashes={pick.clashes} onOpen={onOpen} />
                <p className="bookingClashHint">{t('Pick another time or room on the calendar.')}</p>
            </div>
            <Button isIconOnly size="sm" variant="light" aria-label={t('Close')} onPress={onClose}>
                <LuX aria-hidden="true" />
            </Button>
        </div>
    );
};

export default SlotClashNotice;
