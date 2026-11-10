import { Select, SelectItem } from '@nextui-org/react';
import { useI18n } from '@/i18n/i18nContext';
import { COURSE_STATUS } from './courseModel';

// "1 October – 28 October · 11 sessions" (the end is the projected last session), or "from 20 November".
function useCourseDates() {
    const { t, tn, formatDate } = useI18n();
    return (course) => {
        if (!course) return '';
        const dates = course.ends_on
            ? `${formatDate(course.starts_on, 'dayMonth')} – ${formatDate(course.ends_on, 'dayMonth')}`
            : t('from {date}', { date: formatDate(course.starts_on, 'dayMonth') });
        return `${dates} · ${tn(course.session_count, '{count} session', '{count} sessions')}`;
    };
}

// One course: its title, dates, how many invoices and where it stands (Current / Up next / Finished).
const CourseOption = ({ option, withCount = true }) => {
    const { t, tn } = useI18n();
    const status = option.status ? COURSE_STATUS[option.status] ?? COURSE_STATUS.done : null;
    return (
        <span className="hubCourseOption">
            <span className="hubCourseOptionText">
                <strong>{option.title}</strong>
                {option.dates && <small>{option.dates}</small>}
            </span>
            <span className="hubCourseOptionMeta">
                {withCount && <small className="hubCourseCount">{tn(option.count, '{count} invoice', '{count} invoices')}</small>}
                {status && <span className={`hubCourseChip tone-${status.tone}`}>{t(status.label)}</span>}
            </span>
        </span>
    );
};

// The class's courses in one dropdown, newest first (the courses used to be a long row of tabs).
// `groups` from groupByCourse; `value` is the selected group's key.
const CoursePicker = ({ groups, value, onChange }) => {
    const { t } = useI18n();
    const datesOf = useCourseDates();
    const options = groups.map((group) => ({
        key: group.key,
        title: group.course ? group.course.title : t('Invoices from before courses'),
        dates: datesOf(group.course),
        status: group.course?.status ?? null,
        count: group.invoices.length,
    }));

    return (
        <Select
            label={t('Course')}
            labelPlacement="outside"
            className="hubCoursePicker"
            items={options}
            selectedKeys={value ? [value] : []}
            disallowEmptySelection
            onSelectionChange={(keys) => {
                const key = [...keys][0];
                if (key) onChange(String(key));
            }}
            renderValue={(items) => items.map((item) => <CourseOption key={item.key} option={item.data} withCount={false} />)}
            classNames={{ trigger: 'hubCourseTrigger', popoverContent: 'adminPortal', listbox: 'hubCourseListbox' }}
        >
            {(option) => (
                <SelectItem key={option.key} textValue={`${option.title} ${option.dates}`}>
                    <CourseOption option={option} />
                </SelectItem>
            )}
        </Select>
    );
};

export default CoursePicker;
