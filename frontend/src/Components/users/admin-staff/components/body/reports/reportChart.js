import { Chart as ChartJS } from 'chart.js';
import { SERIES, barOptions } from '../../common/chartTheme';

// Colours for the report (all from the validated palette in chartTheme / the dataviz reference).
// Money in takes categorical slots 1–2 (tuition, room bookings); money out starts at slot 3
// (payroll) and the expense categories take slots 4–8 in order, so every neighbour in the
// costs stack is a validated adjacent pair and no cost shares a colour with revenue. Smaller
// categories fold into a neutral Other. Profit is polar (gain above the line, loss below):
// the blue ↔ red diverging pair. Totals in the ledger are ink, not a series colour.
export const COLORS = {
    tuition: SERIES[0],
    bookings: SERIES[1],
    payroll: SERIES[2],
    transfer: SERIES[0],
    cash: SERIES[1],
    gain: SERIES[0],
    loss: SERIES[7],
    continuing: SERIES[0],
    joined: SERIES[1],
    returning: SERIES[2],
    left: SERIES[7],
    other: '#a9a6a0',
    total: 'hsl(0, 0%, 30%)',
};

export const CATEGORY_COLORS = [SERIES[3], SERIES[4], SERIES[5], SERIES[6], SERIES[7]];

// The colour of a cost group (see costGroups in reportModel): named categories by rank, Other grey.
export const groupColor = (group, groups) => {
    const index = groups.named.indexOf(group);
    return index >= 0 ? CATEGORY_COLORS[index] : COLORS.other;
};

const INK = {
    text: 'hsl(0, 0%, 12%)',
    muted: 'hsl(240, 4%, 44%)',
    grid: 'hsl(20, 10%, 91%)',
    baseline: 'hsl(20, 6%, 74%)',
    band: 'hsla(20, 30%, 40%, 0.07)',
};

// The month still running is drawn lighter: same hue (same series), visibly "not final".
export function inProgressShade(hex, alpha = 0.42) {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

// One colour per bar: lighter for the month in progress.
export const barColors = (color, months, thisMonth) => months.map((month) => (month === thisMonth ? inProgressShade(color) : color));

// A soft band behind the focused month, so the charts point at the month the tiles describe.
export const focusBandPlugin = {
    id: 'focusBand',
    beforeDatasetsDraw(chart, args, options) {
        const index = options?.index;
        const scale = chart.scales.x;
        if (index === undefined || index === null || index < 0 || !scale) return;
        const step = (scale.right - scale.left) / Math.max(1, chart.data.labels.length);
        const center = scale.getPixelForValue(index);
        const { top, bottom } = chart.chartArea;
        const { ctx } = chart;
        ctx.save();
        ctx.fillStyle = INK.band;
        ctx.beginPath();
        ctx.roundRect(center - step * 0.46, top, step * 0.92, bottom - top, 10);
        ctx.fill();
        ctx.restore();
    },
};

// Prints the value of one bar (the focused month) at its end: one direct label, not one per bar.
export const focusValuePlugin = {
    id: 'focusValue',
    afterDatasetsDraw(chart, args, options) {
        const { index, format } = options ?? {};
        if (index === undefined || index === null || index < 0 || !format) return;
        const bar = chart.getDatasetMeta(0)?.data?.[index];
        const value = chart.data.datasets[0]?.data?.[index];
        if (!bar || value === undefined || value === null) return;
        const { ctx } = chart;
        ctx.save();
        ctx.font = `700 12px ${ChartJS.defaults.font.family}`;
        ctx.fillStyle = INK.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = value >= 0 ? 'bottom' : 'top';
        ctx.fillText(format(value), bar.x, value >= 0 ? bar.y - 6 : bar.y + 6);
        ctx.restore();
    },
};

// Bar options shared by the report charts, on top of chartTheme's barOptions:
// clicking a month focuses it, the focused month's label is bold, zero gets a baseline,
// the tooltip can add a footer line, and `suggestedMax` puts two charts on the same scale.
export function reportBarOptions({ months, narrowLabels, focusIndex, onPick, stacked = false, legend = true, formatTick, formatValue, footer, tooltipLabel, valueLabel, suggestedMax }) {
    const base = barOptions({ stacked, legend, formatTick, formatValue });
    return {
        ...base,
        layout: { padding: { top: valueLabel ? 18 : 4 } },
        onClick: (event, elements, chart) => {
            const index = chart.scales.x.getValueForPixel(event.x);
            if (months[index]) onPick(months[index]);
        },
        onHover: (event, elements, chart) => {
            chart.canvas.style.cursor = event.x >= chart.chartArea.left && event.x <= chart.chartArea.right ? 'pointer' : 'default';
        },
        plugins: {
            ...base.plugins,
            focusBand: { index: focusIndex },
            focusValue: valueLabel ? { index: focusIndex, format: valueLabel } : {},
            tooltip: {
                ...base.plugins.tooltip,
                callbacks: {
                    ...base.plugins.tooltip.callbacks,
                    ...(tooltipLabel && { label: tooltipLabel }),
                    ...(footer && { footer }),
                },
            },
        },
        scales: {
            x: {
                ...base.scales.x,
                ticks: {
                    ...base.scales.x.ticks,
                    maxRotation: 0,
                    autoSkip: false,
                    // Phone-width charts get short month names instead of slanted labels.
                    callback(value, index) {
                        return narrowLabels && this.chart.width < 520 ? narrowLabels[index] : this.getLabelForValue(value);
                    },
                    color: (ctx) => (ctx.index === focusIndex ? INK.text : INK.muted),
                    font: (ctx) => ({ weight: ctx.index === focusIndex ? 700 : 500 }),
                },
            },
            y: {
                ...base.scales.y,
                grace: valueLabel ? '8%' : 0,
                // Charts that sit side by side share one top, so their bars compare.
                ...(suggestedMax && { suggestedMax }),
                grid: { ...base.scales.y.grid, color: (ctx) => (ctx.tick?.value === 0 ? INK.baseline : INK.grid) },
            },
        },
    };
}
