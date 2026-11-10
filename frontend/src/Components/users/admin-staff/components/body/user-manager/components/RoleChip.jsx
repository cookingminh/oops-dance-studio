import { useI18n } from '@/i18n/i18nContext';
import { KINDS } from '../peopleModel';

// Coloured role label with its icon (the colour is never the only signal: the name is written out).
// `label` replaces the role name (already translated).
const RoleChip = ({ kind, label, className = '' }) => {
    const { t } = useI18n();
    const meta = KINDS[kind] ?? KINDS.guest;
    const Icon = meta.icon;
    return (
        <span className={`roleChip ${className}`} data-tone={meta.tone}>
            <Icon aria-hidden="true" />
            {label ?? t(meta.label)}
        </span>
    );
};

export default RoleChip;
