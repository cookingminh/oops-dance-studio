import { useCallback, useState } from 'react';
import { LuCalendarDays, LuClapperboard, LuMusic, LuUsers } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listPublicClasses } from '@/services/classes';
import { useI18n } from '@/i18n/i18nContext';
import PageHeader from '../Components/PageHeader/PageHeader';
import TimeTable from '../Components/Classes/Components/TimeTable';
import ClassGrid from '../Components/Classes/Components/ClassGrid';
import ClassVideos from '../Components/Classes/Components/ClassVideos';
import Participants from '../Components/Participants/Participants';
import { JoinBanner } from '../Components/Perks/Perks';

// /classes: when classes meet (the weekly timetable), what each class is, what they filmed last
// month, and who teaches it.
const ClassesPage = () => {
    const { t } = useI18n();
    const classes = useAsync(listPublicClasses, []);
    const [picked, setPicked] = useState({ id: null, nonce: 0 });

    // A session in the timetable shows its class card below and pulses it.
    const pick = useCallback((id) => {
        setPicked((current) => ({ id, nonce: current.nonce + 1 }));
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById(`class-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }, []);

    const list = classes.data ?? [];
    const sessions = list.reduce((sum, item) => sum + (item.schedules ?? []).length, 0);
    const coaches = new Set(list.map((item) => item.instructor_name)).size;

    return (
        <>
            <PageHeader
                overlap
                icon={LuMusic}
                eyebrow={t('Classes')}
                title={t('Find your class')}
                pitch={t('A new routine every month, coached by Oops! Crew. Pick a time that suits you; your first class is free.')}
                watermark="Dance"
                links={[
                    { id: 'timetable', label: t('Weekly timetable'), icon: LuCalendarDays },
                    { id: 'all-classes', label: t('All classes'), icon: LuMusic },
                    { id: 'class-videos', label: t('Class videos'), icon: LuClapperboard },
                    { id: 'instructors', label: t('Instructors'), icon: LuUsers },
                ]}
                facts={[
                    { label: t('Classes'), value: list.length || '—' },
                    { label: t('Sessions a week'), value: sessions || '—' },
                    { label: t('Oops! Crew coaches'), value: coaches || '—' },
                ]}
            />
            <TimeTable classes={classes} onPick={pick} />
            <ClassGrid classes={classes} picked={picked} />
            <ClassVideos classes={classes} />
            <Participants classes={classes} />
            <JoinBanner />
        </>
    );
};

export default ClassesPage;
