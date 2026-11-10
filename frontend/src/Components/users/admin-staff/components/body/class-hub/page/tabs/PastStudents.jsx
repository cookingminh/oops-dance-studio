import { motion } from 'framer-motion';
import { Avatar } from '@nextui-org/react';
import { LuGraduationCap } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../../common/SectionCard';
import { fadeUp, stagger } from '../../../../common/motion';
import { MiniBar } from '../../HubParts';
import { attendanceRate, percent } from '../../hubModel';

// An ended class has no members any more: who took it comes from its invoices (courses they were
// billed for, what they paid) and its roll calls.
const PastStudents = ({ cls, invoices, roll }) => {
    const { t, tn } = useI18n();
    const people = new Map();
    for (const invoice of invoices.data ?? []) {
        if (invoice.status === 'void' || !invoice.student_id) continue;
        const entry = people.get(invoice.student_id) ?? { id: invoice.student_id, name: invoice.student_name, student: invoice.student, courses: 0, paid: 0 };
        entry.courses += 1;
        entry.paid += Number(invoice.paid_amount || 0);
        people.set(invoice.student_id, entry);
    }
    const list = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <SectionCard icon={LuGraduationCap} title={t('Students who took this class')} subtitle={tn(list.length, '{count} student', '{count} students')}>
            <AsyncState state={invoices} isEmpty={list.length === 0} emptyText="Nobody was billed for this class.">
                <motion.ul className="hubPastStudents" variants={stagger} initial="hidden" animate="show">
                    {list.map((person) => {
                        const rate = attendanceRate((roll.data ?? []).filter((row) => row.student_id === person.id));
                        return (
                            <motion.li key={person.id} variants={fadeUp}>
                                <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(person.student?.avatar_path, person.student?.updated_at) ?? undefined} name={person.name} />
                                <strong>{person.name}</strong>
                                <span className="hubHint">{tn(person.courses, '{count} course', '{count} courses')}</span>
                                <span className="hubCell isRate">
                                    <strong>{percent(rate)}</strong>
                                    {rate !== null && <MiniBar value={rate} label={t('{name}: attendance', { name: person.name })} />}
                                </span>
                                <span className="hubMoney">{formatVnd(person.paid)}</span>
                            </motion.li>
                        );
                    })}
                </motion.ul>
            </AsyncState>
            <p className="hubFootnote">{t('{name} has ended, so nobody can join or be removed any more.', { name: cls.name })}</p>
        </SectionCard>
    );
};

export default PastStudents;
