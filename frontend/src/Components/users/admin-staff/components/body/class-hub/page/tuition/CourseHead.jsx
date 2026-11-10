import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { MiniBar } from '../../HubParts';
import { CourseFacts } from '../../../tuition/TuitionParts';
import { COURSE_STATUS, courseFactsOf } from './courseModel';

// One course's status, dates, progress and money (paid x / y, collected of billed, overdue).
const CourseHead = ({ group }) => {
    const { t } = useI18n();
    const info = group.course ? COURSE_STATUS[group.course.status] ?? COURSE_STATUS.done : null;
    const { sums } = group;
    return (
        <div className="hubCourseHead">
            <div className="hubCourseTitle">
                {info && <span className={`phaseBadge tone-${info.tone}`}>{t(info.label)}</span>}
                <strong>{group.course ? group.course.title : t('Invoices from before courses')}</strong>
                {group.course && (
                    <span className="hubHint">
                        <CourseFacts course={courseFactsOf(group)} />
                    </span>
                )}
            </div>
            <div className="hubCourseMoney">
                <span>
                    <small>{t('Paid')}</small>
                    <strong>{sums.count ? `${sums.settled} / ${sums.count}` : '—'}</strong>
                </span>
                <span>
                    <small>{t('Collected')}</small>
                    <strong>
                        {formatVnd(sums.collected)} <em>/ {formatVnd(sums.billed)}</em>
                    </strong>
                </span>
                {sums.overdue.length > 0 && (
                    <span className="isAlert">
                        <small>{t('Overdue')}</small>
                        <strong>{sums.overdue.length}</strong>
                    </span>
                )}
                {sums.billed > 0 && (
                    <MiniBar value={Math.min(1, sums.collected / sums.billed)} tone={sums.collected >= sums.billed ? 'good' : 'brand'} label={t('Collected of billed')} />
                )}
            </div>
        </div>
    );
};

export default CourseHead;
