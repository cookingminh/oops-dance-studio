import { Button } from '@nextui-org/react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../Segmented';
import { weekDays } from './calendarModel';

// "10–16 November 2026" for a week (Intl picks the shortest range, also across months / years).
function weekTitle(date, intl) {
    const [monday, , , , , , sunday] = weekDays(date);
    const format = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long', year: 'numeric' });
    return typeof format.formatRange === 'function' ? format.formatRange(monday, sunday) : `${format.format(monday)} – ${format.format(sunday)}`;
}

// Title, ‹ Today ›, Week | Month and the page's own controls on the right.
const CalendarToolbar = ({ view, date, onStep, onToday, onViewChange, extra, isToday }) => {
    const { t, intl, formatDate } = useI18n();
    const isMonth = view === 'month';
    return (
        <div className="calToolbar">
            <h3 className="calTitle" aria-live="polite">
                {isMonth ? formatDate(date, 'monthYear') : weekTitle(date, intl)}
            </h3>
            <div className="calNav">
                <Button isIconOnly size="sm" variant="flat" aria-label={t(isMonth ? 'Previous month' : 'Previous week')} onPress={() => onStep(-1)}>
                    <LuChevronLeft aria-hidden="true" />
                </Button>
                <Button size="sm" variant="flat" className="calTodayBtn" isDisabled={isToday} onPress={onToday}>
                    {t('Today')}
                </Button>
                <Button isIconOnly size="sm" variant="flat" aria-label={t(isMonth ? 'Next month' : 'Next week')} onPress={() => onStep(1)}>
                    <LuChevronRight aria-hidden="true" />
                </Button>
            </div>
            <div className="calToolbarEnd">
                {extra}
                {onViewChange && (
                    <Segmented
                        label={t('Calendar view')}
                        className="calViewSwitch"
                        options={[
                            { key: 'week', label: t('Week') },
                            { key: 'month', label: t('Month') },
                        ]}
                        value={view}
                        onChange={onViewChange}
                    />
                )}
            </div>
        </div>
    );
};

export default CalendarToolbar;
