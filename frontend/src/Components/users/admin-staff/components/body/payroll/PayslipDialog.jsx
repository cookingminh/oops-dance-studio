import { useState } from 'react';
import { Avatar, Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuAlarmClock, LuBadgeCheck, LuCalendarDays, LuList, LuLock, LuUnlock, LuMinus, LuPlus, LuTrash2, LuUndo2 } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import {
    addAdjustment,
    deleteAdjustment,
    finalizePayslip,
    getClassRates,
    getDefaultSessionRate,
    listAdjustments,
    listInstructorMonth,
    reopenPayslip,
    setPayslipPaid,
} from '@/services/payroll';
import { getPayslipClasses } from '@/services/payrollExtra';
import { avatarUrl } from '@/services/storage';
import { listInstructors } from '@/services/users';
import { formatClock, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import Segmented from '../../common/Segmented';
import SessionModal from '../../common/session-modal/SessionModal';
import { isReadOnly, sessionKey } from '../../common/session-modal/sessionModel';
import { sessionTimes } from '../class-hub/hubModel';
import PayslipCalendar from './PayslipCalendar';
import { NOT_COUNTED, STATUS_LABELS, minutesLate, payByClass, roleTitle } from './payrollShared';

const QUICK_AMOUNTS = [50000, 100000, 200000];
const QUICK_REASONS = {
    deduction: ['Late check-in', 'Left early', 'Missed a session without notice'],
    bonus: ['Covered a class', 'Extra rehearsal', 'Great student feedback'],
};

async function loadDetail(row, month) {
    const isInstructor = row.role === 'instructor';
    const [adjustments, sessions, classRates, defaultRate] = await Promise.all([
        listAdjustments(row.profile_id, month),
        isInstructor ? listInstructorMonth(row.profile_id, month) : [],
        isInstructor ? getClassRates() : {},
        isInstructor ? getDefaultSessionRate() : 0,
    ]);
    // The classes in full (regular instructor, room, picture) for the calendar and the session modal.
    const classes = sessions.length ? await getPayslipClasses(sessions.map((session) => session.class_id)) : {};
    return { adjustments, sessions, classRates, defaultRate, classes };
}

// One person's payslip for a month: how it adds up, the sessions behind it (on a calendar of the
// month or as a list, with late check-ins), bonuses/deductions with their reasons, and the
// finalize → paid steps. A session opens the shared session modal (proofs, roll call).
const PayslipDialog = ({ row, month, today, onClose, onChanged }) => {
    const { t, formatDate, monthName } = useI18n();
    const toast = useToast();
    const detail = useAsync(() => loadDetail(row, month), [row.profile_id, month, row.status]);
    const [kind, setKind] = useState('deduction');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [attendanceId, setAttendanceId] = useState(null);
    const [busy, setBusy] = useState(null);
    const [sessionView, setSessionView] = useState('calendar');
    const [opened, setOpened] = useState(null); // a session for the session modal
    const instructors = useAsync(() => (opened ? listInstructors() : Promise.resolve(undefined)), [Boolean(opened)]);

    const name = row.full_name || row.username;
    const isDraft = row.status === 'draft';
    const isInstructor = row.role === 'instructor';
    const { adjustments = [], sessions = [], classRates = {}, defaultRate = 0, classes = {} } = detail.data ?? {};
    const rateOf = (session) => classRates[session.class_id] ?? defaultRate;
    const counted = sessions.filter((s) => s.status === 'completed');
    const notCounted = sessions.filter((s) => s.status !== 'completed');

    // Completed sessions grouped by class: "K-pop Cover · 6 × 300.000 ₫".
    const byClass = payByClass(counted, rateOf);

    const refresh = () => {
        onChanged();
        detail.reload();
    };

    // A payslip row → the session modal's session (this person teaches it).
    const openSession = (session) => {
        const cls = classes[session.class_id] ?? { ...session.class, id: session.class_id };
        const person = { id: row.profile_id, username: row.username, full_name: row.full_name, email: row.email, avatar_path: row.avatar_path, updated_at: row.updated_at };
        setOpened({
            key: sessionKey(session.class_id, session.date),
            cls,
            date: session.date,
            row: { ...session, instructor_id: row.profile_id, instructor: person },
            extra: Boolean(session.is_extra),
            ...sessionTimes(cls, session.date, session),
        });
    };

    const amountValue = Number(amount);
    const amountValid = Number.isInteger(amountValue) && amountValue > 0;
    const canAdd = isDraft && amountValid && reason.trim().length > 0;

    const run = async (key, action, message) => {
        setBusy(key);
        try {
            await action();
            if (message) toast.success(message);
            onChanged();
            detail.reload();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    const deductFor = (session, late) => {
        setKind('deduction');
        setAttendanceId(session.id);
        setReason(t('Late check-in on {date} ({minutes} min)', { date: formatDate(session.date, 'short'), minutes: late }));
        setAmount('');
        document.getElementById('payslip-amount')?.focus();
    };

    const submitAdjustment = () => {
        if (!canAdd) return;
        const signed = kind === 'deduction' ? -amountValue : amountValue;
        run(
            'add',
            async () => {
                await addAdjustment({ profileId: row.profile_id, month, amount: signed, reason, attendanceId });
                setAmount('');
                setReason('');
                setAttendanceId(null);
            },
            kind === 'deduction' ? t('Deduction added.') : t('Bonus added.')
        );
    };

    const finalize = () => {
        if (!window.confirm(t('Finalize {name}’s payslip for {month}? The numbers will be frozen.', { name, month: monthName(month, { withYear: true }) }))) return;
        run('finalize', () => finalizePayslip(row.profile_id, month), t('Payslip finalized.'));
    };

    return (
        <>
            <Modal isOpen onOpenChange={(open) => !open && onClose()} size="4xl" scrollBehavior="inside" placement="center" classNames={{ base: 'payslipModal adminPortal' }}>
                <ModalContent>
                    <ModalHeader className="payslipHead">
                        <Avatar {...AVATAR_DEFAULTS} src={avatarUrl(row.avatar_path, row.updated_at) ?? undefined} name={name} />
                        <span className="payslipTitle">
                            <strong>{name}</strong>
                            <small>
                                {t(roleTitle(row.role))} · {t('Payslip for {month}', { month: monthName(month, { withYear: true }) })}
                            </small>
                        </span>
                        <span className={`payStatus is-${row.status}`}>{t(STATUS_LABELS[row.status])}</span>
                    </ModalHeader>

                    <ModalBody className="payslipBody">
                        {/* How the total adds up */}
                        <dl className="payBreakdown">
                            {isInstructor ? (
                                byClass.length ? (
                                    byClass.map((entry) => (
                                        <div key={entry.id}>
                                            <dt>
                                                {entry.name} <small>{entry.n} × {formatVnd(entry.rate)}</small>
                                            </dt>
                                            <dd>{formatVnd(entry.total)}</dd>
                                        </div>
                                    ))
                                ) : (
                                    <div>
                                        <dt>{t('Completed sessions')}</dt>
                                        <dd>{formatVnd(row.session_pay)}</dd>
                                    </div>
                                )
                            ) : (
                                <div>
                                    <dt>{t('Monthly salary')}</dt>
                                    <dd>{formatVnd(row.base_salary)}</dd>
                                </div>
                            )}
                            {isInstructor && Number(row.base_salary) > 0 && (
                                <div>
                                    <dt>{t('Monthly salary')}</dt>
                                    <dd>{formatVnd(row.base_salary)}</dd>
                                </div>
                            )}
                            <div className="isPlus">
                                <dt>{t('Bonuses')}</dt>
                                <dd>{Number(row.bonuses) ? `+${formatVnd(row.bonuses)}` : formatVnd(0)}</dd>
                            </div>
                            <div className="isMinus">
                                <dt>{t('Deductions')}</dt>
                                <dd>{Number(row.deductions) ? `−${formatVnd(Math.abs(Number(row.deductions)))}` : formatVnd(0)}</dd>
                            </div>
                            <div className="isTotal">
                                <dt>{t('Total to pay')}</dt>
                                <dd>{formatVnd(row.total)}</dd>
                            </div>
                        </dl>
                        {!isDraft && <p className="payNote">{t('Finalized numbers stay as they were, even if rates or sessions change later.')}</p>}

                        <AsyncState state={detail} isEmpty={false}>
                            {/* Sessions behind the pay (instructors) */}
                            {isInstructor && (
                                <section className="paySection">
                                    <div className="paySectionHead">
                                        <h4>
                                            {t('Sessions')} <span className="segCount">{counted.length}</span>
                                        </h4>
                                        {sessions.length > 0 && (
                                            <Segmented
                                                label={t('Show sessions as')}
                                                className="paySessionsView"
                                                options={[
                                                    { key: 'calendar', label: (<><LuCalendarDays aria-hidden="true" /> {t('Calendar')}</>) },
                                                    { key: 'list', label: (<><LuList aria-hidden="true" /> {t('List')}</>) },
                                                ]}
                                                value={sessionView}
                                                onChange={setSessionView}
                                            />
                                        )}
                                    </div>
                                    {sessions.length === 0 && <p className="payEmpty">{t('No sessions this month.')}</p>}
                                    {sessions.length > 0 && sessionView === 'calendar' && (
                                        <PayslipCalendar
                                            month={month}
                                            today={today}
                                            profileId={row.profile_id}
                                            sessions={sessions}
                                            classes={classes}
                                            lines={byClass}
                                            rateOf={rateOf}
                                            onOpen={openSession}
                                        />
                                    )}
                                    {sessionView === 'list' && (
                                        <ul className="paySessions">
                                            {[...counted, ...notCounted].map((session) => {
                                                const isCounted = session.status === 'completed';
                                                const late = minutesLate(session);
                                                return (
                                                    <li key={session.id} className={isCounted ? undefined : 'isOff'}>
                                                        <span className="paySessionDate">{formatDate(session.date, 'short')}</span>
                                                        <span className="paySessionClass">
                                                            <strong>{session.class?.name}</strong>
                                                            <small>
                                                                {session.checkin_at ? formatClock(session.checkin_at) : '—'} → {session.checkout_at ? formatClock(session.checkout_at) : '—'}
                                                            </small>
                                                        </span>
                                                        {late > 0 && (
                                                            <span className="lateBadge">
                                                                <LuAlarmClock aria-hidden="true" /> {t('{minutes} min late', { minutes: late })}
                                                            </span>
                                                        )}
                                                        {isCounted ? (
                                                            <span className="paySessionRate">{formatVnd(rateOf(session))}</span>
                                                        ) : (
                                                            <span className="paySessionOff">{t('Not counted · {why}', { why: t(NOT_COUNTED[session.status]) })}</span>
                                                        )}
                                                        {isDraft && late > 0 && (
                                                            <Button size="sm" variant="flat" color="danger" onPress={() => deductFor(session, late)}>
                                                                {t('Deduct')}
                                                            </Button>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </section>
                            )}

                            {/* Bonuses and deductions */}
                            <section className="paySection">
                                <h4>
                                    {t('Bonuses and deductions')} <span className="segCount">{adjustments.length}</span>
                                </h4>
                                {adjustments.length === 0 && <p className="payEmpty">{t('None this month.')}</p>}
                                <ul className="payAdjustments">
                                    {adjustments.map((adj) => {
                                        const value = Number(adj.amount);
                                        return (
                                            <li key={adj.id}>
                                                <span className={`payAdjIcon ${value > 0 ? 'isPlus' : 'isMinus'}`} aria-hidden="true">
                                                    {value > 0 ? <LuPlus /> : <LuMinus />}
                                                </span>
                                                <span className="payAdjText">
                                                    <strong>{adj.reason}</strong>
                                                    <small>
                                                        {t('Added by {name} · {date}', {
                                                            name: adj.author?.full_name || adj.author?.username || '—',
                                                            date: formatDate(adj.created_at.slice(0, 10), 'short'),
                                                        })}
                                                    </small>
                                                </span>
                                                <span className={`payAdjAmount ${value > 0 ? 'isPlus' : 'isMinus'}`}>
                                                    {value > 0 ? '+' : '−'}
                                                    {formatVnd(Math.abs(value))}
                                                </span>
                                                {isDraft && (
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant="light"
                                                        aria-label={t('Remove')}
                                                        isLoading={busy === `del-${adj.id}`}
                                                        onPress={() => run(`del-${adj.id}`, () => deleteAdjustment(adj.id), t('Removed.'))}
                                                    >
                                                        <LuTrash2 />
                                                    </Button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>

                                {isDraft ? (
                                    <div
                                        className="payAdjForm"
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && event.target.tagName === 'INPUT') submitAdjustment();
                                        }}
                                    >
                                        <Segmented
                                            label={t('Type')}
                                            options={[
                                                { key: 'deduction', label: t('Deduction') },
                                                { key: 'bonus', label: t('Bonus') },
                                            ]}
                                            value={kind}
                                            onChange={(value) => {
                                                setKind(value);
                                                setAttendanceId(null);
                                            }}
                                        />
                                        <div className="payAdjFields">
                                            <Input
                                                id="payslip-amount"
                                                label={t('Amount (VND)')}
                                                type="number"
                                                min={1}
                                                step={1000}
                                                value={amount}
                                                onValueChange={setAmount}
                                                isInvalid={amount !== '' && !amountValid}
                                                errorMessage={amount !== '' && !amountValid ? t('Enter an amount above 0.') : undefined}
                                            />
                                            <Input label={t('Reason')} placeholder={t('e.g. Late check-in on Mon 9 Nov (15 min)')} maxLength={200} value={reason} onValueChange={setReason} />
                                        </div>
                                        <div className="payQuick">
                                            {QUICK_AMOUNTS.map((value) => (
                                                <button type="button" key={value} onClick={() => setAmount(String(value))}>
                                                    {formatVnd(value)}
                                                </button>
                                            ))}
                                            <span className="payQuickSep" aria-hidden="true" />
                                            {QUICK_REASONS[kind].map((text) => (
                                                <button type="button" key={text} onClick={() => setReason(t(text))}>
                                                    {t(text)}
                                                </button>
                                            ))}
                                        </div>
                                        <Button onPress={submitAdjustment} color={kind === 'deduction' ? 'danger' : 'success'} className={kind === 'bonus' ? 'text-white' : undefined} isDisabled={!canAdd} isLoading={busy === 'add'}>
                                            {kind === 'deduction' ? t('Add deduction') : t('Add bonus')}
                                        </Button>
                                    </div>
                                ) : (
                                    <p className="payNote">
                                        <LuLock aria-hidden="true" /> {t('Reopen the payslip to change bonuses or deductions.')}
                                    </p>
                                )}
                            </section>
                        </AsyncState>
                    </ModalBody>

                    <ModalFooter className="payslipFoot">
                        {row.status === 'draft' && (
                            <Button color="danger" startContent={<LuLock aria-hidden="true" />} isLoading={busy === 'finalize'} onPress={finalize}>
                                {t('Finalize payslip')}
                            </Button>
                        )}
                        {row.status === 'finalized' && (
                            <>
                                <Button variant="light" startContent={<LuUnlock aria-hidden="true" />} isLoading={busy === 'reopen'} onPress={() => run('reopen', () => reopenPayslip(row.profile_id, month), t('Payslip reopened.'))}>
                                    {t('Reopen')}
                                </Button>
                                <Button color="success" className="text-white" startContent={<LuBadgeCheck aria-hidden="true" />} isLoading={busy === 'paid'} onPress={() => run('paid', () => setPayslipPaid(row.profile_id, month, true), t('Marked as paid.'))}>
                                    {t('Mark as paid')}
                                </Button>
                            </>
                        )}
                        {row.status === 'paid' && (
                            <>
                                <span className="payPaidOn">
                                    <LuBadgeCheck aria-hidden="true" /> {t('Paid on {date}', { date: formatDate(row.paid_at.slice(0, 10), 'full') })}
                                </span>
                                <Button variant="light" startContent={<LuUndo2 aria-hidden="true" />} isLoading={busy === 'unpaid'} onPress={() => run('unpaid', () => setPayslipPaid(row.profile_id, month, false), t('Marked as unpaid.'))}>
                                    {t('Mark as unpaid')}
                                </Button>
                            </>
                        )}
                        <Button variant="flat" onPress={onClose}>
                            {t('Close')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
            {opened && (
                <SessionModal
                    key={opened.key}
                    session={opened}
                    today={today}
                    instructors={instructors.data ?? []}
                    readOnly={!isDraft || isReadOnly(opened.cls, today)}
                    classLink
                    onClose={() => setOpened(null)}
                    onChanged={refresh}
                />
            )}
        </>
    );
};

export default PayslipDialog;
