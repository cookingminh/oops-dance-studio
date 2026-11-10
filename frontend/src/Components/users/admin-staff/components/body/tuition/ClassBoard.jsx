import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuChevronRight, LuLayoutList } from 'react-icons/lu';
import { classImageUrl } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import placeholder from '@/assets/images/logo-mark.webp';
import SectionCard from '../../common/SectionCard';
import { fadeUp, stagger } from '../../common/motion';
import { classPath } from '../class-hub/hubModel';

// The running course: "8/12 paid · 1.650.000 ₫ owed" (+ how many are late).
const RunningCourse = ({ entry }) => {
    const { t, tn, formatDate } = useI18n();
    const { current, running, upcoming, cls } = entry;
    if (!current) {
        return <span className="tuClassQuiet">{upcoming ? t('The class starts {date}', { date: formatDate(cls.starts_on, 'short') }) : t('No course running')}</span>;
    }
    return (
        <>
            <strong className="tuClassCourse">{current.title}</strong>
            <span className="tuClassFacts">
                {running.count ? t('{paid}/{count} paid', { paid: running.settled, count: running.count }) : t('Nobody to pay')}
                {' · '}
                {running.owed ? t('{amount} owed', { amount: formatVnd(running.owed) }) : t('nothing owed')}
                {running.late > 0 && <span className="tuClassTag isLate">{tn(running.late, '{count} late', '{count} late')}</span>}
            </span>
        </>
    );
};

// The next course: its answers once the renewal is open, when it opens, or that nothing is planned.
const NextCourse = ({ entry, openAt }) => {
    const { t, tn, formatDate } = useI18n();
    const { next, renewal, answers, due, opensIn, current, left } = entry;
    if (!next) {
        // Nothing planned matters once the renewal should be opening.
        const urgent = current && left !== null && left <= openAt;
        return <span className={`tuClassQuiet${urgent ? ' isUrgent' : ''}`}>{urgent ? t('Not planned yet: plan it so the renewal can open') : t('Not planned yet')}</span>;
    }
    const opens =
        renewal !== 'waiting'
            ? null
            : current && opensIn > 0
                ? `${openAt === 0 ? t('Renewal opens when the running course is over') : tn(openAt, 'Renewal opens when {count} session is left', 'Renewal opens when {count} sessions are left')} ${tn(opensIn, '(in {count} session)', '(in {count} sessions)')}`
                : t('Renewal opens with tonight’s check');
    return (
        <>
            <strong className="tuClassCourse">
                {next.title} <small>{t('from {date}', { date: formatDate(next.starts_on, 'dayMonth') })}</small>
            </strong>
            {renewal === 'open' ? (
                <span className="tuClassFacts">
                    <span className="tuAnswer is-yes">{tn(answers.continue.length, '{count} continues', '{count} continue')}</span>
                    {answers.stop.length > 0 && <span className="tuAnswer is-no">{tn(answers.stop.length, '{count} stops', '{count} stop')}</span>}
                    {answers.none.length > 0 && <span className="tuAnswer is-none">{tn(answers.none.length, '{count} hasn’t answered', '{count} haven’t answered')}</span>}
                    {due && answers.none.length > 0 && <span className="tuAnswerDue">{t('answers due {date}', { date: formatDate(due, 'dayMonth') })}</span>}
                </span>
            ) : (
                <span className="tuClassFacts isWaiting">{opens}</span>
            )}
        </>
    );
};

// "By class": one row per class that hasn't ended — its running course's money and where the next
// course's renewal stands. A row opens that class's Tuition tab, where its invoices and every
// student's answer live. `asking` marks rows whose renewal still waits for answers (?show=renewal).
const ClassBoard = ({ state, entries, openAt, asking }) => {
    const { t } = useI18n();
    return (
        <SectionCard
            id="tuition-classes"
            className="tuClassesCard"
            icon={LuLayoutList}
            title={t('By class')}
            subtitle={t('The running course and the next one in each class. Open a class for its invoices and every student’s answer.')}
        >
            <AsyncState state={state} isEmpty={!state.loading && entries.length === 0} emptyText="No class is running or about to start.">
                <div className="tuClassTable">
                    <div className="tuClassHeadRow" aria-hidden="true">
                        <span />
                        <span>{t('Class')}</span>
                        <span>{t('Running course')}</span>
                        <span>{t('Next course')}</span>
                    </div>
                    <motion.ul className="tuClassRows" variants={stagger} initial="hidden" animate="show">
                        {entries.map((entry) => {
                            const flagged = asking && entry.renewal === 'open' && entry.answers.none.length > 0;
                            return (
                                <motion.li key={entry.cls.id} variants={fadeUp} className={`tuClassRow${flagged ? ' isAsking' : ''}`} data-class={entry.cls.id}>
                                    <img src={classImageUrl(entry.cls.image_path) ?? placeholder} alt="" />
                                    <span className="tuClassName">
                                        {/* The link covers the whole row (::after), the rest is plain text. */}
                                        <Link className="tuClassRowLink" to={classPath(entry.cls.id, { tab: 'tuition' })}>
                                            {entry.cls.name}
                                        </Link>
                                        {entry.upcoming && <span className="phaseBadge tone-live">{t('Upcoming')}</span>}
                                    </span>
                                    <span className="tuClassCell isNow">
                                        <small className="tuClassLabel">{t('Running course')}</small>
                                        <RunningCourse entry={entry} />
                                    </span>
                                    <span className="tuClassCell isNext">
                                        <small className="tuClassLabel">{t('Next course')}</small>
                                        <NextCourse entry={entry} openAt={openAt} />
                                    </span>
                                    <LuChevronRight className="tuClassGo" aria-hidden="true" />
                                </motion.li>
                            );
                        })}
                    </motion.ul>
                </div>
            </AsyncState>
        </SectionCard>
    );
};

export default ClassBoard;
