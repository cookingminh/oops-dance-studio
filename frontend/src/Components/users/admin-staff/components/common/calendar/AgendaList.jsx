import { LuPlus } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { ItemRow } from './CalendarItem';

// Phones: the shown days one under the other, each with its items in time order. Context-only items
// are listed too (muted), so the reason a slot is taken stays visible without the grid.
// onSlotClick gets (date, null) here: there is no time grid to pick a time from.
const AgendaList = ({ dates, byDate, today, onSelect, onSlotClick, slotLabel }) => {
    const { t, formatDate } = useI18n();
    return (
        <ol className="calAgenda">
            {dates.map((iso) => {
                const items = byDate.get(iso) ?? [];
                return (
                    <li key={iso} className={`calAgendaDay${iso === today ? ' isToday' : ''}${iso < today ? ' isPast' : ''}`} data-date={iso}>
                        <div className="calAgendaHead">
                            <strong>{formatDate(iso, 'long')}</strong>
                            {iso === today && <span className="calTodayTag">{t('Today')}</span>}
                            {onSlotClick && (
                                <button
                                    type="button"
                                    className="calAgendaAdd"
                                    aria-label={`${slotLabel ?? t('Add')} · ${formatDate(iso, 'long')}`}
                                    onClick={() => onSlotClick(iso, null)}
                                >
                                    <LuPlus aria-hidden="true" />
                                </button>
                            )}
                        </div>
                        {items.length === 0 ? (
                            <p className="calAgendaEmpty">{t('Nothing planned')}</p>
                        ) : (
                            <div className="calAgendaItems">
                                {items.map((item) => (
                                    <ItemRow key={item.id} item={item} onSelect={onSelect} />
                                ))}
                            </div>
                        )}
                    </li>
                );
            })}
        </ol>
    );
};

export default AgendaList;
