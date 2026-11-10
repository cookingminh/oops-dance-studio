import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuAlertTriangle, LuCalendarPlus, LuCalendarX, LuCheckCircle2, LuSplit } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { inRoutine } from './routineData';

const appear = {
    initial: { opacity: 0, y: -6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.2 },
};

// Cancelled sessions of the running routine (and whether a make-up covers them), then anything off
// between routines: an overlap, sessions with no routine, a routine the class won't finish.
const RoutineNotices = ({ current, makeUps, issues, onAddMakeUp }) => {
    const { t, tn, formatDate } = useI18n();
    const cancelled = current?.sessions_cancelled ?? 0;
    const madeUp = current ? makeUps.filter((row) => inRoutine(current, row.date)).length : 0;
    const date = (iso) => formatDate(iso, 'short');

    const issueText = (issue) => {
        if (issue.kind === 'overlap') {
            return issue.first.ends_on
                ? t('“{second}” starts {start}, before “{first}” finishes on {end}. The sessions in between count for both.', {
                    first: issue.first.title, second: issue.second.title, start: date(issue.second.starts_on), end: date(issue.first.ends_on),
                })
                : t('“{second}” starts {start}, while “{first}” is still running.', { first: issue.first.title, second: issue.second.title, start: date(issue.second.starts_on) });
        }
        if (issue.kind === 'gap') {
            return tn(issue.dates.length,
                '{count} session with no routine before “{second}” starts ({from}).',
                '{count} sessions with no routine before “{second}” starts ({from} – {to}).',
                { second: issue.second.title, from: date(issue.dates[0]), to: date(issue.dates.at(-1)) });
        }
        return t('The class ends before “{title}” reaches its last session.', { title: issue.routine.title });
    };

    return (
        <AnimatePresence initial={false}>
            {cancelled > madeUp && (
                <motion.div key="cancelled" className="rtNotice isWarn" role="status" {...appear}>
                    <LuCalendarX aria-hidden="true" />
                    <p>
                        {current.ends_on
                            ? tn(cancelled, '{count} session was cancelled → last session moves to {date}.', '{count} sessions were cancelled → last session moves to {date}.', { date: date(current.ends_on) })
                            : tn(cancelled, '{count} session was cancelled.', '{count} sessions were cancelled.')}
                    </p>
                    <Button size="sm" color="danger" variant="solid" startContent={<LuCalendarPlus aria-hidden="true" />} onPress={onAddMakeUp}>
                        {t('Add a make-up session')}
                    </Button>
                </motion.div>
            )}
            {cancelled > 0 && cancelled <= madeUp && (
                <motion.div key="made-up" className="rtNotice isGood" role="status" {...appear}>
                    <LuCheckCircle2 aria-hidden="true" />
                    <p>
                        {tn(cancelled, '{count} cancelled session is made up: last session {date}.', '{count} cancelled sessions are made up: last session {date}.', {
                            date: current.ends_on ? date(current.ends_on) : '—',
                        })}
                    </p>
                </motion.div>
            )}
            {issues.map((issue) => (
                <motion.div
                    key={`${issue.kind}-${issue.first?.lesson_id ?? issue.routine?.lesson_id}-${issue.second?.lesson_id ?? ''}`}
                    className="rtNotice isWarn"
                    role="status"
                    {...appear}
                >
                    {issue.kind === 'overlap' ? <LuSplit aria-hidden="true" /> : <LuAlertTriangle aria-hidden="true" />}
                    <p>{issueText(issue)}</p>
                </motion.div>
            ))}
        </AnimatePresence>
    );
};

export default RoutineNotices;
