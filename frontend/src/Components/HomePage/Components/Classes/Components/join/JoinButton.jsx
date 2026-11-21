import { Link } from 'react-router-dom';
import { LuArrowRight, LuCheck, LuHourglass, LuSend } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useJoin } from './joinContext';

// The way into a class, at the foot of its card (styles: classCard.scss):
//   visitor  "Join this class" → log in (or sign up), then back to /classes?join=<id> with the dialog open
//   student  "Ask to join" (the dialog) · "Request sent · waiting for the studio" (the request, to cancel it)
//            · "You’re in this class" (→ the class on My classes)
//   a class with a last day says it takes nobody new; instructors, staff and admins get nothing.
const JoinButton = ({ item }) => {
    const { t } = useI18n();
    const join = useJoin();
    const state = join?.stateOf(item.id) ?? null;

    if (state === 'anon') {
        return (
            <Link to="/login" state={{ from: { pathname: '/classes', search: `?join=${item.id}` } }} className="hpJoinCta">
                {t('Join this class')} <LuArrowRight aria-hidden="true" />
            </Link>
        );
    }
    if (state === 'ask') {
        return (
            <button type="button" className="hpJoinCta" onClick={() => join.open(item)} aria-haspopup="dialog">
                <LuSend aria-hidden="true" /> {t('Ask to join')}
            </button>
        );
    }
    if (state === 'pending') {
        return (
            <button type="button" className="hpJoinPill isPending" onClick={() => join.show(item)} aria-haspopup="dialog">
                <LuHourglass aria-hidden="true" />
                <span>{t('Request sent · waiting for the studio')}</span>
            </button>
        );
    }
    if (state === 'in') {
        return (
            <Link to={`/profile/my-classes?class=${item.id}`} className="hpJoinPill isIn">
                <LuCheck aria-hidden="true" />
                <span>{t('You’re in this class')}</span>
            </Link>
        );
    }
    if (state === 'closed') return <span className="hpJoinNote">{t('Not taking new students')}</span>;
    return null;
};

export default JoinButton;
