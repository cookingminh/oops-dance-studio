import { Button } from '@nextui-org/react';
import { LuDownload, LuTable2 } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../common/SectionCard';
import { downloadMonthlyCsv } from './csv';

// Money columns, then people (counted per person; enrolments = class memberships, last).
// The CSV adds the expense categories and the enrolment-level movement.
const MONEY = [
    ['revenue', 'Revenue'],
    ['tuition_collected', 'Tuition'],
    ['bookings_revenue', 'Room bookings'],
    ['payroll_cost', 'Payroll cost'],
    ['expenses_total', 'Expenses'],
    ['profit', 'Profit'],
];
const PEOPLE = [
    ['students_active', 'Active students'],
    ['students_new', 'New'],
    ['students_continuing', 'Continuing'],
    ['students_returning', 'Returning'],
    ['students_left', 'Left'],
];

// Every number behind the charts, month by month (the charts' table view), with the CSV export.
const MonthlyTable = ({ rows, expenses, focusMonth, onPick, fmt }) => {
    const { t } = useI18n();

    return (
        <SectionCard
            className="monthlyCard"
            icon={LuTable2}
            title={t('Month by month')}
            subtitle={t('Every number behind the charts')}
            actions={
                <Button variant="flat" className="noPrint" startContent={<LuDownload aria-hidden="true" />} isDisabled={!rows.length} onPress={() => downloadMonthlyCsv(rows, expenses, t)}>
                    {t('Export CSV')}
                </Button>
            }
        >
            <div className="reportTableWrap">
                <table className="reportTable monthlyTable">
                    <caption className="sr-only">{t('Finance by month')}</caption>
                    <thead>
                        <tr>
                            <th scope="col" className="isLeft">
                                {t('Month')}
                            </th>
                            {MONEY.map(([key, label]) => (
                                <th scope="col" key={key}>
                                    {t(label)}
                                </th>
                            ))}
                            <th scope="col">{t('Profit margin')}</th>
                            <th scope="col">{t('Collection rate')}</th>
                            <th scope="col">{t('Outstanding')}</th>
                            {PEOPLE.map(([key, label]) => (
                                <th scope="col" key={key} className={key === 'students_active' ? 'isGroupStart' : undefined}>
                                    {t(label)}
                                </th>
                            ))}
                            <th scope="col">{t('Retention')}</th>
                            <th scope="col">{t('Class switches')}</th>
                            <th scope="col">{t('Enrolments')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.month} className={row.month === focusMonth ? 'isFocused' : undefined} data-month={row.month}>
                                <th scope="row" className="isLeft">
                                    <button type="button" className="monthButton" aria-pressed={row.month === focusMonth} onClick={() => onPick(row.month)}>
                                        {fmt.heading(row.month)}
                                    </button>
                                    {row.inProgress && <span className="progressChip">{t('In progress')}</span>}
                                </th>
                                {MONEY.map(([key]) => (
                                    <td key={key} className={key === 'profit' && row.profit < 0 ? 'isNegative' : undefined}>
                                        {fmt.money(row[key])}
                                    </td>
                                ))}
                                <td>{fmt.pct(row.margin)}</td>
                                <td>{fmt.pct(row.collectionRate)}</td>
                                <td>{row.tuition_outstanding > 0 ? fmt.money(row.tuition_outstanding) : '—'}</td>
                                {PEOPLE.map(([key]) => (
                                    <td key={key} className={key === 'students_active' ? 'isGroupStart' : undefined}>
                                        {fmt.count(row[key])}
                                    </td>
                                ))}
                                <td>{fmt.pct(row.retention)}</td>
                                <td className={row.class_switches > 0 ? undefined : 'isMuted'}>{row.class_switches > 0 ? fmt.count(row.class_switches) : '—'}</td>
                                <td>{fmt.count(row.enrolments_active)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionCard>
    );
};

export default MonthlyTable;
