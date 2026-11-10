import { useI18n } from '@/i18n/i18nContext';

// A check-in/out photo as a small button that opens it full size. `label` is already translated.
const ProofThumb = ({ url, label, onView }) => {
    const { t } = useI18n();
    if (!url) return null;
    return (
        <button type="button" className="pfProof" aria-label={t('View proof photo')} title={label} onClick={() => onView(url, label)}>
            <img src={url} alt="" />
        </button>
    );
};

export default ProofThumb;
