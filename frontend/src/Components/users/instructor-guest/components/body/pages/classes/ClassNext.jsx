import { Button } from '@nextui-org/react';
import { LuCheckCheck, LuClock, LuDoorOpen, LuLogIn, LuLogOut, LuTimer } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { sessionTimesOf } from '@/lib/lessons';
import { canCheckIn, canCheckOut } from '../../profileHelpers';
import MakeUpTag from '../../../../../admin-staff/components/body/class-manager/routines/MakeUpTag';
import { Countdown, DayName } from './ClassParts';
import { nextSessionWithMakeUps } from './routineView';

// One-tap check-in / check-out for an instructor's session today (an instructor_attendance row).
// `onCheck({ kind, attendance })` opens the photo dialog.
export const CheckAction = ({ record, onCheck, size = 'md' }) => {
    const { t } = useI18n();
    if (canCheckIn(record)) {
        return (
            <Button color="danger" size={size} className="pfCheckBtn" startContent={<LuLogIn aria-hidden="true" />} onPress={() => onCheck({ kind: 'checkin', attendance: record })}>
                {t('Check In Now')}
            </Button>
        );
    }
    if (canCheckOut(record)) {
        return (
            <Button color="danger" size={size} className="pfCheckBtn" startContent={<LuLogOut aria-hidden="true" />} onPress={() => onCheck({ kind: 'checkout', attendance: record })}>
                {t('Check Out Now')}
            </Button>
        );
    }
    if (record.status === 'completed') {
        return (
            <span className="pfCheckDone">
                <LuCheckCheck aria-hidden="true" /> {t('Session complete')}
            </span>
        );
    }
    return record.status === 'cancelled' ? <span className="pfCheckDone isMuted">{t('Session cancelled')}</span> : null;
};

// When the class meets next (a make-up session too), counting down; instructors also get today's
// check-in here.
export const NextSessionCard = ({ cls, today, now, isInstructor, onCheck }) => {
    const { t } = useI18n();
    const next = nextSessionWithMakeUps(cls, today, now);
    const todaySession = isInstructor ? cls.todaySession : null;
    const todayTimes = todaySession ? sessionTimesOf({ ...todaySession, class: cls }) : null;

    return (
        <section className="pfBlock pfNext" aria-label={isInstructor ? t('Next session') : t('Next class')}>
            <header className="pfBlockHead">
                <h4>
                    <LuTimer aria-hidden="true" /> {isInstructor ? t('Next session') : t('Next class')}
                </h4>
            </header>
            {next ? (
                <>
                    <Countdown session={next} today={today} />
                    <ul className="pfNextFacts">
                        <li>
                            <LuClock aria-hidden="true" />
                            <span>
                                <strong>
                                    <DayName date={next.date} today={today} />
                                </strong>{' '}
                                · {next.start}–{next.end}
                                {next.isMakeUp && <MakeUpTag />}
                            </span>
                        </li>
                        <li>
                            <LuDoorOpen aria-hidden="true" /> <span>{cls.roomName ?? t('No room')}</span>
                        </li>
                    </ul>
                </>
            ) : (
                <p className="pfMuted">{t('No weekly sessions yet')}</p>
            )}
            {todaySession && (
                <div className="pfTodayCheck">
                    <span className="pfTodayLabel">
                        {t('Today')} · {todayTimes.start}–{todayTimes.end}
                        {todaySession.is_extra && <MakeUpTag className="sessionTag" />}
                    </span>
                    <CheckAction record={todaySession} onCheck={onCheck} />
                </div>
            )}
        </section>
    );
};
