import { useI18n } from '@/i18n/i18nContext';
import { itemLabel, minutesOf, statusText, toneOf } from './calendarModel';

const NEUTRAL = 'hsl(240, 4%, 60%)';

const classesOf = (item, base) => {
    const status = item.status ? ` status-${String(item.status).replace(/[^\w-]/g, '')}` : '';
    return `${base} tone-${toneOf(item)}${status}`;
};

// A clickable item is a button; context-only ('background') items and items without onSelect are plain boxes.
const Shell = ({ item, onSelect, className, style, label, children }) => {
    if (toneOf(item) === 'background' || !onSelect) {
        return (
            <div className={className} style={style} title={label}>
                <span className="sr-only">{label}</span>
                <span aria-hidden="true" className="calItemInner">{children}</span>
            </div>
        );
    }
    return (
        <button type="button" className={className} style={style} aria-label={label} title={label} onClick={() => onSelect(item)}>
            {children}
        </button>
    );
};

// Week grid block, absolutely placed in its day column (top / height in % of the day).
export const ItemBlock = ({ item, column, columns, range, onSelect }) => {
    const { t, formatDate } = useI18n();
    const start = Math.max(minutesOf(item.start), range.start);
    const end = Math.min(Math.max(minutesOf(item.end), start + 15), range.end);
    const span = range.end - range.start;
    const minutes = end - start;
    const size = minutes <= 30 ? ' isTiny' : minutes <= 60 ? ' isShort' : '';
    // Overlapping items (context blocks included) share the column side by side, with 2px gaps.
    const style = {
        '--cal-accent': item.color ?? NEUTRAL,
        top: `calc(${((start - range.start) / span) * 100}% + 1px)`,
        height: `calc(${(minutes / span) * 100}% - 2px)`,
        left: `calc(${(column / columns) * 100}% + 2px)`,
        width: `calc(${100 / columns}% - 4px)`,
    };
    return (
        <Shell item={item} onSelect={onSelect} className={classesOf(item, `calItem${size}`)} style={style} label={itemLabel(item, { t, formatDate })}>
            <span className="calItemTime">
                {item.start}–{item.end}
            </span>
            <strong className="calItemTitle">{item.title}</strong>
            {item.badge && <span className="calBadge">{item.badge}</span>}
            {item.subtitle && <span className="calItemSub">{item.subtitle}</span>}
        </Shell>
    );
};

// Month cell chip: dot, start time, title.
export const ItemChip = ({ item, onSelect }) => {
    const { t, formatDate } = useI18n();
    return (
        <Shell item={item} onSelect={onSelect} className={classesOf(item, 'calChip')} style={{ '--cal-accent': item.color ?? NEUTRAL }} label={itemLabel(item, { t, formatDate })}>
            <span className="calDot" aria-hidden="true" />
            <span className="calChipTime">{item.start}</span>
            <span className="calChipTitle">{item.title}</span>
        </Shell>
    );
};

// Agenda row (phones): times, a colour bar, title / subtitle and the status or badge as text.
export const ItemRow = ({ item, onSelect }) => {
    const { t, formatDate } = useI18n();
    const status = statusText(item, t);
    return (
        <Shell item={item} onSelect={onSelect} className={classesOf(item, 'calRow')} style={{ '--cal-accent': item.color ?? NEUTRAL }} label={itemLabel(item, { t, formatDate })}>
            <span className="calRowTime">
                <strong>{item.start}</strong>
                <span>{item.end}</span>
            </span>
            <span className="calRowBar" aria-hidden="true" />
            <span className="calRowText">
                <strong>{item.title}</strong>
                {(item.subtitle || status) && <span>{[item.subtitle, toneOf(item) === 'background' ? null : status].filter(Boolean).join(' · ')}</span>}
            </span>
            {item.badge && <span className="calBadge">{item.badge}</span>}
        </Shell>
    );
};
