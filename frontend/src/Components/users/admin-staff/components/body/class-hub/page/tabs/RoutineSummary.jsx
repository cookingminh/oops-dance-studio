import { Button } from '@nextui-org/react';
import { LuArrowRight, LuClapperboard } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { MiniBar } from '../../HubParts';
import { routineNow } from '../../hubModel';

// The running routine in a few lines: sessions held, the next one, the projected shoot day and
// what comes after it. Read-only; routines are planned in the Routines tab.
const RoutineSummary = ({ progress, onOpen }) => {
    const { t, formatDate } = useI18n();
    const { current, planned } = routineNow(progress);
    const shown = current ?? planned;

    if (!shown) {
        return (
            <div className="hubRoutineEmpty">
                <p className="hubHint">{t('No routine is planned. A routine is what the class learns over a number of sessions — and the course students pay for.')}</p>
                {onOpen && (
                    <Button variant="flat" endContent={<LuArrowRight aria-hidden="true" />} onPress={onOpen}>
                        {t('Plan a routine')}
                    </Button>
                )}
            </div>
        );
    }

    const left = shown.session_count - shown.sessions_held;
    return (
        <div className="hubRoutine">
            <div className="hubRoutineMain">
                <span className="hubRoutineState">{current ? t('Now learning') : t('Starts {date}', { date: formatDate(shown.starts_on, 'dayMonth') })}</span>
                <strong className="hubRoutineTitle">{shown.title}</strong>
                <MiniBar value={shown.sessions_held / shown.session_count} label={t('{title}: {held} of {total} sessions', { title: shown.title, held: shown.sessions_held, total: shown.session_count })} />
                <span className="hubRoutineFacts">
                    <span>{t('{held} of {total} sessions', { held: shown.sessions_held, total: shown.session_count })}</span>
                    {current && left > 0 && <span>{t('{count} left', { count: left })}</span>}
                    {shown.next_session && <span>{t('Next {date}', { date: formatDate(shown.next_session, 'short') })}</span>}
                    {shown.sessions_cancelled > 0 && <span className="isWarn">{t('{count} cancelled (pushed back)', { count: shown.sessions_cancelled })}</span>}
                </span>
            </div>
            {shown.ends_on && (
                <span className="hubShootDay">
                    <LuClapperboard aria-hidden="true" />
                    <small>{t('Shoot day')}</small>
                    <strong>{formatDate(shown.ends_on, 'short')}</strong>
                </span>
            )}
            <div className="hubRoutineAfter">
                {current && planned ? (
                    <span>{t('Then “{title}” from {date}', { title: planned.title, date: formatDate(planned.starts_on, 'dayMonth') })}</span>
                ) : current ? (
                    <span className={left <= 2 ? 'isWarn' : ''}>{t('Nothing planned after it yet.')}</span>
                ) : null}
                {onOpen && (
                    <Button size="sm" variant="light" endContent={<LuArrowRight aria-hidden="true" />} onPress={onOpen}>
                        {t('Open routines')}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default RoutineSummary;
