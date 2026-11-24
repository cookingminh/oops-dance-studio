import { Button } from '@nextui-org/react';
import { LuAlertTriangle, LuUsers, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';

// A class with a maximum whose waiting requests don't all fit (staff only; students see the places left alone):
//   full          "Trending is full (8 of 8 places) · 2 requests still waiting"  [Decline the 2 still waiting]
//   not enough    "Girlstyle 1: 3 places left · 5 asking — approve up to 3"
// Nothing when every request fits. `seats` = { max, taken, left, full }; `waiting` = that class's pending requests;
// onDeclineRest(requests) opens DeclineRestDialog. `name` = the class's name (left out on its own page).
const SeatsAlert = ({ name, seats, waiting, onDeclineRest }) => {
    const { t, tn } = useI18n();
    if (!seats || waiting.length === 0 || (!seats.full && waiting.length <= seats.left)) return null;
    const vars = { ...seats, class: name, count: waiting.length };
    if (seats.full) {
        return (
            <div className="jrSeatsAlert isFull" role="status">
                <LuAlertTriangle aria-hidden="true" />
                <p>
                    <strong>{name ? t('{class} is full ({taken} of {max} places)', vars) : t('The class is full ({taken} of {max} places)', vars)}</strong>
                    <span>{tn(waiting.length, '{count} request still waiting: raise the maximum to approve it, or decline it.', '{count} requests still waiting: raise the maximum to approve them, or decline them.')}</span>
                </p>
                <Button size="sm" color="danger" variant="flat" startContent={<LuX aria-hidden="true" />} onPress={() => onDeclineRest(waiting)}>
                    {tn(waiting.length, 'Decline the {count} still waiting', 'Decline the {count} still waiting')}
                </Button>
            </div>
        );
    }
    return (
        <div className="jrSeatsAlert" role="status">
            <LuUsers aria-hidden="true" />
            <p>
                <strong>
                    {name
                        ? t('{class}: {left} places left · {count} asking', vars)
                        : t('{left} places left · {count} asking', vars)}
                </strong>
                <span>{tn(seats.left, 'Approve up to {count}; the rest can wait for a place or be declined.', 'Approve up to {count}; the rest can wait for a place or be declined.')}</span>
            </p>
        </div>
    );
};

export default SeatsAlert;
