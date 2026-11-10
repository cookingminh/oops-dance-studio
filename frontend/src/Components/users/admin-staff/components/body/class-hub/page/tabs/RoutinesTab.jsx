import { LuMusic } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../../../common/SectionCard';
import RoutinePanel from '../../../class-manager/routines/RoutinePanel';
import RoutineHistory from './RoutineHistory';

// Routines: the full routines panel (progress, planning, videos, make-ups, renewals). An ended
// class only shows what it learned.
const RoutinesTab = ({ ctx }) => {
    const { cls, today, changed, badge, progress } = ctx;
    const { t } = useI18n();
    if (badge.phase === 'ended') return <RoutineHistory cls={cls} progress={progress} />;
    return (
        <SectionCard icon={LuMusic} title={t('Routines')} subtitle={t('Each routine is learned over a number of sessions, ends with the video shoot and is the course students pay for.')}>
            <RoutinePanel key={cls.id} cls={cls} today={today} onChanged={changed} />
        </SectionCard>
    );
};

export default RoutinesTab;
