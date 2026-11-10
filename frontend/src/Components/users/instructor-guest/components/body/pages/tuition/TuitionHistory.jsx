import { useState } from 'react';
import { LuArrowRightLeft, LuBanknote, LuChevronDown, LuHistory, LuLandmark } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import { ClassThumb } from '../classes/ClassParts';
import { isSwitchedAway, switchedFrom } from '../../../../../admin-staff/components/common/switch-class/switchNotes';
import { CourseLine, MovedTo, StatusPill } from './TuitionParts';
import { invoiceClass, joinedLate, studioDay } from './tuitionData';

const FIRST_COURSES = 6;

const HistoryRow = ({ invoice, all, today }) => {
    const { t, formatDate } = useI18n();
    const isPaid = invoice.status === 'paid';
    const Method = invoice.method === 'cash' ? LuBanknote : LuLandmark;
    const from = switchedFrom(invoice, all);
    const paid = Number(invoice.paid_amount);
    return (
        <li className={`tuHistRow${invoice.status === 'void' ? ' isMuted' : ''}`}>
            <ClassThumb cls={invoiceClass(invoice)} />
            <span className="tuHistCourse">
                <strong className="tuHistClass">{invoice.course.title || invoice.class_name}</strong>
                <small>
                    <CourseLine invoice={invoice} className="tuHistFacts" />
                    {joinedLate(invoice) && ` · ${t('Joined late · paid for {left} of {count}', { left: invoice.sessions, count: invoice.course.session_count })}`}
                    {from?.className && ` · ${t('from {className}', { className: from.className })}`}
                </small>
            </span>
            {isSwitchedAway(invoice) ? (
                <span className="tuHistHow isMoved">
                    <LuArrowRightLeft aria-hidden="true" />
                    <MovedTo invoice={invoice} invoices={all} />
                </span>
            ) : isPaid ? (
                <span className="tuHistHow">
                    <Method aria-hidden="true" />
                    {invoice.method === 'cash' ? t('Cash') : t('Bank transfer')}
                    <span className="tuHistDate">· {formatDate(studioDay(invoice.paid_at), 'dayMonth')}</span>
                </span>
            ) : (
                <StatusPill invoice={invoice} today={today} className="tuHistHow" />
            )}
            <span className="tuHistAmount">{invoice.status === 'void' && paid === 0 ? '—' : formatVnd(isPaid || invoice.status === 'void' ? paid : invoice.amount)}</span>
        </li>
    );
};

// Finished courses: what was paid, how and when. Cancelled ones stay, quietly greyed out.
const TuitionHistory = ({ view, today }) => {
    const { t } = useI18n();
    const [showAll, setShowAll] = useState(false);
    const rows = showAll ? view.history : view.history.slice(0, FIRST_COURSES);

    return (
        <SectionCard
            className="tuHistoryCard"
            icon={LuHistory}
            title={t('Payment history')}
            subtitle={t('Finished courses, newest first')}
            actions={
                <span className="tuYearTotal">
                    <small>{t('Paid in {year}', { year: view.year })}</small>
                    <strong>{formatVnd(view.paidThisYear)}</strong>
                </span>
            }
        >
            {view.history.length ? (
                <>
                    <ul className="tuHistList" aria-label={t('Finished courses')}>
                        {rows.map((invoice) => (
                            <HistoryRow key={invoice.id} invoice={invoice} all={view.all} today={today} />
                        ))}
                    </ul>
                    {view.history.length > FIRST_COURSES && (
                        <button type="button" className="pfShowAll" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll}>
                            {showAll ? t('Show fewer courses') : t('Show all {count} courses', { count: view.history.length })}
                            <LuChevronDown aria-hidden="true" />
                        </button>
                    )}
                </>
            ) : (
                <p className="pfEmptyLine">{t('Your finished courses will show up here.')}</p>
            )}
        </SectionCard>
    );
};

export default TuitionHistory;
