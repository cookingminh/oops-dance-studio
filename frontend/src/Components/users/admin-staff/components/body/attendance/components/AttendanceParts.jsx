import { Button, Tooltip } from '@nextui-org/react';
import { LuCheck, LuStickyNote } from 'react-icons/lu';
import { formatClock } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';

// Small pieces shared by the attendance sections.

// `label` is already translated.
export const ProofThumb = ({ url, label, onView }) => {
    const { t } = useI18n();
    return url ? (
        <button type="button" className="proofThumb" aria-label={t('View proof photo')} title={label} onClick={() => onView({ url, label })}>
            <img src={url} alt="" />
        </button>
    ) : null;
};

export const NoteButton = ({ record }) => {
    const { t } = useI18n();
    return record?.details ? (
        <Tooltip content={<span className="noteTooltip">{record.details}</span>}>
            <Button isIconOnly size="sm" variant="light" aria-label={t('Session note')}>
                <LuStickyNote className="text-default-500" />
            </Button>
        </Tooltip>
    ) : null;
};

// Check-in or check-out on a row: a tick, the time (or "Not yet") and the proof photo.
export const CheckMini = ({ label, proofLabel, at, proof, onView }) => {
    const { t } = useI18n();
    return (
        <span className={`atStep${at ? ' isDone' : ''}`}>
            <span className="atStepMark" aria-hidden="true">{at && <LuCheck />}</span>
            <span className="atStepText">
                <small>{label}</small>
                <strong>{at ? formatClock(at) : t('Not yet')}</strong>
            </span>
            <ProofThumb url={proof} label={proofLabel} onView={onView} />
        </span>
    );
};
