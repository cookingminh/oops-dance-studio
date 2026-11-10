import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar, Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@nextui-org/react';
import { LuArrowRightLeft, LuBanknote, LuGraduationCap, LuMoreVertical, LuPhone, LuUserMinus, LuUserPlus } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { removeStudent } from '@/services/classes';
import { listStudentAttendanceForClasses } from '@/services/attendance';
import { markPaid } from '@/services/tuition';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import SectionCard from '../../../../common/SectionCard';
import { fadeUp, stagger } from '../../../../common/motion';
import SwitchClassDialog from '../../../../common/switch-class/SwitchClassDialog';
import PaymentDialog from '../../../tuition/PaymentDialog';
import { RenewalChip, StatePill } from '../../../tuition/TuitionParts';
import { rowState } from '../../../tuition/tuitionModel';
import { MiniBar } from '../../HubParts';
import { attendanceRate, percent, personName, routineNow, shiftDay } from '../../hubModel';
import { useClassInvoices } from '../useClassActivity';
import PastStudents from './PastStudents';
import '../../../tuition/tuition.scss';

// Students: who is in the class, how often they come (90 days), where their tuition stands for the
// running course and their answer for the next one. Pay, switch, open or remove from the row.
const StudentsTab = ({ ctx }) => {
    const { cls, today, isAdmin, progress, version, changed, openEnrol, badge } = ctx;
    const { t, tn, formatDate } = useI18n();
    const toast = useToast();
    const ended = badge.phase === 'ended';
    const invoices = useClassInvoices(cls.id, version);
    const roll = useAsync(
        () => listStudentAttendanceForClasses([cls.id], ended ? {} : { from: shiftDay(today, -90), until: today }),
        [cls.id, today, version, ended]
    );
    const [dialog, setDialog] = useState(null); // { kind: 'pay' | 'switch', ... }
    const [busy, setBusy] = useState(null);

    if (ended) return <PastStudents cls={cls} invoices={invoices} roll={roll} />;

    const { current, planned } = routineNow(progress);
    const course = current ?? planned;
    const nextCourse = current ? planned : null;
    const invoiceOf = (studentId, lesson) => (lesson ? (invoices.data ?? []).find((row) => row.student_id === studentId && row.lesson_id === lesson.lesson_id) : null);
    const members = [...(cls.students ?? [])].filter((row) => row.student).sort((a, b) => personName(a.student).localeCompare(personName(b.student)));

    const remove = async (student) => {
        const name = personName(student);
        if (!window.confirm(t('Remove {name} from {className}? Their unpaid tuition for courses not yet over is cancelled.', { name, className: cls.name }))) return;
        setBusy(student.id);
        try {
            await removeStudent(cls.id, student.id);
            toast.success(t('{name} left {className}.', { name, className: cls.name }));
            changed();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    const pay = async (invoice, payment) => {
        try {
            await markPaid(invoice.id, payment);
            toast.success(t('Payment recorded for {name}.', { name: invoice.student_name }));
            changed();
            return true;
        } catch (error) {
            toast.error(error);
            return false;
        }
    };

    return (
        <>
            <SectionCard
                icon={LuGraduationCap}
                title={t('Students')}
                subtitle={
                    members.length
                        ? `${tn(members.length, '{count} student', '{count} students')}${course ? ` · ${t('course: {title}', { title: course.title })}` : ''}`
                        : t('Nobody is in this class yet.')
                }
                actions={
                    <Button color="danger" startContent={<LuUserPlus aria-hidden="true" />} onPress={openEnrol}>
                        {t('Add student')}
                    </Button>
                }
            >
                {members.length === 0 ? (
                    <div className="hubEmptyBlock">
                        <p>{badge.phase === 'upcoming' ? t('Sign students up now: they pay for the first course and start when the class opens.') : t('Add the first students to this class.')}</p>
                    </div>
                ) : (
                    <div className="hubTableScroll">
                        <div className="hubStudentHead" aria-hidden="true">
                            <span>{t('Student')}</span>
                            <span>{t('Joined')}</span>
                            <span>{t('Attendance (90 days)')}</span>
                            <span>{t('This course')}</span>
                            <span>{t('Next course')}</span>
                            <span />
                        </div>
                        <motion.ul className="hubStudents" variants={stagger} initial="hidden" animate="show" aria-label={t('Students')}>
                            {members.map(({ student, joined_at: joinedAt, leaves_after: leavesAfter }) => {
                                const name = personName(student);
                                const rate = attendanceRate((roll.data ?? []).filter((row) => row.student_id === student.id));
                                const now = invoiceOf(student.id, course);
                                const next = invoiceOf(student.id, nextCourse);
                                const canPay = now && now.status === 'unpaid';
                                const later = joinedAt > today;
                                const menu = [
                                    { key: 'switch', label: t('Switch class'), icon: LuArrowRightLeft },
                                    { key: 'remove', label: t('Remove from class'), icon: LuUserMinus, danger: true },
                                ];
                                return (
                                    <motion.li key={student.id} variants={fadeUp} className="hubStudent">
                                        <span className="hubWho">
                                            <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(student.avatar_path, student.updated_at) ?? undefined} name={name} />
                                            <span>
                                                {isAdmin ? (
                                                    <Link to={`/admin/users?person=${student.id}`} className="hubWhoName">
                                                        {name}
                                                    </Link>
                                                ) : (
                                                    <strong className="hubWhoName">{name}</strong>
                                                )}
                                                {student.contact_number ? (
                                                    <a className="hubTel" href={`tel:${student.contact_number.replace(/[^\d+]/g, '')}`}>
                                                        <LuPhone aria-hidden="true" />
                                                        {student.contact_number}
                                                    </a>
                                                ) : (
                                                    <small>{student.email}</small>
                                                )}
                                            </span>
                                        </span>
                                        <span className="hubCell isDates" data-label={t('Joined')}>
                                            {later ? <span className="hubTag isJoining">{t('Joins {date}', { date: formatDate(joinedAt, 'dayMonth') })}</span> : formatDate(joinedAt, 'dayMonth')}
                                            {leavesAfter && <span className="hubTag isLeaving">{t('Leaves after {date}', { date: formatDate(leavesAfter, 'dayMonth') })}</span>}
                                        </span>
                                        <span className="hubCell isRate" data-label={t('Attendance (90 days)')}>
                                            <strong>{percent(rate)}</strong>
                                            {rate !== null && <MiniBar value={rate} tone={rate >= 0.8 ? 'good' : rate < 0.5 ? 'alert' : 'brand'} label={t('{name}: attendance', { name })} />}
                                        </span>
                                        <span className="hubCell" data-label={t('This course')}>
                                            {now ? <StatePill state={rowState(now, today)} /> : <span className="hubHint">{later ? t('Joins later') : t('Not billed')}</span>}
                                        </span>
                                        <span className="hubCell" data-label={t('Next course')}>
                                            {next ? <RenewalChip renewal={next.status === 'void' ? 'stop' : next.renewal} /> : <span className="hubHint">—</span>}
                                        </span>
                                        <span className="hubRowActions">
                                            {canPay && (
                                                <Button
                                                    size="sm"
                                                    variant="flat"
                                                    startContent={<LuBanknote aria-hidden="true" />}
                                                    aria-label={t('Record payment for {name}', { name })}
                                                    onPress={() => setDialog({ kind: 'pay', invoice: now })}
                                                >
                                                    <span className="hubHideSm">{t('Record payment')}</span>
                                                </Button>
                                            )}
                                            <Dropdown placement="bottom-end" classNames={{ content: 'adminPortal' }}>
                                                <DropdownTrigger>
                                                    <Button isIconOnly size="sm" variant="light" isLoading={busy === student.id} aria-label={t('More for {name}', { name })}>
                                                        <LuMoreVertical />
                                                    </Button>
                                                </DropdownTrigger>
                                                <DropdownMenu
                                                    aria-label={t('Student actions')}
                                                    onAction={(key) => (key === 'remove' ? remove(student) : setDialog({ kind: 'switch', student: { id: student.id, name, avatar_path: student.avatar_path, updated_at: student.updated_at } }))}
                                                >
                                                    {menu.map(({ key, label, icon: Icon, danger }) => (
                                                        <DropdownItem key={key} startContent={<Icon aria-hidden="true" />} className={danger ? 'text-danger' : undefined} color={danger ? 'danger' : 'default'}>
                                                            {label}
                                                        </DropdownItem>
                                                    ))}
                                                </DropdownMenu>
                                            </Dropdown>
                                        </span>
                                    </motion.li>
                                );
                            })}
                        </motion.ul>
                    </div>
                )}
            </SectionCard>

            {dialog?.kind === 'pay' && <PaymentDialog invoice={dialog.invoice} onClose={() => setDialog(null)} onSubmit={(payment) => pay(dialog.invoice, payment)} />}
            {dialog?.kind === 'switch' && (
                <SwitchClassDialog
                    student={dialog.student}
                    fromClass={{ id: cls.id, name: cls.name }}
                    onClose={() => setDialog(null)}
                    onSwitched={() => {
                        setDialog(null);
                        changed();
                    }}
                />
            )}
        </>
    );
};

export default StudentsTab;
