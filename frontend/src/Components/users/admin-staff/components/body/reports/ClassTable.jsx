import { useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuAlertTriangle, LuArrowDown, LuArrowUp, LuArrowUpDown, LuDownload, LuInfo, LuSchool } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../common/SectionCard';
import { COLORS } from './reportChart';
import { classMarginPct, classTotals, sortClasses } from './reportModel';
import { downloadClassCsv } from './csv';
import ClassLink from '../class-hub/ClassLink';

const COLUMNS = [
    { key: 'class_name', label: 'Class', align: 'left' },
    { key: 'students', label: 'Students' },
    { key: 'collected', label: 'Collected' },
    { key: 'outstanding', label: 'Outstanding' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'instructor_pay', label: 'Instructor pay' },
    { key: 'direct_costs', label: 'Class costs' },
    { key: 'margin', label: 'Margin' },
    { key: 'marginPct', label: 'Margin %' },
];

// Margin as a bar from a shared zero: right in blue when the class earns, left in red when it loses.
const MarginBar = ({ value, zeroAt, scale }) => (
    <span className="marginTrack" aria-hidden="true">
        {zeroAt > 0 && <span className="marginZero" style={{ left: `${zeroAt * 100}%` }} />}
        <span
            className="marginFill"
            style={{
                left: `${(value < 0 ? zeroAt - Math.abs(value) * scale : zeroAt) * 100}%`,
                width: `${Math.abs(value) * scale * 100}%`,
                background: value < 0 ? COLORS.loss : COLORS.gain,
            }}
        />
    </span>
);

// Per class for the focused month: what it brought in, what its sessions and its own costs (a
// shoot's camera crew, costumes…) took, what is left. Rent, staff salaries and other shared
// costs aren't split per class, so this margin is before those.
const ClassTable = ({ state, month, inProgress, fmt }) => {
    const { t, tn } = useI18n();
    const [sort, setSort] = useState({ key: 'margin', dir: 'desc' });
    const rows = sortClasses(state.data ?? [], sort);
    const totals = classTotals(rows);
    const losing = rows.filter((row) => row.margin < 0);

    // The bars share one scale; zero sits as far right as the biggest loss needs.
    const maxGain = Math.max(0, ...rows.map((row) => row.margin));
    const maxLoss = Math.max(0, ...rows.map((row) => -row.margin));
    const span = maxGain + maxLoss || 1;
    const zeroAt = maxLoss / span;
    const scale = 1 / span;

    const toggle = (key) =>
        setSort((current) => (current.key === key ? { key, dir: current.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'class_name' ? 'asc' : 'desc' }));

    const subtitle = losing.length
        ? tn(losing.length, '{month} · {count} class loses money', '{month} · {count} classes lose money', { month: fmt.heading(month) })
        : t('{month} · tuition collected minus instructor pay and class costs', { month: fmt.heading(month) });

    return (
        <SectionCard
            className="classFinanceCard"
            icon={LuSchool}
            title={t('Classes')}
            subtitle={subtitle}
            actions={
                <Button variant="flat" className="noPrint" startContent={<LuDownload aria-hidden="true" />} isDisabled={!rows.length} onPress={() => downloadClassCsv(rows, month, t)}>
                    {t('Export CSV')}
                </Button>
            }
        >
            {inProgress && (
                <p className="inlineNotice">
                    <LuInfo aria-hidden="true" />
                    <span>{t('This month is still running: payments, sessions and costs still to come will change these margins.')}</span>
                </p>
            )}
            <AsyncState state={state} emptyText={t('No classes billed or taught this month.')}>
                <div className={`reportTableWrap${state.loading ? ' isRefreshing' : ''}`}>
                    <table className="reportTable classTable">
                        <caption className="sr-only">{t('Classes in {month}', { month: fmt.monthYear(month) })}</caption>
                        <thead>
                            <tr>
                                {COLUMNS.map((column) => {
                                    const active = sort.key === column.key;
                                    const Icon = active ? (sort.dir === 'asc' ? LuArrowUp : LuArrowDown) : LuArrowUpDown;
                                    return (
                                        <th
                                            key={column.key}
                                            scope="col"
                                            className={column.align === 'left' ? 'isLeft' : undefined}
                                            aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        >
                                            <button type="button" className={`sortButton${active ? ' isActive' : ''}`} onClick={() => toggle(column.key)}>
                                                {t(column.label)}
                                                <Icon aria-hidden="true" />
                                            </button>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const pct = classMarginPct(row);
                                const loses = row.margin < 0;
                                return (
                                    <tr key={row.class_id ?? row.class_name} className={loses ? 'isLoss' : undefined}>
                                        <th scope="row" className="isLeft">
                                            <span className="className">
                                                <ClassLink id={row.class_id}>{row.class_name}</ClassLink>
                                                {loses && (
                                                    <span className="lossChip">
                                                        <LuAlertTriangle aria-hidden="true" />
                                                        {t('Loses money')}
                                                    </span>
                                                )}
                                            </span>
                                            {row.instructor_name && <small>{row.instructor_name}</small>}
                                        </th>
                                        <td>{fmt.count(row.students)}</td>
                                        <td>{fmt.money(row.collected)}</td>
                                        <td className={row.outstanding > 0 ? 'isOwed' : 'isMuted'}>{row.outstanding > 0 ? fmt.money(row.outstanding) : '—'}</td>
                                        <td>{fmt.count(row.sessions)}</td>
                                        <td>{fmt.money(row.instructor_pay)}</td>
                                        <td className={row.direct_costs > 0 ? undefined : 'isMuted'}>{row.direct_costs > 0 ? fmt.money(row.direct_costs) : '—'}</td>
                                        <td className="marginCell">
                                            <span className="marginValue">{fmt.money(row.margin)}</span>
                                            <MarginBar value={row.margin} zeroAt={zeroAt} scale={scale} />
                                        </td>
                                        <td>{fmt.pct(pct)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row" className="isLeft">
                                    {t('Total')}
                                </th>
                                <td>{fmt.count(totals.students)}</td>
                                <td>{fmt.money(totals.collected)}</td>
                                <td>{totals.outstanding > 0 ? fmt.money(totals.outstanding) : '—'}</td>
                                <td>{fmt.count(totals.sessions)}</td>
                                <td>{fmt.money(totals.instructor_pay)}</td>
                                <td>{totals.direct_costs > 0 ? fmt.money(totals.direct_costs) : '—'}</td>
                                <td className="marginCell">
                                    <span className="marginValue">{fmt.money(totals.margin)}</span>
                                </td>
                                <td>{fmt.pct(totals.collected > 0 ? totals.margin / totals.collected : null)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p className="tableNote">
                    {t('Margin = tuition collected − instructor pay − costs tied to the class (its shoot, costumes…). Rent, staff salaries and other shared costs aren’t split per class.')}
                </p>
            </AsyncState>
        </SectionCard>
    );
};

export default ClassTable;
