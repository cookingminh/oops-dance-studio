import { useI18n } from '@/i18n/i18nContext';

// Segmented Chart / Table switch for a card header. `label` is already translated by the caller.
export const ViewToggle = ({ view, onChange, label }) => {
    const { t } = useI18n();
    return (
        <div className="viewToggle" role="group" aria-label={t('{label}: show as', { label })}>
            {['chart', 'table'].map((option) => (
                <button key={option} type="button" aria-pressed={view === option} onClick={() => onChange(option)}>
                    {option === 'chart' ? t('Chart') : t('Table')}
                </button>
            ))}
        </div>
    );
};

// The same numbers as the chart, for reading exact values (and for screen readers).
export const ChartTable = ({ data, rowHeader, format = (value) => value }) => {
    const { t } = useI18n();
    const showTotal = data.datasets.length > 1;
    return (
        <div className="chartTableWrap">
            <table className="chartTable">
                <thead>
                    <tr>
                        <th scope="col">{rowHeader}</th>
                        {data.datasets.map((dataset) => (
                            <th scope="col" key={dataset.label}>
                                <span className="seriesKey" style={{ background: dataset.backgroundColor }} aria-hidden="true" />
                                {dataset.label}
                            </th>
                        ))}
                        {showTotal && <th scope="col">{t('Total')}</th>}
                    </tr>
                </thead>
                <tbody>
                    {data.labels.map((label, index) => (
                        <tr key={label}>
                            <th scope="row">{label}</th>
                            {data.datasets.map((dataset) => (
                                <td key={dataset.label}>{format(dataset.data[index] ?? 0)}</td>
                            ))}
                            {showTotal && (
                                <td className="isTotal">{format(data.datasets.reduce((sum, dataset) => sum + Number(dataset.data[index] ?? 0), 0))}</td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
