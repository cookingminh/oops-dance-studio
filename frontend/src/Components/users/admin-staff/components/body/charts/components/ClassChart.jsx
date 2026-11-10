import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { LuGraduationCap } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { classEnrolment } from '@/services/stats';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../../common/SectionCard';
import { SERIES, barDataset, barOptions } from '../../../common/chartTheme';
import { ChartTable, ViewToggle } from '../../../common/ChartViews';

// Current number of enrolled students per class (one series: the title names it, no legend).
const ClassChart = () => {
    const { t, tn } = useI18n();
    const classes = useAsync(classEnrolment, []);
    const [view, setView] = useState('chart');
    const list = classes.data ?? [];

    const chartData = {
        labels: list.map((item) => item.name),
        datasets: [barDataset(t('Students'), list.map((item) => item.students), SERIES[0])],
    };
    const total = list.reduce((sum, item) => sum + item.students, 0);

    return (
        <SectionCard
            className="chartCard"
            icon={LuGraduationCap}
            title={t('Class enrolment')}
            subtitle={t('{enrolments} across {classes}', {
                enrolments: tn(total, '{count} enrolment', '{count} enrolments'),
                classes: tn(list.length, '{count} class', '{count} classes'),
            })}
            actions={<ViewToggle view={view} onChange={setView} label={t('Class enrolment')} />}
        >
            <AsyncState state={classes} emptyText={t('No classes yet.')}>
                {view === 'table' ? (
                    <ChartTable data={chartData} rowHeader={t('Class')} />
                ) : (
                    <div className="chartCanvas">
                        <Bar data={chartData} options={barOptions({ legend: false })} />
                    </div>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default ClassChart;
