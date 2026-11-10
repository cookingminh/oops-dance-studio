import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuCheck, LuDoorOpen, LuHelpCircle, LuRepeat, LuX } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../../../common/SectionCard';
import { stagger } from '../../../../common/motion';
import InvoiceRow from '../../../tuition/InvoiceRow';
import { renewalSummary } from '../../../tuition/tuitionModel';
import { coursePriceOf, renewalFacts, unbilledMembers } from './courseModel';

// Continue · Stop · No answer yet: the counters, then the students in that order.
const ANSWERS = [
    { key: 'continue', label: 'Continue', icon: LuCheck, tone: 'yes' },
    { key: 'stop', label: 'Stop', icon: LuX, tone: 'no' },
    { key: 'none', label: 'No answer yet', icon: LuHelpCircle, tone: 'none' },
];

// The next course in plain words: when it starts, what it costs, what students do and by when —
// then who continues, who stops and who hasn't answered, each with the usual row actions. Before the
// renewal opens: the day it opens by itself, and "Open now".
const RenewalPanel = ({ cls, current, next, settings, rowProps, busy, onOpen }) => {
    const { t, tn, formatDate } = useI18n();
    const openAt = settings?.renewal_open_sessions ?? 2;
    const dueSession = settings?.due_session ?? 2;
    const { course, invoices } = next;
    const facts = renewalFacts(cls, current, course, invoices, openAt);
    const summary = renewalSummary(invoices);
    const missing = unbilledMembers(cls, invoices);
    const price = coursePriceOf(cls, course.lesson_id);

    const opens = (() => {
        if (facts.opensOn === null) return t('Renewal opens automatically with tonight’s check.');
        const vars = { date: formatDate(facts.opensOn, 'short') };
        return openAt === 0
            ? t('Renewal opens automatically when the running course is over (on {date}).', vars)
            : tn(openAt, 'Renewal opens automatically when {count} session is left (on {date}).', 'Renewal opens automatically when {count} sessions are left (on {date}).', vars);
    })();

    return (
        <SectionCard
            icon={LuRepeat}
            title={t('Next course')}
            className="hubRenewal"
            actions={
                missing.length > 0 && (
                    <Button color="danger" variant={facts.open ? 'flat' : 'solid'} startContent={busy ? null : <LuDoorOpen aria-hidden="true" />} isLoading={busy} onPress={onOpen}>
                        {facts.open ? tn(missing.length, 'Open it for {count} more student', 'Open it for {count} more students') : t('Open now')}
                    </Button>
                )
            }
        >
            <p className="hubNextSentence">
                <strong>
                    {tn(course.session_count, '“{title}” starts {date} ({count} session, {price}).', '“{title}” starts {date} ({count} sessions, {price}).', {
                        title: course.title,
                        date: formatDate(course.starts_on, 'short'),
                        price: formatVnd(price),
                    })}
                </strong>{' '}
                {facts.open
                    ? facts.due
                        ? t('Students say whether they continue; anyone who hasn’t answered or paid by {date} leaves the class.', { date: formatDate(facts.due, 'short') })
                        : t('Everyone has paid or answered.')
                    : `${opens} ${t('Students then say whether they continue; anyone who hasn’t answered or paid by its session {count} leaves the class.', { count: dueSession })}`}
            </p>

            {facts.open && (
                <>
                    <ul className="hubAnswerCounts" aria-label={t('Answers so far')}>
                        {ANSWERS.map(({ key, label, icon: Icon, tone }) => (
                            <li key={key} className={`is-${tone}`}>
                                <Icon aria-hidden="true" />
                                <span>{t(label)}</span>
                                <strong>{summary[key].length}</strong>
                            </li>
                        ))}
                    </ul>
                    {summary.paid > 0 && <p className="hubHint">{tn(summary.paid, '{count} has already paid.', '{count} have already paid.')}</p>}
                    {ANSWERS.filter(({ key }) => summary[key].length > 0).map(({ key, label, icon: Icon, tone }) => (
                        <section key={key} className={`hubAnswerGroup is-${tone}`} aria-labelledby={`hub-answer-${key}`}>
                            <h3 id={`hub-answer-${key}`}>
                                <Icon aria-hidden="true" /> {t(label)} <span className="segCount">{summary[key].length}</span>
                            </h3>
                            <motion.ul className="tuRows" variants={stagger} initial="hidden" animate="show">
                                {summary[key].map((invoice) => (
                                    <InvoiceRow
                                        key={invoice.id}
                                        invoice={invoice}
                                        invoices={rowProps.invoices}
                                        today={rowProps.today}
                                        place={rowProps.places.get(invoice.student_id) ?? null}
                                        busy={rowProps.busyId === invoice.id}
                                        onAction={rowProps.onAction}
                                    />
                                ))}
                            </motion.ul>
                        </section>
                    ))}
                </>
            )}
        </SectionCard>
    );
};

export default RenewalPanel;
