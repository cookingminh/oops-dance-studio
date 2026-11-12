import { Link } from 'react-router-dom';
import { LuArrowRight, LuHourglass, LuPartyPopper, LuTicket } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../common/SectionCard';

// How many booking requests wait for approval, as one tile that opens them on the Bookings page
// (the list, filtered to waiting requests). Deciding happens there, with the payment and the details at hand.
const PendingBookings = ({ pending }) => {
    const { t, tn } = useI18n();
    const total = pending.data?.total ?? 0;

    return (
        <SectionCard className="pendingCard" icon={LuTicket} title={t('Booking requests')} subtitle={t('Requests from guests, waiting for an answer')}>
            <AsyncState state={pending}>
                {() => (
                    <Link to={total ? '/admin/bookings?view=list&status=pending' : '/admin/bookings'} className={`requestSummary${total ? ' hasWaiting' : ''}`}>
                        <span className="requestSummaryIcon" aria-hidden="true">
                            {total ? <LuHourglass /> : <LuPartyPopper />}
                        </span>
                        <span className="requestSummaryText">
                            {total ? (
                                <>
                                    <strong className="requestSummaryCount">{total}</strong>
                                    <strong>{tn(total, 'request waiting for approval', 'requests waiting for approval')}</strong>
                                    <span>{t('Open them in Bookings to approve or reject.')}</span>
                                </>
                            ) : (
                                <>
                                    <strong>{t('You’re all caught up')}</strong>
                                    <span>{t('No upcoming requests to review.')}</span>
                                </>
                            )}
                        </span>
                        <LuArrowRight className="requestSummaryGo" aria-hidden="true" />
                    </Link>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default PendingBookings;
