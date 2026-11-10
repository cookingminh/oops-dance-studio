import { useI18n } from '@/i18n/i18nContext';
import './refunds.scss';

// The cancellation policy as a short, calm list (from policyLines() in refundText.js). The line that
// applies right now is marked, in words as well as colour.
const PolicyLines = ({ lines, className = '' }) => {
    const { t } = useI18n();
    return (
        <ul className={`rfPolicy ${className}`}>
            {lines.map((line) => (
                <li key={line.key} className={line.current ? 'isCurrent' : undefined}>
                    <span className="rfPolicyDot" aria-hidden="true" />
                    <span className="rfPolicyText">{t(line.key, line.vars)}</span>
                    {line.current && <em className="rfApplies">{t('Applies now')}</em>}
                </li>
            ))}
        </ul>
    );
};

export default PolicyLines;
