import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { format, parseISO } from 'date-fns';
import { LuWallet } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { revenueMonthly } from '@/services/stats';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../common/SectionCard';
import { SERIES, barDataset, barOptions } from '../../../common/chartTheme';
import { ChartTable, ViewToggle } from '../../../common/ChartViews';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const formatTick = (value) => `${compact.format(value)} ₫`;

// Real income per month, stacked by room (approved + completed bookings, from v_revenue_monthly).
const RevenueChart = () => {
    const { t, dateLocale } = useI18n();
    const revenue = useAsync(revenueMonthly, []);
    const [view, setView] = useState('chart');
    const rows = revenue.data ?? [];

    const months = [...new Set(rows.map((row) => row.month))].sort();
    // Rooms keep their slot (by id) whichever months are shown.
    const rooms = [...new Map(rows.map((row) => [row.room_id, row.room_name])).entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
    const chartData = {
        labels: months.map((month) => format(parseISO(month), 'MMM yyyy', { locale: dateLocale })),
        datasets: rooms.map(([roomId, roomName], index) =>
            barDataset(
                roomName,
                months.map((month) => Number(rows.find((r) => r.month === month && r.room_id === roomId)?.real_income_sum ?? 0)),
                SERIES[index],
                { stacked: true }
            )
        ),
    };
    const total = rows.reduce((sum, row) => sum + Number(row.real_income_sum ?? 0), 0);

    return (
        <SectionCard
            className="chartCard isWide"
            icon={LuWallet}
            title={t('Monthly Revenue')}
            subtitle={rows.length ? t('Real income by room · {total} in total', { total: formatVnd(total) }) : t('Real income by room')}
            actions={<ViewToggle view={view} onChange={setView} label={t('Monthly revenue')} />}
        >
            <AsyncState state={revenue} emptyText={t('No approved or completed bookings yet.')}>
                {view === 'table' ? (
                    <ChartTable data={chartData} rowHeader={t('Month')} format={formatVnd} />
                ) : (
                    <div className="chartCanvas">
                        <Bar data={chartData} options={barOptions({ stacked: true, formatTick, formatValue: formatVnd })} />
                    </div>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default RevenueChart;
