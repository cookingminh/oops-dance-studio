import { useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar, Button } from '@nextui-org/react';
import {
    LuBadgeCheck,
    LuChevronLeft,
    LuChevronRight,
    LuDownload,
    LuInfo,
    LuLock,
    LuSettings2,
    LuWallet,
} from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { finalizePayslip, getPayrollMonth } from '@/services/payroll';
import { getStudioToday } from '@/services/studio';
import { avatarUrl } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { nextMonth } from '@/lib/lessons';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../common/SectionCard';
import { fadeUp, stagger } from '../../common/motion';
import { STATUS_LABELS, capitalizeFirst, roleTitle } from './payrollShared';
import PayslipDialog from './PayslipDialog';
import PayRatesDialog from './PayRatesDialog';
import './payroll.scss';

const prevMonth = (month) => {
    const [y, m] = month.split('-').map(Number);
    return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
};

// CSV of the month, for the accountant (amounts in VND, no formatting).
function downloadCsv(rows, month, t) {
    const head = [t('Name'), t('Role'), t('Sessions'), t('Session pay'), t('Monthly salary'), t('Bonuses'), t('Deductions'), t('Total'), t('Status')];
    const lines = rows.map((r) => [r.full_name || r.username, t(roleTitle(r.role)), r.sessions, r.session_pay, r.base_salary, r.bonuses, r.deductions, r.total, t(STATUS_LABELS[r.status])]);
    const csv = [head, ...lines].map((line) => line.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `payroll-${month.slice(0, 7)}.csv` });
    link.click();
    URL.revokeObjectURL(url);
}

// Payroll for one month: who gets what, why, and where each payslip stands
// (draft → finalized → paid). Admin only.
const Payroll = () => {
    const { t, tn, monthName } = useI18n();
    const toast = useToast();
    const today = useAsync(getStudioToday, []);
    const [picked, setPicked] = useState(null); // 'yyyy-MM-01'; null = this month
    const thisMonth = today.data ? `${today.data.slice(0, 7)}-01` : null;
    const month = picked ?? thisMonth;
    const payroll = useAsync(() => (month ? getPayrollMonth(month) : Promise.resolve(undefined)), [month]);
    const [openId, setOpenId] = useState(null);
    const [ratesOpen, setRatesOpen] = useState(false);
    const [finalizing, setFinalizing] = useState(false);

    const rows = payroll.data ?? [];
    const sum = (key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
    const drafts = rows.filter((row) => row.status === 'draft');
    const paid = rows.filter((row) => row.status === 'paid').length;
    const isCurrent = month === thisMonth;
    const open = rows.find((row) => row.profile_id === openId);

    const finalizeAll = async () => {
        if (!window.confirm(t('Finalize {count} draft payslips for {month}? Their numbers will be frozen.', { count: drafts.length, month: monthName(month, { withYear: true }) }))) return;
        setFinalizing(true);
        try {
            for (const row of drafts) await finalizePayslip(row.profile_id, month);
            toast.success(t('{count} payslips finalized.', { count: drafts.length }));
        } catch (error) {
            toast.error(error);
        } finally {
            setFinalizing(false);
            payroll.reload();
        }
    };

    const instructors = rows.filter((row) => row.role === 'instructor');
    const staff = rows.filter((row) => row.role !== 'instructor');

    const renderRow = (row) => {
        const name = row.full_name || row.username;
        const adjustments = Number(row.bonuses) + Number(row.deductions);
        return (
            <motion.li key={row.profile_id} variants={fadeUp}>
                <button type="button" className={`payRow is-${row.status}`} onClick={() => setOpenId(row.profile_id)}>
                    <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(row.avatar_path, row.updated_at) ?? undefined} name={name} />
                    <span className="payWho">
                        <strong>{name}</strong>
                        <small>{t(roleTitle(row.role))}</small>
                    </span>
                    <span className="payBasis">
                        {row.role === 'instructor' ? (
                            <>
                                <strong>{tn(row.sessions, '{count} session', '{count} sessions')}</strong>
                                <small>{formatVnd(row.session_pay)}</small>
                            </>
                        ) : (
                            <>
                                <strong>{t('Monthly salary')}</strong>
                                <small>{Number(row.base_salary) ? formatVnd(row.base_salary) : t('Not set')}</small>
                            </>
                        )}
                    </span>
                    <span className={`payAdjust${adjustments > 0 ? ' isPlus' : adjustments < 0 ? ' isMinus' : ''}`}>
                        {adjustments ? `${adjustments > 0 ? '+' : '−'}${formatVnd(Math.abs(adjustments))}` : '—'}
                    </span>
                    <span className="payTotal">{formatVnd(row.total)}</span>
                    <span className={`payStatus is-${row.status}`}>
                        {row.status === 'paid' ? <LuBadgeCheck aria-hidden="true" /> : row.status === 'finalized' ? <LuLock aria-hidden="true" /> : null}
                        {t(STATUS_LABELS[row.status])}
                    </span>
                    <LuChevronRight className="payGo" aria-hidden="true" />
                </button>
            </motion.li>
        );
    };

    return (
        <>
            <SectionCard
                className="payrollCard"
                icon={LuWallet}
                title={t('Payroll')}
                subtitle={t('Instructors are paid per completed session, staff a monthly salary. Add bonuses or deductions, then finalize and pay.')}
                actions={
                    <>
                        <Button variant="flat" startContent={<LuSettings2 aria-hidden="true" />} onPress={() => setRatesOpen(true)}>
                            {t('Rates & salaries')}
                        </Button>
                        <Button variant="flat" startContent={<LuDownload aria-hidden="true" />} isDisabled={!rows.length} onPress={() => downloadCsv(rows, month, t)}>
                            {t('Export CSV')}
                        </Button>
                    </>
                }
            >
                <div className="payMonthBar">
                    <div className="payMonthNav" role="group" aria-label={t('Month')}>
                        <button type="button" aria-label={t('Previous month')} disabled={!month} onClick={() => setPicked(prevMonth(month))}>
                            <LuChevronLeft />
                        </button>
                        <strong>{month ? capitalizeFirst(monthName(month, { withYear: true })) : '…'}</strong>
                        <button type="button" aria-label={t('Next month')} disabled={!month || isCurrent} onClick={() => setPicked(nextMonth(month) === thisMonth ? null : nextMonth(month))}>
                            <LuChevronRight />
                        </button>
                    </div>
                    {drafts.length > 0 && (
                        <Button color="danger" startContent={<LuLock aria-hidden="true" />} isLoading={finalizing} onPress={finalizeAll}>
                            {t('Finalize {count} drafts', { count: drafts.length })}
                        </Button>
                    )}
                </div>

                {isCurrent && (
                    <p className="inlineNotice">
                        <LuInfo aria-hidden="true" />
                        <span>{t('This month is still running: sessions completed later are added automatically. Finalize payslips at the end of the month.')}</span>
                    </p>
                )}

                <AsyncState state={payroll} isEmpty={!payroll.loading && rows.length === 0} emptyText="Nobody to pay this month.">
                    <div className="payTotals">
                        <div className="payTotalTile isMain">
                            <span>{t('Total payroll')}</span>
                            <strong>{formatVnd(sum('total'))}</strong>
                            <small>{tn(rows.length, '{count} person', '{count} people')}</small>
                        </div>
                        <div className="payTotalTile">
                            <span>{t('Instructors')}</span>
                            <strong>{formatVnd(sum('session_pay'))}</strong>
                            <small>{tn(sum('sessions'), '{count} session', '{count} sessions')}</small>
                        </div>
                        <div className="payTotalTile">
                            <span>{t('Staff salaries')}</span>
                            <strong>{formatVnd(sum('base_salary'))}</strong>
                            <small>{tn(staff.length, '{count} person', '{count} people')}</small>
                        </div>
                        <div className="payTotalTile">
                            <span>{t('Bonuses / deductions')}</span>
                            <strong>
                                <span className="isPlus">+{formatVnd(sum('bonuses'))}</span> <span className="isMinus">−{formatVnd(Math.abs(sum('deductions')))}</span>
                            </strong>
                            <small>{t('{paid} of {count} paid', { paid, count: rows.length })}</small>
                        </div>
                    </div>

                    {[['Instructors', instructors], ['Staff', staff]].map(([group, list]) =>
                        list.length ? (
                            <section key={group} className="payGroup">
                                <h3>{t(group)}</h3>
                                <motion.ul key={month} className="payList" variants={stagger} initial="hidden" animate="show">
                                    {list.map(renderRow)}
                                </motion.ul>
                            </section>
                        ) : null
                    )}
                </AsyncState>
            </SectionCard>

            {open && (
                <PayslipDialog
                    key={`${open.profile_id}-${month}`}
                    row={open}
                    month={month}
                    today={today.data}
                    onClose={() => setOpenId(null)}
                    onChanged={payroll.reload}
                />
            )}
            {ratesOpen && (
                <PayRatesDialog
                    onClose={() => setRatesOpen(false)}
                    onSaved={() => {
                        setRatesOpen(false);
                        payroll.reload();
                    }}
                />
            )}
        </>
    );
};

export default Payroll;
