import { useId, useState } from 'react';
import { LuCheck } from 'react-icons/lu';
import { EXPENSE_CATEGORIES, categoryOf } from '@/lib/expenseCategories';
import { useI18n } from '@/i18n/i18nContext';
import { CATEGORY_ICONS } from './categoryIcons';

// Category as a grid of icon tiles (real radio buttons, so arrow keys move between them).
// The line under the grid says what belongs in the tile you point at, or in the chosen one.
const CategoryPicker = ({ value, onChange, isInvalid }) => {
    const { t } = useI18n();
    const name = useId();
    const [pointed, setPointed] = useState(null);
    const shown = pointed ?? value;
    const info = shown ? categoryOf(shown) : null;

    return (
        <fieldset className={`exCatPicker${isInvalid ? ' isInvalid' : ''}`}>
            <legend className="exFieldLabel">{t('Category')}</legend>
            <div className="exCatGrid" onMouseLeave={() => setPointed(null)}>
                {EXPENSE_CATEGORIES.map((category) => {
                    const Icon = CATEGORY_ICONS[category.key];
                    const checked = value === category.key;
                    return (
                        <label key={category.key} className={`exCatOption${checked ? ' isChecked' : ''}`} onMouseEnter={() => setPointed(category.key)}>
                            <input
                                type="radio"
                                name={name}
                                value={category.key}
                                checked={checked}
                                onChange={() => onChange(category.key)}
                                onFocus={() => setPointed(category.key)}
                                onBlur={() => setPointed(null)}
                                aria-describedby={`${name}-hint`}
                            />
                            <span className="exCatTileIcon" aria-hidden="true">
                                <Icon />
                            </span>
                            <span className="exCatTileLabel">{t(category.label)}</span>
                            {checked && <LuCheck className="exCatTick" aria-hidden="true" />}
                        </label>
                    );
                })}
            </div>
            <p id={`${name}-hint`} className={`exHint exCatHint${isInvalid && !info ? ' isError' : ''}`} aria-live="polite">
                {info ? (
                    <>
                        <strong>{t(info.label)}</strong>
                        {' · '}
                        {t(info.hint)}
                    </>
                ) : isInvalid ? (
                    t('Pick a category.')
                ) : (
                    t('Pick the one that fits best.')
                )}
            </p>
        </fieldset>
    );
};

export default CategoryPicker;
