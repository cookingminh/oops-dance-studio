import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { getStudioToday } from '@/services/studio';
import { getTimetableTemplate } from '@/services/site';
import { isoWeekdayOf } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { sessionsOf } from './timetable/timetableModel';
import PosterTimetable from './timetable/PosterTimetable';
import BrushTimetable from './timetable/BrushTimetable';

const LOOKS = { poster: PosterTimetable, brush: BrushTimetable };

// The week at a glance on the Classes page, in the look the studio picked (site_settings.timetable_template,
// chosen on the admin Classes page): 'poster' — the printed schedule's grid — or 'brush' — the red card.
// `onPick(classId)` makes each session a button that shows that class's card.
const TimeTable = ({ classes, onPick }) => {
    const { t } = useI18n();
    const [today, setToday] = useState(null);
    const [look, setLook] = useState(null);

    useEffect(() => {
        getStudioToday()
            .then(setToday)
            .catch(() => setToday(format(new Date(), 'yyyy-MM-dd')));
        getTimetableTemplate().then(setLook);
    }, []);

    const sessions = useMemo(() => sessionsOf(classes.data), [classes.data]);
    const todayDow = today ? isoWeekdayOf(today) : null;
    const Look = LOOKS[look];

    const emptyText = sessions.length > 0 ? null : classes.loading ? t('Loading the timetable…') : t('The timetable will be published soon.');

    return (
        <section id="timetable" className={`hpTimetable${look ? ` is-${look}` : ''}`}>
            {Look ? (
                <Look sessions={sessions} today={today} todayDow={todayDow} onPick={onPick} emptyText={emptyText} />
            ) : (
                <div className="hpTimetableWaiting" aria-busy="true" aria-label={t('Loading the timetable…')} />
            )}
        </section>
    );
};

export default TimeTable;
