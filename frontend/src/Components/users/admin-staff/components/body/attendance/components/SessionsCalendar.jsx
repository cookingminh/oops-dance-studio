import { useState } from 'react';
import { LuCalendarDays, LuCalendarRange, LuList } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { toIsoDate } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../../common/SectionCard';
import Segmented from '../../../common/Segmented';
import { useStudioClock } from '../../../common/useStudioClock';
import CalendarView from '../../../common/calendar/CalendarView';
import { calendarRange } from '../../../common/calendar/calendarModel';
import SessionLegend from '../../../common/session-modal/SessionLegend';
import { STATUS_FILTERS, calendarItem, filterOptions, matchesSearch, matchesStatus, statusKeyOf, teacherOf } from '../../../common/session-modal/sessionModel';
import { readView, rememberView } from '../../../common/session-modal/viewPreference';
import { changeDay, reasonText } from '../../../common/session-changes/changeText';
import { loadAll, loadRange } from '../attendanceData';
import AttendanceList from './AttendanceList';
import SessionFilters from './SessionFilters';

const NO_FILTERS = { query: '', instructor: 'all', classId: 'all', status: 'all' };

// "All sessions": every class's sessions on a calendar (week or month; the class colour, the state
// as outline and badge), filtered by instructor, class, status and a search. A click opens the
// session modal. "List" shows the recorded sessions as a table (any period) with a CSV export. A
// session called off says why; a make-up names the day it replaces. `startDate` opens on another day.
const SessionsCalendar = ({ today, startDate, classes, version, onOpen }) => {
    const i18n = useI18n();
    const { t, tn } = i18n;
    const now = useStudioClock();
    const [mode, setMode] = useState('calendar');
    const [view, setView] = useState(() => readView('attendance', 'week'));
    const [date, setDate] = useState(startDate ?? today);
    const [filters, setFilters] = useState(NO_FILTERS);
    const { from, until } = calendarRange(view, date);

    const range = useAsync(() => (mode === 'calendar' ? loadRange(classes, from, until) : Promise.resolve(undefined)), [mode, classes, from, until, version]);
    const all = useAsync(() => (mode === 'list' ? loadAll(classes) : Promise.resolve(undefined)), [mode, classes, version]);

    const source = mode === 'calendar' ? range.data?.sessions ?? [] : all.data ?? [];
    const options = filterOptions(source, classes);
    // Every filter but the status one, so the status picker can count what each status would show.
    const base = source.filter(
        (session) =>
            (filters.instructor === 'all' || String(teacherOf(session)?.id) === filters.instructor) &&
            (filters.classId === 'all' || String(session.cls.id) === filters.classId) &&
            matchesSearch(session, filters.query)
    );
    const visible = base.filter((session) => matchesStatus(session, filters.status, today, now));

    const counts = new Map();
    for (const session of base) {
        const key = statusKeyOf(session, today, now);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (session.extra) counts.set('makeup', (counts.get('makeup') ?? 0) + 1);
    }
    const statusOptions = [
        { key: 'all', label: t('Any status'), count: base.length },
        ...STATUS_FILTERS.filter((option) => counts.get(option.key) || option.key === filters.status).map((option) => ({
            ...option,
            label: t(option.label),
            count: counts.get(option.key) ?? 0,
        })),
    ];

    const reason = (text) => reasonText(text, t);
    const day = (value) => changeDay(value, i18n, { short: true });
    const items = visible.map((session) => calendarItem(session, { today, now, roll: range.data?.marks.get(session.key), t, reason, day }));
    const review = visible.filter((session) => statusKeyOf(session, today, now) === 'review').length;
    const filtered = visible.length !== source.length;

    const subtitle =
        mode === 'calendar' && range.data
            ? [
                tn(visible.length, '{count} session', '{count} sessions'),
                review ? tn(review, '{count} needs review', '{count} need review') : null,
                filtered ? t('filtered') : null,
            ].filter(Boolean).join(' · ')
            : t('Check-ins, proof photos and roll calls of every class');

    return (
        <SectionCard
            className="atSessionsCard"
            icon={LuCalendarRange}
            title={t('All sessions')}
            subtitle={subtitle}
            actions={
                <Segmented
                    label={t('Show sessions as')}
                    options={[
                        { key: 'calendar', label: (<><LuCalendarDays aria-hidden="true" /> {t('Calendar')}</>) },
                        { key: 'list', label: (<><LuList aria-hidden="true" /> {t('List')}</>) },
                    ]}
                    value={mode}
                    onChange={setMode}
                />
            }
        >
            <SessionFilters filters={filters} onChange={setFilters} options={options} statusOptions={statusOptions} />
            {mode === 'calendar' ? (
                <>
                    <CalendarView
                        view={view}
                        onViewChange={(next) => {
                            setView(next);
                            rememberView('attendance', next);
                        }}
                        date={date}
                        onDateChange={(next) => setDate(toIsoDate(next))}
                        items={items}
                        onSelect={(item) => onOpen(item.data)}
                        today={today}
                        loading={range.loading}
                        label={t('Sessions calendar')}
                        className="sessionCalendar"
                    />
                    <SessionLegend />
                    {range.error && <p className="hubHint">{t(range.error.message)}</p>}
                </>
            ) : (
                <AttendanceList state={all} sessions={visible} today={today} onOpen={onOpen} />
            )}
        </SectionCard>
    );
};

export default SessionsCalendar;
