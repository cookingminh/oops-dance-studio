import { LuArrowRightLeft } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import { keptForDanced, movedToName, switchedFrom } from '../../../../../admin-staff/components/common/switch-class/switchNotes';
import { CourseFacts } from '../../../../../admin-staff/components/body/tuition/TuitionParts';
import { statusOf } from './tuitionData';

// Small pieces shared by the tuition page, its dialogs, the overview card and the class line.

// "Paid ✓", "Due by 16 November", "Overdue"… Colour plus icon plus words, never colour alone.
export const StatusPill = ({ invoice, today, className = '' }) => {
    const { t, formatDate } = useI18n();
    const status = statusOf(invoice, today);
    const Icon = status.icon;
    return (
        <span className={`tuPill tone-${status.tone} ${className}`}>
            <Icon aria-hidden="true" />
            {t(status.key, status.vars && { date: formatDate(status.vars.date, 'dayMonth') })}
        </span>
    );
};

// "K-pop Cover Cơ Bản · 8 sessions (3 held) · until Wed 18 Nov": the class, then the course facts.
export const CourseLine = ({ invoice, className = 'tuCourseLine' }) => (
    <span className={className}>
        <span className="tuCourseClass">{invoice.class_name}</span>
        {invoice.course?.session_count != null && (
            <>
                {' · '}
                <CourseFacts course={invoice.course} />
            </>
        )}
    </span>
);

// One pip per session of a running course, the danced ones filled: progress at a glance.
export const SessionPips = ({ course }) => {
    const { t } = useI18n();
    const total = Number(course?.session_count);
    const held = Number(course?.sessions_held);
    if (!total || Number.isNaN(held) || course.sessions_held == null || total > 24) return null;
    return (
        <span className="tuPips" role="img" aria-label={t('{held} of {total} sessions held', { held, total })}>
            {Array.from({ length: total }, (_, index) => (
                <i key={index} className={index < held ? 'isDone' : index === held ? 'isNext' : undefined} style={{ '--i': index }} />
            ))}
        </span>
    );
};

// "Moved to K-pop Cover Nâng Cao": the old class's course after a class switch. An older switch in
// the middle of a course also says what stayed paid there for the sessions danced.
export const MovedTo = ({ invoice, invoices }) => {
    const { t, tn } = useI18n();
    const name = movedToName(invoice, invoices);
    const kept = keptForDanced(invoice);
    const moved = name ? t('Moved to {className}', { className: name }) : t('Moved to another class');
    if (!kept) return moved;
    return `${moved} · ${tn(kept.held, '{amount} stays here for the {count} session you danced.', '{amount} stays here for the {count} sessions you danced.', {
        amount: formatVnd(kept.kept),
    })}`;
};

// The new class's course after a switch: where they came from, and a surplus when the money that
// moved across was more than this course. Nothing for other invoices.
export const SwitchedFromLine = ({ invoice, invoices }) => {
    const { t } = useI18n();
    const from = switchedFrom(invoice, invoices);
    if (!from) return null;
    return (
        <span className="tuFromLine">
            <LuArrowRightLeft aria-hidden="true" />
            <span>
                {from.className ? t('Switched from {className}', { className: from.className }) : t('Switched class')}
                {from.extra > 0 && ` · ${t('{amount} more than this course costs: the studio will refund it or keep it as credit.', { amount: formatVnd(from.extra) })}`}
            </span>
        </span>
    );
};

// One fact of the transfer with a copy button (shared with the room bookings' pay dialog).
export { default as CopyRow } from '@/ui/payment/CopyRow';
