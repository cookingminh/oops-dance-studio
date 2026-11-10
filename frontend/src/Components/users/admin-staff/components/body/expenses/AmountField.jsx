import { useId } from 'react';
import { useI18n } from '@/i18n/i18nContext';
import { QUICK_AMOUNTS, compactVnd, groupDigits, parseAmountInput } from './expensesModel';

// The big amount: digits are grouped as you type (1.200.000 ₫), "500k" / "2m" are shorthands,
// and the chips fill in the usual amounts in one tap.
const AmountField = ({ value, onChange, isInvalid, autoFocus = false }) => {
    const { t, intl } = useI18n();
    const id = useId();
    const hintId = `${id}-hint`;

    return (
        <div className={`exAmount${isInvalid ? ' isInvalid' : ''}`}>
            <label htmlFor={id} className="exFieldLabel">
                {t('Amount')}
            </label>
            <div className="exAmountBox">
                <input
                    id={id}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={groupDigits(value)}
                    onChange={(event) => onChange(parseAmountInput(event.target.value))}
                    aria-invalid={isInvalid || undefined}
                    aria-describedby={hintId}
                    autoFocus={autoFocus}
                />
                <span className="exAmountUnit" aria-hidden="true">₫</span>
            </div>
            <div className="exQuick" role="group" aria-label={t('Quick amounts')}>
                {QUICK_AMOUNTS.map((amount) => (
                    <button key={amount} type="button" aria-pressed={value === amount} onClick={() => onChange(amount)}>
                        {compactVnd(amount, intl)}
                    </button>
                ))}
            </div>
            <p id={hintId} className={`exHint${isInvalid ? ' isError' : ''}`}>
                {isInvalid ? t('Enter an amount above 0.') : t('Tip: type 500k or 2m for short.')}
            </p>
        </div>
    );
};

export default AmountField;
