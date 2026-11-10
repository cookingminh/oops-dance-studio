import { Link } from 'react-router-dom';
import { LuArrowRight, LuLogOut, LuQrCode, LuReceipt, LuRepeat } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import { amountDue } from '@/services/tuition';
import { StatusPill } from './TuitionParts';
import { arrangeTuition, firstToPay, needsAnswer, songOf } from './tuitionData';
import { useMyTuition } from './useMyTuition';
import './tuition.scss';

// One line in a student's class view: the tuition of the course running in that class, a Pay link
// when something is open, a nudge when the next course waits for an answer, and the last session
// when they're leaving (class switch).
const ClassTuitionLine = ({ classId }) => {
    const { t, formatDate } = useI18n();
    const data = useMyTuition();
    if (!data.data) return null;

    const { today } = data.data;
    const view = arrangeTuition(data.data);
    const mine = view.all.filter((invoice) => invoice.class_id === classId);
    const current = mine.find((invoice) => invoice.course.phase === 'current' && invoice.status !== 'void') ?? mine.find((invoice) => invoice.course.phase === 'current');
    const next = mine.find((invoice) => invoice.course.phase === 'planned' && needsAnswer(invoice));
    const pay = firstToPay(view.toPay.filter((invoice) => invoice.class_id === classId));
    const leaves = view.places.get(classId)?.leaves_after;
    if (!current && !pay && !next) return null;

    return (
        <div className="tuClassLine">
            <span className="tuClassLineIcon" aria-hidden="true">
                <LuReceipt />
            </span>
            <span className="tuClassLineText">
                <strong>{current?.course.title ? t('Tuition · {course}', { course: songOf(current.course.title) }) : t('Tuition')}</strong>
                {current && <StatusPill invoice={current} today={today} />}
                {next && (
                    <Link to="/profile/tuition" className="tuClassLineNext">
                        <LuRepeat aria-hidden="true" /> {t('Next course {course}: waiting for your answer', { course: songOf(next.course.title) })}
                    </Link>
                )}
                {leaves && (
                    <span className="tuClassLineNext isLeaving">
                        <LuLogOut aria-hidden="true" /> {t('Your last session here is {date}', { date: formatDate(leaves, 'short') })}
                    </span>
                )}
            </span>
            {pay ? (
                <Link to={`/profile/tuition?pay=${pay.id}`} className="pfBtn isPrimary isSmall">
                    <LuQrCode aria-hidden="true" /> {t('Pay {amount}', { amount: formatVnd(amountDue(pay)) })}
                </Link>
            ) : (
                <Link to="/profile/tuition" className="pfMiniLink">
                    {t('Tuition')} <LuArrowRight aria-hidden="true" />
                </Link>
            )}
        </div>
    );
};

export default ClassTuitionLine;
