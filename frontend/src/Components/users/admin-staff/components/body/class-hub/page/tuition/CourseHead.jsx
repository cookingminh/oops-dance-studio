import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { MiniBar } from '../../HubParts';
import { CourseFacts } from '../../../tuition/TuitionParts';
import { courseFactsOf } from './courseModel';

// The picked course's progress and money: sessions held, paid x / y, collected of the total, late.
// (Its title, dates and status are on the course picker above.)
const CourseHead = ({ group }) => {
    const { t } = useI18n();
    const { sums } = group;
    return (
        <div className="hubCourseHead">
            {/* Sessions held so far: the picker above already has the dates of the others. */}
            {group.course?.status === 'current' && (
                <span className="hubHint">
                    <CourseFacts course={courseFactsOf(group)} />
                </span>
            )}
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
                        <small>{t('Late')}</small>
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
