import { LuChevronLeft, LuChevronRight, LuRepeat, LuSparkles } from 'react-icons/lu';
import { categoryOf } from '@/lib/expenseCategories';
import { classImageUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import placeholder from '@/assets/images/logo-mark.webp';
import { CATEGORY_ICONS } from './categoryIcons';
import { capitalizeFirst, nextMonth, prevMonth } from './expensesModel';

// Small pieces shared by the expenses page and its dialogs.

// The category's icon on a soft tile; the label is for screen readers when it isn't shown.
export const CategoryIcon = ({ category, size = 'md', labelled = false }) => {
    const { t } = useI18n();
    const info = categoryOf(category);
    const Icon = CATEGORY_ICONS[info.key];
    return (
        <span className={`exCatIcon is-${size}`} title={t(info.label)} {...(labelled ? { role: 'img', 'aria-label': t(info.label) } : { 'aria-hidden': true })}>
            <Icon />
        </span>
    );
};

// The class a cost belongs to (its picture and name).
export const ClassChip = ({ cls, image }) => (
    <span className="exClassChip" title={cls.name}>
        <img src={classImageUrl(image) ?? placeholder} alt="" />
        <span>{cls.name}</span>
    </span>
);

// "Monthly": the row was added by a recurring cost.
export const RecurringBadge = () => {
    const { t } = useI18n();
    return (
        <span className="exBadge" title={t('Added automatically by a recurring cost.')}>
            <LuRepeat aria-hidden="true" />
            {t('Monthly')}
        </span>
    );
};

// Why an automatic studio rent is there and when it goes (lib/expenseCategories.js isAutomaticRent).
export const AUTO_RENT_HINT = 'Added by itself after each session at a rented studio, and taken off if that session is called off.';

// "Automatic": a rented studio's rent for one session, added by the server.
export const AutoRentBadge = () => {
    const { t } = useI18n();
    return (
        <span className="exBadge isAuto" title={t(AUTO_RENT_HINT)}>
            <LuSparkles aria-hidden="true" />
            {t('Automatic')}
        </span>
    );
};

// ‹ November 2026 › with "This month" / "Earlier month" under it.
export const MonthNav = ({ month, thisMonth, maxMonth, onPick }) => {
    const { t, monthName } = useI18n();
    const tag = !month ? '' : month === thisMonth ? t('This month') : month > thisMonth ? t('Next month') : t('Earlier month');
    return (
        <div className="exMonthNav" role="group" aria-label={t('Month')}>
            <button type="button" aria-label={t('Previous month')} disabled={!month} onClick={() => onPick(prevMonth(month))}>
                <LuChevronLeft />
            </button>
            <span className="exMonthName" aria-live="polite">
                <strong>{month ? capitalizeFirst(monthName(month, { withYear: true })) : '…'}</strong>
                <small>{tag}</small>
            </span>
            <button type="button" aria-label={t('Next month')} disabled={!month || month >= maxMonth} onClick={() => onPick(nextMonth(month))}>
                <LuChevronRight />
            </button>
        </div>
    );
};
