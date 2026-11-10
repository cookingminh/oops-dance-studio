import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuArrowRight, LuCheck, LuDoorOpen, LuPartyPopper, LuRepeat, LuX } from 'react-icons/lu';
import { classImageUrl } from '@/services/storage';
import { routineState, routinesByClass } from '@/lib/lessons';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import placeholder from '@/assets/images/logo-mark.webp';
import SectionCard from '../../common/SectionCard';
import { fadeUp, stagger } from '../../common/motion';
import { classPath } from '../class-hub/hubModel';
import { RENEWAL_COLORS, isUnanswered, renewalSummary, typicalDueDate } from './tuitionModel';
import { StudentCell } from './TuitionParts';

const SHOWN = 6;
const LEGEND = [
    { key: 'continue', label: 'Continuing' },
    { key: 'none', label: 'No answer' },
    { key: 'stop', label: 'Stopping' },
];
// Most actionable first: open renewals, then ones waiting to open, then classes with nothing planned.
const ORDER = { open: 0, waiting: 1, unplanned: 2, idle: 3 };

// Where each class stands with its next course's renewal:
//   open       the next course is billed (renewal open): answers and payments so far
//   waiting    the next course is planned, not billed yet (opens by itself, or staff open it now)
//   unplanned  a course is running but nothing is planned after it
//   idle       no course running and none planned
function classRenewals(classes, progress, invoices) {
    const byClass = routinesByClass(progress);
    return classes
        .map((cls) => {
            const { current, next } = routineState(byClass.get(cls.id) ?? []);
            const billed = next ? invoices.filter((invoice) => invoice.lesson_id === next.lesson_id) : [];
            const status = next ? (billed.length ? 'open' : 'waiting') : current ? 'unplanned' : 'idle';
            return { cls, current, next, billed, status, summary: renewalSummary(billed), due: typicalDueDate(billed.filter((invoice) => invoice.status === 'unpaid')) };
        })
        .filter((entry) => entry.status !== 'idle')
        .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.cls.name.localeCompare(b.cls.name, 'vi'));
}

// The thin bar and its legend for one open renewal.
const Answers = ({ summary, due }) => {
    const { t, tn, formatDate } = useI18n();
    return (
        <>
            <div
                className="tuRenewBar"
                role="img"
                aria-label={t('{yes} continuing, {none} no answer, {no} stopping', { yes: summary.continue.length, none: summary.none.length, no: summary.stop.length })}
            >
                {LEGEND.map(({ key }) =>
                    summary[key].length ? (
                        <motion.span key={key} style={{ background: RENEWAL_COLORS[key] }} initial={{ flexGrow: 0 }} animate={{ flexGrow: summary[key].length }} transition={{ duration: 0.6 }} />
                    ) : null,
                )}
            </div>
            <ul className="tuRenewLegend">
                {LEGEND.map(({ key, label }) => (
                    <li key={key}>
                        <span className="segDot" style={{ background: RENEWAL_COLORS[key] }} aria-hidden="true" />
                        <span>{t(label)}</span>
                        <strong>{summary[key].length}</strong>
                    </li>
                ))}
                <li className="tuRenewPaid">{tn(summary.paid, '{count} already paid', '{count} already paid')}</li>
            </ul>
            {due && <p className="tuFinePrint">{t('Pay or answer by {date}.', { date: formatDate(due, 'short') })}</p>}
        </>
    );
};

// One class: the course running now → the next one, and its renewal.
const ClassRenewal = ({ entry, settings, busyId, onOpen }) => {
    const { t, tn, formatDate } = useI18n();
    const { cls, current, next, status, summary, due } = entry;
    const left = current ? Math.max(0, current.session_count - current.sessions_held) : null;
    const openAt = settings?.renewal_open_sessions ?? 2;
    const chip = { open: t('Renewal open'), waiting: t('Not open yet'), unplanned: t('No next course') }[status];
    // Nothing planned matters once the renewal should be opening.
    const urgent = status === 'unplanned' && left !== null && left <= openAt;

    return (
        <motion.li variants={fadeUp} className={`tuRenewClass is-${status}${urgent ? ' isUrgent' : ''}`}>
            <img src={classImageUrl(cls.image_path) ?? placeholder} alt="" />
            <div className="tuRenewClassBody">
                <div className="tuRenewClassHead">
                    <strong>{cls.name}</strong>
                    <span className={`tuRenewChip is-${status}${urgent ? ' isUrgent' : ''}`}>{chip}</span>
                </div>
                <p className="tuRenewCourses">
                    {current && (
                        <span>
                            {current.title} · {t('{held}/{total} · last session {date}', { held: current.sessions_held, total: current.session_count, date: formatDate(current.ends_on, 'short') })}
                        </span>
                    )}
                    {current && next && <LuArrowRight aria-hidden="true" />}
                    {next && (
                        <span className="isNext">
                            {next.title} · {t('starts {date}', { date: formatDate(next.starts_on, 'short') })}
                        </span>
                    )}
                </p>

                {status === 'open' && <Answers summary={summary} due={due} />}

                {status === 'waiting' && (
                    <div className="tuRenewWait">
                        <p className="tuFinePrint">
                            {current && left > openAt
                                ? tn(openAt, 'It opens by itself when “{title}” has {count} session left.', 'It opens by itself when “{title}” has {count} sessions left.', { title: current.title })
                                : t('It opens by itself with the daily check.')}
                        </p>
                        <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            isLoading={busyId === `open-${next.lesson_id}`}
                            startContent={busyId === `open-${next.lesson_id}` ? null : <LuDoorOpen aria-hidden="true" />}
                            aria-label={t('Open renewal now: {cls}, “{title}”', { cls: cls.name, title: next.title })}
                            onPress={() => onOpen(next, cls)}
                        >
                            {t('Open renewal now')}
                        </Button>
                    </div>
                )}

                {status === 'unplanned' && (
                    <div className="tuRenewWait">
                        <p className="tuFinePrint">
                            {tn(left, '{count} session left and no next course yet: plan it so its renewal can open.', '{count} sessions left and no next course yet: plan it so its renewal can open.')}
                        </p>
                        <Link className="tuLinkButton" to={classPath(cls.id, { tab: 'routines' })}>
                            {t('Plan the next course')} <LuArrowRight aria-hidden="true" />
                        </Link>
                    </div>
                )}
            </div>
        </motion.li>
    );
};

// The renewals, class by class: the course running now, the next one and whether its renewal is
// open (answers so far) — with "Open renewal now" — then everyone who hasn't answered yet (for the
// next course or the running one) with quick answers for students who told the desk.
const RenewalTracker = ({ state, invoices, settings, today, busyId, onOpen, onAnswer }) => {
    const { t, tn, formatDate } = useI18n();
    const [showAll, setShowAll] = useState(false);
    const board = state.data;
    const entries = board ? classRenewals(board.classes, board.progress, invoices) : [];

    // Every unanswered, unpaid invoice still in its window (next courses and running ones).
    const pending = (board?.invoices ?? [])
        .filter((invoice) => isUnanswered(invoice) && Number(invoice.paid_amount) === 0 && today && invoice.due_date >= today)
        .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.class_name.localeCompare(b.class_name) || a.student_name.localeCompare(b.student_name));
    const shown = showAll ? pending : pending.slice(0, SHOWN);
    const before = settings?.renewal_open_sessions ?? 2;
    const dueSession = settings?.due_session ?? 2;

    return (
        <SectionCard
            id="tuition-renewal"
            className="tuRenewalCard"
            icon={LuRepeat}
            title={t('Renewals')}
            subtitle={pending.length ? tn(pending.length, '{count} student hasn’t answered yet.', '{count} students haven’t answered yet.') : t('The next course of each class, and who continues.')}
        >
            <AsyncState state={state} isEmpty={false}>
                {entries.length === 0 ? (
                    <p className="tuFinePrint">{t('No class has a course running or planned.')}</p>
                ) : (
                    <motion.ul className="tuRenewClasses" variants={stagger} initial="hidden" animate="show">
                        {entries.map((entry) => (
                            <ClassRenewal key={entry.cls.id} entry={entry} settings={settings} busyId={busyId} onOpen={onOpen} />
                        ))}
                    </motion.ul>
                )}

                {pending.length === 0 ? (
                    <p className="tuAllAnswered">
                        <LuPartyPopper aria-hidden="true" />
                        {t('Everyone has answered.')}
                    </p>
                ) : (
                    <section className="tuPending" aria-labelledby="tu-pending-title">
                        <h3 id="tu-pending-title">
                            {t('Haven’t answered yet')} <span className="segCount">{pending.length}</span>
                        </h3>
                        <p className="tuFinePrint">{t('Told you at the desk or on the phone? Answer for them here.')}</p>
                        <motion.ul className="tuPendingList" variants={stagger} initial="hidden" animate="show">
                            <AnimatePresence initial={false}>
                                {shown.map((invoice) => (
                                    <motion.li key={invoice.id} variants={fadeUp} exit={{ opacity: 0, height: 0 }} layout>
                                        <StudentCell invoice={invoice} />
                                        <span className="tuPendingClass">
                                            <strong>{invoice.lesson_title || invoice.class_name}</strong>
                                            <small>
                                                {invoice.class_name} · {t('by {date}', { date: formatDate(invoice.due_date, 'dayMonth') })}
                                            </small>
                                        </span>
                                        <span className="tuPendingActions">
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                className="tuYes"
                                                startContent={<LuCheck aria-hidden="true" />}
                                                isDisabled={busyId === invoice.id}
                                                aria-label={t('{name} continues in {cls}', { name: invoice.student_name, cls: invoice.class_name })}
                                                onPress={() => onAnswer(invoice, 'continue')}
                                            >
                                                {t('Continue')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="light"
                                                className="tuNo"
                                                startContent={<LuX aria-hidden="true" />}
                                                isDisabled={busyId === invoice.id}
                                                aria-label={t('{name} stops {cls}', { name: invoice.student_name, cls: invoice.class_name })}
                                                onPress={() => onAnswer(invoice, 'stop')}
                                            >
                                                {t('Stop')}
                                            </Button>
                                        </span>
                                    </motion.li>
                                ))}
                            </AnimatePresence>
                        </motion.ul>
                        {pending.length > SHOWN && (
                            <button type="button" className="tuLinkButton tuMore" onClick={() => setShowAll((value) => !value)}>
                                {showAll ? t('Show less') : t('Show all {count}', { count: pending.length })}
                            </button>
                        )}
                    </section>
                )}

                <p className="tuFinePrint tuRenewRule">
                    {tn(before, 'Renewal opens by itself when the running course has {count} session left and the next one is planned.', 'Renewal opens by itself when the running course has {count} sessions left and the next one is planned.')}{' '}
                    {t('Students pay or answer by session {due} of the new course (at least 3 days). Unpaid and unanswered after that: they leave the class. The check runs every night.', { due: dueSession })}
                </p>
            </AsyncState>
        </SectionCard>
    );
};

export default RenewalTracker;
