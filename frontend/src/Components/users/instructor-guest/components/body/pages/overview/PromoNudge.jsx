import { Link } from 'react-router-dom';
import { LuArrowRight, LuCalendarClock, LuClapperboard } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { routineState, splitSong } from '@/lib/lessons';
import { hasPromo } from '@/services/promos';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import { ClassThumb } from '../classes/ClassParts';
import { promoDeadline } from '../classes/promoModel';
import '../classes/promoCard.scss';

// Instructor overview: classes whose next routine has no promo yet, soonest deadline first, each
// linking to the class's promo card (My Classes ?class=…&promo=1). Nothing when all are done.
const PromoNudge = ({ classes }) => {
    const { t, tn, formatDate } = useI18n();
    const due = classes
        .map((cls) => {
            const state = routineState(cls.routines);
            return { cls, next: state.next, deadline: state.next ? promoDeadline(cls, state) : null };
        })
        .filter((row) => row.next && !hasPromo(row.next))
        .sort((a, b) => (a.deadline.date ?? '').localeCompare(b.deadline.date ?? ''));
    if (due.length === 0) return null;

    return (
        <SectionCard
            className="pfPromoNudge"
            icon={LuClapperboard}
            title={tn(due.length, 'Film {count} promo', 'Film {count} promos')}
            subtitle={t('A short clip of the next routine, so students know what’s coming and stay on.')}
        >
            <ul className="pfNudgeList">
                {due.map(({ cls, next, deadline }) => {
                    const { song } = splitSong(next.title);
                    return (
                        <li key={cls.id}>
                            <ClassThumb cls={cls} />
                            <span className="pfNudgeText">
                                <strong>{song}</strong>
                                <span>
                                    {cls.name} · {t('starts {date}', { date: formatDate(next.next_session ?? next.starts_on, 'short') })}
                                </span>
                            </span>
                            <span className={`pfNudgeDue${deadline.soon ? ' isUrgent' : ''}`}>
                                <LuCalendarClock aria-hidden="true" />
                                {deadline.soon ? t('Needed now') : t('Due {date}', { date: formatDate(deadline.date, 'short') })}
                            </span>
                            <Link className="pfBtn isPrimary pfNudgeGo" to={`/profile/my-classes?class=${cls.id}&promo=1`} aria-label={t('Upload the promo of “{title}”', { title: next.title })}>
                                {t('Upload')} <LuArrowRight aria-hidden="true" />
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </SectionCard>
    );
};

export default PromoNudge;
