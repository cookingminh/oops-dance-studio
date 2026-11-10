import { Link } from 'react-router-dom';
import { Spinner } from '@nextui-org/react';
import { LuAlertCircle, LuArrowUpRight, LuBadgeCheck } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { amountDue } from '@/services/tuition';
import { loadStudentTuition } from '@/services/tuitionStaff';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { ErrorMessage } from '@/ui/feedback/AsyncState';
import { CourseFacts, PlaceTag, StatePill } from '../../../tuition/TuitionParts';
import { rowState, withCourses } from '../../../tuition/tuitionModel';
import '../../../tuition/tuition.scss';

const PHASE_ORDER = { current: 0, planned: 1, done: 2 };

// Students: the tuition of the course running in each class (and the next course once it's billed),
// with where it stands, a planned leave or join (class switch), what is still unpaid, and a link to
// the Tuition page. Reloads when their classes change (enrol, remove, switch).
const TuitionSection = ({ person, today }) => {
    const { t, tn, formatDate } = useI18n();
    const isLearner = person.role === 'guest';
    // Their classes as a key: enrolling, removing or switching them in the panel loads it again.
    const places = person.enrolments.map((enrolment) => `${enrolment.class.id}:${enrolment.joined_at ?? ''}`).sort().join(',');
    const data = useAsync(() => (isLearner ? loadStudentTuition(person.id) : Promise.resolve(null)), [person.id, isLearner, places]);

    if (!isLearner || !today) return null;
    const rows = data.data ? withCourses(data.data.invoices, data.data.progress, today) : [];
    if (data.data && rows.length === 0 && person.enrolments.length === 0) return null;

    // Running and next courses (finished ones only while unpaid), running first.
    const shown = rows
        .filter((invoice) => invoice.course.phase !== 'done' || invoice.status === 'unpaid')
        .sort((a, b) => PHASE_ORDER[a.course.phase] - PHASE_ORDER[b.course.phase] || a.class_name.localeCompare(b.class_name, 'vi'));
    // The next course isn't owed yet: count running and finished ones.
    const unpaid = rows.filter((invoice) => invoice.status === 'unpaid' && invoice.course.phase !== 'planned');
    const owed = unpaid.reduce((sum, invoice) => sum + amountDue(invoice), 0);

    return (
        <section className="sheetSection" aria-labelledby="sheet-tuition">
            <div className="sectionHead">
                <h3 id="sheet-tuition">
                    {t('Tuition')} <span className="sectionSub">{t('Per course')}</span>
                </h3>
                <Link className="sectionLink" to={`/admin/tuition?q=${encodeURIComponent(person.name ?? '')}`}>
                    {t('Open Tuition')} <LuArrowUpRight aria-hidden="true" />
                </Link>
            </div>
            {data.error ? (
                <ErrorMessage error={data.error} onRetry={data.reload} />
            ) : !data.data ? (
                <div className="sheetLoading">
                    <Spinner size="sm" color="danger" />
                    <span>{t('Loading tuition…')}</span>
                </div>
            ) : (
                <>
                    {shown.length === 0 ? (
                        <p className="sectionEmpty">{t('No course running or billed right now.')}</p>
                    ) : (
                        <ul className="tuLines">
                            {shown.map((invoice) => (
                                <li key={invoice.id}>
                                    <span className="tuLineText">
                                        <strong>{invoice.course.title || invoice.class_name}</strong>
                                        <small>
                                            {invoice.class_name} · <CourseFacts course={invoice.course} />
                                        </small>
                                        <small>
                                            {formatVnd(invoice.amount)}
                                            {invoice.status === 'unpaid' && ` · ${t('Due {date}', { date: formatDate(invoice.due_date, 'dayMonth') })}`}
                                        </small>
                                        <PlaceTag place={data.data.places.get(invoice.class_id)} today={today} />
                                    </span>
                                    <StatePill state={rowState(invoice, today)} />
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className={`tuOwes ${unpaid.length ? 'isOwing' : 'isClear'}`}>
                        {unpaid.length ? <LuAlertCircle aria-hidden="true" /> : <LuBadgeCheck aria-hidden="true" />}
                        {unpaid.length
                            ? tn(unpaid.length, '{count} unpaid invoice · {amount}', '{count} unpaid invoices · {amount}', { amount: formatVnd(owed) })
                            : t('Nothing unpaid')}
                    </p>
                </>
            )}
        </section>
    );
};

export default TuitionSection;
