import { LuCalendarClock, LuCalendarPlus, LuLogOut, LuWallet } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';

// Before any next course is open: how renewal works course by course, with the studio's settings
// (it opens `renewal_open_sessions` before the end; pay or answer by the new course's `due_session`-th).
const RenewalCalendar = ({ settings }) => {
    const { t, tn } = useI18n();
    const before = settings?.renewal_open_sessions ?? 2;
    const due = settings?.due_session ?? 2;
    const steps = [
        {
            icon: LuCalendarPlus,
            when: tn(before, '{count} session before the end', '{count} sessions before the end'),
            title: t('Your next course opens'),
            text: t('It shows up here with its song, start date and fee, ready to pay or answer.'),
        },
        {
            icon: LuWallet,
            when: t('By session {count} of the new course', { count: due }),
            title: t('Pay or answer by then'),
            text: t('Paying counts as continuing. Want a break? Tap stop.'),
        },
        { icon: LuLogOut, when: t('After that'), title: t('No answer, no payment: your place ends'), text: t('You can rejoin any time. Just ask at the desk.') },
    ];

    return (
        <SectionCard className="tuRenewCard" icon={LuCalendarClock} title={t('How renewal works')} subtitle={t('Course by course, no long contracts')}>
            <ol className="tuTimeline">
                {steps.map(({ icon: Icon, when, title, text }) => (
                    <li key={title}>
                        <span className="tuTimelineIcon" aria-hidden="true">
                            <Icon />
                        </span>
                        <span>
                            <small>{when}</small>
                            <strong>{title}</strong>
                            <span>{text}</span>
                        </span>
                    </li>
                ))}
            </ol>
        </SectionCard>
    );
};

export default RenewalCalendar;
