import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LuPlay } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { routineState, splitSong } from '@/lib/lessons';
import { promoOf } from '@/services/promos';
import PromoDialog from '@/ui/promo/PromoDialog';
import { PromoThumb } from '@/ui/promo/PromoPlayer';
import { classHue } from '../../profileHelpers';
import './promoCard.scss';

// Brings the card into view when a link asks for it (?promo=1).
function useScrollHere(ref) {
    const [params] = useSearchParams();
    const wanted = params.get('promo');
    useEffect(() => {
        if (!wanted) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        ref.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }, [wanted, ref]);
}

// A student's view: the promo of the routine coming next, if there is one.
const StudentPromo = ({ cls, state }) => {
    const { t, tn, formatDate } = useI18n();
    const [watching, setWatching] = useState(false);
    const ref = useRef(null);
    useScrollHere(ref);
    const next = state.next;
    const promo = promoOf(next);
    if (!promo) return null;

    const { song, artist } = splitSong(next.title);
    const starts = formatDate(next.next_session ?? next.starts_on, 'short');
    const label = t('Watch the promo of “{title}”', { title: next.title });

    return (
        <section ref={ref} id="promo" className="pfBlock pfPromo isStudent" style={{ '--hue': classHue(cls.id) }} aria-label={t('Coming next')}>
            <PromoThumb promo={promo} label={label} onPlay={() => setWatching(true)} hue={classHue(cls.id)} />
            <div className="pfPromoSide">
                <small className="pfEyebrow">{t('Coming next')}</small>
                <strong className="pfSong">{song}</strong>
                <span className="pfPromoWhen">
                    {artist && `${artist} · `}
                    {tn(next.session_count, 'from {date} · {count} session', 'from {date} · {count} sessions', { date: starts })}
                </span>
                {promo.caption && (
                    <p className="pfPromoQuote">
                        “{promo.caption}”{cls.instructorName && <span> — {cls.instructorName}</span>}
                    </p>
                )}
                <button type="button" className="pfBtn isPrimary isSmall" onClick={() => setWatching(true)}>
                    <LuPlay aria-hidden="true" /> {t('Watch the promo')}
                </button>
            </div>
            {watching && (
                <PromoDialog
                    promo={promo}
                    portalClass="adminPortal"
                    eyebrow={`${t('Coming next')} · ${cls.name}`}
                    title={next.title}
                    meta={cls.instructorName ? t('From {date} · with {teacher}', { date: starts, teacher: cls.instructorName }) : t('From {date}', { date: starts })}
                    onClose={() => setWatching(false)}
                />
            )}
        </section>
    );
};

// The promo of a class's next routine (ClassView), for its students to watch. Staff and admins add it
// (the class's Routines tab, a YouTube Short or a clip); instructors don't manage it.
const PromoCard = ({ cls }) => <StudentPromo cls={cls} state={routineState(cls.routines)} />;

export default PromoCard;
