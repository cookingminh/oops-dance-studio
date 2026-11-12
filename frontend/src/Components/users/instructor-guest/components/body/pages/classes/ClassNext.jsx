import { Button } from '@nextui-org/react';
import { LuAlarmClock, LuCheckCheck, LuClock, LuInfo, LuLogIn, LuLogOut, LuTimer } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { sessionTimesOf } from '@/lib/lessons';
import { PlaceDetails, PlaceIcon } from '@/ui/place/PlaceParts';
import { canCheckOut, checkInWindow, checkOutLate, nextSessionOf } from '../../profileHelpers';
import LateTag from '../../../../../admin-staff/components/common/checkins/LateTag';
import MakeUpTag from '../../../../../admin-staff/components/body/class-manager/routines/MakeUpTag';
import { changeDay } from '../../../../../admin-staff/components/common/session-changes/changeText';
import { Countdown, DayName } from './ClassParts';

// One-tap check-in / check-out for an instructor's session today (an instructor_attendance row), at studio
// time `now` ('HH:mm'; the pages tick every minute). Check-in opens 15 minutes before the start — until
// then the button waits, saying when it opens, and enables by itself — and closes at the end (the studio
// records it then). Check-out is always there; more than 10 minutes after the end it says it is late.
// `onCheck({ kind, attendance })` opens the photo dialog.
export const CheckAction = ({ record, now, onCheck, size = 'md' }) => {
    const { t } = useI18n();
    const checkIn = checkInWindow(record, now);
    if (checkIn?.state === 'early') {
        return (
            <Button size={size} variant="flat" isDisabled className="pfCheckBtn isWaiting" startContent={<LuClock aria-hidden="true" />}>
                {t('Check-in opens at {time}', { time: checkIn.opensAt })}
            </Button>
        );
    }
    if (checkIn?.state === 'over') {
        return (
            <span className="pfCheckDone isOver">
                <LuInfo aria-hidden="true" /> {t('The session is over — ask the studio to record it')}
            </span>
        );
    }
    if (checkIn) {
        return (
            <Button color="danger" size={size} className="pfCheckBtn" startContent={<LuLogIn aria-hidden="true" />} onPress={() => onCheck({ kind: 'checkin', attendance: record })}>
                {t('Check In Now')}
            </Button>
        );
    }
    if (canCheckOut(record)) {
        const late = checkOutLate(record, now);
        return (
            <Button
                color={late ? 'warning' : 'danger'}
                size={size}
                className={`pfCheckBtn${late ? ' isLate' : ''}`}
                startContent={late ? <LuAlarmClock aria-hidden="true" /> : <LuLogOut aria-hidden="true" />}
                onPress={() => onCheck({ kind: 'checkout', attendance: record })}
            >
                {late ? t('Check out late') : t('Check Out Now')}
            </Button>
        );
    }
    if (record.status === 'completed') {
        return (
            <span className="pfCheckDone">
                <LuCheckCheck aria-hidden="true" /> {t('Session complete')}
                {record.checkout_late && <LateTag />}
            </span>
        );
    }
    return record.status === 'cancelled' ? <span className="pfCheckDone isMuted">{t('Session cancelled')}</span> : null;
};

// When the class meets next (a make-up session too, with the day it replaces; never one called off),
// counting down; instructors also get today's check-in here.
export const NextSessionCard = ({ cls, today, now, isInstructor, onCheck }) => {
    const i18n = useI18n();
    const { t } = i18n;
    const next = nextSessionOf(cls, today, now);
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
                                {next.isMakeUp && <MakeUpTag className="sessionTag" />}
                            </span>
                        </li>
                        {next.makesUp && (
                            <li className="pfNextReplaces">
                                <span>{t('Instead of {day}', { day: changeDay(next.makesUp, i18n) })}</span>
                            </li>
                        )}
                        <li className="pfNextPlace">
                            <PlaceIcon place={cls.place} /> <PlaceDetails place={cls.place} empty={t('No room')} />
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
                    <CheckAction record={todaySession} now={now} onCheck={onCheck} />
                </div>
            )}
        </section>
    );
};
