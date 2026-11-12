import { LuAlertTriangle, LuBanknote, LuCalendarX, LuMusic, LuVideoOff } from 'react-icons/lu';
import { classImageUrl } from '@/services/storage';
import { formatTime } from '@/lib/format';
import { imagePositionOf } from '@/lib/classImage';
import { useI18n } from '@/i18n/i18nContext';
import { weeklySlots } from './hubModel';

// Small pieces shared by the directory and the class page.

// running / ending on … / opens … / ended … — `badge` from phaseBadge().
export const PhaseBadge = ({ badge, className = '' }) => {
    const { t, formatDate } = useI18n();
    return (
        <span className={`phaseBadge hubPhase tone-${badge.tone} ${className}`}>
            {badge.phase === 'running' && <span className="livePulse" aria-hidden="true" />}
            {t(badge.key, badge.date ? { date: formatDate(badge.date, 'dayMonth') } : undefined)}
        </span>
    );
};

// "Mon 18:00–19:30" chips for the weekly sessions (the kept snapshot for an ended class).
export const ScheduleChips = ({ cls, empty = null }) => {
    const { dayName } = useI18n();
    const slots = weeklySlots(cls);
    if (slots.length === 0) return empty;
    return (
        <span className="hubSlots">
            {slots.map((slot) => (
                <span key={`${slot.day_of_week}-${slot.start_time}`} className="hubSlot">
                    <strong>{dayName(slot.day_of_week, 'short')}</strong> {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                </span>
            ))}
        </span>
    );
};

const FLAG_ICONS = { sessions: LuCalendarX, routine: LuMusic, ending: LuMusic, unpaid: LuBanknote, video: LuVideoOff };

// Things a class needs (no routine, unpaid, video missing…), each with an icon and words.
export const FlagChips = ({ flags }) => {
    const { t } = useI18n();
    if (!flags.length) return null;
    return (
        <span className="hubFlags">
            {flags.map((flag) => {
                const Icon = FLAG_ICONS[flag.id] ?? LuAlertTriangle;
                return (
                    <span key={flag.id} className={`hubFlag is-${flag.tone}`}>
                        <Icon aria-hidden="true" />
                        {t(flag.key, flag.vars)}
                    </span>
                );
            })}
        </span>
    );
};

// The class photo (cropped where staff framed it for the website), or the brand gradient with a music note.
export const ClassImage = ({ cls, className = '' }) => {
    const url = classImageUrl(cls.image_path);
    return url ? (
        <img className={`hubImage ${className}`} src={url} alt="" loading="lazy" style={{ objectPosition: imagePositionOf(cls) }} />
    ) : (
        <span className={`hubImage isPlaceholder ${className}`} aria-hidden="true">
            <LuMusic />
        </span>
    );
};

// A thin progress bar with an accessible label (`value` 0–1).
export const MiniBar = ({ value, label, tone = 'brand' }) => (
    <span
        className={`hubBar tone-${tone}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((value ?? 0) * 100)}
    >
        <span style={{ width: `${Math.min(100, Math.max(0, (value ?? 0) * 100))}%` }} />
    </span>
);
