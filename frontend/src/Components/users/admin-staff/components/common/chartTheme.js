import { Chart as ChartJS, BarElement, CategoryScale, Legend, LinearScale, Tooltip } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
ChartJS.defaults.font.family = "'Spartan', sans-serif";

// Categorical hues in a fixed order (validated for colour-blind separation on adjacent pairs).
// Series take slots in order; a series keeps its colour when others are filtered out.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

// Booking / session statuses, stacked bottom → top in this order (adjacent pairs validated).
export const STATUS_COLORS = {
    completed: '#1baf7a',
    approved: '#2a78d6',
    pending: '#eda100',
    rejected: '#6250d6',
    cancelled: '#e34948',
};
export const STATUS_STACK_ORDER = ['completed', 'approved', 'pending', 'rejected', 'cancelled'];

// Each room keeps one colour everywhere (charts, bookings, timetable): slots in order of room id.
export function roomColorMap(rooms = []) {
    const sorted = [...rooms].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    return new Map(sorted.map((room, index) => [room.id, SERIES[index % SERIES.length]]));
}

const INK = {
    text: 'hsl(0, 0%, 12%)',
    muted: 'hsl(240, 4%, 44%)',
    grid: 'hsl(20, 10%, 91%)',
    surface: '#ffffff',
};

// Thin bar with a 4px rounded end, square at the baseline. Stacked segments get a 2px
// surface-coloured gap on top; Chart.js only rounds the outer end of a stack.
export function barDataset(label, data, color, { stacked = false } = {}) {
    return {
        label,
        data,
        backgroundColor: color,
        hoverBackgroundColor: color,
        borderColor: INK.surface,
        borderWidth: stacked ? { top: 2 } : 0,
        borderRadius: 4,
        borderSkipped: 'start',
        maxBarThickness: 24,
    };
}

export function barOptions({ stacked = false, legend = true, formatTick, formatValue = (value) => value } = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: {
            legend: {
                display: legend,
                position: 'top',
                align: 'start',
                labels: {
                    color: INK.text,
                    usePointStyle: true,
                    pointStyle: 'rectRounded',
                    boxWidth: 10,
                    boxHeight: 10,
                    padding: 16,
                    font: { size: 12, weight: 500 },
                },
            },
            tooltip: {
                backgroundColor: INK.text,
                padding: 10,
                cornerRadius: 10,
                boxPadding: 4,
                usePointStyle: true,
                filter: (item) => item.parsed.y !== 0,
                callbacks: { label: (item) => ` ${item.dataset.label}: ${formatValue(item.parsed.y)}` },
            },
        },
        scales: {
            x: {
                stacked,
                grid: { display: false },
                border: { color: INK.grid },
                ticks: { color: INK.muted },
            },
            y: {
                stacked,
                beginAtZero: true,
                grid: { color: INK.grid, lineWidth: 1 },
                border: { display: false },
                ticks: { color: INK.muted, precision: 0, ...(formatTick && { callback: formatTick }) },
            },
        },
    };
}
