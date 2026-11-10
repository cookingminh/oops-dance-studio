import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuArchive, LuBanknote, LuCalendarCheck, LuRotateCcw, LuUsers } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../../../common/SectionCard';
import { fadeUp, stagger } from '../../../../common/motion';
import { ScheduleChips } from '../../HubParts';
import { useClassInvoices } from '../useClassActivity';
import RoutineHistory from './RoutineHistory';

// An ended class: when it ran and why it stopped, its final timetable, what it achieved and its
// routines (with their videos). Everything is history; "Reopen" brings it back.
const EndedOverview = ({ ctx }) => {
    const { cls, isAdmin, history, progress, version, reopen } = ctx;
    const { t, formatDate } = useI18n();
    const invoices = useClassInvoices(cls.id, version);
    const rows = invoices.data ?? [];
    const students = new Set(rows.filter((row) => row.status !== 'void').map((row) => row.student_id)).size;
    const revenue = rows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);

    const tiles = [
        { icon: LuUsers, label: t('Students'), value: invoices.data ? students : '…' },
        { icon: LuCalendarCheck, label: t('Sessions taught'), value: history?.sessions ?? '…' },
        isAdmin && { icon: LuBanknote, label: t('Tuition collected'), value: invoices.data ? formatVnd(revenue) : '…' },
    ].filter(Boolean);

    return (
        <>
            <SectionCard
                icon={LuArchive}
                title={t('This class has ended')}
                subtitle={t('Ran from {start} to {end}', { start: formatDate(cls.starts_on, 'dayMonth'), end: formatDate(cls.ended_on, 'dayMonth') })}
                actions={
                    <Button variant="flat" startContent={<LuRotateCcw aria-hidden="true" />} onPress={reopen}>
                        {t('Reopen class')}
                    </Button>
                }
            >
                {cls.end_reason && <p className="hubQuote">“{cls.end_reason}”</p>}
                <div className="hubFinal">
                    <small>{t('Final timetable')}</small>
                    <ScheduleChips cls={cls} empty={<span className="hubHint">{t('No weekly sessions were kept.')}</span>} />
                </div>
                <motion.div className="hubTiles isCompact" variants={stagger}>
                    {tiles.map(({ icon: Icon, label, value }) => (
                        <motion.div key={label} variants={fadeUp} className="hubTile">
                            <span className="hubTileIcon" aria-hidden="true">
                                <Icon />
                            </span>
                            <span className="hubTileText">
                                <small>{label}</small>
                                <strong>{value}</strong>
                            </span>
                        </motion.div>
                    ))}
                </motion.div>
            </SectionCard>

            <RoutineHistory cls={cls} progress={progress} />
        </>
    );
};

export default EndedOverview;
