import { useMemo } from 'react';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';

const MINUS = '−';

// Number formats for the report in the reader's language: full VND for tiles and tables,
// compact VND ("8.6M ₫" / "8,6 Tr ₫") for sentences and axes, percentages and point changes.
export function useReportFormat() {
    const { lang, intl, monthName } = useI18n();
    return useMemo(() => {
        // en-GB abbreviates millions as "m" in browsers; the studio's English reads "8.6M".
        const compact = new Intl.NumberFormat(intl === 'en-GB' ? 'en' : intl, { notation: 'compact', maximumFractionDigits: 1 });
        const percent = new Intl.NumberFormat(intl, { style: 'percent', maximumFractionDigits: 1 });
        const decimal = new Intl.NumberFormat(intl, { maximumFractionDigits: 1 });
        const integer = new Intl.NumberFormat(intl);
        const shortMonth = new Intl.DateTimeFormat(intl, { month: 'short' });
        const asDate = (month) => new Date(`${month}T00:00:00`);
        const signed = (text, value) => (value < 0 ? `${MINUS}${text}` : text);

        return {
            money: (value) => (value === null || value === undefined ? '—' : signed(formatVnd(Math.abs(value)), value)),
            short: (value) => (value === null || value === undefined ? '—' : signed(`${compact.format(Math.abs(value))} ₫`, value)),
            pct: (value) => (value === null || value === undefined ? '—' : signed(percent.format(Math.abs(value)), value)),
            count: (value) => integer.format(value ?? 0),
            // Change in percentage points: 0.031 → "3.1"
            points: (value) => decimal.format(Math.abs(value) * 100),
            plainShort: (value) => compact.format(value),
            // Axis labels: "Nov", with the year on the first month and on January.
            // ("Jul 2026" / "Tháng 7/2026": vi-VN's own short month-year reads "thg 7 2026").
            axisMonth: (month, index) =>
                index === 0 || month.slice(5, 7) === '01'
                    ? `${shortMonth.format(asDate(month))}${lang === 'vi' ? '/' : ' '}${month.slice(0, 4)}`
                    : shortMonth.format(asDate(month)),
            // Narrow charts: "Jul" / "T7".
            axisMonthNarrow: (month) => (lang === 'vi' ? `T${Number(month.slice(5, 7))}` : shortMonth.format(asDate(month))),
            shortMonth: (month) => shortMonth.format(asDate(month)),
            // "October 2026" / "Tháng 10 năm 2026" for a heading.
            heading: (month) => {
                const text = monthName(month, { withYear: true });
                return text.charAt(0).toUpperCase() + text.slice(1);
            },
            // "July 2026" / "tháng 7 năm 2026" inside a sentence.
            monthYear: (month) => monthName(month, { withYear: true }),
            monthName,
        };
    }, [lang, intl, monthName]);
}
