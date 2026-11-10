import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button, Input } from '@nextui-org/react';
import { LuListChecks, LuSearch } from 'react-icons/lu';
import { classImageUrl } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import placeholder from '@/assets/images/logo-mark.webp';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import { stagger } from '../../common/motion';
import { FILTERS, fold, invoiceSearchText, matchesFilter, summarize } from './tuitionModel';
import { CourseFacts } from './TuitionParts';
import InvoiceRow from './InvoiceRow';
import ClassLink from '../class-hub/ClassLink';

const EMPTY = {
    running: 'No course is running right now.',
    next: 'No next course is billed yet. Its renewal opens near the end of the running course.',
    month: 'No course starts in this month.',
};
const PHASES = { current: 'Running now', planned: 'Up next', done: 'Finished' };

// Invoices → classes (name order) → courses (oldest first), keeping the order of the rows inside.
function groupByClassAndCourse(invoices) {
    const classes = new Map();
    for (const invoice of invoices) {
        const classKey = invoice.class_id ?? invoice.class_name;
        if (!classes.has(classKey)) classes.set(classKey, { key: classKey, name: invoice.class_name, image: invoice.class?.image_path, courses: new Map() });
        const courses = classes.get(classKey).courses;
        const courseKey = invoice.lesson_id ?? `month-${invoice.month}`;
        if (!courses.has(courseKey)) courses.set(courseKey, { key: courseKey, course: invoice.course, rows: [] });
        courses.get(courseKey).rows.push(invoice);
    }
    return [...classes.values()]
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        .map((group) => ({ ...group, courses: [...group.courses.values()].sort((a, b) => (a.course?.starts_on ?? '').localeCompare(b.course?.starts_on ?? '')) }));
}

// One course of a class: its song, where it stands, how much of it is paid, then its invoices.
const CourseBlock = ({ block, totals, invoices, today, enrolments, busyId, onAction }) => {
    const { t } = useI18n();
    const { counts: c, money } = totals;
    const billable = c.all - c.void - c.switched - c.waived;
    const phase = block.course?.phase ?? 'done';
    const stillOwed = phase === 'done' && c.due + c.overdue > 0;
    return (
        <div className={`tuCourse is-${phase}`}>
            <header className="tuCourseHead">
                <span className="tuCourseTitle">
                    <strong>{block.course?.title || t('Course')}</strong>
                    <small>
                        <CourseFacts course={block.course} />
                    </small>
                </span>
                <span className={`tuPhase is-${phase}${stillOwed ? ' isOwed' : ''}`}>{stillOwed ? t('Finished · still unpaid') : t(PHASES[phase])}</span>
                <span className="tuCourseMoney">
                    {t('{paid} of {count} paid', { paid: c.paid, count: billable })} · {formatVnd(money.collected)} / {formatVnd(money.billed)}
                </span>
                <span className="tuGroupBar" aria-hidden="true">
                    <motion.span initial={{ width: 0 }} animate={{ width: `${money.billed ? Math.min(100, (money.collected / money.billed) * 100) : 0}%` }} transition={{ duration: 0.6 }} />
                </span>
            </header>
            <motion.ul className="tuRows" variants={stagger} initial="hidden" animate="show">
                {block.rows.map((invoice) => (
                    <InvoiceRow
                        key={invoice.id}
                        invoice={invoice}
                        invoices={invoices}
                        today={today}
                        place={enrolments?.get(`${invoice.class_id}:${invoice.student_id}`) ?? null}
                        busy={busyId === invoice.id}
                        onAction={onAction}
                    />
                ))}
            </motion.ul>
        </div>
    );
};

// The invoices on show, grouped by class and then by course: filter by where they stand, search by
// student, class, course or payment code, and act on each one.
const InvoiceList = ({ view, month, today, state, enrolments, counts, filter, onFilter, query, onQuery, busyId, onAction }) => {
    const { t, tn, monthName } = useI18n();
    const invoices = useMemo(() => state.data ?? [], [state.data]);

    const term = fold(query.trim());
    const visible = invoices.filter((invoice) => matchesFilter(invoice, filter, today) && (!term || invoiceSearchText(invoice).includes(term)));
    const groups = groupByClassAndCourse(visible);

    // Each course keeps its own paid / billed progress (whatever the filter shows).
    const courseTotals = useMemo(() => {
        const rows = new Map();
        for (const invoice of invoices) {
            const key = invoice.lesson_id ?? `month-${invoice.month}`;
            rows.set(key, [...(rows.get(key) ?? []), invoice]);
        }
        return new Map([...rows].map(([key, list]) => [key, summarize(list, today)]));
    }, [invoices, today]);

    const options = FILTERS.filter((option) => option.key === 'all' || counts[option.key] > 0 || option.key === filter).map((option) => ({
        key: option.key,
        label: t(option.label),
        count: counts[option.key],
        color: option.color,
    }));

    const subtitle = {
        running: tn(visible.length, '{count} invoice of the courses running now', '{count} invoices of the courses running now'),
        next: tn(visible.length, '{count} invoice of the next courses', '{count} invoices of the next courses'),
        month: month ? tn(visible.length, '{count} invoice of courses starting in {month}', '{count} invoices of courses starting in {month}', { month: monthName(month, { withYear: true }) }) : '',
    }[view];

    return (
        <SectionCard
            id="tuition-invoices"
            className="tuInvoicesCard"
            icon={LuListChecks}
            title={t('Invoices')}
            subtitle={subtitle}
            actions={
                <Input
                    isClearable
                    aria-label={t('Search invoices')}
                    placeholder={t('Student, class, course or code')}
                    className="tuSearch"
                    startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                    value={query}
                    onValueChange={onQuery}
                    onClear={() => onQuery('')}
                />
            }
        >
            <div className="tuFilterRow">
                <Segmented label={t('Show')} options={options} value={filter} onChange={onFilter} className="tuFilter" />
            </div>

            <AsyncState state={state} isEmpty={!state.loading && invoices.length === 0} emptyText={EMPTY[view]}>
                {visible.length === 0 ? (
                    <div className="tableEmpty tuEmpty">
                        <span>{t('No invoices match these filters.')}</span>
                        <Button
                            size="sm"
                            variant="flat"
                            onPress={() => {
                                onFilter('all');
                                onQuery('');
                            }}
                        >
                            {t('Show every invoice')}
                        </Button>
                    </div>
                ) : (
                    <div className="tuGroups">
                        {groups.map((group) => (
                            <section key={group.key} className="tuGroup" aria-label={group.name}>
                                <header className="tuGroupHead">
                                    <img src={classImageUrl(group.image) ?? placeholder} alt="" />
                                    <span className="tuGroupTitle">
                                        <strong>
                                            <ClassLink id={typeof group.key === 'number' ? group.key : null}>{group.name}</ClassLink>
                                        </strong>
                                        <small>
                                            {tn(new Set(group.courses.flatMap((block) => block.rows.map((row) => row.student_id))).size, '{count} student', '{count} students')}
                                            {group.courses.length > 1 && ` · ${tn(group.courses.length, '{count} course', '{count} courses')}`}
                                        </small>
                                    </span>
                                </header>
                                {group.courses.map((block) => (
                                    <CourseBlock
                                        key={block.key}
                                        block={block}
                                        totals={courseTotals.get(block.key)}
                                        invoices={invoices}
                                        today={today}
                                        enrolments={enrolments}
                                        busyId={busyId}
                                        onAction={onAction}
                                    />
                                ))}
                            </section>
                        ))}
                    </div>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default InvoiceList;
